# Requirements Document

## Introduction

O sistema de gestão da **Barbearia Status** foi gerado pela plataforma Lovable e está
construído com TanStack Start (React 19, SSR, roteamento por arquivos), Supabase
(PostgreSQL na nuvem, Auth e Edge Functions), TypeScript, shadcn/ui (Radix + Tailwind 4)
e React Query. O código está em estado avançado: existem 11 páginas de rota, 20 tabelas
no banco, 12 migrações, 2 Edge Functions e autenticação com controle de acesso por papel
(admin e barbeiro).

O objetivo desta funcionalidade é **finalizar o projeto de forma profissional e sem
gambiarras**, removendo toda a dependência e o lock-in da plataforma Lovable, de modo que
o sistema possa ser instalado, executado, mantido e implantado de forma independente,
mantendo o backend Supabase em nuvem atual (de propriedade do usuário) como padrão.

O escopo cobre: substituição da configuração de build proprietária por uma configuração
padrão de TanStack Start + Vite; remoção de marcas e referências da Lovable; configuração
de ambiente local e execução com gerenciador de pacotes padrão (npm); configuração
independente do Supabase, incluindo tratamento seguro da chave de serviço; verificação do
funcionamento de autenticação e acesso por papel; verificação e conclusão de cada módulo
funcional; avaliação das Edge Functions de WhatsApp; e garantia de qualidade de código.

## Glossary

- **Sistema**: A aplicação de gestão da Barbearia Status como um todo (frontend TanStack Start + backend Supabase).
- **App_Web**: A aplicação frontend executada via TanStack Start (SSR + cliente React).
- **Build**: O processo de compilação e empacotamento da aplicação executado por `vite build`.
- **Servidor_Dev**: O servidor de desenvolvimento iniciado por `vite dev`.
- **Config_Vite**: O arquivo `vite.config.ts` que define plugins e opções de build.
- **Gerenciador_Pacotes**: O gerenciador de pacotes padrão adotado pelo projeto (npm), usado para instalar dependências e executar scripts.
- **Supabase_Cloud**: O projeto Supabase em nuvem existente (ID `tkztzgpryhioilwrhern`), de propriedade do usuário.
- **Cliente_Supabase**: O cliente Supabase do lado do navegador definido em `src/integrations/supabase/client.ts`.
- **Cliente_Admin_Supabase**: O cliente Supabase do lado do servidor com chave de serviço, definido em `src/integrations/supabase/client.server.ts`.
- **Middleware_Auth**: O middleware de autenticação do servidor em `src/integrations/supabase/auth-middleware.ts`.
- **Chave_Anon**: A chave pública (anon/publishable) do Supabase, exposta ao navegador.
- **Chave_Servico**: A chave de serviço (service role) do Supabase, secreta e usada apenas no servidor.
- **Auth**: O subsistema de autenticação baseado em Supabase Auth.
- **Perfil**: O registro da tabela `profiles` associado a um usuário, contendo o campo `tipo` (admin ou barbeiro).
- **Admin**: Usuário cujo Perfil possui `tipo = admin`.
- **Barbeiro**: Usuário cujo Perfil possui `tipo = barbeiro`.
- **Rota_Restrita_Admin**: Rota acessível apenas a usuários Admin (`/comandas`, `/clientes`, `/financeiro`, `/estoque`, `/relatorios`, `/configuracoes`).
- **Rota_Publica**: Rota acessível sem autenticação (`/login`, `/agendar`).
- **Comanda**: Registro da tabela `commands` que agrupa itens de serviço/produto de um atendimento.
- **Item_Comanda**: Registro da tabela `command_items` pertencente a uma Comanda.
- **Caixa**: O conjunto de registros de `cash_registers` e `cash_movements` que controla abertura, fechamento e movimentações financeiras.
- **Edge_Function_IA**: A Edge Function `whatsapp-ai-agent`.
- **Edge_Function_FollowUp**: A Edge Function `whatsapp-follow-up`.
- **Lock_in_Lovable**: Conjunto de dependências, referências de marca, registros privados e mensagens específicas da plataforma Lovable presentes no projeto.
- **Doc_Setup**: Documento de instalação e execução do projeto (por exemplo, um `README.md`).

## Requirements

### Requisito 1: Remover a dependência de build da Lovable

**História de Usuário:** Como desenvolvedor responsável pelo projeto, quero substituir a
configuração de build proprietária da Lovable por uma configuração padrão de TanStack
Start com Vite, para que o Sistema seja compilado e executado sem depender de pacotes da
Lovable.

#### Critérios de Aceitação

