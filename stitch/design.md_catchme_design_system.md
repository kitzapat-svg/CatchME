# CatchME — Design System Specification (DESIGN.md)

ระบบออกแบบและมาตรฐาน UI/UX สำหรับแอปพลิเคชัน **CatchME (Medication Error Cat B Quick Reporter)** สำหรับบุคลากรทางการแพทย์ในโรงพยาบาล (OPD / IPD Pharmacy & Wards)

---

## 1. Brand Identity & Design Principles

### Brand Philosophy: Psychological Safety Meets Clinical Rigor
การรายงานความคลาดเคลื่อนทางยา (Medication Error) ระดับ Category B (เหตุการณ์ที่เกิดขึ้นแต่ยังไม่ถึงตัวผู้ป่วย / Near-miss) มักสร้างความกังวลใจและภาระงานให้แก่บุคลากรทางการแพทย์ CatchME จึงถูกออกแบบภายใต้แนวคิด:
- **Zero Blame, High Psychological Safety:** ใช้โทนสีอบอุ่น ละมุนตา ไม่ใช้สีแดงแจ้งเตือนที่ตึงเครียดเกินเหตุ เพื่อลดความกลัวในการรายงาน
- **10–20 Second Fast Path:** เน้น Voice-first reporting และ One-tap clarification ลด cognitive load ในช่วงเวลาเร่งด่วน
- **Thumb-Zone Ergonomics:** วางปุ่ม Action สำคัญไว้บริเวณกลาง-ล่างของหน้าจอโทรศัพท์มือถือ เพื่อการใช้งานมือเดียวในห้องยาหรือข้างเตียงผู้ป่วย

---

## 2. Color Palette & Tokens

การออกแบบใช้ชุดสี **Sweet Cotton Candy & Berry** ผสมผสานโทนสีพาสเทลเพื่อบรรยากาศที่เป็นมิตร พร้อมคอนทราสต์ตัวหนังสือระดับ WCAG AA

### 2.1 Core Palette
| Token Name | Hex Code | Purpose / Usage |
| :--- | :--- | :--- |
| `primary` | `#FF8FAB` | สีหลักของแบรนด์, ปุ่มบันทึกเสียงหลัก (Mic button), Accent elements |
| `primary-hover` / `primary-dark` | `#9B3356` / `#8B2B49` | ปุ่มกดยืนยันบันทึก (Save CTA button), Header text เน้นความคมชัด |
| `primary-container` | `#FFE5EC` | พื้นหลังการ์ดรายละเอียด, Highlight container, Tag badge |
| `surface` | `#FFFFFF` | พื้นผิวการ์ดข้อมูล (Cards), Popups, Bottom Navigation bar |
| `background` | `#FFF8F9` | สีพื้นหลังหลัก (Pink Cream Wash) ช่วยตัดแสงจ้าของหน้าจอมือถือ |
| `surface-subtle` | `#FFF0F3` | Container รอง, Input/Hover state, Soft pill badges |

### 2.2 Functional & Mode Tokens
| Token Name | Hex Code | Purpose / Usage |
| :--- | :--- | :--- |
| `mode-opd` | `#BDE0FE` (Border: `#A2D2FF`) | โหมดห้องจ่ายยาผู้ป่วยนอก (OPD) — โทนฟ้าสดใส สะอาด |
| `mode-ipd` | `#FFE5EC` (Text: `#C94B6E`) | โหมดห้องจ่ายยา/หอผู้ป่วยใน (IPD) — โทนชมพูเบอร์รี่ |
| `text-primary` | `#1E293B` | ข้อความพาดหัว, ข้อมูลสำคัญทางการแพทย์ (Deep Navy/Slate) |
| `text-secondary` | `#64748B` | คำอธิบายกำกับ, Subtitle, หน่วยเวลานาที |
| `status-cat-b` | `#FFE5EC` (Border: `#FF8FAB`) | Badge แสดงสถานะ "Category B — ยังไม่ถึงตัวผู้ป่วย" |
| `status-alert` | `#FFB4A2` (Deep: `#B91C1C`) | สัญลักษณ์เตือนเมื่อเหตุการณ์อาจเกินระดับ Category B (Hard Stop Gate) |
| `status-success` | `#D8F3DC` (Deep: `#2D6A4F`) | เครื่องหมายสำเร็จและสถานะ Draft Saved |

