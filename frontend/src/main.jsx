import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || '/api';

async function api(path, options = {}) {
  const token = localStorage.getItem('careflow_token');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function Logo() {
  return <div className="logo"><span className="logo-mark">+</span> CareFlow</div>;
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (mode === 'register') await api('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) });
      localStorage.setItem('careflow_token', result.token);
      onLogin(result.user);
    } catch (caught) { setError(caught.message); }
  };
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-intro"><Logo /><div className="eyebrow">Your health, simpler</div><h1>Care that fits your life.</h1><p>Find trusted doctors, request visits, and stay connected to every step of your care.</p><div className="trust-row"><span>✓ Secure access</span><span>✓ Human support</span></div></div>
        <form className="auth-form" onSubmit={submit}>
          <div className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Get started'}</div>
          <h2>{mode === 'login' ? 'Sign in to CareFlow' : 'Create your patient account'}</h2>
          {mode === 'register' && <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}
          <label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Password<input required minLength="8" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          {error && <div className="error">{error}</div>}
          <button className="primary full" type="submit">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button className="link-button" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
        </form>
      </section>
    </main>
  );
}

function Sidebar({ user, active, onNavigate, onLogout, unread }) {
  const links = user.role === 'doctor'
    ? [['dashboard', '⌂', 'Overview'], ['requests', '▣', 'Requests'], ['slots', '◷', 'Availability'], ['notifications', '♧', 'Notifications']]
    : user.role === 'admin'
      ? [['dashboard', '⌂', 'Overview'], ['doctors', '♙', 'Doctors'], ['patients', '♙', 'Patients'], ['appointments', '▣', 'Appointments']]
      : [['dashboard', '⌂', 'Dashboard'], ['appointments', '▣', 'My appointments'], ['notifications', '♧', 'Notifications']];
  return <aside className="sidebar"><Logo /><div className="side-label">{user.role === 'doctor' ? 'CLINIC' : 'PATIENT'}</div>{links.map(([key, icon, label]) => <button key={key} className={`nav-item ${active === key ? 'active' : ''}`} onClick={() => onNavigate(key)}><span>{icon}</span>{label}{key === 'notifications' && unread > 0 && <b className="nav-badge">{unread}</b>}</button>)}<div className="side-bottom"><div className="avatar">{user.name[0]}</div><div><strong>{user.name}</strong><small>{user.role}</small></div><button className="logout" onClick={onLogout} aria-label="Log out">↪</button></div></aside>;
}

function Header({ title, subtitle, unread, onNotifications, onLogout }) {
  return <header className="topbar"><div><div className="eyebrow">CARE MANAGEMENT</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="top-actions"><button className="notification-button" onClick={onNotifications}>♧{unread > 0 && <b>{unread}</b>}</button><button className="outline logout-top" onClick={onLogout}>Log out</button></div></header>;
}

function StatusBadge({ status }) {
  return <span className={`status ${status}`}>{status}</span>;
}

function Notifications({ items, onReadAll, onRead }) {
  return <section className="content-card notifications"><div className="section-heading"><div><div className="eyebrow">UPDATES</div><h2>Notifications</h2><p>Stay up to date with your health activity.</p></div><button className="outline" onClick={onReadAll}>✓ Mark all read</button></div>{items.length === 0 ? <Empty icon="♧" title="You are all caught up" text="New appointment updates will appear here." /> : items.map((item) => <button className={`notification-row ${item.read ? '' : 'unread'}`} key={item._id} onClick={() => !item.read && onRead(item._id)}><span className="notification-icon">♧</span><span><strong>{item.title}</strong><small>{item.message}</small><em>{new Date(item.createdAt).toLocaleString()}</em></span>{!item.read && <i />}</button>)}</section>;
}

function Empty({ icon, title, text }) {
  return <div className="empty"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>;
}

