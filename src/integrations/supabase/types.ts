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
      ar_invoice_items: {
        Row: {
          ar_invoice_id: string
          created_at: string
          description: string
          id: string
          quantity: number | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          ar_invoice_id: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          ar_invoice_id?: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ar_invoice_items_ar_invoice_id_fkey"
            columns: ["ar_invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_invoices: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string | null
          discount_amount: number | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_amount: number | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          tenant_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number | null
          due_date?: string
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          paid_amount?: number | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_amount?: number | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_payments: {
        Row: {
          amount: number
          ar_invoice_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          reference_number: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          ar_invoice_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          ar_invoice_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_payments_ar_invoice_id_fkey"
            columns: ["ar_invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_config: {
        Row: {
          advance_booking_days: number | null
          created_at: string
          header_title: string | null
          header_title_ar: string | null
          id: string
          min_notice_hours: number | null
          primary_color: string | null
          show_prices: boolean | null
          show_staff: boolean | null
          slug: string | null
          tenant_id: string
          updated_at: string
          welcome_msg: string | null
          welcome_msg_ar: string | null
        }
        Insert: {
          advance_booking_days?: number | null
          created_at?: string
          header_title?: string | null
          header_title_ar?: string | null
          id?: string
          min_notice_hours?: number | null
          primary_color?: string | null
          show_prices?: boolean | null
          show_staff?: boolean | null
          slug?: string | null
          tenant_id: string
          updated_at?: string
          welcome_msg?: string | null
          welcome_msg_ar?: string | null
        }
        Update: {
          advance_booking_days?: number | null
          created_at?: string
          header_title?: string | null
          header_title_ar?: string | null
          id?: string
          min_notice_hours?: number | null
          primary_color?: string | null
          show_prices?: boolean | null
          show_staff?: boolean | null
          slug?: string | null
          tenant_id?: string
          updated_at?: string
          welcome_msg?: string | null
          welcome_msg_ar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          check_in_token: string | null
          checked_in_at: string | null
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          deposit_amount: number | null
          deposit_status: Database["public"]["Enums"]["payment_status"] | null
          duration: number
          end_time: string
          id: string
          is_online_booking: boolean
          notes: string | null
          payment_id: string | null
          payment_url: string | null
          pending_retail: Json
          price: number
          service_category: Database["public"]["Enums"]["service_category"]
          service_id: string | null
          service_name: string
          staff_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          booking_date: string
          check_in_token?: string | null
          checked_in_at?: string | null
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          deposit_amount?: number | null
          deposit_status?: Database["public"]["Enums"]["payment_status"] | null
          duration: number
          end_time: string
          id?: string
          is_online_booking?: boolean
          notes?: string | null
          payment_id?: string | null
          payment_url?: string | null
          pending_retail?: Json
          price?: number
          service_category?: Database["public"]["Enums"]["service_category"]
          service_id?: string | null
          service_name: string
          staff_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          booking_date?: string
          check_in_token?: string | null
          checked_in_at?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          deposit_amount?: number | null
          deposit_status?: Database["public"]["Enums"]["payment_status"] | null
          duration?: number
          end_time?: string
          id?: string
          is_online_booking?: boolean
          notes?: string | null
          payment_id?: string | null
          payment_url?: string | null
          pending_retail?: Json
          price?: number
          service_category?: Database["public"]["Enums"]["service_category"]
          service_id?: string | null
          service_name?: string
          staff_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          closing_time: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          opening_time: string | null
          phone: string | null
          tenant_id: string
          updated_at: string | null
          working_days: Json | null
        }
        Insert: {
          address?: string | null
          closing_time?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          opening_time?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string | null
          working_days?: Json | null
        }
        Update: {
          address?: string | null
          closing_time?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          opening_time?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string | null
          working_days?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          end_date: string
          id: string
          is_active: boolean
          name: string
          spent_amount: number
          start_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          spent_amount?: number
          start_date: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          spent_amount?: number
          start_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget_amount: number | null
          campaign_type: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          spent_amount: number
          start_date: string | null
          status: string
          target_audience: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          budget_amount?: number | null
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          spent_amount?: number
          start_date?: string | null
          status?: string
          target_audience?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          budget_amount?: number | null
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          spent_amount?: number
          start_date?: string | null
          status?: string
          target_audience?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          branch_id: string | null
          cash_variance: number | null
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          closing_card_terminal: number | null
          closing_cash_counted: number | null
          closing_knet_terminal: number | null
          closing_notes: string | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          opening_balance: number | null
          opening_notes: string | null
          session_date: string
          status: string
          tenant_id: string
          total_card_sales: number | null
          total_cash_payouts: number | null
          total_cash_sales: number | null
          total_gift_sales: number | null
          total_knet_sales: number | null
          total_refunds: number | null
          transaction_count: number | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          cash_variance?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          closing_card_terminal?: number | null
          closing_cash_counted?: number | null
          closing_knet_terminal?: number | null
          closing_notes?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_balance?: number | null
          opening_notes?: string | null
          session_date?: string
          status?: string
          tenant_id: string
          total_card_sales?: number | null
          total_cash_payouts?: number | null
          total_cash_sales?: number | null
          total_gift_sales?: number | null
          total_knet_sales?: number | null
          total_refunds?: number | null
          transaction_count?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          cash_variance?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          closing_card_terminal?: number | null
          closing_cash_counted?: number | null
          closing_knet_terminal?: number | null
          closing_notes?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_balance?: number | null
          opening_notes?: string | null
          session_date?: string
          status?: string
          tenant_id?: string
          total_card_sales?: number | null
          total_cash_payouts?: number | null
          total_cash_sales?: number | null
          total_gift_sales?: number | null
          total_knet_sales?: number | null
          total_refunds?: number | null
          transaction_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_accounts: {
        Row: {
          ai_agent_enabled: boolean
          auto_reply_enabled: boolean
          channel: string
          connected_at: string | null
          created_at: string
          display_handle: string | null
          display_name: string | null
          ice_breakers: Json | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          profile_pic_url: string | null
          provider: string
          provider_account_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_agent_enabled?: boolean
          auto_reply_enabled?: boolean
          channel: string
          connected_at?: string | null
          created_at?: string
          display_handle?: string | null
          display_name?: string | null
          ice_breakers?: Json | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          profile_pic_url?: string | null
          provider?: string
          provider_account_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_agent_enabled?: boolean
          auto_reply_enabled?: boolean
          channel?: string
          connected_at?: string | null
          created_at?: string
          display_handle?: string | null
          display_name?: string | null
          ice_breakers?: Json | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          profile_pic_url?: string | null
          provider?: string
          provider_account_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_subtype: string | null
          account_type: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          name_ar: string | null
          normal_balance: string
          opening_balance: number | null
          parent_id: string | null
          tenant_id: string
        }
        Insert: {
          account_subtype?: string | null
          account_type?: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          name_ar?: string | null
          normal_balance?: string
          opening_balance?: number | null
          parent_id?: string | null
          tenant_id: string
        }
        Update: {
          account_subtype?: string | null
          account_type?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          name_ar?: string | null
          normal_balance?: string
          opening_balance?: number | null
          parent_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checks: {
        Row: {
          amount: number
          bank_name: string | null
          check_date: string
          check_number: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          payee: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          bank_name?: string | null
          check_date?: string
          check_number: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payee?: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          bank_name?: string | null
          check_date?: string
          check_number?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payee?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_feedback: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          service_name: string | null
          source: string | null
          staff_id: string | null
          tenant_id: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          service_name?: string | null
          source?: string | null
          staff_id?: string | null
          tenant_id: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          service_name?: string | null
          source?: string | null
          staff_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_packages: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          package_id: string
          purchase_date: string
          sessions_remaining: number | null
          sessions_total: number
          sessions_used: number | null
          status: string
          tenant_id: string
          transaction_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          package_id: string
          purchase_date?: string
          sessions_remaining?: number | null
          sessions_total?: number
          sessions_used?: number | null
          status?: string
          tenant_id: string
          transaction_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          package_id?: string
          purchase_date?: string
          sessions_remaining?: number | null
          sessions_total?: number
          sessions_used?: number | null
          status?: string
          tenant_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_tokens: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          tenant_id: string
          token: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string
          id?: string
          tenant_id: string
          token?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_trigger_log: {
        Row: {
          channel: string
          client_id: string
          id: string
          notes: string | null
          reference_id: string | null
          sent_at: string
          status: string
          tenant_id: string
          trigger_event: string
        }
        Insert: {
          channel?: string
          client_id: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          sent_at?: string
          status?: string
          tenant_id: string
          trigger_event: string
        }
        Update: {
          channel?: string
          client_id?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          sent_at?: string
          status?: string
          tenant_id?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_trigger_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_trigger_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          phone_norm: string | null
          tenant_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          phone_norm?: string | null
          tenant_id: string
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          phone_norm?: string | null
          tenant_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_handoff: boolean
          assigned_to: string | null
          channel: string
          channel_account_id: string | null
          client_id: string | null
          created_at: string
          display_name: string | null
          external_id: string
          id: string
          last_message_at: string | null
          last_message_direction: string | null
          last_message_preview: string | null
          profile_pic_url: string | null
          provider_chat_id: string
          status: string
          tags: string[] | null
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_handoff?: boolean
          assigned_to?: string | null
          channel: string
          channel_account_id?: string | null
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          external_id: string
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          profile_pic_url?: string | null
          provider_chat_id: string
          status?: string
          tags?: string[] | null
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_handoff?: boolean
          assigned_to?: string | null
          channel?: string
          channel_account_id?: string | null
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          external_id?: string
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          profile_pic_url?: string | null
          provider_chat_id?: string
          status?: string
          tags?: string[] | null
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefing_config: {
        Row: {
          enabled: boolean
          last_brief: string | null
          last_sent_date: string | null
          recipient_phone: string | null
          send_hour: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          last_brief?: string | null
          last_sent_date?: string | null
          recipient_phone?: string | null
          send_hour?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          last_brief?: string | null
          last_sent_date?: string | null
          recipient_phone?: string | null
          send_hour?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_briefing_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_entries: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          expense_number: string
          id: string
          notes: string | null
          payee: string | null
          payment_method: string | null
          receipt_url: string | null
          reference_number: string | null
          tenant_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          expense_number: string
          id?: string
          notes?: string | null
          payee?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference_number?: string | null
          tenant_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          expense_number?: string
          id?: string
          notes?: string | null
          payee?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference_number?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_date: string
          id: string
          is_closed: boolean
          name: string
          notes: string | null
          start_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          is_closed?: boolean
          name: string
          notes?: string | null
          start_date: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          is_closed?: boolean
          name?: string
          notes?: string | null
          start_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          code: string
          created_at: string
          current_balance: number
          expires_at: string | null
          id: string
          initial_balance: number
          recipient_name: string | null
          recipient_phone: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          current_balance?: number
          expires_at?: string | null
          id?: string
          initial_balance?: number
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          current_balance?: number
          expires_at?: string | null
          id?: string
          initial_balance?: number
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_mappings: {
        Row: {
          cost_center_id: string | null
          created_at: string
          credit_account_id: string | null
          debit_account_id: string | null
          id: string
          is_active: boolean
          label: string | null
          mapping_type: string
          profit_center_id: string | null
          source_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string
          credit_account_id?: string | null
          debit_account_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          mapping_type: string
          profit_center_id?: string | null
          source_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string
          credit_account_id?: string | null
          debit_account_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          mapping_type?: string
          profit_center_id?: string | null
          source_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_mappings_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_mappings_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_mappings_debit_account_id_fkey"
            columns: ["debit_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_mappings_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          batch_number: string | null
          expiry_date: string | null
          goods_receipt_id: string
          id: string
          po_item_id: string | null
          product_id: string
          quantity_received: number
          unit_cost: number
        }
        Insert: {
          batch_number?: string | null
          expiry_date?: string | null
          goods_receipt_id: string
          id?: string
          po_item_id?: string | null
          product_id: string
          quantity_received?: number
          unit_cost?: number
        }
        Update: {
          batch_number?: string | null
          expiry_date?: string | null
          goods_receipt_id?: string
          id?: string
          po_item_id?: string | null
          product_id?: string
          quantity_received?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          grn_number: string
          id: string
          notes: string | null
          purchase_order_id: string
          received_at: string
          received_by: string | null
          tenant_id: string
        }
        Insert: {
          grn_number: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          received_at?: string
          received_by?: string | null
          tenant_id: string
        }
        Update: {
          grn_number?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          received_at?: string
          received_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          quantity_change: number
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity_change: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity_change?: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          transaction_type?: Database["public"]["Enums"]["inventory_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          description_ar: string | null
          entry_date: string
          entry_number: string
          id: string
          is_posted: boolean | null
          is_reversed: boolean | null
          source: string | null
          source_ref_id: string | null
          source_ref_type: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          description_ar?: string | null
          entry_date?: string
          entry_number: string
          id?: string
          is_posted?: boolean | null
          is_reversed?: boolean | null
          source?: string | null
          source_ref_id?: string | null
          source_ref_type?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          description_ar?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          is_posted?: boolean | null
          is_reversed?: boolean | null
          source?: string | null
          source_ref_id?: string | null
          source_ref_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number | null
          debit: number | null
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interest_payment: number | null
          loan_id: string
          notes: string | null
          payment_date: string
          principal_payment: number | null
          tenant_id: string
          total_payment: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interest_payment?: number | null
          loan_id: string
          notes?: string | null
          payment_date?: string
          principal_payment?: number | null
          tenant_id: string
          total_payment?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interest_payment?: number | null
          loan_id?: string
          notes?: string | null
          payment_date?: string
          principal_payment?: number | null
          tenant_id?: string
          total_payment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          created_at: string
          id: string
          interest_rate: number | null
          lender_name: string
          loan_number: string
          loan_type: string | null
          maturity_date: string | null
          monthly_payment: number | null
          notes: string | null
          outstanding_balance: number | null
          principal_amount: number
          start_date: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_rate?: number | null
          lender_name?: string
          loan_number: string
          loan_type?: string | null
          maturity_date?: string | null
          monthly_payment?: number | null
          notes?: string | null
          outstanding_balance?: number | null
          principal_amount?: number
          start_date?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_rate?: number | null
          lender_name?: string
          loan_number?: string
          loan_type?: string | null
          maturity_date?: string | null
          monthly_payment?: number | null
          notes?: string | null
          outstanding_balance?: number | null
          principal_amount?: number
          start_date?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          min_redemption: number | null
          points_per_kwd: number | null
          redemption_rate: number | null
          tenant_id: string
          tier_vip_threshold: number | null
          tier_vvip_threshold: number | null
          tiers: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          min_redemption?: number | null
          points_per_kwd?: number | null
          redemption_rate?: number | null
          tenant_id: string
          tier_vip_threshold?: number | null
          tier_vvip_threshold?: number | null
          tiers?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          min_redemption?: number | null
          points_per_kwd?: number | null
          redemption_rate?: number | null
          tenant_id?: string
          tier_vip_threshold?: number | null
          tier_vvip_threshold?: number | null
          tiers?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          balance_after: number | null
          booking_id: string | null
          client_id: string
          created_at: string
          id: string
          note: string | null
          points: number
          tenant_id: string
          type: string
        }
        Insert: {
          balance_after?: number | null
          booking_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          note?: string | null
          points?: number
          tenant_id: string
          type?: string
        }
        Update: {
          balance_after?: number | null
          booking_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          note?: string | null
          points?: number
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_handled: boolean
          booking_id: string | null
          content: string | null
          content_type: string
          conversation_id: string
          created_at: string
          direction: string
          error_message: string | null
          external_message_id: string | null
          id: string
          media_url: string | null
          metadata: Json | null
          sender_id: string | null
          sender_type: string
          status: string
          tenant_id: string
        }
        Insert: {
          ai_handled?: boolean
          booking_id?: string | null
          content?: string | null
          content_type?: string
          conversation_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json | null
          sender_id?: string | null
          sender_type: string
          status?: string
          tenant_id: string
        }
        Update: {
          ai_handled?: boolean
          booking_id?: string | null
          content?: string | null
          content_type?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json | null
          sender_id?: string | null
          sender_type?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      online_booking_requests: {
        Row: {
          admin_note: string | null
          booking_date: string
          booking_id: string
          client_name: string
          client_phone: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_name: string
          start_time: string
          status: string
          tenant_id: string
        }
        Insert: {
          admin_note?: string | null
          booking_date: string
          booking_id: string
          client_name: string
          client_phone: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_name: string
          start_time: string
          status?: string
          tenant_id: string
        }
        Update: {
          admin_note?: string | null
          booking_date?: string
          booking_id?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_name?: string
          start_time?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_booking_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_booking_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_briefing_log: {
        Row: {
          briefing_date: string
          id: string
          metrics_json: Json | null
          sent_at: string
          status: string
          summary_text: string | null
          tenant_id: string
        }
        Insert: {
          briefing_date: string
          id?: string
          metrics_json?: Json | null
          sent_at?: string
          status?: string
          summary_text?: string | null
          tenant_id: string
        }
        Update: {
          briefing_date?: string
          id?: string
          metrics_json?: Json | null
          sent_at?: string
          status?: string
          summary_text?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_briefing_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      package_redemptions: {
        Row: {
          booking_id: string | null
          client_package_id: string
          id: string
          redeemed_at: string
          transaction_id: string | null
        }
        Insert: {
          booking_id?: string | null
          client_package_id: string
          id?: string
          redeemed_at?: string
          transaction_id?: string | null
        }
        Update: {
          booking_id?: string | null
          client_package_id?: string
          id?: string
          redeemed_at?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_redemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_redemptions_client_package_id_fkey"
            columns: ["client_package_id"]
            isOneToOne: false
            referencedRelation: "client_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          payment_provider: string
          raw_response: Json | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          payment_provider?: string
          raw_response?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          payment_provider?: string
          raw_response?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      po_approval_rules: {
        Row: {
          allowed_roles: string[]
          created_at: string
          description: string | null
          four_eyes_enforced: boolean
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number
          name: string
          require_two_approvers: boolean
          sort_order: number
          specific_approvers: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allowed_roles?: string[]
          created_at?: string
          description?: string | null
          four_eyes_enforced?: boolean
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number
          name: string
          require_two_approvers?: boolean
          sort_order?: number
          specific_approvers?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allowed_roles?: string[]
          created_at?: string
          description?: string | null
          four_eyes_enforced?: boolean
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number
          name?: string
          require_two_approvers?: boolean
          sort_order?: number
          specific_approvers?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_approval_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          name_ar: string | null
          parent_id: string | null
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_ar?: string | null
          parent_id?: string | null
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_ar?: string | null
          parent_id?: string | null
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          agreed_cost: number | null
          id: string
          is_preferred: boolean | null
          lead_time_days: number | null
          product_id: string
          supplier_id: string
        }
        Insert: {
          agreed_cost?: number | null
          id?: string
          is_preferred?: boolean | null
          lead_time_days?: number | null
          product_id: string
          supplier_id: string
        }
        Update: {
          agreed_cost?: number | null
          id?: string
          is_preferred?: boolean | null
          lead_time_days?: number | null
          product_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          batch_number: string | null
          category_id: string | null
          cost_price: number
          created_at: string
          current_stock: number
          description: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          name_ar: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          purchase_unit: string | null
          purchase_unit_quantity: number | null
          reorder_point: number | null
          reorder_quantity: number | null
          retail_price: number | null
          sku: string | null
          tenant_id: string
          updated_at: string
          usage_unit: string | null
        }
        Insert: {
          barcode?: string | null
          batch_number?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          current_stock?: number
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          name_ar?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          purchase_unit?: string | null
          purchase_unit_quantity?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          retail_price?: number | null
          sku?: string | null
          tenant_id: string
          updated_at?: string
          usage_unit?: string | null
        }
        Update: {
          barcode?: string | null
          batch_number?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          current_stock?: number
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          name_ar?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          purchase_unit?: string | null
          purchase_unit_quantity?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          retail_price?: number | null
          sku?: string | null
          tenant_id?: string
          updated_at?: string
          usage_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_centers: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profit_centers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_purchase: number | null
          name: string | null
          tenant_id: string
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          name?: string | null
          tenant_id: string
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          name?: string | null
          tenant_id?: string
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          po_id: string
          product_id: string
          quantity_ordered: number
          quantity_received: number
          total_cost: number
          unit_cost: number
        }
        Insert: {
          id?: string
          po_id: string
          product_id: string
          quantity_ordered?: number
          quantity_received?: number
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          id?: string
          po_id?: string
          product_id?: string
          quantity_ordered?: number
          quantity_received?: number
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          payment_terms: string | null
          po_number: string
          requested_by: string | null
          sent_at: string | null
          sent_via: Database["public"]["Enums"]["po_sent_via"] | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_terms?: string | null
          po_number: string
          requested_by?: string | null
          sent_at?: string | null
          sent_via?: Database["public"]["Enums"]["po_sent_via"] | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_terms?: string | null
          po_number?: string
          requested_by?: string | null
          sent_at?: string | null
          sent_via?: Database["public"]["Enums"]["po_sent_via"] | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_alerts: {
        Row: {
          auto_po_id: string | null
          created_at: string
          current_stock: number
          id: string
          product_id: string
          reorder_point: number
          resolved_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          auto_po_id?: string | null
          created_at?: string
          current_stock: number
          id?: string
          product_id: string
          reorder_point: number
          resolved_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          auto_po_id?: string | null
          created_at?: string
          current_stock?: number
          id?: string
          product_id?: string
          reorder_point?: number
          resolved_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reorder_alerts_auto_po_id_fkey"
            columns: ["auto_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_actual_usage: {
        Row: {
          actual_qty: number
          booking_id: string
          expected_qty: number
          id: string
          notes: string | null
          product_id: string
          recorded_at: string
          recorded_by: string | null
          service_id: string | null
          tenant_id: string
          variance: number | null
          variance_pct: number | null
        }
        Insert: {
          actual_qty?: number
          booking_id: string
          expected_qty?: number
          id?: string
          notes?: string | null
          product_id: string
          recorded_at?: string
          recorded_by?: string | null
          service_id?: string | null
          tenant_id: string
          variance?: number | null
          variance_pct?: number | null
        }
        Update: {
          actual_qty?: number
          booking_id?: string
          expected_qty?: number
          id?: string
          notes?: string | null
          product_id?: string
          recorded_at?: string
          recorded_by?: string | null
          service_id?: string | null
          tenant_id?: string
          variance?: number | null
          variance_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_actual_usage_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_actual_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_actual_usage_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_actual_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_consumption_actuals: {
        Row: {
          actual_qty: number
          booking_id: string | null
          expected_qty: number | null
          id: string
          notes: string | null
          product_id: string
          recorded_at: string
          recorded_by: string | null
          service_id: string
          staff_id: string | null
          tenant_id: string
        }
        Insert: {
          actual_qty: number
          booking_id?: string | null
          expected_qty?: number | null
          id?: string
          notes?: string | null
          product_id: string
          recorded_at?: string
          recorded_by?: string | null
          service_id: string
          staff_id?: string | null
          tenant_id: string
        }
        Update: {
          actual_qty?: number
          booking_id?: string | null
          expected_qty?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          recorded_at?: string
          recorded_by?: string | null
          service_id?: string
          staff_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_consumption_actuals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_consumption_actuals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_consumption_actuals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_consumption_actuals_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_consumption_actuals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          price: number
          service_id: string | null
          sessions_total: number
          tenant_id: string
          valid_days: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          price?: number
          service_id?: string | null
          sessions_total?: number
          tenant_id: string
          valid_days?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          price?: number
          service_id?: string | null
          sessions_total?: number
          tenant_id?: string
          valid_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_price_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          price: number
          service_id: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          price: number
          service_id: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_to: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          price?: number
          service_id?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_price_schedules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_price_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_recipes: {
        Row: {
          id: string
          product_id: string
          quantity_per_service: number
          service_id: string
          tenant_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity_per_service?: number
          service_id: string
          tenant_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity_per_service?: number
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_recipes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_recipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          color: string | null
          created_at: string
          deposit_amount: number | null
          deposit_required: boolean
          duration: number
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          price: number
          rebook_after_days: number | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["service_category"]
          color?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_required?: boolean
          duration?: number
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          price?: number
          rebook_after_days?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          color?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_required?: boolean
          duration?: number
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          price?: number
          rebook_after_days?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      session_payouts: {
        Row: {
          amount: number
          id: string
          paid_by: string | null
          paid_to: string | null
          payout_at: string
          reason: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          id?: string
          paid_by?: string | null
          paid_to?: string | null
          payout_at?: string
          reason?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          id?: string
          paid_by?: string | null
          paid_to?: string | null
          payout_at?: string
          reason?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_payouts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          avatar_url: string | null
          break_end: string | null
          break_start: string | null
          color: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
          working_hours_end: string
          working_hours_start: string
        }
        Insert: {
          avatar_url?: string | null
          break_end?: string | null
          break_start?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
          working_hours_end?: string
          working_hours_start?: string
        }
        Update: {
          avatar_url?: string | null
          break_end?: string | null
          break_start?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
          working_hours_end?: string
          working_hours_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          early_leave_minutes: number | null
          id: string
          late_minutes: number | null
          notes: string | null
          staff_id: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          early_leave_minutes?: number | null
          id?: string
          late_minutes?: number | null
          notes?: string | null
          staff_id: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          early_leave_minutes?: number | null
          id?: string
          late_minutes?: number | null
          notes?: string | null
          staff_id?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_commission_rules: {
        Row: {
          commission_type: string
          commission_value: number
          created_at: string
          id: string
          is_active: boolean | null
          service_category: string | null
          service_id: string | null
          staff_id: string
          tenant_id: string
        }
        Insert: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          service_category?: string | null
          service_id?: string | null
          staff_id: string
          tenant_id: string
        }
        Update: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          service_category?: string | null
          service_id?: string | null
          staff_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_commission_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commission_rules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commission_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          service_id: string
          staff_id: string
        }
        Insert: {
          service_id: string
          staff_id: string
        }
        Update: {
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_take_entries: {
        Row: {
          counted_at: string | null
          counted_by: string | null
          counted_quantity: number | null
          created_at: string
          id: string
          product_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          session_id: string
          status: Database["public"]["Enums"]["stock_take_entry_status"]
          system_quantity: number
          unit_cost: number
          variance: number | null
          variance_reason:
            | Database["public"]["Enums"]["stock_take_variance_reason"]
            | null
          variance_value: number | null
        }
        Insert: {
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          id?: string
          product_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["stock_take_entry_status"]
          system_quantity?: number
          unit_cost?: number
          variance?: number | null
          variance_reason?:
            | Database["public"]["Enums"]["stock_take_variance_reason"]
            | null
          variance_value?: number | null
        }
        Update: {
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          id?: string
          product_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["stock_take_entry_status"]
          system_quantity?: number
          unit_cost?: number
          variance?: number | null
          variance_reason?:
            | Database["public"]["Enums"]["stock_take_variance_reason"]
            | null
          variance_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_take_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_take_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stock_take_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_take_sessions: {
        Row: {
          assigned_staff_ids: string[] | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          scope: Database["public"]["Enums"]["stock_take_scope"]
          scope_filter_id: string | null
          session_name: string
          started_at: string | null
          status: Database["public"]["Enums"]["stock_take_status"]
          tenant_id: string
          total_variance_value: number | null
          updated_at: string
        }
        Insert: {
          assigned_staff_ids?: string[] | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scope?: Database["public"]["Enums"]["stock_take_scope"]
          scope_filter_id?: string | null
          session_name: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["stock_take_status"]
          tenant_id: string
          total_variance_value?: number | null
          updated_at?: string
        }
        Update: {
          assigned_staff_ids?: string[] | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scope?: Database["public"]["Enums"]["stock_take_scope"]
          scope_filter_id?: string | null
          session_name?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["stock_take_status"]
          tenant_id?: string
          total_variance_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_take_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          tenant_id: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          tenant_id: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          tenant_id?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          status: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_theme: {
        Row: {
          accent_color: string
          bg_color: string
          border_color: string
          brand_name: string
          created_at: string
          favicon_url: string | null
          font_arabic: string
          font_body: string
          font_heading: string
          id: string
          instagram_handle: string | null
          logo_dark_url: string | null
          logo_url: string | null
          muted_color: string
          powered_by_text: string | null
          powered_by_url: string | null
          primary_color: string
          primary_foreground: string
          show_powered_by: boolean
          tenant_id: string
          text_color: string
          updated_at: string
          whatsapp_link: string | null
        }
        Insert: {
          accent_color?: string
          bg_color?: string
          border_color?: string
          brand_name: string
          created_at?: string
          favicon_url?: string | null
          font_arabic?: string
          font_body?: string
          font_heading?: string
          id?: string
          instagram_handle?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          muted_color?: string
          powered_by_text?: string | null
          powered_by_url?: string | null
          primary_color?: string
          primary_foreground?: string
          show_powered_by?: boolean
          tenant_id: string
          text_color?: string
          updated_at?: string
          whatsapp_link?: string | null
        }
        Update: {
          accent_color?: string
          bg_color?: string
          border_color?: string
          brand_name?: string
          created_at?: string
          favicon_url?: string | null
          font_arabic?: string
          font_body?: string
          font_heading?: string
          id?: string
          instagram_handle?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          muted_color?: string
          powered_by_text?: string | null
          powered_by_url?: string | null
          primary_color?: string
          primary_foreground?: string
          show_powered_by?: boolean
          tenant_id?: string
          text_color?: string
          updated_at?: string
          whatsapp_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_theme_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          currency: string | null
          daily_briefing_enabled: boolean
          daily_briefing_hour: number
          default_tax_rate: number | null
          id: string
          is_active: boolean | null
          is_trial: boolean | null
          logo_url: string | null
          name: string
          notification_prefs: Json | null
          onboarding_completed: boolean | null
          owner_whatsapp: string | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          daily_briefing_enabled?: boolean
          daily_briefing_hour?: number
          default_tax_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_trial?: boolean | null
          logo_url?: string | null
          name: string
          notification_prefs?: Json | null
          onboarding_completed?: boolean | null
          owner_whatsapp?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          daily_briefing_enabled?: boolean
          daily_briefing_hour?: number
          default_tax_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_trial?: boolean | null
          logo_url?: string | null
          name?: string
          notification_prefs?: Json | null
          onboarding_completed?: boolean | null
          owner_whatsapp?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transaction_item_staff: {
        Row: {
          allocation_percent: number
          created_at: string
          id: string
          role_in_service: string | null
          staff_id: string
          transaction_item_id: string
        }
        Insert: {
          allocation_percent: number
          created_at?: string
          id?: string
          role_in_service?: string | null
          staff_id: string
          transaction_item_id: string
        }
        Update: {
          allocation_percent?: number
          created_at?: string
          id?: string
          role_in_service?: string | null
          staff_id?: string
          transaction_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_item_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_item_staff_transaction_item_id_fkey"
            columns: ["transaction_item_id"]
            isOneToOne: false
            referencedRelation: "transaction_items"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          id: string
          item_id: string | null
          item_name: string
          item_name_ar: string | null
          item_type: string
          quantity: number
          staff_commission_id: string | null
          total_price: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          item_id?: string | null
          item_name: string
          item_name_ar?: string | null
          item_type: string
          quantity?: number
          staff_commission_id?: string | null
          total_price: number
          transaction_id: string
          unit_price: number
        }
        Update: {
          id?: string
          item_id?: string | null
          item_name?: string
          item_name_ar?: string | null
          item_type?: string
          quantity?: number
          staff_commission_id?: string | null
          total_price?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_staff_commission_id_fkey"
            columns: ["staff_commission_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_payments: {
        Row: {
          amount: number
          id: string
          payer_index: number | null
          payer_label: string | null
          payment_method: Database["public"]["Enums"]["pos_payment_method"]
          transaction_id: string
        }
        Insert: {
          amount: number
          id?: string
          payer_index?: number | null
          payer_label?: string | null
          payment_method: Database["public"]["Enums"]["pos_payment_method"]
          transaction_id: string
        }
        Update: {
          amount?: number
          id?: string
          payer_index?: number | null
          payer_label?: string | null
          payment_method?: Database["public"]["Enums"]["pos_payment_method"]
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tip_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          staff_id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          staff_id: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          staff_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tip_allocations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tip_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tips: {
        Row: {
          amount: number
          created_at: string
          id: string
          staff_id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          staff_id: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          staff_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tips_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tips_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          booking_id: string | null
          client_id: string | null
          created_at: string
          discount_amount: number
          discount_approved_by: string | null
          discount_reason: string | null
          discount_type: string | null
          discount_value: number | null
          grand_total: number
          id: string
          notes: string | null
          staff_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          subtotal: number
          tax_amount: number
          tenant_id: string
          tip_amount: number
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          discount_amount?: number
          discount_approved_by?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          grand_total?: number
          id?: string
          notes?: string | null
          staff_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          tip_amount?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          discount_amount?: number
          discount_approved_by?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          grand_total?: number
          id?: string
          notes?: string | null
          staff_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          tip_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoices: {
        Row: {
          created_at: string
          currency: string
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_amount: number
          purchase_order_id: string | null
          status: Database["public"]["Enums"]["vendor_invoice_status"]
          supplier_id: string
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["vendor_invoice_status"]
          supplier_id: string
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["vendor_invoice_status"]
          supplier_id?: string
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["vendor_payment_method"]
          reference_number: string | null
          tenant_id: string
          vendor_invoice_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["vendor_payment_method"]
          reference_number?: string | null
          tenant_id: string
          vendor_invoice_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["vendor_payment_method"]
          reference_number?: string | null
          tenant_id?: string
          vendor_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_invoice_id_fkey"
            columns: ["vendor_invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_list: {
        Row: {
          booked_booking_id: string | null
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          id: string
          notes: string | null
          notified_at: string | null
          preferred_date: string | null
          preferred_time: string | null
          service_id: string | null
          service_name: string
          staff_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          booked_booking_id?: string | null
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          service_name: string
          staff_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          booked_booking_id?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          service_name?: string
          staff_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_booked_booking_id_fkey"
            columns: ["booked_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          account_id: string | null
          created_at: string
          error: string | null
          event_type: string | null
          id: number
          payload: Json
          processed: boolean
          provider: string
          tenant_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: number
          payload: Json
          processed?: boolean
          provider: string
          tenant_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: number
          payload?: Json
          processed?: boolean
          provider?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          access_token: string | null
          business_name: string | null
          connection_status: string | null
          created_at: string
          display_phone_number: string | null
          id: string
          is_enabled: boolean
          last_connected_at: string | null
          max_retry_attempts: number
          owner_phone_numbers: string[] | null
          phone_number_id: string | null
          staff_phone_numbers: string[] | null
          tenant_id: string
          updated_at: string
          voice_enabled: boolean
          waba_id: string | null
          webhook_verify_token: string | null
          welcome_message_ar: string | null
          welcome_message_en: string | null
        }
        Insert: {
          access_token?: string | null
          business_name?: string | null
          connection_status?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          is_enabled?: boolean
          last_connected_at?: string | null
          max_retry_attempts?: number
          owner_phone_numbers?: string[] | null
          phone_number_id?: string | null
          staff_phone_numbers?: string[] | null
          tenant_id: string
          updated_at?: string
          voice_enabled?: boolean
          waba_id?: string | null
          webhook_verify_token?: string | null
          welcome_message_ar?: string | null
          welcome_message_en?: string | null
        }
        Update: {
          access_token?: string | null
          business_name?: string | null
          connection_status?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          is_enabled?: boolean
          last_connected_at?: string | null
          max_retry_attempts?: number
          owner_phone_numbers?: string[] | null
          phone_number_id?: string | null
          staff_phone_numbers?: string[] | null
          tenant_id?: string
          updated_at?: string
          voice_enabled?: boolean
          waba_id?: string | null
          webhook_verify_token?: string | null
          welcome_message_ar?: string | null
          welcome_message_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          conversation_state: Json | null
          conversation_type: Database["public"]["Enums"]["whatsapp_conversation_type"]
          created_at: string
          id: string
          intervention_reason: string | null
          last_message_at: string
          needs_human_intervention: boolean
          phone_number: string
          tenant_id: string
        }
        Insert: {
          conversation_state?: Json | null
          conversation_type?: Database["public"]["Enums"]["whatsapp_conversation_type"]
          created_at?: string
          id?: string
          intervention_reason?: string | null
          last_message_at?: string
          needs_human_intervention?: boolean
          phone_number: string
          tenant_id: string
        }
        Update: {
          conversation_state?: Json | null
          conversation_type?: Database["public"]["Enums"]["whatsapp_conversation_type"]
          created_at?: string
          id?: string
          intervention_reason?: string | null
          last_message_at?: string
          needs_human_intervention?: boolean
          phone_number?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          conversation_id: string
          created_at: string
          detected_language:
            | Database["public"]["Enums"]["whatsapp_detected_language"]
            | null
          direction: Database["public"]["Enums"]["whatsapp_message_direction"]
          id: string
          message_content: string
          message_type: Database["public"]["Enums"]["whatsapp_message_type"]
          metadata: Json | null
          original_audio_url: string | null
          transcription: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          detected_language?:
            | Database["public"]["Enums"]["whatsapp_detected_language"]
            | null
          direction: Database["public"]["Enums"]["whatsapp_message_direction"]
          id?: string
          message_content: string
          message_type?: Database["public"]["Enums"]["whatsapp_message_type"]
          metadata?: Json | null
          original_audio_url?: string | null
          transcription?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          detected_language?:
            | Database["public"]["Enums"]["whatsapp_detected_language"]
            | null
          direction?: Database["public"]["Enums"]["whatsapp_message_direction"]
          id?: string
          message_content?: string
          message_type?: Database["public"]["Enums"]["whatsapp_message_type"]
          metadata?: Json | null
          original_audio_url?: string | null
          transcription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_ar: string | null
          body_en: string
          buttons: Json | null
          category: string
          created_at: string
          footer_text: string | null
          header_content: string | null
          header_type: string | null
          id: string
          is_active: boolean
          meta_status: string | null
          meta_template_id: string | null
          name: string
          template_name: string | null
          tenant_id: string
          trigger_event: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body_ar?: string | null
          body_en: string
          buttons?: Json | null
          category?: string
          created_at?: string
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean
          meta_status?: string | null
          meta_template_id?: string | null
          name: string
          template_name?: string | null
          tenant_id: string
          trigger_event: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body_ar?: string | null
          body_en?: string
          buttons?: Json | null
          category?: string
          created_at?: string
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean
          meta_status?: string | null
          meta_template_id?: string | null
          name?: string
          template_name?: string | null
          tenant_id?: string
          trigger_event?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_triggers: {
        Row: {
          conditions: Json | null
          created_at: string
          delay_minutes: number
          event: string
          id: string
          is_enabled: boolean
          target_audience: string
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          delay_minutes?: number
          event: string
          id?: string
          is_enabled?: boolean
          target_audience?: string
          template_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          delay_minutes?: number
          event?: string
          id?: string
          is_enabled?: boolean
          target_audience?: string
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_triggers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_triggers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      consumption_variance_v1: {
        Row: {
          actual_qty: number | null
          booking_id: string | null
          expected_qty: number | null
          id: string | null
          product_id: string | null
          product_name: string | null
          recorded_at: string | null
          service_id: string | null
          service_name: string | null
          staff_id: string | null
          staff_name: string | null
          tenant_id: string | null
          unit_of_measure: string | null
          variance_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_consumption_actuals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_consumption_actuals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_consumption_actuals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_consumption_actuals_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_consumption_actuals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_payers_v1: {
        Row: {
          payer_index: number | null
          payer_label: string | null
          payer_total: number | null
          payment_count: number | null
          payment_ids: string[] | null
          payment_methods:
            | Database["public"]["Enums"]["pos_payment_method"][]
            | null
          transaction_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tip_rollup_v1: {
        Row: {
          staff_id: string | null
          staff_name: string | null
          tip_total: number | null
          transaction_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tips_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tips_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_variance_v1: {
        Row: {
          captures: number | null
          product_id: string | null
          product_name: string | null
          tenant_id: string | null
          total_actual: number | null
          total_expected: number | null
          total_variance: number | null
          variance_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_actual_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_actual_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      count_tenant_users: { Args: { p_tenant_id: string }; Returns: number }
      current_salon_id: { Args: never; Returns: string }
      find_similar_clients: {
        Args: {
          p_email?: string
          p_limit?: number
          p_name?: string
          p_phone?: string
        }
        Returns: {
          email: string
          id: string
          match_reason: string
          name: string
          phone: string
          similarity: number
        }[]
      }
      get_effective_price: {
        Args: { p_at?: string; p_service_id: string }
        Returns: number
      }
      get_hours_worked: {
        Args: { p_break_min?: number; p_clock_in: string; p_clock_out: string }
        Returns: number
      }
      get_plan_user_limit: { Args: { p_plan: string }; Returns: number }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      merge_clients: {
        Args: { p_duplicate: string; p_primary: string }
        Returns: Json
      }
      seed_salon_chart_of_accounts: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      validate_promo_code: {
        Args: { p_code: string; p_subtotal: number; p_tenant_id: string }
        Returns: {
          discount_amount: number
          discount_type: string
          discount_value: number
          promo_id: string
          promo_name: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "manager"
        | "receptionist"
        | "cashier"
        | "stylist"
        | "inventory_clerk"
        | "accountant"
        | "readonly"
        | "super_admin"
      booking_status:
        | "planned"
        | "confirmed"
        | "checked_in"
        | "in_service"
        | "completed"
        | "cancelled"
        | "no_show"
      inventory_transaction_type:
        | "purchase_receipt"
        | "service_consumption"
        | "retail_sale"
        | "adjustment"
        | "wastage"
        | "return"
      payment_status: "pending" | "paid" | "failed" | "refunded" | "partial"
      po_sent_via: "email" | "whatsapp" | "manual"
      po_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "sent"
        | "partially_received"
        | "received"
        | "cancelled"
      pos_payment_method: "cash" | "knet" | "credit_card" | "gift_card"
      product_type: "professional" | "retail" | "both"
      service_category:
        | "hair"
        | "nails"
        | "facial"
        | "makeup"
        | "waxing"
        | "massage"
        | "other"
      stock_take_entry_status: "pending" | "counted" | "recounting" | "accepted"
      stock_take_scope:
        | "full_store"
        | "retail_only"
        | "professional_only"
        | "category"
      stock_take_status: "open" | "in_progress" | "reviewing" | "completed"
      stock_take_variance_reason:
        | "theft"
        | "broken"
        | "expired"
        | "data_entry_error"
        | "supplier_shortage"
        | "unrecorded_sale"
        | "other"
      subscription_plan: "starter" | "professional" | "ai"
      transaction_status: "completed" | "refunded" | "voided"
      vendor_invoice_status:
        | "pending"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "disputed"
      vendor_payment_method: "cash" | "bank_transfer" | "cheque" | "knet"
      whatsapp_conversation_type: "customer" | "admin"
      whatsapp_detected_language: "en" | "ar"
      whatsapp_message_direction: "inbound" | "outbound"
      whatsapp_message_type:
        | "text"
        | "voice"
        | "booking_offer"
        | "report"
        | "handoff"
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
      app_role: [
        "owner",
        "manager",
        "receptionist",
        "cashier",
        "stylist",
        "inventory_clerk",
        "accountant",
        "readonly",
        "super_admin",
      ],
      booking_status: [
        "planned",
        "confirmed",
        "checked_in",
        "in_service",
        "completed",
        "cancelled",
        "no_show",
      ],
      inventory_transaction_type: [
        "purchase_receipt",
        "service_consumption",
        "retail_sale",
        "adjustment",
        "wastage",
        "return",
      ],
      payment_status: ["pending", "paid", "failed", "refunded", "partial"],
      po_sent_via: ["email", "whatsapp", "manual"],
      po_status: [
        "draft",
        "pending_approval",
        "approved",
        "sent",
        "partially_received",
        "received",
        "cancelled",
      ],
      pos_payment_method: ["cash", "knet", "credit_card", "gift_card"],
      product_type: ["professional", "retail", "both"],
      service_category: [
        "hair",
        "nails",
        "facial",
        "makeup",
        "waxing",
        "massage",
        "other",
      ],
      stock_take_entry_status: ["pending", "counted", "recounting", "accepted"],
      stock_take_scope: [
        "full_store",
        "retail_only",
        "professional_only",
        "category",
      ],
      stock_take_status: ["open", "in_progress", "reviewing", "completed"],
      stock_take_variance_reason: [
        "theft",
        "broken",
        "expired",
        "data_entry_error",
        "supplier_shortage",
        "unrecorded_sale",
        "other",
      ],
      subscription_plan: ["starter", "professional", "ai"],
      transaction_status: ["completed", "refunded", "voided"],
      vendor_invoice_status: [
        "pending",
        "partially_paid",
        "paid",
        "overdue",
        "disputed",
      ],
      vendor_payment_method: ["cash", "bank_transfer", "cheque", "knet"],
      whatsapp_conversation_type: ["customer", "admin"],
      whatsapp_detected_language: ["en", "ar"],
      whatsapp_message_direction: ["inbound", "outbound"],
      whatsapp_message_type: [
        "text",
        "voice",
        "booking_offer",
        "report",
        "handoff",
      ],
    },
  },
} as const
