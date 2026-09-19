# Data Models — ระบบนำทางผู้ป่วยในโรงพยาบาล

เอกสารนี้เป็น spec ของ data model ทั้งหมด แปลงมาจาก ER diagram ที่ตกลงกันไว้ ใช้เป็น reference
ตอนสร้าง Django models จริงใน `backend/*/models.py` แต่ละ field ตั้งชื่อและ type ให้ตรงกับ Django
field class ที่จะใช้ (`CharField`, `FloatField`, ...) เพื่อ map ตรงไปเป็นโค้ดได้เลย

แนะนำให้แตกเป็น Django app ตามกลุ่ม แทนที่จะยัดทุกอย่างไว้ใน `core`:

| App          | โมเดล |
|--------------|-------|
| `facility`   | Building, Floor, Node, Edge |
| `pathway`    | CareCategory, PathwayTemplate, TemplateStep |
| `visits`     | Patient, Visit, VisitStep |
| `queues`     | Queue, QueueTicket, ServiceSchedule |
| `accounts`   | StaffUser, ServicePointStaff, AuditLog |

> App ชื่อ `queue` ถูกเปลี่ยนเป็น `queues` ตอน implement จริง เพราะ `queue` ชนกับชื่อ Python
> standard library module (`queue.Queue`) ซึ่งไลบรารีหลายตัว (urllib3, Celery, ...) `import queue`
> ภายใน — ถ้าตั้งชื่อแอปซ้ำจะ shadow stdlib module ทั้ง process ชื่อ model (`Queue`, `QueueTicket`,
> `ServiceSchedule`) ไม่เปลี่ยน

ทุก model มี `id` เป็น auto primary key (Django default) จึงไม่เขียนซ้ำในรายการ field ด้านล่าง

---

## 1. ผังสถานที่ (`facility`)

### Building
| Field | Type | หมายเหตุ |
|---|---|---|
| name_th | `CharField(120)` | |
| name_en | `CharField(120)` | |
| code | `CharField(20, unique=True)` | ใช้ในการอ้างอิง/ค้นหาเร็ว ๆ |

### Floor
| Field | Type | หมายเหตุ |
|---|---|---|
| building | `ForeignKey(Building, on_delete=CASCADE, related_name="floors")` | |
| level_no | `IntegerField` | ลำดับชั้นเชิงตัวเลข (รองรับชั้นใต้ดิน เช่น -1) ใช้ sort/compare ไม่ใช้ label |
| name_th | `CharField(80)` | เช่น "ชั้น 4 อาคารผู้ป่วยนอก" |
| name_en | `CharField(80)` | เช่น "4th floor, OPD building" |
| plan_image | `ImageField(upload_to="floor_plans/", blank=True, null=True)` | ภาพผังพื้นต้นฉบับ ใช้เป็น background layer ในเครื่องมือลาก Node/Edge (ต้องเพิ่ม `Pillow` ใน `requirements.txt` และตั้ง `MEDIA_ROOT`/`MEDIA_URL`) |
| plan_scale_m_per_px | `FloatField(null=True, blank=True)` | อัตราส่วนแปลงพิกเซลบนภาพเป็นเมตรจริง (คาลิเบรตครั้งเดียวตอนอัปโหลดภาพ เช่น ลากไม้บรรทัดบนภาพเทียบกับระยะจริง) ใช้คำนวณ `Edge.distance_m` อัตโนมัติจาก `pos_x`/`pos_y` ของ node ปลายทั้งสอง ถ้าแอดมินไม่กรอกระยะเองตรง ๆ |

### Node
ยุบ `ServicePoint`/`Kiosk` เดิมเข้ามาเป็น field เดียวกัน แยกด้วย `node_type` แทนการทำ 1:1 side table —
field เฉพาะทาง (`service_point_code`, `department_th/en`, `is_active`, `device_code`) จะมีค่าเฉพาะ node_type ที่เกี่ยวข้อง
ส่วนที่เหลือปล่อย blank/null ตรวจด้วย `clean()`/business logic แทน DB constraint

