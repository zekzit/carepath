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

### Backend — เสร็จแล้ว (ทดสอบผ่าน curl ทั้ง happy-path และ error case)

**visits**
- [x] `Patient`: CRUD ปกติ + `GET /api/visits/patients?hn_code=...` (icontains filter)
- [x] `Visit`: `VisitSerializer.create()` — generate `qr_token` (`secrets.token_urlsafe(48)`), snapshot `VisitStep` จาก `TemplateStep` ของ `pathway_template` ที่เลือก (copy `sequence_order`/`service_point`, remap `prerequisite_steps` จาก TemplateStep id → VisitStep id ใหม่ — ทดสอบแล้วว่า map ถูกต้อง), ตั้ง `status=REGISTERED` ทั้งหมดอยู่ใน `transaction.atomic`
- [x] `VisitStep`: `ReadOnlyModelViewSet` (ไม่มี PATCH ทั่วไปตามแผน) + action `POST /api/visits/visit-steps/{id}/start|complete|skip` — `start` เช็ค prerequisite ทุกตัว `status=DONE` จริง (ทดสอบ reject เมื่อยังไม่ครบ, ทดสอบว่า prerequisite ที่ถูก **SKIPPED ไม่ถือว่านับ** ตาม MODELS.md ที่ระบุ "DONE" ตรง ๆ ไม่ใช่ "DONE หรือ SKIPPED") `start` ยังสร้าง `QueueTicket` ให้อัตโนมัติและเลื่อน `Visit.status` เป็น `IN_PROGRESS` ถ้ายังเป็น `REGISTERED`
- [x] `visits/services.py` (ใหม่) — `complete_step()`/`skip_step()`/`sync_visit_completion()` เป็นจุดเดียวที่ mark step เสร็จ ใช้ร่วมกันทั้งจาก `VisitStep.complete` action และจาก `QueueTicket.done` action (ทดสอบแล้วว่า sync ถูกทั้งสองทาง) — `sync_visit_completion` เปลี่ยน `Visit.status` เป็น `COMPLETED` อัตโนมัติเมื่อทุก step เป็น DONE/SKIPPED ครบ (ไม่ได้อยู่ใน MODELS.md ตรง ๆ แต่เป็นส่วนต่อที่สมเหตุสมผลเพราะ model มี status นี้อยู่แล้ว)

**queues**
- [x] `Queue`: `ReadOnlyModelViewSet`, ไม่มี create endpoint ตรง ๆ (get-or-create อัตโนมัติใน `queues/services.py::ensure_ticket_for_step` ตอน `VisitStep.start`) list default = วันนี้เท่านั้น เว้นแต่ส่ง `?queue_date=`
- [x] `QueueTicket`: `ticket_number` auto-increment ต่อ `Queue` (`Max(ticket_number)+1`), action `POST /api/queues/queue-tickets/{id}/serve` (`CALLED→SERVING`), `POST /api/queues/queue-tickets/{id}/done` (เรียก `visits.services.complete_step` ตรง ๆ — จุดเดียวกับที่ `VisitStep.complete` ใช้)
- [x] action `POST /api/queues/queues/{id}/call-next` — เลื่อน ticket `WAITING` ตัวถัดไป (`ticket_number` น้อยสุด) เป็น `CALLED`, set `called_at`, sync `Queue.current_number`

**API ที่ใช้ได้จริงตอนนี้** (เพิ่มจาก Phase 1, `AllowAny`, ไม่มี trailing slash):
```
GET/POST/PATCH/DELETE   /api/visits/patients, /api/visits/patients/{id}
GET/POST/PATCH/DELETE   /api/visits/visits, /api/visits/visits/{id}
GET                     /api/visits/visit-steps?visit={id}
POST                    /api/visits/visit-steps/{id}/start|complete|skip
GET                     /api/queues/queues?service_point={id}&queue_date=YYYY-MM-DD (default: today)
POST                    /api/queues/queues/{id}/call-next
GET                     /api/queues/queue-tickets?queue={id}
POST                    /api/queues/queue-tickets/{id}/serve|done
```

### Frontend — เสร็จแล้ว (ทดสอบผ่าน browser จริง + cross-check ด้วย curl)

