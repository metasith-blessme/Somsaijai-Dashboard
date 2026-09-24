// One rendering implementation for live and standalone views; embed the current source snapshots.
const fs = require('fs'), path = require('path'), assert = require('assert');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
let html = read('index.html').replace(/[ \t]+$/gm, '');
const marker = '<script>\nlet DATA =';
assert.equal(html.split(marker).length, 2, 'main dashboard script marker must be unique');
const embed = (name, file) => `const ${name} = ${JSON.stringify(JSON.parse(read(file)), null, 2).replace(/</g, '\\u003c')};\n`;
html = html.replace(marker, () => '<script>\n'
    + embed('BUILT_IN', 'data.json')
    + embed('BUILT_IN_REPORTS', 'reports_data.json')
    + embed('BUILT_IN_LEDGER', 'stock_ledger.json')
    + 'let DATA =');
for (const library of ['xlsx.full.min.js', 'chart.umd.min.js']) {
    const tag = new RegExp(`<script src="${library.replace(/\./g, '\\.')}"[^>]*><\\/script>`);
    assert.ok(tag.test(html), `missing library ${library}`);
    html = html.replace(tag, () => `<script data-library="${library}">${read(library)}</script>`);
}
fs.writeFileSync(path.join(__dirname, 'SomSaiJai_Dashboard.html'), html);
console.log('✅ Standalone backup uses the live renderer and current embedded data, P&L, and libraries.');
