import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Carregar .env
const env = {};
try {
  readFileSync('.env', 'utf-8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
} catch {}

const SUPABASE_URL = env.SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔍 Consultando agendamentos via WhatsApp (origem=whatsapp)...\n');

const { data: appts, error } = await supabase
  .from('appointments')
  .select('id, cliente, tel, servico, data, hora, prof_id, origem, status, created_at')
  .eq('origem', 'whatsapp')
  .order('created_at', { ascending: false })
  .limit(30);

if (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}

console.log(`📊 Total de agendamentos WhatsApp (últimos 30): ${appts.length}\n`);

appts.forEach((a, i) => {
  console.log(`${i + 1}. [${a.created_at}]`);
  console.log(`   Cliente: ${a.cliente} | Tel: ${a.tel}`);
  console.log(`   ${a.servico} | ${a.data} ${a.hora} | prof_id: ${a.prof_id} | status: ${a.status}`);
  console.log(`   ID: ${a.id}\n`);
});

// Detectar duplicados (mesmo tel + data + hora + prof)
const grupos = {};
appts.forEach(a => {
  const chave = `${a.tel}|${a.data}|${a.hora}|${a.prof_id}`;
  grupos[chave] = grupos[chave] || [];
  grupos[chave].push(a);
});

console.log('═'.repeat(50));
console.log('🔎 ANÁLISE DE DUPLICADOS (mesmo tel+data+hora+prof):\n');
let temDup = false;
for (const [chave, lista] of Object.entries(grupos)) {
  if (lista.length > 1) {
    temDup = true;
    console.log(`⚠️ DUPLICADO (${lista.length}x): ${chave}`);
    lista.forEach(a => console.log(`   - ${a.id} (${a.created_at})`));
  }
}
if (!temDup) console.log('✅ Nenhum duplicado exato detectado.');

// Também checar comandas abertas
const { data: cmds } = await supabase
  .from('commands')
  .select('id, numero, cliente_nome, status, valor, created_at')
  .order('numero', { ascending: false })
  .limit(15);

console.log('\n' + '═'.repeat(50));
console.log('💼 ÚLTIMAS COMANDAS:\n');
(cmds || []).forEach(c => {
  console.log(`#${c.numero} | ${c.cliente_nome} | ${c.status} | R$ ${c.valor} | ${c.created_at}`);
});
