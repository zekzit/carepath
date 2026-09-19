# Implementation Plan — เชื่อม Backend ↔ Frontend

เอกสารนี้แตกงาน "เชื่อม Django REST API เข้ากับ Next.js frontend" ตาม [MODELS.md](MODELS.md)
เป็น phase ตามลำดับที่ตกลงกันไว้:

1. **Admin CRUD — Master Data** (รวม Login ตาม Role)
2. **Admin — Visit & Queue** (business logic หลักของระบบ)
3. **Mobile — Patient Portal**
4. **Kiosk Portal** (manual input fallback)
5. **Facility Edge Visual Editor** (ลากเส้น/ตำแหน่งบนผังพื้น)
6. **Kiosk — กล้องสแกน QR จริง**

Backend ตอนนี้มีแค่ models + migrations + Django admin registration (ดู `backend/*/models.py`,
`backend/*/admin.py`) — ยังไม่มี serializer/viewset/URL ใด ๆ นอกจาก `GET /api/health`
Frontend มี route/layout/component ของทั้ง 3 portal พร้อมแล้ว (mock data ทั้งหมดใน
[frontend/lib/portal-data.ts](frontend/lib/portal-data.ts) และ placeholder content ใน
`frontend/app/admin/*`) — งานที่เหลือคือเปลี่ยน mock เป็นของจริงทีละ phase

---

## หลักการที่ใช้ร่วมกันทุก Phase

| เรื่อง | แนวทาง |
|---|---|
| URL convention | `/api/<app>/<resource>` ไม่มี trailing slash (README บังคับ `APPEND_SLASH=False` แล้ว) → ใช้ `SimpleRouter(trailing_slash=False)` หรือ `DefaultRouter(trailing_slash=False)` ต่อแอป ห้ามใช้ router default ตรง ๆ เพราะจะเติม `/` ให้เอง |
| Serializer/ViewSet | แยกไฟล์ `serializers.py` และ `viewsets.py` ต่อแอป (ของเดิม `views.py` เป็น stub ว่างอยู่ ลบทิ้งได้) |
| Auth (Admin) | **Login จริง แต่ permission ฝั่ง API ยังไม่บังคับ** — ทำ session login ด้วย `StaffUser` จริงตั้งแต่ phase 1 (แทนที่ hardcode `CURRENT_ROLE = "ADMIN"` ใน [lib/roles.ts](frontend/lib/roles.ts) ด้วย role จาก session จริง) แต่ `DEFAULT_PERMISSION_CLASSES` ของ DRF ยังคง `[AllowAny]` ไปก่อน คือ **มีการล็อกอินและรู้ role จริง แต่ backend ยังไม่ปฏิเสธ request ที่ role ไม่ตรง** (การบังคับสิทธิ์ต่อ endpoint เป็นงานแยกในอนาคต ไม่รวมใน MVP นี้) — ฝั่ง frontend เป็นคน gate หน้า `/admin/*` ด้วยการ redirect ไป `/admin/login` ถ้ายังไม่มี session |
| Auth (Patient/Kiosk) | **ไม่มี auth ถาวร ตามสเปค** — endpoint กลุ่มนี้ยืนยันตัวตนด้วย `Visit.qr_token` เท่านั้น แยก ViewSet ออกจากฝั่ง Admin อย่างชัดเจนตั้งแต่ต้น (คนละ permission class) อย่าใช้ ViewSet เดียวกันแล้วค่อยกั้นสิทธิ์ทีหลัง |
| Pagination | Master data (phase 1) ปิด pagination ไปก่อน (`pagination_class = None`) เพราะ list สั้น ๆ ระดับ config ส่วน Visit/Queue list (phase 2) ค่อยเปิด `PageNumberPagination` เพราะโตเรื่อย ๆ ตามวัน |
| Frontend data layer | เพิ่ม `frontend/lib/api/<domain>.ts` เป็น typed fetch client ต่อโดเมน (facility, pathway, visits, queues, accounts) แทนที่ mock ใน `lib/portal-data.ts` ทีละไฟล์ — type เขียนมือให้ตรงกับ serializer fields (ไม่ทำ codegen ในรอบนี้) |
| Mutations ฝั่ง Admin | **แก้ไขจากแผนเดิม**: ใช้ client-side `apiFetch` ([lib/api/client.ts](frontend/lib/api/client.ts)) ตรง ๆ ไม่ใช่ Server Actions — เหตุผลเดียวกับที่ login/logout ใน Phase 0 ทำแบบนี้: session/CSRF cookie ต้องให้ browser จัดการเองโดยตรง ถ้าไปเรียกผ่าน Server Action (รันบน Node) จะต้อง forward `Set-Cookie`/cookie เองซึ่งยุ่งยากกว่าไม่คุ้ม ทุก component ที่มีฟอร์ม CRUD จึงต้องเป็น Client Component (`"use client"`) แล้ว re-fetch list เองหลัง mutate สำเร็จ ไม่ต้องใช้ `revalidatePath` |
| Business logic สำคัญ | ระบุไว้ในแต่ละ phase ด้านล่าง — ต้อง implement ใน backend (serializer/model method) ไม่ใช่คำนวณฝั่ง frontend เพราะเป็นกฎที่ต้องถูกต้องไม่ว่าจะเรียกจาก client ไหน |

