# CatchME — Medication Error Cat B Quick Reporter

> **"Catch ME before it reaches the patient."**  
> พบ Error → เปิด CatchME → กดไมค์ → พูด → ตรวจ → บันทึก (10–20 วินาที)

CatchME เป็นเว็บแอปพลิเคชันภายในสำหรับฝ่ายเภสัชกรรมโรงพยาบาล ออกแบบมาสำหรับการรายงานความคลาดเคลื่อนทางยาในระดับ **Category B / Near Miss** (เหตุการณ์ที่เกิดขึ้นแต่ได้รับการตรวจพบและดักจับได้ก่อนที่จะถึงตัวผู้ป่วย) โดยเน้นความสะดวกรวดเร็ว ลดความซ้ำซ้อนของการจดบันทึกลงกระดาษ และไม่ต้องผ่านขั้นตอนล็อกอินก่อนรายงาน (No-Login Quick Reporter)

---

## สถาปัตยกรรมระบบ (Architecture)

```text
Browser (Web Speech API / Keyboard Fallback)
    ↓
Google Apps Script (HTML Service / Rule-Based Parser)
    ↓
Google Sheets (ME_Log, Audit_Log, App_Settings, Drug_Master)
```

* **Frontend:** Vanilla JavaScript + Responsive HTML5 / CSS (Sweet Cotton Candy & Berry design system จาก Google Stitch)
* **Backend:** Google Apps Script Web App (รันด้วย `USER_DEPLOYING` และการเข้าถึงแบบ `ANYONE`)
* **Database:** Google Sheets
* **DevOps:** Git + GitHub + project-local clasp

---

## โครงสร้างโปรเจกต์ (Project Structure)

```text
CatchME/
├── src/
│   ├── Code.gs             # จุดเริ่มต้น Web App (doGet, include, getInitialAppState)
│   ├── Database.gs         # จัดการฐานข้อมูลและชีต (setupDatabase)
│   ├── Parser.gs           # Rule-based parser (Milestone 1)
│   ├── Reports.gs          # บันทึกและดึงข้อมูลรายงาน (Milestone 4)
│   ├── Index.html          # HTML Shell และ Viewport
│   ├── Styles.html         # CSS Design Tokens และ Components
│   ├── App.html            # โครงสร้างหน้าจอ UI (First-use, Quick Report, Gate, Confirm)
│   └── Scripts.html        # Client-side state, Web Speech API และการเชื่อมต่อ
├── tests/
│   └── parser-tests.js     # Regression test suite สำหรับ Rule parser
├── scripts/
│   ├── setup-machine.ps1   # สคริปต์ตั้งค่าสภาพแวดล้อมเครื่องใหม่สำหรับ Windows
│   └── deploy.ps1          # สคริปต์ตรวจสอบ ทดสอบ และ Deploy ขึ้น Apps Script
├── package.json            # Node.js configuration และ clasp devDependency
├── appsscript.json         # Apps Script Manifest (Timezone, Webapp permissions)
├── .claspignore            # รายการยกเว้นไฟล์สำหรับการ push
├── .gitignore              # รายการยกเว้นไฟล์สำหรับ Git
├── README.md               # คู่มือการใช้งานและพัฒนา
└── CHANGELOG.md            # บันทึกประวัติการเปลี่ยนแปลง
```

---

## การเริ่มต้นใช้งานบนเครื่องใหม่ (New Machine Setup)

```powershell
# 1. Clone repository
git clone <repo-url>
cd CatchME

# 2. ตั้งค่าสภาพแวดล้อมอัตโนมัติ
powershell -ExecutionPolicy Bypass -File scripts/setup-machine.ps1
```

---

## การตั้งค่าฐานข้อมูล (setupDatabase)

เมื่อเชื่อมต่อกับ Apps Script เรียบร้อย สามารถสั่งรันฟังก์ชัน `setupDatabase()` จาก Apps Script Editor เพื่อสร้างชีตและคอลัมน์เริ่มต้น ได้แก่:
1. `ME_Log` — บันทึกเหตุการณ์ Category B
2. `App_Settings` — ค่าคอนฟิกเริ่มต้นของระบบ
3. `Audit_Log` — บันทึกประวัติการสร้าง/แก้ไข/ยกเลิก
4. `Drug_Master` — ฐานข้อมูลบัญชียาเบื้องต้น

*ฟังก์ชันนี้เป็น idempotent สามารถรันซ้ำได้โดยไม่ลบหรือเปลี่ยนแปลงข้อมูลเดิม*

---

## การ Deploy ขึ้น Production (Deployment Pipeline)

การ Deploy ทำผ่าน script อัตโนมัติ:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

ขั้นตอนการทำงาน:
1. ตรวจสอบ dependencies และสิทธิ์การ deploy
2. รันชุดทดสอบ regression test suite
3. `clasp push` ขึ้น Apps Script
4. สร้าง Immutable Version ใหม่
5. อัปเดต Production Deployment URL เดิมให้ชี้ไปยังเวอร์ชันใหม่

---

## ความเป็นส่วนตัวและความปลอดภัย (Privacy & Security)

* **No-Login Privacy:** ผู้ใช้งานทั่วไปไม่สามารถเรียกดูฐานข้อมูลรายงานทั้งหมดของโรงพยาบาลได้ รายการประวัติล่าสุด (Recent Reports) จะถูกจำกัดให้อ่านเฉพาะเหตุการณ์ที่ถูกสร้างจากเครื่องเดียวกัน (`device_session_id`) เท่านั้น
* **No Patient PII:** การบันทึก Quick Report ไม่บังคับให้กรอกชื่อ-นามสกุลผู้ป่วย, เลขบัตรประชาชน หรือเบอร์โทรศัพท์ (HN/AN เป็นฟิลด์ทางเลือก)
