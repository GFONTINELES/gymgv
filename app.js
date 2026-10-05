'use strict';
/* Treino: registro de treinos e evolução. Tudo roda no aparelho (localStorage). */

const KEY = 'treino-app-v1';
const DOW = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const LBL = { forte: 'Forte', deload: 'Deload', final: 'Final' };
const PLAN_N = { forte: 5, deload: 4, final: 3 };
const BLOCK = ['Base: volume alto, técnica, cargas moderadas', 'Intensidade: suba a carga, volume um pouco menor', 'Pico: teste seus limites (cargas, PRs)'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');

/* ---------- datas ---------- */
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const todayStr = () => fmt(new Date());
const br = s => { const [, m, d] = s.split('-'); return `${d}/${m}`; };

/* ---------- plano padrão (editável em Ajustes) ---------- */
const E = (id, name, type = 'kg') => ({ id, name, type });
const DEFAULT_PLAN = {
  1: { name: 'Peito e Tríceps', cardio: 15, ex: [E('supino-reto', 'Supino reto'), E('supino-inclinado', 'Supino inclinado'), E('crucifixo', 'Crucifixo'), E('triceps-testa', 'Tríceps testa'), E('triceps-corda', 'Tríceps corda'), E('triceps-frances', 'Tríceps francês')] },
  2: { name: 'Pernas completas', cardio: 0, ex: [E('agachamento', 'Agachamento'), E('leg-press', 'Leg press'), E('extensora', 'Cadeira extensora'), E('flexora', 'Mesa flexora'), E('stiff', 'Stiff'), E('abdutora', 'Cadeira abdutora')] },
  3: { name: 'Costas e Bíceps', cardio: 15, ex: [E('puxada', 'Puxada frontal'), E('remada-baixa', 'Remada baixa'), E('remada-unilateral', 'Remada unilateral'), E('rosca-direta', 'Rosca direta'), E('rosca-martelo', 'Rosca martelo'), E('rosca-scott', 'Rosca scott')] },
  4: { name: 'Ombro, Panturrilha e Abdômen', cardio: 0, ex: [E('desenvolvimento', 'Desenvolvimento'), E('elev-lateral', 'Elevação lateral'), E('elev-posterior', 'Elevação posterior'), E('panturrilha-pe', 'Panturrilha em pé'), E('panturrilha-sentado', 'Panturrilha sentado'), E('prancha', 'Prancha', 'time'), E('abdominal', 'Abdominal', 'reps')] },
  5: { name: 'Descanso', cardio: 0, ex: [] },
  6: { name: 'Superior completo', cardio: 25, ex: [E('supino-inc-halter', 'Supino inclinado (halteres)'), E('remada-curvada', 'Remada curvada'), E('elev-lateral-sab', 'Elevação lateral (sábado)'), E('rosca-alternada', 'Rosca alternada'), E('triceps-pulley', 'Tríceps pulley'), E('barra-fixa', 'Barra fixa ou puxada')] },
  0: { name: 'Descanso', cardio: 0, ex: [] },
};

/* ---------- estado ---------- */
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.plan && s.logs && s.cfg) return s;
  } catch (e) { /* ignora e recria */ }
  return { cfg: { start: '2026-10-05', end: '2026-12-31' }, plan: JSON.parse(JSON.stringify(DEFAULT_PLAN)), logs: {} };
}
let S = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const L = d => (S.logs[d] = S.logs[d] || { sets: {}, done: false });

let tab = 'hoje';
let cur = todayStr();
let evoEx = null;
let evoMetric = 'max';
let openK = null;

/* ---------- semanas e estatísticas ---------- */
const totalDays = () => diffDays(S.cfg.start, S.cfg.end) + 1;
const totalWeeks = () => Math.ceil(totalDays() / 7);
const weekNo = d => Math.floor(diffDays(S.cfg.start, d) / 7) + 1;
function weekType(n) {
  if (n === totalWeeks() && totalDays() % 7 !== 0) return 'final';
  return n % 4 === 0 ? 'deload' : 'forte';
}
function stats() {
  const perWeek = [];
  let planned = 0;
  for (let i = 1; i <= totalWeeks(); i++) {
    const p = PLAN_N[weekType(i)];
    planned += p;
    perWeek.push({ n: i, planned: p, done: 0 });
  }
  let done = 0;
  for (const [d, l] of Object.entries(S.logs)) {
    if (l.done && d >= S.cfg.start && d <= S.cfg.end) { done++; perWeek[weekNo(d) - 1].done++; }
  }
  return { planned, done, perWeek };
}
const hasData = l => !!l && (Object.values(l.sets || {}).some(a => a.length) || +l.cardio > 0);

