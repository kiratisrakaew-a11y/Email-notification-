# AGENTS.md

## Project Overview

โปรเจกต์นี้เป็น Google Apps Script สำหรับแจ้งเตือนอีเมลอัตโนมัติจาก Google Sheet ไฟล์เดียว โดยใช้ข้อมูลจากชีตหลักชื่อ `DATA`

ระบบใช้สำหรับทีมแอดมินในการติดตาม 2 ประเภทงานหลัก:

1. แจ้งเตือนวันที่ใกล้ถึงกำหนดทำจ่าย โดยอ้างอิงจากคอลัมน์ `Due`
2. แจ้งเตือนวันที่ต้องไปรับเช็ค โดยอ้างอิงจากคอลัมน์ `Chq. Date`

ระบบต้องติดตั้งง่ายโดยการคัดลอกไฟล์ Apps Script ไปวางใน Google Apps Script Editor ของ Google Sheet โดยตรง ไม่ต้องใช้บริการภายนอก และไม่ต้องสร้าง Web App

---

## 1. Google Sheet Structure

ชีตหลักชื่อ:

- `DATA`

แต่ละแถวแทนข้อมูล 1 รายการ

คอลัมน์ในชีต `DATA` มีดังนี้:

1. `No`
2. `Rental Year`
3. `Payment`
4. `Company`
5. `Vendor`
6. `Vendor name`
7. `Status Contract`
8. `Contract No.`
9. `Start Contract`
10. `End Contract`
11. `Year`
12. `Rent`
13. `Payment term`
14. `Amount/Month`
15. `Amount/Year`
16. `CN/Amount`
17. `รอบเอกสาร`
18. `Due`
19. `Accrued Date`
20. `Start Date`
21. `End Date`
22. `Status Payment`
23. `Send ECM`
24. `ECM No`
25. `เอกสารเบิก`
26. `MEMO/INV No.`
27. `Period:`
28. `Chq. Date`
29. `PR No`
30. `PO No`
31. `Part Code`
32. `Description`
33. `Media Type`
34. `Epicore Code`
35. `Media Location`
36. `Code DGT`
37. `Status Location`
38. `Payment Owner`
39. `Payment Date`
40. `Send Tawi50`
41. `Rcpt. Date`
42. `Process`
43. `Bank`
44. `Account no:`
45. `Contact`
46. `Remark`
47. `ECM Edit`

วันที่ใน Google Sheet ใช้รูปแบบ `DD/MM/YYYY` หรือ Date object ของ Google Sheet

ห้ามแก้ไขโครงสร้างชีต `DATA` เดิมโดยอัตโนมัติ  
ห้ามสร้าง header ใหม่ในชีต `DATA` โดยอัตโนมัติ  
ให้ทำงานตาม header ที่กำหนดเท่านั้น

---

## 2. Header Matching Rule

เนื่องจาก header บางคอลัมน์ในไฟล์ Google Sheet อาจมีการขึ้นบรรทัดใหม่หรือมีช่องว่างแทรกอยู่ เช่น `Status\nPayment`, `Rental \nYear`

ดังนั้นการจับคู่ชื่อคอลัมน์ต้อง normalize header ก่อนเสมอ

กติกาการ normalize header:

- แปลง line break `\n` เป็นช่องว่าง
- แปลง carriage return `\r` เป็นช่องว่าง
- รวมช่องว่างหลายตัวให้เหลือช่องว่างเดียว
- trim ช่องว่างหัวท้าย
- ห้ามเปลี่ยนตัวพิมพ์เล็ก/ใหญ่โดยไม่จำเป็น เว้นแต่มี requirement เพิ่มเติม

ตัวอย่าง:

- `Status\nPayment` ต้องถูกมองเป็น `Status Payment`
- `Rental \nYear` ต้องถูกมองเป็น `Rental Year`
- `Accrued \n Date` ต้องถูกมองเป็น `Accrued Date`

การ validate required columns และการสร้าง column index map ต้องใช้ header ที่ผ่านการ normalize แล้วเสมอ

ตัวอย่างฟังก์ชันที่ควรมี:

- `normalizeHeader(header)`
- `getColumnIndexMap(sheet)`
- `validateRequiredColumns(columnMap)`