---

## Phase 0 — Backend API scaffolding + Login ตาม Role

งานเล็ก ทำครั้งเดียว ไม่ต้องรอ approve แยก — รวม auth เข้ามาที่นี่เพราะไม่ผูกกับ resource
ไหนโดยเฉพาะ และ Sidebar/role-gating ของ Admin Portal รอสิ่งนี้อยู่แล้ว

- [x] เพิ่ม `REST_FRAMEWORK` config ใน `config/settings.py`: `DEFAULT_PERMISSION_CLASSES = [AllowAny]` (ตามที่ตกลง — ไม่บังคับสิทธิ์ต่อ endpoint ใน MVP นี้), `DEFAULT_PAGINATION_CLASS` ปิดไว้ก่อน
- [x] วาง URL namespace: `config/urls.py` เพิ่ม `path('api/facility/', include('facility.urls'))` ฯลฯ ต่อแอป (`pathway`/`visits`/`queues` เป็น `urlpatterns = []` placeholder รอ viewset จริงใน phase ถัดไป)
- [x] ทำ pattern ตัวอย่าง 1 model (`Building`) ให้ครบวงจร (serializer → viewset → url → ทดสอบผ่าน `curl`) แล้ว agent อื่นก็อบพิมพ์ pattern เดียวกันได้ ลด bikeshedding เรื่อง style
- [x] ลบ `views.py` stub (`# Create your views here.`) ในแอปที่จะย้ายไป `viewsets.py` (`facility`, `pathway`, `visits`, `queues` — `accounts/views.py` เก็บไว้เพราะใช้จริงสำหรับ auth ด้านล่าง)

### Auth: Login ตาม Role (session-based)

Backend (`accounts`):
- [x] `POST /api/accounts/login` — รับ username/password ใช้ Django `authenticate()` + `login()` (session cookie มาตรฐาน — ใช้ได้เพราะ frontend เรียกผ่าน same-origin rewrite proxy อยู่แล้ว) คืน `{id, username, full_name, role}`
- [x] `POST /api/accounts/logout` — `django.contrib.auth.logout()`
- [x] `GET /api/accounts/me` — คืนข้อมูล staff user ปัจจุบันจาก session, คืน `401` ถ้ายังไม่ login (endpoint นี้เป็น `AllowAny` เพราะต้องเรียกได้ก่อน login เพื่อเช็คสถานะ — คืน `{"detail": ...}` เสมอ ไม่ใช่ `Response(None)` เพราะ DRF render `None` เป็น body ว่างเปล่า ไม่ใช่ JSON `null` ซึ่งพัง `res.json()` ฝั่ง frontend)
- [x] CSRF: `ensure_csrf_cookie` บน `login`/`me` แล้ว frontend อ่าน cookie `csrftoken` ส่งกลับเป็น header `X-CSRFToken` ทุก mutating request — ทำ fetch wrapper กลางไว้ที่เดียวใน `lib/api/client.ts` (อ่าน token **สดทุกครั้ง** ไม่ cache เพราะ Django rotate token ตอน login) + เพิ่ม `CSRF_TRUSTED_ORIGINS` ใน settings เพราะ Next.js rewrite proxy ไม่รับประกันว่า Host header ที่ Django เห็นจะตรงกับ Origin ของ browser

