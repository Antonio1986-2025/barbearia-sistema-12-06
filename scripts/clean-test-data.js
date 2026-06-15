import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
try {
  readFileSync('.env', 'utf-8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
} catch {}

const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');

console.log(DRY_RUN ? '🔍 MODO SIMULAÇÃO (nada será apagado)\n' : '🗑️ MODO REAL (vai apagar)\n');

// Buscar todas as comandas abertas
const { data: cmds } = await supabase
  .from('commands')
  .select('id, numero, cliente_nome, status, valor, created_at')
  .order('numero', { ascending: true });

console.log(`Total de comandas: ${cmds?.length || 0}\n`);

// Identificar comandas a remover:
// 1. valor = 0 (testes incompletos)
// 2. duplicadas: mesmo cliente_nome + valor criadas em janela de 5s
const aRemover = [];

for (const c of cmds || []) {
  if (Number(c.valor) === 0) {
    aRemover.push({ ...c, motivo: 'valor R$0 (teste incompleto)' });
  }
}

// Detectar duplicatas por cliente+valor em janela de 10s
const ordenadas = [...(cmds || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
for (let i = 1; i < ordenadas.length; i++) {
  const ant = ordenadas[i - 1];
  const atual = ordenadas[i];
  const difMs = new Date(atual.created_at) - new Date(ant.created_at);
  if (
    ant.cliente_nome === atual.cliente_nome &&
    Number(ant.valor) === Number(atual.valor) &&
    Number(atual.valor) > 0 &&
    difMs < 10000 &&
    !aRemover.find(r => r.id === atual.id)
  ) {
    // remove a mais recente (mantém a primeira)
    aRemover.push({ ...atual, motivo: `duplicata de #${ant.numero} (${difMs}ms depois)` });
  }
}

console.log(`Comandas a remover: ${aRemover.length}\n`);
aRemover.forEach(c => {
  console.log(`  #${c.numero} | ${c.cliente_nome} | R$ ${c.valor} | ${c.motivo}`);
});

if (DRY_RUN) {
  console.log('\n✅ Simulação concluída. Rode sem --dry-run para apagar.');
  process.exit(0);
}

if (aRemover.length === 0) {
  console.log('\n✅ Nada para remover.');
  process.exit(0);
}

console.log('\n🗑️ Removendo...');
for (const c of aRemover) {
  // remove itens da comanda primeiro (FK)
  await supabase.from('command_items').delete().eq('command_id', c.id);
  const { error } = await supabase.from('commands').delete().eq('id', c.id);
  if (error) {
    console.error(`  ❌ Erro ao remover #${c.numero}: ${error.message}`);
  } else {
    console.log(`  ✅ Removida #${c.numero}`);
  }
}

console.log('\n✅ Limpeza concluída.');
