import subprocess
import os

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Daily Sales and Stock Reports</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        @page {
            size: A4;
            margin: 0;
        }
        
        body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
            color: #cc2222; /* Replicating the red pen of the template */
            background-color: #ffffff;
            -webkit-print-color-adjust: exact;
        }
        
        .page {
            width: 210mm;
            height: 297mm;
            box-sizing: border-box;
            padding: 15mm 15mm;
            position: relative;
            page-break-after: always;
            overflow: hidden;
        }
        
        /* PAGE 1: SALES REPORT */
        .header-container {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            margin-bottom: 2mm;
        }
        
        .date-branch {
            display: flex;
            gap: 5mm;
            font-size: 14pt;
            font-weight: 500;
        }
        
        .underline-field {
            border-bottom: 1.5px solid #cc2222;
            width: 38mm;
            display: inline-block;
            height: 18px;
        }

        .branch-field {
            border-bottom: 1.5px solid #cc2222;
            width: 25mm;
            display: inline-block;
            height: 18px;
        }
        
        .branch-circle {
            border: 2px solid #cc2222;
            border-radius: 50%;
            width: 14mm;
            height: 14mm;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9pt;
            font-weight: 600;
            margin-left: 4mm;
        }
        
        .main-grid {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 10mm;
            height: 160mm;
        }
        
        .sales-list {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
            padding-right: 5mm;
        }
        
        .sales-item {
            font-size: 13pt;
            font-weight: 500;
            display: flex;
            align-items: center;
            margin-bottom: 2px;
        }
        
        .sales-item span.star {
            font-size: 14pt;
            margin-right: 1.5mm;
            display: inline-block;
            width: 5mm;
        }
        
        .sales-item span.no-star {
            display: inline-block;
            width: 5mm;
        }
        
        .sales-item .spacer {
            flex-grow: 1;
        }
        
        .financials {
            display: flex;
            flex-direction: column;
            padding-top: 5mm;
            height: 100%;
            box-sizing: border-box;
        }
        
        .fin-row {
            display: flex;
            align-items: center;
            font-size: 14pt;
            font-weight: 500;
            margin-bottom: 8mm;
        }
        
        .fin-row.bold {
            font-size: 18pt;
            font-weight: 700;
        }
        
        .arrow {
            margin: 0 3mm;
            font-size: 14pt;
        }
        
        .fin-row.bold .arrow {
            font-size: 18pt;
        }
        
        .fin-line {
            border-bottom: 1.5px solid #cc2222;
            width: 50mm;
            height: 20px;
        }
        
        .ice-line {
            border-bottom: 1.5px solid #cc2222;
            width: 35mm;
            height: 20px;
        }
        
        .divider-line {
            border-top: 2px solid #cc2222;
            margin: 2mm 0 10mm 0;
            width: 75mm;
        }
        
        .bot-scan-container {
            display: flex;
            align-items: center;
            gap: 6mm;
            margin-top: 2mm;
        }
        
        .bot-box {
            border: 2px solid #cc2222;
            border-radius: 4px;
            padding: 3mm 4mm;
            width: 32mm;
            font-size: 11pt;
            font-weight: 500;
            line-height: 1.4;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 48mm;
            box-sizing: border-box;
        }
        
        .bot-item {
            display: flex;
            flex-direction: column;
        }

        .bot-title {
            font-size: 10.5pt;
        }

        .bot-val {
            display: flex;
            justify-content: space-between;
            padding-left: 1mm;
            font-size: 10.5pt;
        }
        
        .scan-side {
            display: flex;
            align-items: center;
            font-size: 14pt;
            font-weight: 500;
        }
        
        .bottom-grid {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 10mm;
            margin-top: 4mm;
            height: 95mm;
            box-sizing: border-box;
        }
        
        .bottom-left-sec {
            display: flex;
            flex-direction: column;
            height: 100%;
        }
        
        .cup-sales-table {
            border-collapse: collapse;
            width: 100%;
            font-size: 12pt;
            font-weight: 500;
        }
        
        .table-row {
            display: flex;
        }
        
        .table-header {
            display: flex;
            border-bottom: 1.5px solid #cc2222;
            padding-bottom: 1mm;
            margin-bottom: 2mm;
            font-size: 13pt;
            font-weight: 600;
        }
        
        .col-sales {
            width: 55%;
        }
        
        .col-left-hdr {
            width: 45%;
            padding-left: 4mm;
            border-left: 1.5px solid #cc2222;
        }
        
        .table-body {
            display: flex;
            height: 38mm;
        }
        
        .col-sales-items {
            width: 55%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        .col-left-body {
            width: 45%;
            border-left: 1.5px solid #cc2222;
            padding-left: 4mm;
            display: flex;
            align-items: center;
        }
        
        .total-row {
            font-size: 13pt;
            font-weight: 600;
            border-bottom: 1.5px double #cc2222;
            padding-bottom: 1mm;
            width: 80%;
        }
        
        .sec-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 2mm 0;
            position: relative;
        }
        
        .sec-divider::before {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 50%;
            border-top: 1.5px solid #cc2222;
            z-index: 1;
        }
        
        .sec-divider span {
            background: #ffffff;
            padding: 0 3mm;
            position: relative;
            z-index: 2;
            font-size: 11pt;
            font-weight: 700;
        }
        
        .stock-coco-container {
            display: flex;
            font-size: 11pt;
            font-weight: 500;
            height: 38mm;
        }
        
        .stock-list {
            width: 55%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        .coco-list {
            width: 45%;
            border-left: 1.5px solid #cc2222;
            padding-left: 4mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        .coco-hdr {
            font-weight: 600;
            text-decoration: underline;
            margin-bottom: 1mm;
        }
        
        .duty-container {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: flex-end;
            height: 100%;
            padding-bottom: 5mm;
            box-sizing: border-box;
        }
        
        .duty-text {
            font-size: 13pt;
            font-weight: 500;
            display: flex;
            align-items: flex-end;
        }
        
        .duty-line {
            border-bottom: 1.5px solid #cc2222;
            width: 45mm;
            margin-left: 2mm;
            height: 18px;
        }
        
        /* PAGE 2: STOCK REPORT */
        .p2-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6mm;
        }
        
        .p2-title {
            font-size: 20pt;
            font-weight: 700;
        }
        
        .p2-branch {
            font-size: 16pt;
            font-weight: 600;
        }
        
        .p2-grid {
            display: grid;
            grid-template-rows: 1fr 1fr;
            height: 240mm;
            border-top: 1.5px solid #cc2222;
        }
        
        .p2-section {
            position: relative;
            box-sizing: border-box;
            padding-top: 4mm;
        }
        
        .p2-section-bottom {
            border-top: 1.5px solid #cc2222;
            padding-top: 4mm;
        }
        
        .p2-table-hdr {
            display: flex;
            font-size: 14pt;
            font-weight: 600;
            margin-bottom: 4mm;
        }
        
        .p2-col-left-hdr {
            width: 50%;
            border-bottom: 1.5px solid #cc2222;
            padding-bottom: 1mm;
        }
        
        .p2-col-right-hdr {
            width: 50%;
            border-bottom: 1.5px solid #cc2222;
            padding-bottom: 1mm;
            padding-left: 10mm;
            box-sizing: border-box;
        }
        
        .p2-split {
            display: flex;
            height: 85%;
        }
        
        .p2-items-left {
            width: 50%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 90%;
            font-size: 13pt;
            font-weight: 500;
        }
        
        .p2-items-right {
            width: 50%;
            border-left: 1.5px solid #cc2222;
            height: 90%;
        }
        
        .p2-duty-container {
            position: absolute;
            bottom: 4mm;
            right: 0;
        }
    </style>
</head>
<body>

    <!-- PAGE 1: DAILY SALES REPORT -->
    <div class="page">
        <div class="header-container">
            <div class="date-branch">
                <div>Date <span class="underline-field"></span></div>
                <div>Branch <span class="branch-field"></span></div>
            </div>
            <div class="branch-circle"></div>
        </div>
        
        <div class="main-grid">
            <div class="sales-list">
                <div class="sales-item"><span class="no-star"></span>Cup(60) cash -</div>
                <div class="sales-item"><span class="no-star"></span>Cup(60) Scan -</div>
                <div class="sales-item"><span class="no-star"></span>Cup (50) cash -</div>
                <div class="sales-item"><span class="no-star"></span>Cup (50) Scan -</div>
                <div class="sales-item"><span class="star">★</span>Mango (90) cash -</div>
                <div class="sales-item"><span class="star">★</span>Mango (90) Scan -</div>
                <div class="sales-item"><span class="star">★</span>Coconut (60) cash -</div>
                <div class="sales-item"><span class="star">★</span>Coconut (60) Scan -</div>
                <div class="sales-item"><span class="star">★</span>Apple (60) cash -</div>
                <div class="sales-item"><span class="star">★</span>Apple (60) Scan -</div>
                <div class="sales-item"><span class="star">★</span>Guava (60) cash -</div>
                <div class="sales-item"><span class="star">★</span>Guava (60) Scan -</div>
                <div class="sales-item"><span class="star">★</span>Pineapple (60) cash -</div>
                <div class="sales-item"><span class="star">★</span>Pineapple (60) Scan -</div>
            </div>
            
            <div class="financials">
                <div class="fin-row bold">
                    <div>All</div>
                    <div class="arrow">&rarr;</div>
                    <div class="fin-line"></div>
                </div>
                
                <div class="fin-row">
                    <div>cash</div>
                    <div class="arrow">&rarr;</div>
                    <div class="fin-line"></div>
                </div>
                
                <div class="fin-row">
                    <div>ice ( )</div>
                    <div class="arrow">&rarr;</div>
                    <div class="ice-line"></div>
                </div>
                
                <div class="divider-line"></div>
                
                <div class="bot-scan-container">
                    <div class="bot-box">
                        <div class="bot-item">
                            <div class="bot-title">Bot cash-</div>
                            <div class="bot-val"><span>(40)</span><span>-</span></div>
                        </div>
                        <div class="bot-item">
                            <div class="bot-title">Bot scan-</div>
                            <div class="bot-val"><span>(40)</span><span>-</span></div>
                        </div>
                        <div class="bot-item">
                            <div class="bot-title">Bot cash-</div>
                            <div class="bot-val"><span>(200)</span><span>-</span></div>
                        </div>
                        <div class="bot-item">
                            <div class="bot-title">Bot scan-</div>
                            <div class="bot-val"><span>(200)</span><span>-</span></div>
                        </div>
                    </div>
                    
                    <div class="scan-side">
                        <div>scan</div>
                        <div class="arrow">&rarr;</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="bottom-grid">
            <div class="bottom-left-sec">
                <div class="cup-sales-table">
                    <div class="table-header">
                        <div class="col-sales">Cup sales</div>
                        <div class="col-left-hdr">Cup left</div>
                    </div>
                    <div class="table-body">
                        <div class="col-sales-items">
                            <div>Orange &rarr;</div>
                            <div>Water &rarr;</div>
                            <div>Mango &rarr;</div>
                            <div>coconut &rarr;</div>
                            <div>Apple &rarr;</div>
                            <div>Guava &rarr;</div>
                            <div>Pineapple &rarr;</div>
                        </div>
                        <div class="col-left-body">
                            <div class="total-row">Total -</div>
                        </div>
                    </div>
                </div>
                
                <div class="sec-divider">
                    <span>x</span>
                </div>
                
                <div class="stock-coco-container">
                    <div class="stock-list">
                        <div style="font-weight: 600; margin-bottom: 1mm;">Stock</div>
                        <div>Orange &rarr;</div>
                        <div>Water &rarr;</div>
                        <div>Mango &rarr;</div>
                        <div>Apple &rarr;</div>
                        <div>Guava &rarr;</div>
                        <div>Pineapple &rarr;</div>
                    </div>
                    <div class="coco-list">
                        <div class="coco-hdr">Coco</div>
                        <div>meat &rarr;</div>
                        <div>water &rarr;</div>
                        <div>Falcon &rarr;</div>
                        <div>Good will &rarr;</div>
                    </div>
                </div>
            </div>
            
            <div class="duty-container">
                <div class="duty-text">
                    <div>Those on duty</div>
                    <span class="duty-line"></span>
                </div>
            </div>
        </div>
    </div>

    <!-- PAGE 2: STOCK OUT/LEFT REPORT -->
    <div class="page">
        <div class="p2-header">
            <div class="date-branch" style="font-size: 15pt;">
                <div>Date <span class="underline-field" style="width: 45mm;"></span></div>
            </div>
            <div class="p2-title" style="color: #cc2222;">Out stock for Branch ( &nbsp; &nbsp; )</div>
        </div>
        
        <div class="p2-grid">
            <!-- Top Section: Fruits & Water -->
            <div class="p2-section">
                <div class="p2-table-hdr">
                    <div class="p2-col-left-hdr">Out</div>
                    <div class="p2-col-right-hdr">left</div>
                </div>
                <div class="p2-split">
                    <div class="p2-items-left">
                        <div>Orange &rarr;</div>
                        <div>water &rarr;</div>
                        <div>Mango &rarr;</div>
                        <div>coco &rarr;</div>
                        <div>Apple &rarr;</div>
                        <div>Guava &rarr;</div>
                        <div>Pineapple &rarr;</div>
                    </div>
                    <div class="p2-items-right"></div>
                </div>
            </div>
            
            <!-- Bottom Section: Cups & Consumables -->
            <div class="p2-section p2-section-bottom">
                <div class="p2-table-hdr">
                    <div class="p2-col-left-hdr">Out</div>
                    <div class="p2-col-right-hdr">left</div>
                </div>
                <div class="p2-split">
                    <div class="p2-items-left">
                        <div>Cup &rarr;</div>
                        <div>Lid &rarr;</div>
                        <div>straw &rarr;</div>
                        <div>Tissue &rarr;</div>
                        <div>Glove &rarr;</div>
                        <div>Plastic bag(small) &rarr;</div>
                        <div>Plastic bag(Big) &rarr;</div>
                    </div>
                    <div class="p2-items-right"></div>
                </div>
                
                <div class="p2-duty-container">
                    <div class="duty-text">
                        <div>Those on duty</div>
                        <span class="duty-line"></span>
                    </div>
                </div>
            </div>
        </div>
    </div>

</body>
</html>
"""

with open("template.html", "w") as f:
    f.write(html_content)

print("HTML template written to template.html")

chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
output_pdf = "/Users/metasithjumpatip/Desktop/Blessme/somsaijai/docs/Sales_and_Stock_Report_Templates.pdf"
input_html = os.path.abspath("template.html")

cmd = [
    chrome_path,
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    f"--print-to-pdf={output_pdf}",
    input_html
]

print(f"Running command: {' '.join(cmd)}")
res = subprocess.run(cmd, capture_output=True, text=True)

if res.returncode == 0:
    print(f"Success! PDF generated at: {output_pdf}")
    # Remove temp HTML file
    if os.path.exists("template.html"):
        os.remove("template.html")
else:
    print("Error generating PDF:")
    print(res.stdout)
    print(res.stderr)

