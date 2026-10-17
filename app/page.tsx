'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bell, CheckCircle2, ChevronRight, CircleHelp, ClipboardList, Cpu, Gauge, LayoutDashboard, LogOut, Play, Power, RotateCcw, Search, Settings2, ShieldCheck, Square, Wrench, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
type MachineStatus = 'Running' | 'Stopped' | 'Fault';
type AlarmStatus = 'Open' | 'Acknowledged' | 'Resolved';
type Alarm = { id: string; machine: string; severity: 'Critical' | 'Warning'; message: string; time: string; status: AlarmStatus };
type WorkOrder = { id: string; machine: string; title: string; priority: 'High' | 'Medium' | 'Low'; status: 'Open' | 'In Progress' | 'Completed'; created: string };
type Machine = { id: string; name: string; location: string; status: MachineStatus; temperature: number; vibration: number; runtime: number };

const initialMachines: Machine[] = [
  { id: 'M-001', name: 'Conveyor Motor A', location: 'Production Line 1', status: 'Running', temperature: 48, vibration: 2.1, runtime: 128 },
  { id: 'M-002', name: 'Hydraulic Pump B', location: 'Production Line 2', status: 'Stopped', temperature: 31, vibration: 0.4, runtime: 76 },
  { id: 'M-003', name: 'Cooling Fan C', location: 'Utility Room', status: 'Running', temperature: 42, vibration: 1.6, runtime: 211 },
];
const initialAlarms: Alarm[] = [
  { id: 'AL-1003', machine: 'M-003', severity: 'Warning', message: 'Vibration approaching threshold', time: '10:42:18', status: 'Open' },
  { id: 'AL-1002', machine: 'M-001', severity: 'Critical', message: 'Temperature high', time: '10:31:05', status: 'Acknowledged' },
];
const initialOrders: WorkOrder[] = [
  { id: 'WO-2001', machine: 'M-001', title: 'Inspect motor cooling system', priority: 'High', status: 'In Progress', created: 'Today, 09:15' },
  { id: 'WO-2000', machine: 'M-003', title: 'Check vibration sensor', priority: 'Medium', status: 'Open', created: 'Today, 08:40' },
];

function clock() { return new Date().toLocaleTimeString('th-TH', { hour12: false }); }
function statusClass(status: string) {
  if (['Running', 'Resolved', 'Completed'].includes(status)) return 'good';
  if (['Fault', 'Critical', 'Open'].includes(status)) return 'bad';
  if (['Warning', 'Acknowledged', 'In Progress', 'Medium'].includes(status)) return 'warn';
  return 'neutral';
}