---

## 3. Typography Scale

- **Primary Font Family:** `Plus Jakarta Sans`, `Prompt`, `sans-serif`
- **Fallback:** System UI, sans-serif
- **Line Height:** ผ่อนคลาย (1.4 – 1.6) เพื่อให้อ่านชื่อยา สเต็ป และปริมาณยาได้ชัดเจนในสภาวะแสงโรงพยาบาล

| Scale | Font Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Brand / Title Large** | `24px (1.5rem)` | 800 (ExtraBold) | 1.25 | หัวข้อหน้าหลัก, ชื่อแอป CatchME |
| **Headline Medium** | `20px (1.25rem)` | 700 (Bold) | 1.3 | คำถามชี้แจง (Clarification), หัวข้อ Card สรุปผล |
| **Body Prominent** | `16px (1.0rem)` | 600 (SemiBold) | 1.5 | ชื่อยา (Amlodipine 5mg), ตัวเลือกขั้นตอน |
| **Body Regular** | `14px (0.875rem)` | 400 (Regular) | 1.5 | คำอธิบายประกอบ, รายละเอียดข้อความ |
| **Caption / Badge** | `12px (0.75rem)` | 600 (SemiBold) | 1.4 | รหัสความเสี่ยง (B29), ป้ายบอกโหมด, เวลา |

---

## 4. Spacing, Shapes & Elevation

### 4.1 Elevation & Shadows
- **Card Shadow:** `0 8px 24px -4px rgba(255, 143, 171, 0.12)`
- **Floating Button / Mic Glow:** `0 10px 25px -3px rgba(255, 143, 171, 0.35)`
- **Header Docked Border:** `1px solid rgba(255, 224, 230, 0.8)`

### 4.2 Border Radii
- **Cards & Modal Containers:** `24px` (มุมโค้งมนขนาดใหญ่ เสริมความรู้สึกนุ่มนวล เข้าถึงง่าย)
- **Buttons / Action Pills:** `9999px` (Full-pill shape สำหรับปุ่มกดหลักและแท็ก)
- **Icon Badges & Micro-elements:** `16px` – `50%` (วงกลมสมบูรณ์)

---

## 5. Screen Breakdown & Flow Guidelines

### 1. First-time Mode Selection (`SCREEN_13`)
- **โครงสร้าง:** การ์ด 2 บานขนาดใหญ่ (OPD และ IPD) ไอคอนและสีสื่อความหมายเฉพาะตัว
- **เป้าหมาย:** ให้เจ้าหน้าที่เลือกบริบทการทำงานได้ในคลิกเดียว พร้อมคำอธิบายว่าเปลี่ยนกลับได้ตลอดเวลา

### 2. Quick Report Home (`SCREEN_11`)
- **โครงสร้าง:** 
  - Top Bar แสดงแบรนด์ CatchME พร้อม Badge แสดง Mode ปัจจุบัน (เช่น IPD Mode)
  - Microphone Record Button ขนาดใหญ่ โดดเด่นกลางหน้าจอ พร้อม Pulse Glow
  - Recent Reports ลิสต์ด้านล่างแสดงประวัติการดักจับความคลาดเคลื่อนล่าสุด
  - Floating/Docked Navigation Bar (Home, Mic, History)

