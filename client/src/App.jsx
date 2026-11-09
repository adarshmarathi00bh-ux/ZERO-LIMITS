import { useEffect, useState } from 'react';
import Student from './Student.jsx';
import Kitchen from './Kitchen.jsx';
import Manager from './Manager.jsx';
import { api } from './api.js';
import { socket } from './socket.js';

function PinGate({ label, onOk }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    try { const r = await api.auth(pin); onOk(pin, r.role); } catch (x) { setErr(x.message); }
  }
  return (
    <form className="gate card" onSubmit={submit}>
      <h2>{label} sign in</h2>
      <p>Enter your staff PIN. Demo PINs: kitchen 1111, manager 2222.</p>
      <input inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" aria-label="Staff PIN" />
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" type="submit">Sign in</button>
    </form>
  );
}

export default function App() {
  const [tab, setTab] = useState('student');
  const [auth, setAuth] = useState({ pin: '', role: '' });
  const [toasts, setToasts] = useState([]);
  const [live, setLive] = useState(socket.connected);
  const [ai, setAi] = useState(false);

  useEffect(() => {
    api.config().then((c) => setAi(c.ai)).catch(() => {});
    const on = () => setLive(true); const off = () => setLive(false);
    socket.on('connect', on); socket.on('disconnect', off);
    const t = (e) => {
      const id = Math.random();
      setToasts((x) => [...x, { id, msg: e.detail }]);
      setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4200);
    };
    window.addEventListener('qz-toast', t);
    return () => { socket.off('connect', on); socket.off('disconnect', off); window.removeEventListener('qz-toast', t); };
  }, []);

  const tabs = [['student', 'Order'], ['kitchen', 'Kitchen'], ['manager', 'Manager']];
  const allowed = tab === 'student' || (tab === 'kitchen' && auth.role) || (tab === 'manager' && auth.role === 'manager');

  return (
    <>
      <header className="top">
        <div className="brand"><span className="zero">0</span><b>QueueZero</b><small>Skip the line, not the meal</small></div>
        <nav className="tabs" aria-label="Choose your view">
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-current={tab === id}>{label}</button>
          ))}
        </nav>
        <div className="status">
          <span className={`dot ${live ? 'live' : ''}`} />{live ? 'Live' : 'Reconnecting'}
          <span className="pill">{ai ? 'Claude is reading orders' : 'Offline order parser'}</span>
        </div>
      </header>
      <main>
        {tab === 'student' && <Student />}
        {tab !== 'student' && !allowed && <PinGate label={tab === 'kitchen' ? 'Kitchen' : 'Manager'} onOk={(pin, role) => setAuth({ pin, role })} />}
        {tab === 'kitchen' && allowed && <Kitchen pin={auth.pin} />}
        {tab === 'manager' && allowed && <Manager pin={auth.pin} />}
      </main>
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
    </>
  );
}
