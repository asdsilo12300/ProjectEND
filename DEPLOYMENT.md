# Deploy Plant Growth Academy ให้เปิดได้จากทุกที่

โครงสร้าง production ที่เหมาะกับโปรเจ็กนี้คือ:

```text
ผู้ใช้ -> Vercel (React/Vite)
              -> Railway (Laravel API)
                    -> Supabase PostgreSQL
                    -> Supabase Storage
```

Vercel ใช้สำหรับหน้าเว็บ ส่วน Laravel ต้องมี PHP server จึงวางบน Railway แล้วให้หน้าเว็บเรียก API ผ่าน HTTPS การตั้งค่านี้ทำให้เปิดเกมจากคอมพิวเตอร์หรือโทรศัพท์เครื่องใดก็ได้โดยไม่อ้าง `localhost`

## 1. เตรียม Supabase Storage

1. เข้า Supabase Dashboard ของโปรเจ็กฐานข้อมูลเดิม
2. ไปที่ **Storage** แล้วสร้าง bucket ชื่อ `plant-media`
3. ตั้ง bucket เป็น **Public** เพราะรูปโปรไฟล์ รูปบทความ ภาพเกม และโมเดลต้องเปิดจากหน้าเว็บได้
4. ไปที่ **Project Settings > API Keys** แล้วสร้าง/คัดลอก Secret key สำหรับ server
5. เก็บ Secret key ไว้ใส่ Railway เท่านั้น ห้ามใส่ตัวแปรชื่อ `VITE_*` หรือส่งขึ้น Git

ไฟล์ที่อัปโหลดใหม่จะอยู่ใน Supabase Storage จึงไม่หายเมื่อ Railway redeploy ส่วนไฟล์เดิมที่อยู่ใน repository ยังเปิดผ่าน Laravel ได้ตามปกติ

## 2. Deploy Laravel API บน Railway