Frontend:
- [x] `/admin/login` (`app/admin/login/page.tsx`) — ฟอร์ม username/password เรียก login endpoint ตรง ๆ จากฝั่ง client (ไม่ใช้ Server Action เพราะต้องให้ browser รับ `Set-Cookie` ของ session/csrf เองโดยตรง ไม่ต้อง forward เอง) แล้ว redirect เข้า `/admin`
- [x] ย้าย route เดิมทั้งหมดไปอยู่ใต้ route group `app/admin/(authenticated)/` (URL ไม่เปลี่ยน) เพื่อให้ `/admin/login` อยู่นอก layout ที่ gate สิทธิ์ (ไม่งั้น login page จะ redirect วนตัวเอง) — `app/admin/(authenticated)/layout.tsx` เรียก `getCurrentStaffUser()` (`lib/api/server.ts`, server-only, forward cookie จาก `next/headers`) ก่อน render ถ้าไม่มี session ให้ `redirect('/admin/login')`
- [x] ลบ `CURRENT_ROLE` constant ออกจาก [lib/roles.ts](frontend/lib/roles.ts) ส่ง `currentUser` จริงจาก layout ลงมาเป็น prop ให้ `Sidebar` แทน
- [x] เพิ่มปุ่ม logout ใน `Topbar` (`components/admin/LogoutButton.tsx`)

DoD ของส่วนนี้: เข้า `/admin` โดยไม่ login ถูกเด้งไปหน้า login, login ด้วย `StaffUser` ที่สร้างผ่าน
Django admin (`role` ต่าง ๆ) แล้วเห็นเมนู Sidebar กรองตาม role จริงตามค่านั้น ไม่ hardcode อีกต่อไป,
กด logout แล้วกลับไปหน้า login — **ทดสอบจริงแล้วผ่านทั้งหมด** (login/logout ด้วย session cookie จริง,
ทดสอบ role `ADMIN` เห็นเมนูครบ vs role `REGISTRAR` เห็นแค่ ภาพรวม/ลงทะเบียนฯ ตรงตามที่ตั้งไว้ใน
`lib/admin-nav.ts`)

---

## Phase 1 — Admin CRUD สำหรับ Master Data

ครอบคลุมเมนู Admin ที่เป็น "ตั้งค่าระบบ" ทั้งหมดใน [lib/admin-nav.ts](frontend/lib/admin-nav.ts):
ผังสถานที่, แม่แบบเส้นทางการรักษา, ตารางเวลาบริการ, ผู้ใช้งานและสิทธิ์

### Backend — เสร็จแล้ว (ทดสอบผ่าน curl ครบทุก endpoint)

| App | Resource | หมายเหตุ |
|---|---|---|
| `facility` | Building, Floor, Node, Edge | [x] Node ใช้ `core.serializers.CleanOnValidateMixin` (ใหม่ — reusable ให้ทุก serializer ที่โมเดลมี `clean()`) เรียก `instance.clean()` ก่อน save จริง ทดสอบแล้วว่า reject node_type ผิด field ได้ |
| `pathway` | CareCategory, PathwayTemplate, TemplateStep | [x] `prerequisite_steps` validate ข้าม `pathway_template` แล้ว (ทดสอบ reject จริง) — `service_point` field จำกัด queryset เฉพาะ `node_type=SERVICE_POINT` |
| `queues` | ServiceSchedule | [x] เหมือนกัน `service_point` จำกัดเฉพาะ SERVICE_POINT node (ส่ง node ผิด type ได้ 400 "Invalid pk" ทันที) |
| `accounts` | StaffUser, ServicePointStaff | [x] `StaffUserAdminSerializer` (แยกจาก `StaffUserSerializer` ที่ login/me ใช้) บังคับ `password` ตอน create แล้ว hash ด้วย `set_password()` เข้ารหัสจริง (ทดสอบ login ด้วย user ที่สร้างผ่าน API แล้วเข้าได้จริง) — `ServicePointStaff` unique_together ทำงานอัตโนมัติจาก DRF |

