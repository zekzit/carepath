# Seed data — โรงพยาบาลวชิระ

ข้อมูลจำลองสำหรับทดสอบระบบนำทางผู้ป่วย โหลดเข้า SQLite database เพื่อใช้กับ backend (Django) และ frontend (Next.js)

## โครงสร้างไฟล์

```
seed/
├── README.md                       # เอกสารนี้
├── SCENARIO.md                     # สคริปต์สำหรับ presenter
├── generate_floor_plans.py         # สร้างภาพผังชั้น PNG จาก nodes.csv
├── load_seed.py                    # โหลด CSV ทั้งหมดเข้า DB
├── buildings.csv                   # 7 อาคาร
├── floors.csv                      # 5 ชั้น (OPD 1–4 + ER 1)
├── nodes.csv                       # 48 node (รวม corridor junction ที่บังคับให้เส้นทางเดินผ่าน)
├── edges.csv                       # 56 edge (corridor + vertical; stairs=30s, elevator=45s)
├── care_categories.csv             # 5 หมวดการรักษา
├── pathway_templates.csv           # 5 pathway template
├── template_steps.csv              # 27 template step (5+6+5+4+7)
├── template_step_prerequisites.csv # M2M prerequisite ระหว่าง template_step
├── patients.csv                    # 4 ผู้ป่วย (ไทย 2 + อังกฤษ 2; ใช้ wheel chair 2)
├── visits.csv                      # 4 visit
├── visit_steps.csv                 # 22 visit_step
├── visit_step_prerequisites.csv    # M2M prerequisite ระหว่าง visit_step
└── floor_plans/                    # ไฟล์ PNG ที่ generate_floor_plans.py สร้าง
    ├── opd_floor1.png   (1200×800, scale 0.02 m/px → ~24×16 m)
    ├── opd_floor2.png   (1200×800, scale 0.02 m/px)
    ├── opd_floor3.png   (1200×800, scale 0.02 m/px)
    ├── opd_floor4.png   (1200×800, scale 0.02 m/px)
    └── er_floor1.png    (1200×800, scale 0.025 m/px → ~30×20 m)
```

## วิธีโหลด

```bash
cd backend
source venv/bin/activate
python manage.py migrate                          # ครั้งแรกเท่านั้น

# 1. สร้างภาพผังชั้น PNG (อ่านจาก nodes.csv)
python ../seed/generate_floor_plans.py

# 2. โหลดข้อมูลทั้งหมดเข้า DB
python ../seed/load_seed.py
```

`load_seed.py` จะลบข้อมูล `facility / pathway / visits` เดิมทั้งหมดแล้วสร้างใหม่ตาม CSV (atomic transaction — ถ้าพังจะ rollback ทั้งหมด)
ไม่แตะตาราง `accounts / queues` (staff user, queue, ticket, schedule) ตามที่ตกลงกันไว้

## ข้อมูลที่โหลดเข้าไป

### อาคาร (7)
- OPD — อาคารผู้ป่วยนอก
- ER — อาคารอุบัติเหติและศูนย์หัวใจ
- LPC, MED298, OBG, BKP, NKL — อาคารอื่น ๆ ที่ยังไม่มี floor/node (สร้างเพิ่มภายหลังได้)

### Node ตามชั้น

**OPD ชั้น 1** (14 nodes) — ประชาสัมพันธ์, คัดกรอง, เวชระเบียน, การเงิน, จ่ายยา + corridor junction (J-MID, J-W, J-E) + vertical connectors + kiosk + entrance

**OPD ชั้น 2** (9 nodes) — อายุรกรรม, Lab, Pre-screening + corridor (W, E) + vertical connectors

**OPD ชั้น 3** (8 nodes) — ศัลยกรรมทั่วไป, ศัลยกรรมกระดูก, Wellness Center + Lobby corridor + vertical connectors

**OPD ชั้น 4** (8 nodes) — ตา, หู คอ จมูก, ทันตกรรม + Lobby corridor + vertical connectors

**ER ชั้น 1** (9 nodes) — Triage, Emergency Room, Heart Center, ICU + ER-MR + Mid corridor + Kiosk + Entrance

### โครงสร้าง Corridor (ทำให้ routing สมจริง)

ตามชั้นต่าง ๆ มี junction node คั่นระหว่างจุดบริการ เพื่อให้เส้นทางเดินดูเป็นธรรมชาติ (เดินเข้า corridor → ผ่าน junction → ถึงห้อง) ไม่ใช่ตรงเข้าห้องเลย

ตัวอย่าง OPD ชั้น 1:
```
ENTRANCE → HALL → J-MID ─┬─→ J-W ─┬─→ INFO / TRIAGE / MR
                          │         └─ (no other node)
                          └─→ J-E ─┬─→ CASHIER / PHARMACY
                                    └─→ KIOSK
```
เส้นทาง `TRIAGE → PHARMACY` ต้องผ่าน 4 hop: TRIAGE → J-W → J-MID → J-E → PHARMACY

