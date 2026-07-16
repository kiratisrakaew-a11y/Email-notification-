# QA Report — ระบบแจ้งเตือนอีเมล (Email Notification)

**คำถาม QA:** "สามารถ Run ได้จริงหรือไม่" (Can the project actually run?)
**ผลสรุป: ✅ PASS — โค้ดรันได้จริง** ผ่านการตรวจ 67/67 รายการ

| | |
|---|---|
| วันที่ทดสอบ | 2026-07-16 |
| Branch | `claude/qa-test-run-verify-8hdw85` |
| ชนิดโปรเจกต์ | Google Apps Script (Web App + time-based triggers) |
| ไฟล์ที่ตรวจ | `*.gs` (9 ไฟล์), `Sidebar.html`, `appsscript.json` |
| Runtime | V8 (Apps Script) — ทดสอบด้วย Node.js v22.22.2 |
| ผลรวม | **67/67 ผ่าน / 0 ล้มเหลว** |

---

## บริบทและวิธีทดสอบ (Method)

โค้ดชุดนี้เป็น **Google Apps Script** ที่ต้องรันบนเซิร์ฟเวอร์ของ Google และเรียกใช้
บริการ `SpreadsheetApp`, `MailApp`, `PropertiesService`, `Session`, `ScriptApp`,
`Utilities`, `HtmlService` จึง **ไม่สามารถรันตรง ๆ บนเครื่อง Linux/CI ได้**
การพิสูจน์ว่า "รันได้จริง" นอกแพลตฟอร์มจึงทำ 3 ชั้น:

1. **Syntax gate** — ตรวจไวยากรณ์ทุกไฟล์ `.gs` ด้วย `node --check` (เอนจิน V8 ตัวเดียวกับ Apps Script)
2. **Wiring audit** — ตรวจว่าฟังก์ชันที่แต่ละไฟล์เรียกข้ามกันมีอยู่จริง และปุ่มใน `Sidebar.html`
   (`google.script.run.*`) ชี้ไปยังฟังก์ชันที่มีจริงใน `Code.gs`
3. **Behavioral scenarios** — โหลดไฟล์ `.gs` ทั้งหมดเข้า scope เดียวแบบเดียวกับที่ Apps Script ทำ
   โดยแทนบริการของ Google ด้วย fake ในหน่วยความจำ (สเปรดชีต DATA จำลอง, กล่องเมลจำลอง,
   Properties, triggers, นาฬิกาแบบล็อกเวลา) แล้ว **รันเส้นทางงานจริง** พร้อมตรวจผลลัพธ์

> หมายเหตุ: เครื่องมือทดสอบ (harness) เป็นแบบชั่วคราว ไม่ได้ commit เข้า repo
> รายงานฉบับนี้คือหลักฐานผลการทดสอบเพียงอย่างเดียวที่เก็บไว้

ข้อจำกัด: ไม่มี `clasp` และไม่มี Google credentials จึงไม่ได้ deploy จริงบน Apps Script
(อยู่นอกขอบเขต) — การส่งอีเมล/เขียนชีตจริงต้องยืนยันอีกครั้งหลัง deploy บนบัญชีเจ้าของ

---

## 1. Syntax check — ✅ 9/9

ทุกไฟล์ผ่านการตรวจไวยากรณ์ V8 ไม่มี syntax error:
`Constants.gs`, `AuthService.gs`, `DateService.gs`, `SheetService.gs`,
`SettingsService.gs`, `LogService.gs`, `TriggerService.gs`, `EmailService.gs`, `Code.gs`

## 2. Wiring audit — ✅ ผ่านทั้งหมด

- ฟังก์ชันที่ระบุใน `AGENTS.md §13 (Required Functions)` มีครบทุกตัว (entry points ใน
  `Code.gs` + เมธอดของ `SettingsService` / `TriggerService` / `EmailService` / `LogService`)
