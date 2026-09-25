const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Parts = { kind: 'now' } | { kind: 'minutes'; n: number } | { kind: 'hours'; n: number } | { kind: 'yesterday' } | { kind: 'date'; label: string };

function parts(iso: string, now: number): Parts {
  const then = new Date(iso).getTime();
  const minutes = Math.floor(Math.max(0, now - then) / 60_000);
  if (minutes < 1) return { kind: 'now' };
  if (minutes < 60) return { kind: 'minutes', n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { kind: 'hours', n: hours };
  const date = new Date(then);
  const today = new Date(now);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate()) {
    return { kind: 'yesterday' };
  }
  const label = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return { kind: 'date', label: date.getFullYear() === today.getFullYear() ? label : `${label}, ${date.getFullYear()}` };
}

/** Compact social timestamps: "just now", "5m", "2h", "Yesterday", "Sep 25", "Sep 25, 2025". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const p = parts(iso, now);
  if (p.kind === 'now') return 'just now';
  if (p.kind === 'minutes') return `${p.n}m`;
  if (p.kind === 'hours') return `${p.n}h`;
  if (p.kind === 'yesterday') return 'Yesterday';
  return p.label;
}

/** The same, as VoiceOver should say it: "just now", "5 minutes ago", "yesterday", "on Sep 25". */
export function spokenTimeAgo(iso: string, now: number = Date.now()): string {
  const p = parts(iso, now);
  if (p.kind === 'now') return 'just now';
  if (p.kind === 'minutes') return `${p.n} ${p.n === 1 ? 'minute' : 'minutes'} ago`;
  if (p.kind === 'hours') return `${p.n} ${p.n === 1 ? 'hour' : 'hours'} ago`;
  if (p.kind === 'yesterday') return 'yesterday';
  return `on ${p.label}`;
}