**`location_qr_code` แยกออกจาก `device_code` โดยตั้งใจ**: `location_qr_code` คือโค้ดสำหรับ "ระบุตำแหน่ง" ที่ node ไหนก็มีได้
(แปะเป็นสติกเกอร์เฉย ๆ ให้ผู้ป่วยสแกนด้วยมือถือตัวเอง ตาม S2) ส่วน `device_code` คือรหัสเครื่อง kiosk จริง (ฮาร์ดแวร์/จอ)
มีเฉพาะ node_type=`KIOSK` เท่านั้น — node ไม่ต้องเป็น kiosk ก็มี `location_qr_code` ได้

| Field | Type | หมายเหตุ |
|---|---|---|
| floor | `ForeignKey(Floor, on_delete=CASCADE, related_name="nodes")` | |
| node_type | `CharField(choices=NodeType)` | `SERVICE_POINT` / `JUNCTION` / `VERTICAL_CONNECTOR` / `KIOSK` / `ENTRANCE` |
| name_th | `CharField(120)` | |
| name_en | `CharField(120)` | |
| pos_x | `FloatField` | พิกัดบนภาพผังชั้น ใช้ render + คำนวณมุมเลี้ยว |
| pos_y | `FloatField` | |
| vertical_group | `CharField(80, blank=True)` | คีย์จับคู่ node ลิฟต์/บันไดตัวเดียวกันข้ามชั้น (เช่น `"elevator-a"`) — optional ใช้ตรวจ data integrity |
| location_qr_code | `CharField(64, blank=True, null=True, unique=True)` | โค้ด QR สำหรับผู้ป่วยสแกนด้วยมือถือตัวเองเพื่ออัปเดต `Visit.current_node` (S2) — ใส่ได้กับ node ทุกประเภท ไม่จำกัดแค่ kiosk |
| service_point_code | `CharField(30, blank=True, null=True, unique=True)` | เฉพาะ node_type = `SERVICE_POINT` |
| department_th | `CharField(120, blank=True)` | เฉพาะ node_type = `SERVICE_POINT` เช่น "ห้องแล็บ" |
| department_en | `CharField(120, blank=True)` | เฉพาะ node_type = `SERVICE_POINT` เช่น "Laboratory" |
| is_active | `BooleanField(default=True)` | เฉพาะ node_type = `SERVICE_POINT` — ปิดให้บริการชั่วคราวได้โดยไม่ต้องลบ |
| device_code | `CharField(60, blank=True, null=True, unique=True)` | เฉพาะ node_type = `KIOSK` — รหัสเครื่อง kiosk จริง (ฮาร์ดแวร์/จอ) ไม่ใช่ตัวโค้ดที่ผู้ป่วยสแกน |

### Edge
| Field | Type | หมายเหตุ |
|---|---|---|
| from_node | `ForeignKey(Node, on_delete=CASCADE, related_name="edges_from")` | |
| to_node | `ForeignKey(Node, on_delete=CASCADE, related_name="edges_to")` | |
| distance_m | `FloatField` | คำนวณจาก pos_x/pos_y × scale หรือกรอกระยะจริง |
| edge_type | `CharField(choices=EdgeType)` | `CORRIDOR` / `ELEVATOR` / `STAIRS` / `RAMP` |
| walk_time_sec | `IntegerField` | ใช้ตรงในการคำนวณเส้นทาง (ไม่ใช่แค่ distance) เพราะลิฟต์ต้องบวกเวลารอ |
| is_bidirectional | `BooleanField(default=True)` | ถ้า False เดินได้ทิศทางเดียว (from → to) — routing engine ต้อง honor field นี้ |
| wheelchair_accessible | `BooleanField(default=True)` | False สำหรับ edge_type=`STAIRS` หรือทางที่มีขั้นบันได/พื้นต่างระดับ — routing engine ต้อง exclude edge ที่ False ออกเมื่อคำนวณเส้นทางให้ `Visit.uses_wheelchair=True` (รองรับ S5) |

