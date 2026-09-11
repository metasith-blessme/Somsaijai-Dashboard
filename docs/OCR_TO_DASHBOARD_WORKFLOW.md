# SomSaiJai — Workflow จากเอกสารจนขึ้น Dashboard

สถานะ: ขั้นตอนปฏิบัติงานมาตรฐานสำหรับ B1/B2/B3 ครอบคลุมรายงานยอดขาย สต๊อก สลิปโอนเงิน ใบเสร็จ และใบแจ้งหนี้

อ่าน [OCR_RULES.md](OCR_RULES.md) ก่อนเริ่มทุกครั้ง กฎนั้นเป็นหลักเมื่อข้อความขัดกัน ขั้นตอนนี้อธิบายลำดับงานและจุดอนุมัติ ไม่ได้ปลดล็อกคำสั่งนำเข้าเดิมที่ยังไม่ปลอดภัย

## ภาพรวม

```text
เอกสารต้นฉบับ
  → ลงทะเบียนชุดงานและเก็บ hash
  → OCR จากภาพจริง
  → อ่านซ้ำช่องสำคัญ
  → ตรวจสมการ/รายการซ้ำ/การจัดหมวด
  → Review artifact (นำเข้าไม่ได้)
  → เจ้าของตรวจและอนุมัติรายการเปลี่ยนแปลง
  → Dry run + สำรอง Excel
  → นำเข้า Excel ด้วย safe importer
  → อ่านกลับและเทียบค่าที่อนุมัติ
  → สร้าง data.json + reports_data.json + backup HTML
  → ทดสอบและตรวจตัวเลข
  → เจ้าของอนุมัติ deploy
  → Deploy Vercel
  → อ่านกลับจากเว็บไซต์จริงและออก deployment receipt
```

> [!IMPORTANT]
> ณ ตอนนี้ `process-sales`, `verify-sales`, `process-expenses`, `sync` และ `pipeline` ยังไม่ผ่านเกณฑ์ safe importer ตาม [OCR_PIPELINE_REVIEW.md](../3_Automation_Dashboard/audit/OCR_PIPELINE_REVIEW.md) จึงหยุดที่ขั้น Review/Approval ก่อนเขียน Excel จนกว่าช่องว่างนี้จะถูกแก้และทดสอบ การอนุมัติของเจ้าของไม่ทำให้คำสั่งที่ไม่ปลอดภัยกลายเป็นปลอดภัย

## บทบาทและสถานะข้อมูล

| บทบาท/สถานะ | หน้าที่ |
|---|---|
| AI extractor | อ่านและเสนอข้อมูล; ตั้ง `review.import_allowed: false` เสมอ |
| Human reviewer | เทียบช่องสำคัญกับภาพจริงและตอบข้อสงสัย |
| Owner | อนุมัติชุดค่า old/new และการเขียน Excel จากนั้นอนุมัติการ deploy แยกอีกครั้ง |
| Safe importer | รับเฉพาะ approval ที่ผูกกับ source hash และค่าที่อนุมัติ |
| Excel | แหล่งข้อมูลบัญชีหลักของแต่ละสาขา |
| `data.json`, `reports_data.json`, backup HTML | ผลลัพธ์ที่สร้างใหม่จาก Excel ไม่ใช่หลักฐานต้นทาง |

Lifecycle ของหนึ่งรายการ:

```text
extracted → needs_review / ready_for_review → approved → imported → published
```

`approved` ต้องมีหลักฐานการตรวจโดยคน ส่วน `published` ต้องมีการตรวจเว็บไซต์หลัง deploy

---

## ขั้นที่ 0 — เปิด Batch

ผู้ปฏิบัติงานระบุ:

- `batch_id`
- B1/B2/B3 และเดือน/วันที่ในขอบเขต
- ประเภทเอกสารที่จะอ่าน
- รายการไฟล์ที่เพิ่งเพิ่มและวันที่คาดว่าควรมีรายงาน
- ผลลัพธ์ที่ต้องการ: review อย่างเดียว, เตรียมเสนอแก้ Excel หรือ deploy

งาน inventory/OCR แบบ read-only เริ่มได้เมื่อบันทึกขอบเขตแล้ว โดยยังไม่มีสิทธิ์เขียนข้อมูลการเงินหรือ deploy

**เสร็จเมื่อ:** มีขอบเขตชัดเจนและไม่มีไฟล์นอกขอบเขตปะปน

## ขั้นที่ 1 — ลงทะเบียนหลักฐานต้นฉบับ

