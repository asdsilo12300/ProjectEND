# เว็บไซต์ระบบจำลองการเจริญเติบโตของพืชเพื่อการเรียนรู้และสร้างปฏิสัมพันธ์

เว็บจำลองการปลูกพืช 3 มิติ มีห้องทดลอง 3 โหมด คู่มือพืช ร้านค้า ประวัติการทดลอง ชุมชน และหน้าผู้ดูแลระบบ ฝั่งเว็บใช้ **React + Vite** ฝั่ง API ใช้ **Laravel** และฐานข้อมูลใช้ **PostgreSQL บน Supabase** ผู้ใช้เข้าสู่ระบบด้วย Google

คู่มือนี้สำหรับคนที่รับโปรเจกต์ไปทำต่อ โดยเริ่มจาก **Supabase โปรเจกต์ใหม่ที่ยังไม่มีตารางของแอป** ไม่ต้องมีฐานข้อมูลหรือบัญชีผู้ใช้ของเจ้าของเดิม

## 1. เตรียมเครื่องมือ

ติดตั้งเฉพาะรายการที่ยังไม่มี:

| เครื่องมือ | ใช้ทำอะไร | ตรวจว่ามีแล้วหรือยัง |
| --- | --- | --- |
| Git | รับและอัปเดตโค้ด | `git --version` |
| PHP **8.4.1 ขึ้นไป** พร้อม `fileinfo`, `openssl`, `pdo`, `pdo_pgsql` | รัน Laravel และเชื่อม PostgreSQL | `php -v` และ `php -m` |
| Composer | ติดตั้งแพ็กเกจ PHP | `composer --version` |
| Node.js **20.19 ขึ้นไป หรือ 22.12 ขึ้นไป** พร้อม npm | รัน React/Vite | `node --version` และ `npm --version` |
| บัญชี Supabase | สร้าง PostgreSQL ใหม่ | เข้าหน้า Supabase Dashboard ได้ |
| บัญชี Google Cloud | ตั้งค่า Google Login | เข้าหน้า Google Cloud Console ได้ |

ถ้าคำสั่งใดขึ้นว่า `not recognized` หรือ `command not found` ให้ติดตั้งเครื่องมือนั้นและเปิด Terminal ใหม่ ถ้า `pdo_pgsql` ไม่ปรากฏใน `php -m` ให้เปิด extension นี้ใน `php.ini` ก่อนรัน backend คำสั่งต่อไปนี้เขียนสำหรับ **PowerShell บน Windows**; macOS/Linux ใช้ Terminal โดยเปลี่ยน `Copy-Item` เป็น `cp`

ดาวน์โหลดโค้ดด้วย `git clone <URL-ของ-repository>` แล้วเข้าโฟลเดอร์โปรเจกต์ หรือหากมีโฟลเดอร์อยู่แล้วให้เปิด Terminal ที่โฟลเดอร์นั้น คำสั่งในคู่มือนี้สมมติว่าเริ่มจากโฟลเดอร์ที่มี `frontend` และ `backend`

## 2. สร้างฐานข้อมูลใหม่ใน Supabase

1. สร้าง **Supabase Project ใหม่** เก็บรหัสผ่านฐานข้อมูลไว้ในที่ปลอดภัย และรอให้สร้างโปรเจกต์เสร็จ อย่ารัน SQL ต่อไปนี้บนฐานข้อมูลที่มีข้อมูลแอปอยู่แล้ว
2. เปิด **SQL Editor → New query** คัดลอกเนื้อหาทั้งหมดจาก [`01_schema_baseline.sql`](backend/database/postgresql/sql-editor/01_schema_baseline.sql) วางแล้วกด **Run** ไฟล์นี้สร้าง 42 ตารางตั้งต้นพร้อมดัชนีและความสัมพันธ์ แต่ **ไม่คัดลอกผู้ใช้ ประวัติ หรือข้อมูลส่วนตัวจากฐานข้อมูลเดิม**
3. หากขึ้น `relation ... already exists` แปลว่ามีตารางของแอปอยู่แล้ว ให้หยุดและตรวจว่าเลือกโปรเจกต์ Supabase ถูกตัว **อย่าลบตารางเพื่อแก้ปัญหาโดยไม่สำรองข้อมูล**
4. ที่ Supabase Dashboard กด **Connect** แล้วเลือก **Session pooler** คัดลอก `host`, `port`, `database`, `user` จากหน้าจอนั้นไปใช้ในขั้นตอนถัดไป อย่าเดาชื่อ host เอง ถ้าเครื่องรองรับ IPv6 อาจใช้ Direct connection ได้ แต่คู่มือนี้ใช้ Session pooler สำหรับเครือข่าย IPv4 ทั่วไป ([คู่มือการเชื่อมต่อ Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres))

