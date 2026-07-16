# คู่มือติดตั้งครั้งแรกฉบับเต็ม (Google Cloud Console → Apps Script)

คู่มือนี้อธิบายการติดตั้งระบบแจ้งเตือนอีเมล **ตั้งแต่ต้นจนจบสำหรับการ set up ครั้งแรก** โดยเริ่มจาก
**Google Cloud Console** (สร้าง GCP project, ตั้งค่า OAuth consent screen, จัดการ IAM) ไปจนถึง
**Google Apps Script** (คัดลอกโค้ด, เชื่อม GCP project, deploy Web App, ตั้งค่าใช้งาน)

> คู่มือนี้อ้างอิงเมนู Google Cloud Console / Apps Script รูปแบบล่าสุด ณ ปี 2025–2026
> หน้าจอจริงของ Google อาจปรับเปลี่ยนตำแหน่ง/ชื่อปุ่มได้เป็นระยะ — ให้ยึด **ชื่อเมนูหลัก** เป็นหลัก
>
> ถ้าเคยติดตั้งไปแล้วและต้องการดูเฉพาะขั้นตอน Apps Script + การตั้งค่าใช้งานแบบย่อ ดูที่ [`README.md`](README.md)
> รายละเอียดข้อกำหนดระบบทั้งหมดดูที่ [`AGENTS.md`](AGENTS.md)

---

## สารบัญ

