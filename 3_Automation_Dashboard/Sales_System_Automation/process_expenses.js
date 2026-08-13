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
    const match = text.match(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*(69|2569|2026|68|2568|2025)/);
    if (!match) return null;
    const day = match[1].padStart(2, '0');
    const monthMap = {
        'ม.ค.': '01',
        'ก.พ.': '02',
        'มี.ค.': '03',
        'เม.ย.': '04',
        'พ.ค.': '05',
        'มิ.ย.': '06',
        'ก.ค.': '07',
        'ส.ค.': '08',
        'ก.ย.': '09',
        'ต.ค.': '10',
        'พ.ย.': '11',
        'ธ.ค.': '12'
    };
    const month = monthMap[match[2]] || '01';
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

    // 1. Rental check first (prevents matching ingredients in rental descriptions like 'ค่าที่ร้านน้ำส้ม')
    if (n.includes('ค่าที่') || n.includes('ค่าเช่า') || n.includes('rental') || n.includes('rent')) {
        cat = 'Rental';
    }
    // 2. Ingredients
    else if (n.includes('ส้ม')) cat = 'Orange';
    else if (n.includes('แตงโม')) cat = 'Watermelon';
    else if (n.includes('มะม่วง')) cat = 'Mango';
    else if (n.includes('แอปเปิ้ล') || n.includes('แอพเปิ้ล') || n.includes('เมล่อน')) cat = 'Apple';
    else if (n.includes('ฝรั่ง')) cat = 'Guava';
    else if (n.includes('น้ำมะพร้าว')) cat = 'Coconut Water';
    else if (n.includes('เนื้อมะพร้าว')) cat = 'Coconut Meat';
    else if (n.includes('มะพร้าว')) cat = 'Coconut';
    else if (n.includes('สับปะรด') || n.includes('pineapple') || n.includes('pine')) cat = 'Pineapple';
    // 3. OPEX / Utilities / Other
    else if (n.includes('ส่ง') || n.includes('lalamove') || n.includes('grab')) cat = 'Transportation';
    else if (n.includes('เงินเดือน') || n.includes('staff') || n.includes('ค่าแรง')) cat = 'Salary';
    else if (n.includes('ถุง') || n.includes('แพ็ค') || n.includes('กล่อง') || n.includes('แก้ว') || n.includes('ขวด') || n.includes('ฝา') || n.includes('หลอด')) cat = 'Packaging';
    else if (n.includes('น้ำแข็ง') || n.includes('ice')) cat = 'Ice';
    else if (n.includes('น้ำ') || n.includes('water')) cat = 'Water';
    else if (n.includes('นม') || n.includes('milk') || n.includes('conden')) cat = 'Milk/Conden';
    else if (n.includes('ค่าไฟ') || n.includes('ค่าน้ำ')) cat = 'Fixed Costs';
    else if (n.includes('คีออส') || n.includes('ป้าย') || n.includes('เครื่องสกัด') || n.includes('ตกแต่ง')) cat = 'Investment';

    if (['Orange', 'Watermelon', 'Mango', 'Apple', 'Guava', 'Coconut Water', 'Coconut Meat', 'Coconut', 'Pineapple', 'Packaging', 'Ice', 'Transportation', 'Water', 'Milk/Conden'].includes(cat)) {
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
    // For B2, Jun26 directory is empty, but we must inject the B2 rental receipt uploaded to B1
    const dirExists = fs.existsSync(dir);
    if (!dirExists && !(BRANCH === 'B2' && month === 'Jun26')) return;

    let files = [];
    if (dirExists) {
        files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png'));
    }

    if (BRANCH === 'B2' && month === 'Jun26') {
        files.push('LINE_ALBUM_Cost 0626_260615_30.jpg');
    }

    console.log(`🔍 Processing ${files.length} receipts for ${BRANCH} in ${month}...`);
    files.forEach(file => {
        let filePath = path.join(dirExists ? dir : '', file);
        if (BRANCH === 'B2' && file === 'LINE_ALBUM_Cost 0626_260615_30.jpg') {
            filePath = path.join(ROOT_DIR, 'B1', '2_Expenses', 'Jun26', file);
        }

        // Skip B2 rent when processing B1
        if (BRANCH === 'B1' && file === 'LINE_ALBUM_Cost 0626_260615_30.jpg') {
            console.log(`⏩ Skipping B2 rent receipt ${file} from B1 processing.`);
            return;
        }

        try {
            const out = execSync(`"${OCR_BIN}" "${filePath}"`, { encoding: 'utf8' });
            let date = parseThaiDate(out);
            let amount = parseAmount(out);
            let note = parseNote(out);
            let { cat, bucket } = categorize(note, out);

            // Hardcoded overrides for known OCR failures/misreads and splits in Jun26
            if (month === 'Jun26') {
                if (file === 'LINE_ALBUM_Cost 0626_260615_30.jpg') {
                    // This is B2 rental
                    date = '01/06/2026';
                    amount = 30000;
                    cat = 'Rental';
                    bucket = 'OPEX';
                    note = 'ค่าที่ร้านน้ำส้ม b2 06/26';
                } else if (file === 'LINE_ALBUM_Cost 0626_260615_13.jpg') {
                    // This is split: B1 Rent 35000 + Stock 12000
                    date = '08/06/2026';
                    amount = 35000;
                    cat = 'Rental';
                    bucket = 'OPEX';
                    note = 'ค่าเช่าร้านเดือน June (06) b1 35000';
                    
                    // Push the 12000 Stock component (COGS, allocated by revenue ratio)
                    allExpenses.push(['08/06/2026', 'Jun26', 'COGS', 'Stock', 'Stock June 2026 (split from rent slip)', 12000]);
                    console.log('✂️ Split rent slip: Added 12,000 COGS Stock and 35,000 Rent OPEX.');
                } else if (file === 'LINE_ALBUM_Cost 0626_260615_2.jpg') {
                    date = '14/06/2026';
                    amount = 7200;
                    cat = 'Watermelon';
                    bucket = 'COGS';
                    note = 'แตงโม 90 ลูก (7-6-2569: 45 ลูก, 12-6-2569: 45 ลูก)';
                } else if (file === 'LINE_ALBUM_Cost 0626_260615_20.jpg') {
                    date = '05/06/2026';
                    amount = 8000;
                    cat = 'Watermelon';
                    bucket = 'COGS';
                    note = 'แตงโม 100 ลูก (2-6-2569: 50 ลูก, 4-6-2569: 50 ลูก)';
                } else if (file === 'LINE_ALBUM_Cost 0626_260615_29.jpg') {
                    date = '02/06/2026';
                    amount = 8000;
                    cat = 'Watermelon';
                    bucket = 'COGS';
                    note = 'แตงโม 160 ลูก (25-5-2569: 80 ลูก, 30-5-2569: 80 ลูก)';
                }
            }

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