ไฟล์ SQL ทุกขั้นอยู่ใน [`backend/database/postgresql/sql-editor/`](backend/database/postgresql/sql-editor/) ต้องทำตามลำดับในคู่มือนี้ **ไม่ใช่รันทุกไฟล์ติดกันทันที** เพราะมีขั้นตอน `migrate` และ `seed` จาก Laravel ระหว่างกลาง

## 3. ติดตั้งและตั้งค่า backend

เปิด Terminal ที่โฟลเดอร์โปรเจกต์ แล้วรัน:

```powershell
cd backend
composer install
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    php artisan key:generate
}
```

ถ้ามี `backend/.env` อยู่แล้ว คำสั่งจะ **ไม่คัดลอกทับและไม่เปลี่ยน `APP_KEY`** ให้เปิดไฟล์เดิมและตรวจค่าแทน หากเป็น `.env` ของคนอื่นหรือฐานข้อมูลเดิม ให้สร้างค่าของตนเอง หากมี `.env` แต่ `APP_KEY` ยังว่างจริง ๆ จึงค่อยรัน `php artisan key:generate` (อย่าเปลี่ยน key ของระบบที่มีข้อมูลใช้งานแล้ว)

แก้ `backend/.env` ให้มีค่าหลักดังนี้ (ข้อความใน `<...>` ต้องแทนด้วยค่าจริงจากบัญชีของตนเอง):

```dotenv
APP_NAME="Plant Growth Academy"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173

DB_CONNECTION=pgsql
DB_HOST=<host-จาก-Supabase-Connect>
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=<user-จาก-Supabase-Connect>
DB_PASSWORD="<รหัสผ่านฐานข้อมูลของ-Supabase>"
DB_SEARCH_PATH=public
DB_SSLMODE=require
DB_PERSISTENT=false

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=sync
MAIL_MAILER=log

MEDIA_DRIVER=laravel
MEDIA_DISK=public
PRIVATE_MEDIA_DRIVER=laravel
PRIVATE_MEDIA_DISK=local

GOOGLE_CLIENT_ID=<Google-OAuth-client-ID>
GOOGLE_CLIENT_SECRET=<Google-OAuth-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
JWT_SECRET=<ค่าสุ่มใหม่อย่างน้อย-32-ตัวอักษร>
```

สร้าง `JWT_SECRET` ใหม่ด้วย `php -r "echo bin2hex(random_bytes(32));"` แล้วนำผลลัพธ์ไปใส่ใน `.env` ห้ามใช้ค่า JWT ตัวอย่างสำหรับระบบจริง `APP_KEY` ได้จาก `php artisan key:generate` แล้ว ถ้าใช้ `DB_URL` ใน `.env` อยู่ ให้ลบหรือคอมเมนต์ก่อน เพื่อไม่ให้ขัดกับ `DB_*` ข้างบน รหัสฐานข้อมูลที่มีอักขระพิเศษให้ครอบด้วย `"` ตามตัวอย่าง

หลังแก้ `.env` ให้รัน:

```powershell
php artisan optimize:clear
php artisan migrate
php artisan db:seed --class=GameSimulationSeeder
php artisan db:seed --class=LearningContentSeeder
php artisan storage:link
```

`migrate` จะต่อยอดตารางตั้งต้นให้เป็นโครงสร้างปัจจุบัน; Seeder สองตัวเติมข้อมูลพืช ศัตรูพืช ไอเทม และบทความเริ่มต้น **ไม่ต้องรัน `php artisan db:seed` แบบไม่ระบุ class** สำหรับฐานข้อมูลที่ส่งต่อ เพราะ `DatabaseSeeder` สร้างบัญชีทดสอบและบัญชีผู้ดูแลด้วย ซึ่งไม่จำเป็นสำหรับ Google Login ถ้า `storage:link` แจ้งว่ามีลิงก์อยู่แล้ว ให้ข้ามได้

## 4. ปิดการเข้าถึงฐานข้อมูลโดยตรงและตรวจผล

กลับไปที่ **Supabase SQL Editor** ของโปรเจกต์เดียวกัน:

