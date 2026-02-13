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
      bookings: {
        Row: {
          booking_date: string
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
          price: number
          service_category: Database["public"]["Enums"]["service_category"]
          service_id: string | null
          service_name: string
          staff_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          booking_date: string
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
          price?: number
          service_category?: Database["public"]["Enums"]["service_category"]
          service_id?: string | null
          service_name: string
          staff_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          booking_date?: string
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
          price?: number
          service_category?: Database["public"]["Enums"]["service_category"]
          service_id?: string | null
          service_name?: string
          staff_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
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
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
      tenants: {
        Row: {
          created_at: string | null
          currency: string | null
          default_tax_rate: number | null
          id: string
          is_active: boolean | null
          is_trial: boolean | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          default_tax_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_trial?: boolean | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          default_tax_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_trial?: boolean | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      whatsapp_config: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          max_retry_attempts: number
          owner_phone_numbers: string[] | null
          staff_phone_numbers: string[] | null
          tenant_id: string
          updated_at: string
          voice_enabled: boolean
          welcome_message_ar: string | null
          welcome_message_en: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_retry_attempts?: number
          owner_phone_numbers?: string[] | null
          staff_phone_numbers?: string[] | null
          tenant_id: string
          updated_at?: string
          voice_enabled?: boolean
          welcome_message_ar?: string | null
          welcome_message_en?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_retry_attempts?: number
          owner_phone_numbers?: string[] | null
          staff_phone_numbers?: string[] | null
          tenant_id?: string
          updated_at?: string
          voice_enabled?: boolean
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
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
      product_type: "professional" | "retail" | "both"
      service_category:
        | "hair"
        | "nails"
        | "facial"
        | "makeup"
        | "waxing"
        | "massage"
        | "other"
      subscription_plan: "starter" | "professional" | "ai"
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
      subscription_plan: ["starter", "professional", "ai"],
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
