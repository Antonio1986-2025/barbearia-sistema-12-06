/**
 * Script para executar a migration de limpeza de telefones
 * Remove formatação e duplicados da tabela clients
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Carregar variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env');
  process.exit(1);
}

// Cliente Supabase com service role (bypass RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Iniciando migration de limpeza de telefones...\n');

  try {
    // 1. Verificar clientes antes da limpeza
    console.log('📊 Verificando estado atual...');
    const { data: beforeStats, error: statsError } = await supabase.rpc('check_phone_stats');
    
    if (!statsError) {
      console.log('   Estado inicial:', beforeStats);
    }

    // 2. Contar clientes com formatação
    const { count: withMask } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .like('tel', '%[^0-9]%');
    
    console.log(`   Telefones com máscara: ${withMask || 0}`);

    // 3. Contar possíveis duplicados
    const { data: duplicates } = await supabase.rpc('count_duplicate_phones');
    console.log(`   Possíveis duplicados: ${duplicates || 0}\n`);

    // 4. Executar limpeza de formatação
    console.log('🧹 Limpando formatação de telefones...');
    const { error: cleanError } = await supabase.rpc('clean_phone_formatting');
    
    if (cleanError) {
      console.error('❌ Erro ao limpar formatação:', cleanError.message);
      throw cleanError;
    }
    console.log('   ✅ Formatação removida com sucesso\n');

    // 5. Remover duplicados
    console.log('🔄 Removendo clientes duplicados...');
    const { error: dedupError } = await supabase.rpc('remove_duplicate_clients');
    
    if (dedupError) {
      console.error('❌ Erro ao remover duplicados:', dedupError.message);
      throw dedupError;
    }
    console.log('   ✅ Duplicados removidos\n');

    // 6. Verificar resultado final
    console.log('📊 Verificando resultado final...');
    
    const { count: afterMask } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .like('tel', '%[^0-9]%');
    
    const { data: afterDuplicates } = await supabase.rpc('count_duplicate_phones');
    
    console.log(`   Telefones com máscara: ${afterMask || 0}`);
    console.log(`   Duplicados restantes: ${afterDuplicates || 0}\n`);

    console.log('✅ Migration concluída com sucesso!\n');
    console.log('📝 Resumo:');
    console.log(`   - Telefones limpos: ${(withMask || 0) - (afterMask || 0)}`);
    console.log(`   - Duplicados removidos: ${(duplicates || 0) - (afterDuplicates || 0)}\n`);

  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    process.exit(1);
  }
}

// Executar
runMigration();
