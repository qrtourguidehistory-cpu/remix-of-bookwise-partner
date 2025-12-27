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
      appointment_notifications: {
        Row: {
          appointment_id: string | null
          business_id: string
          created_at: string | null
          id: string
          meta: Json | null
          notification_type: string
          send_at: string | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          notification_type: string
          send_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          notification_type?: string
          send_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "appointment_notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_requests: {
        Row: {
          appointment_id: string
          business_id: string
          client_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          message: string | null
          original_end_time: string | null
          original_start_time: string | null
          proposed_end_time: string | null
          proposed_start_time: string | null
          request_type: string
          responded_at: string | null
          response_message: string | null
          staff_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          appointment_id: string
          business_id: string
          client_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          original_end_time?: string | null
          original_start_time?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          request_type?: string
          responded_at?: string | null
          response_message?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string
          business_id?: string
          client_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          original_end_time?: string | null
          original_start_time?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          request_type?: string
          responded_at?: string | null
          response_message?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "appointment_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_settings: {
        Row: {
          allow_same_day_booking: boolean
          buffer_minutes: number
          business_id: string
          cancellation_policy: string | null
          created_at: string
          deposit_percentage: number | null
          id: string
          max_advance_booking_days: number
          min_advance_booking_hours: number
          require_deposit: boolean
          slot_duration_minutes: number
          updated_at: string
        }
        Insert: {
          allow_same_day_booking?: boolean
          buffer_minutes?: number
          business_id: string
          cancellation_policy?: string | null
          created_at?: string
          deposit_percentage?: number | null
          id?: string
          max_advance_booking_days?: number
          min_advance_booking_hours?: number
          require_deposit?: boolean
          slot_duration_minutes?: number
          updated_at?: string
        }
        Update: {
          allow_same_day_booking?: boolean
          buffer_minutes?: number
          business_id?: string
          cancellation_policy?: string | null
          created_at?: string
          deposit_percentage?: number | null
          id?: string
          max_advance_booking_days?: number
          min_advance_booking_hours?: number
          require_deposit?: boolean
          slot_duration_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "appointment_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          business_id: string | null
          client_id: string
          created_at: string | null
          end_time: string
          id: string
          inventory_used: Json | null
          notes: string | null
          payment_amount: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          service_id: string
          staff_id: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          business_id?: string | null
          client_id: string
          created_at?: string | null
          end_time: string
          id?: string
          inventory_used?: Json | null
          notes?: string | null
          payment_amount?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          service_id: string
          staff_id: string
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          business_id?: string | null
          client_id?: string
          created_at?: string | null
          end_time?: string
          id?: string
          inventory_used?: Json | null
          notes?: string | null
          payment_amount?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          service_id?: string
          staff_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      business_approval_requests: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          notes: string | null
          owner_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_approval_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_approval_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "business_approval_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          business_id: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_open: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          business_id?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_open?: boolean | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          business_id?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_open?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          account_type: string
          address: string | null
          approval_status: string | null
          average_rating: number | null
          business_name: string
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          latitude: number | null
          locale_settings: Json | null
          location_details: Json | null
          logo_url: string | null
          longitude: number | null
          onboarding_completed: boolean | null
          owner_id: string
          phone: string | null
          primary_category: string
          secondary_categories: string[] | null
          service_type: string
          slug: string | null
          team_size: string
          theme_settings: Json | null
          total_reviews: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          account_type: string
          address?: string | null
          approval_status?: string | null
          average_rating?: number | null
          business_name: string
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          latitude?: number | null
          locale_settings?: Json | null
          location_details?: Json | null
          logo_url?: string | null
          longitude?: number | null
          onboarding_completed?: boolean | null
          owner_id: string
          phone?: string | null
          primary_category: string
          secondary_categories?: string[] | null
          service_type: string
          slug?: string | null
          team_size: string
          theme_settings?: Json | null
          total_reviews?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          account_type?: string
          address?: string | null
          approval_status?: string | null
          average_rating?: number | null
          business_name?: string
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          latitude?: number | null
          locale_settings?: Json | null
          location_details?: Json | null
          logo_url?: string | null
          longitude?: number | null
          onboarding_completed?: boolean | null
          owner_id?: string
          phone?: string | null
          primary_category?: string
          secondary_categories?: string[] | null
          service_type?: string
          slug?: string | null
          team_size?: string
          theme_settings?: Json | null
          total_reviews?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      client_notifications: {
        Row: {
          action_url: string | null
          appointment_id: string | null
          business_id: string | null
          client_id: string | null
          created_at: string | null
          id: string
          message: string
          meta: Json | null
          read: boolean | null
          request_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          appointment_id?: string | null
          business_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          meta?: Json | null
          read?: boolean | null
          request_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          appointment_id?: string | null
          business_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          meta?: Json | null
          read?: boolean | null
          request_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "client_notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "appointment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          allergy_notes: string | null
          blocked_at: string | null
          blocked_reason: string | null
          business_id: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_blocked: boolean | null
          notes: string | null
          phone: string | null
          total_bookings: number | null
          total_spent: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          allergy_notes?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          business_id?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_blocked?: boolean | null
          notes?: string | null
          phone?: string | null
          total_bookings?: number | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          allergy_notes?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          business_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_blocked?: boolean | null
          notes?: string | null
          phone?: string | null
          total_bookings?: number | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_configs: {
        Row: {
          business_id: string
          commission_percentage: number
          created_at: string | null
          id: string
          service_id: string | null
          staff_id: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          commission_percentage: number
          created_at?: string | null
          id?: string
          service_id?: string | null
          staff_id: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          commission_percentage?: number
          created_at?: string | null
          id?: string
          service_id?: string | null
          staff_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_configs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_configs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "commission_configs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_configs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_configs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payments: {
        Row: {
          business_id: string
          commission_amount: number
          created_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          period_end: string
          period_start: string
          staff_id: string
          status: string
          total_sales: number
          updated_at: string | null
        }
        Insert: {
          business_id: string
          commission_amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end: string
          period_start: string
          staff_id: string
          status?: string
          total_sales?: number
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          commission_amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string
          period_start?: string
          staff_id?: string
          status?: string
          total_sales?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "commission_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          business_id: string
          category: string | null
          cost_price: number | null
          created_at: string | null
          current_stock: number
          description: string | null
          id: string
          is_active: boolean | null
          min_stock_level: number
          name: string
          sku: string | null
          supplier: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          business_id: string
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          min_stock_level?: number
          name: string
          sku?: string | null
          supplier?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          min_stock_level?: number
          name?: string
          sku?: string | null
          supplier?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "inventory_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          inventory_id: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          staff_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          inventory_id: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          staff_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          inventory_id?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          business_id: string
          confirmation_channels: string[] | null
          confirmation_enabled: boolean | null
          created_at: string | null
          id: string
          reminder_channels: string[] | null
          reminder_enabled: boolean | null
          reminder_hours_before: number[] | null
          review_request_delay_days: number | null
          review_request_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          confirmation_channels?: string[] | null
          confirmation_enabled?: boolean | null
          created_at?: string | null
          id?: string
          reminder_channels?: string[] | null
          reminder_enabled?: boolean | null
          reminder_hours_before?: number[] | null
          review_request_delay_days?: number | null
          review_request_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          confirmation_channels?: string[] | null
          confirmation_enabled?: boolean | null
          created_at?: string | null
          id?: string
          reminder_channels?: string[] | null
          reminder_enabled?: boolean | null
          reminder_hours_before?: number[] | null
          review_request_delay_days?: number | null
          review_request_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "notification_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          business_id: string
          created_at: string | null
          icon: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "payment_methods_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
          onboarding_step: number | null
          phone: string | null
          push_token: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          onboarding_step?: number | null
          phone?: string | null
          push_token?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          onboarding_step?: number | null
          phone?: string | null
          push_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          admin_response: string | null
          appointment_id: string
          business_id: string | null
          client_id: string
          comment: string | null
          created_at: string | null
          id: string
          is_addressed: boolean | null
          rating: number
          service_id: string
          staff_id: string
        }
        Insert: {
          admin_response?: string | null
          appointment_id: string
          business_id?: string | null
          client_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_addressed?: boolean | null
          rating: number
          service_id: string
          staff_id: string
        }
        Update: {
          admin_response?: string | null
          appointment_id?: string
          business_id?: string | null
          client_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_addressed?: boolean | null
          rating?: number
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          business_id: string | null
          client_id: string | null
          client_name: string
          client_type: string
          created_at: string
          id: string
          inventory_used: Json | null
          notes: string | null
          payment_method: string | null
          price_mxn: number
          price_usd: number
          sale_date: string
          sale_time: string
          service_id: string | null
          service_name: string
          staff_id: string | null
          tip_amount: number | null
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          client_id?: string | null
          client_name: string
          client_type: string
          created_at?: string
          id?: string
          inventory_used?: Json | null
          notes?: string | null
          payment_method?: string | null
          price_mxn?: number
          price_usd?: number
          sale_date?: string
          sale_time?: string
          service_id?: string | null
          service_name: string
          staff_id?: string | null
          tip_amount?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          client_id?: string | null
          client_name?: string
          client_type?: string
          created_at?: string
          id?: string
          inventory_used?: Json | null
          notes?: string | null
          payment_method?: string | null
          price_mxn?: number
          price_usd?: number
          sale_date?: string
          sale_time?: string
          service_id?: string | null
          service_name?: string
          staff_id?: string | null
          tip_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string | null
          category: string
          created_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          price_mxn: number | null
          price_usd: number | null
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          duration_minutes: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          price_mxn?: number | null
          price_usd?: number | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          price_mxn?: number | null
          price_usd?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          appointment_id: string | null
          business_id: string
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          phone_number: string
          status: string
          twilio_sid: string | null
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          phone_number: string
          status?: string
          twilio_sid?: string | null
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          phone_number?: string
          status?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "sms_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          business_id: string
          confirmation: string | null
          created_at: string | null
          id: string
          reminder_1h: string | null
          reminder_24h: string | null
          review_request: string | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          confirmation?: string | null
          created_at?: string | null
          id?: string
          reminder_1h?: string | null
          reminder_24h?: string | null
          review_request?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          confirmation?: string | null
          created_at?: string | null
          id?: string
          reminder_1h?: string | null
          reminder_24h?: string | null
          review_request?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "sms_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          avatar_url: string | null
          bio: string | null
          business_id: string | null
          commission_rate: number | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          specialties: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          business_id?: string | null
          commission_rate?: number | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          business_id?: string | null
          commission_rate?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_early_departures: {
        Row: {
          actual_end_time: string
          created_at: string | null
          departure_date: string
          id: string
          original_end_time: string
          reason: string | null
          staff_id: string
          updated_at: string | null
        }
        Insert: {
          actual_end_time: string
          created_at?: string | null
          departure_date: string
          id?: string
          original_end_time: string
          reason?: string | null
          staff_id: string
          updated_at?: string | null
        }
        Update: {
          actual_end_time?: string
          created_at?: string | null
          departure_date?: string
          id?: string
          original_end_time?: string
          reason?: string | null
          staff_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_early_departures_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          break_end: string | null
          break_notes: string | null
          break_start: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          staff_id: string
          start_time: string
        }
        Insert: {
          break_end?: string | null
          break_notes?: string | null
          break_start?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          staff_id: string
          start_time: string
        }
        Update: {
          break_end?: string | null
          break_notes?: string | null
          break_start?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          staff_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      staff_time_off: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          reason: string | null
          staff_id: string
          start_date: string
          time_off_type: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          reason?: string | null
          staff_id: string
          start_date: string
          time_off_type?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          staff_id?: string
          start_date?: string
          time_off_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_off_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          business_id: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string | null
          token: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["establishment_id"]
          },
          {
            foreignKeyName: "user_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      establishments: {
        Row: {
          address: string | null
          average_rating: number | null
          category: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          establishment_id: string | null
          id: string | null
          is_public: boolean | null
          location_details: Json | null
          main_image: string | null
          name: string | null
          owner_id: string | null
          phone: string | null
          secondary_categories: string[] | null
          service_type: string | null
          slug: string | null
          total_reviews: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          average_rating?: number | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          establishment_id?: string | null
          id?: string | null
          is_public?: boolean | null
          location_details?: Json | null
          main_image?: string | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          secondary_categories?: string[] | null
          service_type?: string | null
          slug?: string | null
          total_reviews?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          average_rating?: number | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          establishment_id?: string | null
          id?: string | null
          is_public?: boolean | null
          location_details?: Json | null
          main_image?: string | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          secondary_categories?: string[] | null
          service_type?: string | null
          slug?: string | null
          total_reviews?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_early_arrival_request: {
        Args: {
          p_appointment_id: string
          p_business_id: string
          p_staff_id?: string
        }
        Returns: Json
      }
      get_user_business_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      respond_to_early_arrival_request: {
        Args: { p_request_id: string; p_response: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "staff"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
        | "started"
        | "arrived"
      payment_method: "cash" | "card" | "online"
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
      app_role: ["admin", "manager", "staff"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
        "started",
        "arrived",
      ],
      payment_method: ["cash", "card", "online"],
    },
  },
} as const
