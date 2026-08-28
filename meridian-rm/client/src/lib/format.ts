export const usd = (v: unknown): string => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};

export const pct = (v: unknown, digits = 1): string => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
};

export const apy = (v: unknown): string => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(2)}% APY`;
};

export const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isNaN(n) ? 0 : n;
};