1. A Config_Vite SHALL definir os plugins de build diretamente (tanstackStart, plugin React, plugin Tailwind e resolução de paths via tsconfig) sem importar `@lovable.dev/vite-tanstack-config`.
2. THE Sistema SHALL remover o pacote `@lovable.dev/vite-tanstack-config` da lista de dependências do `package.json`.
3. THE Config_Vite SHALL manter o redirecionamento da entrada do servidor SSR para `src/server.ts`.
4. THE Config_Vite SHALL preservar o alias de import `@` apontando para o diretório `src`.
5. WHEN o comando `vite build` é executado, THE Build SHALL concluir gerando os artefatos de produção sem erros.
6. WHEN o comando `vite dev` é executado, THE Servidor_Dev SHALL iniciar e servir a App_Web sem erros.
7. IF a Config_Vite definir o mesmo plugin de forma duplicada, THEN THE Build SHALL ser corrigida para conter cada plugin uma única vez.

### Requisito 2: Remover marcas e referências da Lovable

**História de Usuário:** Como proprietário do projeto, quero eliminar todas as marcas,
URLs e mensagens da Lovable do código, para que o Sistema reflita apenas a identidade da
Barbearia Status.

#### Critérios de Aceitação

1. THE Sistema SHALL substituir as URLs de imagem de Open Graph e Twitter em `src/routes/__root.tsx` que apontam para o armazenamento da Lovable (domínios `r2.dev` e `lovable.app`) por uma imagem hospedada no próprio projeto ou pela ausência da meta tag.
2. THE Cliente_Supabase SHALL apresentar mensagens de erro de variável de ambiente ausente sem a frase "Connect Supabase in Lovable Cloud".
3. THE Cliente_Admin_Supabase SHALL apresentar mensagens de erro de variável de ambiente ausente sem a frase "Connect Supabase in Lovable Cloud".
4. THE Middleware_Auth SHALL apresentar mensagens de erro de variável de ambiente ausente sem a frase "Connect Supabase in Lovable Cloud".
5. WHERE o componente de marcação de elementos (component tagger) da Lovable estiver presente, THE Sistema SHALL removê-lo da configuração de desenvolvimento.
6. THE Edge_Function_IA SHALL utilizar a URL pública de agendamento do domínio próprio do usuário em vez de `barbearia-status.lovable.app`.
7. THE Sistema SHALL substituir, no conteúdo de `public/funcoes_ia.html`, o link de agendamento `barbearia-status.lovable.app` pela URL própria do usuário.
8. WHEN a busca textual por "lovable" é executada no código-fonte versionado (excluindo `node_modules` e o lockfile), THE Sistema SHALL retornar zero ocorrências em arquivos de código e configuração da aplicação.

### Requisito 3: Independência do registro de pacotes e do lockfile

**História de Usuário:** Como desenvolvedor, quero que as dependências sejam instaladas a
partir do registro público de pacotes usando npm, para que a instalação não dependa do
registro privado da Lovable.

#### Critérios de Aceitação

1. THE Sistema SHALL adotar o npm como Gerenciador_Pacotes padrão, dado que o Node.js v24 está disponível e o bun não está instalado.
2. THE Sistema SHALL gerar um lockfile do npm (`package-lock.json`) que referencia o registro público `registry.npmjs.org` para os pacotes do Supabase.
3. THE Sistema SHALL remover o lockfile do bun (`bun.lock`) e a configuração `bunfig.toml` específica da Lovable, ou documentar sua remoção, evitando referências ao registro `europe-west4-npm.pkg.dev/lovable-core-prod`.
4. WHEN `npm install` é executado em uma máquina sem cache prévio, THE Gerenciador_Pacotes SHALL instalar todas as dependências a partir do registro público sem autenticação em registro privado.
5. IF o `package.json` declarar dependências cujas versões só existem no registro privado da Lovable, THEN THE Sistema SHALL ajustá-las para versões equivalentes disponíveis no registro público.

### Requisito 4: Configuração e execução do ambiente local

**História de Usuário:** Como desenvolvedor, quero instalar, configurar e executar o
Sistema localmente seguindo um guia claro, para que eu possa rodar o projeto sem
conhecimento prévio da Lovable.

#### Critérios de Aceitação