ทุก resource ข้างบน: `ModelViewSet` มาตรฐาน (list/create/retrieve/update/destroy) ไม่มี custom action พิเศษ

**API ที่ใช้ได้จริงตอนนี้** (ทุกตัว `AllowAny`, ไม่มี trailing slash):
```
GET/POST            /api/facility/buildings, /floors, /nodes, /edges
GET/PATCH/DELETE    /api/facility/buildings/{id}, /floors/{id}, /nodes/{id}, /edges/{id}
GET/POST            /api/pathway/care-categories, /pathway-templates, /template-steps
GET/POST            /api/queues/service-schedules
GET/POST            /api/accounts/staff-users, /service-point-staff
```
(รูปแบบ error: `{"field_name": ["message"]}` หรือ `{"non_field_errors": ["message"]}`, HTTP 400 — มาตรฐาน DRF)

### Frontend — เสร็จแล้ว (ทดสอบผ่าน browser จริง + cross-check ด้วย curl)

- [x] `components/admin/DataTable.tsx` — list มาตรฐาน (columns, add button, loading/empty state, ลบแบบ two-click inline confirm)
- [x] `components/admin/RecordFormSheet.tsx` — drawer สร้าง/แก้ไข ขับเคลื่อนด้วย `FieldConfig[]` (text/email/password/number/integer/checkbox/select/multiselect/time), รองรับ field ที่ซ่อน/แสดงตามเงื่อนไข (`visible`) และ option ที่เปลี่ยนตาม field อื่นแบบ live (`getOptions`, เช่น TemplateStep prerequisite filter), map DRF error (`{"field": [...]}` / `non_field_errors`) ขึ้นแสดงถัดจากช่องนั้น ๆ อัตโนมัติ
- [x] `components/admin/AdminTabs.tsx` + `lib/api/{resource,facility,pathway,queues,accounts}.ts` (`createResourceClient` generic CRUD wrapper รอบ `apiFetch`) + `lib/admin-form-utils.ts` (แปลงค่า form string ↔ payload ที่ backend ต้องการ)
- [x] แก้ไขจากแผนเดิม: มัดใช้ client-side `apiFetch` ตรง ๆ ไม่ใช่ Server Actions (ดูแถว "Mutations ฝั่ง Admin" ด้านบน) ทุกหน้า/component จึงเป็น Client Component ที่ fetch/mutate เอง แล้ว refetch list หลัง mutate สำเร็จ
- [x] แทนที่ placeholder ครบ 4 หน้า: `/admin/facility` (แท็บ Buildings/Floors/Nodes/Edges), `/admin/pathways` (แท็บ CareCategories/PathwayTemplates/TemplateSteps), `/admin/schedule` (ServiceSchedule ตารางเดียว), `/admin/staff` (StaffUsers + ServicePointStaff สองตารางในหน้าเดียว) — Edge เป็น list/form ธรรมดาตามแผน (เลือก from_node/to_node จาก dropdown) ไม่มี visual drag editor (ยังอยู่ Phase 5)
- [x] i18n: เพิ่ม key ใหม่ทั้งหมดใน `messages/th.json` และ `en.json` ภายใต้ namespace `admin` (ไม่ hardcode ข้อความใดไว้ภาษาเดียว)

