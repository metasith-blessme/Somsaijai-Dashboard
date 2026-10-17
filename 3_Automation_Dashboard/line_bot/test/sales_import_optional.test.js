const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const XLSX = require('xlsx');
const script = path.join(__dirname, '..', '..', 'safe_import_sales.js');

function workbook() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssj-sales-'));
  const rows = [
    ['Som Sai Jai'],
    [],
    ['Date', 'Day', 'Revenue (฿)', 'Cash (฿)', 'Expenses (฿)', 'Cash-Exp (฿)', 'Scan/Transfer (฿)', 'Orange', 'Total Cups'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Oct26');
  XLSX.writeFile(wb, path.join(dir, 'SomSaiJai_Dashboard_B2_2026.xlsx'));
  return dir;
}

function run(dir, changeList) {
  const file = path.join(dir, 'changes.json');
  fs.writeFileSync(file, JSON.stringify(changeList));
  return spawnSync(process.execPath, [script, file, '--commit'], {
    env: { ...process.env, SOMSAIJAI_DASHBOARD_DIR: dir },
    encoding: 'utf8',
  });
}

test('observed cup counts are written and a missing column is kept, not turned into zero', () => {
  const dir = workbook();
  const change = {
    batch_id: 'b',
    month: 'Oct26',
    rows: [{
      branch: 'B2', date: '17/10/2026', day: 'Sat', revenue: 120, cash: 100, scan: 20,
      or: 3, guava: 2, note: 'from the photo',
    }],
  };
  const first = run(dir, change);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const wb = XLSX.readFile(path.join(dir, 'SomSaiJai_Dashboard_B2_2026.xlsx'));
  const grid = XLSX.utils.sheet_to_json(wb.Sheets.Oct26, { header: 1, defval: null });
  const header = grid.find(row => row && row.includes('Date'));
  const data = grid.find(row => row && row[0] === '17/10/2026');
  assert.equal(data[header.indexOf('Revenue (฿)')], 120);
  assert.equal(data[header.indexOf('Cash (฿)')], 100);
  assert.equal(data[header.indexOf('Scan/Transfer (฿)')], 20);
  assert.equal(data[header.indexOf('Orange')], 3);
  assert.equal(header.includes('Guava'), false);
  assert.match(String(data[header.indexOf('Source Note')]), /Guava=2/);

  const again = run(dir, change);
  assert.equal(again.status, 0, again.stderr || again.stdout);
  assert.match(again.stdout, /Nothing to do|zero changes|skipped/);
  const wb2 = XLSX.readFile(path.join(dir, 'SomSaiJai_Dashboard_B2_2026.xlsx'));
  const grid2 = XLSX.utils.sheet_to_json(wb2.Sheets.Oct26, { header: 1, defval: null });
  const days = grid2.filter(row => row && row[0] === '17/10/2026');
  assert.equal(days.length, 1);
});

test('mangosteen, mangosteen & lychee, and rambutan write only into their own columns', () => {
  const dir = workbook();
  const wb0 = XLSX.readFile(path.join(dir, 'SomSaiJai_Dashboard_B2_2026.xlsx'));
  const grid0 = XLSX.utils.sheet_to_json(wb0.Sheets.Oct26, { header: 1, defval: null });
  const header0 = grid0.find(row => row && row.includes('Date'));
  header0.push('Mangosteen', 'Mangosteen & Lychee', 'Rambutan');
  wb0.Sheets.Oct26 = XLSX.utils.aoa_to_sheet(grid0);
  XLSX.writeFile(wb0, path.join(dir, 'SomSaiJai_Dashboard_B2_2026.xlsx'));
  const change = {
    batch_id: 'b',
    month: 'Oct26',
    rows: [{
      branch: 'B2', date: '01/10/2026', day: 'Thu', revenue: 387, cash: 258, scan: 129,
      mangosteen: 1, mangosteen_lychee: 1, rambutan: 1, or: 4,
      note: 'from the 1/10/26 sheet',
    }],
  };
  const result = run(dir, change);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const wb = XLSX.readFile(path.join(dir, 'SomSaiJai_Dashboard_B2_2026.xlsx'));
  const grid = XLSX.utils.sheet_to_json(wb.Sheets.Oct26, { header: 1, defval: null });
  const header = grid.find(row => row && row.includes('Date'));
  const data = grid.find(row => row && row[0] === '01/10/2026');
  assert.equal(data[header.indexOf('Orange')], 4);
  assert.equal(data[header.indexOf('Mangosteen')], 1);
  assert.equal(data[header.indexOf('Mangosteen & Lychee')], 1);
  assert.equal(data[header.indexOf('Rambutan')], 1);
  assert.equal(data[header.indexOf('Revenue (฿)')], 387);
});
