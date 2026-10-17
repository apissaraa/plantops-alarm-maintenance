# Alarm & Maintenance Management System — Prototype v1

เว็บต้นแบบสำหรับโปรเจกต์ระบบแจ้งเตือนและจัดการงานซ่อมบำรุง มี Machine Simulator ให้ทดลองควบคุมเครื่องจักรและสร้าง Alarm ผ่านหน้าเว็บ

## สิ่งที่ทำได้ในเวอร์ชันนี้
- Dashboard: จำนวนเครื่องจักร เครื่องที่กำลังทำงาน Alarm ที่ยังไม่ปิด และใบงานซ่อม
- Machines: ดูสถานะและเลือกเครื่องจักรเพื่อควบคุม
- Simulator: Start, Stop, Trigger Alarm, Reset และสร้างใบงานซ่อม
- Alarm Log: ค้นหา/กรอง Alarm, รับทราบเหตุ และปิด Alarm
- Maintenance: สร้างใบงานและเปลี่ยนสถานะ Open / In Progress / Completed
- เก็บข้อมูลใน Local Storage ของเบราว์เซอร์ เพื่อให้ข้อมูลยังอยู่เมื่อรีเฟรชหน้า
- Responsive layout สำหรับหน้าจอคอมพิวเตอร์และมือถือ

## ข้อจำกัดที่ต้องทราบ
นี่คือ prototype สำหรับจำลองเท่านั้น ยังไม่ได้เชื่อม Supabase, ระบบ Login/สิทธิ์ผู้ใช้, GitHub Actions หรือ Vercel และไม่เชื่อม PLC/เครื่องจักรจริง ข้อมูลเก็บในเบราว์เซอร์เครื่องที่เปิดใช้งาน

## วิธีเปิดโปรเจกต์ใน VS Code
1. ติดตั้ง Node.js รุ่น LTS จาก https://nodejs.org/ (ถ้ายังไม่มี)
2. แตกไฟล์ ZIP
3. เปิด VS Code แล้วเลือก **File → Open Folder...** เลือกโฟลเดอร์ `alarm-maintenance-system`
4. เปิด **Terminal → New Terminal**
5. พิมพ์คำสั่งทีละบรรทัด:

```bash
npm install
npm run dev
```

6. เปิดเบราว์เซอร์ไปที่ http://localhost:3000

ถ้าต้องการหยุดเว็บ ให้กลับมาที่ Terminal แล้วกด `Ctrl + C`

## วิธีทดลอง Simulator
1. ไปหน้า **เครื่องจักร** หรือ **ภาพรวมระบบ**
2. เลือกเครื่องจักรจากรายการ
3. กด **Start** หรือ **Stop** เพื่อเปลี่ยนสถานะ
4. กด **Trigger Alarm** เพื่อสร้างเหตุขัดข้องจำลอง และดู Alarm Log / Dashboard
5. กด **Reset** เพื่อหยุดเครื่องและปิด Alarm ของเครื่องนั้นในข้อมูลจำลอง
6. กด **Create maintenance work order** เพื่อสร้างใบงานซ่อม

## Technology
- Next.js 14 / React 18 / TypeScript
- Tailwind CSS
- Lucide React icons
- Local Storage (temporary prototype persistence)

## งานต่อไปที่ควรทำ
1. สร้าง Supabase project และ schema สำหรับ profiles, machines, alarms, work_orders
2. เพิ่ม Login/Logout และ role-based access (Admin / Technician)
3. เปลี่ยนการอ่าน/เขียน Local Storage เป็น Supabase
4. เพิ่ม validation และทดสอบ use cases
5. เพิ่ม GitHub Actions CI และ deploy ไป Vercel
6. ใส่ภาพหน้าจอจริงและสรุปการใช้ AI ในรายงาน