1. รัน [`02_secure_public_api.sql`](backend/database/postgresql/sql-editor/02_secure_public_api.sql) **หลัง** `migrate` และ Seeder แล้ว ระบบนี้ให้เว็บคุยกับ Laravel API เท่านั้น ไฟล์นี้เปิด RLS และถอนสิทธิ์ `anon`/`authenticated` จากตารางใน `public` เพื่อไม่ให้เข้าอ่านข้อมูลผ่าน Supabase Data API โดยตรง หากภายหลังเพิ่มการเชื่อม Supabase Data API จากเบราว์เซอร์ ต้องออกแบบสิทธิ์/RLS ใหม่ก่อน
2. รัน [`03_verify_setup.sql`](backend/database/postgresql/sql-editor/03_verify_setup.sql) ผลทุกแถวควรเป็น `OK` ถ้าไม่ใช่ ให้อ่านชื่อแถวแล้วกลับไปทำขั้นตอนที่ระบุ
3. เมื่อมี migration ใหม่ในอนาคต ให้รัน `php artisan migrate` แล้ว **รัน `02_secure_public_api.sql` อีกครั้ง** สำหรับตารางใหม่

> ดัมป์เก่าชื่อ `plant_simulation_game_supabase.sql` (ถ้ามีอยู่ในเครื่องเดิม) มีบัญชีผู้ใช้ ประวัติ และข้อมูลกิจกรรมจริง จึงถูก `.gitignore` ไว้และ **ไม่ควรส่งต่อหรือวางใน SQL Editor ของคนอื่น** ใช้ `01_schema_baseline.sql` ที่ไม่มีข้อมูลเหล่านั้นเท่านั้น

## 5. ตั้งค่า Google Login