/* ---------- séries ---------- */
function lastSets(id, d) {
  const ds = Object.keys(S.logs).filter(x => x < d && (S.logs[x].sets || {})[id] && S.logs[x].sets[id].length).sort();
  const x = ds[ds.length - 1];
  return x ? { date: x, sets: S.logs[x].sets[id] } : null;
}
function fmtSet(s, type) {
  if (type === 'time') return `${+s.sec || 0}s`;
  if (type === 'reps') return `${+s.reps || 0}`;
  return `${+s.kg || 0}×${+s.reps || 0}`;
}
function setInputs(s, type) {
  if (type === 'time') return `<input type="number" inputmode="numeric" data-chg="setval" data-f="sec" value="${s.sec ?? ''}" placeholder="segundos">`;
  if (type === 'reps') return `<input type="number" inputmode="numeric" data-chg="setval" data-f="reps" value="${s.reps ?? ''}" placeholder="reps">`;
  return `<input type="number" inputmode="decimal" data-chg="setval" data-f="kg" value="${s.kg ?? ''}" placeholder="kg"><input type="number" inputmode="numeric" data-chg="setval" data-f="reps" value="${s.reps ?? ''}" placeholder="reps">`;
}

/* ---------- tela: Hoje ---------- */
function exCard(ex, log, d) {
  const sets = (log.sets || {})[ex.id] || [];
  const last = lastSets(ex.id, d);
  const hint = last ? `Última (${br(last.date)}): ${last.sets.map(s => fmtSet(s, ex.type)).join(' · ')}` : 'Sem histórico ainda';
  const rows = sets.map((s, i) => `<div class="set" data-ex="${esc(ex.id)}" data-i="${i}"><span class="n">${i + 1}</span>${setInputs(s, ex.type)}<button class="x" data-act="delset" aria-label="Remover série">×</button></div>`).join('');
  return `<div class="card"><h3>${esc(ex.name)}</h3><p class="muted">${esc(hint)}</p>${rows}<button class="add" data-act="addset" data-ex="${esc(ex.id)}">+ Série</button></div>`;
}

function viewHoje() {
  const d = cur, log = S.logs[d] || { sets: {} };
  const dow = parse(d).getDay(), pk = log.planDay ?? dow, plan = S.plan[pk];
  const inR = d >= S.cfg.start && d <= S.cfg.end;
  const wn = weekNo(d), wt = inR ? weekType(wn) : null;
  const left = Math.max(0, diffDays(todayStr(), S.cfg.end));
  let h = `<header class="top"><button data-act="prev" aria-label="Dia anterior">‹</button><div><h1>${DOW[dow]}, ${br(d)}</h1><p class="muted">${inR ? `Semana ${wn} · ${LBL[wt]} · faltam ${left} dias` : 'Fora do período do plano'}</p></div><button data-act="next" aria-label="Próximo dia">›</button></header>`;
  if (d !== todayStr()) h += `<button class="add" data-act="hoje">Voltar para hoje</button>`;
  if (wt === 'deload') h += `<div class="banner deload">Semana de deload: reduza carga ou séries em 30 a 40% e priorize a recuperação.</div>`;
  else if (wt === 'final') h += `<div class="banner">Semana final: treinos leves ou testes de PR.</div>`;
  else if (wt) h += `<div class="banner">${BLOCK[Math.min(2, Math.floor((wn - 1) / 4))]}</div>`;
  h += `<label>Treino do dia<select data-chg="planday">${ORDER.map(k => `<option value="${k}" ${k === pk ? 'selected' : ''}>${DOW[k]}: ${esc(S.plan[k].name)}</option>`).join('')}</select></label>`;
  if (!plan.ex.length) h += `<div class="card"><h3>${esc(plan.name)}</h3><p class="muted">Dia de descanso. Se treinou mesmo assim, escolha outro treino acima.</p></div>`;
  h += plan.ex.map(ex => exCard(ex, log, d)).join('');
  h += `<div class="card"><div class="row"><label>Cardio (min)<input type="number" inputmode="numeric" data-chg="cardio" value="${log.cardio ?? ''}" placeholder="${plan.cardio || 0}"></label><label>Peso corporal (kg)<input type="number" inputmode="decimal" data-chg="bw" value="${log.bw ?? ''}"></label></div><label style="margin-top:10px">Observações<textarea data-chg="note">${esc(log.note || '')}</textarea></label></div>`;
  h += `<button class="big ${log.done ? 'ok' : ''}" data-act="done">${log.done ? '✓ Treino concluído' : 'Concluir treino'}</button>`;
  return h;
}