กติกาสำคัญ:

- ห้ามจับคู่ header จาก raw header โดยตรง
- ทุก logic ที่อ้างอิงชื่อคอลัมน์ เช่น `Due`, `Chq. Date`, `Status Payment`, `Vendor name`, `Rental Year` ต้องอ้างอิงผ่าน normalized header เท่านั้น
- ถ้าหลัง normalize แล้วยังไม่พบ column ที่จำเป็น ให้บันทึก error ลง `Log`

---

## 3. Reminder Rules

ระบบต้องมีการแจ้งเตือน 2 ประเภท

### 3.1 Due Reminder

ใช้คอลัมน์:

- `Due`

ค่าเริ่มต้นการแจ้งเตือนล่วงหน้า:

- 30 วัน

ผู้ใช้สามารถปรับจำนวนวันล่วงหน้าได้จาก Sidebar

ช่วงที่ปรับได้:

- 1 ถึง 60 วัน

เงื่อนไขการแจ้งเตือน:

- แจ้งเตือนเมื่อวันที่ใน `Due` ใกล้ถึงกำหนดตามจำนวนวันที่ตั้งไว้
- ถ้า `daysUntil = 0` ให้ถือว่ายังอยู่ในช่วงแจ้งเตือน และต้องแจ้งเตือน
- ถ้า `daysUntil < 0` ถือว่าเลยกำหนดแล้ว ไม่ต้องแจ้งเตือนซ้ำ
- ให้แจ้งเตือนซ้ำทุกวันจนกว่า `Status Payment` จะเป็น `เบิกแล้ว`
- ถ้า `Status Payment` เป็น `เบิกแล้ว` ให้ข้ามรายการนั้น

ถ้าคอลัมน์ `Due` ว่าง:

- ไม่ต้องนำรายการนั้นไปรวมในอีเมลแจ้งเตือน Due ปกติ
- ต้องบันทึกลง `Log` เป็นสถานะ `WARNING_MISSING_DUE`
- ต้องระบุข้อมูลอย่างน้อย:
  - วันที่และเวลาที่ตรวจพบ
  - หมายเลขแถว
  - `No`
  - `Vendor name`
  - ประเภท warning คือ `Missing Due`
- ถ้ามี admin email หรืออีเมลผู้รับที่ตั้งค่าไว้ใน Sidebar ให้รวมรายการ `Due` ว่างไว้ในอีเมลแจ้งเตือนส่วน Warning ด้วย

### 3.2 Cheque Date Reminder

ใช้คอลัมน์:

- `Chq. Date`

ค่าเริ่มต้นการแจ้งเตือนล่วงหน้า:

- 1 วัน

ผู้ใช้สามารถปรับจำนวนวันล่วงหน้าได้จาก Sidebar

ช่วงที่ปรับได้:

- 1 ถึง 60 วัน

กติกาที่ใช้จริง:

- `Due` ใช้ค่าเริ่มต้นแจ้งเตือนล่วงหน้า 30 วัน
- `Chq. Date` ใช้ค่าเริ่มต้นแจ้งเตือนล่วงหน้า 1 วัน
- ทั้งสองค่าให้ผู้ใช้ปรับได้จาก Sidebar ช่วง 1-60 วัน
- ต้องมี slider แยกกัน 2 ตัว:
  - Due reminder days
  - Chq. Date reminder days

เงื่อนไขการแจ้งเตือน:

- แจ้งเตือนเฉพาะรายการที่มีการกรอกวันที่ใน `Chq. Date`
- แจ้งเตือนล่วงหน้าตามจำนวนวันที่ตั้งไว้
- ถ้า `daysUntil = 0` ให้ถือว่ายังอยู่ในช่วงแจ้งเตือน และต้องแจ้งเตือน
- ถ้า `daysUntil < 0` ถือว่าเลยกำหนดแล้ว ไม่ต้องแจ้งเตือนซ้ำ
- ไม่ต้องแจ้งเตือนซ้ำหลังจากแจ้งไปแล้ว

ถ้าคอลัมน์ `Chq. Date` ว่าง:

