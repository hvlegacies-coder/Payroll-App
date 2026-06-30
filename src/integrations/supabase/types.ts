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
      account_users: {
        Row: {
          account_id: string
          created_at: string
          id: string
          role: string
          username: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          role?: string
          username: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          role?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_users_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          active: boolean
          branding_logo_url: string
          branding_primary_color: string
          created_at: string
          id: string
          name: string
          parent_account_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branding_logo_url?: string
          branding_primary_color?: string
          created_at?: string
          id?: string
          name: string
          parent_account_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branding_logo_url?: string
          branding_primary_color?: string
          created_at?: string
          id?: string
          name?: string
          parent_account_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string
          created_at: string
          direction: string
          error: string | null
          from_email: string
          id: string
          is_read: boolean
          metadata: Json | null
          status: string
          subject: string
          thread_id: string | null
          to_email: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          direction: string
          error?: string | null
          from_email: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          status?: string
          subject?: string
          thread_id?: string | null
          to_email: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          direction?: string
          error?: string | null
          from_email?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          status?: string
          subject?: string
          thread_id?: string | null
          to_email?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          account_id: string | null
          action: string
          actor: string
          created_at: string
          entity_id: string
          entity_label: string
          entity_type: string
          id: string
          summary: string
        }
        Insert: {
          account_id?: string | null
          action: string
          actor?: string
          created_at?: string
          entity_id?: string
          entity_label?: string
          entity_type: string
          id?: string
          summary?: string
        }
        Update: {
          account_id?: string | null
          action?: string
          actor?: string
          created_at?: string
          entity_id?: string
          entity_label?: string
          entity_type?: string
          id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_overrides: {
        Row: {
          account_id: string | null
          client_belongs_to: string
          client_name: string
          created_at: string
          email: string
          id: string
          location_name: string
          ssn_ein: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          client_belongs_to?: string
          client_name: string
          created_at?: string
          email?: string
          id?: string
          location_name?: string
          ssn_ein: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          client_belongs_to?: string
          client_name?: string
          created_at?: string
          email?: string
          id?: string
          location_name?: string
          ssn_ein?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_overrides_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          account_id: string | null
          created_at: string
          description: string
          id: string
          is_read: boolean
          metadata: Json | null
          title: string
          type: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title: string
          type?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      office_fee_configs: {
        Row: {
          account_id: string | null
          created_at: string
          fee_type: string
          id: string
          mode: string
          office_name: string
          target_office: string
          updated_at: string
          value: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          fee_type: string
          id?: string
          mode?: string
          office_name: string
          target_office: string
          updated_at?: string
          value?: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          fee_type?: string
          id?: string
          mode?: string
          office_name?: string
          target_office?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "office_fee_configs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      office_summary_calc_templates: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          name: string
          operands: Json
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          name: string
          operands?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          name?: string
          operands?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_summary_calc_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      office_summary_configs: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          office_name: string
          tables: Json
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          office_name: string
          tables?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          office_name?: string
          tables?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_summary_configs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          account_id: string | null
          active: boolean
          clients_belongs_data: string
          created_at: string
          default_preparers_share: string
          extra_efins: string[]
          id: string
          notes: string
          office_name: string
          parent_office: string
          primary_efin: string
          process_advance: boolean
          process_backend: boolean
          process_frontend: boolean
          process_preparers_share: boolean
          secondary_efin: string
          share_percent: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          clients_belongs_data?: string
          created_at?: string
          default_preparers_share?: string
          extra_efins?: string[]
          id?: string
          notes?: string
          office_name?: string
          parent_office?: string
          primary_efin?: string
          process_advance?: boolean
          process_backend?: boolean
          process_frontend?: boolean
          process_preparers_share?: boolean
          secondary_efin?: string
          share_percent?: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          clients_belongs_data?: string
          created_at?: string
          default_preparers_share?: string
          extra_efins?: string[]
          id?: string
          notes?: string
          office_name?: string
          parent_office?: string
          primary_efin?: string
          process_advance?: boolean
          process_backend?: boolean
          process_frontend?: boolean
          process_preparers_share?: boolean
          secondary_efin?: string
          share_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_weeks: {
        Row: {
          account_id: string | null
          created_at: string
          funding_date_from: string | null
          funding_date_to: string | null
          id: string
          is_active: boolean
          label: string
          start_date: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          funding_date_from?: string | null
          funding_date_to?: string | null
          id?: string
          is_active?: boolean
          label: string
          start_date: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          funding_date_from?: string | null
          funding_date_to?: string | null
          id?: string
          is_active?: boolean
          label?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_weeks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      preparer_payroll_weeks: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          preparer_fee: number
          preparer_name: string
          ptin: string
          row_data: Json
          tax_office: string
          total_after_advance: number
          total_high_prep_fee: number
          total_pay: number
          total_preparer_share: number
          total_received: number
          total_share: number
          week_label: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          preparer_fee?: number
          preparer_name?: string
          ptin: string
          row_data?: Json
          tax_office?: string
          total_after_advance?: number
          total_high_prep_fee?: number
          total_pay?: number
          total_preparer_share?: number
          total_received?: number
          total_share?: number
          week_label: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          preparer_fee?: number
          preparer_name?: string
          ptin?: string
          row_data?: Json
          tax_office?: string
          total_after_advance?: number
          total_high_prep_fee?: number
          total_pay?: number
          total_preparer_share?: number
          total_received?: number
          total_share?: number
          week_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "preparer_payroll_weeks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      preparer_users: {
        Row: {
          contractor_name: string
          created_at: string
          id: string
          ptin: string
          user_id: string
        }
        Insert: {
          contractor_name?: string
          created_at?: string
          id?: string
          ptin: string
          user_id: string
        }
        Update: {
          contractor_name?: string
          created_at?: string
          id?: string
          ptin?: string
          user_id?: string
        }
        Relationships: []
      }
      preparers: {
        Row: {
          account_id: string | null
          active: boolean
          availed_payroll: number
          contractor: string
          created_at: string
          efin: string
          efin2: string
          id: string
          landing_tab: string
          main_office: string
          notes: string
          office_flat_rate: number
          preparer_client_percent: number
          ptin: string
          roles: string
          share_percent: number
          shared_efin_percent: number
          tax_office: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          availed_payroll?: number
          contractor: string
          created_at?: string
          efin?: string
          efin2?: string
          id?: string
          landing_tab?: string
          main_office?: string
          notes?: string
          office_flat_rate?: number
          preparer_client_percent?: number
          ptin: string
          roles?: string
          share_percent?: number
          shared_efin_percent?: number
          tax_office?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          availed_payroll?: number
          contractor?: string
          created_at?: string
          efin?: string
          efin2?: string
          id?: string
          landing_tab?: string
          main_office?: string
          notes?: string
          office_flat_rate?: number
          preparer_client_percent?: number
          ptin?: string
          roles?: string
          share_percent?: number
          shared_efin_percent?: number
          tax_office?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preparers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_account_table_visibility: {
        Row: {
          created_at: string
          hidden_keys: Json
          id: string
          office_name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hidden_keys?: Json
          id?: string
          office_name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hidden_keys?: Json
          id?: string
          office_name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      upload_rows: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          row_data: Json
          row_index: number
          upload_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          row_data?: Json
          row_index: number
          upload_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          row_data?: Json
          row_index?: number
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_rows_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_rows_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          account_id: string | null
          created_at: string
          filename: string
          id: string
          rows_detected: number
          source_file_hash: string | null
          status: string
          type: string
          uploaded_by: string
          uploaded_date: string
          week_label: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          filename: string
          id?: string
          rows_detected?: number
          source_file_hash?: string | null
          status?: string
          type: string
          uploaded_by?: string
          uploaded_date?: string
          week_label?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          filename?: string
          id?: string
          rows_detected?: number
          source_file_hash?: string | null
          status?: string
          type?: string
          uploaded_by?: string
          uploaded_date?: string
          week_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "preparer"
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
    Enums: {
      app_role: ["admin", "preparer"],
    },
  },
} as const
