# Use Cases — ระบบนำทางผู้ป่วยในโรงพยาบาล

สรุป use case จากทุก requirement (Must/Should Have) และ role ที่ตกลงกันไว้ อ้างอิง entity ตาม
[`MODELS.md`](MODELS.md) แต่ละ use case ระบุ requirement ที่เกี่ยวข้อง (M1–M8, S1–S7) และ model ที่ถูกแตะ
เพื่อให้ตรวจสอบย้อนกลับได้ว่า requirement ไหนถูก cover ด้วย use case ไหนบ้าง

---

## Actors

| Actor | คำอธิบาย | ยืนยันตัวตนด้วย |
|---|---|---|
| **ผู้ป่วย/ญาติ (Patient)** | ผู้มารับบริการ หรือญาติที่ดูแทน | `Visit.qr_token` — **ไม่มี user account**, token ผูกกับการมาครั้งนั้นครั้งเดียว |
| **เจ้าหน้าที่เวชระเบียน/คัดกรอง (Registrar)** | ลงทะเบียนผู้ป่วยเข้ารับบริการ | `StaffUser` role=`REGISTRAR` |
| **เจ้าหน้าที่ประจำจุดบริการ (Service Staff)** | ประจำห้องตรวจ/แล็บ/เอกซเรย์/ห้องยา | `StaffUser` role=`SERVICE_STAFF` + ต้องมีแถวใน `ServicePointStaff` ผูกกับจุดบริการนั้น |
| **ผู้ดูแลระบบ (Admin)** | จัดการผังสถานที่ แม่แบบ สิทธิ์ผู้ใช้ | `StaffUser` role=`ADMIN` |
| **ผู้บริหาร (Executive)** | ดูภาพรวม/รายงาน | `StaffUser` role=`EXECUTIVE` |

**Kiosk ไม่ใช่ actor แยก** — เป็นแค่ interface อีกแบบที่ผู้ป่วยใช้แทนมือถือตัวเอง auth ด้วย `Visit.qr_token`
เดียวกัน (ผู้ป่วยเอา QR ของตัวเองไปสแกนที่เครื่อง แทนที่จะสแกนด้วยมือถือ)

---

## สรุป Use Case ต่อ Actor

### ผู้ป่วย/ญาติ

| ID | Use Case | Requirement |
|---|---|---|
| UC-P1 | ดูลำดับขั้นตอนการรักษาทั้งหมดของวันนี้พร้อมสถานะ | M4 |
| UC-P2 | ดูเส้นทางนำทางไปจุดหมายถัดไปแบบทีละก้าว | M5, M6 |
| UC-P3 | ดูคิวปัจจุบันและเวลารอโดยประมาณของจุดบริการ | S1 |
| UC-P4 | สแกน QR เพื่ออัปเดตตำแหน่งปัจจุบัน (ด้วยมือถือ หรือที่ kiosk) | S2 |
| UC-P5 | เช็กระยะห่างจากคิวของตัวเอง (polling) | S6 |
| UC-P6 | สลับภาษาไทย/อังกฤษ | S4 |
| UC-P7 | เปิดโหมดการเข้าถึงพิเศษ (ขยายตัวอักษร / เลี่ยงบันได) | S5 |

### เจ้าหน้าที่เวชระเบียน/คัดกรอง

| ID | Use Case | Requirement |
|---|---|---|
| UC-R1 | ลงทะเบียนผู้ป่วยเข้ารับบริการวันนี้ + เลือกแม่แบบเส้นทางการรักษา | M3 |

### เจ้าหน้าที่ประจำจุดบริการ

| ID | Use Case | Requirement |
|---|---|---|
| UC-S1 | เรียกคิว | M7 |
| UC-S2 | บันทึกว่าผู้ป่วยมาถึงแล้ว (เริ่มขั้นตอน) | M7 |
| UC-S3 | บันทึกว่าขั้นตอนเสร็จสิ้น | M7 |
| UC-S4 | ข้ามขั้นตอน | M4, M7 |
| UC-S5 | แทรกขั้นตอนเพิ่มเติมนอกแผนเดิม | M7 |

### ผู้ดูแลระบบ

| ID | Use Case | Requirement |
|---|---|---|
| UC-A1 | จัดการอาคาร/ชั้น/จุดบริการ | M1 |
| UC-A2 | อัปโหลดภาพผังพื้น + คาลิเบรตสเกล | M1 |
| UC-A3 | ลาก Node/Edge สร้างเส้นทางเชื่อมทับภาพผังพื้น | M1, M6 |
| UC-A4 | สร้าง/แก้ไขแม่แบบเส้นทางการรักษา (พร้อมลำดับและเงื่อนไขก่อนหลัง) | M2 |
| UC-A5 | กำหนดสิทธิ์ผู้ใช้งานและจุดบริการที่รับผิดชอบ | M8 |
| UC-A6 | จัดการตารางเวลาเปิดให้บริการของแต่ละจุด | (data ประกอบ S1) |