1. Push โค้ดชุดล่าสุดขึ้น GitHub
2. เข้า [Railway](https://railway.com/) แล้วเลือก **New Project > Deploy from GitHub repo**
3. เลือก repository `ProjectEND`
4. ใน Service Settings ตั้งค่า:
   - **Root Directory:** `/backend`
   - **Railway Config File:** `/backend/railway.json`
5. เปิด **Variables > Raw Editor** แล้วคัดลอกค่าจาก `backend/.env.railway.example`
6. แทนค่าที่ขึ้นต้นด้วย `replace-with-...` และโดเมนตัวอย่างทั้งหมดด้วยค่าจริง

ค่าหลักที่ต้องใส่ให้ถูกต้อง:

- `APP_KEY`: รัน `php artisan key:generate --show` ในโฟลเดอร์ backend แล้วคัดลอกผลลัพธ์
- `JWT_SECRET`: สุ่มคนละค่ากับ `APP_KEY` และยาวอย่างน้อย 32 ตัวอักษร
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`: คัดลอกจาก **Supabase > Connect > Session pooler** (ปกติ port 5432)
- `SUPABASE_URL`: URL โครงการ เช่น `https://abcxyz.supabase.co`
- `SUPABASE_SECRET_KEY`: Secret key สำหรับ server จาก Supabase
- `SUPABASE_STORAGE_BUCKET=plant-media`
- `APP_DEBUG=false`
- `LOG_CHANNEL=stderr`

7. กด Deploy; Railway จะตรวจพบ Laravel และรันด้วย PHP-FPM/Caddy โดยอัตโนมัติ
8. ไปที่ **Settings > Networking > Generate Domain**
9. เปิด `https://โดเมน-railway/up` ต้องเห็นสถานะสำเร็จ HTTP 200
10. นำโดเมนนั้นไปแทนค่าทุกจุดของ `your-api.up.railway.app` ใน Variables แล้ว redeploy

ไฟล์ `backend/railway.json` จะสั่ง migrate ฐานข้อมูลก่อนเปิดรุ่นใหม่ และตรวจสุขภาพที่ `/up` ให้โดยอัตโนมัติ

## 3. Deploy React frontend บน Vercel

1. เข้า [Vercel](https://vercel.com/) แล้วเลือก **Add New > Project**
2. Import repository `ProjectEND` จาก GitHub
3. ตั้งค่าโปรเจ็ก:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. เพิ่ม Environment Variables สำหรับ Production:
   - `VITE_API_BASE_URL=https://โดเมน-railwayของคุณ/api`
   - `VITE_CKEDITOR_LICENSE_KEY=GPL` (ใช้ค่านี้เฉพาะเมื่อเงื่อนไขสิทธิ์ใช้งานของโครงการรองรับ GPL)
5. กด Deploy

Vercel จะให้ URL เช่น `https://project-end.vercel.app` และ deploy ใหม่ให้อัตโนมัติทุกครั้งที่ push ไปยัง branch ที่ผูกไว้

## 4. ผูกโดเมน frontend กลับไปที่ backend

หลังได้ URL จริงจาก Vercel ให้กลับไปแก้ Variables บน Railway:

```dotenv
FRONTEND_URL=https://project-end.vercel.app
CORS_ALLOWED_ORIGINS=https://project-end.vercel.app
```

จากนั้น redeploy Railway หนึ่งครั้ง ถ้ามี custom domain ให้ใช้ custom domain แทน URL ชั่วคราวทั้งสองค่า

ระบบตั้งใจอนุญาตเฉพาะ origin ที่ระบุไว้ หากต้องใช้หลายโดเมนให้คั่นด้วย comma เช่น:

```dotenv
CORS_ALLOWED_ORIGINS=https://project-end.vercel.app,https://www.example.com
```

## 5. ตั้ง Google Login และอีเมล OTP สำหรับ production

ใน Google Cloud Console ของ OAuth client เพิ่ม:

- **Authorized JavaScript origins:** `https://project-end.vercel.app`
- **Authorized redirect URI:** `https://โดเมน-railwayของคุณ/api/auth/google/callback`

แล้วตั้ง Railway ให้ตรงกัน:

```dotenv
GOOGLE_REDIRECT_URI=https://โดเมน-railwayของคุณ/api/auth/google/callback
```

สำหรับ OTP ผ่าน Gmail:

1. เปิด 2-Step Verification ของบัญชี Google
2. สร้าง App Password
3. ใส่อีเมลใน `MAIL_USERNAME` และ App Password 16 ตัวใน `MAIL_PASSWORD` บน Railway
4. ห้ามใช้รหัสผ่าน Gmail ปกติ

## 6. ตรวจหลัง deploy

ทดสอบตามลำดับนี้จากโทรศัพท์หรือเครื่องอื่นที่ไม่ได้รันโปรเจ็กในเครื่อง:

1. เปิด URL Vercel และสมัครสมาชิกใหม่
2. Login/Logout แล้วตรวจว่าเข้าเกมไม่ได้เมื่อยังไม่ login
3. Login ด้วย Google และตรวจรูปโปรไฟล์
4. ขอ OTP รีเซ็ตรหัสผ่านและตรวจทั้ง Inbox/Spam
5. ปลูกพืช บันทึก/แชร์ภาพ และ refresh หน้า
6. เข้า Admin แล้วอัปโหลดรูปบทความ จากนั้น redeploy Railway และตรวจว่าไฟล์ยังอยู่

## ข้อควรระวัง

- ห้ามนำ `APP_KEY`, `JWT_SECRET`, รหัสฐานข้อมูล, SMTP password หรือ Supabase Secret key ไปใส่ Vercel ตัวแปรที่ขึ้นต้น `VITE_`
- `VITE_API_BASE_URL` ต้องเป็น HTTPS และลงท้าย `/api`; ห้ามใช้ `localhost`
- Vercel Preview URL จะเป็นคนละ origin หากต้องการให้ preview เรียก API ได้ ต้องเพิ่ม URL นั้นใน `CORS_ALLOWED_ORIGINS` ชั่วคราว
- ตั้ง Usage/Budget alerts ใน Vercel, Railway และ Supabase ก่อนเปิดให้ผู้ใช้จำนวนมาก
