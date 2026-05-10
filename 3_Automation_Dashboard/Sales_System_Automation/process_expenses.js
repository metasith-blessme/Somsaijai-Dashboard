const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const XLSX = require('xlsx');

const BRANCH = process.argv[2] || 'B1'; // NEW: Branch parameter
const ROOT_DIR = path.join(__dirname, '..', '..');
const DASHBOARD_DIR = path.join(ROOT_DIR, '3_Automation_Dashboard');
const EXPENSES_DIR = path.join(ROOT_DIR, BRANCH, '2_Expenses'); // Updated path
const MONTHS = ['Jan26', 'Feb26', 'Mar26', 'Apr26', 'May26', 'Jun26', 'Jul26', 'Aug26', 'Sep26', 'Oct26', 'Nov26', 'Dec26'];
const EXCEL_FILE = path.join(DASHBOARD_DIR, `SomSaiJai_Dashboard_${BRANCH}_2026.xlsx`); // Branch-specific Excel
const OCR_BIN = path.join(DASHBOARD_DIR, 'ocr_bin');

function parseThaiDate(text) {
    const match = text.match(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.)\s*(69|2569|2026|68|2568|2025)/);
    if (!match) return null;
    const day = match[1].padStart(2, '0');
    let month = '01';
    if (match[2] === 'ก.พ.') month = '02';
    else if (match[2] === 'มี.ค.') month = '03';
    else if (match[2] === 'เม.ย.') month = '04';
    return `${day}/${month}/2026`;
}

function parseAmount(text) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('จำนวน:')) {
            let nextLine = lines[i+1] || lines[i];
            let m = nextLine.match(/([\d,]+\.\d{2})/);
            if (m) return parseFloat(m[1].replace(/,/g, ''));
        }
    }
    const fallbackMatch = text.match(/([\d,]+\.\d{2})\s*บาท/);
    if (fallbackMatch) return parseFloat(fallbackMatch[1].replace(/,/g, ''));
    return null;
}

function parseNote(text) {
    const match = text.match(/บันทึกช่วยจำ:\s*(.*)/);
    return match ? match[1].trim() : 'Unknown';
}

function categorize(note, fullText) {
    const n = note.toLowerCase() + ' ' + fullText.toLowerCase();
    let cat = 'Other';
    let bucket = 'OPEX';

    if (n.includes('ส้ม')) cat = 'Orange';
    else if (n.includes('แตงโม')) cat = 'Watermelon';
    else if (n.includes('แอปเปิ้ล') || n.includes('เมล่อน')) cat = 'Apple/Melon';
    else if (n.includes('มะม่วง')) cat = 'Mango';
    else if (n.includes('ทับทิม')) cat = 'Pomegranate';
    else if (n.includes('มะพร้าว')) cat = 'Coconut';
    else if (n.includes('ส่ง') || n.includes('lalamove') || n.includes('grab')) cat = 'Transportation';
    else if (n.includes('เงินเดือน') || n.includes('staff') || n.includes('ค่าแรง')) cat = 'Salary';
    else if (n.includes('ถุง') || n.includes('แพ็ค') || n.includes('กล่อง') || n.includes('แก้ว') || n.includes('ขวด') || n.includes('ฝา') || n.includes('หลอด')) cat = 'Packaging';
    else if (n.includes('น้ำแข็ง') || n.includes('ice')) cat = 'Ice';
    else if (n.includes('น้ำ') || n.includes('water')) cat = 'Water';
    else if (n.includes('นม') || n.includes('milk') || n.includes('conden')) cat = 'Milk/Conden';
    else if (n.includes('ค่าไฟ') || n.includes('ค่าน้ำ') || n.includes('ค่าเช่า')) cat = 'Fixed Costs';
    else if (n.includes('คีออส') || n.includes('ป้าย') || n.includes('เครื่องสกัด') || n.includes('ตกแต่ง')) cat = 'Investment';

    if (['Orange', 'Watermelon', 'Apple/Melon', 'Mango', 'Pomegranate', 'Coconut', 'Packaging', 'Ice', 'Transportation', 'Water', 'Milk/Conden'].includes(cat)) {
        bucket = 'COGS';
    } else if (['Investment'].includes(cat)) {
        bucket = 'CAPEX';
    } else {
        bucket = 'OPEX';
    }

    return { cat, bucket };
}

const allExpenses = [];

MONTHS.forEach(month => {
    const dir = path.join(EXPENSES_DIR, month);
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    console.log(`🔍 Processing ${files.length} receipts for ${BRANCH} in ${month}...`);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        try {
            const out = execSync(`"${OCR_BIN}" "${filePath}"`, { encoding: 'utf8' });
            const date = parseThaiDate(out);
            const amount = parseAmount(out);
            const note = parseNote(out);
            const { cat, bucket } = categorize(note, out);
            if (date && amount) {
                allExpenses.push([date, month, bucket, cat, note, amount]);
            } else {
                allExpenses.push([date || '01/01/2026', month, bucket, cat, note, amount || 0]);
            }
        } catch (e) {
            console.error(`Error processing ${file}:`, e.message);
        }
    });
});

// NEW: Add manual expenses from JSON
const MANUAL_FILE = path.join(__dirname, 'manual_expenses.json');
if (fs.existsSync(MANUAL_FILE)) {
    try {
        const manual = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8'));
        Object.keys(manual).forEach(month => {
            if (manual[month] && manual[month][BRANCH]) {
                manual[month][BRANCH].forEach(exp => {
                    allExpenses.push([exp.date, month, exp.bucket || 'OPEX', exp.category, exp.description, exp.amount]);
                });
                console.log(`➕ Added ${manual[month][BRANCH].length} manual expenses for ${BRANCH} in ${month}`);
            }
        });
    } catch (e) {
        console.error("Error reading manual_expenses.json:", e.message);
    }
}

if (allExpenses.length === 0) {
    console.log(`No expenses found for ${BRANCH}.`);
    process.exit(0);
}

allExpenses.sort((a, b) => {
    const pa = a[0].split('/').reverse().join('');
    const pb = b[0].split('/').reverse().join('');
    return pa.localeCompare(pb);
});

const wb = XLSX.readFile(EXCEL_FILE);
const ws_data = [['Som Sai Jai - Daily Detailed Expenses 2026'], [], ['Date', 'Month', 'Bucket', 'Category', 'Description', 'Amount (฿)']];
allExpenses.forEach(r => ws_data.push(r));

const ws = XLSX.utils.aoa_to_sheet(ws_data);
wb.Sheets['Daily_Expenses'] = ws;
XLSX.writeFile(wb, EXCEL_FILE);

console.log(`✅ [${BRANCH}] Daily_Expenses sheet updated with ${allExpenses.length} entries.`);
