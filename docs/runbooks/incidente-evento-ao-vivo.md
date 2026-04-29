# Runbook — Incidente durante evento ao vivo

## Sintoma 1: Painel mostra "Bridge offline"

**Causa provável:** terminal CLI fechado ou rede caiu na máquina H2R.

**Mitigação:**
1. Volte na máquina H2R
2. Verifique terminal — se fechado: `npx @ucob/h2r-bridge resume`
3. Se rede caiu: aguarde reconexão e o heartbeat retoma sozinho

## Sintoma 2: Comentário aprovado fica "failed"

**Causa provável:** H2R fechou ou source-id mudou.

**Mitigação:**
1. Verifique se H2R Graphics está aberto
2. Em Data Sources, confirme que o HTTP Listener ainda existe e source-id é o mesmo
3. Se mudou: encerre bridge (Ctrl+C) e re-pareie com `npx @ucob/h2r-bridge pair <novo-code>`
4. Use botão "Tentar novamente" no card

## Sintoma 3: Vercel offline

**Causa:** Vercel SLA caiu (raro).

**Mitigação:**
1. Verifique <https://www.vercel-status.com/>
2. Submissões públicas falham até voltar
3. Se persistir > 30 min e o evento está no ar: comunique via meios alternativos

## Sintoma 4: Flood de spam

**Sinal:** painel recebe > 100 submissões/min.

**Mitigação:**
1. No painel, vá em Configurações do evento
2. Atualize `submissions_open = false` no DB (futuro: botão na UI)
3. URL pública passa a mostrar "Submissões encerradas"

## Sintoma 5: Pairing code expirou antes de usar

**Mitigação:** organizador clica "Re-parear" no painel — gera novo código.
