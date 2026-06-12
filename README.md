# Barbearia Status — Sistema de Gestão

Sistema de gestão para barbearia: agenda, agendamento público, comandas/caixa,
clientes e dependentes, financeiro, estoque, relatórios e configurações, com
integração opcional de IA no WhatsApp.

Construído com **TanStack Start** (React 19 + SSR), **Supabase** (PostgreSQL,
Auth e Edge Functions), **TypeScript**, **Tailwind CSS 4** e **shadcn/ui**.

> Este projeto é independente: não depende de nenhuma plataforma de geração de
> código para ser instalado, executado ou implantado.

---

## Pré-requisitos

- **Node.js 20+** (testado com Node.js 24)
- **npm** (já vem com o Node.js)
- Um projeto **Supabase** (a nuvem gratuita serve)

## Instalação

```bash
npm install
```

## Variáveis de ambiente

Copie o arquivo de exemplo e preencha com os dados do seu projeto Supabase:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Onde é usada | Descrição |
|----------|-------------|--------------|-----------|
| `VITE_SUPABASE_URL` | Sim | Navegador | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sim | Navegador | Chave pública (anon) |
| `SUPABASE_URL` | Sim | Servidor (SSR) | URL do projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Sim | Servidor (SSR) | Chave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Para operações admin no servidor | Servidor | Chave secreta `service_role` |
| `VITE_SUPABASE_PROJECT_ID` | Não | Ferramentas | ID do projeto |
| `PUBLIC_BOOKING_URL` | Não | Edge Function IA | Link público de agendamento |

A chave `service_role` é encontrada em **Supabase → Project Settings → API →
service_role**. Ela é **secreta**: nunca use o prefixo `VITE_` nela e nunca a
versione (o `.env` já está no `.gitignore`).

## Executar

```bash
# Desenvolvimento (http://localhost:5173)
npm run dev

# Build de produção
npm run build

# Pré-visualizar o build
npm run preview

# Verificações
npm run lint
```

---

## Configurar um Supabase novo (do zero)

Se você for usar um projeto Supabase próprio (recomendado):

1. Crie um projeto novo em https://supabase.com.
2. No projeto, abra o **SQL Editor**, cole todo o conteúdo de
   `supabase/setup.sql` e clique em **Run**. Isso cria todas as tabelas,
   políticas de segurança (RLS), funções e os dados iniciais (profissionais,
   serviços e configurações).
3. Em **Project Settings → API**, copie a **URL**, a chave **anon** e a chave
   **service_role** e preencha o `.env` (veja a tabela acima).
4. Crie o usuário admin (próxima seção).

## Criar o primeiro usuário Admin
O login exige um usuário no Supabase Auth com um perfil de tipo `admin`. Como o
cadastro de usuários dentro do app é restrito a administradores, o **primeiro**
admin precisa ser criado direto no painel do Supabase:

1. Acesse **Supabase → Authentication → Users → Add user**.
2. Informe e-mail e senha e marque **Auto Confirm User** (confirmar automaticamente).
3. Um registro em `public.profiles` é criado automaticamente pelo trigger
   `on_auth_user_created` (com `tipo = 'barbeiro'` por padrão).
4. Promova o usuário a admin no **SQL Editor**:

   ```sql
   update public.profiles
   set tipo = 'admin'
   where id = (select id from auth.users where email = 'voce@suabarbearia.com');
   ```

5. Faça login no app com esse e-mail e senha. Usuários seguintes podem ser
   criados pela tela **Configurações**.

> Dica: para já criar como admin direto, defina o metadata do usuário como
> `{"nome":"Seu Nome","tipo":"admin"}` no momento da criação — o trigger usa
> esse `tipo`.

### Credenciais de teste

Defina suas próprias credenciais de teste seguindo o passo acima. Por segurança,
**não** armazene senhas reais no repositório.

---

## Controle de acesso

- **admin**: acesso total (comandas, clientes, financeiro, estoque, relatórios,
  configurações).
- **barbeiro**: acesso à agenda; rotas administrativas redirecionam para `/agenda`.
- Rotas públicas (sem login): `/login` e `/agendar`.

## Agente de IA no WhatsApp (Evolution API + OpenAI)

O agente já está implementado como **Supabase Edge Function** (`whatsapp-ai-agent`)
e atende texto, áudio (transcrição via Whisper) e imagem (visão), com memória de
conversa e contexto do cliente. Ele **faz o agendamento sozinho**, como um
atendente humano: usa ferramentas (function calling) para listar serviços e
barbeiros, consultar horários reais (validando disponibilidade e bloqueios) e
**criar o agendamento diretamente no banco** — abrindo a comanda automaticamente,
igual ao fluxo do app. Não envia link de agendamento.

Como o webhook da Evolution precisa de uma URL pública, o agente roda no Supabase
(que já expõe uma URL pública), não no servidor local.

### Deploy

```bash
# 1. Instale a CLI do Supabase e faça login
npm i -g supabase
supabase login

# 2. Vincule ao projeto
supabase link --project-ref SEU_PROJECT_REF

# 3. Configure os segredos da função
supabase secrets set \
  OPENAI_API_KEY=... \
  OPENAI_MODEL=gpt-4o-mini \
  EVOLUTION_URL=https://seu-evolution.host \
  EVOLUTION_API_KEY=... \
  EVOLUTION_INSTANCE=navalha \
  PUBLIC_BOOKING_URL=https://seu-dominio/agendar \
  WEBHOOK_SECRET=uma-senha-forte

# 4. Faça o deploy das funções
supabase functions deploy whatsapp-ai-agent
supabase functions deploy whatsapp-follow-up
```

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente
> nas Edge Functions pelo Supabase — não precisa configurá-los manualmente.

### Configurar o webhook na Evolution API

No painel da Evolution, aponte o evento **MESSAGES_UPSERT** para:

```
https://SEU_PROJECT_REF.supabase.co/functions/v1/whatsapp-ai-agent
```

Se você definiu `WEBHOOK_SECRET`, inclua o cabeçalho `x-webhook-secret` (ou o
parâmetro `?secret=...` na URL) com o mesmo valor — a função rejeita chamadas
sem o segredo correto.

### Variáveis usadas pelo agente

`OPENAI_API_KEY`, `OPENAI_MODEL` (padrão `gpt-4o-mini`), `EVOLUTION_URL` (aceita
também `EVOLUTION_API_URL`), `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` (padrão
`navalha`), `PUBLIC_BOOKING_URL`, `WEBHOOK_SECRET` (opcional).

O comportamento/conhecimento da IA é editável pela tela **Configurações →
Cérebro IA**, por instância.

Para **não** usar o WhatsApp, basta não implantar as funções — o resto do
sistema funciona normalmente.

## Estrutura

```
src/
  routes/         Páginas (file-based routing do TanStack Start)
  components/     Componentes de UI (shadcn/ui)
  hooks/          Hooks (ex.: useAuth)
  integrations/   Clientes Supabase (browser, servidor, middleware de auth)
  lib/            Utilitários e funções puras de cálculo
supabase/
  migrations/     Schema do banco (SQL)
  functions/      Edge Functions (Deno) — opcionais
```