---

## 2. แม่แบบการรักษา (`pathway`)

### CareCategory
| Field | Type | หมายเหตุ |
|---|---|---|
| name_th | `CharField(120)` | เช่น "เบาหวานรายเก่า" |
| name_en | `CharField(120)` | เช่น "Returning diabetes patient" |

### PathwayTemplate
| Field | Type | หมายเหตุ |
|---|---|---|
| care_category | `ForeignKey(CareCategory, on_delete=PROTECT, related_name="pathway_templates")` | |
| name_th | `CharField(150)` | |
| name_en | `CharField(150)` | |
| is_active | `BooleanField(default=True)` | เวอร์ชันเก่าที่เลิกใช้ให้ปิดไว้ ไม่ลบ (visit เก่ายังอ้างอิงอยู่) |

### TemplateStep
| Field | Type | หมายเหตุ |
|---|---|---|
| pathway_template | `ForeignKey(PathwayTemplate, on_delete=CASCADE, related_name="steps")` | |
| service_point | `ForeignKey(Node, on_delete=PROTECT, related_name="template_steps")` | ต้องชี้ไปที่ node ซึ่ง `node_type == SERVICE_POINT` เท่านั้น (validate ใน `clean()`) |
| sequence_order | `PositiveIntegerField` | หมายถึง "stage" ไม่ใช่ลำดับเชิงเส้นตายตัว — สเต็ปที่ทำคู่ขนานกันได้ (เช่น เจาะเลือด/เอกซเรย์ หลัง checkup) ใส่เลขเดียวกันได้ ใช้แค่ sort คร่าว ๆ ตอนแสดงผล ตัวกำหนดสิทธิ์ไปต่อจริงคือ `prerequisite_steps` ด้านล่าง |
| prerequisite_steps | `ManyToManyField("self", symmetrical=False, related_name="dependent_steps", blank=True)` | เซตของขั้นตอนที่ต้อง **เสร็จทั้งหมด** (AND) ก่อนถึงจะเริ่มขั้นนี้ได้ ว่าง = เริ่มได้ทันที รองรับทั้ง fan-out (หลายสเต็ปมี prerequisite ตัวเดียวกัน เช่น เจาะเลือด/เอกซเรย์ ต่างมี prerequisite = checkup) และ fan-in (สเต็ปเดียวรอหลาย prerequisite พร้อมกัน) |

`Meta.ordering = ["sequence_order"]`

---

## 3. ผู้ป่วยและการมารับบริการ (`visits`)

### Patient
| Field | Type | หมายเหตุ |
|---|---|---|
| hn_code | `CharField(20, unique=True)` | เลขประจำตัวผู้ป่วย (HN) |
| full_name | `CharField(200)` | |
| dob | `DateField` | |
| national_id | `CharField(13, blank=True)` | |
| phone | `CharField(20, blank=True)` | |
| preferred_language | `CharField(choices=[("th", "ไทย"), ("en", "English")], default="th")` | ใช้เลือกภาษาแสดงผลหน้าจอฝั่งผู้ป่วยให้ถูกต้องอัตโนมัติ (รองรับ S4) |

