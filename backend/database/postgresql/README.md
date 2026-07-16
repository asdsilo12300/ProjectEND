# PostgreSQL / Supabase migration

ชุดนี้แปลงฐานข้อมูล MariaDB เดิมเป็น PostgreSQL โดยเก็บข้อมูลครบทั้งหมด และไม่แก้ไข schema ระบบของ Supabase เช่น `auth`, `storage` หรือ `realtime`

## ไฟล์ในชุดนี้

- `plant_simulation_game_supabase.sql` — schema และข้อมูลจริงทั้งหมดสำหรับนำเข้า (ถูก ignore จาก Git เพราะมีข้อมูลผู้ใช้และ token)
- `verify_supabase_import.sql` — ตรวจจำนวนข้อมูล โครงสร้าง และค่า sequence หลังนำเข้า
- `conversion_manifest.json` — ยอดอ้างอิงและ SHA-256 ของไฟล์ต้นทาง/ผลลัพธ์
- `supabase_laravel_api_lockdown.sql` — ตัวเลือกเสริมสำหรับปิดการเข้าถึงตารางผ่าน Supabase Data API เมื่อให้ Laravel เป็น API หลักเพียงตัวเดียว
- `../../scripts/convert_mysql_dump_to_postgres.py` — ตัวแปลงที่ใช้สร้างไฟล์ใหม่ซ้ำได้

## ผลการแปลง

- 42 ตาราง / 418 คอลัมน์ / 18,348 แถว
- Primary key 42, unique index เดิม 19, secondary index 69, foreign key 53
- Identity sequence 39 ตาราง พร้อมค่า ID ถัดไปตรง MariaDB เดิม
- ENUM 19 คอลัมน์แปลงเป็น `text` พร้อม `CHECK`
- UNSIGNED 164 คอลัมน์คงเงื่อนไขห้ามติดลบไว้ด้วย `CHECK`
- Boolean 10 คอลัมน์ และ JSONB 5 คอลัมน์
- เพิ่ม unique index บน `lower(users.email)` เพื่อป้องกันอีเมลซ้ำต่างกันเฉพาะตัวพิมพ์

## 1. เตรียม Supabase

1. ใช้โปรเจกต์ Supabase ใหม่ หรือฐานที่ยังไม่มี 42 ตารางของแอปนี้ ไฟล์ import ตั้งใจไม่ใส่ `DROP TABLE` เพื่อป้องกันการลบข้อมูลโดยไม่ตั้งใจ
2. เปิดหน้า **Connect** ใน Supabase แล้วคัดลอกค่าของ Direct connection หรือ **Session pooler** พอร์ต `5432`
3. ใช้ Direct connection เมื่อเครื่องรองรับ IPv6 หรือใช้ Session pooler เมื่อเครือข่ายเป็น IPv4 เท่านั้น ห้ามใช้ Transaction pooler พอร์ต `6543` สำหรับ import/migration
4. ติดตั้ง PostgreSQL client (`psql`) ในเครื่องที่จะนำเข้า

`sslmode=require` จะเข้ารหัสการเชื่อมต่อ ส่วน production ที่ต้องการตรวจ CA และ hostname ด้วย ให้ดาวน์โหลด Supabase CA certificate แล้วใช้ `DB_SSLMODE=verify-full` กับ `DB_SSLROOTCERT` ตามตัวอย่างใน `.env.supabase.example`

เอกสารทางการ: [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres), [Import data](https://supabase.com/docs/guides/database/import-data)

## 2. นำเข้าข้อมูล

ใน PowerShell ให้ใส่ connection string จากหน้า Connect โดย URL-encode รหัสผ่านหากมีอักขระพิเศษ:

```powershell
$env:SUPABASE_DB_URL = 'postgresql://postgres.zmokkjietearvazacgjt:57210zxcWS+@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require'

psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "C:\ProjectEND\backend\database\postgresql\plant_simulation_game_supabase.sql"
```

ไฟล์หลักมี transaction ครอบทั้งชุด ถ้าคำสั่งใดผิดจะไม่บันทึกงานบางส่วน และ `ON_ERROR_STOP` จะหยุดทันทีเมื่อพบ error

## 3. ตรวจว่าข้อมูลครบ

```powershell
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "C:\ProjectEND\backend\database\postgresql\verify_supabase_import.sql"
```

ผลของทุกตารางและทุก sequence ต้องเป็น `OK` จากนั้นอัปเดตสถิติให้ PostgreSQL:

```powershell
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "ANALYZE;"
```

## 4. เชื่อม Laravel

1. PHP ของ server ต้องมี extension `pdo_pgsql` ตรวจด้วย `php -m` (PHP ในเครื่องนี้ยังไม่มี extension ดังกล่าว)
2. คัดลอกค่าที่จำเป็นจาก [`../../.env.supabase.example`](../../.env.supabase.example) ไปยัง `.env` จริง แล้วแทนค่า host, project ref และรหัสผ่าน
3. อย่าใส่รหัสผ่านฐานข้อมูลหรือ connection string ไว้ใน frontend
4. หลังแก้ `.env` ให้รัน:

```powershell
php artisan config:clear
php artisan migrate:status
```

ต้อง import ไฟล์ PostgreSQL ก่อนเสมอ เพราะ migration เดิมของโปรเจกต์ไม่มี baseline ที่สร้างตารางเกมทั้งหมด ฐานที่ import แล้วมีตาราง `migrations` ครบ 22 รายการ จึงค่อยใช้ `php artisan migrate --force` สำหรับ migration ใหม่ในอนาคตได้

## 5. ความปลอดภัยและข้อมูลชั่วคราว

ไฟล์ import เก็บข้อมูลตามต้นฉบับครบ รวมถึง password hash, session, cache และ OTP จึงไม่ควรส่งไฟล์ให้ผู้อื่นหรือ commit เข้า Git หลังย้าย production สำเร็จ แนะนำให้ยกเลิก session/OTP เก่าด้วยคำสั่งนี้เมื่อพร้อม:

```sql
TRUNCATE TABLE public.cache, public.cache_locks, public.sessions, public.password_reset_otps;
```

โปรเจกต์นี้ยังใช้ Laravel JWT/Auth ไม่ใช่ Supabase Auth ดังนั้นไม่ควรย้ายข้อมูล `public.users` เข้า `auth.users` โดยตรง หาก frontend ไม่ได้เรียก Supabase Data API ให้รัน `supabase_laravel_api_lockdown.sql` หลัง import เพื่อล็อกตารางสำหรับ Laravel-only architecture

## 6. ไฟล์รูปและโมเดล

SQL เก็บเพียง URL/path ของรูป โปรไฟล์ คอนเทนต์ snapshot และโมเดล ไฟล์จริงใน `backend/storage/app/public` ไม่ได้อยู่ใน database dump ต้องย้ายไฟล์เหล่านั้นแยกไปยัง server หรือ Supabase Storage และแก้ URL ที่ยังเป็น `localhost` ก่อนขึ้น production ห้ามแก้ตารางใน schema `storage` ด้วย SQL โดยตรง ให้ใช้ Storage API

## สร้างไฟล์ใหม่จาก dump อีกครั้ง

```powershell
python backend\scripts\convert_mysql_dump_to_postgres.py `
  --input "C:\Users\asdsi\Downloads\plant_simulation_game (11).sql" `
  --output-dir "backend\database\postgresql"
```

ตรวจ SHA-256 และยอดแต่ละตารางจาก `conversion_manifest.json` ทุกครั้งก่อนนำเข้า