- ให้ข้ามรายการนั้น
- ไม่ต้องส่งอีเมลแจ้งเตือน
- ไม่ต้องถือเป็น error
- ไม่ต้องแจ้งซ้ำ
- ไม่ต้อง retry
- จะบันทึกเป็น `SKIPPED_EMPTY_CHQ_DATE` ใน Log ได้ ถ้าต้องการ audit trail แต่ไม่บังคับ

การป้องกันแจ้งซ้ำสำหรับ `Chq. Date` ควรใช้ข้อมูลจาก `Log` เพื่อตรวจสอบว่าเคยส่งรายการเดียวกันแล้วหรือไม่

---

## 4. Notification Schedule

ระบบต้องส่งอีเมลอัตโนมัติวันละ 2 รอบ:

1. 09:00
2. 13:00

Timezone:

- `Asia/Bangkok`

ผู้ใช้สามารถปรับเวลาแจ้งเตือนได้จาก Sidebar

เมื่อผู้ใช้บันทึกเวลาใหม่:

- ต้องลบ trigger เดิมอัตโนมัติ
- ต้องสร้าง trigger ใหม่อัตโนมัติ
- ต้องป้องกัน trigger ซ้ำ

ไม่ต้องมีปุ่มติดตั้ง trigger แยก  
ไม่ต้องมีปุ่มลบ trigger แยก  
การบันทึกค่าจาก Sidebar ต้องจัดการ trigger ให้อัตโนมัติ

ถ้า trigger ทำงานผิดพลาด:

- ต้องบันทึก error ลง `Log`
- ถ้ามีอีเมลในช่อง To หรือ admin recipient ที่ตั้งค่าไว้ ให้ส่งอีเมลแจ้ง error ไปยังผู้รับที่ตั้งค่าไว้
- ไม่ต้องสร้างระบบแจ้งเตือนแอดมินแยกต่างหาก
- ไม่ต้องใช้บริการภายนอก

---

## 5. Sidebar Requirements

ต้องมี Sidebar ภาษาไทยทั้งหมด

Sidebar ต้องเปิดจากเมนูใน Google Sheet

ชื่อเมนู:

- `ตั้งค่าแจ้งเตือน`

Sidebar ต้องมีองค์ประกอบดังนี้:

1. Slider สำหรับปรับจำนวนวันแจ้งเตือนล่วงหน้าของ `Due`
   - ค่าเริ่มต้น 30
   - ช่วง 1-60 วัน

2. Slider สำหรับปรับจำนวนวันแจ้งเตือนล่วงหน้าของ `Chq. Date`
   - ค่าเริ่มต้น 1
   - ช่วง 1-60 วัน

3. ช่องกรอกอีเมลผู้รับ แยก 3 ช่อง
   - ช่อง To สำหรับผู้รับหลัก
   - ช่อง CC
   - ช่อง BCC
   - แต่ละช่องรองรับหลายอีเมล
   - ให้คั่นอีเมลหลายรายการด้วย comma `,`
   - ผู้ใช้สามารถเพิ่มหรือลดอีเมลเองได้ในแต่ละช่อง
   - ระบบต้องบันทึกค่า To, CC, BCC แยกกันใน `PropertiesService`

4. ช่องเลือกเวลาแจ้งเตือน
   - ค่าเริ่มต้น 09:00 และ 13:00
   - รองรับการแก้ไขเวลาจาก Sidebar

5. ปุ่มบันทึกการตั้งค่า

6. ปุ่มทดสอบส่งอีเมล
   - เรียกใช้ฟังก์ชัน `sendTestEmail`

7. ปุ่มเปิด/ปิดระบบแจ้งเตือนอัตโนมัติ

8. แสดงค่าที่เคยตั้งไว้ล่าสุด

9. แสดงสถานะว่า trigger อัตโนมัติเปิดอยู่หรือไม่

10. มีข้อความแนะนำการใช้งานภาษาไทย

---

## 6. Email Recipients

ในเวอร์ชันแรก ให้กำหนดผู้รับอีเมลจาก Sidebar เท่านั้น และบันทึกค่าด้วย `PropertiesService`

ระบบต้องมีช่องแยก:

- To
- CC
- BCC

