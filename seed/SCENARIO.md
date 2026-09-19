# Demo Scenario — สคริปต์สำหรับผู้นำเสนอ

สคริปต์นี้เขียนมาเพื่อให้ presenter เดินเรื่องได้ภายใน ~15 นาที โชว์ฟีเจอร์หลักทั้ง 3 portal (Admin / Patient / Kiosk) พร้อมยก use case ที่ต่างกันให้เห็นว่าระบบตอบโจทย์จริง

## 0. Setup (ก่อนขึ้นเวที ~5 นาที)

เปิด 3 terminal:

```bash
# Terminal 1 — backend
cd /Users/mee/hackathon/backend
source venv/bin/activate
python manage.py runserver 8000
```

```bash
# Terminal 2 — frontend
cd /Users/mee/hackathon/frontend
npm run dev
```

```bash
# Terminal 3 — standby (โหลด seed ใหม่ถ้าจำเป็น)
cd /Users/mee/hackathon/backend && source venv/bin/activate
python ../seed/load_seed.py
```

เปิด browser tabs ที่จะใช้ทั้งหมด 4 tab ไว้ก่อน:
1. **Admin Portal** — `http://localhost:3000/admin/facility`
2. **Patient Portal (TH)** — `http://localhost:3000/visit/demo-qr-vj-thai-patient01-visit01-20260919-0000000000`
3. **Patient Portal (EN)** — `http://localhost:3000/visit/demo-qr-vj-en-patient03-visit01-20260919-000000000000`
4. **Kiosk** — `http://localhost:3000/kiosk/KIOSK-OPD1-01`

> เคล็ดลับ: เปิด 4 tab เรียงไว้ สลับไปมาได้เร็ว ๆ ระหว่างเล่า

---

## 1. Opening (1 นาที)

> **พูด:** "โรงพยาบาลขนาดใหญ่อย่างวชิระ ผู้ป่วยนอกวันละหลายพันคน ปัญหาคือ **คนไข้หลงทาง** — หาห้องตรวจไม่เจอ ต้องถามเจ้าหน้าที่ซ้ำ ๆ ระบบเราช่วยให้คนไข้รู้ว่า **ต้องไปที่ไหน ต่อไป และเดินทางอย่างไร** — รองรับภาษาไทย/อังกฤษ และรถเข็นด้วย"

ชี้ไปที่ภาพรวม 4 portal ที่เปิดไว้ บอกว่าจะเดินดูทีละส่วน

---

## 2. Act 1 — Admin Portal (3 นาที)

**สลับไปที่ tab Admin Portal** (`/admin/facility`)

### 2.1 โชว์โครงสร้างอาคาร (1 นาที)
> **พูด:** "ฝั่ง admin เริ่มจากแผนที่อาคาร"

คลิกเมนูซ้าย: **Facility → Buildings** → เลือก "อาคารผู้ป่วยนอก (OPD)"
- ชี้ floor plan PNG ของชั้น 1 ที่แสดงเป็น background
- ชี้ว่าจุดต่าง ๆ (Triage, Medical Records, Cashier, Pharmacy) คือ node ที่อยู่ในกราฟ
- **ชี้จุดสำคัญ:** "สังเกตว่าห้องตรวจไม่ได้ต่อตรงกับ hall — มันต้องผ่าน **corridor junction** เพื่อให้เส้นทางดูสมจริง"

คลิกเข้าไปดูทีละชั้น (2, 3, 4) ให้เห็นว่าทุกอาคารจัดการในที่เดียวกัน

### 2.2 โชว์ Pathway (1 นาที)
ไปที่ **Pathways → Templates** → คลิก "ผู้ป่วยใหม่ — ตรวจอายุรกรรมทั่วไป"
> **พูด:** "นี่คือแม่แบบการรักษา — ผู้ป่วยใหม่ต้องเดิน 7 ขั้น INFO → TRIAGE → MR → IM → LAB → (CASHIER ∥ PHARMACY)"

ชี้ให้เห็น:
- ขั้นที่ 6 กับ 7 มี **sequence_order เดียวกัน** (ทำขนานได้)
- คลิกที่ขั้น LAB ชี้ prerequisite = IM (ต้องเสร็จ IM ก่อน)

