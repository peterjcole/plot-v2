export function fmtKm(m: number): string {
  return (m / 1000).toFixed(2);
}

export function fmtElev(m: number): string {
  return String(Math.round(m));
}

export function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function fmtPace(distM: number, timeSec: number): string {
  if (!distM) return '—';
  const secsPerKm = timeSec / (distM / 1000);
  const m = Math.floor(secsPerKm / 60);
  const s = Math.round(secsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