ยังไม่ต้องอ่านอีเมลผู้รับจากแต่ละแถวในชีต `DATA`  
ยังไม่ต้องสร้างชีต `Settings` เว้นแต่จำเป็นต่อการใช้งานภายหลัง

ระบบต้องรองรับอีเมลหลายคนในแต่ละช่อง โดยคั่นด้วย comma `,`

ห้ามบังคับให้กรอกอีเมลเริ่มต้นในโค้ด

ข้อความแจ้งเตือนเมื่อพบอีเมลผิดพลาด:

`อีเมลมีความผิดพลาดกรุณาตรวจสอบข้อมูลจากไฟล์ google sheet โดยตรงและติดต่อผู้ดูแลระบบ`

ต้องใช้ข้อความที่แก้แล้วนี้ในทุกจุดที่เกี่ยวข้อง เช่น Sidebar, Log, และ email warning

### 6.1 Domain Restriction

Domain restriction ต้องใช้กับอีเมลทุกช่อง ได้แก่:

- To
- CC
- BCC

อนุญาตเฉพาะอีเมลที่ลงท้ายด้วย:

- `@planbmedia.co.th`

ถ้าอีเมลอยู่นอก domain:

- ให้ข้ามเฉพาะอีเมลนั้น
- ต้องบันทึกลง `Log` เป็น `SKIPPED_INVALID_DOMAIN`
- ถ้ามีอีเมลที่ถูกข้าม ให้เพิ่ม warning ในเนื้อหาอีเมลหรือ Log
- ห้ามทำให้รายการแจ้งเตือนทั้งหมดล้มเหลวเพราะอีเมลบางรายการอยู่นอก domain

### 6.2 Email Validation Rules

กติกาการตรวจอีเมล:

- ตอนบันทึก settings จาก Sidebar ไม่ต้อง validate รูปแบบอีเมลอย่างเข้มงวด
- ตอนส่งอีเมลจริง ต้องตรวจสอบเบื้องต้นว่าเป็นอีเมลที่สามารถส่งได้
- ต้องตรวจ domain ว่าลงท้ายด้วย `@planbmedia.co.th`
- ถ้าอีเมลผิดรูปแบบหรืออยู่นอก domain ให้ข้ามเฉพาะอีเมลดังกล่าว
- ห้ามทำให้รายการแจ้งเตือนทั้งหมดล้มเหลวเพราะอีเมลบางรายการผิด

---

## 7. Email Content

หัวข้ออีเมลหลัก:

`แจ้งเตือน: Vendor ที่จะถึงครบกำหนดเพื่อดำเนินการล่วงหน้า`

ระบบต้องส่งอีเมลรวมหลายรายการในฉบับเดียว

เนื้อหาอีเมลต้องเป็น plain text

ข้อมูลในอีเมลต้องแสดงเป็นตาราง plain text โดยใช้ข้อมูลจากคอลัมน์:

- `No`
- `Vendor name`
- `Amount/Month`
- `PR No`
- `PO No`
- `Epicore Code`
- `Media Location`

ต้องใส่ข้อมูลเพิ่มเติม:

- ประเภทการแจ้งเตือน เช่น `Due` หรือ `Chq. Date`
- วันที่ครบกำหนด
- จำนวนวันที่เหลือ
- หมายเลขแถวใน Google Sheet
- ลิงก์ไปยัง Google Sheet

หากมีทั้งรายการ `Due` และ `Chq. Date` ในรอบเดียวกัน ให้แยกหัวข้อย่อยในอีเมล เช่น:

1. รายการที่ใกล้ถึงกำหนดทำจ่าย
2. รายการที่ต้องไปรับเช็ค
3. Warning เช่น รายการที่ไม่มี `Due`

ตัวอย่างรูปแบบตาราง plain text:

```text
No | Vendor name | Amount/Month | PR No | PO No | Epicore Code | Media Location | Row
---|-------------|--------------|-------|-------|--------------|----------------|----
1  | ABC Co.,Ltd | 10,000       | PR001 | PO001 | EP001        | Bangkok        | 12
```

---

## 8. Logging Requirements

ต้องมีชีต Log สำหรับบันทึกประวัติการทำงาน

ให้ใช้ชื่อชีตสำหรับบันทึกประวัติเป็น:

- `Log`

