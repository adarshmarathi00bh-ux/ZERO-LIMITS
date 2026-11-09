import { useEffect, useState } from 'react';

export const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const rupees = (n) => `₹${n}`;
// Server insights embed times as [[epochMs]]; render them in the viewer's timezone.
export const withTimes = (s) => s.replace(/\[\[(\d+)\]\]/g, (_, t) => fmtTime(Number(t)));
export const toast = (msg) => window.dispatchEvent(new CustomEvent('qz-toast', { detail: msg }));

export function useNow(ms = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
