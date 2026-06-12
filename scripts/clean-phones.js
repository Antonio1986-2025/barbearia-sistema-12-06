/**
 * Script simplificado para limpar telefones duplicados
 * Executa SQL direto via REST API
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Ler .env manualmente
function loadEnv() {
  try {
    const envPath = join(projectRoot, '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove aspas
        value = value.replace(/^["']|["']$/g, '');
        env[key] = value;
      }
    });
    
    return env;
  } catch (error) {
    console.error('❌ Erro ao ler .env:', error.message);
    process.exit(1);
  }
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('🚀 Limpando telefones duplicados...\n');

  try {
    // 1. Verificar estado atual
    console.log('📊 Estado atual:');
    const { data: allClients, count: total } = await supabase
      .from('clients')
      .select('id, nome, tel', { count: 'exact' });
    
    console.log(`   Total de clientes: ${total}\n`);

    // Agrupar por telefone para ver duplicados
    const phoneMap = {};
    allClients?.forEach(client => {
      const cleanPhone = client.tel.replace(/\D/g, '');
      if (!phoneMap[cleanPhone]) {
        phoneMap[cleanPhone] = [];
      }
      phoneMap[cleanPhone].push(client);
    });

    const duplicates = Object.entries(phoneMap).filter(([_, clients]) => clients.length > 1);
    console.log(`   Telefones duplicados encontrados: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
      console.log('\n   📋 Primeiros 5 duplicados:');
      duplicates.slice(0, 5).forEach(([phone, clients]) => {
        console.log(`      ${phone}: ${clients.length} registros`);
        clients.forEach(c => console.log(`         - ${c.nome} (${c.tel})`));
      });
    }

    console.log('\n🧹 Iniciando limpeza...\n');

    // 2. Atualizar telefones para remover máscara
    console.log('   1️⃣ Removendo formatação...');
    let cleaned = 0;
    
    for (const client of allClients || []) {
      const cleanPhone = client.tel.replace(/\D/g, '');
      if (cleanPhone !== client.tel) {
        const { error } = await supabase
          .from('clients')
          .update({ tel: cleanPhone })
          .eq('id', client.id);
        
        if (!error) cleaned++;
      }
    }
    console.log(`      ✅ ${cleaned} telefones formatados corrigidos\n`);

    // 3. Remover duplicados (manter o mais antigo ou com mais visitas)
    console.log('   2️⃣ Removendo duplicados...');
    let removed = 0;

    // Re-buscar depois da limpeza
    const { data: updatedClients } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: true });

    const updatedPhoneMap = {};
    updatedClients?.forEach(client => {
      if (!updatedPhoneMap[client.tel]) {
        updatedPhoneMap[client.tel] = [];
      }
      updatedPhoneMap[client.tel].push(client);
    });

    for (const [phone, clients] of Object.entries(updatedPhoneMap)) {
      if (clients.length > 1) {
        // Ordenar: manter o com mais visitas, ou o mais antigo
        clients.sort((a, b) => {
          if (b.visitas !== a.visitas) return b.visitas - a.visitas;
          if (b.total_gasto !== a.total_gasto) return b.total_gasto - a.total_gasto;
          return new Date(a.created_at) - new Date(b.created_at);
        });

        const toKeep = clients[0];
        const toDelete = clients.slice(1);

        console.log(`      📞 ${phone}: mantendo "${toKeep.nome}", removendo ${toDelete.length} duplicado(s)`);

        for (const client of toDelete) {
          const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', client.id);
          
          if (!error) removed++;
        }
      }
    }

    console.log(`      ✅ ${removed} duplicados removidos\n`);

    // 4. Limpar telefones em appointments também
    console.log('   3️⃣ Limpando telefones em agendamentos...');
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, tel')
      .not('tel', 'is', null);

    let apptsCleaned = 0;
    for (const appt of appointments || []) {
      const cleanPhone = appt.tel.replace(/\D/g, '');
      if (cleanPhone !== appt.tel) {
        await supabase
          .from('appointments')
          .update({ tel: cleanPhone })
          .eq('id', appt.id);
        apptsCleaned++;
      }
    }
    console.log(`      ✅ ${apptsCleaned} telefones em agendamentos corrigidos\n`);

    // 5. Verificar resultado
    console.log('📊 Estado final:');
    const { count: finalTotal } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });
    
    console.log(`   Total de clientes: ${finalTotal}`);
    console.log(`   Registros removidos: ${total - finalTotal}\n`);

    console.log('✅ Limpeza concluída com sucesso!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