- [ภาพรวมและสิ่งที่ต้องเตรียม](#0-ภาพรวมและสิ่งที่ต้องเตรียม)
- **ส่วน A — Google Cloud Console**
  - [A1. สร้าง GCP Project](#a1-สร้าง-gcp-project)
  - [A2. ตั้งค่า OAuth consent screen (Google Auth Platform)](#a2-ตั้งค่า-oauth-consent-screen-google-auth-platform)
  - [A3. เพิ่ม OAuth scopes](#a3-เพิ่ม-oauth-scopes)
  - [A4. เปิด API ที่จำเป็น](#a4-เปิด-api-ที่จำเป็น)
  - [A5. IAM & Permissions](#a5-iam--permissions)
- **ส่วน B — Google Apps Script**
  - [B1. สร้าง Standalone Apps Script Project](#b1-สร้าง-standalone-apps-script-project)
  - [B2. คัดลอกไฟล์โค้ดเข้า Editor](#b2-คัดลอกไฟล์โค้ดเข้า-editor)
  - [B3. ตั้งค่า appsscript.json (scopes + timezone)](#b3-ตั้งค่า-appsscriptjson-scopes--timezone)
  - [B4. เชื่อม Apps Script เข้ากับ Standard GCP Project](#b4-เชื่อม-apps-script-เข้ากับ-standard-gcp-project)
  - [B5. เตรียมชีต DATA](#b5-เตรียมชีต-data)
  - [B6. Deploy เป็น Web App](#b6-deploy-เป็น-web-app)
  - [B7. ตั้งค่าในหน้า Web App](#b7-ตั้งค่าในหน้า-web-app)
  - [B8. ทดสอบส่งอีเมล](#b8-ทดสอบส่งอีเมล)
- **ส่วน C — อ้างอิง**
  - [การแก้ปัญหา](#การแก้ปัญหา)
  - [เอกสารเพิ่มเติม](#เอกสารเพิ่มเติม)

---

## 0. ภาพรวมและสิ่งที่ต้องเตรียม

### ระบบนี้ทำงานอย่างไร (โดยย่อ)

ระบบเป็น **standalone Google Apps Script Web App** ที่ทำงานในนามบัญชีที่ deploy โดย:

- **อ่าน** Google Sheet ชีต `DATA` ด้วย `SpreadsheetApp.openById(sheetId)` → ต้องมีสิทธิ์ Spreadsheet
- **ส่งอีเมล** แจ้งเตือนด้วย `MailApp.sendEmail` → ต้องมีสิทธิ์ส่งเมลแทนผู้ใช้
- **สร้างไฟล์ Log อัตโนมัติ** ด้วย `SpreadsheetApp.create` → ต้องมีสิทธิ์ Drive
- **ตั้ง trigger ตามเวลา** ด้วย `ScriptApp.newTrigger` (เขตเวลา `Asia/Bangkok`) → ต้องมีสิทธิ์จัดการ trigger

สิทธิ์เหล่านี้จะถูกขอผ่าน **OAuth** ตอน deploy/authorize ครั้งแรก และ (ในคู่มือนี้) จะถูกควบคุมผ่าน
**Standard GCP project** ที่เราสร้างเอง เพื่อให้ตั้งค่า OAuth consent screen และ IAM ได้เต็มรูปแบบ

### สิ่งที่ต้องเตรียม

| รายการ | รายละเอียด |
|--------|-------------|
| บัญชี Google Workspace | บัญชีในองค์กร `@planbmedia.co.th` ที่มีสิทธิ์สร้าง GCP project และ deploy Apps Script |
| สิทธิ์เข้าถึงชีต `DATA` | บัญชีที่ deploy ต้องเปิด Google Sheet เป้าหมายได้ (สิทธิ์แค่ **ดู/read-only** ก็พอ เพราะระบบไม่เขียนลงชีต DATA) |
| Sheet ID ของชีต DATA | ดูวิธีหาในขั้น [B5](#b5-เตรียมชีต-data) |
| อีเมลผู้รับ | ต้องลงท้ายด้วย `@planbmedia.co.th` เท่านั้น (ระบบอนุญาตเฉพาะโดเมนนี้) |

> **หมายเหตุเรื่องบัญชี:** คู่มือนี้ตั้งสมมติฐานว่า deploy ด้วยบัญชี Google Workspace ขององค์กร
> `planbmedia.co.th` จึงตั้ง OAuth consent screen เป็น **Internal** ได้ (ไม่ต้องผ่านการ verify แอป)

---

# ส่วน A — Google Cloud Console

## A1. สร้าง GCP Project

1. เข้า [console.cloud.google.com](https://console.cloud.google.com) แล้วเข้าสู่ระบบด้วยบัญชี `@planbmedia.co.th`
2. คลิกตัวเลือกโปรเจกต์ (project picker) ที่แถบด้านบน → **New Project (โปรเจกต์ใหม่)**
3. กรอกข้อมูล:
   - **Project name:** เช่น `Email Notification`
   - **Organization / Location:** เลือกให้อยู่ภายใต้องค์กร `planbmedia.co.th`
     (ข้อนี้สำคัญ — ถ้าโปรเจกต์ไม่อยู่ใต้องค์กร จะตั้ง OAuth consent screen เป็น Internal ไม่ได้)
4. คลิก **Create** แล้วรอสักครู่ จากนั้น **สลับมาที่โปรเจกต์นี้** ให้แน่ใจว่าแถบด้านบนแสดงชื่อโปรเจกต์ที่เพิ่งสร้าง
5. เข้าเมนู **☰ → Cloud overview → Dashboard** (หรือหน้า Project settings) แล้ว **จดค่า 2 อย่างนี้ไว้**:
   - **Project number** (ตัวเลขล้วน เช่น `123456789012`) → จะใช้ตอน [เชื่อมเข้ากับ Apps Script (B4)](#b4-เชื่อม-apps-script-เข้ากับ-standard-gcp-project)
   - **Project ID** (เช่น `email-notification-xxxxx`) → ใช้อ้างอิงทั่วไป

> 💡 **Project number** คือค่าที่ Apps Script ต้องการตอนเชื่อมโปรเจกต์ ไม่ใช่ Project ID — จดให้ถูกตัว

---

## A2. ตั้งค่า OAuth consent screen (Google Auth Platform)

หน้าจอส่วนนี้ Google เปลี่ยนชื่อเป็น **Google Auth Platform** (เดิมชื่อ "OAuth consent screen")

1. เข้าเมนู **☰ → APIs & Services → OAuth consent screen**
   (หรือค้นหา "Google Auth Platform" ในช่องค้นหาด้านบน)
2. ถ้ายังไม่เคยตั้งค่า จะมีปุ่ม **Get started / Configure** ให้กดเริ่ม
3. **App Information:**
   - **App name:** เช่น `Email Notification`
   - **User support email:** เลือกอีเมลของคุณ/ทีมแอดมิน
4. **Audience (ประเภทผู้ใช้):** เลือก **Internal**
   - **Internal** = ใช้ได้เฉพาะผู้ใช้ในองค์กร `planbmedia.co.th` เท่านั้น
   - **ข้อดี:** ไม่ต้องส่งแอปให้ Google ตรวจสอบ (no verification) และไม่มีหน้าจอเตือน "unverified app"
   - เหมาะสมพอดีกับระบบนี้ เพราะผู้รับอีเมลถูกจำกัดไว้ที่โดเมน `@planbmedia.co.th` อยู่แล้ว
5. **Contact Information:** กรอก **developer contact email** (อีเมลของคุณ/ทีมแอดมิน)
6. ยอมรับเงื่อนไข แล้วกด **Create / Save**

> ⚠️ ถ้าเลือก **Internal** ไม่ได้ (ปุ่มเป็นสีเทา) แปลว่าโปรเจกต์นี้ไม่ได้อยู่ใต้องค์กร Workspace
> ให้กลับไปสร้างโปรเจกต์ใหม่ในขั้น [A1](#a1-สร้าง-gcp-project) โดยเลือก Organization เป็น `planbmedia.co.th`

---

## A3. เพิ่ม OAuth scopes

ระบบใช้บริการในตัวของ Apps Script (built-in service) ซึ่งต้องการ OAuth scope ตามตารางนี้:

| บริการในโค้ด | หน้าที่ | Scope |
|--------------|---------|-------|
| `SpreadsheetApp` | อ่าน/เขียน Google Sheet (ชีต DATA และ Log) | `https://www.googleapis.com/auth/spreadsheets` |
| `SpreadsheetApp.create` | สร้างไฟล์ Log ใหม่อัตโนมัติ | `https://www.googleapis.com/auth/drive` |
| `MailApp.sendEmail` | ส่งอีเมลแจ้งเตือน | `https://www.googleapis.com/auth/script.send_mail` |
| `ScriptApp` | สร้าง/ลบ trigger ตามเวลา | `https://www.googleapis.com/auth/script.scriptapp` |

> `PropertiesService` (เก็บการตั้งค่า) และ `HtmlService` (หน้า Web App) **ไม่ต้องใช้ scope เพิ่ม**

**วิธีเพิ่ม:**

1. ในหน้า **Google Auth Platform → Data Access** (หรือแท็บ **Scopes**) กด **Add or Remove Scopes**
2. เนื่องจาก scope ของ Apps Script บางตัวไม่ปรากฏในรายการให้เลือก ให้ใช้ช่อง
   **"Manually add scopes"** แล้ววาง URL scope ทั้ง 4 ตัวจากตารางด้านบน (ทีละบรรทัด)
3. กด **Add to table** → **Update** → **Save**

> 💡 **สำคัญ:** scope ที่มีผลจริงตอนรัน คือ scope ที่ประกาศไว้ใน `appsscript.json` ของโปรเจกต์ Apps Script
> (ดูขั้น [B3](#b3-ตั้งค่า-appsscriptjson-scopes--timezone)) การกรอกที่ consent screen เป็นการ**ประกาศให้สอดคล้องกัน**
> เพื่อให้หน้าจอขออนุญาตแสดงรายการสิทธิ์ครบถ้วนและตรงกัน

---

## A4. เปิด API ที่จำเป็น

1. เข้าเมนู **☰ → APIs & Services → Library**
2. ค้นหา **"Google Apps Script API"** → เปิด (**Enable**)
   - จำเป็นสำหรับการเชื่อม/จัดการโปรเจกต์ Apps Script กับ GCP project นี้
3. (ไม่บังคับ) Gmail API / Google Sheets API / Google Drive API **ไม่จำเป็นต้องเปิด**
   เพราะระบบใช้บริการในตัว (`MailApp`, `SpreadsheetApp`) ซึ่งไม่ได้เรียกผ่าน REST API เหล่านี้
   จะเปิดไว้ก็ได้หากในอนาคตต้องการต่อยอด แต่ไม่มีผลกับการทำงานปัจจุบัน

---

## A5. IAM & Permissions

ส่วนนี้คือการกำหนดว่า **ใครดูแล GCP project ได้บ้าง** (ไม่ใช่สิทธิ์ของตัวสคริปต์ตอนรัน)

1. เข้าเมนู **☰ → IAM & Admin → IAM**
2. คุณ (ผู้สร้างโปรเจกต์) จะเป็น **Owner** โดยอัตโนมัติ
3. หากต้องการให้ทีมแอดมินคนอื่นเข้ามาช่วยดูแล กด **Grant Access / Add** แล้ว:
   - **New principals:** ใส่อีเมล `@planbmedia.co.th` ของผู้ที่จะให้สิทธิ์
   - **Role:** เลือกตามความเหมาะสม
     - `Owner` — จัดการได้ทุกอย่างรวมถึงลบโปรเจกต์/จัดการสิทธิ์ (ให้เฉพาะผู้ดูแลหลัก)
     - `Editor` — แก้ไขการตั้งค่า/เปิดปิด API ได้ แต่จัดการสิทธิ์ไม่ได้
     - `Viewer` — ดูอย่างเดียว
4. กด **Save**

> **สำคัญ — แยกให้ชัด 2 เรื่อง:**
> - **IAM ของ GCP project** = ใครมีสิทธิ์เข้ามาแก้ไข/ดูแลตัวโปรเจกต์ในหน้า Cloud Console
> - **สิทธิ์ตอนสคริปต์รันจริง** = ถูกกำหนดโดย **บัญชีที่ deploy Web App** (ตั้ง **Execute as: Me** ในขั้น [B6](#b6-deploy-เป็น-web-app))
>   บัญชีนี้คือบัญชีที่จะ "ส่งอีเมล / อ่านชีต / สร้าง Log / ตั้ง trigger" ในนามของมัน
>
> ดังนั้นให้แน่ใจว่า **บัญชีที่ใช้ deploy** เป็นบัญชีที่มีสิทธิ์เข้าถึงชีต DATA และส่งอีเมลได้ตามต้องการ

---

# ส่วน B — Google Apps Script

## B1. สร้าง Standalone Apps Script Project

1. ไปที่ [script.google.com](https://script.google.com) (เข้าสู่ระบบด้วยบัญชีเดียวกับที่จะ deploy) → **New project (โปรเจกต์ใหม่)**
   - ไม่ต้องเปิดจากเมนู Extensions ของชีต — โปรเจกต์นี้เป็น **โปรเจกต์กลางแยกต่างหาก (standalone)**
2. ตั้งชื่อโปรเจกต์ตามต้องการ เช่น `Email Notification`

---

## B2. คัดลอกไฟล์โค้ดเข้า Editor

สร้างไฟล์ให้ครบตามรายการ แล้วคัดลอกเนื้อหาจากไฟล์ในโปรเจกต์นี้ไปวางให้ตรงกัน

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
| `Sidebar.html`     | HTML     | `Sidebar.html`     |

**วิธีสร้างไฟล์ใน Editor:**
- ไฟล์ `.gs`: กดปุ่ม **+** ข้างคำว่า "ไฟล์ (Files)" → เลือก **สคริปต์ (Script)** → ตั้งชื่อให้ตรงตามตาราง (ไม่ต้องพิมพ์ `.gs`)
- ไฟล์ `Sidebar.html`: กดปุ่ม **+** → เลือก **HTML** → ตั้งชื่อ `Sidebar`

> Apps Script รวมไฟล์ `.gs` ทุกไฟล์เข้าด้วยกันตอนรัน จึงไม่ต้อง `import` / `require` ระหว่างไฟล์

เมื่อวางครบทุกไฟล์แล้ว กด **บันทึกโปรเจกต์ (Save / Ctrl+S)**

---

## B3. ตั้งค่า appsscript.json (scopes + timezone)

ขั้นนี้เป็นการประกาศ OAuth scopes และเขตเวลาให้ตรงกับที่โค้ดใช้จริง

1. ในหน้า Apps Script คลิก **⚙️ Project Settings (การตั้งค่าโปรเจกต์)**
2. ติ๊ก **"Show 'appsscript.json' manifest file in editor"** (แสดงไฟล์ manifest)
3. กลับไปที่ **Editor** จะเห็นไฟล์ `appsscript.json` — เปิดแล้วแก้ให้เป็นดังนี้:

```json
{
  "timeZone": "Asia/Bangkok",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

4. กด **บันทึก (Save)**

> - `timeZone` ตั้งเป็น `Asia/Bangkok` ให้สอดคล้องกับ `APP_CONFIG.timezone` ในโค้ด (`Constants.gs`)
>   เพื่อให้ trigger รันตามเวลาไทยที่ตั้งไว้ (ค่าเริ่มต้น 09:00 และ 13:00)
> - การประกาศ `oauthScopes` ให้ครบทำให้หน้าจอ Authorization ตอน deploy ขอสิทธิ์ครบในครั้งเดียว
>   และตรงกับ scope ที่ตั้งไว้ใน OAuth consent screen ([A3](#a3-เพิ่ม-oauth-scopes))

---

## B4. เชื่อม Apps Script เข้ากับ Standard GCP Project

ขั้นนี้คือการย้ายโปรเจกต์ Apps Script จาก GCP project เริ่มต้น (ที่ Google สร้างซ่อนไว้ให้) มาใช้
**Standard GCP project ที่เราสร้างเองในส่วน A** เพื่อให้ควบคุม OAuth consent screen และ IAM ได้

1. ในหน้า Apps Script คลิก **⚙️ Project Settings (การตั้งค่าโปรเจกต์)**
2. เลื่อนไปที่หัวข้อ **Google Cloud Platform (GCP) Project**
3. กด **Change project (เปลี่ยนโปรเจกต์)**
4. วาง **Project number** ที่จดไว้จากขั้น [A1](#a1-สร้าง-gcp-project) (ตัวเลขล้วน)
5. กด **Set project (ตั้งโปรเจกต์)** → ยืนยัน

> ⚠️ หากขึ้น error ว่าตั้งโปรเจกต์ไม่ได้ ให้ตรวจว่า:
> - ใส่ **Project number** (ไม่ใช่ Project ID)
> - เปิด **Apps Script API** แล้วในขั้น [A4](#a4-เปิด-api-ที่จำเป็น)
> - ตั้ง **OAuth consent screen** เสร็จแล้วในขั้น [A2](#a2-ตั้งค่า-oauth-consent-screen-google-auth-platform)
> - บัญชีที่ใช้อยู่มีสิทธิ์บน GCP project นั้น (ดู [A5](#a5-iam--permissions))

---

## B5. เตรียมชีต DATA

ชีตหลักต้องชื่อ `DATA` (ตัวพิมพ์ใหญ่ทั้งหมด) แถวแรกเป็น header แต่ละแถวถัดไปคือ 1 รายการ

**คอลัมน์ที่ระบบบังคับต้องมี** (ถ้าขาดจะหยุดทำงานและบันทึก error ลงชีต `Log`):

`No` · `Vendor name` · `Amount/Month` · `Due` · `Status Payment` · `Chq. Date` · `PR No` · `PO No` · `Epicore Code` · `Media Location`

โครงสร้างคอลัมน์เต็ม (47 คอลัมน์) ดูได้จาก [`AGENTS.md`](AGENTS.md) หัวข้อ *Google Sheet Structure*

**ข้อควรรู้เกี่ยวกับ header:**
- ระบบ normalize header อัตโนมัติก่อนจับคู่ ดังนั้น header ที่ขึ้นบรรทัดใหม่หรือมีช่องว่างซ้อน เช่น
  `Status\nPayment`, `Rental \nYear` จะถูกอ่านเป็น `Status Payment`, `Rental Year` ได้ถูกต้อง
- **ห้ามเปลี่ยนชื่อคอลัมน์** ที่ระบบใช้อ้างอิง มิฉะนั้นจะหาไม่เจอ

**รูปแบบวันที่:** ใช้ `DD/MM/YYYY` หรือ Date object ของ Google Sheet ในคอลัมน์ `Due` และ `Chq. Date`

**หา Sheet ID จาก URL ของ Google Sheet:**
```
docs.google.com/spreadsheets/d/  1AbCdEf...XYZ  /edit
                                  └──── Sheet ID ────┘
```

---

## B6. Deploy เป็น Web App

1. ในหน้า Apps Script กด **Deploy (ทำให้ใช้งาน)** → **New deployment (การทำให้ใช้งานใหม่)**
2. เลือกชนิด (Select type) เป็น **Web app**
3. ตั้งค่า:
   - **Execute as (เรียกใช้ในฐานะ):** `Me` (บัญชีของคุณ — เพื่อให้อ่านชีต ส่งอีเมล และตั้ง trigger ในนามคุณ)
   - **Who has access (ผู้มีสิทธิ์เข้าถึง):** เลือกตามต้องการ (เช่น เฉพาะตัวคุณเอง หรือทุกคนในองค์กร)
4. กด **Deploy** → ครั้งแรกจะขอสิทธิ์ (Authorization) ให้กด **Review permissions → เลือกบัญชี → Allow (อนุญาต)**
   > หน้าจอจะแสดงรายการสิทธิ์ที่ตรงกับ scope ใน [B3](#b3-ตั้งค่า-appsscriptjson-scopes--timezone):
   > อ่าน/เขียน Google Sheet, จัดการไฟล์ใน Drive (สร้าง Log), ส่งอีเมลแทนคุณ, และตั้ง trigger ตามเวลา
5. คัดลอก **Web app URL** ที่ได้ → เปิดใน browser จะเห็นหน้าตั้งค่าภาษาไทย

> - เก็บ URL นี้ไว้เปิดหน้าตั้งค่าได้ทุกเมื่อ (bookmark ได้)
> - เพราะ consent screen เป็น **Internal** จึงไม่มีหน้าจอเตือน "unverified app" สำหรับผู้ใช้ในองค์กร

---

## B7. ตั้งค่าในหน้า Web App

กรอกค่าต่างๆ ในหน้าตั้งค่า:

| หัวข้อ | ค่าเริ่มต้น | รายละเอียด |
|--------|-------------|-------------|
| **Sheet ID** | (ว่าง) | ⭐ วาง Sheet ID ของ Google Sheet ที่มีชีต DATA |
| **Log Sheet ID** | (ว่าง) | เว้นว่าง = ระบบสร้างไฟล์ Log ให้อัตโนมัติ / หรือกรอกเองถ้ามีไฟล์ที่บัญชี deploy **แก้ไขได้** |
| แจ้งเตือน Due ล่วงหน้า | 30 วัน | ปรับได้ 1–60 วัน |
| แจ้งเตือน Chq. Date ล่วงหน้า | 1 วัน | ปรับได้ 1–60 วัน |
| To | (ว่าง) | ผู้รับหลัก ใส่หลายอีเมลคั่นด้วย `,` |
| CC | (ว่าง) | สำเนา |
| BCC | (ว่าง) | สำเนาลับ |
| เวลาแจ้งเตือนรอบที่ 1 | 09:00 | ปรับได้ |
| เวลาแจ้งเตือนรอบที่ 2 | 13:00 | ปรับได้ |
| เปิดระบบแจ้งเตือนอัตโนมัติ | ปิด | ติ๊กเพื่อเปิด (ระบบจะสร้าง trigger ให้อัตโนมัติ) |

- **Sheet ID ต้องกรอกก่อนเสมอ** — ตอนกดบันทึกระบบจะตรวจว่าเปิด Sheet ID นั้นได้จริง ถ้าผิดจะแจ้งเตือนทันที
- อีเมลทุกช่องต้องลงท้ายด้วย `@planbmedia.co.th` — อีเมลนอกโดเมนหรือรูปแบบผิดจะถูกข้ามเฉพาะรายการนั้น
  และบันทึกลงชีต `Log` โดยไม่ทำให้การแจ้งเตือนทั้งหมดล้มเหลว
- กด **บันทึกการตั้งค่า** เพื่อบันทึกค่าทั้งหมด (เก็บใน **Script Properties** ของโปรเจกต์)
- เมื่อ **เปิดระบบแจ้งเตือนอัตโนมัติ** ระบบจะสร้าง/อัปเดต trigger ตามเวลาที่ตั้งไว้โดยอัตโนมัติ และป้องกัน trigger ซ้ำ
- สถานะด้านล่างจะแสดงว่าระบบเปิด/ปิด และมี trigger อยู่หรือไม่

---

## B8. ทดสอบส่งอีเมล

กดปุ่ม **ทดสอบส่งอีเมล** ในหน้า Web App — ระบบจะส่งอีเมลทดสอบจริงไปยังผู้รับที่ตั้งไว้
และบันทึกผลลง `Log` เป็นประเภท `Test`

ถ้าได้รับอีเมลทดสอบและเห็นบรรทัด `Test` ในชีต `Log` แปลว่าการติดตั้งครบถ้วนสมบูรณ์ ✅

---

# ส่วน C — อ้างอิง

## การแก้ปัญหา

### ฝั่ง Google Cloud Console / OAuth

| อาการ | สาเหตุ / วิธีแก้ |
|-------|------------------|
| เลือก **Internal** ใน consent screen ไม่ได้ | โปรเจกต์ไม่ได้อยู่ใต้องค์กร Workspace — สร้างโปรเจกต์ใหม่โดยเลือก Organization เป็น `planbmedia.co.th` ([A1](#a1-สร้าง-gcp-project)) |
| เปลี่ยน GCP project ใน Apps Script ไม่ได้ | ใส่ **Project number** (ไม่ใช่ Project ID), เปิด Apps Script API แล้ว ([A4](#a4-เปิด-api-ที่จำเป็น)), ตั้ง consent screen แล้ว ([A2](#a2-ตั้งค่า-oauth-consent-screen-google-auth-platform)) |
| `This app is blocked` / `Access blocked` ตอน authorize | consent screen ยังไม่ถูกตั้งค่า หรือผู้ใช้อยู่นอกองค์กร (Internal ใช้ได้เฉพาะ `@planbmedia.co.th`) |
| ขึ้นหน้าจอ "Google hasn't verified this app" | consent screen ตั้งเป็น External — เปลี่ยนเป็น **Internal** หรือเพิ่มบัญชีลง Test users |
| authorize แล้วสิทธิ์ไม่ครบ / ส่งเมลหรือสร้าง Log ไม่ได้ | `oauthScopes` ใน `appsscript.json` ไม่ครบ — เพิ่มให้ครบ 4 ตัว ([B3](#b3-ตั้งค่า-appsscriptjson-scopes--timezone)) แล้ว deploy ใหม่และ authorize ซ้ำ |

### ฝั่งการใช้งานระบบ

| อาการ | สาเหตุ / วิธีแก้ |
|-------|------------------|
| error `ยังไม่ได้ตั้งค่า Sheet ID` | กรอก Sheet ID ในหน้า Web App แล้วกดบันทึก |
| error `Sheet ID ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าถึง` | ตรวจว่า Sheet ID ถูกต้อง และบัญชีที่ deploy มีสิทธิ์เปิดชีตนั้น |
| error `Log Sheet ID ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าถึง` | ตรวจว่า Log Sheet ID ถูกต้อง และบัญชีที่ deploy มี **สิทธิ์แก้ไข** ไฟล์นั้น หรือเว้นว่างไว้เพื่อให้ระบบสร้างไฟล์ Log ให้อัตโนมัติ |
| error `ไม่พบชีต DATA` | ตรวจว่าในชีตนั้นมีแท็บชื่อ `DATA` (ตัวพิมพ์ใหญ่) |
| error `ไม่พบคอลัมน์ที่จำเป็น` | เพิ่มคอลัมน์ที่ขาดตามหัวข้อ [เตรียมชีต DATA](#b5-เตรียมชีต-data) — ดูรายละเอียดในชีต `Log` |
| อีเมลไม่ถูกส่ง | ตรวจว่าอีเมลลงท้าย `@planbmedia.co.th` และเปิดระบบแล้ว — ดูสถานะในชีต `Log` |
| `QUOTA_EXCEEDED` ใน Log | เกินโควตาส่งอีเมลรายวันของ Gmail/Apps Script รอวันถัดไป |
| trigger ไม่ทำงาน | ตรวจสถานะในหน้า Web App ว่ามี trigger และระบบเปิดอยู่ หรือกดบันทึกการตั้งค่าใหม่อีกครั้ง |

> trigger เป็นแบบ best-effort ของ Google อาจคลาดเคลื่อนได้ราว 15 นาทีจากเวลาที่ตั้ง ถือเป็นเรื่องปกติ

---

## เอกสารเพิ่มเติม

- [`README.md`](README.md) — คู่มือใช้งานแบบย่อ + รายละเอียดการทำงานอัตโนมัติและชีต Log
- [`AGENTS.md`](AGENTS.md) — ข้อกำหนดระบบทั้งหมด, โครงสร้าง Google Sheet เต็ม 47 คอลัมน์, สถาปัตยกรรมโค้ด
