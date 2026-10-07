# ModelMatch

**Compare modelos. Escolha melhor.** MVP de um comparador de modelos de linguagem com Next.js App Router, TypeScript, Tailwind CSS e Recharts.

## Executar

Node.js 22+ (validado com Node 26), npm.

```sh
npm ci
npm run dev
# http://localhost:3000
```

```sh
npm run typecheck
npm test
npm run build
npm start
```

O build usa Webpack para evitar a falha de subprocessos/portas do Turbopack neste ambiente. O servidor de desenvolvimento usa Turbopack.

## O que funciona

- Tema claro/escuro com botão no cabeçalho, preferência persistida no navegador e respeito ao tema do sistema antes de uma escolha manual.
- `/`: catálogo de 12 modelos, busca por modelo/empresa, filtros de empresa/preço/pesos, ordenação e seleção de até seis modelos. Visualizações em tabela e cartões.
- `/compare?models=atlas-pro,prism-flash,nova-max`: comparação restaurada por URL, seleção persistida, adição/remoção, melhores resultados e empates, apenas diferenças, cabeçalho/primeira coluna fixos e rolagem horizontal.
- Calculadora instantânea por provedor: custo mensal, por mil solicitações e diferença contra referência escolhida.
- Recomendação pelo menor custo que atende ao mínimo de um benchmark compatível, com participantes e exclusões explícitos. Preferência humana separada.
- Gráficos de barras e dispersão custo/resultado no mesmo benchmark, com fonte nos tooltips.
- `/scenarios`: salvar, abrir/editar e excluir cenários no localStorage. Todos os campos do cenário e a data original são preservados nas edições.
- `/pro`: proposta de US$ 9/mês, recursos planejados e formulário de interesse pré-preenchido pelo CTA de alerta. Sem cobrança.
- `/methodology`: regras, limitações, proveniência e independência de rankings.
- Interfaces para snapshots, detecção de alterações e avaliação de alternativas. Nenhum job ou notificação é executado.

## Dados

Os dados são reais, públicos e gratuitos:

- **[models.dev](https://models.dev)** (MIT): preços oficiais de API, contexto, capacidades, datas e logos. Só entram preços da própria empresa que faz o modelo.
- **[Epoch AI](https://epoch.ai/benchmarks)** (CC BY 4.0, exige atribuição): Epoch Capabilities Index (ECI), usado como "inteligência", e os benchmarks por tarefa.

O servidor busca as fontes e guarda o catálogo por um dia (`lib/catalog/server.ts`). Se alguma fonte falhar, usa a cópia em `data/catalog.json`; atualize-a com `npm run sync`, que também baixa os logos para `public/logos/`. Dados ausentes aparecem como —, nunca como zero.

## Lista de interesse

`InterestAdapter` e `demoInterestAdapter` estão em `lib/storage.ts`. Atualmente o formulário valida e guarda até 20 registros **somente neste navegador**, em `modelmatch:interest`, com consentimento. A confirmação informa que nada foi enviado ou ativado. Não existe backend, envio de e-mails, sincronização, assinatura ou pagamento.

Para conectar uma lista real, implemente um adaptador que chame um endpoint próprio via HTTPS. Valide e normalize e-mail/tipo de uso/cenário e consentimento no servidor, limite tamanho e frequência por IP, inclua proteção contra abuso e persistência durável. Não exponha credenciais no cliente. Atualize a mensagem para “enviado” somente após confirmação do servidor. Defina retenção, acesso e política de privacidade antes de captar dados reais. A submissão não deve ativar e-mails automáticos nesta versão.

## Organização e tradução

`lib/engine.ts` concentra a lógica independente da UI. `lib/storage.ts` concentra persistência e o adaptador de interesse. `components/` contém os fluxos interativos e `app/` as rotas. A interface usa `lang="pt-BR"`; números, moeda e datas usam Intl. O catálogo e a metodologia explicam escalas e unidades sem índices inventados. `lib/i18n.ts` oferece locale, formatação Intl e um dicionário inicial para navegação e mensagens comuns. Para introduzir outro idioma, complete a extração dos textos editoriais para esse dicionário e preserve IDs dos dados, cenários e URLs. USD continua sendo a moeda dos preços de API.

## Validação

Testes unitários exercitam fórmula/volume zero, restauração e limite da seleção, direção dos melhores valores, empates, mínimo inclusivo, resultados ausentes, versões/unidades/configurações incompatíveis, preço ausente, cenários locais, histórico e confirmação de cadastro em demo. Validação de navegador inclui fluxos reais no desktop (1440 px) e celular (390 px), incluindo salvar/editar/excluir e o formulário pré-preenchido. O roteiro reproduzível está em `scripts/browser-qa.js`; com a skill Playwright instalada, inicie o servidor e rode `python3 scripts/run-browser-qa.py` (usa dados de QA no navegador isolado da CLI). Capturas ficam em `output/playwright/`, ignorado pelo Git. Sem deploy ou integração externa nesta entrega.
