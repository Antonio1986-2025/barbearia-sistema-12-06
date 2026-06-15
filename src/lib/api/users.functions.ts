import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server functions de gerenciamento de usuários de acesso.
 *
 * Criar/excluir usuários no Supabase Auth exige a chave de serviço
 * (SUPABASE_SERVICE_ROLE_KEY) e SÓ pode rodar no servidor. Estas funções:
 *  - validam que quem chama é admin (via middleware de auth + checagem de perfil);
 *  - usam o cliente admin (service role) para criar/remover o usuário no Auth;
 *  - mantêm a tabela `profiles` consistente (nome, tipo e vínculo prof_id).
 */

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: caller, error } = await context.supabase
    .from("profiles")
    .select("tipo")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (caller?.tipo !== "admin") {
    throw new Error("Apenas administradores podem gerenciar usuários.");
  }
}

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      nome: z.string().trim().min(1, "Informe o nome"),
      email: z.string().trim().email("E-mail inválido"),
      senha: z.string().min(6, "A senha precisa ter ao menos 6 caracteres"),
      tipo: z.enum(["admin", "barbeiro"]),
      prof_id: z.number().int().positive().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as { supabase: any; userId: string });
    const supabaseAdmin = await getSupabaseAdmin();

    // 1. Cria o usuário no Auth, já confirmado, com metadados nome/tipo.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome, tipo: data.tipo },
    });
    if (createErr) throw new Error(createErr.message);

    const newId = created.user?.id;
    if (!newId) throw new Error("Falha ao criar o usuário no Auth.");

    // 2. Garante o perfil consistente (o trigger já cria; aqui fixamos
    //    nome/tipo e o vínculo com o profissional, quando informado).
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newId,
        nome: data.nome,
        tipo: data.tipo,
        prof_id: data.tipo === "barbeiro" ? (data.prof_id ?? null) : null,
      });
    if (upErr) throw new Error(upErr.message);

    return { id: newId, email: data.email, nome: data.nome, tipo: data.tipo };
  });

export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const ctx = context as { supabase: any; userId: string };
    await assertAdmin(ctx);
    const supabaseAdmin = await getSupabaseAdmin();

    if (data.id === ctx.userId) {
      throw new Error("Você não pode excluir o seu próprio usuário.");
    }

    // Impede excluir o último admin restante.
    const { data: alvo } = await supabaseAdmin
      .from("profiles").select("tipo").eq("id", data.id).maybeSingle();
    if (alvo?.tipo === "admin") {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "admin");
      if ((count ?? 0) <= 1) {
        throw new Error("Não é possível excluir o único administrador do sistema.");
      }
    }

    // Remove o usuário do Auth (o perfil é removido em cascata pela FK).
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);

    return { id: data.id };
  });
