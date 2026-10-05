# Treino

App pessoal (PWA) para registrar treinos e acompanhar a evolução. Sem backend: os dados ficam no `localStorage` do aparelho. Publicado no GitHub Pages por um workflow que testa antes de publicar.

## Estrutura

    index.html, style.css, app.js     o app
    sw.js, manifest.webmanifest       service worker (offline) e metadados de instalação
    icon-192.png, icon-512.png        ícones
    tests/smoke.test.js               teste de fumaça (jsdom)
    .github/workflows/deploy.yml      CI: testa e publica no GitHub Pages a cada push na main

## Desenvolvimento

    npm install        # instala o jsdom (só para os testes)
    npm test           # roda o teste de fumaça
    npm start          # servidor local em http://localhost:8000

O service worker só funciona em `localhost` ou HTTPS.
## Publicar
1. Crie um repositório público no GitHub e envie o código para a branch `main`.
2. Em Settings > Pages, em Source, escolha **GitHub Actions**.
3. O workflow roda a cada push na `main`: `npm ci`, `npm test` e deploy. A URL final aparece no job `deploy` e em Settings > Pages.
4. O workflow troca `treino-v1` em `sw.js` pelo hash do commit, então o celular sempre baixa a versão nova. Não precisa mexer na versão do cache à mão.
## Instalar no celular
- **Android (Chrome):** abra a URL, menu ⋮, "Instalar app".
- **iPhone (Safari):** abra a URL, botão Compartilhar, "Adicionar à Tela de Início". Tem que ser no Safari.
Abra uma vez com internet; depois funciona offline.
## Telas
- **Hoje:** treino do dia (pelo dia da semana, trocável), séries com carga e repetições, última marca de cada exercício, cardio, peso corporal, observações e botão de concluir.
- **Calendário:** dias concluídos (verde) e parciais (laranja). Toque num dia para ver ou editar.
- **Evolução:** treinos feitos, % do plano, frequência por semana, gráfico por exercício (carga máxima, 1RM estimado ou volume) e peso corporal.
- **Ajustes:** período do plano, nome, cardio e exercícios de cada dia, exportar e importar backup (JSON).

## Dados

Chave `treino-app-v1`:

    { cfg: {start, end},
      plan: { 0..6: {name, cardio, ex: [{id, name, type}]} },
      logs: { "YYYY-MM-DD": {sets: {exId: [{kg, reps, sec}]}, done, cardio, bw, note, planDay} } }

`type`: `kg` (carga × reps), `reps` ou `time` (segundos).
Semanas: a cada 4ª semana é deload (4 treinos); a semana parcial final tem 3; as demais têm 5.

Os dados existem só no aparelho. Trocar de celular ou limpar os dados do navegador apaga tudo, então use **Ajustes > Exportar backup** com frequência.

## Próximos passos

Sincronizar com Supabase ou SQLite, exportar os logs para DuckDB e montar um dashboard em Streamlit, timer de descanso.
