'use strict';
// Teste de fumaça: carrega o app no jsdom e exercita as telas e ações principais.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, doc = w.document;
w.scrollTo = () => {};
w.confirm = () => true;
w.alert = m => { throw new Error('alert inesperado: ' + m); };

const run = code => { const sc = doc.createElement('script'); sc.textContent = code; doc.body.appendChild(sc); };
const q = s => doc.querySelector(s);
const qa = s => [...doc.querySelectorAll(s)];
const view = () => q('#view').innerHTML;
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const stored = () => JSON.parse(w.localStorage.getItem('treino-app-v1'));

let falhas = 0;
const ok = (cond, msg) => { if (!cond) falhas++; console.log((cond ? 'OK     ' : 'FALHOU ') + msg); };

run(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));

// Hoje
run("cur = '2026-10-05'; render();");
ok(view().includes('Semana 1') && view().includes('Forte'), 'Hoje: semana 1 é forte');
ok(qa('.card h3').length >= 6, 'Hoje: lista os exercícios de peito e tríceps');
click(q('[data-act=addset]'));
change(q('.set input[data-f=kg]'), '60');
change(q('.set input[data-f=reps]'), '10');
click(q('[data-act=addset]'));
ok(qa('.set').length === 2 && qa('.set input[data-f=kg]')[1].value === '60', 'Hoje: nova série copia a anterior');
click(q('[data-act=done]'));
ok(stored().logs['2026-10-05'].done === true, 'Hoje: concluir treino persiste');
ok(stored().logs['2026-10-05'].sets['supino-reto'][0].kg === 60, 'Hoje: carga persiste');

// Histórico, deload, descanso, semana final
run("cur = '2026-10-12'; render();");
ok(view().includes('Última (05/10): 60×10 · 60×10'), 'Histórico: mostra a última marca');
run("cur = '2026-10-28'; render();");
ok(view().includes('deload'), 'Semana 4 é deload');
run("cur = '2026-10-09'; render();");
ok(view().includes('Dia de descanso'), 'Sexta é descanso');
change(q('select[data-chg=planday]'), '1');
ok(qa('.card h3').length >= 6, 'Trocar o treino do dia funciona');
run("cur = '2026-12-31'; render();");
ok(view().includes('Semana 13') && view().includes('Final'), 'Semana 13 é a final');

// Abas
for (const t of ['calendario', 'evolucao', 'ajustes', 'hoje']) {
  click(q(`[data-tab=${t}]`));
  ok(view().length > 200, `Aba ${t} renderiza`);
}
click(q('[data-tab=calendario]'));
ok(qa('.cal').length === 3 && qa('.d.done').length === 1, 'Calendário: 3 meses e 1 dia concluído');
click(qa('.d.done')[0]);
ok(view().includes('Segunda, 05/10'), 'Calendário: tocar no dia abre o registro');

// Evolução
click(q('[data-tab=evolucao]'));
ok(qa('.kpi').length === 4 && view().includes('<polyline'), 'Evolução: KPIs e gráfico do exercício');
change(q('select[data-chg=evometric]'), '1rm');
ok(view().includes('1RM estimado (kg)'), 'Evolução: troca de métrica');

// Ajustes
click(q('[data-tab=ajustes]'));
const antes = qa('.exrow').length;
click(q('[data-act=addex][data-k="1"]'));
ok(qa('.exrow').length === antes + 1 && !!q('details[open]'), 'Ajustes: adiciona exercício');
change(qa('.exrow input')[0], 'Supino reto barra');
ok(stored().plan[1].ex[0].name === 'Supino reto barra', 'Ajustes: renomear persiste');
click(q('.exrow [data-act=delex]'));
ok(qa('.exrow').length === antes, 'Ajustes: remove exercício');

// Reset
click(q('[data-act=reset]'));
ok(w.localStorage.getItem('treino-app-v1') === null, 'Ajustes: apagar dados limpa o armazenamento');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
