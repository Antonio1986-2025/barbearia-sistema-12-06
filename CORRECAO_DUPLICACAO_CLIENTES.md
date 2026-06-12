# 🔧 Correção: Duplicação de Clientes

## 📋 Problema Identificado

O sistema estava criando **clientes duplicados** porque:

1. Os telefones eram salvos **com máscara** (ex: `(67) 99999-9999`)
2. Pequenas diferenças na formatação criavam registros diferentes
3. A deduplicação por telefone não funcionava corretamente

## ✅ Solução Implementada

### 1. **Normalização de Telefones** 
Agora todos os telefones são salvos **apenas com números** (ex: `67999999999`)

**Arquivos modificados:**
- `src/components/NovoAgendamentoDialog.tsx` - Modal de agendamento admin
- `src/routes/agendar.tsx` - Página pública de agendamento
- `src/routes/clientes.tsx` - Cadastro manual de clientes
- `src/routes/comandas.tsx` - Cadastro rápido ao abrir comanda

### 2. **Uso de UPSERT**
Implementado `upsert` com `onConflict: "tel"` para:
- Reutilizar cliente existente se o telefone já estiver cadastrado
- Criar novo apenas se não existir
- Garantir atomicidade (thread-safe)

**Exemplo do código:**
```typescript
const cleanPhone = tel.replace(/\D/g, "");
await supabase.from("clients").upsert(
  {
    nome: nome.trim(),
    tel: cleanPhone,
    visitas: 0,
    total_gasto: 0
  },
  {
    onConflict: "tel",
    ignoreDuplicates: false
  }
);
```

### 3. **Migration de Limpeza**
Criado arquivo `supabase/migrations/20260612_clean_phone_numbers.sql` que:

✓ Remove caracteres não numéricos de todos os telefones existentes  
✓ Elimina clientes duplicados (mantém o mais recente)  
✓ Atualiza estatísticas do banco para otimizar performance  

## 🚀 Como Aplicar

### Opção A: Aplicar migration via Supabase Dashboard
1. Acesse o Supabase Dashboard do projeto
2. Vá em **SQL Editor**
3. Cole o conteúdo de `supabase/migrations/20260612_clean_phone_numbers.sql`
4. Execute a query

### Opção B: Aplicar via CLI do Supabase
```bash
npx supabase db push
```

### Opção C: Executar manualmente
Se preferir executar apenas a limpeza sem criar migration:

```sql
-- Limpar telefones
UPDATE public.clients
SET tel = regexp_replace(tel, '[^0-9]', '', 'g')
WHERE tel ~ '[^0-9]';

-- Remover duplicados
WITH duplicates AS (
  SELECT 
    id,
    tel,
    ROW_NUMBER() OVER (
      PARTITION BY tel 
      ORDER BY ultima_visita DESC NULLS LAST, 
            total_gasto DESC, 
            created_at DESC
    ) as rn
  FROM public.clients
  WHERE tel IS NOT NULL AND tel != ''
)
DELETE FROM public.clients
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
```

## 📊 Verificação

Após aplicar, você pode verificar se ainda há duplicados:

```sql
-- Ver telefones duplicados
SELECT tel, COUNT(*) as total
FROM public.clients
GROUP BY tel
HAVING COUNT(*) > 1;

-- Ver telefones com formatação
SELECT id, nome, tel
FROM public.clients
WHERE tel ~ '[^0-9]'
LIMIT 10;
```

## 🎯 Resultado Esperado

✅ Telefones salvos apenas com números  
✅ Sem duplicação de clientes  
✅ Deduplicação automática via UPSERT  
✅ Dados históricos limpos e normalizados  

## 📝 Observações

- A interface ainda **mostra** o telefone com máscara para o usuário (`maskPhone`)
- Apenas o **salvamento no banco** é feito sem máscara
- A constraint `UNIQUE` no campo `tel` já existe no banco e garante a unicidade
- Clientes duplicados são removidos mantendo o registro mais relevante (última visita, maior gasto)
