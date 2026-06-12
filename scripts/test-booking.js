/**
 * Script de teste para validar o sistema de agendamento
 * Testa criação de cliente e verifica duplicação
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
      value = value.replace(/^["']|["']$/g, '');
      env[key] = value;
    }
  });
  
  return env;
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Credenciais não encontradas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Gerar telefone de teste único
const testPhone = `6799${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
const testName = `Cliente Teste ${Date.now()}`;

async function testBookingFlow() {
  console.log('🧪 TESTE DE AGENDAMENTO E DUPLICAÇÃO\n');
  console.log('═'.repeat(60));

  try {
    // 1. Buscar profissionais e serviços
    console.log('\n📋 Buscando profissionais e serviços...');
    
    const { data: professionals } = await supabase
      .from('professionals')
      .select('id, nome')
      .eq('ativo', true)
      .limit(1)
      .single();

    const { data: service } = await supabase
      .from('services')
      .select('id, nome, duracao, preco')
      .eq('ativo', true)
      .limit(1)
      .single();

    if (!professionals || !service) {
      console.error('❌ Nenhum profissional ou serviço ativo encontrado');
      return;
    }

    console.log(`   ✅ Profissional: ${professionals.nome}`);
    console.log(`   ✅ Serviço: ${service.nome} (${service.duracao}min - R$ ${service.preco})`);

    // 2. Contar clientes antes
    const { count: beforeCount } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    console.log(`\n📊 Clientes antes do teste: ${beforeCount}`);

    // 3. TESTE 1: Criar primeiro agendamento (deve criar cliente)
    console.log('\n🧪 TESTE 1: Primeiro agendamento (deve criar cliente)');
    console.log(`   Nome: ${testName}`);
    console.log(`   Tel: ${testPhone}`);

    const cleanPhone = testPhone.replace(/\D/g, '');

    // Simular upsert como no código real
    const { data: client1, error: error1 } = await supabase
      .from('clients')
      .upsert(
        {
          nome: testName,
          tel: cleanPhone,
          visitas: 0,
          total_gasto: 0
        },
        {
          onConflict: 'tel',
          ignoreDuplicates: false
        }
      )
      .select('id')
      .single();

    if (error1) {
      console.error('   ❌ Erro:', error1.message);
      return;
    }

    console.log(`   ✅ Cliente criado com ID: ${client1.id}`);

    // Criar agendamento
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const { data: appt1, error: apptError1 } = await supabase
      .from('appointments')
      .insert({
        prof_id: professionals.id,
        data: dateStr,
        hora: '10:00',
        servico: service.nome,
        servico_id: service.id,
        duracao: service.duracao,
        valor: service.preco,
        cliente: testName,
        tel: cleanPhone,
        status: 'agendado',
        origem: 'admin'
      })
      .select()
      .single();

    if (apptError1) {
      console.error('   ❌ Erro ao criar agendamento:', apptError1.message);
      return;
    }

    console.log(`   ✅ Agendamento criado: ${appt1.id}`);

    // 4. Contar clientes depois do primeiro
    const { count: afterFirst } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    console.log(`   📊 Total de clientes agora: ${afterFirst}`);
    console.log(`   📊 Novos clientes criados: ${afterFirst - beforeCount}`);

    // 5. TESTE 2: Segundo agendamento com MESMO telefone (NÃO deve duplicar)
    console.log('\n🧪 TESTE 2: Segundo agendamento com MESMO telefone');
    console.log(`   (deve reutilizar cliente existente, não duplicar)`);
    console.log(`   Tel: ${testPhone} (mesmo número)`);

    const { data: client2, error: error2 } = await supabase
      .from('clients')
      .upsert(
        {
          nome: `${testName} MODIFICADO`, // Nome diferente
          tel: cleanPhone, // Mesmo telefone
          visitas: 0,
          total_gasto: 0
        },
        {
          onConflict: 'tel',
          ignoreDuplicates: false
        }
      )
      .select('id')
      .single();

    if (error2) {
      console.error('   ❌ Erro:', error2.message);
      return;
    }

    console.log(`   ✅ Cliente retornado com ID: ${client2.id}`);

    if (client1.id === client2.id) {
      console.log('   ✅ SUCESSO: Mesmo cliente reutilizado (ID igual)');
    } else {
      console.log('   ❌ FALHA: Cliente duplicado (IDs diferentes!)');
    }

    // Criar segundo agendamento
    const { data: appt2, error: apptError2 } = await supabase
      .from('appointments')
      .insert({
        prof_id: professionals.id,
        data: dateStr,
        hora: '11:00', // Horário diferente
        servico: service.nome,
        servico_id: service.id,
        duracao: service.duracao,
        valor: service.preco,
        cliente: `${testName} MODIFICADO`,
        tel: cleanPhone,
        status: 'agendado',
        origem: 'admin'
      })
      .select()
      .single();

    if (apptError2) {
      console.error('   ❌ Erro ao criar segundo agendamento:', apptError2.message);
      return;
    }

    console.log(`   ✅ Segundo agendamento criado: ${appt2.id}`);

    // 6. Contar clientes final
    const { count: finalCount } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    console.log(`\n📊 Total de clientes final: ${finalCount}`);
    console.log(`   Diferença do início: +${finalCount - beforeCount}`);

    // 7. Verificar registros do cliente de teste
    const { data: testClients } = await supabase
      .from('clients')
      .select('id, nome, tel')
      .eq('tel', cleanPhone);

    console.log(`\n🔍 Registros encontrados com telefone ${cleanPhone}:`);
    testClients?.forEach(c => {
      console.log(`   - ID: ${c.id} | Nome: ${c.nome} | Tel: ${c.tel}`);
    });

    // 8. Resultado
    console.log('\n' + '═'.repeat(60));
    if (finalCount - beforeCount === 1 && testClients?.length === 1) {
      console.log('✅ TESTE PASSOU! Nenhuma duplicação detectada.');
      console.log('✅ Sistema funcionando corretamente.');
    } else {
      console.log('❌ TESTE FALHOU! Duplicação detectada.');
      console.log(`   Esperado: 1 novo cliente`);
      console.log(`   Encontrado: ${finalCount - beforeCount} novos clientes`);
    }

    // 9. Limpeza (remover dados de teste)
    console.log('\n🧹 Limpando dados de teste...');
    
    await supabase.from('appointments').delete().eq('tel', cleanPhone);
    await supabase.from('clients').delete().eq('tel', cleanPhone);
    
    console.log('   ✅ Dados de teste removidos\n');

  } catch (error) {
    console.error('\n❌ Erro durante o teste:', error.message);
    console.error(error);
  }
}

testBookingFlow();