### 2.3 โชว์ Visit (1 นาที)
ไปที่ **Visits** → เลือก visit #1 (สมชาย)
> **พูด:** "visit นี้เริ่มเมื่อเช้า ตอนนี้อยู่ที่ห้องอายุรกรรมชั้น 2 — ทำเสร็จไปแล้ว 3 ขั้น รออีก 4 ขั้น"

---

## 3. Act 2 — Patient Flow ภาษาไทย (2 นาที)

**สลับไปที่ tab Patient Portal (TH)**

ที่อยู่: `http://localhost:3000/visit/demo-qr-vj-thai-patient01-visit01-20260919-0000000000`

> **พูด:** "คนไข้สแกน QR ที่ kiosk หรือเปิดลิงก์จาก SMS — เห็นข้อมูล visit ตัวเองทันที"

ชี้บนหน้าจอ:
1. **ชื่อคนไข้ + ภาษา** ที่มุมบน — ระบบเลือกภาษาไทยอัตโนมัติ (เพราะ `preferred_language=th`)
2. **Progress** — 3/7 เสร็จ
3. **"ขั้นตอนต่อไป"** — ห้องอายุรกรรม ชั้น 2 (กำลังอยู่)
4. **ปุ่ม "ดูเส้นทาง"** → แสดงแผนที่ + เข็มทิศบอกทิศ

> **พูด:** "ดูว่าตอนนี้สมชายอยู่ที่ชั้น 2 ห้องอายุรกรรม — ระบบรู้แล้วว่าขั้นต่อไปคือ lab ชั้น 2 เหมือนกัน แต่ต้องเดินผ่าน corridor"

ถ้ามีปุ่มดูเส้นทาง → คลิก → ชี้ว่าเส้นทางผ่าน **หลาย corridor junction** ไม่ใช่ตรงเข้าห้อง

---

## 4. Act 3 — Patient Flow ภาษาอังกฤษ (1 นาที)

**สลับไปที่ tab Patient Portal (EN)**

ที่อยู่: `http://localhost:3000/visit/demo-qr-vj-en-patient02-visit01-20260919-000000000000`

> **พูด:** "visit ของ James — เพิ่งลงทะเบียนเมื่อ 5 นาทีก่อน ตอนนี้ยังอยู่ที่ entrance"

ชี้:
1. ชื่อ "James William Smith" ภาษาอังกฤษ
2. UI เป็น **English อัตโนมัติ** (preferred_language=en)
3. ขั้นที่ 1 (Information Desk) ทำเสร็จแล้ว — กำลังจะเริ่มขั้น 2 (Medical Records)
4. เส้นทางแนะนำจาก Entrance → Hall → Corridor → MR

---

## 5. Act 4 — Wheelchair Accessibility (3 นาที) ★ ไฮไลท์

**สลับไปที่ tab Patient Portal (EN)** — Mary Johnson ที่ใช้รถเข็น

ที่อยู่: `http://localhost:3000/visit/demo-qr-vj-en-patient03-visit01-20260919-000000000000`

> **พูด:** "คนไข้สูงอายาใช้รถเข็น — มาทำตรวจสุขภาพประจำปี ต้องขึ้นไปชั้น 3 ที่ Wellness Center"

### 5.1 โชว์เส้นทางปัจจุบัน
- Mary ตอนนี้อยู่ที่ OPD1-MR (ชั้น 1)
- ขั้นต่อไป: OPD3-WELLNESS (ชั้น 3) — ข้าม 2 ชั้น

คลิก "ดูเส้นทาง" หรือดูที่ step description:
> **พูด:** "ระบบรู้ว่า Mary ใช้รถเข็น — ดูเส้นทาง..."

ชี้ว่าเส้นทาง **ใช้ Elevator B** ไม่ใช่ stairs (เพราะ `wheelchair_accessible=False` ที่ stairs)

### 5.2 เปรียบเทียบกับ non-wheelchair
**สลับกลับไป tab Patient Portal (TH)** — สมชาย ที่กำลังจะไป OPD2-LAB

ที่อยู่: `http://localhost:3000/visit/demo-qr-vj-thai-patient01-visit01-20260919-000000000000`

> **พูด:** "เทียบกับสมชายที่ไม่ใช้รถเข็น — เส้นทางจะต่างกัน"

### 5.3 สลับไปดู Mary อีกครั้ง + สลับกลับสมชาย

