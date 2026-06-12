# Implementation Plan: Finalização da Barbearia Status

## Overview

O plano abaixo converte o design em passos incrementais de código, ordenados para que o
projeto fique **executável o quanto antes** (de-Lovable do build + `npm install` + servidor
de desenvolvimento no ar) antes da verificação aprofundada dos módulos. Cada tarefa
referencia critérios de aceitação específicos (Requisitos 1–16) e seções do design.

A linguagem de implementação é **TypeScript** (o projeto já é TanStack Start + React +
TypeScript). Não há infraestrutura de testes hoje, portanto a adição de `vitest` +
`fast-check` é uma tarefa explícita antes dos testes de propriedade.

> Importante: o servidor de desenvolvimento (`npm run dev`) e o build watcher NÃO devem ser
> iniciados pelo agente. Quando uma tarefa pedir validação manual de execução, o usuário deve
> rodar o comando no próprio terminal.

## Tasks

- [x] 1. De-Lovable do build (vite.config.ts + package.json)
  - [x] 1.1 Substituir `vite.config.ts` pela composição padrão do TanStack Start
    - Reescrever `vite.config.ts` removendo o import de `@lovable.dev/vite-tanstack-config`
    - Compor explicitamente os plugins: `tsConfigPaths({ projects: ["./tsconfig.json"] })`,
      `tanstackStart({ server: { entry: "./src/server.ts" }, target: "node-server" })`,
      `viteReact()`, `tailwindcss()`
    - Garantir ordem `tanstackStart()` ANTES de `viteReact()` e cada plugin declarado uma
      única vez
    - Preservar redirecionamento da entrada SSR para `src/server.ts` e o alias `@` via
      tsconfig paths (sem `resolve.alias` manual)
    - Remover qualquer uso do `componentTagger` da Lovable
    - _Requisitos: 1.1, 1.3, 1.4, 1.7, 2.5_
    - _Design: Components and Interfaces §1_

  - [x] 1.2 Limpar dependências da Lovable no `package.json`
    - Remover `@lovable.dev/vite-tanstack-config` de `devDependencies`
    - Remover `lovable-tagger` caso presente
    - Confirmar que os plugins agora importados explicitamente já constam como dependências
      (`@tanstack/react-start`, `@vitejs/plugin-react`, `@tailwindcss/vite`,
      `vite-tsconfig-paths`); adicionar como `devDependencies` diretas se ausentes
    - Reavaliar `nitro` como dependência direta e manter apenas se exigido pela resolução do
      `tanstackStart`
    - _Requisitos: 1.2, 16.3_
    - _Design: Components and Interfaces §2_

- [x] 2. Migrar gerenciador de pacotes para npm e subir o servidor de desenvolvimento
  - [x] 2.1 Remover artefatos do bun
    - Excluir `bun.lock` e `bunfig.toml` (elimina referência ao registro
      `europe-west4-npm.pkg.dev/lovable-core-prod`)
    - _Requisitos: 3.3_
    - _Design: Components and Interfaces §2_

  - [x] 2.2 Gerar lockfile do npm e validar instalação limpa
    - Executar `npm install` para gerar `package-lock.json` apontando para
      `registry.npmjs.org`
    - Ajustar versões de dependências que só existam no registro privado da Lovable, se
      houver, para equivalentes públicas
    - Confirmar que a instalação ocorre sem autenticação em registro privado
    - _Requisitos: 3.1, 3.2, 3.4, 3.5_
    - _Design: Pesquisa relevante (npm vs bun)_

  - [x] 2.3 Validar build e servidor de desenvolvimento após o de-Lovable
    - Garantir que `npm run build` (`vite build`) conclui gerando artefatos sem erros
    - Documentar/confirmar que `npm run dev` inicia o servidor (o usuário executa o comando
      manualmente no terminal)
    - _Requisitos: 1.5, 1.6_
    - _Design: Components and Interfaces §1_