### Visit
| Field | Type | หมายเหตุ |
|---|---|---|
| patient | `ForeignKey(Patient, on_delete=PROTECT, related_name="visits")` | |
| pathway_template | `ForeignKey(PathwayTemplate, on_delete=PROTECT, related_name="visits")` | |
| visit_date | `DateField` | วันที่มารับบริการ |
| created_at | `DateTimeField(auto_now_add=True)` | |
| status | `CharField(choices=VisitStatus)` | `REGISTERED` / `IN_PROGRESS` / `COMPLETED` / `CANCELLED` |
| qr_token | `CharField(64, unique=True)` | สุ่มตอนลงทะเบียน **ผูกกับ Visit ไม่ใช่ Patient** หมดอายุ/ใช้ไม่ได้เมื่อ status เป็น COMPLETED/CANCELLED |
| current_node | `ForeignKey(Node, null=True, blank=True, on_delete=SET_NULL, related_name="visits_here")` | อัปเดตจากการสแกนที่ kiosk |
| uses_wheelchair | `BooleanField(default=False)` | เฉพาะการมาครั้งนี้ (ไม่ใช่ attribute ถาวรของ Patient เพราะอาจเปลี่ยนไปแต่ละครั้ง) — routing engine ใช้ค่านี้ตัดสินใจว่าต้อง exclude edge ที่ `wheelchair_accessible=False` หรือไม่ |

### VisitStep
| Field | Type | หมายเหตุ |
|---|---|---|
| visit | `ForeignKey(Visit, on_delete=CASCADE, related_name="steps")` | |
| service_point | `ForeignKey(Node, on_delete=PROTECT, related_name="visit_steps")` | node_type == `SERVICE_POINT` |
| sequence_order | `PositiveIntegerField` | stage เดียวกับที่อธิบายไว้ใน `TemplateStep` — สเต็ปคู่ขนานถือ stage เท่ากันได้ |
| prerequisite_steps | `ManyToManyField("self", symmetrical=False, related_name="dependent_steps", blank=True)` | คัดลอกมาจาก `TemplateStep.prerequisite_steps` ตอน snapshot หรือกำหนดเองถ้าเป็น step ที่เจ้าหน้าที่แทรกแบบ ad-hoc (`is_planned=False`) — ใช้ตัดสินว่าสเต็ปนี้ "พร้อมเริ่ม" หรือยัง |
| status | `CharField(choices=VisitStepStatus)` | `PENDING` / `IN_PROGRESS` / `DONE` / `SKIPPED` |
| is_planned | `BooleanField(default=True)` | False = เจ้าหน้าที่แทรกขั้นตอนเพิ่มเติมนอกแผนเดิม |
| started_at | `DateTimeField(null=True, blank=True)` | |
| completed_at | `DateTimeField(null=True, blank=True)` | ใช้คำนวณเวลารอเฉลี่ยของ dashboard ผู้บริหาร |

`Meta.ordering = ["sequence_order"]`

**กติกาความพร้อม (business logic ไม่ใช่ field ใหม่):** สเต็ปหนึ่งจะ "เริ่มได้" (แสดงเป็นตัวเลือกในหน้าจอผู้ป่วย/เจ้าหน้าที่) ก็ต่อเมื่อทุกตัวใน `prerequisite_steps` มี `status=DONE` แล้ว —
ถ้ามีหลายสเต็ป "พร้อมเริ่ม" พร้อมกัน (เช่น เจาะเลือด กับ เอกซเรย์ หลัง checkup เสร็จ) ผู้ป่วยเลือกไปจุดไหนก่อนก็ได้ ระบบไม่บังคับลำดับระหว่างสองสเต็ปนั้น

---

## 4. คิวและบริการ (`queue`)

### Queue
| Field | Type | หมายเหตุ |
|---|---|---|
| service_point | `ForeignKey(Node, on_delete=CASCADE, related_name="queues")` | node_type == `SERVICE_POINT` |
| queue_date | `DateField` | |
| current_number | `PositiveIntegerField(default=0)` | หมายเลขคิวที่กำลังเรียกอยู่ตอนนี้ |

`Meta.unique_together = [("service_point", "queue_date")]`

