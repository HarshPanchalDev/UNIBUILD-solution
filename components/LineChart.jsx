/** Small dependency-free SVG line + area chart. data: [{ label, value }] */
export default function LineChart({ data, height = 220, label = "Chart" }) {
  const W = 600;
  const H = height;
  const pad = { t: 16, r: 16, b: 28, l: 36 };
  const top = Math.max(...data.map((d) => d.value), 0);
  const step = top > 2000 ? 1000 : top > 400 ? 200 : 50;
  const max = Math.max(step, Math.ceil(top / step) * step);
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (data.length - 1);
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2b5596" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2b5596" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t ? "3 4" : undefined} />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{t}</text>
        </g>
      ))}
      <path d={area} fill="url(#area)" />
      <path d={line} fill="none" stroke="#1b4180" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={x(i)} cy={y(d.value)} r={data.length > 10 ? 3 : 4.5} fill="#fff" stroke="#1b4180" strokeWidth="2.5">
            <title>{`${d.label}: ${d.value} pts`}</title>
          </circle>
          {i % Math.ceil(data.length / 7) === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">{d.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}