1. WHEN as instruções do Doc_Setup são seguidas em uma máquina com Node.js v24, THE Sistema SHALL ser instalado e iniciado em modo de desenvolvimento.
2. THE Doc_Setup SHALL listar os pré-requisitos (versão do Node.js e gerenciador de pacotes), os comandos de instalação, os comandos de execução em desenvolvimento e em produção, e as variáveis de ambiente obrigatórias.
3. THE Sistema SHALL fornecer um arquivo de exemplo de variáveis de ambiente (`.env.example`) listando todas as variáveis obrigatórias sem expor valores secretos.
4. THE Doc_Setup SHALL descrever o procedimento para criar e autenticar um usuário Admin inicial no Supabase_Cloud, incluindo o registro correspondente na tabela `profiles` com `tipo = admin`.
5. IF uma variável de ambiente obrigatória estiver ausente ao iniciar o Sistema, THEN THE Sistema SHALL registrar uma mensagem de erro que identifica nominalmente a variável ausente.
6. THE Doc_Setup SHALL documentar as credenciais de acesso de teste ou o procedimento para defini-las, sem armazenar senhas reais no repositório.

### Requisito 5: Configuração independente do Supabase

**História de Usuário:** Como proprietário do projeto, quero configurar o acesso ao
Supabase_Cloud por meio de variáveis de ambiente próprias, incluindo a chave de serviço
para operações de servidor, para que o backend funcione de forma independente da Lovable
e com segurança.

#### Critérios de Aceitação