- [x] `/admin/visits` (`components/admin/visits/`) — `RegisterVisitForm.tsx` (ค้นหา patient ด้วย HN แบบ live search debounce 300ms → สร้าง patient ใหม่ inline ถ้าไม่เจอ → เลือก PathwayTemplate + วันที่ (default วันนี้) + wheelchair → submit สร้าง Visit), `VisitsList.tsx` (รายการ, filter ตามวันที่ได้), `VisitDetail.tsx` + `AdminStepTimeline.tsx` (group ตาม `sequence_order` แบบเดียวกับ [StepTimeline](frontend/components/portal/StepTimeline.tsx) แต่เขียนใหม่เพราะ data shape ไม่ตรงกัน — มีปุ่ม start/complete/skip ต่อ step, เช็ค eligibility ฝั่ง client ตรงตามกติกา backend รวมถึงเคส SKIPPED ไม่นับเป็น prerequisite ที่ผ่าน)
- [x] `/admin/queue` (`components/admin/queue/QueueConsolePage.tsx`) — เลือกจุดบริการ (SERVICE_POINT node เท่านั้น) → แสดง current_number + เรียกคิวถัดไป (จัดการ state "ยังไม่มีคิววันนี้" ให้ด้วย) → รายการ ticket พร้อมชื่อผู้ป่วย (resolve จาก ticket→visit_step→visit→patient โดย fetch ลิสต์มา cross-reference ไม่ waterfall ทีละ ticket) + ปุ่ม serve/done ตาม status
- [x] เพิ่ม `lib/api/visits.ts` (Patient/Visit/VisitStep types + resource client + action helper สำหรับ start/complete/skip) และเพิ่ม Queue/QueueTicket เข้า `lib/api/queues.ts`
- [x] i18n key ใหม่ทั้งหมดอยู่ใน `messages/th.json`/`en.json` ครบทั้งสองภาษา

**ตรวจสอบอิสระ (ทำเองอีกรอบ ไม่ได้เชื่อ agent report เฉย ๆ)**: อ่านโค้ด `AdminStepTimeline.tsx`/`RegisterVisitForm.tsx` เอง, รัน `eslint`+`next build` (clean cache) ซ้ำเองผ่านทั้งคู่, แล้วเดินสถานการณ์จริงผ่าน browser เองตั้งแต่ต้นจนจบ: เปิด step ที่ 2 (เอกซเรย์) หลัง prerequisite เสร็จ → ไปหน้า Queue Console เรียกคิว → ให้บริการ → กดเสร็จสิ้น แล้วยืนยันผ่าน `curl` ตรงว่า `VisitStep` เปลี่ยนเป็น `DONE` พร้อม `completed_at` และ `Visit` เปลี่ยนเป็น `COMPLETED` จริง ตรงกับที่ agent รายงานทุกจุด

### Definition of Done — ผ่านแล้ว

เจ้าหน้าที่ลงทะเบียนผู้ป่วยใหม่ → เลือกแผนการรักษา → ระบบสร้าง Visit พร้อม step ครบตาม
template อัตโนมัติ → เดินหน้าทีละ step ได้ตามกติกา prerequisite (กด start ข้าม step ที่ยังไม่พร้อมไม่ได้)
→ เรียกคิวจากหน้า Queue Console ได้จริง ตัวเลขอัปเดตถูกต้อง

---

## Phase 3 — Mobile (Patient Portal)

### Backend — เสร็จแล้ว (ทดสอบผ่าน curl ทุก state)

