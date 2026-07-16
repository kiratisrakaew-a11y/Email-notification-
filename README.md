# ระบบแจ้งเตือนอีเมลอัตโนมัติ (Email Notification)

Google Apps Script สำหรับแจ้งเตือนอีเมลอัตโนมัติจาก Google Sheet โดยอ่านข้อมูลจากชีตหลักชื่อ `DATA`
ใช้สำหรับทีมแอดมินในการติดตาม 2 งานหลัก:

1. **Due Reminder** — แจ้งเตือนวันที่ใกล้ถึงกำหนดทำจ่าย (อ้างอิงคอลัมน์ `Due`)
2. **Cheque Date Reminder** — แจ้งเตือนวันที่ต้องไปรับเช็ค (อ้างอิงคอลัมน์ `Chq. Date`)

ระบบเป็น **standalone project กลางที่เดียว** — โค้ดอยู่ที่เดียว ไม่ต้องก๊อปลงทุกชีต ชี้ไปที่ Google Sheet
เป้าหมายด้วย **Sheet ID** และตั้งค่าผ่านหน้า **Web App** ภาษาไทย ไม่ต้องใช้บริการภายนอกและไม่ต้องติดตั้ง library ใดๆ

**การทำงานโดยสรุป:** ระบบตั้งเวลา (trigger) ให้รันวันละ 2 รอบ → เปิดชีต `DATA` ตาม Sheet ID ที่ตั้งไว้ →
คำนวณว่ามีแถวไหนใกล้ถึงกำหนด `Due` หรือ `Chq. Date` → รวมเป็นอีเมลฉบับเดียวส่งด้วย **บัญชีที่ deploy** →
บันทึกผลลงชีต `Log` (ไฟล์แยกต่างหาก) ทั้งหมดใช้บริการในตัวของ Google (`SpreadsheetApp`, `MailApp`, `ScriptApp`)

> **คู่มือนี้เขียนสำหรับมือใหม่** ทำตามทีละ Part จากบนลงล่างได้เลย ตั้งแต่ Google Cloud Console
> ไปจนถึงการทดสอบส่งอีเมลจริง

---

## แผนผังขั้นตอนทั้งหมด

ทำครั้งแรกครั้งเดียว โดยไล่ตามลำดับนี้:

