# Development Login Credentials

บัญชีทดสอบสำหรับ Admin Portal (`http://localhost:3000/admin/login`) — ใช้กับ backend
dev เท่านั้น ข้อมูลอยู่ใน SQLite ของเครื่อง (`backend/db.sqlite3`, ไม่ได้ commit เข้า git)

## สร้าง / รีเซ็ต

```bash
cd backend
source venv/bin/activate
python manage.py createmvpuser
```

รันซ้ำได้ทุกเมื่อ ปลอดภัย — คำสั่งนี้จะ reset รหัสผ่านและ role ของบัญชีด้านล่างกลับเป็น
ค่าเริ่มต้นเสมอ (ดูโค้ดที่ [backend/accounts/management/commands/createmvpuser.py](backend/accounts/management/commands/createmvpuser.py))

## บัญชี

| Username | Password | Role |
|---|---|---|
| `admin` | `testpass123` | ADMIN (ผู้ดูแลระบบ) |
| `registrar` | `testpass123` | REGISTRAR (เวชระเบียน) |
| `service_staff` | `testpass123` | SERVICE_STAFF (ประจำจุดบริการ) |
| `executive` | `testpass123` | EXECUTIVE (ผู้บริหาร) |

⚠️ **สำหรับ local development เท่านั้น** — รหัสผ่านเดียวกันทุกบัญชีโดยตั้งใจเพื่อความง่ายตอน
ทดสอบ ห้ามใช้ pattern นี้ในสภาพแวดล้อม production
