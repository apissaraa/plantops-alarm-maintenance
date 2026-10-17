import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Alarm & Maintenance Management System',
  description: 'ระบบจำลองควบคุมเครื่องจักร แจ้งเตือน และจัดการงานซ่อมบำรุง',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
