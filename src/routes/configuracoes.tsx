import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { criarUsuario, excluirUsuario } from "@/lib/api/users.functions";
import { formatBRL } from "@/lib/format";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, Trash2, Copy, TrendingUp, Users, CalendarCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Barbearia Status" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold bs-gold-text">Configurações</h1>
        <p className="text-sm text-muted-foreground">Profissionais, serviços e horários da barbearia</p>
      </div>
      <Tabs defaultValue="geral">
        <ScrollArea className="w-full">
          <TabsList className="w-max min-w-full">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="prof">Profissionais</TabsTrigger>
            <TabsTrigger value="svc">Serviços</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="link">Link público</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp IA</TabsTrigger>
            <TabsTrigger value="brain">Cérebro IA</TabsTrigger>
            <TabsTrigger value="reports">Relatórios IA</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <TabsContent value="geral" className="mt-4"><GeralTab /></TabsContent>
        <TabsContent value="prof" className="mt-4"><ProfTab /></TabsContent>
        <TabsContent value="svc" className="mt-4"><SvcTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="link" className="mt-4"><LinkTab /></TabsContent>
        <TabsContent value="whatsapp" className="mt-4"><WhatsAppTab /></TabsContent>
        <TabsContent value="brain" className="mt-4"><BrainTab /></TabsContent>
        <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function GeralTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["settings-cfg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<{ nome_barbearia: string; horario_inicio: string; horario_fim: string; slot_minutos: number } | null>(null);

  const current = form ?? settings;
  if (!current) return <p className="text-muted-foreground">Carregando...</p>;

  const save = async () => {
    const { error } = await supabase.from("settings").update({
      nome_barbearia: current.nome_barbearia,
      horario_inicio: current.horario_inicio,
      horario_fim: current.horario_fim,
      slot_minutos: Number(current.slot_minutos),
    }).eq("id", settings!.id);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["settings-cfg"] });
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="bs-card p-6 max-w-xl space-y-4">
      <div className="grid gap-1"><Label>Nome da barbearia</Label><Input value={current.nome_barbearia} onChange={(e) => setForm({ ...current, nome_barbearia: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1"><Label>Abre às</Label><Input type="time" value={current.horario_inicio} onChange={(e) => setForm({ ...current, horario_inicio: e.target.value })} /></div>
        <div className="grid gap-1"><Label>Fecha às</Label><Input type="time" value={current.horario_fim} onChange={(e) => setForm({ ...current, horario_fim: e.target.value })} /></div>
        <div className="grid gap-1"><Label>Slot (min)</Label><Input type="number" value={current.slot_minutos} onChange={(e) => setForm({ ...current, slot_minutos: Number(e.target.value) })} /></div>
      </div>
      <Button className="bs-btn-primary border-0" onClick={save}>Salvar</Button>
    </div>
  );
}

type Pro = { id: number; nome: string; categoria: string; cor: string; avatar: string; comissao_pct: number; ativo: boolean };

function ProfTab() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const { data: pros = [] } = useQuery({
    queryKey: ["pros-cfg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("*").order("ordem");
      if (error) throw error;
      return data as Pro[];
    },
  });

  const toggle = async (p: Pro) => {
    await supabase.from("professionals").update({ ativo: !p.ativo }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["pros-cfg"] });
  };
  const remove = async (id: number) => {
    if (!confirm("Excluir profissional?")) return;
    const { error } = await supabase.from("professionals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pros-cfg"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button className="bs-btn-primary border-0" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo profissional</Button>
      </div>
      <div className="bs-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pros.map((p) => (
              <TableRow key={p.id}>
                <TableCell><span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: p.cor, color: "#0e0a05" }}>{p.avatar}</span></TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.categoria}</TableCell>
                <TableCell className="text-right font-mono">{p.comissao_pct}%</TableCell>
                <TableCell><Switch checked={p.ativo} onCheckedChange={() => toggle(p)} /></TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {openNew && <NewProDialog onClose={() => setOpenNew(false)} onSaved={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["pros-cfg"] }); }} />}
    </div>
  );
}

function NewProDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(""); const [categoria, setCategoria] = useState("Barbeiro");
  const [cor, setCor] = useState("#c9a045"); const [avatar, setAvatar] = useState("");
  const [com, setCom] = useState("50"); const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const { error } = await supabase.from("professionals").insert({
      nome: nome.trim(), categoria, cor, avatar: avatar || nome.slice(0, 2).toUpperCase(),
      comissao_pct: Number(com), ativo: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profissional cadastrado");
    onSaved();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader><DialogTitle className="font-display">Novo Profissional</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Categoria</Label><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Iniciais (2 letras)</Label><Input maxLength={2} value={avatar} onChange={(e) => setAvatar(e.target.value.toUpperCase())} /></div>
            <div className="grid gap-1"><Label>Cor</Label><Input type="color" value={cor} onChange={(e) => setCor(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Comissão (%)</Label><Input type="number" value={com} onChange={(e) => setCom(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving} onClick={save}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Svc = { id: string; nome: string; categoria: string; duracao: number; preco: number; ativo: boolean };

function SvcTab() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const { data: svcs = [] } = useQuery({
    queryKey: ["svc-cfg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, nome, categoria, duracao, preco, ativo, ordem").order("ordem");
      if (error) throw error;
      return data as Svc[];
    },
  });
  const toggle = async (s: Svc) => { await supabase.from("services").update({ ativo: !s.ativo }).eq("id", s.id); qc.invalidateQueries({ queryKey: ["svc-cfg"] }); };
  const remove = async (id: string) => {
    if (!confirm("Excluir serviço?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["svc-cfg"] });
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button className="bs-btn-primary border-0" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo serviço</Button>
      </div>
      <div className="bs-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Duração</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {svcs.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.categoria}</TableCell>
                <TableCell className="text-right">{s.duracao}min</TableCell>
                <TableCell className="text-right font-mono">{formatBRL(s.preco)}</TableCell>
                <TableCell><Switch checked={s.ativo} onCheckedChange={() => toggle(s)} /></TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {openNew && <NewSvcDialog onClose={() => setOpenNew(false)} onSaved={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["svc-cfg"] }); }} />}
    </div>
  );
}

function NewSvcDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(""); const [categoria, setCategoria] = useState("Cabelo");
  const [duracao, setDuracao] = useState("30"); const [preco, setPreco] = useState("50");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const { error } = await supabase.from("services").insert({
      nome: nome.trim(), categoria, duracao: Number(duracao), preco: Number(preco), ativo: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Serviço cadastrado");
    onSaved();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader><DialogTitle className="font-display">Novo Serviço</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Categoria</Label><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Duração (min)</Label><Input type="number" value={duracao} onChange={(e) => setDuracao(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Preço (R$)</Label><Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving} onClick={save}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkTab() {
  const [origin, setOrigin] = useState("");
  if (!origin && typeof window !== "undefined") setOrigin(window.location.origin);
  const url = `${origin}/agendar`;
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };
  return (
    <div className="bs-card p-6 max-w-xl space-y-4">
      <div>
        <h3 className="font-display text-lg">Link público de agendamento</h3>
        <p className="text-sm text-muted-foreground">Compartilhe com seus clientes para que eles agendem sozinhos.</p>
      </div>
      <div className="flex gap-2">
        <Input readOnly value={url} className="font-mono text-sm" />
        <Button variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-1" /> Copiar</Button>
      </div>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["users-cfg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: pros = [] } = useQuery({
    queryKey: ["pros-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("id, nome").order("ordem");
      if (error) throw error;
      return data as { id: number; nome: string }[];
    },
  });
  const proNome = (id: number | null) => pros.find((p) => p.id === id)?.nome ?? "—";

  const remove = async (id: string) => {
    if (!confirm("Excluir este usuário? Ele perderá o acesso ao sistema.")) return;
    try {
      await excluirUsuario({ data: { id } });
      toast.success("Usuário excluído");
      qc.invalidateQueries({ queryKey: ["users-cfg"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir usuário");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button className="bs-btn-primary border-0" onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo usuário
        </Button>
      </div>
      <div className="bs-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Profissional vinculado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell className="capitalize">{u.tipo}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.tipo === "barbeiro" ? proNome(u.prof_id) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => remove(u.id)} disabled={u.tipo === "admin"} title={u.tipo === "admin" ? "Não é possível remover o administrador principal" : ""}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Nenhum usuário cadastrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {openNew && (
        <NewUserDialog
          pros={pros}
          onClose={() => setOpenNew(false)}
          onSaved={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["users-cfg"] }); }}
        />
      )}
    </div>
  );
}

function NewUserDialog({ pros, onClose, onSaved }: {
  pros: { id: number; nome: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState<"admin" | "barbeiro">("barbeiro");
  const [profId, setProfId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    if (!email.trim()) return toast.error("Informe o e-mail");
    if (senha.length < 6) return toast.error("A senha precisa ter ao menos 6 caracteres");
    setSaving(true);
    try {
      await criarUsuario({
        data: {
          nome: nome.trim(),
          email: email.trim(),
          senha,
          tipo,
          prof_id: tipo === "barbeiro" && profId ? Number(profId) : null,
        },
      });
      toast.success("Usuário criado com sucesso");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader><DialogTitle className="font-display">Novo Usuário de Acesso</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" /></div>
          <div className="grid gap-1"><Label>E-mail (login)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@barbearia.com" /></div>
          <div className="grid gap-1"><Label>Senha</Label><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Tipo de acesso</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "admin" | "barbeiro")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="barbeiro">Barbeiro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipo === "barbeiro" && (
              <div className="grid gap-1">
                <Label>Profissional vinculado</Label>
                <Select value={profId} onValueChange={setProfId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {pros.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            O usuário poderá entrar imediatamente com este e-mail e senha. Barbeiros têm acesso só à Agenda.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving} onClick={save}>{saving ? "Criando..." : "Criar usuário"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WhatsAppTab() {
  const qc = useQueryClient();
  const { data: instances = [] } = useQuery({
    queryKey: ["whatsapp-instances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_instances").select("*");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ name: "", instance_name: "", api_key: "", webhook_url: "" });

  const addInstance = async () => {
    if (!form.name || !form.instance_name || !form.api_key) return toast.error("Preencha os campos obrigatórios");
    const { error } = await supabase.from("whatsapp_instances").insert([form]);
    if (error) return toast.error(error.message);
    toast.success("Instância configurada");
    qc.invalidateQueries({ queryKey: ["whatsapp-instances"] });
    setForm({ name: "", instance_name: "", api_key: "", webhook_url: "" });
  };

  return (
    <div className="space-y-6">
      <div className="bs-card p-6 max-w-2xl space-y-4">
        <h3 className="font-display text-lg font-bold">Configurar Evolution API</h3>
        <p className="text-sm text-muted-foreground">Conecte sua instância da Evolution API para permitir que a IA atenda seus clientes.</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1">
            <Label>Nome Amigável</Label>
            <Input placeholder="Ex: WhatsApp Loja" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="grid gap-1">
            <Label>Nome da Instância (Evolution)</Label>
            <Input placeholder="Ex: instancia_01" value={form.instance_name} onChange={e => setForm({...form, instance_name: e.target.value})} />
          </div>
        </div>
        <div className="grid gap-1">
          <Label>Chave de API (ApiKey)</Label>
          <Input type="password" placeholder="Sua chave da Evolution API" value={form.api_key} onChange={e => setForm({...form, api_key: e.target.value})} />
        </div>
        
        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-md">
          <p className="text-xs text-amber-500 font-medium">Instrução Importante:</p>
          <p className="text-[10px] text-amber-500/80">
            No painel da Evolution API, configure o Webhook para o evento <b>MESSAGES_UPSERT</b> apontando para a URL da Edge Function do Supabase.
          </p>
        </div>

        <Button className="bs-btn-primary border-0 w-full" onClick={addInstance}>Salvar Instância</Button>
      </div>

      <div className="bs-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Instância</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((inst: any) => (
              <TableRow key={inst.id}>
                <TableCell className="font-medium">{inst.name}</TableCell>
                <TableCell className="font-mono text-xs">{inst.instance_name}</TableCell>
                <TableCell>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${inst.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                    {inst.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {instances.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Nenhuma instância configurada.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function BrainTab() {
  const qc = useQueryClient();
  const { data: instances = [] } = useQuery({
    queryKey: ["whatsapp-instances-brain"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_instances").select("*");
      if (error) throw error;
      return data;
    },
  });

  const [saving, setSaving] = useState<string | null>(null);

  const saveBrain = async (id: string, brain: string) => {
    setSaving(id);
    const { error } = await supabase
      .from("whatsapp_instances")
      .update({ ai_brain: brain })
      .eq("id", id);
    
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Cérebro da IA atualizado!");
    qc.invalidateQueries({ queryKey: ["whatsapp-instances-brain"] });
  };

  return (
    <div className="space-y-6">
      <div className="bs-card p-6 max-w-3xl space-y-4">
        <h3 className="font-display text-lg font-bold">Cérebro da IA</h3>
        <p className="text-sm text-muted-foreground">
          Aqui você define o conhecimento e o comportamento do seu atendente. 
          Tudo o que você escrever aqui será usado pela IA para responder aos seus clientes.
        </p>
        
        <div className="space-y-8 mt-6">
          {instances.map((inst: any) => (
            <div key={inst.id} className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
              <div className="flex justify-between items-center">
                <Label className="text-base font-bold bs-gold-text">Instância: {inst.name}</Label>
                <span className="text-[10px] bg-muted px-2 py-1 rounded uppercase tracking-wider">
                  {inst.instance_name}
                </span>
              </div>
              <textarea
                className="w-full min-h-[300px] bg-background border border-border rounded-md p-4 text-sm focus:ring-1 focus:ring-primary outline-none resize-y"
                placeholder="Ex: Somos a Barbearia Status. Oferecemos corte degradê, barba com toalha quente e tratamentos capilares. Aceitamos Pix e Cartão. Oferecemos café e cerveja de cortesia..."
                defaultValue={inst.ai_brain || ""}
                id={`brain-${inst.id}`}
              />
              <div className="flex justify-end">
                <Button 
                  className="bs-btn-primary border-0" 
                  disabled={saving === inst.id}
                  onClick={() => {
                    const el = document.getElementById(`brain-${inst.id}`) as HTMLTextAreaElement;
                    saveBrain(inst.id, el.value);
                  }}
                >
                  {saving === inst.id ? "Salvando..." : "Atualizar Cérebro"}
                </Button>
              </div>
            </div>
          ))}

          {instances.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
              <p className="text-muted-foreground">Você precisa configurar uma instância de WhatsApp primeiro.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bs-card p-6 max-w-3xl bg-amber-500/5 border border-amber-500/20">
        <h4 className="font-bold text-amber-500 text-sm mb-2">Dicas para um bom cérebro:</h4>
        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
          <li>Seja específico sobre preços e horários.</li>
          <li>Mencione diferenciais como "estacionamento gratuito" ou "ar condicionado".</li>
          <li>Defina o tom de voz (ex: "seja descontraído" ou "seja muito formal").</li>
          <li>Liste os profissionais disponíveis e suas especialidades.</li>
        </ul>
      </div>
    </div>
  );
}

function ReportsTab() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["ai-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_conversion_stats").select("*").order("chat_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Calculando métricas de conversão...</div>;

  const totalLeads = stats.reduce((acc: number, curr: any) => acc + (curr.total_leads || 0), 0);
  const totalConverted = stats.reduce((acc: number, curr: any) => acc + (curr.converted_appointments || 0), 0);
  const conversionRate = totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bs-card p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total de Leads (IA)</p>
            <h4 className="text-2xl font-bold">{totalLeads}</h4>
          </div>
        </div>
        <div className="bs-card p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CalendarCheck className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Agendamentos (25 dias)</p>
            <h4 className="text-2xl font-bold">{totalConverted}</h4>
          </div>
        </div>
        <div className="bs-card p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-bs-gold/10 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 bs-gold-text" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
            <h4 className="text-2xl font-bold">{conversionRate}%</h4>
          </div>
        </div>
      </div>

      <div className="bs-card p-6">
        <h3 className="font-display text-lg font-bold mb-4">Detalhamento por Data</h3>
        <p className="text-xs text-muted-foreground mb-6">
          Mostra quantos clientes iniciaram conversa com a IA e quantos desses realizaram um agendamento em até 25 dias.
        </p>
        
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data da Conversa</TableHead>
                <TableHead className="text-center">Novos Leads</TableHead>
                <TableHead className="text-center">Convertidos</TableHead>
                <TableHead className="text-right">Eficiência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s: any) => (
                <TableRow key={s.chat_date}>
                  <TableCell className="font-mono">{new Date(s.chat_date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-center">{s.total_leads}</TableCell>
                  <TableCell className="text-center">{s.converted_appointments}</TableCell>
                  <TableCell className="text-right font-bold bs-gold-text">
                    {s.total_leads > 0 ? ((s.converted_appointments / s.total_leads) * 100).toFixed(0) : 0}%
                  </TableCell>
                </TableRow>
              ))}
              {stats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Aguardando os primeiros atendimentos da IA para gerar dados...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