### 3. Recording State (`SCREEN_12`)
- **โครงสร้าง:**
  - ตัวจับเวลาบันทึกเสียง (Timer: `00:08`) พร้อมจุดไฟสถานะกระพริบ
  - Voice Amplitude Waveform แสดงผล Real-time
  - Live Transcript Preview box แสดงข้อความที่กำลังถอดเสียง
  - ปุ่มหยุดบันทึก (Stop Recording) และปุ่มยกเลิก (Cancel)

### 4. Processing State (`SCREEN_10`)
- **โครงสร้าง:**
  - Animated Radial Pulse Circle
  - ข้อความอธิบายความคืบหน้า "กำลังจัดหมวดข้อมูล... วิเคราะห์ประเภทและระดับความรุนแรง"
  - Progress Bar สีชมพูพาสเทลเพื่อลดความรู้สึกรอคอย

### 5. Clarification Question (`SCREEN_9`)
- **โครงสร้าง:**
  - คำถามชัดเจน ไม่ซับซ้อน เช่น "จำนวนผิดเกิดที่ขั้นตอนไหน?"
  - การ์ดตัวเลือกขั้นตอนขนาดใหญ่ 3 ตัวเลือก (แพทย์สั่ง / ห้องยาคีย์ / คนจัดยา)
  - ปุ่ม "I'm not sure" สำหรับกรณีที่ไม่มั่นใจ ช่วยลดความกดดันและไม่บล็อกการทำงาน

### 6. Confirmation Card (`SCREEN_8`)
- **โครงสร้าง:**
  - Card สรุปข้อมูลที่ระบบสกัดมาได้: Medication Error, Drug Name, Phase, Found By
  - การเปรียบเทียบข้อผิดพลาดแบบชัดเจน เช่น `จัดจริง: 30 เม็ด` vs `ควรเป็น: 60 เม็ด`
  - Collapsible drawer: "View Raw Transcript" สำหรับตรวจสอบข้อความเสียงต้นฉบับ
  - ปุ่ม Action: "บันทึก (Save)" เด่นชัด และ "แก้ไข (Edit)"

### 7. Cat B Safety Gate / Hard Stop (`SCREEN_7`)
- **โครงสร้าง:**
  - Icon เตือนทรงสามเหลี่ยมสีแดงนุ่มนวล
  - ข้อความแจ้งเตือน "เหตุการณ์นี้อาจไม่ใช่ Category B: ระบบนี้ใช้สำหรับเหตุการณ์ที่ยังไม่ถึงตัวผู้ป่วยเท่านั้น"
  - ปุ่มนำทางส่งต่อไปยัง "ระบบความเสี่ยงหลักของโรงพยาบาล" พร้อมปุ่มตรวจสอบข้อมูลอีกครั้ง

### 8. Save Success (`SCREEN_5`)
- **โครงสร้าง:**
  - Checkmark สีละมุนพร้อมข้อความยืนยัน "บันทึกสำเร็จ"
  - สรุปย่อของเหตุการณ์ที่บันทึก
  - ปุ่มลัด "บันทึกเหตุการณ์ถัดไป" เพื่อรองรับกรณีที่ห้องยามีเคสเกิดขึ้นต่อเนื่อง

---

## 6. Accessibility & Medical Safety Compliance

1. **High Contrast for Drug Names:** ตัวหนังสือชื่อยาและตัวเลขปริมาณยาต้องใช้ Contrast สูงเสมอ (`#1E293B` หรือ `#8B2B49`) เพื่อป้องกันการอ่านสับสน
2. **Error-Proof Confirmation:** แสดงการเปรียบเทียบค่าจัดจริงกับค่าที่ควรเป็นด้วยคู่สัญลักษณ์กากบาท/ถูก และสีระบุชัดเจน
3. **No Hidden Costs:** ทุกขั้นตอนมีปุ่มย้อนกลับหรือปุ่ม "ไม่แน่ใจ" เพื่อไม่ให้ข้อมูลเท็จถูกบังคับส่งเข้าสู่ระบบรายงานความเสี่ยงโรงพยาบาล