ห้ามสร้างชีตชื่อ `Logs` เว้นแต่ผู้ใช้เปลี่ยน requirement ภายหลัง

ต้องบันทึกข้อมูลอย่างน้อย:

- วันที่และเวลาที่ทำงาน
- ประเภทการแจ้งเตือน เช่น `Due`, `Chq. Date`, `Test`, `Error`, `Warning`
- ผู้รับอีเมล
- หมายเลขแถว
- ค่า `No`
- ค่า `Vendor name`
- วันที่ที่เกี่ยวข้อง
- สถานะการส่ง เช่น:
  - `SUCCESS`
  - `SUCCESS_AFTER_RETRY`
  - `FAILED`
  - `SKIPPED`
  - `SKIPPED_INVALID_DOMAIN`
  - `SKIPPED_EMPTY_CHQ_DATE`
  - `WARNING_MISSING_DUE`
- Error message ถ้ามี
- จำนวนครั้งที่แจ้งเตือน

ถ้าส่งอีเมลไม่สำเร็จ:

- ให้ retry 1 ครั้ง
- ถ้า retry สำเร็จ ให้บันทึก Log เป็น `SUCCESS_AFTER_RETRY`
- ถ้า retry แล้วยังล้มเหลว ให้บันทึก Log เป็น `FAILED`
- ต้องบันทึก error message ลง `Log`
- ห้าม retry แบบไม่จำกัดรอบ เพื่อป้องกันการส่งซ้ำและปัญหา quota

ถ้า Gmail quota เกิน:

- ไม่ต้องทำ action เพิ่มเติม
- ให้บันทึกลง `Log` ว่าเกิน quota

อีเมลถือเป็นข้อมูลส่วนบุคคล แต่สามารถแสดงอีเมลใน Log ได้

---

## 9. Settings Storage

ให้ใช้ `PropertiesService` สำหรับเก็บค่าตั้งค่า เช่น:

- จำนวนวันแจ้งเตือนล่วงหน้าของ `Due`
- จำนวนวันแจ้งเตือนล่วงหน้าของ `Chq. Date`
- รายชื่อ To
- รายชื่อ CC
- รายชื่อ BCC
- เวลาแจ้งเตือน
- สถานะเปิด/ปิดระบบแจ้งเตือน
- สถานะ trigger

ต้องบันทึกค่า To, CC, BCC แยกกันใน `PropertiesService`

ไม่จำเป็นต้องมีชีต `Settings` ในเวอร์ชันแรก เว้นแต่จำเป็นต่อการใช้งานภายหลัง

---

## 10. Error Handling

ถ้าไม่มีชีต `DATA`:

- ให้แจ้ง error
- ไม่ต้องสร้างชีตใหม่
- บันทึก error ลง `Log` ถ้าสามารถเข้าถึงหรือสร้างชีต `Log` ได้

ถ้าคอลัมน์ไม่ครบ:

- ให้หยุดทำงานอย่างปลอดภัย
- บันทึก error ลง `Log`
- ไม่ต้องสร้าง header ใหม่ใน `DATA`

ถ้าวันที่ไม่ถูกต้อง:

- ให้ข้ามรายการนั้น
- แจ้งเตือนผู้ใช้งานผ่านอีเมลหรือบันทึกใน Log ตามความเหมาะสม

ถ้าอีเมลไม่ถูกต้อง:

- ให้ข้ามเฉพาะอีเมลดังกล่าว
- บันทึกลง Log
- เพิ่มข้อความแจ้งเตือนตามที่กำหนด

ถ้าส่งเมลล้มเหลว:

- retry 1 ครั้ง
- ถ้ายังล้มเหลว ให้บันทึก error ลง `Log`

ถ้า trigger ทำงานผิดพลาด:

- ต้องบันทึก error ลง `Log`
- ถ้ามีอีเมลในช่อง To หรือ admin recipient ที่ตั้งค่าไว้ ให้ส่งอีเมลแจ้ง error ไปยังผู้รับที่ตั้งค่าไว้
- ไม่ต้องสร้างระบบแจ้งเตือนแอดมินแยกต่างหาก

---

## 11. Code Structure

ให้แยกไฟล์ Apps Script ดังนี้:

