export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      advances: {
        Row: {
          created_at: string
          data: string
          id: string
          observacao: string | null
          prof_id: number
          solicitado_por: string | null
          status: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          prof_id: number
          solicitado_por?: string | null
          status?: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          prof_id?: number
          solicitado_por?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "advances_prof_id_fkey"
            columns: ["prof_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chats: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string | null
          last_follow_up_at: string | null
          message_text: string | null
          remote_jid: string
          response_text: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_id?: string | null
          last_follow_up_at?: string | null
          message_text?: string | null
          remote_jid: string
          response_text?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string | null
          last_follow_up_at?: string | null
          message_text?: string | null
          remote_jid?: string
          response_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chats_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cliente: string
          created_at: string
          data: string
          dependente_nome: string | null
          duracao: number
          hora: string
          id: string
          observacao: string | null
          origem: string
          prof_id: number
          servico: string
          servico_id: string | null
          status: string
          tel: string
          titular_id: string | null
          valor: number
        }
        Insert: {
          cliente: string
          created_at?: string
          data: string
          dependente_nome?: string | null
          duracao?: number
          hora: string
          id?: string
          observacao?: string | null
          origem?: string
          prof_id: number
          servico: string
          servico_id?: string | null
          status?: string
          tel: string
          titular_id?: string | null
          valor?: number
        }
        Update: {
          cliente?: string
          created_at?: string
          data?: string
          dependente_nome?: string | null
          duracao?: number
          hora?: string
          id?: string
          observacao?: string | null
          origem?: string
          prof_id?: number
          servico?: string
          servico_id?: string | null
          status?: string
          tel?: string
          titular_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointments_prof_id_fkey"
            columns: ["prof_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          created_at: string
          data: string
          hora: string
          id: string
          motivo: string | null
          prof_id: number
        }
        Insert: {
          created_at?: string
          data: string
          hora: string
          id?: string
          motivo?: string | null
          prof_id: number
        }
        Update: {
          created_at?: string
          data?: string
          hora?: string
          id?: string
          motivo?: string | null
          prof_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "blocks_prof_id_fkey"
            columns: ["prof_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          cash_id: string
          descricao: string
          forma_pagamento: string | null
          hora: string
          id: string
          tipo: string
          valor: number
        }
        Insert: {
          cash_id: string
          descricao: string
          forma_pagamento?: string | null
          hora?: string
          id?: string
          tipo: string
          valor: number
        }
        Update: {
          cash_id?: string
          descricao?: string
          forma_pagamento?: string | null
          hora?: string
          id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_id_fkey"
            columns: ["cash_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          abertura: string
          created_at: string
          data: string
          fechamento: string | null
          id: string
          responsavel: string | null
          status: string
          valor_final: number | null
          valor_inicial: number
        }
        Insert: {
          abertura?: string
          created_at?: string
          data: string
          fechamento?: string | null
          id?: string
          responsavel?: string | null
          status?: string
          valor_final?: number | null
          valor_inicial?: number
        }
        Update: {
          abertura?: string
          created_at?: string
          data?: string
          fechamento?: string | null
          id?: string
          responsavel?: string | null
          status?: string
          valor_final?: number | null
          valor_inicial?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          data_nascimento: string | null
          email: string | null
          genero: string | null
          id: string
          nome: string
          observacao: string | null
          tel: string
          total_gasto: number
          ultima_visita: string | null
          visitas: number
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          genero?: string | null
          id?: string
          nome: string
          observacao?: string | null
          tel: string
          total_gasto?: number
          ultima_visita?: string | null
          visitas?: number
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          genero?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          tel?: string
          total_gasto?: number
          ultima_visita?: string | null
          visitas?: number
        }
        Relationships: []
      }
      command_items: {
        Row: {
          command_id: string
          descricao: string
          id: string
          prof_id: number | null
          tipo: string
          valor: number
        }
        Insert: {
          command_id: string
          descricao: string
          id?: string
          prof_id?: number | null
          tipo?: string
          valor: number
        }
        Update: {
          command_id?: string
          descricao?: string
          id?: string
          prof_id?: number | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "command_items_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "command_items_prof_id_fkey"
            columns: ["prof_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      commands: {
        Row: {
          abertura: string
          cliente_id: string | null
          cliente_nome: string
          created_at: string
          fechamento: string | null
          forma_pagamento: string | null
          id: string
          numero: number
          status: string
          troco: number | null
          valor: number
          valor_recebido: number | null
        }
        Insert: {
          abertura?: string
          cliente_id?: string | null
          cliente_nome: string
          created_at?: string
          fechamento?: string | null
          forma_pagamento?: string | null
          id?: string
          numero?: number
          status?: string
          troco?: number | null
          valor?: number
          valor_recebido?: number | null
        }
        Update: {
          abertura?: string
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          fechamento?: string | null
          forma_pagamento?: string | null
          id?: string
          numero?: number
          status?: string
          troco?: number | null
          valor?: number
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commands_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_settlements: {
        Row: {
          comissao: number
          consumiveis: number
          created_at: string
          data: string
          id: string
          liquido: number
          prof_id: number
          servicos_total: number
          status: string
          vales: number
        }
        Insert: {
          comissao?: number
          consumiveis?: number
          created_at?: string
          data: string
          id?: string
          liquido?: number
          prof_id: number
          servicos_total?: number
          status?: string
          vales?: number
        }
        Update: {
          comissao?: number
          consumiveis?: number
          created_at?: string
          data?: string
          id?: string
          liquido?: number
          prof_id?: number
          servicos_total?: number
          status?: string
          vales?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_settlements_prof_id_fkey"
            columns: ["prof_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      dependents: {
        Row: {
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          titular_id: string
          total_gasto: number
          ultima_visita: string | null
          visitas: number
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome: string
          titular_id: string
          total_gasto?: number
          ultima_visita?: string | null
          visitas?: number
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          titular_id?: string
          total_gasto?: number
          ultima_visita?: string | null
          visitas?: number
        }
        Relationships: [
          {
            foreignKeyName: "dependents_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          ativo: boolean
          avatar: string
          categoria: string
          comissao_pct: number
          cor: string
          created_at: string
          foto_url: string | null
          id: number
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          avatar?: string
          categoria?: string
          comissao_pct?: number
          cor?: string
          created_at?: string
          foto_url?: string | null
          id?: number
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          avatar?: string
          categoria?: string
          comissao_pct?: number
          cor?: string
          created_at?: string
          foto_url?: string | null
          id?: number
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          cor: string | null
          created_at: string
          id: string
          nome: string
          prof_id: number | null
          tipo: string
        }
        Insert: {
          avatar?: string | null
          cor?: string | null
          created_at?: string
          id: string
          nome: string
          prof_id?: number | null
          tipo?: string
        }
        Update: {
          avatar?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          prof_id?: number | null
          tipo?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          duracao: number
          id: string
          nome: string
          ordem: number
          preco: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          duracao?: number
          id?: string
          nome: string
          ordem?: number
          preco?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          duracao?: number
          id?: string
          nome?: string
          ordem?: number
          preco?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          criado_em: string
          dias_funcionamento: number[]
          horario_fim: string
          horario_inicio: string
          id: string
          logo_url: string | null
          nome_barbearia: string
          slot_minutos: number
        }
        Insert: {
          criado_em?: string
          dias_funcionamento?: number[]
          horario_fim?: string
          horario_inicio?: string
          id?: string
          logo_url?: string | null
          nome_barbearia?: string
          slot_minutos?: number
        }
        Update: {
          criado_em?: string
          dias_funcionamento?: number[]
          horario_fim?: string
          horario_inicio?: string
          id?: string
          logo_url?: string | null
          nome_barbearia?: string
          slot_minutos?: number
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          ativo: boolean
          created_at: string
          custo: number
          id: string
          minimo: number
          nome: string
          preco_venda: number
          quantidade: number
          unidade: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo?: number
          id?: string
          minimo?: number
          nome: string
          preco_venda?: number
          quantidade?: number
          unidade?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo?: number
          id?: string
          minimo?: number
          nome?: string
          preco_venda?: number
          quantidade?: number
          unidade?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          data: string
          id: string
          item_id: string
          motivo: string | null
          prof_id: number | null
          quantidade: number
          tipo: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          item_id: string
          motivo?: string | null
          prof_id?: number | null
          quantidade: number
          tipo: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          item_id?: string
          motivo?: string | null
          prof_id?: number | null
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_prof_id_fkey"
            columns: ["prof_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          forma_pagamento: string | null
          id: string
          observacao: string | null
          tipo: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data?: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          tipo: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          ai_brain: string | null
          api_key: string
          created_at: string
          id: string
          instance_name: string
          is_active: boolean | null
          name: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          ai_brain?: string | null
          api_key: string
          created_at?: string
          id?: string
          instance_name: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          ai_brain?: string | null
          api_key?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          created_at: string
          from_me: boolean | null
          id: string
          instance_id: string | null
          message_type: string | null
          remote_jid: string
          status: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          from_me?: boolean | null
          id?: string
          instance_id?: string | null
          message_type?: string | null
          remote_jid: string
          status?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          from_me?: boolean | null
          id?: string
          instance_id?: string | null
          message_type?: string | null
          remote_jid?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_conversion_stats: {
        Row: {
          chat_date: string | null
          converted_appointments: number | null
          total_leads: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      faturamento_periodo: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          taxa_conclusao: number
          ticket_medio: number
          total_atendimentos: number
          total_faturado: number
        }[]
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      slot_disponivel: {
        Args: {
          p_data: string
          p_duracao: number
          p_excluir?: string
          p_hora: string
          p_prof_id: number
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