- [x] `GET /api/visits/by-token/{qr_token}` (`visits/views.py::visit_by_token`) — plain `@api_view` แยกจาก Admin ViewSet ทั้งหมด, `AllowAny` ถาวร, lookup ด้วย `qr_token` เท่านั้น (404 ถ้าไม่เจอ ไม่ใช่ 500) ไม่ผ่าน `Visit.id`
- [x] `serialize_public_visit(visit)` เขียนเป็นฟังก์ชัน compose ธรรมดา (ไม่ใช่ DRF Serializer เพราะข้าม 5 model) คำนวณ `next_step` เอง: ให้ความสำคัญ step ที่ `IN_PROGRESS` ก่อน ถ้าไม่มีค่อยหา step แรกที่ `PENDING` และ prerequisite ครบ `DONE` ทั้งหมด (กติกาเดียวกับ Admin's start action ทุกตัว — SKIPPED ไม่นับ) ถ้าไม่มี step ไหนเข้าเงื่อนไขเลย (visit เสร็จหมดแล้ว) คืน `next_step: null` — ทดสอบครบทั้ง 3 สถานะ: (1) ไม่มี next_step, (2) มี next_step แต่ยัง `PENDING`/ไม่มีตั๋วคิว (ยังไม่ถูก start), (3) `IN_PROGRESS` พร้อม `queue_ticket`
- [x] เขียนไว้ให้ Kiosk (Phase 4) เรียก endpoint เดียวกันนี้ได้เลย (`serialize_public_visit` เป็น named function แยก ไม่ผูกกับ view)

**Response shape ที่ทดสอบแล้ว** (ดู [frontend/lib/api/public-visit.ts](frontend/lib/api/public-visit.ts) สำหรับ TypeScript type คู่กัน):
```jsonc
{
  "qr_token": "...", "status": "IN_PROGRESS", "visit_date": "2026-09-19", "uses_wheelchair": false,
  "patient": { "full_name": "...", "hn_code": "...", "preferred_language": "th" },
  "steps": [ { "id": 9, "sequence_order": 1, "status": "IN_PROGRESS", "prerequisite_steps": [],
               "started_at": "...", "completed_at": null,
               "service_point": { "id": 1, "name_th": "...", "name_en": "...", "department_th": "...", "department_en": "..." } } ],
  "next_step": { /* same shape as one item of steps[], or null */ },
  "queue_ticket": { "ticket_number": 4, "status": "WAITING", "current_number": 2 } // or null
}
```

หมายเหตุ: **ไม่มี field `walkTimeMinutes`/`avgWaitMinutes`/`remaining` สำเร็จรูปจาก backend** — เพราะไม่มี routing engine คำนวณระยะทางจริง (Edge model มี `distance_m`/`walk_time_sec` แต่ยังไม่มี pathfinding logic ใช้งาน อยู่นอก scope ทั้งแผนนี้) และไม่มี field เก็บสถิติเวลารอเฉลี่ย — ส่วน "เหลืออีกกี่คิว" คำนวณฝั่ง frontend ได้ตรง ๆ จาก `ticket_number - current_number` ตามที่ MODELS.md S6 ระบุไว้แล้ว

### Frontend — เสร็จแล้ว (ทดสอบผ่าน browser จริง + cross-check ด้วย curl, ครบทั้ง 3 state)

- [x] `lib/api/public-visit.ts` (ใหม่) — type ตรงกับ response จริง + `fetchVisitByTokenServer()`/`fetchVisitByTokenClient()` ตามที่ออกแบบไว้ + `serviceStepLocationName()` helper (เลือก `department_th/en` ก่อน ถ้าว่างค่อย fallback ไป `name_th/en`)
- [x] `app/visit/[token]/page.tsx` — fetch ฝั่ง server ครั้งแรก, `notFound()` ถ้าไม่เจอ token (ทดสอบ token มั่ว ได้ 404 จริง ไม่ crash)
- [x] `PatientPortalView.tsx` — stateful, polling ทุก 10s, locale จาก `preferred_language` จริง
- [x] `StepTimeline.tsx`/`NextStepCard.tsx`/`QueueWidget.tsx` ปรับ field ใหม่ครบ + เพิ่ม `SKIPPED` status handling + 2 สถานะใหม่ (complete-card เมื่อ `next_step===null`, ข้อความ "ยังไม่ได้รับหมายเลขคิว" เมื่อยังไม่มีตั๋ว)
- [x] Kiosk demo data (`KioskView.tsx`/`app/kiosk/[deviceCode]/page.tsx`) ปรับ shape ตามใหม่ ไม่แตะ behavior อื่น
- [x] ลบ mock เดิม (`VisitView`/`VisitStepView`/`getVisitByQrToken`/`MOCK_VISIT`) ออกจาก `lib/portal-data.ts` เก็บ `KioskDevice`/`getKioskByDeviceCode` ไว้ (ยัง Phase 4 scope)
- [x] **เจอและแก้บั๊กที่เกี่ยวข้องระหว่างทาง**: [lib/api/client.ts](frontend/lib/api/client.ts)'s `apiFetch` เดิมจะยัด `Content-Type: application/json` ทับทุก body รวมถึง `FormData` — จะพังตอน Phase 5 อัปโหลดไฟล์ แก้ให้ข้าม `FormData` แล้ว (แก้พร้อมกับตอนเตรียม Phase 5 backend)

**ตรวจสอบอิสระ (ทำเองอีกรอบ)**: อ่านโค้ด `public-visit.ts` เอง, รัน `eslint`+`next build` (clean cache) ซ้ำเองผ่านทั้งคู่, สร้าง Visit ใหม่จริงแล้วเปิด `/visit/<token>` เห็น state 2 ถูกต้อง (มี next step แต่ยังไม่มีคิว), สั่ง `start` ผ่าน API ตรง ๆ แล้ว**ปล่อยหน้าเว็บทิ้งไว้เฉย ๆ ไม่ reload** รอ 10 วินาที เห็น UI เปลี่ยนเป็น state 3 เอง (มีเลขคิวจริง, คำนวณ "อีกประมาณ N คิว" ถูกต้องตรงกับ `ticket_number - current_number`) — ยืนยัน polling ทำงานจริง ไม่ใช่แค่ตามที่ agent รายงาน

### Definition of Done — ผ่านแล้ว

เปิด `/visit/<qr_token จริงจาก DB>` เห็นข้อมูลตรงกับที่เจ้าหน้าที่เพิ่งลงทะเบียน/อัปเดตใน Admin
(phase 2) และเห็นการเปลี่ยนแปลงคิว/step โดยไม่ต้อง refresh มือ (polling)

---

## Phase 4 — Kiosk Portal

### Backend — เสร็จแล้ว (ทดสอบผ่าน curl)

- [x] `GET /api/facility/kiosks/{device_code}` (`facility/views.py::kiosk_by_device_code`) — หา `Node` ที่ `node_type=KIOSK` ด้วย `device_code`, คืน `{device_code, name_th, name_en}`, 404 ถ้าไม่เจอหรือ node_type ไม่ตรง (ทดสอบทั้งสองเคส)
- [x] **เพิ่มเติมจากแผนเดิม**: `GET /api/visits/by-hn-today/{hn_code}` (`visits/views.py::visit_by_hn_today`) — เหตุผลที่ต้องมี: `qr_token` เป็นสตริงสุ่ม 64 ตัวอักษร ไม่มีทางให้ผู้ป่วย "พิมพ์" เองได้จริงตอนใช้ manual fallback ตามที่ระบุไว้เดิม ("กรอก qr_token/HN") จึงต้องมี path ค้นด้วย HN แทน — หา Visit ของวันนี้เท่านั้น (ไม่ใช่ทั้งประวัติ เพื่อจำกัดขอบเขตข้อมูลที่ endpoint แบบไม่ auth จะเปิดเผยได้จาก HN ซึ่งไม่ใช่ค่าสุ่มเหมือน qr_token) ใช้ `serialize_public_visit()` ตัวเดียวกับ Phase 3 ทั้งหมด คืน response shape เหมือนกันเป๊ะ — ทดสอบครบ (เจอ, ไม่เจอ HN, เจอ HN แต่ไม่มีนัดวันนี้)
- [x] Scan flow (ทั้งกล้องจริงใน Phase 6 และ manual fallback ใน phase นี้) ใช้ endpoint เดียวกับ Phase 3 ทั้งคู่ ไม่ต้องสร้างใหม่
- ไม่ได้ทำ `PATCH .../current-node` (nice-to-have ตามแผนเดิม ไม่ block DoD)

### Frontend

- [x] `KioskView.tsx` — ปุ่ม "หรือแตะหน้าจอเพื่อกรอกเลข HN" ตอนนี้เป็นปุ่มจริง เปิดหน้าจอกรอก HN (`ManualEntryScreen`) แยกจากปุ่ม demo เดิม (ปุ่ม demo ยังคงใช้ `demoVisit` mock ตามเดิม ไม่เปลี่ยน — เพื่อให้ยังมีทางทดสอบ UI แบบไม่ต้องพึ่งข้อมูลจริงในระบบ) กรอก HN แล้วยิง `fetchVisitByHnTodayClient()` (ใหม่ ใน `lib/api/public-visit.ts`) ไปที่ `GET /api/visits/by-hn-today/{hn_code}` เจอแล้วโชว์ผลแบบเดียวกับ demo, ไม่เจอแสดงข้อความ error อยู่หน้าเดิม (ไม่ crash)
- การอ่านกล้อง/ถอดรหัส QR จริงในเบราว์เซอร์ **ไม่รวมอยู่ใน phase นี้** ย้ายไป **Phase 6** ทั้งหมด

**ตรวจสอบแล้ว** (ทำเอง ไม่ได้ผ่าน subagent เพราะ scope เล็กพอทำตรงได้ และเลี่ยงชนไฟล์ `messages/*.json` กับ Phase 5 ที่รันขนานกัน): `eslint`+`next build` clean, ทดสอบผ่าน browser จริง — กรอก HN ที่มีนัดวันนี้จริงเจอข้อมูลตรงกับ Patient Portal เป๊ะ (เลขคิว/current_number ตรงกัน), กรอก HN ที่ไม่มีนัดวันนี้ขึ้น error message ถูกต้อง ไม่ crash, reset กลับหน้าแรกได้ปกติ

### Definition of Done — ผ่านแล้ว

กรอก HN จริงที่หน้าจอ kiosk แล้วเห็นข้อมูล visit เดียวกับที่ patient portal เห็น, กด "เสร็จแล้ว
กลับสู่หน้าหลัก" reset กลับหน้าสแกนได้

---

## Phase 5 — Facility Edge Visual Editor

งานที่ตัดออกจาก Phase 1 มาไว้ตรงนี้: เครื่องมือ "ลาก" ตำแหน่ง Node และวาดเส้น Edge บนภาพผังพื้น
ตามที่ระบุไว้ใน [MODELS.md § 1](MODELS.md) (`Floor.plan_image`, `Floor.plan_scale_m_per_px`)

### Backend — เสร็จแล้ว (ทดสอบผ่าน curl)

- [x] `Floor.plan_image` เปิดใช้งานใน `FloorSerializer` แล้ว — **ไม่ต้องเปิด `MultiPartParser`/`FormParser` เพิ่มเองอย่างที่แผนเดิมคาดไว้** เพราะ DRF's `DEFAULT_PARSER_CLASSES` (ค่า default ของ framework เอง ไม่ได้ override ใน settings.py) รวม `MultiPartParser`/`FormParser` อยู่แล้ว ทดสอบอัปโหลดจริงผ่าน `curl -F` สำเร็จ ได้ URL เต็ม (`http://127.0.0.1:8000/media/floor_plans/...`) กลับมาใน response พร้อมใช้เป็น `<img src>` ตรง ๆ
- [x] `Edge.distance_m` เป็น optional แล้วใน `EdgeSerializer.validate()` — auto-calculate จาก `pos_x`/`pos_y` ของ `from_node`/`to_node` × `from_node.floor.plan_scale_m_per_px` เมื่อไม่ได้ส่งมา (ทดสอบตรงกับการคำนวณ Pythagorean ด้วยมือ) — **เงื่อนไข**: ทั้งสอง node ต้องอยู่ `floor` เดียวกัน และ floor นั้นต้อง calibrate scale ไว้แล้ว ไม่งั้น 400 ให้กรอกเอง (ทดสอบทั้งเคส auto-calc สำเร็จ, เคส floor ไม่ได้ calibrate ต้อง reject, และเคสกรอก `distance_m` เองยังทำงานตามปกติ)

**อัปเดต API contract จาก Phase 1**: `PATCH /api/facility/floors/{id}` รับ `plan_image` เพิ่มได้แล้ว (multipart), `POST/PATCH /api/facility/edges` รับ `distance_m` เป็น optional แล้ว

### Frontend — ยังไม่ได้ทำ

- Canvas overlay บนรูป `plan_image`: แสดงตำแหน่ง Node ปัจจุบัน (จาก `pos_x`/`pos_y`), ลากเพื่อย้ายตำแหน่ง (อัปเดตกลับด้วย `PATCH`), เลือก 2 Node เพื่อสร้าง Edge ระหว่างกัน (เว้น `distance_m` ว่างให้ backend auto-calc)
- เครื่องมือ calibrate scale: คลิก 2 จุดบนภาพเทียบกับระยะจริงที่กรอก แล้วคำนวณ/บันทึก `plan_scale_m_per_px`
- อัปโหลด `plan_image` ต้องส่งเป็น `FormData` ตรง ๆ ผ่าน `apiFetch` (แก้ [lib/api/client.ts](frontend/lib/api/client.ts) แล้วให้ไม่ยัด `Content-Type: application/json` ทับ `FormData` body — เดิมมีบั๊กนี้อยู่ พบและแก้แล้วระหว่างเตรียม phase นี้) **ห้ามใช้ `createResourceClient`** สำหรับ upload เพราะมัน `JSON.stringify` ทุกครั้ง

### Definition of Done

อัปโหลดภาพผังพื้นให้ Floor หนึ่งชั้น, ลากวางตำแหน่ง Node บนภาพได้ตรงจุดจริง, วาด Edge เชื่อม
Node สองจุดแล้วระบบคำนวณ `distance_m` ให้อัตโนมัติจาก scale ที่ calibrate ไว้ (backend ผ่านแล้ว
รอ frontend)

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