| Part | หัวข้อ | จำเป็นไหม |
|------|--------|-----------|
| **A** | [ตั้งค่า Google Cloud Console](#part-a--ตั้งค่า-google-cloud-console) (สร้าง project, OAuth consent, เปิด API, IAM) | *ทางเลือก* — จำเป็นเมื่อ deploy ระดับองค์กร ([ดูรายละเอียด](#จำเป็นเมื่อไหร่)) |
| **B** | [สร้าง Apps Script + ผูกกับ GCP Project](#part-b--สร้าง-apps-script--ผูกกับ-gcp-project) | **จำเป็น** |
| **C** | [เตรียมชีต DATA](#part-c--เตรียมชีต-data) | **จำเป็น** |
| **D** | [Deploy เป็น Web App + ให้สิทธิ์ (Authorization)](#part-d--deploy-เป็น-web-app--ให้สิทธิ์-authorization) | **จำเป็น** |
| **E** | [ตั้งค่าในหน้า Web App](#part-e--ตั้งค่าในหน้า-web-app) | **จำเป็น** |
| **F** | [ทดสอบส่งอีเมล](#part-f--ทดสอบส่งอีเมล) | **จำเป็น** |
| **G** | [ความปลอดภัยและสิทธิ์เข้าถึง (Security & Access Control)](#part-g--ความปลอดภัยและสิทธิ์เข้าถึง-security--access-control) | **แนะนำอย่างยิ่ง** |

> 🔐 **โปรเจกต์นี้ผ่านการเสริมความปลอดภัย (CIA hardening) แล้ว** — หน้า Web App จำกัดสิทธิ์เฉพาะ
> เจ้าของและผู้ดูแลที่กำหนด (allow-list), จำกัด access ระดับ deployment เป็นเฉพาะโดเมน, ป้องกัน
> spam อีเมล และป้องกัน formula injection ในชีต Log อ่านรายละเอียดที่ [Part G](#part-g--ความปลอดภัยและสิทธิ์เข้าถึง-security--access-control)
> และรายงานเต็มใน [`SECURITY-ASSESSMENT.md`](SECURITY-ASSESSMENT.md)

> **รีบใช้งาน / ทดลองส่วนตัว?** ข้าม Part A ได้เลย ระบบจะใช้ GCP project เริ่มต้นที่ Apps Script
> จัดการให้อัตโนมัติ แล้วเริ่มที่ [Part B](#part-b--สร้าง-apps-script--ผูกกับ-gcp-project) ได้ทันที

---

## สิ่งที่ต้องเตรียม

- **บัญชี Google** ที่จะใช้ deploy ระบบ (แนะนำเป็นบัญชี Google Workspace ขององค์กร เช่น `you@planbmedia.co.th`)
  — บัญชีนี้จะเป็นผู้ "ส่งอีเมลแทน" และต้องมีสิทธิ์เข้าถึงชีต DATA
- **Google Sheet** ที่มีชีตชื่อ `DATA` พร้อมข้อมูล (ดูหัวข้อ [เตรียมชีต DATA](#part-c--เตรียมชีต-data)) — จด **Sheet ID** ไว้
  - บัญชีที่ deploy ให้สิทธิ์แค่ดู/read-only ชีต DATA ได้ เพราะระบบไม่เขียนลงชีต DATA
- **อีเมลผู้รับ** ที่ลงท้ายด้วย `@planbmedia.co.th` (ระบบอนุญาตเฉพาะโดเมนนี้)
- **อีเมลผู้ดูแล (admin)** ที่จะให้เข้าหน้าตั้งค่าได้ (ถ้ามีมากกว่าเจ้าของ) — เจ้าของบัญชีที่ deploy
  เข้าถึงได้เสมอโดยไม่ต้องกรอก ดู [Part G](#part-g--ความปลอดภัยและสิทธิ์เข้าถึง-security--access-control)
- (เฉพาะ Part A) สิทธิ์ในการสร้าง/จัดการ **Google Cloud Project** — ถ้าเป็นบัญชีองค์กรอาจต้องให้ผู้ดูแล
  (Admin) เปิดสิทธิ์สร้าง project ให้ก่อน

---

## Part A — ตั้งค่า Google Cloud Console

ส่วนนี้ให้คุณ "เป็นเจ้าของ" GCP project ที่อยู่เบื้องหลัง Apps Script เอง เพื่อคุมหน้าขอสิทธิ์ (OAuth consent),
เปิด/ปิด API และจัดการสิทธิ์ทีมผ่าน IAM

### จำเป็นเมื่อไหร่

> **ไม่ทำ Part A ก็รันได้** — Apps Script มี GCP project เริ่มต้น (default/managed) ให้อยู่แล้ว ระบบจะขอ
> สิทธิ์ (scope) ที่ต้องใช้ให้อัตโนมัติตอน authorize ครั้งแรก เหมาะกับการ **ทดลองหรือใช้ส่วนตัว**
>
> **ควรทำ Part A เมื่อ:**
> - Deploy ใช้งานจริงระดับ **องค์กร / production** ระยะยาว
> - ต้องการ **คุมหน้า OAuth consent screen** เอง (ชื่อแอป, อีเมลผู้ติดต่อ, รายการ scope)
> - ต้องการให้ **ทีม IT ดูแลสิทธิ์และ quota** ผ่าน IAM รวมศูนย์
> - ต้องการให้ project ไม่ผูกกับบัญชีคนเดียว (ลดความเสี่ยงเวลาคนลาออก)

### A1. สร้าง (หรือเลือก) GCP Project

1. ไปที่ [console.cloud.google.com](https://console.cloud.google.com) แล้วล็อกอินด้วยบัญชีองค์กร
2. คลิกตัวเลือก project ด้านบน (ข้างโลโก้ Google Cloud) → **New Project (โปรเจกต์ใหม่)**
3. ตั้งชื่อ เช่น `Email Notification` → เลือก Organization/Location ตามที่องค์กรกำหนด → **Create**
4. รอสักครู่ แล้วสลับมาที่ project ที่เพิ่งสร้าง (มุมบนต้องแสดงชื่อ project นี้)

### A2. ตั้งค่า OAuth consent screen

หน้านี้คือหน้าที่ผู้ใช้เห็นตอนกด "อนุญาต" ให้แอปเข้าถึงข้อมูล

1. เมนูซ้าย → **APIs & Services → OAuth consent screen**
2. เลือกประเภทผู้ใช้ (User Type):
   - **Internal** — แนะนำ ถ้าทุกคนที่เกี่ยวข้องอยู่ใน Google Workspace องค์กรเดียวกัน (`@planbmedia.co.th`)
     ข้อดีคือ **ไม่ต้องผ่านขั้นตอน verification ของ Google** และไม่มีหน้าจอเตือน "unverified app"
   - **External** — ใช้เมื่อมีผู้เกี่ยวข้องนอกองค์กร จะต้องเพิ่ม **Test users** และอาจเจอหน้าจอเตือน
     (วิธีผ่านหน้าจอเตือนอยู่ใน [Part D](#part-d--deploy-เป็น-web-app--ให้สิทธิ์-authorization))
3. กรอกข้อมูลแอป: **App name** (เช่น `Email Notification`), **User support email**, **Developer contact email**
   → บันทึกจนจบ (Save and Continue)

> **หมายเหตุเรื่อง Scope:** ไม่จำเป็นต้องเพิ่ม scope ด้วยตัวเองในหน้านี้ — Apps Script จะขอ scope ที่โค้ดใช้จริง
> ให้อัตโนมัติตอน authorize ครั้งแรก scope ที่ระบบนี้จะขอได้แก่: **ส่งอีเมลแทนคุณ** (`script.send_mail`),
> **อ่าน/เขียน Google Sheets** (`spreadsheets`), **สร้างไฟล์ใน Drive** (สำหรับไฟล์ Log), และ
> **จัดการ trigger ตามเวลา** (`script.scriptapp`)

### A3. เปิด API ที่เกี่ยวข้อง

เมนูซ้าย → **APIs & Services → Library** → ค้นหาแต่ละตัวแล้วกด **Enable**:

| API | จำเป็นไหม | ใช้ทำอะไร |
|-----|-----------|-----------|
| **Apps Script API** | จำเป็น (โดยเฉพาะถ้าจะผูก GCP project ใน B3) | ให้ Apps Script ทำงานกับ GCP project ที่ผูกไว้ |
| **Google Sheets API** | แนะนำให้เปิด | อ่านชีต DATA / เขียนชีต Log |
| **Gmail API** | ทางเลือก | ระบบใช้ `MailApp` (ไม่ใช่ Gmail API โดยตรง) เปิดไว้เผื่อการตรวจสอบ/quota ได้ |
| **Google Drive API** | แนะนำให้เปิด | ใช้ตอนสร้างไฟล์ Log ใหม่อัตโนมัติ |

> ถ้าไม่แน่ใจ ให้เปิดทั้ง 4 ตัวไว้ก่อนได้ ไม่มีผลเสีย — การเปิด API เป็นการ "อนุญาตให้เรียกใช้ได้" เท่านั้น
> ยังไม่คิดค่าใช้จ่ายจนกว่าจะมีการใช้งานเกิน quota ฟรี (ซึ่งระบบนี้ปกติไม่เกิน)

### A4. จัดการสิทธิ์ทีมด้วย IAM

เมนูซ้าย → **IAM & Admin → IAM** → **Grant access (เพิ่มสิทธิ์)** เพื่อกำหนดว่าใครดูแล GCP project นี้ได้บ้าง

| Role | ควรให้ใคร | ทำอะไรได้ |
|------|-----------|-----------|
| **Owner** | เจ้าของ/ผู้ดูแลหลักของระบบ | จัดการได้ทุกอย่าง รวมถึงเพิ่ม/ลบสมาชิกและ billing |
| **Editor** | ทีมที่ต้องแก้ตั้งค่า project / เปิด API | แก้ไข resource ได้ แต่จัดการสิทธิ์คนอื่นไม่ได้ |
| **Viewer** | ทีมที่แค่ต้องการดูสถานะ | ดูได้อย่างเดียว |

> **สำคัญ — IAM คุมคนละชั้นกับสิทธิ์รับอีเมล/เข้าถึงชีต:**
> - **IAM** = สิทธิ์ "จัดการตัว GCP project" (เปิด API, ดู log, billing)
> - **สิทธิ์รับอีเมลแจ้งเตือน** = กำหนดในช่อง To/CC/BCC ของหน้า Web App ([Part E](#part-e--ตั้งค่าในหน้า-web-app))
> - **สิทธิ์เข้าถึงชีต DATA/Log** = แชร์ที่ตัว Google Sheet ตามปกติ
>
> การเพิ่มคนใน IAM **ไม่ได้** ทำให้เขาได้รับอีเมลแจ้งเตือนโดยอัตโนมัติ

### A5. จด Project Number ไว้

ต้องใช้ตอนผูก Apps Script กับ project นี้ในขั้นตอน [B3](#b3-ผูก-apps-script-เข้ากับ-gcp-project)

- ไปที่ **IAM & Admin → Settings** (หรือดูที่การ์ด **Project info** หน้าแรก Dashboard)
- คัดลอกค่า **Project number** (เป็นตัวเลขล้วน เช่น `123456789012`) — ระวังอย่าสับสนกับ **Project ID** (เป็นข้อความ)

---

## Part B — สร้าง Apps Script + ผูกกับ GCP Project

### B1. สร้าง Standalone Apps Script Project

1. ไปที่ [script.google.com](https://script.google.com) → **โปรเจกต์ใหม่ (New project)**
   (ไม่ต้องเปิดจากเมนู Extensions ของชีต — เป็นโปรเจกต์กลางแยกต่างหาก)
2. ตั้งชื่อโปรเจกต์ตามต้องการ เช่น `Email Notification` (คลิกที่ชื่อ "Untitled project" มุมบนซ้ายเพื่อแก้)

### B2. คัดลอกไฟล์โค้ดเข้า Editor

สร้างไฟล์ให้ครบตามรายการด้านล่าง แล้วคัดลอกเนื้อหาจากไฟล์ในโปรเจกต์นี้ไปวางให้ตรงกัน

| ไฟล์ใน Apps Script | ชนิดไฟล์ | ที่มา (ไฟล์ในโปรเจกต์นี้) |
|--------------------|----------|---------------------------|
| `Code.gs`          | Script   | `Code.gs`          |
| `Constants.gs`     | Script   | `Constants.gs`     |
| `DateService.gs`   | Script   | `DateService.gs`   |
| `SheetService.gs`  | Script   | `SheetService.gs`  |
| `SettingsService.gs` | Script | `SettingsService.gs` |
| `EmailService.gs`  | Script   | `EmailService.gs`  |
| `LogService.gs`    | Script   | `LogService.gs`    |
| `TriggerService.gs`| Script   | `TriggerService.gs`|
| `AuthService.gs`   | Script   | `AuthService.gs` ⭐ ใหม่ (ควบคุมสิทธิ์เข้าถึง) |
| `Sidebar.html`     | HTML     | `Sidebar.html`     |
| `appsscript.json`  | Manifest | `appsscript.json` ⭐ ใหม่ (ตั้งค่า deployment/เขตเวลา) |

**วิธีสร้างไฟล์ใน Editor:**
- ไฟล์ `.gs`: กดปุ่ม **+** ข้างคำว่า "ไฟล์ (Files)" → เลือก **สคริปต์ (Script)** → ตั้งชื่อให้ตรงตามตาราง (ไม่ต้องพิมพ์ `.gs`)
- ไฟล์ `Sidebar.html`: กดปุ่ม **+** → เลือก **HTML** → ตั้งชื่อ `Sidebar`
- ไฟล์เริ่มต้นที่ชื่อ `Code.gs` มีอยู่แล้ว ให้ลบเนื้อหาเดิมทิ้งแล้ววางเนื้อหาจาก `Code.gs` ของโปรเจกต์นี้แทน
- ไฟล์ **`appsscript.json`** เป็นไฟล์ manifest พิเศษ ไม่ต้องสร้างใหม่ ให้เปิดแสดงก่อนโดยไป
  **⚙️ Project Settings (การตั้งค่าโปรเจกต์)** → ติ๊ก **"Show 'appsscript.json' manifest file in editor"**
  แล้วกลับมาที่ Editor จะเห็นไฟล์ `appsscript.json` → คลิกเปิดแล้ววางเนื้อหาจากไฟล์ในโปรเจกต์นี้แทนทั้งหมด

> หมายเหตุ: Apps Script รวมไฟล์ `.gs` ทุกไฟล์เข้าด้วยกันตอนรัน จึงไม่ต้อง `import` / `require` ระหว่างไฟล์
> ดังนั้น `AuthService.gs` จึงเรียกใช้ได้จากไฟล์อื่นทันทีโดยไม่ต้อง import

เมื่อวางครบทุกไฟล์แล้ว กด **บันทึกโปรเจกต์ (Save / Ctrl+S)**

### B3. ผูก Apps Script เข้ากับ GCP Project

> ทำขั้นนี้เฉพาะเมื่อทำ [Part A](#part-a--ตั้งค่า-google-cloud-console) ไว้แล้ว — ถ้าข้าม Part A ให้ข้ามข้อนี้ไปที่ [Part C](#part-c--เตรียมชีต-data) ได้เลย

1. ในหน้า Apps Script คลิกไอคอน **⚙️ Project Settings (การตั้งค่าโปรเจกต์)** เมนูซ้าย
2. เลื่อนไปหัวข้อ **Google Cloud Platform (GCP) Project** → คลิก **Change project (เปลี่ยนโปรเจกต์)**
3. วาง **Project number** ที่จดไว้จาก [A5](#a5-จด-project-number-ไว้) → **Set project**
4. ถ้าระบบเตือนว่าต้องตั้ง OAuth consent screen ก่อน ให้กลับไปทำ [A2](#a2-ตั้งค่า-oauth-consent-screen) ให้เรียบร้อยแล้วลองใหม่

---

## Part C — เตรียมชีต DATA

ชีตหลักต้องชื่อ `DATA` (ตัวพิมพ์ใหญ่ทั้งหมด) แถวแรกเป็น header แต่ละแถวถัดไปคือ 1 รายการ

**คอลัมน์ที่ระบบบังคับต้องมี** (ถ้าขาดจะหยุดทำงานและบันทึก error ลงชีต `Log`):

`No` · `Vendor name` · `Amount/Month` · `Due` · `Status Payment` · `Chq. Date` · `PR No` · `PO No` · `Epicore Code` · `Media Location`

โครงสร้างคอลัมน์เต็ม (47 คอลัมน์) ดูได้จาก [`AGENTS.md`](AGENTS.md) หัวข้อ *Google Sheet Structure*

**ข้อควรรู้เกี่ยวกับ header:**
- ระบบ normalize header อัตโนมัติก่อนจับคู่ ดังนั้น header ที่มีการขึ้นบรรทัดใหม่หรือช่องว่างซ้อน เช่น
  `Status\nPayment`, `Rental \nYear`, `Accrued \n Date` จะถูกอ่านเป็น `Status Payment`, `Rental Year`, `Accrued Date` ได้ถูกต้อง
- **ห้ามเปลี่ยนชื่อคอลัมน์** ที่ระบบใช้อ้างอิง มิฉะนั้นจะหาไม่เจอ

**รูปแบบวันที่:** ใช้ `DD/MM/YYYY` หรือ Date object ของ Google Sheet ในคอลัมน์ `Due` และ `Chq. Date`

**หา Sheet ID จาก URL ของ Google Sheet:**
```
docs.google.com/spreadsheets/d/  1AbCdEf...XYZ  /edit
                                  └──── Sheet ID ────┘
```

---

## Part D — Deploy เป็น Web App + ให้สิทธิ์ (Authorization)

1. ในหน้า Apps Script กด **Deploy (ทำให้ใช้งาน)** → **New deployment (การทำให้ใช้งานใหม่)**
2. คลิกไอคอนเฟือง ⚙️ ข้าง "Select type (เลือกชนิด)" → เลือก **Web app**
3. ตั้งค่า:
   - **Execute as (เรียกใช้ในฐานะ):** `Me` (บัญชีของคุณ — เพื่อให้อ่านชีตและส่งอีเมลในนามคุณ)
     ตรงกับค่า `executeAs: USER_DEPLOYING` ใน `appsscript.json`
   - **Who has access (ผู้มีสิทธิ์เข้าถึง):** เลือกให้ **แคบที่สุด** เท่าที่ใช้งานได้ — แนะนำ
     **"ทุกคนในองค์กร (`@planbmedia.co.th`)"** ให้ตรงกับค่า `access: DOMAIN` ใน `appsscript.json`
     - ⚠️ **อย่าเลือก "ทุกคน (Anyone)" / "ทุกคนแบบไม่ระบุตัวตน (Anyone, even anonymous)"** เพราะจะเปิด
       ให้คนนอกเข้าถึง endpoint ได้ (แม้จะมี allow-list ฝั่งโค้ดกันอีกชั้นก็ตาม)
     - หากเป็น **บัญชี Gmail ส่วนตัว (ไม่มีโดเมน Workspace)** จะเลือก `DOMAIN` ไม่ได้ ให้เลือก
       **"เฉพาะตัวคุณเอง (Only myself)"** แทน และแก้ `appsscript.json` เป็น `"access": "MYSELF"`
4. กด **Deploy**

> 🔐 **สองชั้นของการคุมสิทธิ์:** `Who has access` / `appsscript.json` คุมว่า "ใครเปิด URL ได้"
> ส่วน `AuthService` ในโค้ด ([Part G](#part-g--ความปลอดภัยและสิทธิ์เข้าถึง-security--access-control))
> คุมอีกชั้นว่า "ใครสั่งงานได้" (เจ้าของ + admin allow-list เท่านั้น) — ทำงานร่วมกันแบบ defense-in-depth

**การให้สิทธิ์ครั้งแรก (Authorization):** ระบบจะเด้งหน้าต่างขอสิทธิ์

1. เลือกบัญชี Google ที่จะใช้ deploy (บัญชีเดียวกับที่จะเป็นผู้ส่งอีเมล)
2. **กรณีเจอหน้าจอ "Google hasn't verified this app"** (พบได้เมื่อ consent screen เป็นแบบ External และยังไม่ผ่าน verification):
   - คลิก **Advanced (ขั้นสูง)** → คลิก **Go to _ชื่อแอป_ (unsafe)**
   - นี่เป็นแอปของคุณเอง จึงปลอดภัย (หน้าจอนี้จะไม่ขึ้นเลยถ้า consent screen เป็น **Internal**)
3. ทบทวนรายการสิทธิ์ที่ระบบขอ แล้วกด **Allow (อนุญาต)**:
   > ระบบต้องการสิทธิ์: **อ่าน/เขียน Google Sheet**, **ส่งอีเมลแทนคุณ**, **สร้าง trigger ตามเวลา**,
   > และ **ดูอีเมลบัญชีที่ล็อกอิน** (`userinfo.email` — ใช้ตรวจสิทธิ์ผู้เข้าใช้หน้าตั้งค่า)
4. เมื่อ deploy สำเร็จ ให้คัดลอก **Web app URL** ที่ได้ → เปิดใน browser จะเห็นหน้าตั้งค่าภาษาไทย

> เก็บ URL นี้ไว้เปิดหน้าตั้งค่าได้ทุกเมื่อ (bookmark ได้)

---

## Part E — ตั้งค่าในหน้า Web App

กรอกค่าต่างๆ ในหน้าตั้งค่า:

| หัวข้อ | ค่าเริ่มต้น | รายละเอียด |
|--------|-------------|-------------|
| **Sheet ID** | (ว่าง) | ⭐ วาง Sheet ID ของ Google Sheet ที่มีชีต DATA |
| แจ้งเตือน Due ล่วงหน้า | 30 วัน | ปรับได้ 1–60 วัน |
| แจ้งเตือน Chq. Date ล่วงหน้า | 1 วัน | ปรับได้ 1–60 วัน |
| **Log Sheet ID** | (ว่าง) | ไฟล์เก็บ Log แยกต่างหาก เว้นว่างได้ (ระบบสร้างให้อัตโนมัติ) |
| To | (ว่าง) | ผู้รับหลัก ใส่หลายอีเมลคั่นด้วย `,` |
| CC | (ว่าง) | สำเนา |
| BCC | (ว่าง) | สำเนาลับ |
| **Admin emails** | (ว่าง) | 🔐 อีเมลผู้ดูแลเพิ่มเติมที่ให้เข้าหน้านี้ได้ คั่นด้วย `,` — เจ้าของที่ deploy เข้าได้เสมอ |
| เวลาแจ้งเตือนรอบที่ 1 | 09:00 | ปรับได้ |
| เวลาแจ้งเตือนรอบที่ 2 | 13:00 | ปรับได้ |
| เปิดระบบแจ้งเตือนอัตโนมัติ | ปิด | ติ๊กเพื่อเปิด |

- **Sheet ID ต้องกรอกก่อนเสมอ** — ตอนกดบันทึกระบบจะตรวจว่าเปิด Sheet ID นั้นได้จริง ถ้าผิดจะแจ้งเตือนทันที
- อีเมลทุกช่องต้องลงท้ายด้วย `@planbmedia.co.th` — อีเมลที่อยู่นอกโดเมนหรือรูปแบบผิดจะถูกข้ามเฉพาะรายการนั้น
  และบันทึกลงชีต `Log` โดยไม่ทำให้การแจ้งเตือนทั้งหมดล้มเหลว
- **Admin emails:** ระบุอีเมลผู้ดูแลเพิ่มเติม (คั่นด้วย `,`) ที่ต้องการให้เปิดหน้าตั้งค่านี้ได้ —
  เจ้าของบัญชีที่ deploy เข้าถึงได้เสมอโดยไม่ต้องกรอก จึงเว้นว่างไว้ได้ถ้ามีแค่เจ้าของคนเดียว
- กด **บันทึกการตั้งค่า** เพื่อบันทึกค่าทั้งหมด (เก็บใน Script Properties ของโปรเจกต์)
- เมื่อ **เปิดระบบแจ้งเตือนอัตโนมัติ** ระบบจะสร้าง/อัปเดต trigger ตามเวลาที่ตั้งไว้โดยอัตโนมัติ และป้องกัน trigger ซ้ำ
- สถานะด้านล่างจะแสดงว่าระบบเปิด/ปิด และมี trigger อยู่หรือไม่

---

## Part F — ทดสอบส่งอีเมล

กดปุ่ม **ทดสอบส่งอีเมล** ในหน้า Web App — ระบบจะส่งอีเมลทดสอบจริงไปยังผู้รับที่ตั้งไว้ และบันทึกผลลง `Log` เป็นประเภท `Test`

ถ้าได้รับอีเมลทดสอบและเห็นบรรทัด `Test` ในชีต Log แปลว่า setup สำเร็จครบทุกขั้นตอน 🎉

> 🔐 **ป้องกันการยิงซ้ำ:** ปุ่มทดสอบมี cooldown **60 วินาที** (กันการเผาโควตาอีเมล) ถ้ากดถี่เกินไป
> จะขึ้นข้อความ `กรุณารอสักครู่ก่อนส่งอีเมลทดสอบอีกครั้ง` — รอสักครู่แล้วลองใหม่ ปรับค่าได้ที่
> `testEmailCooldownSeconds` ใน `Constants.gs`

---

## Part G — ความปลอดภัยและสิทธิ์เข้าถึง (Security & Access Control)

โปรเจกต์นี้ผ่านการเสริมความปลอดภัยตามรายงาน [`SECURITY-ASSESSMENT.md`](SECURITY-ASSESSMENT.md)
ส่วนนี้อธิบายการตั้งค่าที่เกี่ยวข้องกับความปลอดภัยและวิธีมอบสิทธิ์ให้ผู้ดูแล

### G1. โมเดลสิทธิ์เข้าถึง 2 ชั้น (Defense-in-depth)

| ชั้น | ควบคุมโดย | ทำหน้าที่ |
|------|-----------|-----------|
| **ชั้นที่ 1 — ใครเปิด URL ได้** | `Who has access` (ตอน deploy) + `appsscript.json` (`access`) | จำกัดให้เฉพาะคนในโดเมนเปิดหน้า Web App ได้ |
| **ชั้นที่ 2 — ใครสั่งงานได้** | `AuthService.gs` (allow-list ในโค้ด) | แม้เปิดหน้าได้ ก็สั่งงาน (อ่าน/บันทึก/ทดสอบ/เปิดปิด) ได้เฉพาะ **เจ้าของ + admin** เท่านั้น |

ผู้ที่ผ่านชั้นที่ 1 แต่ไม่อยู่ใน allow-list จะเห็นข้อความ **"ไม่มีสิทธิ์เข้าถึงระบบนี้"** และเรียก
ฟังก์ชันใด ๆ ไม่ได้ ส่วน **trigger อัตโนมัติ** (`runScheduledReminder`) ไม่ถูกจำกัดด้วย allow-list
เพราะทำงานในนามเจ้าของโดยไม่มีผู้ใช้กดเอง

### G2. วิธีกำหนดผู้ดูแล (Admin allow-list)

**เจ้าของบัญชีที่ deploy เข้าถึงได้เสมอ** ไม่ต้องตั้งค่าเพิ่ม ถ้าต้องการให้คนอื่นเข้าหน้าตั้งค่าได้ด้วย
เลือกวิธีใดวิธีหนึ่ง:

- **วิธีที่ 1 (แนะนำ):** กรอกอีเมลในช่อง **"Admin emails"** บนหน้าตั้งค่า ([Part E](#part-e--ตั้งค่าในหน้า-web-app))
  คั่นหลายอีเมลด้วย `,` แล้วกดบันทึก
- **วิธีที่ 2:** ตั้ง Script Property ชื่อ `adminEmails` โดยตรง (Project Settings → Script Properties)
  เป็นค่าอีเมลคั่นด้วย `,`

> การเทียบอีเมลไม่สนตัวพิมพ์เล็ก/ใหญ่ (case-insensitive) และตัดช่องว่างหัวท้ายให้อัตโนมัติ

### G3. การตั้งค่าใน `appsscript.json`

```json
{
  "timeZone": "Asia/Bangkok",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "webapp": { "access": "DOMAIN", "executeAs": "USER_DEPLOYING" }
}
```

- `access: DOMAIN` — เปิดให้เฉพาะบัญชีในโดเมนเดียวกับผู้ deploy (บัญชีส่วนตัวให้เปลี่ยนเป็น `MYSELF`)
- `executeAs: USER_DEPLOYING` — โค้ดทำงานในนามเจ้าของ (อ่านชีต + ส่งอีเมลได้)
- **ไม่ระบุ `oauthScopes`** โดยตั้งใจ เพื่อให้ Apps Script auto-infer scope จากโค้ด (ลดความเสี่ยงตั้ง scope ขาด)

> ⚠️ **หลังแก้ `appsscript.json` หรืออัปเดตโค้ด ต้อง Deploy ใหม่เสมอ** (Deploy → Manage deployments →
> ✏️ แก้ deployment เดิม → New version → Deploy) การตั้งค่า `access` ในหน้า Deploy ควรตรงกับใน manifest

### G4. มาตรการความปลอดภัยอื่นที่มีในโค้ดแล้ว

| มาตรการ | ป้องกันอะไร |
|---------|-------------|
| Cooldown ปุ่มทดสอบ 60 วิ + ตรวจโควตาก่อนส่ง | การเผาโควตาอีเมล / spam (Availability) |
| Sanitize ค่าก่อนเขียนชีต Log | Formula/CSV injection ในชีต Log (Confidentiality/Integrity) |
| ข้อความ error แบบ generic | การรั่วข้อมูลภายในผ่าน error message |
| Allow-list โดเมนผู้รับ `@planbmedia.co.th` | การส่งข้อมูลออกนอกโดเมน |

### G5. มาตรการเชิงปฏิบัติการ (ที่โค้ดทำแทนไม่ได้)

- **จำกัดจำนวนคนที่มีสิทธิ์ Editor บนโปรเจกต์ Apps Script** — เพราะผู้มีสิทธิ์แก้โปรเจกต์เห็นค่าใน
  Script Properties (อีเมลผู้รับ, Sheet ID) ได้ → ให้สิทธิ์เท่าที่จำเป็น (least privilege)
- **ตั้ง OAuth consent screen เป็น Internal** ([A2](#a2-ตั้งค่า-oauth-consent-screen)) เพื่อลดหน้าจอ unverified
- ถือ **Sheet ID เป็นข้อมูลกึ่งลับ** และคุมสิทธิ์ที่ตัวไฟล์ Google Sheet ให้รัดกุม

---

## การทำงานอัตโนมัติ

เมื่อเปิดระบบแล้ว trigger จะรันฟังก์ชัน `runScheduledReminder` ตามเวลาที่ตั้งไว้ (ค่าเริ่มต้น 09:00 และ 13:00
เขตเวลา `Asia/Bangkok`) โดยแต่ละรอบจะ:

- **Due:** เลือกแถวที่ `Due` อยู่ในช่วงแจ้งเตือน และ `Status Payment` ยังไม่ใช่ `เบิกแล้ว` — แจ้งซ้ำได้ทุกวันจนกว่าจะเบิก
- **Chq. Date:** เลือกแถวที่ `Chq. Date` อยู่ในช่วงแจ้งเตือน — แจ้งครั้งเดียว ไม่แจ้งซ้ำ (ตรวจจากประวัติใน `Log`)
- รวมทุกรายการส่งเป็นอีเมลฉบับเดียว เนื้อหาเป็น **HTML table** (แนบ plain text เป็น fallback) แยกหัวข้อ Due / Chq. Date / Warning
- หากส่งไม่สำเร็จจะ retry 1 ครั้ง และบันทึกสถานะ (`SUCCESS`, `SUCCESS_AFTER_RETRY`, `FAILED`, `QUOTA_EXCEEDED`)

> trigger เป็นแบบ best-effort ของ Google อาจคลาดเคลื่อนได้ราว 15 นาทีจากเวลาที่ตั้ง ถือเป็นเรื่องปกติ

## ชีต Log

ระบบเก็บ Log ไว้ใน **ไฟล์ Google Sheet แยกต่างหาก** (ไม่ใช่ไฟล์เดียวกับ DATA) เพื่อให้ชีต DATA
สามารถให้สิทธิ์แค่ดู (read-only) ได้ โดยการตั้งค่ามี 2 แบบ:

- **เว้นช่อง `Log Sheet ID` ว่างไว้** — ระบบจะสร้างไฟล์ `Email Notification Log` ใหม่ให้อัตโนมัติ
  ในบัญชีที่ deploy (จึงมีสิทธิ์แก้ไขแน่นอน) และจำ ID ไว้ให้เอง
- **กรอก `Log Sheet ID` เอง** — ระบุไฟล์ที่ต้องการ โดยบัญชีที่ deploy ต้องมี **สิทธิ์แก้ไข** ไฟล์นั้น

ในไฟล์ Log ระบบจะสร้างชีตชื่อ `Log` สำหรับบันทึกประวัติ ประกอบด้วยคอลัมน์:
`Timestamp` · `Type` · `Recipient` · `Row Number` · `No` · `Vendor name` · `Related Date` · `Status` · `Error Message` · `Notify Count`

สถานะที่พบได้ เช่น `SUCCESS`, `SUCCESS_AFTER_RETRY`, `FAILED`, `SKIPPED_INVALID_DOMAIN`,
`SKIPPED_EMPTY_CHQ_DATE`, `WARNING_MISSING_DUE`, `QUOTA_EXCEEDED`

---

## การแก้ปัญหาเบื้องต้น

| อาการ | สาเหตุ / วิธีแก้ |
|-------|------------------|
| หน้าจอ/ข้อความ `ไม่มีสิทธิ์เข้าถึงระบบนี้` | บัญชีที่ล็อกอินไม่ใช่เจ้าของและไม่อยู่ใน `Admin emails` → เพิ่มอีเมลใน [Part G2](#g2-วิธีกำหนดผู้ดูแล-admin-allow-list) หรือเข้าด้วยบัญชีเจ้าของ |
| error `กรุณารอสักครู่ก่อนส่งอีเมลทดสอบอีกครั้ง` | กดปุ่มทดสอบถี่เกิน cooldown 60 วิ → รอสักครู่แล้วลองใหม่ |
| error `ยังไม่ได้ตั้งค่า Sheet ID` | กรอก Sheet ID ในหน้า Web App แล้วกดบันทึก |
| error `ไม่สามารถบันทึกการตั้งค่าได้ กรุณาตรวจสอบ Sheet ID` | ตรวจว่า Sheet ID ถูกต้อง และบัญชีที่ deploy มีสิทธิ์เปิดชีตนั้น |
| error `ไม่สามารถบันทึกการตั้งค่าได้ กรุณาตรวจสอบ Log Sheet ID` | ตรวจว่า Log Sheet ID ถูกต้อง และบัญชีที่ deploy มี **สิทธิ์แก้ไข** ไฟล์นั้น หรือเว้นว่างไว้เพื่อให้ระบบสร้างไฟล์ Log ให้อัตโนมัติ |
| error `ไม่พบชีต DATA` | ตรวจว่าในชีตนั้นมีแท็บชื่อ `DATA` (ตัวพิมพ์ใหญ่) |
| error `ไม่พบคอลัมน์ที่จำเป็น` | เพิ่มคอลัมน์ที่ขาดตามหัวข้อ [เตรียมชีต DATA](#part-c--เตรียมชีต-data) — ดูรายละเอียดในชีต `Log` |
| อีเมลไม่ถูกส่ง | ตรวจว่าอีเมลลงท้าย `@planbmedia.co.th` และเปิดระบบแล้ว — ดูสถานะในชีต `Log` |
| `QUOTA_EXCEEDED` ใน Log | เกินโควตาส่งอีเมลรายวันของ Gmail/Apps Script รอวันถัดไป |
| trigger ไม่ทำงาน | ตรวจสถานะในหน้า Web App ว่ามี trigger และระบบเปิดอยู่ หรือกดบันทึกการตั้งค่าใหม่อีกครั้ง |
| หน้าจอ `Google hasn't verified this app` ตอน authorize | เป็นเรื่องปกติสำหรับ consent screen แบบ External ที่ยังไม่ verify → กด **Advanced → Go to (unsafe) → Allow** หรือเปลี่ยน consent screen เป็น **Internal** ([A2](#a2-ตั้งค่า-oauth-consent-screen)) |
| ผูก GCP project ไม่ได้ / `You do not have permission` | ตรวจว่าใช้ **Project number** (ตัวเลข ไม่ใช่ Project ID) และตั้ง OAuth consent screen ([A2](#a2-ตั้งค่า-oauth-consent-screen)) แล้ว รวมถึงบัญชีมีสิทธิ์ IAM บน project นั้น |
| error ทำนอง `API has not been enabled` | เปิด API ที่เกี่ยวข้องใน [A3](#a3-เปิด-api-ที่เกี่ยวข้อง) (โดยเฉพาะ Apps Script API) แล้วรอสักครู่ให้มีผล |
| `Permission denied` ใน Cloud Console | ให้ผู้ดูแลเพิ่มบัญชีของคุณใน IAM ([A4](#a4-จัดการสิทธิ์ทีมด้วย-iam)) ด้วย role ที่เหมาะสม |

---

## หมายเหตุ

- ระบบออกแบบสำหรับ Google Apps Script (standalone) ใช้ `SpreadsheetApp`, `MailApp`, `PropertiesService`, `ScriptApp`
- ใช้ **`MailApp`** ในการส่งอีเมล (ไม่ได้เรียก Gmail API โดยตรง) และ **ไม่ใช้ service account / OAuth client ID** —
  การส่งอีเมลและเข้าถึงชีตทำในนามบัญชีที่ deploy โดยตรง จึงไม่ต้องสร้าง credential เพิ่ม
- scope ที่ต้องใช้ถูก **auto-infer จากโค้ด** ตอน authorize ครั้งแรก — ไฟล์ `appsscript.json` มีไว้เพื่อ
  ตั้งเขตเวลาและ **จำกัด access ระดับ deployment** (`access: DOMAIN`) แต่ **ไม่ประกาศ `oauthScopes`**
  จึงยังคง auto-infer เหมือนเดิม (ดู [Part G3](#g3-การตั้งค่าใน-appsscriptjson))
- ตั้งค่าทั้งหมด (รวม Sheet ID และ `adminEmails`) เก็บใน **Script Properties** ของโปรเจกต์ ไม่ใช่ในชีต
- การเข้าถึงหน้าตั้งค่าจำกัดด้วย **`AuthService`** (เจ้าของ + admin allow-list) ดู [Part G](#part-g--ความปลอดภัยและสิทธิ์เข้าถึง-security--access-control)
- รายละเอียดข้อกำหนดทั้งหมดของระบบดูได้ที่ [`AGENTS.md`](AGENTS.md) และรายงานความปลอดภัยที่ [`SECURITY-ASSESSMENT.md`](SECURITY-ASSESSMENT.md)
