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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          metadata: Json | null
          notification_type: string
          read_by: Json | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          notification_type: string
          read_by?: Json | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_by?: Json | null
          title?: string
        }
        Relationships: []
      }
      banks: {
        Row: {
          code: string
          country: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          country?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          country?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cached_balances: {
        Row: {
          deposit_balance: number
          earnings_balance: number
          id: string
          last_updated: string
          pending_balance: number
          user_id: string
        }
        Insert: {
          deposit_balance?: number
          earnings_balance?: number
          id?: string
          last_updated?: string
          pending_balance?: number
          user_id: string
        }
        Update: {
          deposit_balance?: number
          earnings_balance?: number
          id?: string
          last_updated?: string
          pending_balance?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comparison_broken_reports: {
        Row: {
          created_at: string
          id: string
          image_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_id?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparison_broken_reports_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "comparison_images"
            referencedColumns: ["id"]
          },
        ]
      }
      comparison_categories: {
        Row: {
          created_at: string
          emoji_free_label: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          emoji_free_label: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          emoji_free_label?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      comparison_images: {
        Row: {
          category_slug: string
          created_at: string
          id: string
          image_url: string
          is_dead: boolean
          provider: string
          source_prompt: string | null
        }
        Insert: {
          category_slug: string
          created_at?: string
          id?: string
          image_url: string
          is_dead?: boolean
          provider?: string
          source_prompt?: string | null
        }
        Update: {
          category_slug?: string
          created_at?: string
          id?: string
          image_url?: string
          is_dead?: boolean
          provider?: string
          source_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparison_images_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "comparison_categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      comparison_seen_log: {
        Row: {
          image_id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          image_id: string
          seen_at?: string
          user_id: string
        }
        Update: {
          image_id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_task: {
        Row: {
          batches_done: number
          bonus_batches: number
          created_at: string
          id: string
          metadata: Json
          task_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batches_done?: number
          bonus_batches?: number
          created_at?: string
          id?: string
          metadata?: Json
          task_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batches_done?: number
          bonus_batches?: number
          created_at?: string
          id?: string
          metadata?: Json
          task_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drop_fill_audit_log: {
        Row: {
          amount: number | null
          created_at: string
          drop_id: string | null
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          origin_drop_id: string | null
          owner_id: string | null
          owner_name: string | null
          payout_made: boolean | null
          position: number | null
          reentry_created: boolean | null
          spot_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          drop_id?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          origin_drop_id?: string | null
          owner_id?: string | null
          owner_name?: string | null
          payout_made?: boolean | null
          position?: number | null
          reentry_created?: boolean | null
          spot_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          drop_id?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          origin_drop_id?: string | null
          owner_id?: string | null
          owner_name?: string | null
          payout_made?: boolean | null
          position?: number | null
          reentry_created?: boolean | null
          spot_id?: string | null
        }
        Relationships: []
      }
      drop_pulses: {
        Row: {
          completed_at: string | null
          id: string
          new_drops_processed: number | null
          payouts_made: number | null
          pulse_number: number
          re_entries_processed: number | null
          started_at: string
          status: string
          total_distributed: number | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          new_drops_processed?: number | null
          payouts_made?: number | null
          pulse_number: number
          re_entries_processed?: number | null
          started_at?: string
          status?: string
          total_distributed?: number | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          new_drops_processed?: number | null
          payouts_made?: number | null
          pulse_number?: number
          re_entries_processed?: number | null
          started_at?: string
          status?: string
          total_distributed?: number | null
        }
        Relationships: []
      }
      drops: {
        Row: {
          completed_at: string | null
          created_at: string
          fill_amount: number
          id: string
          is_settled: boolean
          paid_at: string | null
          position: number
          source_type: string
          spot_id: string
          status: string
          target_amount: number
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          fill_amount?: number
          id?: string
          is_settled?: boolean
          paid_at?: string | null
          position: number
          source_type?: string
          spot_id: string
          status?: string
          target_amount?: number
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          fill_amount?: number
          id?: string
          is_settled?: boolean
          paid_at?: string | null
          position?: number
          source_type?: string
          spot_id?: string
          status?: string
          target_amount?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drops_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      harvest_warnings: {
        Row: {
          created_at: string
          id: string
          spot_id: string
          user_id: string
          warn_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          spot_id: string
          user_id: string
          warn_date: string
        }
        Update: {
          created_at?: string
          id?: string
          spot_id?: string
          user_id?: string
          warn_date?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          amount: number
          created_at: string
          flutterwave_id: string | null
          id: string
          metadata: Json | null
          provider: string
          purpose: string
          sender_account_number: string | null
          sender_bank_code: string | null
          sender_bank_name: string | null
          status: string
          tx_ref: string
          unique_amount: number | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          flutterwave_id?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          purpose: string
          sender_account_number?: string | null
          sender_bank_code?: string | null
          sender_bank_name?: string | null
          status?: string
          tx_ref: string
          unique_amount?: number | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          flutterwave_id?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          purpose?: string
          sender_account_number?: string | null
          sender_bank_code?: string | null
          sender_bank_name?: string | null
          status?: string
          tx_ref?: string
          unique_amount?: number | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_restore_intents: {
        Row: {
          base_fee: number
          count: number
          created_at: string
          expires_at: string
          extra_fee: number
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_fee?: number
          count: number
          created_at?: string
          expires_at?: string
          extra_fee?: number
          total_cost: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_fee?: number
          count?: number
          created_at?: string
          expires_at?: string
          extra_fee?: number
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          admin_alert_email: string | null
          ai_support_enabled: boolean
          distribution_active: boolean | null
          drop_admin_fee: number
          drop_entry_fee: number
          drop_profit_amount: number
          drop_profit_amount_subsequent: number | null
          drop_pulse_interval_seconds: number
          drop_queue_contribution: number
          drop_reentry_amount: number
          drop_referral_per_cycle: number
          drop_system_active: boolean
          drop_target_amount: number
          emails_enabled: boolean
          explainer_video_aspect: number | null
          explainer_video_duration_seconds: number | null
          explainer_video_path: string | null
          explainer_video_poster_path: string | null
          explainer_video_poster_url: string | null
          explainer_video_required_percent: number
          explainer_video_updated_at: string | null
          explainer_video_url: string | null
          id: number
          invite_access_key: string
          maintenance_mode: boolean
          manual_withdrawal_mode: boolean
          max_auto_buys_per_pulse: number
          membership_fee: number
          minimum_withdrawal: number
          moniepoint_account_name: string | null
          moniepoint_account_number: string | null
          moniepoint_bank_name: string
          payment_provider: string
          platform_fee_percentage: number
          referral_cash_bonus: number
          referral_payout_trigger: string | null
          referral_pending_bonus: number
          task_batches_per_day: number
          task_enabled: boolean
          task_loader_seconds: number
          task_naira_per_batch: number
          task_referral_bonus_batches: number
          task_taps_per_batch: number
          telegram_alerts_enabled: boolean
          updated_at: string
          whatsapp_group_link: string | null
          whatsapp_group_promo_enabled: boolean
          withdrawal_fee: number
          withdrawals_enabled: boolean
        }
        Insert: {
          admin_alert_email?: string | null
          ai_support_enabled?: boolean
          distribution_active?: boolean | null
          drop_admin_fee?: number
          drop_entry_fee?: number
          drop_profit_amount?: number
          drop_profit_amount_subsequent?: number | null
          drop_pulse_interval_seconds?: number
          drop_queue_contribution?: number
          drop_reentry_amount?: number
          drop_referral_per_cycle?: number
          drop_system_active?: boolean
          drop_target_amount?: number
          emails_enabled?: boolean
          explainer_video_aspect?: number | null
          explainer_video_duration_seconds?: number | null
          explainer_video_path?: string | null
          explainer_video_poster_path?: string | null
          explainer_video_poster_url?: string | null
          explainer_video_required_percent?: number
          explainer_video_updated_at?: string | null
          explainer_video_url?: string | null
          id?: number
          invite_access_key?: string
          maintenance_mode?: boolean
          manual_withdrawal_mode?: boolean
          max_auto_buys_per_pulse?: number
          membership_fee?: number
          minimum_withdrawal?: number
          moniepoint_account_name?: string | null
          moniepoint_account_number?: string | null
          moniepoint_bank_name?: string
          payment_provider?: string
          platform_fee_percentage?: number
          referral_cash_bonus?: number
          referral_payout_trigger?: string | null
          referral_pending_bonus?: number
          task_batches_per_day?: number
          task_enabled?: boolean
          task_loader_seconds?: number
          task_naira_per_batch?: number
          task_referral_bonus_batches?: number
          task_taps_per_batch?: number
          telegram_alerts_enabled?: boolean
          updated_at?: string
          whatsapp_group_link?: string | null
          whatsapp_group_promo_enabled?: boolean
          withdrawal_fee?: number
          withdrawals_enabled?: boolean
        }
        Update: {
          admin_alert_email?: string | null
          ai_support_enabled?: boolean
          distribution_active?: boolean | null
          drop_admin_fee?: number
          drop_entry_fee?: number
          drop_profit_amount?: number
          drop_profit_amount_subsequent?: number | null
          drop_pulse_interval_seconds?: number
          drop_queue_contribution?: number
          drop_reentry_amount?: number
          drop_referral_per_cycle?: number
          drop_system_active?: boolean
          drop_target_amount?: number
          emails_enabled?: boolean
          explainer_video_aspect?: number | null
          explainer_video_duration_seconds?: number | null
          explainer_video_path?: string | null
          explainer_video_poster_path?: string | null
          explainer_video_poster_url?: string | null
          explainer_video_required_percent?: number
          explainer_video_updated_at?: string | null
          explainer_video_url?: string | null
          id?: number
          invite_access_key?: string
          maintenance_mode?: boolean
          manual_withdrawal_mode?: boolean
          max_auto_buys_per_pulse?: number
          membership_fee?: number
          minimum_withdrawal?: number
          moniepoint_account_name?: string | null
          moniepoint_account_number?: string | null
          moniepoint_bank_name?: string
          payment_provider?: string
          platform_fee_percentage?: number
          referral_cash_bonus?: number
          referral_payout_trigger?: string | null
          referral_pending_bonus?: number
          task_batches_per_day?: number
          task_enabled?: boolean
          task_loader_seconds?: number
          task_naira_per_batch?: number
          task_referral_bonus_batches?: number
          task_taps_per_batch?: number
          telegram_alerts_enabled?: boolean
          updated_at?: string
          whatsapp_group_link?: string | null
          whatsapp_group_promo_enabled?: boolean
          withdrawal_fee?: number
          withdrawals_enabled?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activated_at: string | null
          auto_compound_enabled: boolean | null
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          birth_month: number | null
          birth_year: number | null
          created_at: string
          full_name: string
          has_seen_explainer: boolean
          id: string
          is_banned: boolean
          is_member: boolean
          is_name_locked: boolean
          last_payout_at: string | null
          last_seen_at: string | null
          metadata: Json | null
          phone_number: string | null
          referral_code: string
          referred_by_code: string | null
          state_of_residence: string | null
        }
        Insert: {
          activated_at?: string | null
          auto_compound_enabled?: boolean | null
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          full_name: string
          has_seen_explainer?: boolean
          id: string
          is_banned?: boolean
          is_member?: boolean
          is_name_locked?: boolean
          last_payout_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          phone_number?: string | null
          referral_code: string
          referred_by_code?: string | null
          state_of_residence?: string | null
        }
        Update: {
          activated_at?: string | null
          auto_compound_enabled?: boolean | null
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          full_name?: string
          has_seen_explainer?: boolean
          id?: string
          is_banned?: boolean
          is_member?: boolean
          is_name_locked?: boolean
          last_payout_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          phone_number?: string | null
          referral_code?: string
          referred_by_code?: string | null
          state_of_residence?: string | null
        }
        Relationships: []
      }
      referral_bonus_grants: {
        Row: {
          bonus_batches_granted: number
          created_at: string
          grant_date: string
          id: string
          referee_id: string
          referrer_id: string
        }
        Insert: {
          bonus_batches_granted?: number
          created_at?: string
          grant_date: string
          id?: string
          referee_id: string
          referrer_id: string
        }
        Update: {
          bonus_batches_granted?: number
          created_at?: string
          grant_date?: string
          id?: string
          referee_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      spots: {
        Row: {
          created_at: string
          id: string
          is_extension: boolean
          spot_name: string
          status: string
          total_cycles: number
          total_earnings: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_extension?: boolean
          spot_name?: string
          status?: string
          total_cycles?: number
          total_earnings?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_extension?: boolean
          spot_name?: string
          status?: string
          total_cycles?: number
          total_earnings?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          id: string
          metadata: Json | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          id: string
          message: string
          metadata: Json | null
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          severity?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          severity?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          message: string
          metadata: Json | null
          read_at: string | null
          sender_id: string
          sender_type: Database["public"]["Enums"]["ticket_sender_type"]
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          message: string
          metadata?: Json | null
          read_at?: string | null
          sender_id: string
          sender_type: Database["public"]["Enums"]["ticket_sender_type"]
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string
          metadata?: Json | null
          read_at?: string | null
          sender_id?: string
          sender_type?: Database["public"]["Enums"]["ticket_sender_type"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          metadata: Json | null
          payment_reference: string | null
          read_at: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          payment_reference?: string | null
          read_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          payment_reference?: string | null
          read_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unmatched_moniepoint_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          raw_payload: Json
          reason: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          resolved_user_id: string | null
          sender_account_name: string | null
          sender_account_number: string | null
          sender_bank_name: string | null
          transaction_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          raw_payload?: Json
          reason: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_user_id?: string | null
          sender_account_name?: string | null
          sender_account_number?: string | null
          sender_bank_name?: string | null
          transaction_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          raw_payload?: Json
          reason?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_user_id?: string | null
          sender_account_name?: string | null
          sender_account_number?: string | null
          sender_bank_name?: string | null
          transaction_reference?: string | null
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          action_detail: string | null
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          page_name: string
          page_path: string
          session_id: string
          user_id: string
        }
        Insert: {
          action_detail?: string | null
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          page_name: string
          page_path: string
          session_id: string
          user_id: string
        }
        Update: {
          action_detail?: string | null
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          page_name?: string
          page_path?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pin_secrets: {
        Row: {
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tour_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: string
          history: Json
          is_completed: boolean
          last_step_at: string
          picks_guided: number
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: string
          history?: Json
          is_completed?: boolean
          last_step_at?: string
          picks_guided?: number
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: string
          history?: Json
          is_completed?: boolean
          last_step_at?: string
          picks_guided?: number
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          processed_successfully: boolean | null
          signature: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_data: Json
          event_type: string
          id?: string
          processed_successfully?: boolean | null
          signature?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          processed_successfully?: boolean | null
          signature?: string | null
        }
        Relationships: []
      }
      withdrawal_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string | null
          bank_name: string
          created_at: string
          id: string
          is_primary: boolean
          is_verified: boolean
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code?: string | null
          bank_name: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string | null
          bank_name?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user:
        | { Args: { _user_id: string }; Returns: Json }
        | {
            Args: { _confirm_admin_delete?: boolean; _user_id: string }
            Returns: Json
          }
      admin_grant_bonus_batches: {
        Args: { _bonus: number; _user_id: string }
        Returns: Json
      }
      admin_grant_calibration_batches: {
        Args: { _batches: number; _reason?: string; _user_id: string }
        Returns: Json
      }
      admin_wipe_unactivated_users: { Args: never; Returns: Json }
      atomic_admin_adjust_balance: {
        Args: {
          _admin_id: string
          _amount: number
          _operation: string
          _reason: string
          _user_id: string
          _wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Returns: Json
      }
      atomic_admin_credit: {
        Args: {
          _admin_id: string
          _amount: number
          _reason: string
          _user_id: string
          _wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Returns: Json
      }
      atomic_chargeback_reversal: {
        Args: {
          _banned_user_id: string
          _cash_amount: number
          _credit_amount?: number
          _reference: string
          _referrer_id: string
        }
        Returns: Json
      }
      atomic_initiate_withdrawal: {
        Args: {
          _amount: number
          _bank_name: string
          _fee: number
          _reference: string
          _user_id: string
        }
        Returns: Json
      }
      atomic_wallet_transfer: {
        Args: {
          _amount: number
          _description: string
          _from_wallet: Database["public"]["Enums"]["wallet_type"]
          _to_wallet: Database["public"]["Enums"]["wallet_type"]
          _user_id: string
        }
        Returns: Json
      }
      change_user_pin: {
        Args: { _new_pin: string; _old_pin: string }
        Returns: Json
      }
      check_balance: {
        Args: {
          _user_id: string
          _wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Returns: number
      }
      check_daily_referrals: { Args: { _user_id: string }; Returns: Json }
      check_invite_key: { Args: { _key: string }; Returns: boolean }
      claim_next_drop_position: { Args: never; Returns: number }
      commit_distribution_batch: { Args: { _writes: Json }; Returns: Json }
      complete_batch:
        | { Args: { _user_id: string }; Returns: Json }
        | {
            Args: { _idempotency_key: string; _user_id: string }
            Returns: Json
          }
      consume_pending_for_cycle: {
        Args: {
          _drop_id: string
          _profit_target: number
          _spot_id: string
          _user_id: string
        }
        Returns: Json
      }
      create_admin_notification: {
        Args: {
          _link?: string
          _message: string
          _metadata?: Json
          _title: string
          _type: string
        }
        Returns: string
      }
      create_notification: {
        Args: {
          _link?: string
          _message: string
          _metadata?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      create_spot: {
        Args: {
          _source_wallet?: Database["public"]["Enums"]["wallet_type"]
          _user_id: string
        }
        Returns: Json
      }
      execute_write_batch: { Args: { _commands: Json }; Returns: Json }
      expire_stale_payment_attempts: { Args: never; Returns: Json }
      extend_drop_target: {
        Args: { _delta: number; _drop_id: string }
        Returns: undefined
      }
      extend_line_ticket: {
        Args: {
          _extra_target: number
          _fee: number
          _new_spot_id: string
          _spot_name: string
          _user_id: string
          _wallet: string
        }
        Returns: Json
      }
      fail_stale_membership_attempts: {
        Args: { _except_id: string; _reason?: string; _user_id: string }
        Returns: number
      }
      get_banks: {
        Args: { _country?: string }
        Returns: {
          code: string
          country: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }[]
      }
      get_daily_task: { Args: { _user_id: string }; Returns: Json }
      get_distribution_data: {
        Args: { _max_drops?: number; _origin_drop_id: string }
        Returns: Json
      }
      get_drop_queue_status: { Args: never; Returns: Json }
      get_miner_details: { Args: { _user_id: string }; Returns: Json }
      get_my_balances: { Args: never; Returns: Json }
      get_my_drop_status: { Args: never; Returns: Json }
      get_my_profile: { Args: never; Returns: Json }
      get_my_withdrawal_accounts: { Args: never; Returns: Json }
      get_payment_attempt_status: {
        Args: { _attempt_id: string }
        Returns: string
      }
      get_pending_balance: { Args: { _user_id: string }; Returns: number }
      get_pending_cap: { Args: { _user_id: string }; Returns: number }
      get_platform_config: { Args: never; Returns: Json }
      get_public_stats: { Args: never; Returns: Json }
      get_restores_today_count: { Args: never; Returns: number }
      get_retirement_status: { Args: never; Returns: Json }
      get_spot_creation_data: {
        Args: {
          _source_wallet: Database["public"]["Enums"]["wallet_type"]
          _user_id: string
        }
        Returns: Json
      }
      get_user_drops_status:
        | { Args: { _user_id: string }; Returns: Json }
        | {
            Args: { _limit?: number; _offset?: number; _user_id: string }
            Returns: Json
          }
      get_user_profit_amount: { Args: { _user_id: string }; Returns: number }
      grant_referral_bonus_batches: {
        Args: { _referee_id: string; _referrer_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lock_profile_name: { Args: { _user_id: string }; Returns: undefined }
      mark_explainer_seen: { Args: { _status?: string }; Returns: undefined }
      match_and_credit_moniepoint: {
        Args: {
          _amount: number
          _email_id: string
          _sender_name: string
          _unmatched_id: string
        }
        Returns: Json
      }
      name_tokens: { Args: { _name: string }; Returns: string[] }
      notify_reentry_processed: {
        Args: { _drop_position: number; _spot_name: string; _user_id: string }
        Returns: undefined
      }
      pay_admin_fee:
        | {
            Args: {
              _admin_fee: number
              _drop_id: string
              _from_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _admin_fee: number
              _drop_id: string
              _from_user_id: string
              _has_referrer?: boolean
            }
            Returns: undefined
          }
      pay_referrer_activation_bonus: {
        Args: {
          _referee_id: string
          _referred_by_code: string
          _shares?: number
        }
        Returns: undefined
      }
      record_user_heartbeat: {
        Args: {
          p_action_detail?: string
          p_action_type?: string
          p_metadata?: Json
          p_page_name?: string
          p_page_path?: string
          p_session_id?: string
        }
        Returns: undefined
      }
      retire_all_active_spots: {
        Args: { _profit: number; _user_id: string }
        Returns: Json
      }
      reverse_referrer_activation_bonus: {
        Args: { _reason?: string; _referee_id: string }
        Returns: Json
      }
      save_my_birth_date: {
        Args: { _birth_month: number; _birth_year: number }
        Returns: undefined
      }
      save_my_state_of_residence: {
        Args: { _state: string }
        Returns: undefined
      }
      send_overflow_notification: {
        Args: { _recycled_amount: number; _user_id: string }
        Returns: undefined
      }
      send_payout_notification: {
        Args: {
          _auto_compound: boolean
          _profit_amount: number
          _user_id: string
        }
        Returns: undefined
      }
      set_user_pin: { Args: { _pin: string }; Returns: Json }
      task_get_batch: { Args: { _size?: number }; Returns: Json }
      task_get_daily_task: { Args: never; Returns: Json }
      task_report_broken_image: { Args: { _image_id: string }; Returns: Json }
      task_submit_batch:
        | { Args: { _choices?: Json }; Returns: Json }
        | {
            Args: { _choices?: Json; _idempotency_key?: string }
            Returns: Json
          }
      track_broadcast_cta_click: {
        Args: { _notification_id: string }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_spot_stats: {
        Args: { _profit_amount: number; _spot_id: string }
        Returns: Json
      }
      update_tour_progress: {
        Args: {
          _increment_picks?: boolean
          _mark_completed?: boolean
          _step: string
        }
        Returns: {
          completed_at: string | null
          created_at: string
          current_step: string
          history: Json
          is_completed: boolean
          last_step_at: string
          picks_guided: number
          started_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_tour_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_user_pin: { Args: { _pin: string }; Returns: Json }
      write_drop_fill: {
        Args: {
          _completed_at?: string
          _drop_id: string
          _new_fill_amount: number
          _new_status: string
        }
        Returns: undefined
      }
      write_drop_paid: { Args: { _drop_id: string }; Returns: undefined }
      write_drop_settled: { Args: { _drop_id: string }; Returns: undefined }
      write_new_drop: {
        Args: { _position: number; _spot_id: string }
        Returns: string
      }
      write_notification: {
        Args: {
          _link?: string
          _message: string
          _metadata?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      write_profile_update: {
        Args: { _set_last_payout_at?: boolean; _user_id: string }
        Returns: undefined
      }
      write_reentry_drop: {
        Args: { _position: number; _spot_id: string }
        Returns: string
      }
      write_spot: {
        Args: { _spot_name: string; _user_id: string }
        Returns: string
      }
      write_spot_stats: {
        Args: {
          _cycles_add?: number
          _spot_id: string
          _total_earnings_add: number
        }
        Returns: undefined
      }
      write_transaction: {
        Args: {
          _amount: number
          _description: string
          _metadata?: Json
          _status?: Database["public"]["Enums"]["transaction_status"]
          _transaction_type: Database["public"]["Enums"]["transaction_type"]
          _user_id: string
          _wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      ticket_category:
        | "money_issue"
        | "account_problem"
        | "how_to_use"
        | "complaint"
        | "suggestion"
        | "other"
      ticket_priority: "normal" | "urgent"
      ticket_sender_type: "user" | "admin" | "ai"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_user"
        | "resolved"
        | "closed"
      transaction_status: "pending" | "completed" | "failed"
      transaction_type:
        | "membership_bonus"
        | "deposit"
        | "withdrawal"
        | "debt_reversal"
        | "platform_fee"
        | "subsidy"
        | "membership_fee"
        | "referral_payout"
        | "voucher_issuance"
        | "credit_redemption"
        | "admin_expense"
        | "welcome_bonus"
        | "drop_entry"
        | "drop_profit"
        | "drop_reentry"
        | "drop_referral_cycle"
        | "referral_first_cycle_bonus"
        | "task_earning"
        | "task_unlock"
        | "withdrawal_refund"
        | "pending_reconciliation"
      wallet_type: "earnings" | "deposit" | "credits" | "system" | "pending"
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
      app_role: ["admin", "user"],
      ticket_category: [
        "money_issue",
        "account_problem",
        "how_to_use",
        "complaint",
        "suggestion",
        "other",
      ],
      ticket_priority: ["normal", "urgent"],
      ticket_sender_type: ["user", "admin", "ai"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_user",
        "resolved",
        "closed",
      ],
      transaction_status: ["pending", "completed", "failed"],
      transaction_type: [
        "membership_bonus",
        "deposit",
        "withdrawal",
        "debt_reversal",
        "platform_fee",
        "subsidy",
        "membership_fee",
        "referral_payout",
        "voucher_issuance",
        "credit_redemption",
        "admin_expense",
        "welcome_bonus",
        "drop_entry",
        "drop_profit",
        "drop_reentry",
        "drop_referral_cycle",
        "referral_first_cycle_bonus",
        "task_earning",
        "task_unlock",
        "withdrawal_refund",
        "pending_reconciliation",
      ],
      wallet_type: ["earnings", "deposit", "credits", "system", "pending"],
    },
  },
} as const