### ผู้บริหาร

| ID | Use Case | Requirement |
|---|---|---|
| UC-E1 | ดูจุดคอขวดและเวลารอเฉลี่ยรายจุดบริการ | S7 |
| UC-E2 | ดูเวลาเฉลี่ยที่ผู้ป่วยอยู่ในโรงพยาบาลต่อการมาหนึ่งครั้ง | S7 |

### ระดับระบบ (ใช้ร่วมกันหลาย actor)

| ID | Use Case | Requirement |
|---|---|---|
| UC-SYS1 | คำนวณเส้นทางสั้นที่สุดระหว่างสองจุด (คิดสิทธิ์รถเข็น) | M5, M6, S5 |
| UC-SYS2 | ยืนยันตัวตนและจำกัดสิทธิ์ตามบทบาท | M8 |

---

## รายละเอียด Use Case หลัก

### UC-R1: ลงทะเบียนผู้ป่วยและเลือกแม่แบบเส้นทางการรักษา
- **Actor:** Registrar
- **Trigger:** ผู้ป่วยมาถึงจุดเวชระเบียน
- **Precondition:** มี `Patient` อยู่แล้ว (หรือสร้างใหม่ถ้าเป็นรายใหม่), มี `PathwayTemplate` ที่ `is_active=True` อย่างน้อยหนึ่งแม่แบบที่ตรงกับ `CareCategory` ของผู้ป่วย
- **Main flow:**
  1. Registrar ค้นหา/สร้าง `Patient`
  2. เลือก `PathwayTemplate` ที่เหมาะสม และระบุ `Visit.uses_wheelchair` ถ้ามี
  3. ระบบสร้าง `Visit` (status=`REGISTERED`, สุ่ม `qr_token`)
  4. ระบบ copy `TemplateStep` ทุกแถวของ template นั้นมาสร้างเป็น `VisitStep` (snapshot `sequence_order`, `service_point`, `prerequisite_steps`) ผูกกับ `Visit` ที่เพิ่งสร้าง
  5. ระบบพิมพ์/แสดง QR ของ `Visit` ให้ผู้ป่วย
- **Postcondition:** `Visit` พร้อมใช้งาน, ผู้ป่วยเห็น timeline เต็มใน UC-P1 ได้ทันที
- **Exception:** ถ้าไม่มี template ที่ active ตรงกับ care category — Registrar ต้องแจ้ง Admin ให้สร้าง/เปิดใช้ template ก่อน (ไปที่ UC-A4)

### UC-P1: ดูลำดับขั้นตอนการรักษาของวันนี้
- **Actor:** Patient (ผ่าน `qr_token`)
- **Precondition:** มี `Visit` ที่ `status` ไม่ใช่ `CANCELLED`
- **Main flow:**
  1. เปิดหน้าจอด้วย `qr_token` ของ `Visit`
  2. ระบบดึง `VisitStep` ทั้งหมดของ `Visit` เรียงตาม `sequence_order`
  3. แสดงสถานะแต่ละแถว (`PENDING`/`IN_PROGRESS`/`DONE`/`SKIPPED`) และไฮไลต์ขั้นตอนที่ "พร้อมเริ่ม" (ทุกตัวใน `prerequisite_steps` เป็น `DONE`)
  4. ถ้ามีหลายขั้นตอนพร้อมเริ่มพร้อมกัน (fan-out เช่น เจาะเลือด/เอกซเรย์) แสดงทั้งคู่เป็นตัวเลือกให้ผู้ป่วยไปจุดไหนก่อนก็ได้
- **Postcondition:** ผู้ป่วยรู้ว่าต้องไปที่ไหนต่อ
- **Related:** M4

### UC-P2: ดูเส้นทางนำทางไปจุดหมายถัดไป
- **Actor:** Patient
- **Precondition:** ทราบ `Visit.current_node` (จากการสแกนล่าสุด หรือ default เป็นจุดเวชระเบียน/ทางเข้า) และ `service_point` ปลายทางจาก `VisitStep` ที่เลือก
- **Main flow:**
  1. ผู้ป่วยกด "นำทาง" จากขั้นตอนที่เลือกในหน้า UC-P1
  2. ระบบเรียก UC-SYS1 โดยส่ง `current_node`, `service_point` ปลายทาง และ `Visit.uses_wheelchair`
  3. แสดงคำสั่งเดินทีละก้าว พร้อมระยะทางรวมและเวลาโดยประมาณ
- **Related:** M5, M6