- `Code.gs`
- `Sidebar.html`
- `EmailService.gs`
- `TriggerService.gs`
- `SettingsService.gs`

หากจำเป็นสามารถเพิ่มไฟล์เสริมได้ เช่น:

- `LogService.gs`
- `SheetService.gs`
- `Constants.gs`
- `DateService.gs`

ต้องแยก logic ออกจาก UI อย่างชัดเจน

`Sidebar.html` รับผิดชอบเฉพาะ UI และการเรียก `google.script.run`

Apps Script `.gs` files รับผิดชอบ business logic ทั้งหมด

---

## 12. Coding Standards

ต้องใช้ naming convention แบบ camelCase

ต้องมี constants สำหรับ:

- ชื่อชีต
- ชื่อคอลัมน์
- ค่า default settings
- timezone
- domain ที่อนุญาต
- ชื่อ property keys
- ชื่อ trigger handler
- log status constants

ต้องเขียน JSDoc ให้ทุกฟังก์ชัน

ห้ามใช้ library ภายนอก

ทุกครั้งที่อ่าน header จาก Google Sheet ต้องเรียกใช้ `normalizeHeader(header)` ก่อนนำไปสร้าง column index map หรือ validate required columns

ต้องเขียนโค้ดให้อ่านง่าย แยกหน้าที่ชัดเจน และเหมาะกับการคัดลอกไปวางใน Google Apps Script Editor

---

## 13. Required Functions

ควรมีฟังก์ชันหลักอย่างน้อยดังนี้:

### Code.gs

- `onOpen()`
- `showSidebar()`
- `runScheduledReminder()`
- `sendTestEmail()`
  - Wrapper function
  - เรียกใช้ `EmailService.sendTestEmail()` หรือฟังก์ชัน test email logic ใน `EmailService.gs`

### SettingsService.gs

- `getSettings()`
- `saveSettings(settings)`
- `getDefaultSettings()`
- `setReminderSystemEnabled(isEnabled)`
- `isReminderSystemEnabled()`

### TriggerService.gs

- `syncReminderTriggers(settings)`
- `deleteExistingReminderTriggers()`
- `hasActiveReminderTrigger()`
- `toggleReminderSystem(isEnabled)`

กติกาของ `toggleReminderSystem(isEnabled)`:

- ถ้า `isEnabled = true`
  - บันทึกสถานะเปิดระบบลง `PropertiesService`
  - สร้างหรือ sync trigger ตามเวลาที่ตั้งค่าไว้
  - ต้องป้องกัน trigger ซ้ำ

- ถ้า `isEnabled = false`
  - บันทึกสถานะปิดระบบลง `PropertiesService`
  - ลบ reminder trigger เดิมออกทั้งหมด
  - ไม่ลบข้อมูล settings อื่น เช่น วันแจ้งเตือน, เวลาแจ้งเตือน, To, CC, BCC

### EmailService.gs

- `sendReminderEmail(reminderPayload)`
- `buildReminderEmailBody(reminders)`
- `sendTestEmail()`
  - เจ้าของ business logic จริงสำหรับการส่งอีเมลทดสอบ
- `filterValidRecipients(recipients)`
- `sendEmailWithRetry(emailPayload)`

### LogService.gs

- `appendLog(logEntry)`
- `appendErrorLog(error, context)`
- `appendWarningLog(warningEntry)`
- `hasChqDateReminderAlreadySent(rowIdentifier)`

### SheetService.gs

- `normalizeHeader(header)`
  - รับค่า header จาก Google Sheet
  - แปลง line break และ carriage return เป็นช่องว่าง
  - รวมช่องว่างหลายตัวให้เหลือช่องว่างเดียว
  - trim ช่องว่างหัวท้าย
  - คืนค่า normalized header สำหรับใช้จับคู่ชื่อคอลัมน์
- `getDataRows()`
- `getColumnIndexMap(sheet)`
- `validateRequiredColumns(columnMap)`
- `getSpreadsheetUrl()`

### DateService.gs

- `parseSheetDate(value)`
- `calculateDaysUntil(targetDate, today)`
- `isDateWithinReminderWindow(targetDate, daysBefore)`

### หมายเหตุเกี่ยวกับ `sendTestEmail()`

