const XLSX = require('xlsx');
const path = require('path');

const MASTER_EXCEL = path.join(__dirname, 'SomSaiJai_Dashboard_2026.xlsx');

const month_data = [
    {"date": "01/03/2026", "day": "Sun", "rev": 10130, "cash": 4670, "exp": 120, "scan": 5460, "c_or": 114, "c_wm": 56, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 170, "bb": 1, "bs": 0, "uo": 4, "uw": 14},
    {"date": "02/03/2026", "day": "Mon", "rev": 10590, "cash": 7300, "exp": 120, "scan": 3290, "c_or": 116, "c_wm": 60, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 176, "bb": 2, "bs": 0, "uo": 4, "uw": 15},
    {"date": "03/03/2026", "day": "Tue", "rev": 11600, "cash": 6520, "exp": 120, "scan": 5080, "c_or": 124, "c_wm": 72, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 196, "bb": 2, "bs": 0, "uo": 4, "uw": 18},
    {"date": "04/03/2026", "day": "Wed", "rev": 5350, "cash": 3970, "exp": 90, "scan": 1380, "c_or": 39, "c_wm": 47, "c_mg": 11, "c_co": 0, "c_ap": 0, "tot": 97, "bb": 0, "bs": 0, "uo": 1.5, "uw": 11},
    {"date": "05/03/2026", "day": "Thu", "rev": 8760, "cash": 4670, "exp": 120, "scan": 4090, "c_or": 58, "c_wm": 46, "c_mg": 48, "c_co": 0, "c_ap": 0, "tot": 152, "bb": 0, "bs": 0, "uo": 2, "uw": 11},
    {"date": "06/03/2026", "day": "Fri", "rev": 12790, "cash": 7200, "exp": 120, "scan": 5590, "c_or": 129, "c_wm": 96, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 225, "bb": 0, "bs": 0, "uo": 4, "uw": 23},
    {"date": "07/03/2026", "day": "Sat", "rev": 14495, "cash": 2630, "exp": 150, "scan": 11865, "c_or": 163, "c_wm": 88, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 251, "bb": 0, "bs": 0, "uo": 5, "uw": 22},
    {"date": "08/03/2026", "day": "Sun", "rev": 11370, "cash": 4580, "exp": 120, "scan": 6790, "c_or": 112, "c_wm": 84, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 196, "bb": 1, "bs": 0, "uo": 4, "uw": 19},
    {"date": "09/03/2026", "day": "Mon", "rev": 7750, "cash": 5040, "exp": 120, "scan": 2710, "c_or": 83, "c_wm": 50, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 133, "bb": 0, "bs": 0, "uo": 3, "uw": 12},
    {"date": "10/03/2026", "day": "Tue", "rev": 9760, "cash": 5450, "exp": 120, "scan": 4310, "c_or": 115, "c_wm": 52, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 167, "bb": 0, "bs": 0, "uo": 4, "uw": 13},
    {"date": "11/03/2026", "day": "Wed", "rev": 10310, "cash": 5250, "exp": 120, "scan": 5060, "c_or": 114, "c_wm": 52, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 166, "bb": 3, "bs": 0, "uo": 4, "uw": 13},
    {"date": "12/03/2026", "day": "Thu", "rev": 8570, "cash": 4030, "exp": 120, "scan": 4540, "c_or": 89, "c_wm": 56, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 145, "bb": 1, "bs": 0, "uo": 3, "uw": 14},
    {"date": "13/03/2026", "day": "Fri", "rev": 10070, "cash": 5550, "exp": 120, "scan": 4520, "c_or": 119, "c_wm": 52, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 171, "bb": 0, "bs": 0, "uo": 4, "uw": 13},
    {"date": "14/03/2026", "day": "Sat", "rev": 11030, "cash": 4740, "exp": 180, "scan": 6290, "c_or": 112, "c_wm": 72, "c_mg": 8, "c_co": 0, "c_ap": 0, "tot": 192, "bb": 0, "bs": 0, "uo": 3.5, "uw": 18},
    {"date": "15/03/2026", "day": "Sun", "rev": 9790, "cash": 4780, "exp": 120, "scan": 5010, "c_or": 106, "c_wm": 64, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 170, "bb": 0, "bs": 0, "uo": 4, "uw": 17},
    {"date": "16/03/2026", "day": "Mon", "rev": 7630, "cash": 3040, "exp": 520, "scan": 4590, "c_or": 83, "c_wm": 40, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 123, "bb": 2, "bs": 0, "uo": 3, "uw": 10},
    {"date": "17/03/2026", "day": "Tue", "rev": 7310, "cash": 4130, "exp": 570, "scan": 3180, "c_or": 79, "c_wm": 43, "c_mg": 3, "c_co": 0, "c_ap": 0, "tot": 125, "bb": 0, "bs": 0, "uo": 2.5, "uw": 10},
    {"date": "18/03/2026", "day": "Wed", "rev": 5520, "cash": 2900, "exp": 570, "scan": 2620, "c_or": 57, "c_wm": 36, "c_mg": 2, "c_co": 0, "c_ap": 0, "tot": 95, "bb": 0, "bs": 0, "uo": 2, "uw": 9},
    {"date": "19/03/2026", "day": "Thu", "rev": 8730, "cash": 4900, "exp": 570, "scan": 3830, "c_or": 101, "c_wm": 41, "c_mg": 3, "c_co": 0, "c_ap": 0, "tot": 145, "bb": 1, "bs": 0, "uo": 3.5, "uw": 11},
    {"date": "20/03/2026", "day": "Fri", "rev": 7920, "cash": 4790, "exp": 120, "scan": 3130, "c_or": 95, "c_wm": 36, "c_mg": 0, "c_co": 0, "c_ap": 0, "tot": 131, "bb": 0, "bs": 0, "uo": 2.5, "uw": 9},
    {"date": "21/03/2026", "day": "Sat", "rev": 10480, "cash": 6120, "exp": 520, "scan": 4360, "c_or": 109, "c_wm": 60, "c_mg": 3, "c_co": 2, "c_ap": 7, "tot": 181, "bb": 0, "bs": 0, "uo": 3, "uw": 15},
    {"date": "22/03/2026", "day": "Sun", "rev": 9140, "cash": 5250, "exp": 520, "scan": 3890, "c_or": 111, "c_wm": 34, "c_mg": 8, "c_co": 4, "c_ap": 2, "tot": 159, "bb": 0, "bs": 0, "uo": 5, "uw": 8},
    {"date": "23/03/2026", "day": "Mon", "rev": 6210, "cash": 1770, "exp": 520, "scan": 4440, "c_or": 74, "c_wm": 21, "c_mg": 8, "c_co": 4, "c_ap": 0, "tot": 107, "bb": 0, "bs": 0, "uo": 2, "uw": 6},
    {"date": "24/03/2026", "day": "Tue", "rev": 6520, "cash": 3940, "exp": 520, "scan": 2580, "c_or": 53, "c_wm": 44, "c_mg": 6, "c_co": 9, "c_ap": 0, "tot": 112, "bb": 0, "bs": 0, "uo": 1.5, "uw": 11},
    {"date": "25/03/2026", "day": "Wed", "rev": 7240, "cash": 4920, "exp": 120, "scan": 2320, "c_or": 71, "c_wm": 32, "c_mg": 8, "c_co": 12, "c_ap": 0, "tot": 123, "bb": 0, "bs": 0, "uo": 2, "uw": 8},
    {"date": "26/03/2026", "day": "Thu", "rev": 8150, "cash": 4470, "exp": 120, "scan": 3680, "c_or": 80, "c_wm": 43, "c_mg": 6, "c_co": 11, "c_ap": 2, "tot": 142, "bb": 0, "bs": 0, "uo": 2.5, "uw": 10},
    {"date": "27/03/2026", "day": "Fri", "rev": 9570, "cash": 6250, "exp": 120, "scan": 3320, "c_or": 75, "c_wm": 69, "c_mg": 9, "c_co": 14, "c_ap": 2, "tot": 169, "bb": 0, "bs": 0, "uo": 2, "uw": 16},
    {"date": "28/03/2026", "day": "Sat", "rev": 12110, "cash": 6030, "exp": 180, "scan": 6080, "c_or": 109, "c_wm": 68, "c_mg": 9, "c_co": 16, "c_ap": 2, "tot": 204, "bb": 0, "bs": 0, "uo": 3, "uw": 12},
    {"date": "29/03/2026", "day": "Sun", "rev": 9700, "cash": 5730, "exp": 120, "scan": 3970, "c_or": 96, "c_wm": 45, "c_mg": 8, "c_co": 6, "c_ap": 6, "tot": 161, "bb": 0, "bs": 0, "uo": 3.66, "uw": 10},
];

