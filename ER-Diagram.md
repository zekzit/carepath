# ER Diagram — ระบบนำทางผู้ป่วยในโรงพยาบาล

Source of truth คือ [`MODELS.md`](MODELS.md) ไฟล์นี้เป็นภาพ mermaid `erDiagram` ที่ generate ตามนั้น
(field/relationship ต้องตรงกับ `MODELS.md` เสมอ — แก้ที่นั่นก่อนแล้วค่อย sync มาไฟล์นี้) เปิดดูแบบ render
ได้ทั้งบน GitHub/GitLab (รองรับ mermaid ในตัว) หรือรูปสำเร็จรูปที่ [`ER-Diagram.png`](ER-Diagram.png)

```mermaid
erDiagram
  BUILDING ||--o{ FLOOR : has
  FLOOR ||--o{ NODE : contains
  NODE ||--o{ EDGE : from_node
  NODE ||--o{ EDGE : to_node
  NODE ||--o{ VISIT : current_position
  CARE_CATEGORY ||--o{ PATHWAY_TEMPLATE : groups
  PATHWAY_TEMPLATE ||--o{ TEMPLATE_STEP : defines
  NODE ||--o{ TEMPLATE_STEP : target_of
  TEMPLATE_STEP }o--o{ TEMPLATE_STEP : prerequisite_of
  PATHWAY_TEMPLATE ||--o{ VISIT : assigned_to
  PATIENT ||--o{ VISIT : makes
  VISIT ||--o{ VISIT_STEP : contains
  NODE ||--o{ VISIT_STEP : target_of
  VISIT_STEP }o--o{ VISIT_STEP : prerequisite_of
  NODE ||--o{ QUEUE : has
  QUEUE ||--o{ QUEUE_TICKET : contains
  VISIT_STEP ||--o| QUEUE_TICKET : ticket_for
  NODE ||--o{ SERVICE_SCHEDULE : has
  STAFF_USER ||--o{ SERVICE_POINT_STAFF : assigned
  NODE ||--o{ SERVICE_POINT_STAFF : staffed_by
  STAFF_USER ||--o{ AUDIT_LOG : performs

  BUILDING {
    int id PK
    string name_th
    string name_en
    string code
  }
  FLOOR {
    int id PK
    int building_id FK
    int level_no
    string name_th
    string name_en
    image plan_image
    float plan_scale_m_per_px
  }
  NODE {
    int id PK
    int floor_id FK
    string node_type
    string name_th
    string name_en
    float pos_x
    float pos_y
    string vertical_group
    string location_qr_code
    string service_point_code
    string department_th
    string department_en
    boolean is_active
    string device_code
  }
  EDGE {
    int id PK
    int from_node_id FK
    int to_node_id FK
    float distance_m
    string edge_type
    int walk_time_sec
    boolean is_bidirectional
    boolean wheelchair_accessible
  }
  CARE_CATEGORY {
    int id PK
    string name_th
    string name_en
  }
  PATHWAY_TEMPLATE {
    int id PK
    int care_category_id FK
    string name_th
    string name_en
    boolean is_active
  }
  TEMPLATE_STEP {
    int id PK
    int pathway_template_id FK
    int service_point_id FK
    int sequence_order
  }
  PATIENT {
    int id PK
    string hn_code
    string full_name
    date dob
    string national_id
    string phone
    string preferred_language
  }
  VISIT {
    int id PK
    int patient_id FK
    int pathway_template_id FK
    int current_node_id FK
    date visit_date
    datetime created_at
    string status
    string qr_token
    boolean uses_wheelchair
  }
  VISIT_STEP {
    int id PK
    int visit_id FK
    int service_point_id FK
    int sequence_order
    string status
    boolean is_planned
    datetime started_at
    datetime completed_at
  }
  QUEUE {
    int id PK
    int service_point_id FK
    date queue_date
    int current_number
  }
  QUEUE_TICKET {
    int id PK
    int queue_id FK
    int visit_step_id FK
    int ticket_number
    string status
    datetime called_at
  }
  SERVICE_SCHEDULE {
    int id PK
    int service_point_id FK
    int day_of_week
    time open_time
    time close_time
  }
  STAFF_USER {
    int id PK
    string username
    string full_name
    string role
  }
  SERVICE_POINT_STAFF {
    int id PK
    int staff_user_id FK
    int service_point_id FK
  }
  AUDIT_LOG {
    int id PK
    int staff_user_id FK
    string action
    string target_type
    int target_id
    json detail
    datetime created_at
  }
```

**หมายเหตุการอ่านความสัมพันธ์:**
- `TEMPLATE_STEP }o--o{ TEMPLATE_STEP : prerequisite_of` และ `VISIT_STEP }o--o{ VISIT_STEP : prerequisite_of`
  คือ self many-to-many (`prerequisite_steps` ใน `MODELS.md`) รองรับทั้ง fan-out (หลายสเต็ปรอ prerequisite ตัวเดียวกัน)
  และ fan-in (สเต็ปเดียวรอหลาย prerequisite พร้อมกัน)
- `ServicePoint`/`Kiosk` ไม่มีตารางแยก — ถูกยุบเป็น field ใน `NODE` แล้วแยกด้วย `node_type` (ดูรายละเอียดใน `MODELS.md`)
