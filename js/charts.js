// Простые графики на чистом SVG — без библиотек.

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function barChart(data, { height = 140, unit = '', accent = 'var(--accent)' } = {}) {
  if (!data.length) return '<p class="muted">Пока нет данных</p>';
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 100 / data.length;
  const bars = data.map((d, i) => {
    const h = (d.value / max) * 100;
    const x = i * w;
    const highlight = d.highlight ? 'var(--accent)' : accent;
    return `
      <g>
        <rect x="${x + w * 0.15}" y="${100 - h}" width="${w * 0.7}" height="${Math.max(h, 0.8)}"
              rx="1" fill="${highlight}" opacity="${d.dim ? 0.35 : 1}">
          <title>${esc(d.label)}: ${esc(d.value)}${unit}</title>
        </rect>
      </g>`;
  }).join('');
  const labels = data.map((d, i) => `<span style="flex:1">${esc(d.short ?? d.label)}</span>`).join('');
  return `
    <div class="chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="height:${height}px;width:100%">
        ${bars}
      </svg>
      <div class="chart-x">${labels}</div>
    </div>`;
}

export function gauge(ratio, status) {
  const r = ratio == null ? 0 : Math.min(ratio, 2);
  const pct = (r / 2) * 100;
  const color = status === 'bad' ? 'var(--bad)' : status === 'warn' ? 'var(--warn)' : 'var(--good)';
  return `
    <div class="gauge">
      <div class="gauge-track">
        <div class="gauge-zone zone-low"></div>
        <div class="gauge-zone zone-ok"></div>
        <div class="gauge-zone zone-high"></div>
        <div class="gauge-pin" style="left:${pct}%;background:${color}"></div>
      </div>
      <div class="gauge-scale"><span>0</span><span>0,8</span><span>1,3</span><span>2,0</span></div>
    </div>`;
}

export function sparkline(values, { height = 40 } = {}) {
  if (values.length < 2) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - ((v - min) / span) * 100}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none" style="height:${height}px;width:100%">
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
