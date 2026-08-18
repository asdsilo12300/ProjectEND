# Deploy Plant Growth Academy ให้เปิดได้จากทุกที่

โครงสร้าง Production ปัจจุบัน:

```text
ผู้ใช้ -> Vercel (React/Vite)
              -> Render (Laravel API / Docker)
                    -> Supabase PostgreSQL
                    -> Supabase Storage
                    -> Google OAuth
```

ระบบสมัครสมาชิกด้วยอีเมล รหัสผ่าน OTP ยืนยันอีเมล และรีเซ็ตรหัสผ่านถูกนำออกแล้ว ผู้ใช้กด **ดำเนินการต่อด้วย Google** เพียงปุ่มเดียว โดย Google จะยืนยันอีเมลให้ และ Backend จะสร้างโปรไฟล์ผู้เรียนอัตโนมัติเมื่อเข้าใช้ครั้งแรก

## ขั้นตอนหลัก

1. Push repository ล่าสุดขึ้น Git provider
2. ที่ Render เลือก **New + > Blueprint** และเลือก repository นี้
3. Render จะอ่าน [`render.yaml`](./render.yaml) และ Build Laravel จาก `backend/Dockerfile`
4. กรอก Secret และค่าฐานข้อมูลตาม [`backend/.env.render.example`](./backend/.env.render.example)
5. ตั้ง Google redirect URI ให้เป็น `https://<render-domain>/api/auth/google/callback`
6. ตั้ง Vercel `VITE_API_BASE_URL=https://<render-domain>/api` แล้ว Redeploy
7. ตรวจ `https://<render-domain>/up` และทดสอบเข้าสู่ระบบด้วย Google

คู่มือทีละขั้นตอน ตัวแปรที่ต้องใส่ การตั้ง Google OAuth และรายการตรวจหลัง Deploy อยู่ที่ [`backend/RENDER_DEPLOYMENT.md`](./backend/RENDER_DEPLOYMENT.md)

## ข้อควรระวัง

- ห้ามใส่ `APP_KEY`, `JWT_SECRET`, รหัสฐานข้อมูล, Google client secret หรือ Supabase Secret key ในตัวแปร Vercel ที่ขึ้นต้น `VITE_`
- รูปและโมเดลที่อัปโหลดต้องเก็บใน Supabase Storage เพราะระบบไฟล์ของ Render ไม่ถาวร
- Render Free จะพัก Web Service หลังไม่มี Traffic 15 นาที จึงมี Cold start เมื่อเปิดครั้งแรก หากเปิดใช้งานจริงควรใช้ Starter plan
