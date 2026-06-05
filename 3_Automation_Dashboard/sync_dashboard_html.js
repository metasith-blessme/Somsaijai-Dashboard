const fs = require('fs');
const path = require('path');

const DASHBOARD_DIR = __dirname;
const DATA_FILE = path.join(DASHBOARD_DIR, 'data.json');
const HTML_FILE = path.join(DASHBOARD_DIR, 'SomSaiJai_Dashboard.html');

if (!fs.existsSync(DATA_FILE)) {
    console.error('No data.json found.');
    process.exit(1);
}

if (!fs.existsSync(HTML_FILE)) {
    console.error('No SomSaiJai_Dashboard.html found.');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const html = fs.readFileSync(HTML_FILE, 'utf8');

const builtinContent = `const BUILT_IN = ${JSON.stringify(data, null, 2)};`;

// Replace const BUILT_IN = { ... } with our new string
const regex = /const BUILT_IN = \{[\s\S]*?\n\};/g;

if (!regex.test(html)) {
    console.error('Could not find const BUILT_IN in HTML file.');
    process.exit(1);
}

const newHtml = html.replace(regex, builtinContent);

fs.writeFileSync(HTML_FILE, newHtml, 'utf8');
console.log('✅ Standalone backup SomSaiJai_Dashboard.html updated with latest data.json.');