- [x] 3. Remover marcas, URLs e mensagens da Lovable
  - [x] 3.1 Remover imagens de marca em `src/routes/__root.tsx`
    - Remover as meta tags `og:image`/`twitter:image` que apontam para `r2.dev`/`lovable.app`
      (ou apontá-las para uma imagem hospedada em `public/`)
    - _Requisitos: 2.1_
    - _Design: Components and Interfaces §3_

  - [x] 3.2 Padronizar mensagens de erro de ambiente sem marca Lovable
    - Em `src/integrations/supabase/client.ts`, `client.server.ts` e `auth-middleware.ts`,
      substituir a frase "Connect Supabase in Lovable Cloud" pela mensagem neutra padronizada
      que nomeia a(s) variável(is) ausente(s)
    - _Requisitos: 2.2, 2.3, 2.4_
    - _Design: Components and Interfaces §3; Error Handling_

  - [x] 3.3 Remover URL de agendamento da Lovable na Edge Function e no HTML
    - Em `supabase/functions/whatsapp-ai-agent/index.ts`, ler o link de agendamento de
      `PUBLIC_BOOKING_URL` (fallback domínio próprio) em vez de
      `barbearia-status.lovable.app/agendar`
    - Em `public/funcoes_ia.html`, substituir o link `barbearia-status.lovable.app/agendar`
      pela URL própria do usuário
    - _Requisitos: 2.6, 2.7_
    - _Design: Components and Interfaces §3_

  - [x] 3.4 Eliminar resíduos versionados da Lovable e verificar grep
    - Remover o diretório `.lovable/` do versionamento
    - Executar busca textual por "lovable" no código versionado (excluindo `node_modules` e
      `package-lock.json`) e garantir zero ocorrências em arquivos de código/configuração
    - _Requisitos: 2.8, 16.3_
    - _Design: Components and Interfaces §3_

