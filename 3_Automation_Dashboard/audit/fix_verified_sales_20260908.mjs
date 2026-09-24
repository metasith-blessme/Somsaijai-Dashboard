// Dry run by default. --apply edits only source-supported cells, after backup and preservation checks.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url), XLSX=require('xlsx');
const { parseDate }=require('./sheet_rows.js');
const runtime=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { FileBlob, SpreadsheetFile }=await import(pathToFileURL(require.resolve('@oai/artifact-tool',{paths:[runtime]})));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'SomSaiJai_Dashboard_B1_2026.xlsx');
const original=XLSX.readFile(file,{cellStyles:true});
const changes=[];
function target(sheet,date,header,from,to){
  const rows=XLSX.utils.sheet_to_json(original.Sheets[sheet],{header:1,defval:null});
  const h=rows.findIndex(r=>r.includes('Date'));
  const matches=rows.map((r,i)=>({r,i})).filter(x=>parseDate(x.r[0])?.key===date);
  assert.equal(matches.length,1,`${sheet} ${date}: must match one day`);
  const col=rows[h].indexOf(header);
  assert.ok(col>=0,`missing ${header}`);
  const cell=XLSX.utils.encode_cell({r:matches[0].i,c:col});
  const value=original.Sheets[sheet][cell]?.v??null;
  assert.ok(value===from||value===to,`${sheet}!${cell} unexpected ${value}`);
  if(value!==to)changes.push({sheet,cell,from:value,to});
}
target('Feb26','2026-02-27','Revenue (฿)',13325,11325);
target('Jul26','2026-07-03','Bot Big',0,2);
// Explicit bottle takings avoid assuming a price for every historic bottle count.
for(const [cell,from,to] of [['AE2',null,'Bottle Revenue (฿)'],['AE5',null,400]]){
  const value=original.Sheets.Jul26[cell]?.v??null;
  assert.ok(value===from||value===to,`Jul26!${cell} unexpected ${value}`);
  if(value!==to)changes.push({sheet:'Jul26',cell,from:value,to});
}
assert.equal(parseDate(original.Sheets.Jul26.A5.v).key,'2026-07-03','bottle amount belongs to 3 July');
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',changes},null,2));
if(!changes.length)process.exit(0);
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const out=path.join(os.tmpdir(),'somsaijai-corrections-20260908');
await fs.mkdir(out,{recursive:true});
const view=await wb.render({sheetName:'Feb26',range:'A27:H31',scale:1.5,format:'png'});
await fs.writeFile(path.join(out,'before.png'),new Uint8Array(await view.arrayBuffer()));
if(!process.argv.includes('--apply'))process.exit(0);
for(const c of changes)wb.worksheets.getItem(c.sheet).getRange(c.cell).values=[[c.to]];
wb.recalculate();
const preview=await wb.render({sheetName:'Feb26',range:'A27:H31',scale:1.5,format:'png'});
await fs.writeFile(path.join(out,'after.png'),new Uint8Array(await preview.arrayBuffer()));
const candidate=path.join(out,'B1-candidate.xlsx');
await (await SpreadsheetFile.exportXlsx(wb)).save(candidate);
const next=XLSX.readFile(candidate,{cellStyles:true});
assert.deepEqual(next.SheetNames,original.SheetNames,'sheet order must be preserved');
const intended=new Map(changes.map(c=>[`${c.sheet}!${c.cell}`,c.to]));
for(const sheet of original.SheetNames){
  const a=original.Sheets[sheet],b=next.Sheets[sheet];
  for(const cell of new Set([...Object.keys(a),...Object.keys(b)])){
    if(cell.startsWith('!'))continue;
    const key=`${sheet}!${cell}`;
    assert.deepEqual(b[cell]?.v??null,intended.has(key)?intended.get(key):a[cell]?.v??null,`${key} value changed unexpectedly`);
    assert.equal(b[cell]?.f,a[cell]?.f,`${key} formula changed unexpectedly`);
  }
}
const backup=file.replace('.xlsx','.bak-preverified-sales-20260908.xlsx');
try{await fs.copyFile(file,backup,fs.constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
await fs.copyFile(candidate,file);
console.log('Applied verified sales corrections; all other cell values and formulas preserved.');