> **พูด (ตบท้าย):** "สรุปคือ — **คนเดินปกติ** ระบบจะเลือก stairs (เร็วกว่า) **คนใช้รถเข็น** ระบบจะ bypass stairs แล้วใช้ elevator แทน ทั้งหมดนี้คำนวณจาก graph ของจริง"

---

## 6. Act 5 — Kiosk (2 นาที)

**สลับไปที่ tab Kiosk**

ที่อยู่: `http://localhost:3000/kiosk/KIOSK-OPD1-01`

> **พูด:** "ที่ kiosk จริง — ผู้ป่วยเดินมาแตะ แล้วเปิดกล้องสแกน QR ตัวเอง"

ชี้:
1. หน้าจอ kiosk — มีปุ่ม **"สแกน QR"** และ **"กรอก HN"**
2. ปุ่ม "สแกน QR" จะเปิดกล้องจริง (demo ไม่มีกล้อง → ใช้ปุ่ม demo แทน)
3. คลิกปุ่ม demo / หรือใส่ QR token `demo-qr-vj-thai-patient01-visit01-20260919-0000000000` ในช่อง manual
4. ระบบโหลด visit + บอกทิศทางจาก kiosk ไปยังขั้นต่อไป

> **พูด:** "kiosk เป็นจุดกำหนด origin — เข็มทิศจะหมุนตามว่าผู้ป่วยยืนอยู่ตรงไหนในอาคาร"

---

## 7. Closing (1 นาที)

กลับมาที่ Admin Portal

> **พูด:** "สรุป — ระบบนี้ประกอบด้วย:
> - **แผนที่อาคาร** ที่ admin จัดการผ่าน UI
> - **แม่แบบการรักษา** (pathway) ที่กำหนดลำดับขั้น + prerequisite
> - **Visit** ที่ snapshot จาก template พร้อมสถานะต่อขั้น
> - **Routing engine** ที่คำนวณเส้นทางผ่าน corridor graph — รองรับ stairs/elevator/wheelchair
> - **3 portal** — admin, patient, kiosk — ใช้ data เดียวกัน"

> **"โจทย์ถัดไป"**: เพิ่ม indoor positioning (BLE beacon) เพื่อ update current_node แบบ real-time, และ push notification เมื่อใกล้ถึงคิว

---

## Appendix A — Quick URLs สำหรับเปิดตอนถามคำถาม

| Use case | URL |
|----------|-----|
| Patient TH (สมชาย) | `/visit/demo-qr-vj-thai-patient01-visit01-20260919-0000000000` |
| Patient EN (James) | `/visit/demo-qr-vj-en-patient02-visit01-20260919-000000000000` |
| Patient EN + wheelchair (Mary) | `/visit/demo-qr-vj-en-patient03-visit01-20260919-000000000000` |
| Patient TH + wheelchair (ประยูร) | `/visit/demo-qr-vj-thai-patient04-visit01-20260919-000000000000` |
| Kiosk OPD1 | `/kiosk/KIOSK-OPD1-01` |
| Kiosk ER | `/kiosk/KIOSK-ER-01` |
| Admin facility | `/admin/facility` |
| Admin pathways | `/admin/pathways` |
| Admin visits | `/admin/visits` |

## Appendix B — ถ้ามีคำถามเทคนิค

**Q: ข้อมูลเส้นทางมาจากไหน?**
A: Graph ใน DB — `Node` (44 service/vertical/kiosk/entrance + 4 corridor junction) + `Edge` (56 เส้นรวม corridor + vertical) Dijkstra คำนวณจาก `walk_time_sec` (รองรับ wheelchair filter)

**Q: ถ้าเพิ่ม service point ใหม่?**
A: เพิ่มใน Admin → Facility → Nodes หรือแก้ `seed/nodes.csv` แล้วรัน `seed/load_seed.py` ใหม่ — routing engine จะหาเส้นทางผ่าน node ใหม่อัตโนมัติ

**Q: ภาษาเปลี่ยนยังไง?**
A: `Patient.preferred_language` (th/en) — frontend ใช้ค่านี้เลือก locale ตอนโหลด visit (ดูใน `lib/locale-actions.ts`)

**Q: Real-time position update?**
A: ตอนนี้ใช้ QR scan เป็นจุดเปลี่ยน — ต่อไปจะรองรับ BLE beacon ตาม MODELS.md "ยังไม่ออกแบบ" section