- ปุ่มทั้ง 3 ใน `Sidebar.html` เรียกผ่าน `google.script.run` ไปยังฟังก์ชันที่มีจริง:
  `getSettingsForSidebar`, `saveSettingsFromSidebar`, `sendTestEmail`,
  `toggleReminderSystemFromSidebar`
- ไม่พบการอ้างอิงฟังก์ชัน/ค่าคงที่ที่ไม่มีอยู่จริง (ตรวจโดยการโหลดและเรียกใช้งานจริง)

## 3. Behavioral scenarios — ✅ ผ่านทั้งหมด

| กลุ่ม | สิ่งที่ยืนยัน | ผล |
|---|---|---|
| Web App entry | `doGet()` ผู้มีสิทธิ์ → เสิร์ฟหน้า `Sidebar` หัวข้อ "ตั้งค่าแจ้งเตือน"; ผู้ไม่มีสิทธิ์ → หน้า "ไม่มีสิทธิ์เข้าถึง" | ✅ |
| Settings | บันทึก↔โหลดค่าตรงกัน; clamp `dueReminderDays`≤60, `chqReminderDays`≥1; เปิดระบบแล้ว sync trigger | ✅ |
| Reminder – ปิดระบบ | `isEnabled=false` → ไม่ส่งอีเมล | ✅ |
| Reminder – วันหยุด | เสาร์/อาทิตย์ → ข้าม ไม่ส่ง | ✅ |
| Reminder – วันทำงาน | DATA จำลอง → Due 1 + Chq 1 + Warning 1; แถว "เบิกแล้ว" ถูกคัดออกจาก Due; ส่งอีเมลรวม 1 ฉบับ (มี subject + plain text + HTML table) | ✅ |
| Test email | ส่งทดสอบได้ 1 ครั้ง; ครั้งที่ 2 ทันทีถูกบล็อกด้วย cooldown 60 วินาที | ✅ |
| Recipients | รับเฉพาะโดเมน `@planbmedia.co.th`; ตัดอีเมลผิดรูป/ผิดโดเมน; เลื่อน CC→To เมื่อ To ว่างโดยไม่ซ้ำ; โยน error เมื่อไม่มีผู้รับที่ถูกต้อง | ✅ |
| Retry/Quota | สำเร็จ→`SUCCESS`; ล้มครั้งเดียว→`SUCCESS_AFTER_RETRY`; ล้มสองครั้ง→`FAILED`; quota เหลือ 0 หรือ error quota→`QUOTA_EXCEEDED` (ไม่ retry) | ✅ |
| Chq dedupe | `hasChqDateReminderAlreadySent` คืน false ก่อนส่ง และ true หลังมี log สำเร็จ | ✅ |
| Log injection | `sanitizeCell` เติม `'` นำหน้าค่าที่ขึ้นต้นด้วย `= + - @` และปล่อยข้อความปกติ | ✅ |
| Triggers | เปิดระบบ → สร้าง trigger 1 ตัวต่อรอบเวลา (2 รอบ); ปิดระบบ → ลบ trigger ทั้งหมด | ✅ |

---

## สรุปสำหรับผู้ตรวจ

- โค้ดผ่านการตรวจไวยากรณ์ V8 ครบทุกไฟล์และ **โหลด + รันเส้นทางงานจริงได้สำเร็จ** เมื่อจำลองบริการของ Google
- Logic หลักทั้งหมด (Due/Chq reminder, กรองผู้รับ, retry, quota, กันส่งซ้ำ, กัน formula injection,
  จัดการ trigger, สิทธิ์เข้าถึง Web App) ทำงานถูกต้องตามสเปกใน `AGENTS.md`
- **พร้อม deploy บน Google Apps Script** ขั้นตอนที่เหลือซึ่งต้องทำบนบัญชีเจ้าของจริง:
  ตั้ง `Sheet ID` ในหน้าตั้งค่า, กด "ทดสอบส่งอีเมล" เพื่อยืนยันการส่งจริง, และเปิดระบบเพื่อสร้าง trigger