function updateExcel() {
    const workbook = XLSX.readFile(MASTER_EXCEL);
    const ws = workbook.Sheets['Mar26'];
    if (!ws) {
        console.log('Mar26 sheet not found');
        return;
    }

    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    // Rows 1 and 2 are headers.
    // Days 1-31 are rows 3-33 (0-indexed: 2-32)
    month_data.forEach(day => {
        const dayOfMonth = parseInt(day.date.split('/')[0]);
        const rowIndex = dayOfMonth + 1; // 1st -> row 2
        
        // Col mapping: Date(0), Day(1), Rev(2), Cash(3), Exp(4), Net(5), Scan(6), Or(7), Wm(8), Mg(9), Co(10), Ap(11), Tot(12), BB(13), BS(14), UO(15), UW(16)
        json[rowIndex][2] = day.rev;
        json[rowIndex][3] = day.cash;
        json[rowIndex][4] = day.exp;
        json[rowIndex][5] = day.cash - day.exp;
        json[rowIndex][6] = day.rev - day.cash;
        json[rowIndex][7] = day.c_or;
        json[rowIndex][8] = day.c_wm;
        json[rowIndex][9] = day.c_mg;
        json[rowIndex][10] = day.c_co;
        json[rowIndex][11] = day.c_ap;
        json[rowIndex][12] = day.tot;
        json[rowIndex][13] = day.bb;
        json[rowIndex][14] = day.bs;
        json[rowIndex][15] = day.uo;
        json[rowIndex][16] = day.uw;
    });

    const newWs = XLSX.utils.aoa_to_sheet(json);
    workbook.Sheets['Mar26'] = newWs;
    XLSX.writeFile(workbook, MASTER_EXCEL);
    console.log('✅ Excel updated with corrected March data.');
}

updateExcel();