### UC-P4: สแกน QR เพื่ออัปเดตตำแหน่งปัจจุบัน
- **Actor:** Patient
- **Precondition:** มี `Node.location_qr_code` ติดอยู่ที่จุดนั้น (สติกเกอร์ หรือจอ kiosk ที่ `node_type=KIOSK`)
- **Main flow (มือถือตัวเอง):**
  1. ผู้ป่วยสแกน `location_qr_code` ของ node ด้วยกล้องมือถือ
  2. ระบบตั้ง `Visit.current_node` เป็น node นั้น (จับคู่ `Visit` จาก `qr_token` ที่อยู่ในหน้าจอ/session ปัจจุบัน)
- **Main flow ทางเลือก (kiosk, ไม่มี/ไม่ถนัดใช้มือถือ):**
  1. ผู้ป่วยเอา QR ของตัวเอง (`Visit.qr_token`) ไปสแกนที่เครื่อง kiosk ซึ่งตัวเครื่องรู้ตำแหน่งของตัวเอง (node ที่ `device_code` นั้นติดตั้งอยู่)
  2. ระบบตั้ง `Visit.current_node` เป็น node ของ kiosk นั้น แล้วแสดงเส้นทาง (UC-P2) บนจอ kiosk ทันที
- **Related:** S2

### UC-S3: บันทึกว่าขั้นตอนเสร็จสิ้น
- **Actor:** Service Staff
- **Precondition:** `VisitStep.status = IN_PROGRESS` และ staff คนนั้นมีสิทธิ์ (`ServicePointStaff` ผูกกับ `service_point` ของ step นี้)
- **Main flow:**
  1. Staff กด "เสร็จสิ้น" บน `VisitStep`
  2. ระบบตั้ง `status=DONE`, `completed_at=now`
  3. ระบบหา `VisitStep` อื่นที่มี step นี้อยู่ใน `prerequisite_steps` แล้วเช็กว่า prerequisite ครบ `DONE` ทุกตัวหรือยัง — ถ้าครบ ให้ปลดล็อกเป็น "พร้อมเริ่ม" (ทำได้ตั้งแต่ 1 ถึงหลายขั้นตอนพร้อมกัน กรณี fan-out)
  4. บันทึก `AuditLog` (action=`complete_step`)
- **Postcondition:** ผู้ป่วยเห็นขั้นตอนถัดไป (หรือหลายขั้นตอนถัดไป) ปลดล็อกทันทีในหน้า UC-P1
- **Related:** M7

### UC-S5: แทรกขั้นตอนเพิ่มเติมนอกแผนเดิม
- **Actor:** Service Staff
- **Precondition:** พบว่าผู้ป่วยต้องไปทำขั้นตอนที่ไม่ได้อยู่ใน `PathwayTemplate` ตั้งแต่แรก
- **Main flow:**
  1. Staff เลือกจุดบริการปลายทางที่จะแทรก
  2. ระบบสร้าง `VisitStep` ใหม่ (`is_planned=False`) กำหนด `prerequisite_steps` เอง (ปกติคือ step ปัจจุบันที่กำลังทำอยู่)
  3. step ที่เหลือใน pathway เดิมไม่ถูกกระทบ (sequence_order/prerequisite เดิมยังอยู่ครบ)
- **Postcondition:** ผู้ป่วยเห็น timeline อัปเดตทันทีโดยไม่ต้องกลับไปเวชระเบียน
- **Related:** M7

### UC-A3: ลาก Node/Edge สร้างเส้นทางเชื่อมทับภาพผังพื้น
- **Actor:** Admin
- **Precondition:** ทำ UC-A2 (อัปโหลด `Floor.plan_image` + คาลิเบรต `plan_scale_m_per_px`) เสร็จแล้ว
- **Main flow:**
  1. เปิดเครื่องมือแก้ไขผัง เลือกชั้นที่จะแก้ไข ระบบโหลด `plan_image` เป็น background
  2. คลิกวาง `Node` (ระบุ `node_type`, ถ้าเป็น `SERVICE_POINT` กรอก `service_point_code`/`department_th`/`department_en`)
  3. ลากเชื่อมสอง `Node` เพื่อสร้าง `Edge` — ระบบคำนวณ `distance_m` อัตโนมัติจาก `pos_x`/`pos_y` × `plan_scale_m_per_px` (แก้ไขเองได้), เลือก `edge_type`, ติ๊ก `wheelchair_accessible`/`is_bidirectional`
  4. บันทึก แล้วรันตรวจ connectivity (ทุก service point เข้าถึงได้จากทางเข้า/ชั้นอื่นผ่าน node ลิฟต์/บันได)
- **Related:** M1, M6