ตัวอย่าง OPD ชั้น 3 (ใช้ LOBBY เป็น corridor hub):
```
HALL ↔ LOBBY ↔ SURG / ORTHO / WELLNESS
```

### Vertical edges (บันได vs ลิฟต์)

- **STAIRS**: 5 m ต่อชั้น, 30 s, **wheelchair_accessible=False** (เร็วกว่าลิฟต์ — non-wheelchair จะถูก route ผ่าน stairs)
- **ELEVATOR**: 5 m ต่อชั้น, 45 s (รอลิฟต์), wheelchair_accessible=True (wheelchair ถูกบังคับใช้ลิฟต์ — เส้นทางจะยาวกว่าประมาณ 30 s)

**Demo**: ลองคำนวณเส้นทาง `OPD1-MR → OPD3-WELLNESS`
- non-wheelchair: 9 hops, **560s** (ใช้ stairs)
- wheelchair: 9 hops, **590s** (ใช้ elevator — บังคับ)

### Pathway (5)

| # | Category | Template | Steps |
|---|----------|----------|-------|
| 1 | New Patient / General | ผู้ป่วยใหม่ — ตรวจอายุรกรรมทั่วไป | 7 |
| 2 | Health Check-up | ตรวจสุขภาพประจำปี | 6 |
| 3 | Specialty Clinic | ตรวจตา | 5 |
| 4 | Lab / Blood Test | เจาะเลือด / ตรวจแล็บ | 4 |
| 5 | Emergency | ฉุกเฉิน / อุบัติเหติ | 5 |

ขั้นตอนคู่ขนาน (ทำได้พร้อมกัน) ใช้ `sequence_order` เดียวกัน เช่น Cashier + Pharmacy หลังเสร็จ Lab

### ผู้ป่วย (4)

| HN | ชื่อ | ภาษา | Wheelchair | Visit | Pathway | สถานะปัจจุบัน |
|----|------|------|------------|-------|---------|---------------|
| HN-2026-0001 | สมชาย ใจดี | th | – | 1 | ผู้ป่วยใหม่ — ตรวจอายุรกรรมทั่วไป | IN_PROGRESS @ OPD2-IM |
| HN-2026-0002 | James William Smith | en | – | 2 | เจาะเลือด / ตรวจแล็บ | REGISTERED @ OPD1-ENTRANCE |
| HN-2026-0003 | Mary Johnson | en | ✓ | 3 | ตรวจสุขภาพประจำปี | IN_PROGRESS @ OPD1-MR |
| HN-2026-0004 | ประยูร สดใส | th | ✓ | 4 | ตรวจตา | IN_PROGRESS @ OPD1-MR |

### QR tokens สำหรับทดสอบ

```
demo-qr-vj-thai-patient01-visit01-20260919-0000000000    (Visit 1: สมชาย  th  no-wheelchair)
demo-qr-vj-en-patient02-visit01-20260919-000000000000   (Visit 2: James  en  no-wheelchair)
demo-qr-vj-en-patient03-visit01-20260919-000000000000   (Visit 3: Mary   en  wheelchair)
demo-qr-vj-thai-patient04-visit01-20260919-000000000000 (Visit 4: ประยูร  th  wheelchair)
```

สแกนบน kiosk หรือเรียก API `GET /api/visits/by-qr-token/<token>/` เพื่อดึงข้อมูล visit

## การแก้ไขข้อมูล

แก้ CSV ใน `seed/` แล้วรัน `python ../seed/load_seed.py` ใหม่ได้เลย — script จะลบของเก่าแล้วสร้างใหม่ตาม CSV

ถ้าแก้แค่ตำแหน่ง node หรือเพิ่ม node ใหม่ รัน `generate_floor_plans.py` ก่อน เพื่อให้ภาพ PNG ตรงกับ CSV แล้วค่อย `load_seed.py`

## Floor plan

`generate_floor_plans.py` อ่าน `nodes.csv` + `floors.csv` แล้ววาด PNG 1200×800 พร้อม:

- label ชื่อห้องและ service point code
- สีแยกตาม node_type (ดู legend ที่มุมขวาล่าง)
- เส้น edge (corridor = เทา, elevator = น้ำเงิน, stairs = แดง)
- scale bar 5 m ที่มุมซ้ายล่าง พร้อมบอก scale (m/px) ของชั้นนั้น
- title bar บนบอกชื่ออาคาร/ชั้นทั้งภาษาไทยและอังกฤษ

พิกัด `pos_x, pos_y` ใน `nodes.csv` อิงกับ canvas 1200×800 px เดียวกัน — เมื่อ admin ใช้ floor plan เป็น background แล้วลาก node ในเครื่องมือแก้ไข จะตรงกับพิกัดที่ใส่ใน CSV ทันที