- `sendTestEmail()` ใน `Code.gs` เป็นเพียง wrapper function สำหรับให้ Sidebar หรือเมนูเรียกใช้งาน
- business logic จริงของการสร้าง payload, ตรวจสอบผู้รับ, สร้างเนื้อหาอีเมล, ส่งอีเมล และเขียน Log ต้องอยู่ใน `EmailService.gs`
- ห้ามเขียน business logic หลักซ้ำใน `Code.gs`

---

## 14. Reminder Logic Details

### Due Logic

ให้เลือกแถวที่เข้าเงื่อนไข:

- มีค่า `Due`
- วันที่ `Due` อยู่ในช่วงแจ้งเตือนล่วงหน้าตามค่าที่ตั้งไว้
- `Status Payment` ไม่ใช่ `เบิกแล้ว`
- ถ้า `daysUntil = 0` ให้แจ้งเตือน
- ถ้า `daysUntil < 0` ไม่ต้องแจ้งเตือน
- แจ้งซ้ำได้ทุกวันจนกว่า `Status Payment` เป็น `เบิกแล้ว`

ถ้า `Due` ว่าง:

- ไม่รวมในอีเมล Due ปกติ
- บันทึก `WARNING_MISSING_DUE` ลง `Log`
- รวมในส่วน Warning ของอีเมล ถ้ามีผู้รับตั้งค่าไว้

### Chq. Date Logic

ให้เลือกแถวที่เข้าเงื่อนไข:

- มีค่า `Chq. Date`
- วันที่ `Chq. Date` อยู่ในช่วงแจ้งเตือนล่วงหน้าตามค่าที่ตั้งไว้
- ค่าเริ่มต้นคือ 1 วัน
- ถ้า `daysUntil = 0` ให้แจ้งเตือน
- ถ้า `daysUntil < 0` ไม่ต้องแจ้งเตือน
- ไม่ต้องแจ้งซ้ำหลังจากส่งไปแล้ว

ถ้า `Chq. Date` ว่าง:

- ให้ข้าม
- ไม่ถือเป็น error
- ไม่ต้องแจ้งเตือน
- ไม่ต้อง retry
- จะ log เป็น `SKIPPED_EMPTY_CHQ_DATE` ได้ แต่ไม่บังคับ

---

## 15. Test Requirements

ต้องมีปุ่มทดสอบส่งอีเมลจาก Sidebar

ฟังก์ชันทดสอบ:

- `sendTestEmail()`

การทดสอบต้องส่งอีเมลจริงไปยังผู้รับที่ตั้งไว้ใน Sidebar

กรณีที่ควรรองรับ:

1. `Due` อีก 30 วัน
2. `Due` อยู่ในช่วงที่ตั้งค่าจาก slider
3. `Due` เลยกำหนดแล้ว
4. `Status Payment` เป็น `เบิกแล้ว`
5. `Chq. Date` อีก 1 วัน
6. `Chq. Date` ว่าง
7. มีหลายรายการที่ต้องแจ้งในวันเดียวกัน
8. มีอีเมลหลายคนคั่นด้วย comma
9. มีอีเมลนอก domain `@planbmedia.co.th`
10. Gmail quota error
11. ขาดชีต `DATA`
12. ขาดคอลัมน์สำคัญ
13. `Due` ว่าง และต้องถูกบันทึกเป็น warning
14. `daysUntil = 0` ต้องแจ้งเตือน
15. `daysUntil < 0` ต้องไม่แจ้งเตือน
16. ปิดระบบแจ้งเตือนอัตโนมัติจาก Sidebar แล้ว trigger ต้องถูกลบ
17. เปิดระบบแจ้งเตือนอัตโนมัติจาก Sidebar แล้ว trigger ต้องถูกสร้างใหม่
18. มี trigger ซ้ำ ระบบต้องลบหรือป้องกันไม่ให้ซ้ำ
19. มี To, CC, BCC หลายรายการคั่นด้วย comma
20. มีอีเมลผิดใน CC หรือ BCC ต้องข้ามเฉพาะอีเมลนั้น
21. ส่งอีเมลไม่สำเร็จ ต้อง retry 1 ครั้ง
22. retry แล้วยังล้มเหลว ต้องบันทึก `FAILED` ลง `Log`
23. trigger error ต้องบันทึกลง `Log`
24. Header มี line break เช่น `Status\nPayment` ต้องจับคู่เป็น `Status Payment` ได้
25. Header มีช่องว่างแทรก เช่น `Rental \nYear` ต้องจับคู่เป็น `Rental Year` ได้
26. Header มีหลายช่องว่าง เช่น `Accrued \n Date` ต้องจับคู่เป็น `Accrued Date` ได้
27. Required columns ต้อง validate จาก normalized header เท่านั้น