### QueueTicket
| Field | Type | หมายเหตุ |
|---|---|---|
| queue | `ForeignKey(Queue, on_delete=CASCADE, related_name="tickets")` | |
| visit_step | `OneToOneField(VisitStep, on_delete=CASCADE, related_name="queue_ticket")` | |
| ticket_number | `PositiveIntegerField` | |
| status | `CharField(choices=TicketStatus)` | `WAITING` / `CALLED` / `SERVING` / `DONE` / `SKIPPED` |
| called_at | `DateTimeField(null=True, blank=True)` | ใช้คำนวณระยะห่างจากคิวปัจจุบัน (S6) |

**S6 (แจ้งเตือนใกล้ถึงคิว) — ตัดสินใจแล้วว่า MVP นี้ให้ frontend polling** endpoint คิวเป็นระยะแทนการทำ push notification
จริง (`ticket_number - Queue.current_number` บอกระยะห่างได้ตรง ๆ อยู่แล้ว) จึงไม่ต้องเพิ่ม field เก็บ push subscription/token ตอนนี้
ถ้าจะอัปเกรดเป็น push ทีหลังค่อยเพิ่มตารางแยก ไม่กระทบ schema ปัจจุบัน

### ServiceSchedule
| Field | Type | หมายเหตุ |
|---|---|---|
| service_point | `ForeignKey(Node, on_delete=CASCADE, related_name="schedules")` | node_type == `SERVICE_POINT` |
| day_of_week | `IntegerField(choices=[(0,"Mon"),(1,"Tue"),...,(6,"Sun")])` | |
| open_time | `TimeField` | |
| close_time | `TimeField` | |

---

## 5. ผู้ใช้และสิทธิ์ (`accounts`)

### StaffUser
Custom user model (extend `AbstractUser`) — **เฉพาะเจ้าหน้าที่/แอดมิน/ผู้บริหาร** ผู้ป่วยไม่มี row ในตารางนี้
เพราะฝั่งผู้ป่วยยืนยันตัวตนผ่าน `Visit.qr_token` เท่านั้น

| Field | Type | หมายเหตุ |
|---|---|---|
| role | `CharField(choices=StaffRole)` | `REGISTRAR` (เวชระเบียน/คัดกรอง) / `SERVICE_STAFF` (ประจำจุดบริการ) / `ADMIN` / `EXECUTIVE` |

สิทธิ์เข้าถึง endpoint ผูกกับ `role` โดยตรงในโค้ด (DRF permission class) ยังไม่แยกตาราง Permission ละเอียดกว่านี้
เพราะยังไม่มี requirement ที่ต้องการ granularity ระดับนั้น

### ServicePointStaff
| Field | Type | หมายเหตุ |
|---|---|---|
| staff_user | `ForeignKey(StaffUser, on_delete=CASCADE, related_name="service_point_assignments")` | |
| service_point | `ForeignKey(Node, on_delete=CASCADE, related_name="staff_assignments")` | node_type == `SERVICE_POINT` |

`Meta.unique_together = [("staff_user", "service_point")]`

### AuditLog
| Field | Type | หมายเหตุ |
|---|---|---|
| staff_user | `ForeignKey(StaffUser, null=True, blank=True, on_delete=SET_NULL, related_name="audit_logs")` | |
| action | `CharField(100)` | เช่น `"call_queue"`, `"complete_step"`, `"edit_template"` |
| target_type | `CharField(60)` | ชื่อ model ที่ถูกกระทำ |
| target_id | `PositiveIntegerField` | |
| detail | `JSONField(blank=True, null=True)` | payload ก่อน/หลังเปลี่ยนแปลง |
| created_at | `DateTimeField(auto_now_add=True)` | |

---

## ยังไม่ออกแบบ / รอตัดสินใจ

- **BLE beacon** สำหรับ indoor navigation — รับทราบว่าจะทำเป็น extension แต่ยังไม่ลงรายละเอียด model
- **Permission ระดับละเอียดกว่า role** — ถ้าต้องการ fine-grained ค่อยเพิ่มตาราง `Permission`/`RolePermission` ทีหลัง ไม่ยัดเข้าตอนนี้