/* ---------- tela: Calendário ---------- */
function monthHTML(y, m) {
  const first = new Date(y, m, 1), off = (first.getDay() + 6) % 7, nd = new Date(y, m + 1, 0).getDate();
  let g = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(x => `<div class="h">${x}</div>`).join('') + '<div class="d empty"></div>'.repeat(off);
  for (let day = 1; day <= nd; day++) {
    const ds = fmt(new Date(y, m, day)), log = S.logs[ds], dow = new Date(y, m, day).getDay();
    const pk = (log && log.planDay) ?? dow;
    const cls = ['d'];
    if (ds < S.cfg.start || ds > S.cfg.end) cls.push('out');
    if (log && log.done) cls.push('done'); else if (hasData(log)) cls.push('part'); else if (!S.plan[pk].ex.length) cls.push('rest');
    if (ds === todayStr()) cls.push('today');
    if (ds === cur) cls.push('sel');
    g += `<button class="${cls.join(' ')}" data-act="goto" data-d="${ds}">${day}</button>`;
  }
  return `<section class="cal"><h2>${MES[m]} ${y}</h2><div class="grid">${g}</div></section>`;
}
function viewCal() {
  const st = stats(), s = parse(S.cfg.start), e = parse(S.cfg.end);
  let h = `<h1>Calendário</h1><p class="muted">${st.done} de ${st.planned} treinos planejados · verde = concluído · laranja = parcial</p>`;
  for (let mi = s.getFullYear() * 12 + s.getMonth(); mi <= e.getFullYear() * 12 + e.getMonth(); mi++) h += monthHTML(Math.floor(mi / 12), mi % 12);
  return h;
}