export default function Home() {
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'technician' | ''>('');
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !user) {
        window.location.replace('/login');
        return;
      }
      setUserEmail(user.email ?? '');
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      if (roleError) console.error('Could not load role:', roleError.message);
      setUserRole(roleData?.role === 'admin' || roleData?.role === 'technician' ? roleData.role : '');
      setAuthLoading(false);
    }
    void loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) window.location.replace('/login');
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) { setNotice(`ออกจากระบบไม่สำเร็จ: ${error.message}`); return; }
    window.location.replace('/login');
  }

  const [machines, setMachines] = useState<Machine[]>([]);
  const [busy, setBusy] = useState(false);
  const [machineForm, setMachineForm] = useState<{ mode: "new" | "edit"; original: string; code: string; name: string; location: string; temperature: string; vibration: string; runtime: string } | null>(null);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedMachine, setSelectedMachine] = useState('M-001');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [notice, setNotice] = useState('Simulator ready — no real hardware is connected.');

  // Read database state after authentication. Never overwrite it from localStorage.
  useEffect(() => {
    if (authLoading || !userRole) return;
    let active = true;
    async function loadData() {
      const [machineResult, alarmResult, orderResult] = await Promise.all([
        supabase.from('machines').select('machine_code, machine_name, location, status, temperature, vibration, runtime_hours').order('machine_code'),
        supabase.from('plantops_alarm_events').select('id, machine_code, severity, message, status, created_at').order('created_at', { ascending: false }),
        supabase.from('plantops_work_orders').select('id, machine_code, title, priority, status, created_at').order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      const errors = [machineResult.error, alarmResult.error, orderResult.error].filter(Boolean);
      if (errors.length) {
        setNotice('โหลดข้อมูลไม่สำเร็จ: ' + errors.map(e => e!.message).join(' / '));
        return;
      }
      setMachines((machineResult.data ?? []).map(m => ({
        id: m.machine_code, name: m.machine_name, location: m.location,
        status: m.status as MachineStatus, temperature: Number(m.temperature),
        vibration: Number(m.vibration), runtime: Number(m.runtime_hours),
      })));
      setAlarms((alarmResult.data ?? []).map(a => ({
        id: a.id, machine: a.machine_code, severity: a.severity as Alarm['severity'],
        message: a.message, status: a.status as AlarmStatus,
        time: new Date(a.created_at).toLocaleTimeString('th-TH', { hour12: false }),
      })));
      setOrders((orderResult.data ?? []).map(o => ({
        id: o.id, machine: o.machine_code, title: o.title,
        priority: o.priority as WorkOrder['priority'], status: o.status as WorkOrder['status'],
        created: new Date(o.created_at).toLocaleString('th-TH'),
      })));
    }
    void loadData();
    return () => { active = false; };
  }, [authLoading, userRole]);

  const isAdmin = userRole === 'admin';
   // UI-only permissions for the local simulator. Enforce permissions again with Supabase RLS when database writes are added.
  const canHandleMaintenance = userRole === 'admin' || userRole === 'technician';

  const currentMachine = machines.find(m => m.id === selectedMachine) ?? machines[0];
  const openAlarms = alarms.filter(a => a.status !== 'Resolved').length;
  const activeOrders = orders.filter(o => o.status !== 'Completed').length;
  const filteredMachines = useMemo(() => machines.filter(m => `${m.id} ${m.name} ${m.location}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || m.status === filter)), [machines, search, filter]);
  const filteredAlarms = alarms.filter(a => `${a.id} ${a.machine} ${a.message}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || a.status === filter || a.severity === filter));
  const filteredOrders = orders.filter(o => `${o.id} ${o.machine} ${o.title}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || o.status === filter || o.priority === filter));

  // Database writes are checked by Supabase RLS, not just by the UI.
  async function saveMachine(machine: Machine, patch: Partial<Machine>, message: string) {
    if (!isAdmin || busy) return;
    setBusy(true);
    const next = { ...machine, ...patch };
    const { data, error } = await supabase.from('machines').update({
      status: next.status, temperature: next.temperature,
      vibration: next.vibration, runtime_hours: next.runtime,
    }).eq('machine_code', machine.id).select('machine_code');
    if (error || !data?.length) {
      setNotice('บันทึกเครื่องจักรไม่สำเร็จ: ' + (error?.message ?? 'ไม่พบรายการที่แก้ไขได้'));
    } else {
      setMachines(prev => prev.map(m => m.id === machine.id ? next : m));
      setNotice(message);
    }
    setBusy(false);
  }

  async function startMachine() {
    if (!isAdmin || !currentMachine || busy) return;
    if (currentMachine.status === 'Fault') { setNotice('เครื่องอยู่ในสถานะ Fault — กรุณา Reset ก่อน'); return; }
    await saveMachine(currentMachine, {
      status: 'Running', temperature: Math.min(75, currentMachine.temperature + 2),
      runtime: currentMachine.runtime + 1,
    }, `${currentMachine.name} เริ่มทำงานแล้ว (จำลอง)`);
  }
  async function stopMachine() {
    if (!isAdmin || !currentMachine || busy) return;
    await saveMachine(currentMachine, { status: 'Stopped' }, `${currentMachine.name} หยุดแล้ว (จำลอง)`);
  }
  async function triggerAlarm() {
    if (!isAdmin || !currentMachine || busy) return;
    const machine = currentMachine;
    setBusy(true);
    const id = `AL-${crypto.randomUUID()}`;
    const { data, error } = await supabase.from('plantops_alarm_events').insert({
      id, machine_code: machine.id, severity: 'Critical',
      message: 'Emergency stop / simulated machine fault', status: 'Open',
    }).select('id, created_at').single();
    if (error || !data) {
      setNotice('สร้าง Alarm ไม่สำเร็จ: ' + (error?.message ?? 'ไม่พบข้อมูล'));
      setBusy(false);
      return;
    }
    const machineUpdate = await supabase.from('machines').update({ status: 'Fault' })
      .eq('machine_code', machine.id).select('machine_code');
    setAlarms(prev => [{ id, machine: machine.id, severity: 'Critical',
      message: 'Emergency stop / simulated machine fault', status: 'Open',
      time: new Date(data.created_at).toLocaleTimeString('th-TH', { hour12: false }) }, ...prev]);
    if (machineUpdate.error || !machineUpdate.data?.length) {
      setNotice('สร้าง Alarm แล้ว แต่เปลี่ยนสถานะเครื่องไม่สำเร็จ: ' + (machineUpdate.error?.message ?? 'ไม่มีสิทธิ์'));
    } else {
      setMachines(prev => prev.map(m => m.id === machine.id ? { ...m, status: 'Fault' } : m));
      setNotice(`สร้าง Alarm ที่ ${machine.name} และบันทึกลง Supabase แล้ว`);
    }
    setBusy(false);
  }
  async function resetMachine() {
    if (!isAdmin || !currentMachine || busy) return;
    const machine = currentMachine;
    setBusy(true);
    const result = await supabase.from('machines').update({ status: 'Stopped', temperature: 35, vibration: 0.5 })
      .eq('machine_code', machine.id).select('machine_code');
    if (result.error || !result.data?.length) {
      setNotice('Reset ไม่สำเร็จ: ' + (result.error?.message ?? 'ไม่มีสิทธิ์'));
      setBusy(false);
      return;
    }
    setMachines(prev => prev.map(m => m.id === machine.id ? { ...m, status: 'Stopped', temperature: 35, vibration: 0.5 } : m));
    const alarmResult = await supabase.from('plantops_alarm_events').update({ status: 'Resolved' })
      .eq('machine_code', machine.id).neq('status', 'Resolved').select('id');
    if (alarmResult.error) {
      setNotice('Reset เครื่องแล้ว แต่ปิด Alarm ไม่สำเร็จ: ' + alarmResult.error.message);
    } else {
      setAlarms(prev => prev.map(a => a.machine === machine.id ? { ...a, status: 'Resolved' } : a));
      setNotice(`Reset ${machine.name} และบันทึกลง Supabase แล้ว`);
    }
    setBusy(false);
  }
  async function changeAlarm(id: string, status: AlarmStatus) {
    if (!canHandleMaintenance || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from('plantops_alarm_events').update({ status })
      .eq('id', id).select('id');
    if (error || !data?.length) setNotice('อัปเดต Alarm ไม่สำเร็จ: ' + (error?.message ?? 'ไม่มีสิทธิ์'));
    else setAlarms(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setBusy(false);
  }
  function acknowledgeAlarm(id: string) { void changeAlarm(id, 'Acknowledged'); }
  function resolveAlarm(id: string) { void changeAlarm(id, 'Resolved'); }

  async function createWorkOrder(machineId = selectedMachine) {
    if (!isAdmin || busy) return;
    const m = machines.find(x => x.id === machineId);
    if (!m) return;
    setBusy(true);
    const id = `WO-${crypto.randomUUID()}`;
    const title = `Inspect ${m.name}`;
    const priority: WorkOrder['priority'] = m.status === 'Fault' ? 'High' : 'Medium';
    const { data, error } = await supabase.from('plantops_work_orders').insert({
      id, machine_code: machineId, title, priority, status: 'Open',
    }).select('created_at').single();
    if (error || !data) setNotice('สร้างใบงานไม่สำเร็จ: ' + (error?.message ?? 'ไม่พบข้อมูล'));
    else {
      setOrders(prev => [{ id, machine: machineId, title, priority, status: 'Open',
        created: new Date(data.created_at).toLocaleString('th-TH') }, ...prev]);
      setActiveTab('Maintenance');
      setNotice(`สร้างใบงานซ่อมและบันทึกลง Supabase แล้ว`);
    }
    setBusy(false);
  }
  async function updateOrder(id: string, status: WorkOrder['status']) {
    if (!canHandleMaintenance || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from('plantops_work_orders').update({ status })
      .eq('id', id).select('id');
    if (error || !data?.length) setNotice('อัปเดตใบงานไม่สำเร็จ: ' + (error?.message ?? 'ไม่มีสิทธิ์'));
    else setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    setBusy(false);
  }
  function openMachineForm(machine?: Machine) {
    if (!isAdmin || busy) return;
    setMachineForm(machine ? { mode: 'edit', original: machine.id, code: machine.id, name: machine.name,
      location: machine.location, temperature: String(machine.temperature), vibration: String(machine.vibration), runtime: String(machine.runtime) }
      : { mode: 'new', original: '', code: '', name: '', location: '', temperature: '25', vibration: '0', runtime: '0' });
  }

  async function saveMachineForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || !machineForm || busy) return;
    const code = machineForm.code.trim().toUpperCase();
    const name = machineForm.name.trim();
    const location = machineForm.location.trim();
    const temperature = Number(machineForm.temperature);
    const vibration = Number(machineForm.vibration);
    const runtime = Number(machineForm.runtime);
    if (!/^[A-Z0-9-]{2,20}$/.test(code) || !name || !location ||
      ![temperature, vibration, runtime].every(Number.isFinite) ||
      temperature < 0 || temperature > 200 || vibration < 0 || vibration > 100 ||
      !Number.isInteger(runtime) || runtime < 0) {
      setNotice('ข้อมูลเครื่องจักรไม่ถูกต้อง: รหัสใช้ A-Z/0-9/-, กรอกชื่อ/ตำแหน่ง และตรวจค่าตัวเลข');
      return;
    }
    setBusy(true);
    const payload = { machine_code: code, machine_name: name, location,
      temperature, vibration, runtime_hours: runtime };
    const query = machineForm.mode === 'new'
      ? supabase.from('machines').insert({ ...payload, status: 'Stopped' }).select('machine_code').single()
      : supabase.from('machines').update(payload).eq('machine_code', machineForm.original).select('machine_code').single();
    const { error } = await query;
    if (error) setNotice('บันทึก Machine Master ไม่สำเร็จ: ' + error.message);
    else {
      setMachines(prev => machineForm.mode === 'new'
        ? [...prev, { id: code, name, location, status: 'Stopped', temperature, vibration, runtime }].sort((a,b) => a.id.localeCompare(b.id))
        : prev.map(m => m.id === machineForm.original ? { ...m, name, location, temperature, vibration, runtime } : m));
      setMachineForm(null);
      setNotice('บันทึก Machine Master ลง Supabase แล้ว');
    }
    setBusy(false);
  }

  async function deleteMachine(machine: Machine) {
    if (!isAdmin || busy || !window.confirm(`ยืนยันลบ ${machine.id} — ${machine.name}?\nเครื่องที่มี Alarm หรือใบงานอ้างอิงจะลบไม่ได้`)) return;
    setBusy(true);
    const { data, error } = await supabase.from('machines').delete().eq('machine_code', machine.id).select('machine_code');
    if (error || !data?.length) setNotice('ลบเครื่องจักรไม่สำเร็จ: ' + (error?.message ?? 'ไม่พบข้อมูลหรือไม่มีสิทธิ์'));
    else {
      const remaining = machines.filter(m => m.id !== machine.id);
      setMachines(remaining);
      if (selectedMachine === machine.id && remaining.length) setSelectedMachine(remaining[0].id);
      setNotice('ลบเครื่องจักรแล้ว');
    }
    setBusy(false);
  }

  function resetDemo() {
    setNotice('ข้อมูลอยู่ใน Supabase แล้ว จึงไม่รีเซ็ตฐานข้อมูลด้วยปุ่ม Demo');
  }

  const nav = [
    { name: 'Overview', label: 'ภาพรวมระบบ', icon: LayoutDashboard },
    { name: 'Machines', label: 'เครื่องจักร', icon: Cpu },
    { name: 'Alarms', label: 'Alarm Log', icon: Bell, count: openAlarms },
    { name: 'Maintenance', label: 'งานซ่อมบำรุง', icon: Wrench, count: activeOrders },
  ];

  if (authLoading) return <main className="min-h-screen flex items-center justify-center">กำลังตรวจสอบการเข้าสู่ระบบ...</main>;
  if (!userRole) return <main className="min-h-screen flex flex-col gap-4 items-center justify-center"><p>บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ</p><button className="btn btn-secondary" onClick={handleLogout}>ออกจากระบบ</button></main>;

  if (!machines.length) return <main className="min-h-screen flex flex-col items-center justify-center gap-3"><p>{notice.startsWith('โหลดข้อมูลไม่สำเร็จ') ? notice : 'กำลังโหลดข้อมูลเครื่องจักรจาก Supabase...'}</p><button className="btn btn-secondary" onClick={handleLogout}>ออกจากระบบ</button></main>;

  return <main className="min-h-screen lg:flex">
    <aside className="sidebar lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 flex flex-col">
      <div className="brand"><div className="brand-mark"><Zap size={22} /></div><div><div className="brand-title">PlantOps</div><div className="brand-sub">INDUSTRIAL MONITOR</div></div></div>
      <div className="workspace"><span className="live-dot"/> SIMULATION ENVIRONMENT</div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="nav-list">{nav.map(item => { const Icon = item.icon; return <button key={item.name} onClick={() => { setActiveTab(item.name); setSearch(''); setFilter('All'); }} className={`nav-item ${activeTab === item.name ? 'active' : ''}`}><Icon size={18}/><span>{item.label}</span>{'count' in item && item.count! > 0 && <span className="nav-count">{item.count}</span>}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="user-avatar">{userEmail.slice(0, 2).toUpperCase()}</div><div className="user-info"><strong>{userEmail}</strong><span>{userRole === 'admin' ? 'Admin' : 'Technician'}</span></div><button type="button" title="ออกจากระบบ" aria-label="ออกจากระบบ" onClick={handleLogout}><LogOut size={16} className="muted-icon"/></button></div>
    </aside>
    <section className="main-area lg:ml-64 min-w-0 flex-1">
      <header className="topbar"><div><div className="eyebrow">FACTORY OPERATIONS / {activeTab.toUpperCase()}</div><h1>{nav.find(n => n.name === activeTab)?.label ?? activeTab}</h1></div><div className="topbar-right"><span className="system-status"><span className="live-dot"/> SYSTEM ONLINE</span><div className="top-icon"><Bell size={18}/><i/></div><div className="small-avatar">{userEmail.slice(0, 2).toUpperCase()}</div></div></header>
      <div className="content">
        <div className="notice"><Activity size={16}/><span>{notice}</span><span className="notice-tag">{isAdmin ? "ADMIN · SIMULATOR" : "TECHNICIAN · SIMULATOR"}</span></div>
        {activeTab === 'Overview' && <>
          <div className="section-heading"><div><h2>Operations overview</h2><p>สถานะเครื่องจักรและเหตุขัดข้องแบบจำลอง</p></div><button className="btn btn-secondary" onClick={resetDemo} disabled title="ข้อมูลอยู่ใน Supabase แล้ว"><RotateCcw size={15}/> Reset demo</button></div>
          <div className="stats-grid">
            <StatCard label="TOTAL MACHINES" value={machines.length.toString().padStart(2, '0')} hint="Registered assets" icon={<Cpu size={19}/>} />
            <StatCard label="MACHINES RUNNING" value={machines.filter(m => m.status === 'Running').length.toString().padStart(2, '0')} hint="Currently operating" icon={<Activity size={19}/>} tone="green" />
            <StatCard label="ACTIVE ALARMS" value={openAlarms.toString().padStart(2, '0')} hint="Needs attention" icon={<AlertTriangle size={19}/>} tone="red" />
            <StatCard label="OPEN WORK ORDERS" value={activeOrders.toString().padStart(2, '0')} hint="Maintenance queue" icon={<ClipboardList size={19}/>} tone="amber" />
          </div>
          <div className="dashboard-grid">
            <div className="panel"><div className="panel-head"><div><h3>Machine status</h3><p>Supabase · simulated machines</p></div><button className="text-link" onClick={() => setActiveTab('Machines')}>View all <ChevronRight size={15}/></button></div><div className="machine-list">{machines.map(m => <button key={m.id} className={`machine-row ${selectedMachine === m.id ? 'selected' : ''}`} onClick={() => { setSelectedMachine(m.id); setActiveTab('Machines'); }}><div className={`machine-icon ${m.status.toLowerCase()}`}><Cpu size={19}/></div><div className="machine-main"><strong>{m.name}</strong><span>{m.id} · {m.location}</span></div><StatusPill status={m.status}/><ChevronRight size={15} className="muted-icon"/></button>)}</div></div>
            <div className="panel alarm-panel"><div className="panel-head"><div><h3>Recent alarms</h3><p>Latest events</p></div><button className="text-link" onClick={() => setActiveTab('Alarms')}>View log <ChevronRight size={15}/></button></div>{alarms.slice(0, 4).map(a => <div className="alarm-mini" key={a.id}><div className={`alarm-dot ${a.severity.toLowerCase()}`}><AlertTriangle size={14}/></div><div className="alarm-mini-main"><strong>{a.message}</strong><span>{a.id} · {a.machine} · {a.time}</span></div><StatusPill status={a.status}/></div>)}{alarms.length === 0 && <EmptyState text="ยังไม่มี Alarm"/>}</div>
          </div>
          <div className="panel simulator-panel"><div className="panel-head"><div><h3><Gauge size={18}/> Machine simulator</h3><p>ทดลองควบคุมเครื่องจักรและสร้าง Alarm จากหน้าเว็บ · เฉพาะ Admin</p></div><span className="demo-badge">DEMO MODE</span></div><Simulator machine={currentMachine} machines={machines} selectedMachine={selectedMachine} setSelectedMachine={setSelectedMachine} onStart={startMachine} onStop={stopMachine} onAlarm={triggerAlarm} onReset={resetMachine} onWorkOrder={() => createWorkOrder()} canControl={isAdmin && !busy}/></div>
        </>}
         {activeTab === 'Machines' && <>
          <div className="section-heading"><div><h2>Machine control center</h2><p>เลือกเครื่องจักรเพื่อควบคุมสถานะจำลอง</p></div><button className="btn btn-secondary" onClick={resetDemo} disabled title="ข้อมูลอยู่ใน Supabase แล้ว"><RotateCcw size={15}/> Reset demo</button></div>
          <div className="toolbar"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเครื่องจักร..."/></div><select className="select" value={filter} onChange={e => setFilter(e.target.value)}><option>All</option><option>Running</option><option>Stopped</option><option>Fault</option></select></div>
          <div className="panel" style={{ padding: 18, marginBottom: 18 }}><div className="section-heading" style={{ marginBottom: 10 }}><div><h3>Machine Master</h3><p>จัดการทะเบียนเครื่องจักรใน Supabase · เฉพาะ Admin</p></div><button className="btn btn-primary" disabled={!isAdmin || busy} onClick={() => openMachineForm()}>+ เพิ่มเครื่องจักร</button></div><div className="table-wrap"><table><thead><tr><th>รหัส</th><th>ชื่อเครื่องจักร</th><th>ตำแหน่ง</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{filteredMachines.map(m => <tr key={m.id}><td className="mono">{m.id}</td><td>{m.name}</td><td>{m.location}</td><td><StatusPill status={m.status}/></td><td><div className="actions"><button className="small-btn" disabled={!isAdmin || busy} onClick={() => openMachineForm(m)}>แก้ไข</button><button className="small-btn" disabled={!isAdmin || busy} onClick={() => void deleteMachine(m)}>ลบ</button></div></td></tr>)}</tbody></table></div></div>
          <div className="machine-cards">{filteredMachines.map(m => <div key={m.id} className={`panel machine-card ${selectedMachine === m.id ? 'machine-card-selected' : ''}`}><div className="machine-card-top"><div className={`machine-icon big ${m.status.toLowerCase()}`}><Cpu size={23}/></div><StatusPill status={m.status}/></div><h3>{m.name}</h3><p>{m.id} · {m.location}</p><div className="metric-row"><div><span>Temperature</span><strong>{m.temperature}°C</strong></div><div><span>Vibration</span><strong>{m.vibration.toFixed(1)} mm/s</strong></div><div><span>Runtime</span><strong>{m.runtime} h</strong></div></div><button className="btn btn-primary full" onClick={() => setSelectedMachine(m.id)}>{selectedMachine === m.id ? 'Selected for control' : 'Select machine'}</button></div>)}</div>
          <div className="panel simulator-panel"><div className="panel-head"><div><h3><Settings2 size={18}/> Control panel</h3><p>คำสั่งควบคุมเครื่องจำลองบันทึกสถานะลง Supabase · เฉพาะ Admin</p></div></div><Simulator machine={currentMachine} machines={machines} selectedMachine={selectedMachine} setSelectedMachine={setSelectedMachine} onStart={startMachine} onStop={stopMachine} onAlarm={triggerAlarm} onReset={resetMachine} onWorkOrder={() => createWorkOrder()} canControl={isAdmin && !busy}/></div>
        </>}
        {activeTab === 'Alarms' && <>
          <div className="section-heading"><div><h2>Alarm event log</h2><p>ติดตาม รับทราบ และปิดเหตุขัดข้อง</p></div><button className="btn btn-danger" onClick={triggerAlarm} disabled={!isAdmin || busy} title={!isAdmin ? "เฉพาะ Admin" : undefined}><Zap size={15}/> Trigger test alarm</button></div>
          <div className="stats-grid compact-stats"><StatCard label="TOTAL EVENTS" value={alarms.length.toString().padStart(2, '0')} icon={<Bell size={18}/>} /><StatCard label="OPEN" value={alarms.filter(a => a.status === 'Open').length.toString().padStart(2, '0')} icon={<AlertTriangle size={18}/>} tone="red"/><StatCard label="ACKNOWLEDGED" value={alarms.filter(a => a.status === 'Acknowledged').length.toString().padStart(2, '0')} icon={<ShieldCheck size={18}/>} tone="amber"/><StatCard label="RESOLVED" value={alarms.filter(a => a.status === 'Resolved').length.toString().padStart(2, '0')} icon={<CheckCircle2 size={18}/>} tone="green"/></div>
          <div className="panel"><div className="toolbar in-panel"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา Alarm..."/></div><select className="select" value={filter} onChange={e => setFilter(e.target.value)}><option>All</option><option>Open</option><option>Acknowledged</option><option>Resolved</option><option>Critical</option><option>Warning</option></select></div><div className="table-wrap"><table><thead><tr><th>ALARM ID</th><th>SEVERITY</th><th>MACHINE</th><th>MESSAGE</th><th>TIME</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{filteredAlarms.map(a => <tr key={a.id}><td className="mono">{a.id}</td><td><StatusPill status={a.severity}/></td><td>{a.machine}</td><td>{a.message}</td><td className="mono">{a.time}</td><td><StatusPill status={a.status}/></td><td><div className="actions">{a.status === 'Open' && <button className="small-btn" onClick={() => acknowledgeAlarm(a.id)} disabled={!canHandleMaintenance || busy}>รับทราบ</button>}{a.status !== 'Resolved' && <button className="small-btn success-btn" onClick={() => resolveAlarm(a.id)} disabled={!canHandleMaintenance || busy}>ปิด Alarm</button>}{a.status === 'Resolved' && <span className="muted-text">Completed</span>}</div></td></tr>)}</tbody></table>{filteredAlarms.length === 0 && <EmptyState text="ไม่พบ Alarm ที่ตรงกับการค้นหา"/>}</div></div>
        </>}
        {activeTab === 'Maintenance' && <>
          <div className="section-heading"><div><h2>Maintenance work orders</h2><p>สร้างและติดตามสถานะงานซ่อมบำรุง</p></div><button className="btn btn-primary" onClick={() => createWorkOrder()} disabled={!isAdmin || busy} title={!isAdmin ? "เฉพาะ Admin" : undefined}><Wrench size={15}/> Create work order</button></div>
          <div className="toolbar"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาใบงาน..."/></div><select className="select" value={filter} onChange={e => setFilter(e.target.value)}><option>All</option><option>Open</option><option>In Progress</option><option>Completed</option><option>High</option><option>Medium</option><option>Low</option></select></div>
          <div className="panel"><div className="table-wrap"><table><thead><tr><th>WORK ORDER</th><th>MACHINE</th><th>DESCRIPTION</th><th>PRIORITY</th><th>CREATED</th><th>STATUS / UPDATE</th></tr></thead><tbody>{filteredOrders.map(o => <tr key={o.id}><td className="mono">{o.id}</td><td>{o.machine}</td><td>{o.title}</td><td><StatusPill status={o.priority}/></td><td>{o.created}</td><td><select className="select status-select" value={o.status} onChange={e => updateOrder(o.id, e.target.value as WorkOrder['status'])} disabled={!canHandleMaintenance || busy}><option>Open</option><option>In Progress</option><option>Completed</option></select></td></tr>)}</tbody></table>{filteredOrders.length === 0 && <EmptyState text="ไม่พบใบงานซ่อม"/>}</div></div>
          <div className="info-note"><CircleHelp size={17}/><span>เมื่อสร้างใบงาน ระบบจะเพิ่มรายการเข้าในตารางทันที ข้อมูลใบงานซ่อมบันทึกใน Supabase</span></div>
        </>}
        {machineForm && <div role="dialog" aria-modal="true" aria-label="Machine Master" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}><form onSubmit={saveMachineForm} className="panel" style={{ width:'min(520px,100%)', maxHeight:'90vh', overflowY:'auto', padding:24, display:'grid', gap:12 }}><h2>{machineForm.mode === 'new' ? 'เพิ่มเครื่องจักร' : 'แก้ไขเครื่องจักร'}</h2>{([['code','รหัสเครื่องจักร'],['name','ชื่อเครื่องจักร'],['location','ตำแหน่ง'],['temperature','Temperature (°C)'],['vibration','Vibration (mm/s)'],['runtime','Runtime (h)']] as const).map(([key,label]) => <label key={key} style={{display:'grid',gap:5}}>{label}<input className="select" required value={machineForm[key]} disabled={busy || (key === 'code' && machineForm.mode === 'edit')} type={['temperature','vibration','runtime'].includes(key) ? 'number' : 'text'} step={key === 'runtime' ? '1' : key === 'temperature' || key === 'vibration' ? '0.1' : undefined} onChange={e => setMachineForm(prev => prev ? {...prev, [key]:e.target.value} : prev)}/></label>)}<div className="actions"><button type="submit" className="btn btn-primary" disabled={busy}>บันทึก</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setMachineForm(null)}>ยกเลิก</button></div></form></div>}
        <footer className="footer"><span>PlantOps · Alarm & Maintenance Management System</span><span>Prototype v1.1 · Supabase-backed simulation</span></footer>
      </div>
    </section>
  </main>;
}

function StatCard({ label, value, hint, icon, tone = 'blue' }: { label: string; value: string; hint?: string; icon: React.ReactNode; tone?: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{hint && <div className="stat-hint">{hint}</div>}</div>;
}
function StatusPill({ status }: { status: string }) { return <span className={`status-pill ${statusClass(status)}`}><i/>{status}</span>; }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><ClipboardList size={24}/><span>{text}</span></div>; }
function Simulator({ machine, machines, selectedMachine, setSelectedMachine, onStart, onStop, onAlarm, onReset, onWorkOrder, canControl }: { machine: Machine; machines: Machine[]; selectedMachine: string; setSelectedMachine: (id: string) => void; onStart: () => void; onStop: () => void; onAlarm: () => void; onReset: () => void; onWorkOrder: () => void; canControl: boolean }) {
  return <div className="simulator-layout"><div className="sim-machine-view"><div className="sim-grid"/><div className={`machine-illustration ${machine.status.toLowerCase()}`}><div className="machine-top"/><div className="machine-body"><div className="machine-display"><span className={machine.status === 'Running' ? 'display-light on' : 'display-light'}/><span className={machine.status === 'Fault' ? 'display-light fault-light on' : 'display-light fault-light'}/><span className="display-line"/></div><div className="machine-vent"><i/><i/><i/><i/></div></div><div className="machine-base"/><div className="machine-feet"><i/><i/></div></div><div className="sim-overlay-label"><span className="live-dot"/> SIMULATED PLC SIGNAL</div><div className="sim-status-caption"><span>Current status</span><StatusPill status={machine.status}/></div></div><div className="sim-controls"><label className="control-label">SELECT MACHINE</label><select className="select machine-select" value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}>{machines.map(m => <option key={m.id} value={m.id}>{m.id} — {m.name}</option>)}</select><div className="control-readings"><div><span>Temperature</span><strong>{machine.temperature}°C</strong><div className="meter"><i style={{ width: `${Math.min(machine.temperature, 100)}%` }}/></div></div><div><span>Vibration</span><strong>{machine.vibration.toFixed(1)} mm/s</strong><div className="meter amber-meter"><i style={{ width: `${Math.min(machine.vibration * 12, 100)}%` }}/></div></div></div><label className="control-label">MACHINE COMMANDS</label><div className="control-buttons"><button className="btn btn-start" onClick={onStart} disabled={!canControl || machine.status === 'Running' || machine.status === 'Fault'}><Play size={15} fill="currentColor"/> Start</button><button className="btn btn-stop" onClick={onStop} disabled={!canControl || machine.status === 'Stopped'}><Square size={14} fill="currentColor"/> Stop</button><button className="btn btn-danger" onClick={onAlarm} disabled={!canControl}><AlertTriangle size={15}/> Trigger Alarm</button><button className="btn btn-secondary" onClick={onReset} disabled={!canControl}><RotateCcw size={15}/> Reset</button></div><button className="btn btn-primary full work-order-btn" onClick={onWorkOrder} disabled={!canControl}><Wrench size={15}/> Create maintenance work order</button><p className="sim-disclaimer"><Power size={13}/> ควบคุมสถานะใน Simulator เท่านั้น ไม่ได้เชื่อมต่อเครื่องจักรจริง</p></div></div>;
}