function PatientDashboard({ onNavigate, onLogout, unread }) {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ appointmentTime: '', reason: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = async () => { const [doctorResult, appointmentResult] = await Promise.all([api('/doctors?available=true'), api('/appointments/my')]); setDoctors(doctorResult.doctors); setAppointments(appointmentResult.appointments); };
  useEffect(() => { load().catch((caught) => setError(caught.message)); }, []);
  const filtered = useMemo(() => doctors.filter((doctor) => `${doctor.name} ${doctor.specialty}`.toLowerCase().includes(query.toLowerCase())), [doctors, query]);
  const request = async (event) => { event.preventDefault(); try { await api('/appointments/request', { method: 'POST', body: JSON.stringify({ doctorId: selected._id, appointmentTime: new Date(form.appointmentTime).toISOString(), reason: form.reason }) }); setMessage('Request sent. The doctor will review your preferred time.'); setSelected(null); setForm({ appointmentTime: '', reason: '' }); await load(); } catch (caught) { setError(caught.message); } };
  return <><Header title="Good morning" subtitle="Find the right care and keep your appointments in one place." unread={unread} onNotifications={() => onNavigate('notifications')} onLogout={onLogout} /><div className="hero-card"><div><div className="eyebrow">CARE WHEN YOU NEED IT</div><h2>Feel better, with the right doctor.</h2><p>Browse specialists and request an appointment in just a few clicks.</p><button className="primary" onClick={() => document.getElementById('doctors').scrollIntoView({ behavior: 'smooth' })}>Find a doctor →</button></div><div className="hero-art">✚<span>+</span></div></div>{message && <div className="success">{message}</div>}{error && <div className="error">{error}</div>}<div className="section-heading compact" id="doctors"><div><div className="eyebrow">CARE TEAM</div><h2>Find your doctor</h2></div><input className="search" placeholder="Search doctors or specialties" value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="doctor-grid">{filtered.map((doctor) => <article className="doctor-card" key={doctor._id}><div className="doctor-avatar">{doctor.name.replace('Dr. ', '')[0]}</div><div><h3>{doctor.name}</h3><p>{doctor.specialty}</p></div><span className="available-dot">Available</span><button className="primary full" onClick={() => setSelected(doctor)}>Request appointment</button></article>)}</div><div className="section-heading compact"><div><div className="eyebrow">YOUR CARE</div><h2>Recent appointments</h2></div><button className="link-button" onClick={() => onNavigate('appointments')}>View all →</button></div><AppointmentList appointments={appointments.slice(0, 3)} />{selected && <RequestModal doctor={selected} form={form} setForm={setForm} onSubmit={request} onClose={() => setSelected(null)} />}</>;
}

function AppointmentList({ appointments, onCancel }) {
  if (!appointments.length) return <Empty icon="▣" title="No appointments yet" text="Your requested and confirmed visits will appear here." />;
  return <div className="appointment-list">{appointments.map((item) => <div className="appointment-row" key={item._id}><div className="date-tile"><strong>{new Date(item.appointmentTime).getDate()}</strong><small>{new Date(item.appointmentTime).toLocaleString('en', { month: 'short' })}</small></div><div className="appointment-main"><strong>{item.doctor?.name || 'Doctor'}</strong><span>{item.doctor?.specialty || 'Healthcare'} · {item.reason || 'Consultation'}</span></div><StatusBadge status={item.status} />{onCancel && ['pending', 'approved', 'confirmed'].includes(item.status) && <button className="link-button cancel-link" onClick={() => onCancel(item._id)}>Cancel</button>}</div>)}</div>;
}

function PatientAppointments({ onNavigate, onLogout, unread }) {
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api('/appointments/my').then((result) => setAppointments(result.appointments)).catch((caught) => setError(caught.message)); }, []);
  const cancel = async (id) => { try { await api(`/appointments/${id}/cancel`, { method: 'PATCH' }); setAppointments((items) => items.map((item) => item._id === id ? { ...item, status: 'cancelled' } : item)); } catch (caught) { setError(caught.message); } };
  return <><Header title="My appointments" subtitle="Track every requested, approved, and completed visit." unread={unread} onNotifications={() => onNavigate('notifications')} onLogout={onLogout} />{error && <div className="error">{error}</div>}<div className="content-card"><AppointmentList appointments={appointments} onCancel={cancel} /></div></>;
}

