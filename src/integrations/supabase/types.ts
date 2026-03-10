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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          type?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_watchlist: {
        Row: {
          account_id: string
          company_name: string | null
          created_at: string
          id: string
          symbol: string
          user_id: string
        }
        Insert: {
          account_id: string
          company_name?: string | null
          created_at?: string
          id?: string
          symbol: string
          user_id: string
        }
        Update: {
          account_id?: string
          company_name?: string | null
          created_at?: string
          id?: string
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_watchlist_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_type: string
          created_at: string
          id: string
          name: string
          starting_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          id?: string
          name?: string
          starting_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          created_at?: string
          id?: string
          name?: string
          starting_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          achievement_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          account_filter: string | null
          created_at: string
          date_from: string | null
          date_to: string | null
          id: string
          insights: string
          total_pnl: number | null
          trades_count: number
          user_id: string
          win_rate: number | null
        }
        Insert: {
          account_filter?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          insights: string
          total_pnl?: number | null
          trades_count?: number
          user_id: string
          win_rate?: number | null
        }
        Update: {
          account_filter?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          insights?: string
          total_pnl?: number | null
          trades_count?: number
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      blueprints: {
        Row: {
          checklist: string | null
          created_at: string
          id: string
          logic: string | null
          max_allocation: number | null
          name: string | null
          risk_rules: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist?: string | null
          created_at?: string
          id?: string
          logic?: string | null
          max_allocation?: number | null
          name?: string | null
          risk_rules?: string | null
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist?: string | null
          created_at?: string
          id?: string
          logic?: string | null
          max_allocation?: number | null
          name?: string | null
          risk_rules?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          blueprint_id: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          user_id: string
        }
        Insert: {
          blueprint_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          user_id: string
        }
        Update: {
          blueprint_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "blueprints"
            referencedColumns: ["id"]
          },
        ]
      }
      cot_history: {
        Row: {
          created_at: string
          id: string
          nc_long: number
          nc_long_change: number
          nc_net: number
          nc_short: number
          nc_short_change: number
          open_interest: number
          report_date: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nc_long?: number
          nc_long_change?: number
          nc_net?: number
          nc_short?: number
          nc_short_change?: number
          open_interest?: number
          report_date: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nc_long?: number
          nc_long_change?: number
          nc_net?: number
          nc_short?: number
          nc_short_change?: number
          open_interest?: number
          report_date?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      economic_events: {
        Row: {
          actual: string | null
          created_at: string
          currency: string | null
          event_date: string
          event_time: string | null
          forecast: string | null
          id: string
          impact: string | null
          notes: string | null
          previous: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual?: string | null
          created_at?: string
          currency?: string | null
          event_date: string
          event_time?: string | null
          forecast?: string | null
          id?: string
          impact?: string | null
          notes?: string | null
          previous?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual?: string | null
          created_at?: string
          currency?: string | null
          event_date?: string
          event_time?: string | null
          forecast?: string | null
          id?: string
          impact?: string | null
          notes?: string | null
          previous?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          id: string
          max_drawdown_target: number | null
          max_trades_target: number | null
          month: string
          notes: string | null
          pnl_target: number | null
          updated_at: string
          user_id: string
          win_rate_target: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          max_drawdown_target?: number | null
          max_trades_target?: number | null
          month: string
          notes?: string | null
          pnl_target?: number | null
          updated_at?: string
          user_id: string
          win_rate_target?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          max_drawdown_target?: number | null
          max_trades_target?: number | null
          month?: string
          notes?: string | null
          pnl_target?: number | null
          updated_at?: string
          user_id?: string
          win_rate_target?: number | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          lessons: string | null
          mood: string | null
          post_market_notes: string | null
          pre_market_notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          lessons?: string | null
          mood?: string | null
          post_market_notes?: string | null
          pre_market_notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          lessons?: string | null
          mood?: string | null
          post_market_notes?: string | null
          pre_market_notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      macro_saved_indicators: {
        Row: {
          id: string
          indicators: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          indicators?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          indicators?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mindset_entries: {
        Row: {
          confidence_level: number
          created_at: string
          date: string
          energy_level: number
          focus_level: number
          id: string
          mood: string | null
          post_session_notes: string | null
          pre_session_notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_level?: number
          created_at?: string
          date?: string
          energy_level?: number
          focus_level?: number
          id?: string
          mood?: string | null
          post_session_notes?: string | null
          pre_session_notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_level?: number
          created_at?: string
          date?: string
          energy_level?: number
          focus_level?: number
          id?: string
          mood?: string | null
          post_session_notes?: string | null
          pre_session_notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      options_sentiment: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          sentiment: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          sentiment?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          sentiment?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_account: string | null
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_account?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_account?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rule_violations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          severity: string
          trade_id: string | null
          user_id: string
          violation_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          severity?: string
          trade_id?: string | null
          user_id: string
          violation_type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          severity?: string
          trade_id?: string | null
          user_id?: string
          violation_type?: string
        }
        Relationships: []
      }
      session_plans: {
        Row: {
          bias: string | null
          created_at: string
          date: string
          id: string
          key_levels: string | null
          notes: string | null
          updated_at: string
          user_id: string
          watchlist: string | null
        }
        Insert: {
          bias?: string | null
          created_at?: string
          date?: string
          id?: string
          key_levels?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          watchlist?: string | null
        }
        Update: {
          bias?: string | null
          created_at?: string
          date?: string
          id?: string
          key_levels?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          watchlist?: string | null
        }
        Relationships: []
      }
      trade_ai_summaries: {
        Row: {
          created_at: string
          id: string
          summary: string
          trade_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          summary: string
          trade_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          summary?: string
          trade_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_executions: {
        Row: {
          created_at: string
          executed_at: string
          execution_type: string
          id: string
          notes: string | null
          price: number
          quantity: number
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          executed_at?: string
          execution_type?: string
          id?: string
          notes?: string | null
          price: number
          quantity?: number
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          executed_at?: string
          execution_type?: string
          id?: string
          notes?: string | null
          price?: number
          quantity?: number
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_executions_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_mistakes: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          severity: string
          trade_id: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          severity?: string
          trade_id?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          severity?: string
          trade_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trade_steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          screenshot_url: string | null
          step_number: number
          step_type: string
          title: string
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          screenshot_url?: string | null
          step_number?: number
          step_type?: string
          title: string
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          screenshot_url?: string | null
          step_number?: number
          step_type?: string
          title?: string
          trade_id?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          account_name: string | null
          asset_type: string | null
          broker: string | null
          created_at: string
          direction: string
          entry_date: string
          entry_price: number
          exit_date: string | null
          exit_price: number | null
          fees: number | null
          id: string
          notes: string | null
          pnl: number | null
          pnl_percent: number | null
          quantity: number
          screenshot_url: string | null
          status: string
          stop_loss: number | null
          strategy: string | null
          symbol: string
          tags: string[] | null
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          asset_type?: string | null
          broker?: string | null
          created_at?: string
          direction: string
          entry_date: string
          entry_price: number
          exit_date?: string | null
          exit_price?: number | null
          fees?: number | null
          id?: string
          notes?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          quantity?: number
          screenshot_url?: string | null
          status?: string
          stop_loss?: number | null
          strategy?: string | null
          symbol: string
          tags?: string[] | null
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          asset_type?: string | null
          broker?: string | null
          created_at?: string
          direction?: string
          entry_date?: string
          entry_price?: number
          exit_date?: string | null
          exit_price?: number | null
          fees?: number | null
          id?: string
          notes?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          quantity?: number
          screenshot_url?: string | null
          status?: string
          stop_loss?: number | null
          strategy?: string | null
          symbol?: string
          tags?: string[] | null
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