ที่ Google Cloud Console ให้สร้างโปรเจกต์ (ถ้ายังไม่มี), ตั้ง OAuth consent screen และสร้าง **OAuth client ประเภท Web application** แล้วเพิ่ม Authorized redirect URI เป็น `http://localhost:8000/api/auth/google/callback` **ตรงตัว** นำ Client ID และ Client Secret มาใส่ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ใน `backend/.env` หากแอปยังอยู่ในสถานะทดสอบ ให้เพิ่มอีเมลที่จะใช้เป็น Test user ใน Google Cloud ด้วย จากนั้นรัน `php artisan optimize:clear` อีกครั้ง ([คู่มือ Google OAuth สำหรับ Web Server](https://developers.google.com/identity/protocols/oauth2/web-server))

แอปนี้ **ไม่มีหน้าสมัครด้วยรหัสผ่านของโปรเจกต์** การเข้าสู่ระบบและการสร้างบัญชีครั้งแรกทำผ่าน Google

## 6. ติดตั้งและเปิด frontend

เปิด **Terminal อีกหน้าต่าง** ที่โฟลเดอร์โปรเจกต์:

```powershell
cd frontend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

ถ้ามี `frontend/.env` อยู่แล้ว คำสั่งจะไม่คัดลอกทับ ให้ตรวจค่าเดิม ถ้า dependencies ใน `node_modules` ติดตั้งตรงกับ `package-lock.json` อยู่แล้ว สามารถข้าม `npm ci` ได้; หากไม่แน่ใจให้รันเพื่อจัดให้ตรงกัน ตั้ง `VITE_API_BASE_URL=http://localhost:8000/api` ในไฟล์นั้น แล้วเปิดสองโปรเซสแยกกัน:

```powershell
# Terminal ที่ 1: อยู่ใน backend
php artisan serve --host=127.0.0.1 --port=8000
```

```powershell
# Terminal ที่ 2: อยู่ใน frontend
npm run dev -- --host=localhost --port=5173
```

เปิด `http://localhost:5173` ในเบราว์เซอร์ และตรวจ API ที่ `http://localhost:8000/up` หากมีเซิร์ฟเวอร์รันอยู่แล้ว **ไม่ต้องเปิดซ้ำ** ให้ตรวจว่าใช้พอร์ต 8000/5173 และ `.env` ชุดเดียวกัน บน Windows หลังตั้งค่าครั้งแรกแล้วสามารถเรียก `./start-local.ps1` จากโฟลเดอร์รากเพื่อเปิดทั้งสองบริการแบบซ่อนหน้าต่างได้

## 7. ให้สิทธิ์ผู้ดูแลระบบ

1. เข้าสู่ระบบบนเว็บด้วย **บัญชี Google ของผู้ดูแล** อย่างน้อยหนึ่งครั้งก่อน เพื่อให้ Laravel สร้างผู้ใช้ในตาราง `public.users`
2. เปิด [`04_promote_google_admin.sql`](backend/database/postgresql/sql-editor/04_promote_google_admin.sql) คัดลอกไป SQL Editor แล้ว **เปลี่ยนอีเมลตัวอย่างในคำสั่งเป็นอีเมล Google บัญชีของตนเอง** ก่อนกด Run ผล `google_admin_accounts` ควรมีอย่างน้อย 1
3. ออกจากระบบแล้วเข้าใหม่ เพื่อรับสิทธิ์ผู้ดูแลที่อัปเดตแล้ว อย่าส่ง Client Secret, JWT หรือรหัสฐานข้อมูลให้ผู้ดูแลคนอื่น; ให้แต่ละคนใช้บัญชี Google ของตัวเอง

## 8. รูปภาพ โมเดล 3 มิติ และการนำขึ้นออนไลน์

- การรันในเครื่องใช้ `MEDIA_DRIVER=laravel` และ `php artisan storage:link` ไฟล์เริ่มต้นจำนวนหนึ่งอยู่ใน `backend/storage/app/public/`; รูปที่ใช้บนหน้าเว็บอยู่ใน `frontend/public/media/`
- ถ้าจะ Deploy backend บนบริการที่ไฟล์ในเครื่องไม่ถาวร ให้สร้าง **Supabase Storage bucket แบบ Public** ชื่อ `plant-media` และ bucket แบบ **Private** ชื่อ `issue-evidence` สำหรับไฟล์รายงานปัญหา ตั้งค่า `MEDIA_DRIVER=supabase`, `PRIVATE_MEDIA_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET=plant-media`, `SUPABASE_PRIVATE_BUCKET=issue-evidence` เฉพาะที่ backend แล้วอัปโหลดไฟล์สื่อเก่าที่ต้องใช้ให้ครบ SQL สร้างเพียงตาราง ไม่คัดลอกไฟล์ Storage ([คู่มือ Storage ของ Supabase](https://supabase.com/docs/guides/storage/quickstart))
- **อย่าใส่รหัสลับใน frontend หรือชื่อที่ขึ้นต้น `VITE_`** ค่า `VITE_API_BASE_URL` ของระบบออนไลน์ต้องเป็น URL ของ Laravel API ที่ผู้ใช้เข้าถึงได้
- โครงสร้าง Production ที่ใช้ในโปรเจกต์คือ Vercel (frontend) → Render (Laravel API) → Supabase (PostgreSQL/Storage) ดู [คู่มือ Deploy](DEPLOYMENT.md) และ [รายละเอียด Render](backend/RENDER_DEPLOYMENT.md)

## 9. ตรวจสอบและแก้ปัญหาเบื้องต้น

| อาการ | เช็กสิ่งนี้ก่อน |
| --- | --- |
| `could not find driver` | `php -m` ต้องมี `pdo_pgsql`; เปิด extension แล้วเปิด Terminal ใหม่ |
| เชื่อมฐานข้อมูลไม่ได้ | ตรวจ Session pooler host/user/port/password จาก **Connect**, `DB_SSLMODE=require`, `DB_URL` ไม่ขัดกับ `DB_*`, แล้วรัน `php artisan optimize:clear` |
| `relation ... does not exist` | รัน SQL `01_schema_baseline.sql` บน Supabase ที่ถูกโปรเจกต์ และ `php artisan migrate` ให้ครบ |
| `relation ... already exists` ระหว่าง SQL ขั้นแรก | ใช้ฐานข้อมูลที่ไม่ว่างหรือเคยรันไปแล้ว; **หยุดก่อน** อย่ารันซ้ำหรือลบข้อมูลสุ่ม ๆ |
| Google Login กลับมาไม่สำเร็จ | ตรวจ callback URL ใน Google Cloud กับ `GOOGLE_REDIRECT_URI` ให้ตรงกัน และตรวจ Test users |
| หน้าเว็บเปิดได้แต่ข้อมูลไม่ขึ้น | ตรวจ backend `/up`, `frontend/.env` และ Network request ไปยัง `/api`; ดู error ใน Terminal ของ Laravel |
| รูป/โมเดลไม่ขึ้น | ตรวจ `php artisan storage:link`, ไฟล์ใน `backend/storage/app/public/` หรือ bucket Supabase Storage ที่ใช้อยู่ |
| SQL ตรวจผลไม่เป็น `OK` | ดูชื่อรายการจาก `03_verify_setup.sql` แล้วทำ migration, seeder หรือ security step ที่ยังขาด |

หลังแก้โค้ด ใช้ `npm run lint` และ `npm run build` ใน `frontend`; ใช้ `php artisan test` ใน `backend` ก่อนส่งงานต่อ หากต้องการต่อยอดโครงสร้างฐานข้อมูล ให้สร้าง **Laravel migration ใหม่** ไม่แก้ไฟล์ `01_schema_baseline.sql` ด้วยมือ ไฟล์นี้เป็นฐานข้อมูลตั้งต้น ส่วน migration เป็นแหล่งความจริงของการเปลี่ยนแปลงหลังจากนั้น
