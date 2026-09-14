# Supabase PostgreSQL สำหรับผู้รับช่วงโปรเจกต์

เริ่มจาก [README หลัก](../../../README.md) ซึ่งอธิบายเครื่องมือที่ต้องติดตั้ง การตั้ง `.env` และการเปิด frontend/backend ทีละขั้น

## ไฟล์สำหรับ Supabase SQL Editor

| ลำดับ | ไฟล์ | ทำเมื่อใด |
| --- | --- | --- |
| 1 | [`01_schema_baseline.sql`](sql-editor/01_schema_baseline.sql) | Supabase โปรเจกต์ใหม่ที่ยังไม่มีตารางแอป |
| — | `php artisan migrate` แล้วรัน Seeder 2 ตัว | รันจากเครื่องที่ติดตั้ง Laravel ไม่ใช่ใน SQL Editor |
| 2 | [`02_secure_public_api.sql`](sql-editor/02_secure_public_api.sql) | หลัง migration/seed เพื่อป้องกันการอ่านตารางผ่าน Data API โดยตรง |
| 3 | [`03_verify_setup.sql`](sql-editor/03_verify_setup.sql) | ตรวจให้ทุกผลเป็น `OK` |
| 4 | [`04_promote_google_admin.sql`](sql-editor/04_promote_google_admin.sql) | เฉพาะเมื่อผู้ดูแลล็อกอิน Google ครั้งแรกแล้ว; แก้อีเมลก่อนรัน |

ไฟล์ `01_schema_baseline.sql` สร้างเชิงกลจาก snapshot เก่าด้วย [`build_supabase_sql_editor_bootstrap.py`](../../scripts/build_supabase_sql_editor_bootstrap.py) โดยเลือก **เฉพาะโครงสร้างตาราง ประวัติ migration ตั้งต้น ดัชนี และ foreign key** ไม่มีแถวข้อมูลผู้ใช้หรือกิจกรรม ผู้รับช่วงทั่วไปใช้ไฟล์ SQL ที่ commit ไว้ได้เลย **ไม่ต้องมี Python หรือ snapshot เก่า** สคริปต์สร้างซ้ำมีไว้ให้ผู้ดูแลที่ถือ snapshot ในเครื่องที่เชื่อถือได้เท่านั้น

## ไฟล์เก่า — ไม่ใช้ในการส่งต่อบัญชีใหม่

- `plant_simulation_game_supabase.sql` คือ snapshot ที่มีข้อมูลบัญชีผู้ใช้และประวัติเดิม จึงถูก `.gitignore` และ **ไม่อยู่ใน clone ใหม่** ห้ามคัดลอกลง Supabase ของคนอื่นหรือส่งต่อเป็นชุดติดตั้ง
- `verify_supabase_import.sql` ตรวจจำนวนแถวของ snapshot เก่า ไม่ใช่ไฟล์ตรวจการติดตั้งใหม่
- `supabase_laravel_api_lockdown.sql` เป็นรายการตารางเก่าที่ไม่ครอบคลุม migration ใหม่ ให้ใช้ `sql-editor/02_secure_public_api.sql` สำหรับการติดตั้งใหม่แทน
- ไฟล์ SQL สร้างเฉพาะฐานข้อมูล **ไม่คัดลอก Supabase Storage**; รูปภาพและโมเดลที่อัปโหลดต้องย้ายแยกต่างหากผ่าน Storage API

อย่าใส่รหัสผ่านฐานข้อมูลหรือ Supabase Secret key ลงใน SQL/README หรือ commit `.env` ขึ้น repository
