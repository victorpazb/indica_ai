# Indica Aí

Mural de indicações (médicos, prestadores de serviço, restaurantes etc.) compartilhado entre um grupo fechado (família/amigos). Site estático — sem build step, sem backend próprio.

## Arquivos

- `indica-ai.html` — só marcação. Linka `style.css` e `script.js`.
- `style.css` — todo o CSS.
- `script.js` — toda a lógica (estado, leitura/escrita, render).
- `assets/favicon.svg`, `assets/linkedin-logo.svg` — ícones inline, sem dependência externa.

## Arquitetura de dados (importante)

Não existe backend. O "banco de dados" é um Google Sheets alimentado por um Google Form — o front-end nunca fala com uma API própria.

- **Leitura** (`loadEntries` em `script.js`): via JSONP — injeta uma `<script src>` apontando pro endpoint `gviz/tq` da planilha, com `range=A2:G` e `tqx=responseHandler:<callback>`. **Não usa `fetch()`** porque esse endpoint do Google não manda header `Access-Control-Allow-Origin`, então um fetch normal seria bloqueado por CORS.
  - O parâmetro `range=A2:G` é necessário mesmo que pareça redundante: sem ele, a auto-detecção de cabeçalho do Google é inconsistente — quando a planilha tem poucos dados pra inferir tipo de coluna, ela inclui a linha de cabeçalho como se fosse uma linha de dado real (bug já visto em produção, corrigido restringindo o range).
- **Escrita** (`submitEntryToSheet`): `POST` pro endpoint `/formResponse` do Google Form vinculado, com `mode:'no-cors'`. A resposta vem opaca — não dá pra checar `response.ok`/status. Por isso o app é otimista: mostra a indicação na tela e o toast de sucesso assim que o `fetch` resolve (não espera confirmação real).
- IDs/URLs vivem no topo do `script.js`: `SHEET_ID`, `SHEET_TAB_NAME`, `FORM_ACTION_URL`, `FORM_ENTRY_IDS`. Se o Form ou a planilha mudarem, esses valores têm que ser re-extraídos.

### Colunas atuais da planilha (aba "Respostas ao formulário 1")

Ordem = ordem das perguntas no Form no momento em que foram criadas. `loadEntries` lê por índice posicional (`row.c[N]`), não por nome — adicionar uma pergunta no meio do Form (em vez de no fim) desalinha esses índices.

| Col | Campo         | Índice (`val(N)`) |
|-----|---------------|--------------------|
| A   | Timestamp     | `row.c[0]` (parseado à parte, formato `Date(y,m,d,h,mi,s)`) |
| B   | Categoria     | `val(1)` |
| C   | Nome          | `val(2)` |
| D   | Nota          | `val(3)` |
| E   | Comentário    | `val(4)` |
| F   | Autor         | `val(5)` |
| G   | Localização   | `val(6)` |

Ao adicionar um campo novo (ex: Estabelecimento, ver `TODO.md`), adicionar a pergunta **no fim** do Form garante que a coluna nova cai em H (`val(7)`) — daí é só estender `range=A2:G` pra `A2:H` no `fetchSheetRows` e mapear o índice novo.

### Como extrair `entry.NNNNNN` de um Google Form

Não existe API pública pra isso. Técnica usada (funciona porque o Form é público):

```bash
curl -s -A "Mozilla/5.0" "<url_do_form>/viewform" | grep -o "FB_PUBLIC_LOAD_DATA_ = .*"
```

O JS embutido `FB_PUBLIC_LOAD_DATA_` lista cada pergunta com seu `entry.ID` correspondente — dá pra parsear na mão pelo texto.

### Gotcha crítico: campo obrigatório no Form

Se uma pergunta do Form estiver marcada como **obrigatória** e o POST não mandar valor pra ela (ou mandar vazio), o Google responde **HTTP 400 e descarta a submissão inteira** (não só aquele campo — nenhuma linha é criada). Como o POST usa `mode:'no-cors'`, esse erro é **invisível no client** — o `fetch` resolve normalmente, o app mostra toast de sucesso, e a indicação nunca é salva.

Consequência prática: a validação do front-end (`entryForm` submit handler) precisa espelhar exatamente quais perguntas estão obrigatórias no Form real. Se alguém adicionar uma pergunta obrigatória nova no Form sem replicar a validação aqui, indicações vão sumir silenciosamente.

## Testando mudanças

Não tem test suite. Fluxo usado até agora:

```bash
python3 -m http.server 8934 --directory /Users/victorbraga/Desktop/indica_ai --bind 127.0.0.1
```

+ Playwright headless (via `npx playwright`, instalado sob demanda) pra dirigir o browser, checar console de erros e confirmar que o POST real chega no Google Form.

⚠️ Esse tipo de teste E2E escreve de verdade na planilha de produção (não tem ambiente de staging). Sempre limpar as linhas de teste depois (procurar por nomes tipo "Teste ..." na aba "Respostas ao formulário 1").

## Estado atual

Sem função de deletar indicação e sem backup/espelho ainda (planejado, não implementado — ver `TODO.md`). Se alguém apagar uma linha na planilha por engano, não tem como recuperar hoje.

## Limitações conhecidas / decisões em aberto

Ver `TODO.md`.
