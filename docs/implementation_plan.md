# แผนการดำเนินงาน Milestone 0: โครงสร้างพื้นฐานและการเชื่อมต่อ Apps Script (Phase 0 Foundation)

Milestone นี้มีเป้าหมายเพื่อเตรียมโครงสร้างโปรเจกต์ ตั้งค่า Git/GitHub, ติดตั้ง clasp ระดับ project-local, เชื่อมต่อกับ Google Apps Script, ตรวจสอบการเข้าถึง Web App แบบ No-login, สร้างโครงสร้างฐานข้อมูลเริ่มต้นด้วย `setupDatabase()` และสร้างหน้าจอ First-use setup สำหรับเลือกโหมด OPD/IPD พร้อมตั้งค่า Device ID และ Reporter Alias

## User Review Required

> [!IMPORTANT]
> **การเชื่อมต่อกับ Google Apps Script และ Google Sheets:**
> ในการสร้าง Apps Script Project มี 2 ทางเลือก:
> 1. ใช้ `npx clasp create --type webapp --title "CatchME"` เพื่อสร้าง Google Apps Script Project ใหม่ (และอาจสร้าง Google Sheet ใหม่ หรือผูกกับ Google Sheet ที่มีอยู่)
> 2. หากคุณมี Google Sheet หรือ Apps Script Project ที่เตรียมไว้แล้ว สามารถระบุ `Spreadsheet ID` หรือ `Script ID` ให้เชื่อมต่อได้ทันที
> 
> *เริ่มต้นเราจะตั้งค่าโครงสร้างไฟล์ Git, clasp, และโค้ดพื้นฐานก่อน หากคุณมี Google Sheet ID ที่ต้องการใช้ สามารถแจ้งได้ทันที*

---

## Proposed Changes

### โครงสร้างโปรเจกต์และการควบคุมเวอร์ชัน

#### [NEW] [.gitignore](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/.gitignore)
* กำหนด ignore สำหรับ `node_modules/`, `.clasprc.json`, ไฟล์ credential ชั่วคราว, log และ OS files

#### [NEW] [.claspignore](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/.claspignore)
* กำหนดให้ clasp push เฉพาะไฟล์ในโฟลเดอร์ `src/` และ `appsscript.json`
* ละเว้น `tests/`, `scripts/`, `docs/`, `package.json`, ไฟล์ `.xlsx`, `stitch/`

#### [NEW] [package.json](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/package.json)
* กำหนด project metadata, scripts (`test`, `push`, `deploy`), และ devDependencies (`@google/clasp`)

#### [NEW] [appsscript.json](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/appsscript.json)
* ตั้งค่า Apps Script Manifest:
  * Timezone: `Asia/Bangkok`
  * Runtime: `V8`
  * Web App execution: `USER_DEPLOYING`
  * Access: `ANYONE`

---

### ซอร์สโค้ดใน `src/` (Phase 0 Shell)

#### [NEW] [src/Code.gs](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/src/Code.gs)
* `doGet(e)`: โหลด `Index.html` พร้อมตั้งค่า viewport และ meta tags สำหรับ Mobile-first
* `include(filename)`: helper function สำหรับรวมไฟล์ HTML ย่อย (`Styles`, `App`, `Scripts`)
* `getInitialAppState(deviceId)`: ฟังก์ชันดึงสถานะเริ่มต้นหรือการตั้งค่าสำหรับ client

#### [NEW] [src/Database.gs](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/src/Database.gs)
* `setupDatabase(spreadsheetId)`: สร้าง Sheet และ Columns เริ่มต้นอย่าง idempotent (`ME_Log`, `App_Settings`, `Audit_Log`, `Drug_Master`) ตามสเปกใน `Medication_Error_CatB_Data_Schema_GoogleSheets_V1.xlsx` โดยไม่ลบข้อมูลเดิม

#### [NEW] [src/Index.html](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/src/Index.html)
* หน้าต่าง Shell หลัก โหลด CSS จาก `Styles.html`, โครงสร้าง DOM จาก `App.html`, และ JavaScript จาก `Scripts.html`
* รองรับ Mobile Viewport (360–430px) และ Desktop Centered Container

#### [NEW] [src/Styles.html](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/src/Styles.html)
* CSS ดีไซน์ระบบตามสเปก Google Stitch (`stitch/design.md_catchme_design_system.md`) ธีม *Sweet Cotton Candy & Berry*
* กำหนด CSS Variables: โทนสี OPD (`#BDE0FE`), IPD (`#FFE5EC`), Primary Pink (`#FF8FAB`), Surface, Alert, ฯลฯ

#### [NEW] [src/App.html](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/src/App.html)
* Screen 1: First-use Setup (เลือกโหมด OPD / IPD, ใส่รหัสย่อผู้บันทึก)
* Screen 2: Quick Report Home Shell (Header แสดงโหมดและชื่อย่อ, ปุ่มไมค์จำลองสำหรับทดสอบ shell)

#### [NEW] [src/Scripts.html](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/src/Scripts.html)
* จัดการ `localStorage` สำหรับ `catchmeMode`, `catchmeReporterAlias`, `catchmeDeviceId`
* สลับหน้าจอระหว่าง First-time Setup กับ Main Quick Report Home Shell

---

### Scripts อำนวยความสะดวก

#### [NEW] [scripts/setup-machine.ps1](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/scripts/setup-machine.ps1)
* ตรวจสอบความพร้อมของ Git, Node.js, npm, รัน `npm ci`, และรายงานสถานะ credential ของ clasp

#### [NEW] [scripts/deploy.ps1](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/scripts/deploy.ps1)
* ตรวจสอบโปรเจกต์, clasp push, สร้าง version ใหม่ และอัปเดต deployment

#### [NEW] [README.md](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/README.md) & [CHANGELOG.md](file:///d:/CatchME%20-%20Medication%20Error%20Quick%20Reporter/CHANGELOG.md)
* เอกสารเริ่มต้นอธิบายโครงสร้างและการทำงาน

---

## Verification Plan

### การทดสอบอัตโนมัติ / ตรวจสอบคำสั่ง
1. `git init` และตรวจสถานะ `git status`
2. `npm install` เพื่อตรวจสอบว่า dependencies และ clasp พร้อมใช้งาน
3. ทดสอบการรัน PowerShell script: `scripts/setup-machine.ps1`

### การตรวจสอบการทำงานจริง (Verification Steps)
1. ตรวจสอบไฟล์ `.claspignore` เพื่อยืนยันว่า `npx clasp status` แสดงเฉพาะไฟล์ซอร์สโค้ดที่จะ push
2. ตรวจสอบการเปิด Web App หน้า First-use Setup:
   * เลือกโหมด OPD หรือ IPD
   * กรอก Reporter Alias เช่น "P03"
   * บันทึก และยืนยันว่าค่าถูกบันทึกลง `localStorage` (`catchmeMode`, `catchmeReporterAlias`, `catchmeDeviceId`)
   * รีเฟรชหน้าจอแล้วเข้าสู่หน้า Quick Report Home Shell ทันทีโดยไม่ต้องตั้งค่าใหม่