/* ---------- gráficos (SVG) ---------- */
function lineChart(pts, unit) {
  if (!pts.length) return '<p class="muted">Sem dados ainda.</p>';
  const W = 320, H = 170, P = 30;
  const ys = pts.map(p => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const t0 = parse(pts[0].x).getTime(), t1 = parse(pts[pts.length - 1].x).getTime();
  const X = t => pts.length === 1 ? W / 2 : P + (t - t0) / (t1 - t0 || 1) * (W - 2 * P);
  const Y = v => H - P - (v - min) / (max - min) * (H - 2 * P);
  const r1 = v => Math.round(v * 10) / 10;
  const line = pts.map(p => `${X(parse(p.x).getTime()).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const dots = pts.map(p => `<circle class="pt" cx="${X(parse(p.x).getTime()).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img"><line class="gl" x1="${P}" x2="${W - P}" y1="${Y(max)}" y2="${Y(max)}"/><line class="gl" x1="${P}" x2="${W - P}" y1="${Y(min)}" y2="${Y(min)}"/><text class="ax" x="2" y="${Y(max) + 3}">${r1(max)}</text><text class="ax" x="2" y="${Y(min) + 3}">${r1(min)}</text><polyline class="ln" points="${line}"/>${dots}<text class="ax" x="${P}" y="${H - 8}">${br(pts[0].x)}</text><text class="ax" x="${W - P}" y="${H - 8}" text-anchor="end">${br(pts[pts.length - 1].x)}</text><text class="ax" x="${W / 2}" y="12" text-anchor="middle">${unit}</text></svg>`;
}
function weekBars(pw) {
  const W = 320, H = 130, P = 22, bw = (W - 2 * P) / pw.length, top = 5, ch = H - 2 * P;
  let g = '';
  pw.forEach((w, i) => {
    const x = P + i * bw + 3, ww = bw - 6, hp = w.planned / top * ch, hd = Math.min(w.done, top) / top * ch;
    g += `<rect class="bp" x="${x}" y="${H - P - hp}" width="${ww}" height="${hp}" rx="2"/><rect class="bd" x="${x}" y="${H - P - hd}" width="${ww}" height="${hd}" rx="2"/><text class="ax" x="${x + ww / 2}" y="${H - 8}" text-anchor="middle">${w.n}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}<text class="ax" x="${W / 2}" y="12" text-anchor="middle">Treinos por semana (cinza = planejado, verde = feito)</text></svg>`;
}

/* ---------- tela: Evolução ---------- */
function allEx() {
  const seen = new Map();
  for (const k of ORDER) for (const ex of S.plan[k].ex) if (!seen.has(ex.id)) seen.set(ex.id, ex);
  return [...seen.values()];
}
function metricVal(sets, type, metric) {
  const kg = s => +s.kg || 0, rp = s => +s.reps || 0;
  if (type === 'time') return Math.max(...sets.map(s => +s.sec || 0));
  if (type === 'reps') return sets.reduce((a, s) => a + rp(s), 0);
  if (metric === 'vol') return sets.reduce((a, s) => a + kg(s) * rp(s), 0);
  if (metric === '1rm') return Math.max(...sets.map(s => kg(s) * (1 + rp(s) / 30)));
  return Math.max(...sets.map(kg));
}
function viewEvo() {
  const st = stats(), exs = allEx();
  if (!evoEx || !exs.find(e => e.id === evoEx)) evoEx = exs[0] ? exs[0].id : null;
  const ex = exs.find(e => e.id === evoEx);
  const wn = Math.min(Math.max(weekNo(todayStr()), 1), totalWeeks()), wk = st.perWeek[wn - 1];
  let h = `<h1>Evolução</h1><div class="kpis"><div class="kpi"><b>${st.done}</b>treinos feitos</div><div class="kpi"><b>${st.planned ? Math.round(st.done / st.planned * 100) : 0}%</b>do plano</div><div class="kpi"><b>${wk.done}/${wk.planned}</b>esta semana</div><div class="kpi"><b>${Math.max(0, diffDays(todayStr(), S.cfg.end))}</b>dias restantes</div></div>`;
  h += `<h2>Frequência</h2><div class="card">${weekBars(st.perWeek)}</div>`;
  h += `<h2>Exercício</h2><label>Exercício<select data-chg="evoex">${exs.map(e => `<option value="${esc(e.id)}" ${e.id === evoEx ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>`;
  if (ex && ex.type === 'kg') h += `<label style="margin-top:8px">Métrica<select data-chg="evometric"><option value="max" ${evoMetric === 'max' ? 'selected' : ''}>Carga máxima (kg)</option><option value="1rm" ${evoMetric === '1rm' ? 'selected' : ''}>1RM estimado (Epley)</option><option value="vol" ${evoMetric === 'vol' ? 'selected' : ''}>Volume (kg × reps)</option></select></label>`;
  let pts = [];
  if (ex) {
    for (const d of Object.keys(S.logs).sort()) {
      const sets = (S.logs[d].sets || {})[ex.id];
      if (sets && sets.length) { const y = metricVal(sets, ex.type, evoMetric); if (y > 0) pts.push({ x: d, y }); }
    }
  }
  const unit = !ex ? '' : ex.type === 'time' ? 'segundos (melhor série)' : ex.type === 'reps' ? 'repetições (total)' : evoMetric === 'vol' ? 'volume (kg)' : evoMetric === '1rm' ? '1RM estimado (kg)' : 'carga máxima (kg)';
  h += `<div class="card">${lineChart(pts, unit)}</div>`;
  if (pts.length) { const best = pts.reduce((a, b) => (b.y >= a.y ? b : a)); h += `<p class="muted">Melhor marca: ${Math.round(best.y * 10) / 10} em ${br(best.x)}</p>`; }
  const bw = Object.keys(S.logs).sort().filter(d => +S.logs[d].bw > 0).map(d => ({ x: d, y: +S.logs[d].bw }));
  h += `<h2>Peso corporal</h2><div class="card">${lineChart(bw, 'kg')}</div>`;
  return h;
}

/* ---------- tela: Ajustes ---------- */
function viewSet() {
  let h = `<h1>Ajustes</h1><h2>Período do plano</h2><div class="card"><div class="row"><label>Início<input type="date" data-chg="cfgstart" value="${S.cfg.start}"></label><label>Fim<input type="date" data-chg="cfgend" value="${S.cfg.end}"></label></div></div><h2>Treinos por dia da semana</h2>`;
  for (const k of ORDER) {
    const p = S.plan[k];
    h += `<details data-k="${k}" ${openK === k ? 'open' : ''}><summary>${DOW[k]}: ${esc(p.name)}</summary><div class="row" style="margin-top:8px"><label>Nome<input data-chg="planname" data-k="${k}" value="${esc(p.name)}"></label><label style="max-width:110px">Cardio (min)<input type="number" inputmode="numeric" data-chg="plancardio" data-k="${k}" value="${p.cardio}"></label></div>`;
    h += p.ex.map((ex, i) => `<div class="exrow" data-k="${k}" data-i="${i}"><input data-chg="exname" value="${esc(ex.name)}"><select data-chg="extype"><option value="kg" ${ex.type === 'kg' ? 'selected' : ''}>kg × reps</option><option value="reps" ${ex.type === 'reps' ? 'selected' : ''}>reps</option><option value="time" ${ex.type === 'time' ? 'selected' : ''}>tempo (s)</option></select><button class="x" data-act="delex" aria-label="Remover exercício">×</button></div>`).join('');
    h += `<button class="add" data-act="addex" data-k="${k}">+ Exercício</button></details>`;
  }
  h += `<h2>Dados</h2><p class="muted">Os dados ficam só neste aparelho. Faça backup de vez em quando.</p><button class="add" data-act="export">Exportar backup (JSON)</button><button class="add" data-act="import">Importar backup</button><button class="danger" data-act="reset">Apagar todos os dados</button>`;
  return h;
}

/* ---------- render ---------- */
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const scroll = window.scrollY;
  $('#view').innerHTML = { hoje: viewHoje, calendario: viewCal, evolucao: viewEvo, ajustes: viewSet }[tab]();
  window.scrollTo(0, scroll);
}

/* ---------- ações ---------- */
function setRow(t) { const r = t.closest('.set'); return { ex: r.dataset.ex, i: +r.dataset.i }; }
const ACT = {
  prev: () => { cur = addDays(cur, -1); render(); },
  next: () => { cur = addDays(cur, 1); render(); },
  hoje: () => { cur = todayStr(); render(); },
  goto: t => { cur = t.dataset.d; tab = 'hoje'; render(); window.scrollTo(0, 0); },
  done: () => { const l = L(cur); l.done = !l.done; save(); render(); },
  addset: t => {
    const id = t.dataset.ex, l = L(cur), arr = (l.sets[id] = l.sets[id] || []);
    const prev = arr.length ? arr[arr.length - 1] : (lastSets(id, cur) || { sets: [{}] }).sets[0];
    arr.push({ ...prev });
    save(); render();
  },
  delset: t => { const { ex, i } = setRow(t); L(cur).sets[ex].splice(i, 1); save(); render(); },
  addex: t => {
    const k = +t.dataset.k;
    S.plan[k].ex.push(E('x' + Date.now().toString(36), 'Novo exercício', 'kg'));
    openK = k; save(); render();
  },
  delex: t => {
    const r = t.closest('.exrow'), k = +r.dataset.k;
    if (!confirm('Remover este exercício do plano? O histórico dele é mantido.')) return;
    S.plan[k].ex.splice(+r.dataset.i, 1);
    openK = k; save(); render();
  },
  export: () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `treino-backup-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: () => $('#importFile').click(),
  reset: () => {
    if (!confirm('Apagar TODOS os treinos e ajustes deste aparelho? Isso não pode ser desfeito.')) return;
    localStorage.removeItem(KEY); S = load(); render();
  },
};
const CHG = {
  setval: t => { const { ex, i } = setRow(t); const v = t.value === '' ? undefined : +t.value; L(cur).sets[ex][i][t.dataset.f] = v; save(); },
  cardio: t => { L(cur).cardio = t.value === '' ? undefined : +t.value; save(); },
  bw: t => { L(cur).bw = t.value === '' ? undefined : +t.value; save(); },
  note: t => { L(cur).note = t.value; save(); },
  planday: t => { L(cur).planDay = +t.value; save(); render(); },
  evoex: t => { evoEx = t.value; render(); },
  evometric: t => { evoMetric = t.value; render(); },
  cfgstart: t => { if (t.value) { S.cfg.start = t.value; save(); } },
  cfgend: t => { if (t.value) { S.cfg.end = t.value; save(); } },
  planname: t => { S.plan[+t.dataset.k].name = t.value; openK = +t.dataset.k; save(); },
  plancardio: t => { S.plan[+t.dataset.k].cardio = +t.value || 0; save(); },
  exname: t => { const r = t.closest('.exrow'); S.plan[+r.dataset.k].ex[+r.dataset.i].name = t.value; save(); },
  extype: t => { const r = t.closest('.exrow'); S.plan[+r.dataset.k].ex[+r.dataset.i].type = t.value; save(); },
};

$('#view').addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t && ACT[t.dataset.act]) ACT[t.dataset.act](t); });
$('#view').addEventListener('change', e => { const t = e.target.closest('[data-chg]'); if (t && CHG[t.dataset.chg]) CHG[t.dataset.chg](t); });
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); window.scrollTo(0, 0); } });
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data.plan || !data.logs || !data.cfg) throw new Error('formato');
    if (!confirm('Substituir os dados atuais pelo backup?')) return;
    S = data; save(); render();
  } catch (err) { alert('Arquivo de backup inválido.'); }
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
render();
