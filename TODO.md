# TODO — Indica Aí

## A debater (decisões em aberto, sem implementação ainda)

### 1. Quem pode dar nota/reação numa indicação já existente?

Hoje o único jeito de "reagir" a uma indicação de outra pessoa é criar uma indicação nova pro mesmo `categoria::nome` — ela entra no grupo e a nota média é recalculada (`groupEntries` em `script.js`), mas isso sempre exige preencher nome/categoria/nota/comentário/autor de novo, como se fosse uma indicação do zero.

Pergunta em aberto: alguém que só quer concordar com a indicação de outra pessoa (sem escrever uma resenha completa) deveria conseguir:
- (a) Deixar como está — toda reação é uma indicação completa nova.
- (b) Adicionar uma nota própria a uma indicação existente sem reescrever tudo (formulário reduzido, já pré-preenchido com categoria/nome).
- (c) Um "like"/concordo simples (sem nota), tipo um contador por indicação — mais leve, mas perde a nota.
- (d) Os dois: nota completa OU like rápido.

Cada opção (b)/(c)/(d) exige um novo caminho de escrita (hoje só existe "criar indicação nova" via Form). Se for like/contador, provavelmente precisa de uma pergunta nova no Form (ex: "ID da indicação" + Form separado, ou repensar a escrita via Apps Script Web App em vez de Form, que já foi cogitado antes pra resolver delete também).

### 2. Duplicidade de nomes (mesma pessoa/serviço, grafias diferentes)

O agrupamento em `groupEntries` funciona por `(categoria + '::' + nome).toLowerCase().trim()` — match exato de string. Na prática o mesmo profissional pode entrar como:

```
Karla Vet
Karla Veterinária
karla veterinaria
Dra. Karla (vet)
```

Cada grafia diferente vira um card separado, fragmentando a nota e o histórico de quem é, de fato, a mesma pessoa/serviço. Não tem nenhuma solução implementada ainda. Opções pra debater:
- Autocomplete/dropdown ao criar uma indicação, sugerindo nomes já existentes na mesma categoria (reduz duplicata na entrada, não corrige o que já existe).
- Normalização automática de string (remover acentos, títulos tipo "Dr./Dra.", etc.) — reduz alguns casos, mas não todos, e corre risco de unificar coisas que não deveriam (dois profissionais diferentes com nome parecido).
- Ação manual de "mesclar" duas entradas — exigiria uma superfície de edição que hoje não existe (app é só leitura agregada + criação, sem admin/edição).
- Aceitar o problema por enquanto e resolver socialmente (grupo pequeno, dá pra combinar um nome padrão ao indicar).

### 3. Categoria única é grossa demais — categorias custom ou tags?

Hoje já dá pra criar categoria customizada (`+ Outra categoria...` no `catSelect`, ver `indica-ai.html`), mas o problema é outro: uma única categoria por indicação é pouco granular. Ex: categoria "Reparos residenciais" cobre eletricista, encanador, pintor etc. — quem tá procurando eletricista especificamente não consegue filtrar por isso, só por "reparos residenciais" inteiro (ou pela busca texto, que já olha nome/categoria/comentário/localização).

Opções pra debater:
- (a) Deixar como está — resolve via busca por texto livre (já funciona, mas depende de quem indicou ter escrito "eletricista" em algum lugar do comentário/nome).
- (b) Categoria em duas camadas: categoria ampla (já existe) + subcategoria (ex: "Reparos residenciais" → "Elétrica"/"Encanamento"/"Pintura") — mais estruturado, mas exige manter uma taxonomia fixa de subcategorias (ou permitir subcategoria livre também, reabrindo o problema de duplicidade de grafia do item 2 acima).
- (c) Tags livres (múltiplas por indicação, tipo `elétrica, residencial, emergência`) — mais flexível que subcategoria fixa, mas sofre do mesmo problema de duplicidade/grafia que nomes (item 2) e exige decidir como armazenar múltiplos valores numa única coluna de planilha (string separada por vírgula? campo novo por tag, o que não escala?).

Provavelmente vale resolver junto com o item 2 (duplicidade), já que tags sofrem do mesmo problema de normalização que nomes.

## Combinado, ação pendente do usuário

- [ ] **Espelho/backup**: duplicar o Google Form atual (menu ⋮ → "Fazer uma cópia"), vincular as respostas a uma planilha **nova e separada** (não outra aba da mesma planilha), e passar o link público `/viewform` do formulário duplicado. Depois disso, ajustar `submitEntryToSheet` pra mandar cada indicação nova pros dois formulários (principal + espelho).
- [ ] **Novo campo Estabelecimento**: adicionar pergunta no Google Form (mesmo fluxo da Localização: adicionar no fim do Form, avisar, extrair `entry.NNNNNN` via `curl` + grep no `FB_PUBLIC_LOAD_DATA_`). Representa onde o profissional atende (clínica, loja, hospital etc.), separado do campo Nome. Default `'Profissional liberal'` quando o campo vier vazio — mesmo padrão já usado pra categoria (`category || 'Outros'` no submit handler), aplicado client-side antes de enviar, já que Google Forms não tem valor-padrão nativo pra pergunta de resposta curta. Decidir se essa pergunta é obrigatória ou não no Form (lembrar do gotcha: se marcar obrigatória lá, tem que marcar obrigatória aqui também, ver `CLAUDE.md`).
- [ ] **Novo campo Contato do profissional** (telefone ou Instagram): mesmo fluxo dos campos anteriores (pergunta nova no fim do Form, extrair `entry.NNNNNN`, estender range/índice, campo novo no modal). Texto livre com placeholder tipo "Ex: (81) 99999-9999 ou @perfil" — cobre os dois formatos sem precisar de dois campos separados. Sugestão: opcional (nem sempre quem indica tem o contato à mão), mas confirmar com o usuário antes de implementar, por causa do gotcha de campo obrigatório no Form (ver `CLAUDE.md`).
- [ ] Apagar linhas de teste na aba "Respostas ao formulário 1" (variações de "Teste Validacao").

## Deferred (decidido, mas não prioritário agora)

- **Função de deletar indicação**: nem Form (só aceita novo envio) nem leitura via `gviz` (só leitura) suportam apagar linha. Caminho real precisaria de um Google Apps Script publicado como Web App. Adiado a pedido do usuário.
- **Migração pra Firebase**: resolveria delete, controle de acesso de verdade e uma API estruturada — mas é uma migração grande (novo projeto, Cloud Functions/Firestore rules, hosting). Considerado e adiado em favor do espelho (menor esforço).

## Visão de longo prazo (especulativo)

O valor do app é indicação de gente que você conhece (não descoberta genérica de cidade — isso o Google/Maps já resolve). Se crescer, considerar um dashboard externo pra escolher o "hub"/grupo:

```
indica-ai-familia
indica-ai-trabalho
indica-ai-all   (agrega todos os grupos que você participa)
```

Não vale desenhar essa arquitetura agora — só faz sentido depois de existir um segundo grupo real pedindo isso.