1. เก็บภาพ/PDF ต้นฉบับโดยไม่แก้ไฟล์
2. ทำ source manifest ต่อไฟล์: path, SHA-256, ชนิดไฟล์, ชนิดเอกสาร, หน้าที่, สาขา/วันที่ที่เสนอ และสถานะ
3. จับคู่หน้าของรายงานด้วยหลักฐานสาขา วันที่ กะ และชนิดหน้า ไม่สมมติว่าหนึ่งวันมีครบสามหน้า
4. บันทึกไฟล์เสีย อ่านไม่ได้ หน้าขาด ภาพซ้ำ และวันที่ไม่มีรายงานแยกกัน
5. นับจำนวนไฟล์ใน manifest ให้เท่ากับจำนวน disposition

**เสร็จเมื่อ:** ทุกไฟล์มี hash และ disposition หนึ่งค่า โดยจำนวนต้นทางกับ manifest ตรงกัน

## ขั้นที่ 2 — OCR รายงานยอดขายและสต๊อก

ทำตาม [OCR_RULES.md §10.1](OCR_RULES.md#101-sale-report--required-fields-per-page) และ [คู่มือ Sales Extractor](SOMSAIJAI_SALES_EXTRACTOR.md):

1. เปิดภาพเต็ม ตรวจทิศทาง ความเบลอ แสงสะท้อน ขอบที่ถูกตัด และหน้าต่อเนื่อง
2. อ่านหัวกระดาษทุกช่อง
3. อ่านเมนูทุกแถวและทุกช่องทางชำระ รวมรายการเขียนเพิ่ม ราคาแก้ไข ขวด/จาน/ชุด
4. อ่านค่าใช้จ่ายในกะและสรุปท้ายกระดาษตามตำแหน่งจริง
5. อ่านสต๊อกทุกคอลัมน์ตามหัวคอลัมน์จริง ไม่ย้ายตัวเลขเพื่อให้สมการลงตัว
6. ค่า missing/illegible/ambiguous เป็น `null` พร้อมสถานะ; ช่องว่างไม่ใช่ศูนย์
7. เปิด crop เฉพาะจุดที่ไม่ชัดและเก็บตำแหน่งอ้างอิง
8. ให้การอ่านรอบสองตรวจช่องสำคัญจากภาพจริงโดยไม่ดูคำตอบรอบแรกก่อน

**เสร็จเมื่อ:** ทุกแถวที่ใช้ได้ถูกเก็บพร้อม raw text, state และ source location; ข้อขัดแย้งยังคงอยู่ใน `issues[]`

## ขั้นที่ 3 — OCR สลิปโอนเงินและค่าใช้จ่าย

ทำตาม [OCR_RULES.md §10.2](OCR_RULES.md#102-transfer-slip-------required-fields-per-slip) ทีละสลิป:

1. เก็บธนาคาร/ช่องทาง สถานะ วันเวลา เลขรายการ ยอด และสกุลเงินตามหลักฐาน
2. อ่านซ้ำชื่อผู้โอน ผู้รับ ธนาคาร และเลขบัญชีเฉพาะส่วนที่มองเห็น; ไม่สร้างเลขที่ถูกปิดบัง
3. แยกผู้รับเงินจริง ผู้ขาย/ผู้ได้รับประโยชน์ วัตถุประสงค์ ผู้จ่าย สาขาที่จ่าย และสาขาที่รับประโยชน์
4. อ่าน `บันทึกช่วยจำ` ทุกบรรทัด รวมข้อความเขียนกำกับนอกช่อง memo
5. แยกรายการ จำนวน หน่วย ราคาต่อหน่วย ยอดย่อย ภาษี ค่าส่ง ส่วนลด และช่วงบริการตามหลักฐาน
6. เสนอ COGS/OPEX/EXCLUDED/CAPEX/Deposit/Internal Transfer โดยเก็บข้อความต้นฉบับและเหตุผลการจัดหมวด
7. สลิปหลายรายการแบ่งยอดเฉพาะเมื่อมียอดย่อยรองรับ; ถ้าไม่มีให้คงยอดแม่และตั้ง allocation เป็น unresolved
8. เชื่อม invoice/receipt/slip ของภาระเดียวกันเพื่อไม่ลงค่าใช้จ่ายซ้ำ

**เสร็จเมื่อ:** ทุกสลิปมี masked recipient, amount/currency, note ครบ, purpose/category proposal และข้อสงสัยที่เหลือ

## ขั้นที่ 4 — Validation โดยไม่แก้ค่าที่อ่าน

ใช้โค้ดคำนวณและเก็บ observed, expected, difference แยกกัน:

- ช่องทางชำระกับยอดขาย
- จำนวน × ราคากับยอดรายแถว
- ยอดเมนูทั้งหมดกับสรุปยอดขาย
- เงินสดยกมา + เงินสดขาย − ค่าใช้จ่ายเงินสด ± การเคลื่อนไหวอื่น กับยอดนับจริง
- ยกมา + รับ/โอนเข้า − ใช้/เสีย/โอนออก ± ปรับปรุง กับสต๊อกปิด
- ยอดย่อย + ภาษี/ค่าส่ง − ส่วนลด กับ invoice total
- Payment allocation กับยอดโอน รวมกรณีจ่ายบางส่วน/ล่วงหน้า/คืนเงิน

สถานะมีเพียง `pass`, `fail`, `not_testable` ข้อมูลขาดคือ `not_testable`; ผลต่างไม่เป็นศูนย์คงเป็น `fail` ห้ามแก้ค่าที่อ่านเพื่อผ่าน

ค้น duplicate ด้วย hash, reference, คู่สัญญา และเอกสารสัมพันธ์ ข้ามสาขา/เดือน/Excel/manual entry/review artifacts/staging วันและยอดตรงกันอย่างเดียวเป็นเพียง candidate

**เสร็จเมื่อ:** ทุก check มี input, formula, result และเหตุผล; ทุก candidate มีผลตัดสินหรือคำถาม

## ขั้นที่ 5 — ส่ง Review Package ให้เจ้าของ

หนึ่ง batch ต้องมี:

- source manifest และ coverage count
- JSON review ที่ parse ได้ โดย `review.import_allowed: false`
- ตารางยอดขายและตารางค่าใช้จ่ายตาม `OCR_RULES.md`
- ตารางสลิปโอนออก: วันที่ | ผู้รับแบบปกปิด | ยอด/สกุลเงิน | note/วัตถุประสงค์ | หมวดเสนอ | สาขาที่รับประโยชน์ | duplicate | สถานะ
- `uncertainties[]`, `checks[]`, `issues[]`
- proposed change list: workbook/sheet/record identity, old value, new value, source hash และเหตุผล

เจ้าของตอบได้เป็นรายรายการ: approve, correct, reject, needs clearer evidence หรือ defer ไม่มีการถือว่าเงียบเท่ากับอนุมัติ

**เสร็จเมื่อ:** ทุกค่าที่จะเขียนถูกอนุมัติอย่างชัดเจนและผูกกับ source hash; เรื่องค้างไม่ปะปนในชุด import

## ขั้นที่ 6 — Preflight ก่อนเขียน Excel

ขั้นนี้เปิดใช้เมื่อมี safe importer ที่ผ่าน acceptance tests แล้วเท่านั้น:

1. ตรวจว่า approval ยังตรงกับ hash และ payload ปัจจุบัน
2. ตรวจ branch, workbook, sheet, header, date, field mapping และหน่วยครบทั้ง batch ก่อนเขียนแถวแรก
3. ตรวจว่าไฟล์ Excel ไม่ถูกเปิด/ล็อก ห้ามลบ lock file เพื่อฝืนเขียน
4. สำรอง workbook ที่ได้รับผลกระทบและบันทึก hash ก่อนแก้
5. ทำ dry run แสดง row/cell diff และพิสูจน์ว่าจะไม่ทิ้ง custom fields, formula, formatting หรือรายการที่ไม่เกี่ยวข้อง
6. ทดลองรัน batch ซ้ำใน fixture แล้วต้องไม่มีแถวเพิ่มหรือการแก้ซ้ำ

**เสร็จเมื่อ:** preflight และ dry run ผ่านทั้งหมด เจ้าของอนุมัติ diff ที่จะเขียน

## ขั้นที่ 7 — Import และ Readback

1. เขียนเฉพาะรายการที่อนุมัติลง Excel ของสาขาที่ถูกต้อง
2. ถ้ารายการใดล้มเหลว ให้คงรายการนั้นใน pending state และรายงาน partial failure
3. เปิด Excel อ่านค่ากลับจาก cell/row เป้าหมาย
4. เทียบค่าที่อ่านกลับกับ approved payload ทุกช่อง
5. รัน import ซ้ำแล้วต้องเกิด zero changes
6. สร้าง import receipt: batch, source/approval refs, backup path/hash, rows written/skipped/failed, before/after และ readback result

**เสร็จเมื่อ:** จำนวน approved = imported + explicitly failed/skipped, readback ตรง และ rerun ไม่เปลี่ยนข้อมูล

## ขั้นที่ 8 — สร้าง Dashboard แบบยังไม่ Deploy

จาก `3_Automation_Dashboard/` ใช้:

```bash
npm run update-dashboard -- --no-deploy
```

คำสั่งนี้อ่าน Branch Excel แล้วสร้างใหม่:

1. `data.json`
2. `reports_data.json` ผ่าน `gen_report.js`
3. `SomSaiJai_Dashboard.html` ผ่าน `sync_dashboard_html.js`

อย่าแก้สามไฟล์ generated นี้โดยตรง

จากนั้นรัน:

```bash
npm test
```

ตรวจ diff/ผลลัพธ์อย่างน้อย:

- จำนวนวันและยอดรายเดือนของแต่ละสาขา
- รายได้ เงินสด สแกน และค่าใช้จ่ายเทียบ approved import receipt
- COGS allocation, shared costs, loss carry-forward และ profit-share ตาม effective date
- `index.html` กับ backup HTML ใช้ logic/field ที่สอดคล้องกัน
- ไม่มีข้อมูลธนาคารหรือหลักฐานส่วนตัวถูกส่งเข้า public JSON/HTML

**เสร็จเมื่อ:** command ทั้งสองผ่านและ generated totals ตรงกับ approved/readback totals โดยไม่มี unexplained diff

## ขั้นที่ 9 — อนุมัติและ Deploy

เสนอ deployment package ให้เจ้าของ:

- batch/import receipt
- tests ที่รันและผลจริง
- generated-file diff และยอดสำคัญก่อน/หลัง
- unresolved issues ที่ไม่กระทบการ deploy หรือเหตุผลที่ block

หลังได้รับอนุมัติ deploy แยกต่างหาก:

```bash
npm run deploy
```

คำสั่งนี้ deploy จาก `3_Automation_Dashboard/` ไป Vercel production ตาม `vercel.json`

**เสร็จเมื่อ:** คำสั่งคืน production deployment URL/ID สำเร็จ; ความสำเร็จของ CLI ยังไม่ใช่จุดจบ

## ขั้นที่ 10 — ตรวจ Dashboard จริงหลัง Deploy

อ่านกลับจาก `https://somsaijailive.vercel.app`:

1. หน้า `/` โหลด `index.html` ได้
2. `data.json` และ `reports_data.json` เป็นรุ่นใหม่ ไม่ติด cache เก่า
3. ตรวจ B1/B2/B3 และเดือนที่เปลี่ยน
4. เปรียบเทียบยอดสำคัญกับ deployment package
5. ตรวจ mobile/desktop, branch switcher, P&L และรายการ unknown/estimated ว่าไม่แสดงเป็นค่าจริง
6. ตรวจว่าไม่มีข้อมูลส่วนตัว/เลขบัญชี/memo ดิบหลุดสู่หน้าเว็บ

หากผิด ให้หยุดการประกาศสำเร็จ เก็บหลักฐาน และ rollback/redeploy จาก artifact ที่ตรวจแล้วตามขอบเขตที่เจ้าของอนุมัติ

**เสร็จเมื่อ:** live readback ผ่าน และมี deployment receipt ระบุ URL/ID, เวลา, commit/worktree state, data hashes, checks และผู้อนุมัติ

---

## Stop Conditions — ต้องหยุดก่อนขั้นถัดไป

- สาขา/วันที่/ผู้รับ/ยอดเงิน/สกุลเงินอ่านไม่ชัด
- memo ไม่ครบหรือภาพตัดขอบ
- payment allocation ไม่ทราบ หรือยอดสำคัญ `fail`
- duplicate candidate ยังไม่ตัดสิน
- branch/date/price era/หน่วยไม่ตรงกัน
- ไม่มี approval ที่ผูกกับ source hash และ old/new values
- safe importer, backup, dry run, readback หรือ idempotency ยังไม่พร้อม
- tests หรือ generated totals ไม่ผ่าน
- ยังไม่ได้รับอนุมัติ deploy

ประเด็นที่หยุดงานอาจได้รับ owner-approved exception แบบระบุขอบเขตได้ แต่ exception ไม่เปลี่ยน `estimated` เป็น `observed`, ไม่เปลี่ยน `fail` เป็น `pass` และไม่อนุญาตใช้ importer ที่พิสูจน์แล้วว่าไม่ปลอดภัย

## Checklist ก่อนประกาศว่า “ขึ้น Dashboard แล้ว”

- [ ] Source manifest ครบและ count ตรง
- [ ] OCR อ่านซ้ำช่องสำคัญและเก็บ memo ครบ
- [ ] Validation/duplicate/allocation ครบ
- [ ] เจ้าของอนุมัติ exact changes
- [ ] Safe import พร้อม backup, dry run, readback และ rerun = zero changes
- [ ] `npm run update-dashboard -- --no-deploy` ผ่าน
- [ ] `npm test` ผ่าน
- [ ] เจ้าของอนุมัติ deploy
- [ ] `npm run deploy` สำเร็จ
- [ ] ตรวจ live B1/B2/B3 และข้อมูลเดือนที่เปลี่ยนแล้ว
- [ ] ไม่มีข้อมูลธนาคาร/ส่วนตัวเผยแพร่
- [ ] บันทึก import receipt และ deployment receipt แล้ว