1. THE Cliente_Supabase SHALL ler a URL do Supabase e a Chave_Anon a partir das variáveis de ambiente do projeto (`VITE_SUPABASE_URL`/`SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_PUBLISHABLE_KEY`).
2. THE Cliente_Admin_Supabase SHALL ler a URL do Supabase e a Chave_Servico a partir das variáveis de ambiente do servidor (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`).
3. THE Sistema SHALL manter a Chave_Servico apenas no lado do servidor, sem incluí-la em código entregue ao navegador nem em variáveis com prefixo `VITE_`.
4. THE Doc_Setup SHALL descrever como obter a Chave_Servico no painel do Supabase_Cloud e como configurá-la na variável `SUPABASE_SERVICE_ROLE_KEY`.
5. WHEN uma operação de servidor que exige privilégios administrativos é executada com a Chave_Servico configurada, THE Cliente_Admin_Supabase SHALL completar a operação ignorando as políticas de RLS.
6. IF a Chave_Servico não estiver configurada quando uma operação administrativa de servidor for solicitada, THEN THE Sistema SHALL retornar um erro que identifica a variável `SUPABASE_SERVICE_ROLE_KEY` como ausente.
7. THE Sistema SHALL garantir que os arquivos contendo valores secretos (`.env` com Chave_Servico) estejam listados no `.gitignore` e não sejam versionados.

### Requisito 6: Autenticação e controle de acesso por papel

**História de Usuário:** Como gestor da barbearia, quero que o acesso às telas seja
controlado conforme o papel do usuário, para que apenas administradores acessem áreas
sensíveis e barbeiros tenham acesso limitado.

#### Critérios de Aceitação

1. WHEN um usuário não autenticado acessa uma rota que não é Rota_Publica, THE Sistema SHALL redirecioná-lo para `/login`.
2. WHEN um usuário fornece credenciais válidas na tela de login, THE Auth SHALL autenticá-lo e carregar o Perfil correspondente da tabela `profiles`.
3. IF as credenciais fornecidas forem inválidas, THEN THE Auth SHALL exibir uma mensagem de erro e manter o usuário na tela de login.
4. WHILE um usuário Barbeiro estiver autenticado, THE Sistema SHALL impedir o acesso a qualquer Rota_Restrita_Admin redirecionando-o para `/agenda`.
5. WHEN um usuário Admin autenticado acessa uma Rota_Restrita_Admin, THE Sistema SHALL exibir o conteúdo da rota.
6. WHEN um usuário autenticado acessa `/login`, THE Sistema SHALL redirecioná-lo para `/agenda`.
7. WHEN um usuário solicita sair (logout), THE Auth SHALL encerrar a sessão e limpar o Perfil em memória.
8. WHILE o estado de autenticação estiver sendo carregado, THE Sistema SHALL exibir um indicador de carregamento em vez do conteúdo protegido.

### Requisito 7: Módulo Agenda e geração automática de comanda

**História de Usuário:** Como atendente, quero gerenciar agendamentos na agenda e ter a
comanda criada a partir do atendimento, para que o fluxo de atendimento seja contínuo.

#### Critérios de Aceitação

1. WHEN a rota `/agenda` é acessada por usuário autenticado, THE Sistema SHALL exibir os agendamentos (`appointments`) do período selecionado.
2. WHEN um novo agendamento é criado com profissional, serviço, cliente e horário válidos, THE Sistema SHALL persistir o registro na tabela `appointments`.
3. IF o horário solicitado não estiver disponível para o profissional, THEN THE Sistema SHALL impedir a criação do agendamento e informar a indisponibilidade.
4. WHEN um agendamento é marcado como atendido/finalizado, THE Sistema SHALL gerar ou associar a Comanda correspondente ao atendimento.
5. THE Sistema SHALL permitir consultar a disponibilidade de horário utilizando a função `slot_disponivel` do Supabase_Cloud.

### Requisito 8: Módulo Comandas e Caixa

**História de Usuário:** Como atendente, quero registrar itens em comandas e processar
pagamentos no caixa, para que o fechamento financeiro do atendimento seja correto.

#### Critérios de Aceitação

1. WHEN a rota `/comandas` é acessada por usuário Admin, THE Sistema SHALL listar as Comandas existentes.
2. WHEN a rota de detalhe `/comandas/{id}` é acessada, THE Sistema SHALL exibir os Itens_Comanda associados à Comanda informada.
3. WHEN um Item_Comanda é adicionado a uma Comanda, THE Sistema SHALL recalcular o valor total da Comanda incluindo o item adicionado.
4. WHEN um pagamento é registrado para uma Comanda, THE Sistema SHALL persistir a movimentação correspondente no Caixa.
5. WHEN o valor recebido é maior que o total da Comanda em pagamento em dinheiro, THE Sistema SHALL calcular e exibir o troco como a diferença entre o valor recebido e o total.
6. IF não houver Caixa aberto no momento do registro de pagamento, THEN THE Sistema SHALL impedir o registro e informar que o Caixa precisa ser aberto.

### Requisito 9: Módulo Clientes e Dependentes

**História de Usuário:** Como atendente, quero cadastrar e gerenciar clientes e seus
dependentes, para que os atendimentos sejam vinculados às pessoas corretas.

#### Critérios de Aceitação

1. WHEN a rota `/clientes` é acessada por usuário Admin, THE Sistema SHALL listar os clientes (`clients`).
2. WHEN um cliente é cadastrado com os dados obrigatórios preenchidos, THE Sistema SHALL persistir o registro na tabela `clients`.
3. WHEN um dependente é cadastrado vinculado a um cliente, THE Sistema SHALL persistir o registro na tabela `dependents` referenciando o cliente.
4. WHEN os dados de um cliente são atualizados, THE Sistema SHALL persistir as alterações no registro correspondente.
5. IF um campo obrigatório do cliente estiver vazio na submissão, THEN THE Sistema SHALL impedir o salvamento e indicar o campo pendente.

### Requisito 10: Módulo Financeiro

**História de Usuário:** Como Admin, quero controlar a abertura e o fechamento do caixa e
registrar transações e movimentações, para que o controle financeiro seja confiável.

#### Critérios de Aceitação

1. WHEN a rota `/financeiro` é acessada por usuário Admin, THE Sistema SHALL exibir o estado atual do Caixa e as transações do período.
2. WHEN um Caixa é aberto com valor inicial informado, THE Sistema SHALL criar um registro em `cash_registers` com o status de aberto.
3. WHEN uma movimentação de entrada ou saída é registrada, THE Sistema SHALL persistir o registro em `cash_movements` vinculado ao Caixa aberto.
4. WHEN o Caixa é fechado, THE Sistema SHALL calcular o saldo final a partir do valor inicial somado às entradas e subtraídas as saídas.
5. IF for solicitada a abertura de um Caixa enquanto já existe um Caixa aberto, THEN THE Sistema SHALL impedir a nova abertura e informar que há um Caixa em aberto.

### Requisito 11: Módulo Estoque

**História de Usuário:** Como Admin, quero controlar os itens de estoque e suas
movimentações, para que a quantidade disponível de produtos esteja sempre correta.

#### Critérios de Aceitação

1. WHEN a rota `/estoque` é acessada por usuário Admin, THE Sistema SHALL listar os itens de estoque (`stock_items`) com suas quantidades.
2. WHEN uma movimentação de entrada de estoque é registrada, THE Sistema SHALL aumentar a quantidade do item pela quantidade movimentada e registrar a movimentação em `stock_movements`.
3. WHEN uma movimentação de saída de estoque é registrada, THE Sistema SHALL diminuir a quantidade do item pela quantidade movimentada e registrar a movimentação em `stock_movements`.
4. IF uma saída de estoque exceder a quantidade disponível do item, THEN THE Sistema SHALL impedir a movimentação e informar a quantidade insuficiente.

### Requisito 12: Módulo Relatórios

**História de Usuário:** Como Admin, quero visualizar relatórios de faturamento, acertos
diários e vales, para que eu acompanhe o desempenho financeiro da barbearia.

#### Critérios de Aceitação

1. WHEN a rota `/relatorios` é acessada por usuário Admin com um período selecionado, THE Sistema SHALL exibir o faturamento do período utilizando a função `faturamento_periodo` do Supabase_Cloud.
2. WHEN um acerto diário é registrado, THE Sistema SHALL persistir o registro em `daily_settlements`.
3. WHEN um vale (adiantamento) é registrado para um profissional, THE Sistema SHALL persistir o registro em `advances`.
4. WHEN o período do relatório é alterado, THE Sistema SHALL atualizar os valores exibidos para corresponder ao novo período.

### Requisito 13: Módulo Configurações

**História de Usuário:** Como Admin, quero gerenciar profissionais, serviços, usuários e
parâmetros do sistema, para que o cadastro base esteja correto.

#### Critérios de Aceitação

1. WHEN a rota `/configuracoes` é acessada por usuário Admin, THE Sistema SHALL exibir as seções de profissionais, serviços, usuários e parâmetros.
2. WHEN um profissional é cadastrado ou atualizado, THE Sistema SHALL persistir o registro na tabela `professionals`.
3. WHEN um serviço é cadastrado ou atualizado com nome, duração e preço, THE Sistema SHALL persistir o registro na tabela `services`.
4. WHEN um parâmetro do sistema é alterado, THE Sistema SHALL persistir a alteração na tabela `settings`.
5. WHEN um novo usuário é criado com um papel definido, THE Sistema SHALL criar o registro correspondente na tabela `profiles` com o `tipo` selecionado.

### Requisito 14: Página pública de agendamento

**História de Usuário:** Como cliente da barbearia, quero agendar um horário pela página
pública sem efetuar login, para que eu possa marcar atendimentos de forma autônoma.

#### Critérios de Aceitação

1. WHEN a rota `/agendar` é acessada sem autenticação, THE Sistema SHALL exibir o formulário público de agendamento.
2. WHEN um cliente seleciona serviço, profissional e horário disponíveis e confirma, THE Sistema SHALL registrar o agendamento na tabela `appointments`.
3. IF o horário selecionado deixar de estar disponível no momento da confirmação, THEN THE Sistema SHALL impedir o agendamento e informar a indisponibilidade.
4. WHEN um agendamento público é confirmado, THE Sistema SHALL exibir uma confirmação ao cliente.

### Requisito 15: Edge Functions de WhatsApp

**História de Usuário:** Como Admin, quero que as Edge Functions de WhatsApp estejam
funcionais ou claramente desativadas e documentadas, para que não restem funcionalidades
quebradas ou dependências ocultas no Sistema.

#### Critérios de Aceitação

1. THE Sistema SHALL documentar as variáveis de ambiente exigidas pela Edge_Function_IA (incluindo `OPENAI_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e as variáveis do Supabase).
2. WHERE as variáveis de ambiente exigidas pela Edge_Function_IA estiverem configuradas, THE Edge_Function_IA SHALL processar mensagens recebidas e responder utilizando os dados do Supabase_Cloud.
3. IF uma variável de ambiente obrigatória da Edge_Function_IA estiver ausente, THEN THE Edge_Function_IA SHALL retornar um erro identificando a configuração ausente sem expor valores secretos.
4. THE Edge_Function_IA SHALL utilizar a URL de agendamento do domínio próprio do usuário em vez de uma URL da Lovable.
5. WHERE a integração de WhatsApp não for utilizada, THE Doc_Setup SHALL descrever como manter as Edge Functions desativadas sem afetar o funcionamento do restante do Sistema.

### Requisito 16: Qualidade de código

**História de Usuário:** Como desenvolvedor responsável pela manutenção, quero que o
código compile, passe na verificação de lint e não contenha código morto da Lovable, para
que o projeto seja sustentável a longo prazo.

#### Critérios de Aceitação

1. WHEN o compilador TypeScript é executado em modo de verificação de tipos, THE Sistema SHALL concluir sem erros de tipo.
2. WHEN o comando de lint (`eslint .`) é executado, THE Sistema SHALL concluir sem erros de lint.
3. THE Sistema SHALL remover arquivos, importações e configurações que existiam exclusivamente para suportar a plataforma Lovable e que não são mais referenciados.
4. WHEN o comando `vite build` é executado após as alterações, THE Build SHALL concluir com sucesso.
5. THE Sistema SHALL manter o funcionamento de todas as rotas existentes após a remoção do código da Lovable.