function RequestModal({ doctor, form, setForm, onSubmit, onClose }) {
  return <div className="modal-backdrop"><form className="modal" onSubmit={onSubmit}><button type="button" className="modal-close" onClick={onClose}>×</button><div className="eyebrow">REQUEST A VISIT</div><h2>{doctor.name}</h2><p>{doctor.specialty}</p><label>Preferred date and time<input required type="datetime-local" value={form.appointmentTime} onChange={(e) => setForm({ ...form, appointmentTime: e.target.value })} /></label><label>What can we help with?<textarea required maxLength="500" rows="4" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Briefly describe your reason for visiting" /></label><button className="primary full">Send request</button></form></div>;
}

function DoctorDashboard({ active, onNavigate, onDataChange, onLogout, unread }) {
  const [appointments, setAppointments] = useState([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const load = async () => { const result = await api(`/doctor/appointments${active === 'requests' ? '?status=pending' : ''}`); setAppointments(result.appointments); };
  useEffect(() => { load().catch((caught) => setError(caught.message)); }, [active]);
  const decide = async (id, decision) => { try { await api(`/doctor/appointments/${id}/decision`, { method: 'PATCH', body: JSON.stringify({ decision, rejectionReason: reason }) }); setReason(''); await load(); onDataChange(); } catch (caught) { setError(caught.message); } };
  if (active === 'slots') return <Slots onDataChange={onDataChange} />;
  if (active === 'notifications') return null;
  const pending = active === 'requests';
  return <><Header title={pending ? 'Appointment requests' : 'Doctor overview'} subtitle={pending ? 'Review requests and keep your schedule balanced.' : 'Here is what needs your attention today.'} unread={unread} onNotifications={() => onNavigate('notifications')} onLogout={onLogout} />{error && <div className="error">{error}</div>}<div className="stats"><div><span>Pending requests</span><strong>{appointments.filter((a) => a.status === 'pending').length}</strong></div><div><span>Approved visits</span><strong>{appointments.filter((a) => ['approved', 'confirmed'].includes(a.status)).length}</strong></div><div><span>Total requests</span><strong>{appointments.length}</strong></div></div><div className="content-card"><div className="section-heading"><div><div className="eyebrow">PATIENT CARE</div><h2>{pending ? 'Requests to review' : 'Your appointments'}</h2></div><button className="outline" onClick={() => onNavigate('requests')}>View requests</button></div>{pending && <input className="search rejection-input" placeholder="Optional rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} />}{appointments.length === 0 ? <Empty icon="▣" title="No requests yet" text="New patient requests will show up here." /> : <div className="doctor-appointment-grid">{appointments.map((item) => <article className="request-card" key={item._id}><div className="request-top"><div className="patient-avatar">{item.patient?.name?.[0] || 'P'}</div><div><strong>{item.patient?.name || 'Patient'}</strong><small>{item.patient?.email}</small></div><StatusBadge status={item.status} /></div><div className="request-details"><span>◷ {new Date(item.appointmentTime).toLocaleString()}</span><span>▣ {item.reason || 'Consultation'}</span></div>{item.status === 'pending' && <div className="decision"><button className="primary" onClick={() => decide(item._id, 'approved')}>Approve</button><button className="danger" onClick={() => decide(item._id, 'rejected')}>Reject</button></div>}</article>)}</div>}</div><p className="helper">Tip: configure explicit available times from the Availability page. When no slots are configured, any future time can be reviewed.</p></>;
}

function Slots({ onDataChange }) {
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { api('/doctor/slots').then((result) => setSlots(result.slots)).catch((caught) => setMessage(caught.message)); }, []);
  const add = () => { if (newSlot) { setSlots([...slots, new Date(newSlot).toISOString()]); setNewSlot(''); } };
  const save = async () => { try { await api('/doctor/slots', { method: 'PUT', body: JSON.stringify({ slots }) }); setMessage('Availability saved.'); onDataChange(); } catch (caught) { setMessage(caught.message); } };
  return <><Header title="Availability" subtitle="Offer clear times that patients can request." unread={0} onNotifications={() => {}} onLogout={() => {}} /><div className="content-card slots-card"><div className="eyebrow">OPEN TIMES</div><h2>Manage available slots</h2><p className="muted">If you add slots, approvals are limited to these exact times.</p><div className="slot-add"><input type="datetime-local" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} /><button className="primary" onClick={add}>Add slot</button></div><div className="slot-list">{slots.map((slot) => <span key={slot}>{new Date(slot).toLocaleString()} <button onClick={() => setSlots(slots.filter((item) => item !== slot))}>×</button></span>)}</div><button className="primary" onClick={save}>Save availability</button>{message && <div className="success">{message}</div>}</div></>;
}

function AdminDashboard({ active, onNavigate, onLogout, unread }) {
  const [stats, setStats] = useState({});
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', specialty: '', phone: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const [statsResult, doctorsResult, patientsResult, appointmentsResult] = await Promise.all([
        api('/admin/stats'),
        api(`/admin/doctors${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        api(`/admin/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        api('/admin/appointments'),
      ]);
      setStats(statsResult.stats);
      setDoctors(doctorsResult.doctors);
      setPatients(patientsResult.patients);
      setAppointments(appointmentsResult.appointments);
    } catch (caught) { setError(caught.message); }
  };
  useEffect(() => { load(); }, [active]);
  const createDoctor = async (event) => {
    event.preventDefault();
    try {
      await api('/admin/doctors', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', password: '', specialty: '', phone: '' });
      setMessage('Doctor account created.');
      await load();
    } catch (caught) { setError(caught.message); }
  };
  const toggle = async (id, current) => {
    try { await api(`/admin/accounts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !current }) }); await load(); }
    catch (caught) { setError(caught.message); }
  };
  const title = active === 'doctors' ? 'Doctor management' : active === 'patients' ? 'Patient records' : active === 'appointments' ? 'All appointments' : 'Hospital overview';
  return <><Header title={title} subtitle="Role-protected hospital operations and care oversight." unread={unread} onNotifications={() => onNavigate('dashboard')} onLogout={onLogout} />{error && <div className="error">{error}</div>}{message && <div className="success">{message}</div>}<div className="stats"><div><span>Active doctors</span><strong>{stats.doctors || 0}</strong></div><div><span>Active patients</span><strong>{stats.patients || 0}</strong></div><div><span>Pending requests</span><strong>{stats.pending || 0}</strong></div><div><span>Approved visits</span><strong>{stats.approved || 0}</strong></div></div>{active === 'dashboard' && <div className="admin-panels"><section className="content-card"><div className="section-heading"><div><div className="eyebrow">OPERATIONS</div><h2>Recent appointments</h2></div><button className="outline" onClick={() => onNavigate('appointments')}>View all</button></div><AdminAppointmentTable appointments={appointments.slice(0, 6)} /></section><section className="content-card"><div className="eyebrow">QUICK ACTION</div><h2>Add a doctor account</h2><DoctorForm form={form} setForm={setForm} onSubmit={createDoctor} /></section></div>}{active === 'doctors' && <section className="content-card"><div className="section-heading"><div><div className="eyebrow">CARE TEAM</div><h2>Doctors</h2></div><input className="search" placeholder="Search doctors" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></div><AdminDoctorTable doctors={doctors} onToggle={toggle} /></section>}{active === 'patients' && <section className="content-card"><div className="section-heading"><div><div className="eyebrow">PATIENTS</div><h2>Patient records</h2></div><input className="search" placeholder="Search patients" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></div><AdminPatientTable patients={patients} onToggle={toggle} /></section>}{active === 'appointments' && <section className="content-card"><div className="section-heading"><div><div className="eyebrow">SCHEDULE</div><h2>All appointments</h2></div></div><AdminAppointmentTable appointments={appointments} /></section>}</>;
}

function DoctorForm({ form, setForm, onSubmit }) {
  return <form className="admin-form" onSubmit={onSubmit}><input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required minLength="8" type="password" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><input required placeholder="Specialty" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /><input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><button className="primary full">Create doctor</button></form>;
}

function AdminDoctorTable({ doctors, onToggle }) {
  if (!doctors.length) return <Empty icon="♙" title="No doctors found" text="Create a linked doctor account to add a care provider." />;
  return <div className="admin-table">{doctors.map((item) => <div className="admin-row" key={item._id}><div className="doctor-avatar">{item.name[0]}</div><div><strong>{item.name}</strong><small>{item.specialty} · {item.account?.email || 'Profile without login'}</small></div><StatusBadge status={item.account?.active === false ? 'rejected' : 'approved'} /><button className="outline" disabled={!item.account} onClick={() => onToggle(item.account?._id, item.account?.active)}>{item.account?.active === false ? 'Reactivate' : 'Deactivate'}</button></div>)}</div>;
}

function AdminPatientTable({ patients, onToggle }) {
  if (!patients.length) return <Empty icon="♙" title="No patients found" text="Registered patient records will appear here." />;
  return <div className="admin-table">{patients.map((item) => <div className="admin-row" key={item._id}><div className="patient-avatar">{item.name[0]}</div><div><strong>{item.name}</strong><small>{item.email}</small></div><StatusBadge status={item.active === false ? 'rejected' : 'approved'} /><button className="outline" onClick={() => onToggle(item._id, item.active)}>{item.active === false ? 'Reactivate' : 'Deactivate'}</button></div>)}</div>;
}

function AdminAppointmentTable({ appointments }) {
  if (!appointments.length) return <Empty icon="▣" title="No appointments" text="Appointment requests will appear here." />;
  return <div className="admin-table">{appointments.map((item) => <div className="admin-row" key={item._id}><div className="date-tile"><strong>{new Date(item.appointmentTime).getDate()}</strong><small>{new Date(item.appointmentTime).toLocaleString('en', { month: 'short' })}</small></div><div><strong>{item.patient?.name || 'Patient'} · {item.doctor?.name || 'Doctor'}</strong><small>{new Date(item.appointmentTime).toLocaleString()} · {item.reason || 'Consultation'}</small></div><StatusBadge status={item.status} /></div>)}</div>;
}

function App() {
  const [user, setUser] = useState(null);
  const [active, setActive] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const refreshNotifications = async () => { if (localStorage.getItem('careflow_token')) { const result = await api('/notifications'); setNotifications(result.notifications); } };
  useEffect(() => { const saved = localStorage.getItem('careflow_user'); if (saved) setUser(JSON.parse(saved)); }, []);
  useEffect(() => { if (user) refreshNotifications().catch(() => {}); }, [user, active]);
  const login = (nextUser) => { localStorage.setItem('careflow_user', JSON.stringify(nextUser)); setUser(nextUser); };
  const logout = () => { localStorage.removeItem('careflow_token'); localStorage.removeItem('careflow_user'); setUser(null); };
  if (!user) return <AuthScreen onLogin={login} />;
  const unread = notifications.filter((item) => !item.read).length;
  const content = active === 'notifications' ? <Notifications items={notifications} onReadAll={async () => { await api('/notifications/read-all', { method: 'PATCH' }); refreshNotifications(); }} onRead={async (id) => { await api(`/notifications/${id}/read`, { method: 'PATCH' }); refreshNotifications(); }} /> : user.role === 'admin' ? <AdminDashboard active={active} onNavigate={setActive} onLogout={logout} unread={unread} /> : user.role === 'doctor' ? <DoctorDashboard active={active} onNavigate={setActive} onDataChange={refreshNotifications} /> : active === 'appointments' ? <PatientAppointments onNavigate={setActive} onLogout={logout} unread={unread} /> : <PatientDashboard onNavigate={setActive} />;
  return <div className="app-shell"><Sidebar user={user} active={active} onNavigate={setActive} onLogout={logout} unread={unread} /><main className="main-content">{React.cloneElement(content, { onLogout: logout, unread })}</main></div>;
}

createRoot(document.getElementById('root')).render(<App />);