- [ ] 4. Independência de configuração do Supabase e ambiente
  - [x] 4.1 Ajustar leitura de variáveis nos clientes Supabase
    - Em `client.ts`, ler `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` com fallback
      para `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` no SSR
    - Em `client.server.ts`, ler `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apenas do
      servidor; garantir que a Chave_Servico nunca usa prefixo `VITE_` nem `import.meta.env`
    - Garantir que a ausência de `SUPABASE_SERVICE_ROLE_KEY` em operação admin produz erro
      que nomeia exatamente essa variável
    - _Requisitos: 5.1, 5.2, 5.3, 5.6_
    - _Design: Components and Interfaces §4; Error Handling_

  - [x] 4.2 Criar `.env.example` e proteger segredos no `.gitignore`
    - Criar `.env.example` listando todas as variáveis obrigatórias com placeholders
      (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`,
      `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, opcionais
      `VITE_SUPABASE_PROJECT_ID`, `PUBLIC_BOOKING_URL`), sem valores reais
    - Garantir que `.env` (com a Chave_Servico) e `.lovable/` estejam no `.gitignore`
    - _Requisitos: 4.3, 5.7_
    - _Design: Components and Interfaces §4_

  - [x] 4.3 Escrever o Doc_Setup (README) de instalação e execução
    - Documentar pré-requisitos (Node.js v24, npm), comandos de instalação, execução em dev e
      produção, e todas as variáveis obrigatórias
    - Documentar como obter a Chave_Servico no painel do Supabase_Cloud e configurá-la em
      `SUPABASE_SERVICE_ROLE_KEY`
    - Documentar o procedimento de criação/autenticação do Admin inicial (usuário em
      Authentication, trigger `handle_new_user`, atualização de `profiles.tipo = 'admin'` via
      SQL editor) e o procedimento de credenciais de teste sem armazenar senhas reais
    - _Requisitos: 4.1, 4.2, 4.4, 4.6, 5.4_
    - _Design: Components and Interfaces §4, §5_

- [ ] 5. Extrair funções puras de cálculo e configurar o test runner
  - [ ] 5.1 Criar `src/lib/calculos.ts` com as funções puras de negócio
    - Implementar `recalcularTotalComanda`, `calcularTroco`, `calcularSaldoCaixa`,
      `aplicarMovimentacaoEstoque` e `saidaPermitida` conforme assinaturas do design
    - Implementar a função de decisão de guarda de rota (`decidirRedirecionamento`) e a regra
      de sobreposição de horário (espelho de `slot_disponivel`) como funções puras
    - Implementar a função pura de validação de campo obrigatório (vazio/somente espaços)
    - Implementar a função pura de montagem da mensagem de variáveis de ambiente ausentes
      (nomeia faltantes, omite presentes, sem marca)
    - Reaproveitar essas funções nas rotas existentes sem alterar o comportamento observável
    - _Requisitos: 8.3, 8.5, 10.4, 11.2, 11.3, 11.4, 6.1, 6.4, 6.5, 6.6, 9.5, 7.3, 7.5, 2.2, 4.5, 5.6_
    - _Design: Data Models §Funções puras a extrair para teste_

  - [ ] 5.2 Configurar o runner de testes (vitest + fast-check)
    - Adicionar `vitest` e `fast-check` como `devDependencies` (não existe setup de testes
      hoje)
    - Criar configuração de teste (ex.: `vitest.config.ts` ou seção em `vite.config.ts`) e
      script `test` no `package.json` usando execução única (`vitest --run`)
    - Adicionar um teste de fumaça mínimo para validar que o runner executa
    - _Requisitos: 16.1_
    - _Design: Testing Strategy §Biblioteca e configuração de PBT_

- [ ] 6. Testes de propriedade (8 propriedades do design)
  - [ ]* 6.1 Property test — mensagem de variável de ambiente ausente
    - **Property 1: Mensagem de variável de ambiente ausente nomeia exatamente as faltantes**
    - **Validates: Requisitos 4.5, 5.6, 2.2, 2.3, 2.4**
    - Gerador deve cobrir todos os subconjuntos não vazios das variáveis obrigatórias
    - Tag: `// Feature: barbearia-status-finalizacao, Property 1`; `numRuns: 100`

  - [ ]* 6.2 Property test — decisão de guarda de rota por papel e estado
    - **Property 2: Decisão de guarda de rota por papel e estado**
    - **Validates: Requisitos 6.1, 6.4, 6.5, 6.6**
    - Gerador deve cobrir autenticado/não, admin/barbeiro, caminhos público/admin/comum
    - Tag: `// Feature: barbearia-status-finalizacao, Property 2`; `numRuns: 100`

  - [ ]* 6.3 Property test — disponibilidade de horário por sobreposição
    - **Property 3: Disponibilidade de horário por sobreposição de intervalos**
    - **Validates: Requisitos 7.3, 7.5, 14.2, 14.3**
    - Gerador deve cobrir intervalos adjacentes vs. sobrepostos e agendamentos cancelados
    - Tag: `// Feature: barbearia-status-finalizacao, Property 3`; `numRuns: 100`

  - [ ]* 6.4 Property test — total da comanda é a soma dos itens
    - **Property 4: Total da comanda é a soma dos itens**
    - **Validates: Requisitos 8.3**
    - Inclui lista vazia e o incremento exato ao adicionar item
    - Tag: `// Feature: barbearia-status-finalizacao, Property 4`; `numRuns: 100`

  - [ ]* 6.5 Property test — cálculo do troco
    - **Property 5: Cálculo do troco**
    - **Validates: Requisitos 8.5**
    - Gerador cobre `recebido` menor/igual/maior que `total`
    - Tag: `// Feature: barbearia-status-finalizacao, Property 5`; `numRuns: 100`

  - [ ]* 6.6 Property test — validação de campo obrigatório
    - **Property 6: Validação de campo obrigatório**
    - **Validates: Requisitos 9.5**
    - Gerador cobre strings vazias, somente espaços e valores válidos
    - Tag: `// Feature: barbearia-status-finalizacao, Property 6`; `numRuns: 100`

  - [ ]* 6.7 Property test — saldo do caixa
    - **Property 7: Saldo do caixa**
    - **Validates: Requisitos 10.4**
    - Gerador cobre listas de movimentos vazias e mistas (entradas/saídas)
    - Tag: `// Feature: barbearia-status-finalizacao, Property 7`; `numRuns: 100`

  - [ ]* 6.8 Property test — movimentação de estoque e invariante não-negativo
    - **Property 8: Movimentação de estoque aplica o delta correto e preserva o invariante não-negativo**
    - **Validates: Requisitos 11.2, 11.3, 11.4**
    - Gerador cobre `q = atual`, `q > atual` (saída rejeitada), entrada e ajuste
    - Tag: `// Feature: barbearia-status-finalizacao, Property 8`; `numRuns: 100`

