import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cineibugpcuxvdkkwzau.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não definida.');
  console.error('Defina a variável de ambiente antes de rodar:');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="sua-chave"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) { console.error(`  Erro ao contar ${table}:`, error.message); return '?'; }
  return count;
}

async function deleteAll(table) {
  // Deleta em lotes de 1000 (limite do Supabase)
  let total = 0;
  while (true) {
    const { data, error: selErr } = await supabase.from(table).select('id').limit(1000);
    if (selErr) { console.error(`  Erro ao buscar ${table}:`, selErr.message); break; }
    if (!data || data.length === 0) break;

    const ids = data.map(r => r.id);
    const { error: delErr } = await supabase.from(table).delete().in('id', ids);
    if (delErr) { console.error(`  Erro ao deletar ${table}:`, delErr.message); break; }
    total += ids.length;
    console.log(`  ${table}: deletados ${total}...`);
  }
  return total;
}

const tables = ['command_items', 'commands', 'appointments', 'clients'];

console.log('\n📊 Contagem atual:');
for (const t of tables) {
  const c = await count(t);
  console.log(`  ${t}: ${c}`);
}

console.log('\n🗑️  Deletando dados de teste...');
for (const t of tables) {
  console.log(`\n--- ${t} ---`);
  const total = await deleteAll(t);
  console.log(`  ✅ ${t}: ${total} registros removidos`);
}

console.log('\n📊 Contagem final:');
for (const t of tables) {
  const c = await count(t);
  console.log(`  ${t}: ${c}`);
}

console.log('\n✅ Limpeza concluída!');