---

## 16. Out of Scope

ห้ามทำสิ่งต่อไปนี้ในเวอร์ชันแรก:

- ไม่ใช้ SendGrid
- ไม่ใช้ Slack
- ไม่ใช้ LINE Notify
- ไม่สร้าง Web App
- ไม่แก้โครงสร้าง Google Sheet `DATA` เดิมโดยอัตโนมัติ
- ไม่ติดตั้ง package หรือ library ภายนอก
- ไม่สร้างระบบ permission ซับซ้อน
- ไม่สร้าง database ภายนอก
- ไม่อ่านอีเมลผู้รับจากแต่ละแถวในชีต `DATA`
- ไม่สร้างชีต `Settings` เว้นแต่จำเป็นในอนาคต

---

## 17. User Interface Language

ทุกข้อความใน Sidebar ต้องเป็นภาษาไทย

ข้อความ error ที่แสดงต่อผู้ใช้ควรเป็นภาษาไทย

ชื่อฟังก์ชันและตัวแปรในโค้ดให้ใช้ภาษาอังกฤษแบบ camelCase

ข้อความแจ้งเตือนอีเมลผิดพลาดที่ต้องใช้:

`อีเมลมีความผิดพลาดกรุณาตรวจสอบข้อมูลจากไฟล์ google sheet โดยตรงและติดต่อผู้ดูแลระบบ`

---

## 18. Implementation Priority

ให้ CODEX พัฒนาโดยเรียงลำดับดังนี้:

1. Constants และโครงสร้างไฟล์
2. อ่านข้อมูลจากชีต `DATA`
3. สร้าง `normalizeHeader(header)` และ column index map ที่ใช้ normalized header
4. ตรวจสอบคอลัมน์ที่จำเป็นจาก normalized header
5. อ่านและบันทึก settings ด้วย `PropertiesService`
6. สร้าง Sidebar ภาษาไทย
7. สร้างช่อง To, CC, BCC แยกกันใน Sidebar
8. สร้าง logic สำหรับ Due Reminder
9. สร้าง logic สำหรับ Chq. Date Reminder
10. สร้าง email validation และ domain restriction
11. สร้าง email body แบบ plain text table
12. สร้างระบบส่งอีเมลพร้อม retry 1 ครั้ง
13. สร้าง Log sheet writer โดยใช้ชีตชื่อ `Log`
14. สร้าง trigger sync logic
15. สร้าง toggle เปิด/ปิดระบบแจ้งเตือน
16. เพิ่มปุ่ม test email
17. เพิ่ม error handling
18. ตรวจสอบ edge cases

---

## 19. Important Constraints

ระบบนี้ต้องเหมาะกับ Google Apps Script

ต้องเขียนโค้ดให้สามารถคัดลอกไปวางใน Apps Script Editor ได้ทันที

ต้องไม่ใช้ syntax หรือ dependency ที่ไม่รองรับใน Apps Script

ต้องหลีกเลี่ยงการทำงานที่ใช้เวลานานเกิน quota ของ Apps Script

ต้องใช้ `SpreadsheetApp`, `MailApp`, `PropertiesService`, และ `ScriptApp` ตามความเหมาะสม

ควรใช้ `MailApp.sendEmail()` เป็นหลัก เว้นแต่มีเหตุผลจำเป็นต้องใช้ `GmailApp`

ห้าม retry การส่งอีเมลแบบไม่จำกัดรอบ

ห้ามสร้าง trigger ซ้ำ

ห้ามใช้ชื่อชีต `Logs`

ให้ใช้ชื่อชีต `Log` เท่านั้น