- [ ] 7. Checkpoint — build e testes verdes
  - Garantir que todos os testes passam, perguntar ao usuário em caso de dúvidas.

- [ ] 8. Auditoria e conclusão dos módulos funcionais
  - [ ] 8.1 Auditar módulo Agenda e geração de comanda (`agenda.tsx`)
    - Verificar listagem por período, criação com profissional/serviço/cliente/horário,
      checagem via `slot_disponivel`, e geração/associação de Comanda ao finalizar atendimento
    - Completar lacunas pontuais sem reescrever lógica que já opera
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_
    - _Design: Components and Interfaces §6 (Agenda)_

  - [ ] 8.2 Auditar módulos Comandas e Caixa/Pagamento (`comandas.tsx`, `comandas.$id.tsx`)
    - Verificar listagem, detalhe com itens, recálculo do total (usando
      `recalcularTotalComanda`), persistência de movimento ao pagar, cálculo de troco (usando
      `calcularTroco`) e bloqueio de pagamento sem caixa aberto
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
    - _Design: Components and Interfaces §6 (Comandas, Caixa/Pagamento); Error Handling_

  - [ ] 8.3 Auditar módulo Clientes e Dependentes (`clientes.tsx`)
    - Verificar listagem, criação/edição, validação de campos obrigatórios (usando a função
      de validação pura) e cadastro de dependentes vinculados ao cliente
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5_
    - _Design: Components and Interfaces §6 (Clientes)_

  - [ ] 8.4 Auditar módulo Financeiro (`financeiro.tsx`)
    - Verificar estado do caixa e transações do período, abertura com valor inicial,
      movimentações, cálculo de saldo final (usando `calcularSaldoCaixa`) e bloqueio de 2ª
      abertura de caixa
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5_
    - _Design: Components and Interfaces §6 (Financeiro); Error Handling_

  - [ ] 8.5 Auditar módulo Estoque e adicionar validação de saída (`estoque.tsx`)
    - Verificar listagem, entrada e saída de estoque com registro em `stock_movements`
    - Adicionar a validação ausente (sinalizada no design): impedir saída maior que a
      quantidade disponível usando `saidaPermitida`, informando insuficiência antes de inserir
      a movimentação no `MovDialog`
    - _Requisitos: 11.1, 11.2, 11.3, 11.4_
    - _Design: Components and Interfaces §6 (Estoque, observação de auditoria); Error Handling_

  - [ ] 8.6 Auditar módulo Relatórios (`relatorios.tsx`)
    - Verificar faturamento por período via `faturamento_periodo`, registro de acertos
      diários (`daily_settlements`), vales (`advances`) e atualização ao mudar o período
    - _Requisitos: 12.1, 12.2, 12.3, 12.4_
    - _Design: Components and Interfaces §6 (Relatórios)_

  - [ ] 8.7 Auditar módulo Configurações (`configuracoes.tsx`)
    - Verificar seções de profissionais, serviços, usuários e parâmetros; CRUD em
      `professionals`, `services`, `settings`; criação de usuário com `profiles.tipo`
    - _Requisitos: 13.1, 13.2, 13.3, 13.4, 13.5_
    - _Design: Components and Interfaces §6 (Configurações)_

  - [ ] 8.8 Auditar página pública de agendamento (`agendar.tsx`)
    - Verificar formulário público sem login, registro do agendamento, tratamento de horário
      indisponível na confirmação (regra de overlap) e exibição da confirmação ao cliente
    - _Requisitos: 14.1, 14.2, 14.3, 14.4_
    - _Design: Components and Interfaces §6 (Agendamento público)_

  - [ ]* 8.9 Testes de exemplo/edge dos módulos auditados
    - Cobrir login inválido, logout, indicador de carregamento, bloqueio de 2ª abertura de
      caixa, bloqueio de pagamento sem caixa, confirmação de agendamento e indisponibilidade
    - _Requisitos: 6.3, 6.7, 6.8, 8.6, 10.5, 12.4, 14.4_
    - _Design: Testing Strategy §Critérios cobertos por outras estratégias_