**รายละเอียดที่ต้องระวัง ทำถูกและมีทดสอบยืนยันแล้ว**:
- Node's conditional fields (`service_point_code`/`department_*`/`is_active` เฉพาะ SERVICE_POINT, `device_code` เฉพาะ KIOSK) ถูก **เคลียร์เป็น null/blank จริงตอน submit** ไม่ใช่แค่ซ่อนในฟอร์ม — ทดสอบสร้าง node เป็น KIOSK ใส่ device_code แล้วแก้เป็น SERVICE_POINT จริง ยืนยันผ่าน `GET /api/facility/nodes/{id}` ว่า `device_code` กลายเป็น `null` และไม่โดน `Node.clean()` reject (ตรวจซ้ำเองอีกรอบ ยืนยันตรงกับที่ agent รายงาน)
- TemplateStep prerequisite multiselect กรองเฉพาะ step ใน `pathway_template` เดียวกัน แบบ live เมื่อเปลี่ยน template
- StaffUser password: required ตอน create, ตอน edit เว้นว่างไว้ = คงรหัสเดิม (ตรวจซ้ำเองในหน้า UI จริง เห็น help text "เว้นว่างไว้เพื่อคงรหัสผ่านเดิม" ถูกต้อง)
- SERVICE_POINT-only FK select (TemplateStep/ServiceSchedule/ServicePointStaff's `service_point`) กรอง client-side จาก node list ที่ `node_type === "SERVICE_POINT"` เท่านั้น

**ตรวจสอบอิสระ (ไม่ใช่แค่เชื่อ agent report)**: อ่านโค้ด `RecordFormSheet.tsx`/`DataTable.tsx`/`resource.ts` เอง, รัน `npx eslint .` + `npx next build` ซ้ำเองจาก clean cache ผ่านทั้งคู่, login ผ่าน browser จริงแล้วเช็ค Node KIOSK→SERVICE_POINT transition กับ StaffUser edit-form password behavior ด้วยตัวเอง ตรงกับที่ agent รายงานทุกจุด

### Definition of Done — ผ่านแล้ว

สร้าง/แก้ไข/ลบ Building, Floor, Node, Edge, CareCategory, PathwayTemplate, TemplateStep (รวม
กำหนด prerequisite), ServiceSchedule, StaffUser, ServicePointStaff ได้จริงผ่านหน้า Admin
ข้อมูลอยู่ถาวรใน SQLite (verify: reload หน้า เห็นของเดิม)

---

## Phase 2 — Admin: Visit & Queue

Phase นี้มี business logic เยอะที่สุด — เป็นหัวใจของระบบ ควร review ก่อนไป phase 3

### Backend

**visits**
- `Patient`: CRUD ปกติ + endpoint ค้นหาด้วย `hn_code` (สำหรับตอนลงทะเบียนเช็คว่าเคยมีในระบบหรือยัง)
- `Visit`: สร้างผ่าน custom serializer ไม่ใช่ plain CRUD เพราะตอนสร้างต้อง:
  1. generate `qr_token` แบบสุ่ม (เช่น `secrets.token_urlsafe(48)`) ไม่ให้ client ส่งมาเอง
  2. **snapshot `VisitStep` จาก `TemplateStep` ของ `pathway_template` ที่เลือก** — copy `sequence_order` + `service_point` ทุกแถว แล้ว map `prerequisite_steps` (M2M ข้าม template→visit ต้อง translate id ใหม่ ไม่ใช่ copy id ตรง ๆ)
  3. ตั้ง `status = REGISTERED`
- `VisitStep`: ไม่มี endpoint update ทั่วไป ให้ทำเป็น action เฉพาะ: `POST /api/visits/steps/{id}/start`, `POST /api/visits/steps/{id}/complete`, `POST /api/visits/steps/{id}/skip` — ทุก action ต้องเช็คกติกาใน MODELS.md § 3: "เริ่มได้ก็ต่อเมื่อ prerequisite_steps ทุกตัว status=DONE" (โยน 400 ถ้าเงื่อนไขไม่ผ่าน)

**queues**
- `Queue`: get-or-create อัตโนมัติต่อ `(service_point, queue_date=today)` ไม่ต้องมี endpoint create ตรง ๆ ให้ผูกเข้ากับตอนสร้าง `QueueTicket` แทน
- `QueueTicket`: สร้างอัตโนมัติเมื่อ `VisitStep` ถูก `start` (เชื่อม `visit_step` แบบ `OneToOne` ตาม model) — `ticket_number` ให้ auto-increment ต่อ `Queue` ของวันนั้น
- Action เฉพาะ: `POST /api/queues/{id}/call-next` (เลื่อน `Queue.current_number`, เปลี่ยน ticket ที่เกี่ยวข้องเป็น `CALLED`, set `called_at`), `POST /api/queue-tickets/{id}/serve`, `POST /api/queue-tickets/{id}/done`

### Frontend

- `/admin/visits`: ฟอร์มลงทะเบียน (ค้นหา/สร้าง Patient → เลือก PathwayTemplate → submit สร้าง Visit) + รายการ Visit วันนี้ + หน้า detail แสดง step timeline พร้อมปุ่ม start/complete/skip (นำ [StepTimeline](frontend/components/portal/StepTimeline.tsx) มาปรับใช้ฝั่ง Admin ได้ เพราะ grouping ตาม `sequenceOrder` ใช้ตรรกะเดียวกัน)
- `/admin/queue`: เลือกจุดบริการ (จาก `ServicePointStaff` ของ user ปัจจุบัน — มี session จริงแล้วตั้งแต่ Phase 0 — หรือ dropdown ทั้งหมดถ้ายังไม่ได้ผูก assignment) → แสดง current number + ปุ่มเรียกคิวถัดไป + รายการ ticket ที่กำลังรอ

### Definition of Done

เจ้าหน้าที่ลงทะเบียนผู้ป่วยใหม่ → เลือกแผนการรักษา → ระบบสร้าง Visit พร้อม step ครบตาม
template อัตโนมัติ → เดินหน้าทีละ step ได้ตามกติกา prerequisite (กด start ข้าม step ที่ยังไม่พร้อมไม่ได้)
→ เรียกคิวจากหน้า Queue Console ได้จริง ตัวเลขอัปเดตถูกต้อง

---

## Phase 3 — Mobile (Patient Portal)

### Backend

- Endpoint อ่านอย่างเดียว แยก ViewSet ต่างหากจาก Admin: `GET /api/visits/by-token/{qr_token}` — `permission_classes = [AllowAny]` แบบถาวร (ไม่ใช่ของชั่วคราวแบบ Admin) ไม่ auth ตาม design แต่ **ห้าม** ใช้ path param ที่เดาง่าย ต้องเป็น `qr_token` (64 chars สุ่ม) เท่านั้น ห้าม expose ผ่าน `Visit.id` แบบ sequential
- Response รวม nested: patient info, steps (พร้อม prerequisite เพื่อ group parallel ได้เหมือน mock ปัจจุบัน), next actionable step, queue ticket ปัจจุบัน (ถ้ามี) — ออกแบบ serializer ให้ shape ตรงกับ `VisitView` ใน [lib/portal-data.ts](frontend/lib/portal-data.ts) เพื่อ diff น้อยที่สุดตอน swap

### Frontend

- แทนที่ `getVisitByQrToken()` mock ด้วย fetch จริงใน `app/visit/[token]/page.tsx` (ยังเป็น server component ได้เหมือนเดิม)
- `PortalLocaleProvider` เปลี่ยน `initialLocale` จาก hardcode เป็นค่าจาก `visit.patient.preferred_language` ที่ backend ส่งมาจริง
- เพิ่ม polling (ตาม MODELS.md S6 ตัดสินใจแล้วว่าใช้ frontend polling ไม่ทำ push) — client component ดึงคิว/สถานะ step ซ้ำทุก ~10s ด้วย `setInterval` + `fetch` (pattern เดียวกับ health check ใน `app/page.tsx`)

### Definition of Done

เปิด `/visit/<qr_token จริงจาก DB>` เห็นข้อมูลตรงกับที่เจ้าหน้าที่เพิ่งลงทะเบียน/อัปเดตใน Admin
(phase 2) และเห็นการเปลี่ยนแปลงคิว/step โดยไม่ต้อง refresh มือ (polling)

---

## Phase 4 — Kiosk Portal

### Backend

- Endpoint หา kiosk ด้วย `device_code`: `GET /api/facility/kiosks/{device_code}` (query `Node` filter `node_type=KIOSK`) — ใช้แสดง device label เหมือนเดิม
- Scan flow ใช้ endpoint เดียวกับ phase 3 (`by-token`) — ไม่ต้องสร้าง endpoint ใหม่ เพราะผลลัพธ์ที่ต้องการเหมือนกันทุกประการ
- (ถ้าต้องการ track ตำแหน่งผู้ป่วยจาก kiosk) เพิ่ม `PATCH /api/visits/{id}/current-node` ให้ kiosk ยิงอัปเดต `Visit.current_node` เป็น node ของ kiosk ตอน scan สำเร็จ — งานนี้เป็น nice-to-have ไม่ block DoD

### Frontend

- `KioskView` ตอนนี้มีปุ่ม demo "จำลองการสแกนสำเร็จ" ล้วน ๆ — สิ่งที่ต้องทำใน phase นี้คือเพิ่ม
  **manual fallback**: ช่อง input กรอก `qr_token`/HN ที่ปุ่ม "หรือแตะหน้าจอเพื่อกรอกเลข HN" (มี UI
  อยู่แล้วในมockup) ให้ยิง fetch จริงไปที่ endpoint เดียวกับ patient portal
- การอ่านกล้อง/ถอดรหัส QR จริงในเบราว์เซอร์ **ไม่รวมอยู่ใน phase นี้** ย้ายไป **Phase 6** ทั้งหมด

### Definition of Done

กรอก `qr_token`/HN จริงที่หน้าจอ kiosk (หรือกดปุ่ม demo ที่ยัง fetch ของจริงแทน mock) แล้วเห็นข้อมูล
visit เดียวกับที่ patient portal เห็น, กด "เสร็จแล้ว กลับสู่หน้าหลัก" reset กลับหน้าสแกนได้

---

## Phase 5 — Facility Edge Visual Editor

งานที่ตัดออกจาก Phase 1 มาไว้ตรงนี้: เครื่องมือ "ลาก" ตำแหน่ง Node และวาดเส้น Edge บนภาพผังพื้น
ตามที่ระบุไว้ใน [MODELS.md § 1](MODELS.md) (`Floor.plan_image`, `Floor.plan_scale_m_per_px`)

### Backend

- Endpoint อัปโหลด `Floor.plan_image` ต้องเปิด `MultiPartParser`/`FormParser` บน `FloorViewSet` (ฟิลด์นี้เป็น `ImageField` — CRUD serializer ปกติจาก phase 1 อาจต้องปรับ parser class เพิ่ม)
- (ถ้าต้องการ auto-calc) endpoint หรือ serializer method คำนวณ `Edge.distance_m` จาก `pos_x`/`pos_y` ของ `from_node`/`to_node` × `Floor.plan_scale_m_per_px` ให้อัตโนมัติเมื่อแอดมินไม่กรอกระยะเอง (ตามที่ MODELS.md ระบุไว้)

### Frontend

- Canvas/SVG overlay บนรูป `plan_image`: แสดงตำแหน่ง Node ปัจจุบัน (จาก `pos_x`/`pos_y`), ลากเพื่อย้ายตำแหน่ง (อัปเดตกลับด้วย `PATCH`), คลิก 2 Node เพื่อสร้าง Edge ระหว่างกัน
- เครื่องมือ calibrate scale: ลากเส้นบนภาพเทียบกับระยะจริงที่กรอก แล้วคำนวณ/บันทึก `plan_scale_m_per_px`

### Definition of Done

อัปโหลดภาพผังพื้นให้ Floor หนึ่งชั้น, ลากวางตำแหน่ง Node บนภาพได้ตรงจุดจริง, วาด Edge เชื่อม
Node สองจุดแล้วระบบคำนวณ `distance_m` ให้อัตโนมัติจาก scale ที่ calibrate ไว้

---

## Phase 6 — Kiosk: กล้องสแกน QR จริง

ต่อยอดจาก Phase 4 (ซึ่งใช้ manual input ไปก่อน) ให้ใช้กล้องของอุปกรณ์ kiosk อ่าน QR จริง

### Backend

ไม่มี endpoint ใหม่ — ใช้ `by-token` endpoint เดิมจาก Phase 3 ต่อ (ผลลัพธ์ที่ต้องการเหมือนกันทุกประการ
ไม่ว่าจะได้ token มาจากการพิมพ์มือหรือสแกนกล้อง)

### Frontend

- เพิ่ม lib ถอดรหัส QR จากภาพวิดีโอ (`jsQR` หรือ `@zxing/browser`) เปิดกล้องผ่าน `getUserMedia`
- **ข้อกำหนดสภาพแวดล้อม**: ต้องรันบน HTTPS (หรือ `localhost`) เท่านั้น กล้องถึงจะขอ permission ได้ — ต้องเช็ค deployment ของ kiosk จริงว่ามี TLS ก่อน
- แทนที่ปุ่ม demo ใน `KioskView` ด้วย live camera preview + auto-decode → เรียก endpoint เดียวกับที่ manual fallback ใช้ทันทีที่อ่าน QR ได้ ไม่ต้องกดปุ่มเพิ่ม
- คง manual fallback (Phase 4) ไว้เป็นทางเลือกสำรอง กรณีกล้องเสีย/แสงไม่พอ/สแกนไม่ติด

### Definition of Done

ยื่น QR code (จอมือถือหรือใบนัดที่พิมพ์) ให้กล้อง kiosk เห็น ระบบ decode แล้วดึงข้อมูล visit
ขึ้นจออัตโนมัติโดยไม่ต้องกดปุ่มใด ๆ เพิ่ม

---

## การแบ่งงาน / รันแบบ subagent

- **แต่ละ Phase รันตามลำดับ** สำหรับ 0→1→2→3→4 (2 ต้องรอ 1 เสร็จเพราะ Visit ผูก PathwayTemplate/Node, 3 ต้องรอ 2 เพราะต้องมี Visit จริงให้ดึง, 4 รอ 3 เพราะ endpoint เดียวกัน) — **อย่าข้ามลำดับ**
- **Phase 5** พึ่งแค่ Phase 1 (ต้องมี Building/Floor/Node/Edge CRUD ก่อน) ไม่ต้องรอ Phase 2-4 เลย ถ้าอยากทำคู่ขนานไปกับ Phase 2-4 ก็ได้
- **Phase 6** พึ่ง Phase 4 อย่างเดียว (ต้องมี manual scan flow ทำงานได้ก่อน ค่อยเสริมกล้อง)
- **ภายใน phase เดียวกัน** แบ่งเป็น 2 subagent ขนานกันได้:
  1. **Backend agent** — serializers/viewsets/urls/migration (ถ้าจำเป็น)/`curl` smoke test
  2. **Frontend agent** — เขียน UI จริงโดยอิง response shape ที่ตกลงไว้ล่วงหน้า (ใช้ mock shape เดิมใน `lib/portal-data.ts` เป็น contract ตั้งต้นสำหรับ phase 3-4 เพราะออกแบบให้ตรงกันไว้แล้ว)
- แนะนำให้ review/approve ทีละ Phase ก่อนเริ่ม Phase ถัดไป โดยเฉพาะ **Phase 2** ที่มี business logic ซับซ้อน (prerequisite gating, queue numbering, snapshot logic) ควรเทสก่อนต่อยอด

---

## Decision log

1. **Auth ฝั่ง Admin** — ทำ login จริงตาม role (session-based, รายละเอียดอยู่ใน Phase 0) แต่ DRF
   `permission_classes` ยังคง `AllowAny` ทุก endpoint ไม่บังคับสิทธิ์ระดับ role ใน MVP นี้ — frontend
   เป็นคน gate การเข้าถึงหน้า `/admin/*` ด้วย redirect เท่านั้น
2. **Edge/ผังเส้นเชื่อมแบบลาก (visual editor)** — แยกเป็น **Phase 5** ต่างหาก Phase 1 เหลือแค่
   list/form ธรรมดาสำหรับ Edge
3. **Kiosk camera scanning จริง** — แยกเป็น **Phase 6** ต่างหาก Phase 4 ใช้ manual input fallback
   พอสำหรับตอนนี้