### UC-A4: สร้าง/แก้ไขแม่แบบเส้นทางการรักษา
- **Actor:** Admin
- **Main flow:**
  1. เลือกหรือสร้าง `CareCategory`
  2. สร้าง `PathwayTemplate` ใหม่ (หรือแก้ไขที่มีอยู่ — ถ้าแก้ template ที่มี `Visit` อ้างอิงอยู่แล้ว ให้สร้างเป็นเวอร์ชันใหม่แทนการแก้ทับ เพราะ `VisitStep` เป็น snapshot แยกอยู่แล้ว ไม่กระทบ visit เก่า)
  3. เพิ่ม `TemplateStep` ทีละขั้น เลือก `service_point`, ตั้ง `sequence_order` (stage), เลือก `prerequisite_steps` (รองรับทั้งเรียงเดี่ยว และแตกเป็นหลายทางขนานกัน)
  4. ตั้ง `is_active=True` เมื่อพร้อมใช้งานจริง
- **Related:** M2

### UC-E1 / UC-E2: หน้าสรุปผู้บริหาร
- **Actor:** Executive
- **Main flow:**
  1. เลือกช่วงวันที่ที่ต้องการดู
  2. ระบบ aggregate `VisitStep.completed_at - started_at` แยกตาม `service_point` → เวลารอเฉลี่ยรายจุด และจุดที่ backlog (`QueueTicket status=WAITING`) สูงสุด = จุดคอขวด
  3. ระบบ aggregate `Visit`: เวลาที่ `VisitStep` แรกเริ่ม (`started_at` ต่ำสุด) ถึง `VisitStep` สุดท้ายเสร็จ (`completed_at` สูงสุด) ต่อ `Visit` → ค่าเฉลี่ยเวลาที่ผู้ป่วยอยู่ในโรงพยาบาล
- **Related:** S7

### UC-SYS1: คำนวณเส้นทางสั้นที่สุดระหว่างสองจุด
- **Trigger:** ถูกเรียกจาก UC-P2 (ผู้ป่วยขอเส้นทาง) หรือ UC-A3 (admin preview ตรวจสอบ)
- **Main flow:**
  1. รับ `from_node`, `to_node`, `wheelchair_required` (bool)
  2. Query กราฟจาก `Node`/`Edge` ทั้งหมด — ถ้า `wheelchair_required=True` ตัด `Edge.wheelchair_accessible=False` ออกก่อน และตัด `Edge` ที่ `is_bidirectional=False` ในทิศที่เดินย้อนไม่ได้
  3. รัน Dijkstra หา path ที่ผลรวม `distance_m` (หรือ `walk_time_sec`) น้อยที่สุด
  4. แปลงลำดับ `Edge` เป็นข้อความทีละก้าว โดยเทียบมุม (bearing) ของ edge ขาเข้า/ขาออกที่แต่ละ node เพื่อสร้างคำสั่ง "เลี้ยวซ้าย/ขวา/ตรงไป"
- **Postcondition:** คืนลิสต์คำสั่งเดิน +ระยะทางรวม + เวลารวม
- **Related:** M5, M6

### UC-SYS2: ยืนยันตัวตนและจำกัดสิทธิ์ตามบทบาท
- **Main flow:**
  - **ฝั่งเจ้าหน้าที่:** login ด้วย `StaffUser` (username/password) → DRF permission class เช็ก `role` ก่อนอนุญาต endpoint (เช่น เฉพาะ `ADMIN` แก้ `PathwayTemplate` ได้, เฉพาะ `SERVICE_STAFF` ที่มีแถวใน `ServicePointStaff` ของจุดนั้นถึงเรียกคิว/ปิด step ที่จุดนั้นได้)
  - **ฝั่งผู้ป่วย:** ไม่ login ด้วย username — ใช้ `Visit.qr_token` เป็น bearer token ชั่วคราว ผูกกับ `Visit` เดียว จึงเห็นได้แค่ข้อมูลของตัวเองโดยธรรมชาติ (query ทุกอันกรองด้วย `Visit` ที่ token ชี้ถึงเท่านั้น) token ใช้ไม่ได้อีกเมื่อ `Visit.status` เป็น `COMPLETED`/`CANCELLED`
- **Related:** M8

---

## Requirement ที่ยังไม่มี use case รองรับตอนนี้

- **BLE beacon** (extension ที่ตกลงว่ายังไม่ออกแบบ) — จะมี use case เพิ่มตอนเข้าสู่รอบออกแบบจริง
- **S3 (แสดง Floor Plan พร้อมลากเส้นทาง)** ไม่แยก use case ต่างหาก เพราะเป็นการ "แสดงผล" ของ UC-P2/UC-SYS1 บน `Floor.plan_image` ไม่ใช่ use case ที่มี actor ทำ action ใหม่