- [ ] 9. Verificação de autenticação e controle de acesso por papel
  - [ ] 9.1 Auditar guardas de rota e fluxo de auth (`__root.tsx`, `useAuth.tsx`, `auth-middleware.ts`)
    - Verificar redirecionamento de não autenticado para `/login`, bloqueio de Barbeiro em
      Rota_Restrita_Admin (redireciona `/agenda`), acesso de Admin a rotas restritas,
      redirecionamento de logado em `/login` para `/agenda`, logout e indicador de carregamento
    - Confirmar uso da função pura `decidirRedirecionamento` extraída em 5.1
    - _Requisitos: 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 6.8_
    - _Design: Components and Interfaces §5; Error Handling_

  - [ ]* 9.2 Testes de integração de auth e acesso por papel
    - Cobrir autenticação com carregamento de Perfil e bypass de RLS pela service role em 1–3
      exemplos representativos
    - _Requisitos: 6.2, 5.5_
    - _Design: Testing Strategy §Integração_

- [ ] 10. Documentação/desativação das Edge Functions de WhatsApp
  - [ ] 10.1 Documentar e tratar as Edge Functions (`whatsapp-ai-agent`, `whatsapp-follow-up`)
    - Documentar variáveis exigidas (`OPENAI_API_KEY`, `EVOLUTION_API_URL`,
      `EVOLUTION_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
    - Confirmar/garantir que, faltando variável obrigatória, a função retorna erro
      identificando a configuração ausente sem expor segredos
    - Documentar no Doc_Setup como manter as funções desativadas (não implantadas) sem afetar
      o restante do Sistema
    - _Requisitos: 15.1, 15.2, 15.3, 15.4, 15.5_
    - _Design: Components and Interfaces §7_

- [ ] 11. Quality gate final
  - [ ] 11.1 Executar verificação de tipos, lint e build
    - Rodar `tsc --noEmit` sem erros de tipo
    - Rodar `eslint .` sem erros de lint
    - Rodar `vite build` com sucesso após as alterações
    - _Requisitos: 16.1, 16.2, 16.4_
    - _Design: Components and Interfaces §8; Testing Strategy §Smoke/manual_

  - [ ] 11.2 Smoke test de rotas e ausência de resíduos Lovable
    - Confirmar que todas as rotas existentes continuam funcionando após a remoção do código
      da Lovable
    - Reexecutar grep por "lovable" = 0 e inspecionar o bundle de produção para garantir
      ausência da service role key
    - _Requisitos: 16.3, 16.5, 2.8, 5.3_
    - _Design: Testing Strategy §Verificação (smoke) one-shot_

- [ ] 12. Checkpoint final — tudo verde
  - Garantir que todos os testes passam, perguntar ao usuário em caso de dúvidas.

## Notes

- Tarefas marcadas com `*` são opcionais (testes) e podem ser puladas para um MVP mais rápido.
- A ordenação prioriza tornar o projeto executável cedo (tarefas 1–2) antes da auditoria
  profunda dos módulos (tarefa 8).
- Cada tarefa referencia critérios de aceitação específicos para rastreabilidade.
- Os checkpoints garantem validação incremental.
- Os testes de propriedade (tarefa 6) validam as 8 propriedades universais do design sobre as
  funções puras de `src/lib/calculos.ts`.
- O servidor de desenvolvimento e watchers devem ser executados manualmente pelo usuário.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "3.1", "3.2", "3.3", "4.1", "4.2"] },
    { "id": 4, "tasks": ["3.4", "4.3", "5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "9.1", "10.1"] },
    { "id": 8, "tasks": ["8.9", "9.2"] },
    { "id": 9, "tasks": ["11.1"] },
    { "id": 10, "tasks": ["11.2"] }
  ]
}
```
