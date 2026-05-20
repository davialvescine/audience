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
      event_members: {
        Row: {
          added_at: string
          added_by: string | null
          event_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          event_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sessions: {
        Row: {
          archived_at: string | null
          created_at: string
          event_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          active_session_id: string | null
          active_slide_id: string | null
          auto_send_on_approve: boolean
          created_at: string
          dispatch_interval_seconds: number
          enabled_display_modes: Database["public"]["Enums"]["telao_display_mode"][]
          h2r_last_heartbeat: string | null
          h2r_paired_at: string | null
          h2r_source_id: string | null
          h2r_webhook_url: string | null
          id: string
          name: string
          owner_id: string
          pinned_submission_id: string | null
          slug: string
          submissions_open: boolean
          telao_config: Json
          telao_configs: Json
          theme_id: string
          wordcloud_active: boolean
          wordcloud_config: Json
        }
        Insert: {
          active_session_id?: string | null
          active_slide_id?: string | null
          auto_send_on_approve?: boolean
          created_at?: string
          dispatch_interval_seconds?: number
          enabled_display_modes?: Database["public"]["Enums"]["telao_display_mode"][]
          h2r_last_heartbeat?: string | null
          h2r_paired_at?: string | null
          h2r_source_id?: string | null
          h2r_webhook_url?: string | null
          id?: string
          name: string
          owner_id: string
          pinned_submission_id?: string | null
          slug: string
          submissions_open?: boolean
          telao_config?: Json
          telao_configs?: Json
          theme_id: string
          wordcloud_active?: boolean
          wordcloud_config?: Json
        }
        Update: {
          active_session_id?: string | null
          active_slide_id?: string | null
          auto_send_on_approve?: boolean
          created_at?: string
          dispatch_interval_seconds?: number
          enabled_display_modes?: Database["public"]["Enums"]["telao_display_mode"][]
          h2r_last_heartbeat?: string | null
          h2r_paired_at?: string | null
          h2r_source_id?: string | null
          h2r_webhook_url?: string | null
          id?: string
          name?: string
          owner_id?: string
          pinned_submission_id?: string | null
          slug?: string
          submissions_open?: boolean
          telao_config?: Json
          telao_configs?: Json
          theme_id?: string
          wordcloud_active?: boolean
          wordcloud_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "events_active_session_id_fkey"
            columns: ["active_session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_active_slide_id_fkey"
            columns: ["active_slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_pinned_submission_id_fkey"
            columns: ["pinned_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          token?: string
        }
        Relationships: []
      }
      moderator_tokens: {
        Row: {
          created_at: string
          created_by: string
          display_name: string | null
          event_id: string
          expires_at: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          display_name?: string | null
          event_id: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          display_name?: string | null
          event_id?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      open_ended_responses: {
        Row: {
          author_name: string | null
          created_at: string
          event_id: string
          id: string
          participant_fp: string
          session_id: string
          slide_id: string
          text: string
          vote_count: number
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          event_id: string
          id?: string
          participant_fp: string
          session_id: string
          slide_id: string
          text: string
          vote_count?: number
        }
        Update: {
          author_name?: string | null
          created_at?: string
          event_id?: string
          id?: string
          participant_fp?: string
          session_id?: string
          slide_id?: string
          text?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "open_ended_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_ended_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_ended_responses_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      open_ended_votes: {
        Row: {
          created_at: string
          response_id: string
          voter_fp: string
        }
        Insert: {
          created_at?: string
          response_id: string
          voter_fp: string
        }
        Update: {
          created_at?: string
          response_id?: string
          voter_fp?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_ended_votes_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "open_ended_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      pairing_codes: {
        Row: {
          code: string
          consumed_at: string | null
          event_id: string
          expires_at: string
          heartbeat_secret: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          event_id: string
          expires_at: string
          heartbeat_secret: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          event_id?: string
          expires_at?: string
          heartbeat_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "pairing_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          option_index: number
          participant_fp: string
          session_id: string
          slide_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          option_index: number
          participant_fp: string
          session_id: string
          slide_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          option_index?: number
          participant_fp?: string
          session_id?: string
          slide_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          config: Json
          created_at: string
          event_id: string
          id: string
          position: number
          type: Database["public"]["Enums"]["slide_type"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          event_id: string
          id?: string
          position: number
          type: Database["public"]["Enums"]["slide_type"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          event_id?: string
          id?: string
          position?: number
          type?: Database["public"]["Enums"]["slide_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          approved_at: string | null
          comment: string
          created_at: string
          display_count: number
          error_message: string | null
          event_id: string
          id: string
          ip_hash: string | null
          moderated_by: string | null
          name: string
          sent_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["submission_status"]
        }
        Insert: {
          approved_at?: string | null
          comment: string
          created_at?: string
          display_count?: number
          error_message?: string | null
          event_id: string
          id?: string
          ip_hash?: string | null
          moderated_by?: string | null
          name: string
          sent_at?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["submission_status"]
        }
        Update: {
          approved_at?: string | null
          comment?: string
          created_at?: string
          display_count?: number
          error_message?: string | null
          event_id?: string
          id?: string
          ip_hash?: string | null
          moderated_by?: string | null
          name?: string
          sent_at?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
        }
        Relationships: [
          {
            foreignKeyName: "submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          tokens: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          tokens: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tokens?: Json
        }
        Relationships: []
      }
      wordcloud_words: {
        Row: {
          created_at: string
          event_id: string
          id: string
          ip_hash: string | null
          session_id: string
          slide_id: string | null
          word: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          ip_hash?: string | null
          session_id: string
          slide_id?: string | null
          word: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          ip_hash?: string | null
          session_id?: string
          slide_id?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "wordcloud_words_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wordcloud_words_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wordcloud_words_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _has_event_access: { Args: { p_event_id: string }; Returns: boolean }
      add_event_member: {
        Args: { p_email: string; p_event_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      archive_session: { Args: { p_session_id: string }; Returns: undefined }
      claim_submission_for_send: {
        Args: { p_submission_id: string }
        Returns: {
          comment: string
          display_name: string
          event_id: string
          event_name: string
          event_slug: string
          submission_id: string
          webhook_url: string
        }[]
      }
      count_event_sent_submissions: {
        Args: { p_slug: string }
        Returns: number
      }
      create_session: {
        Args: { p_event_id: string; p_name: string }
        Returns: string
      }
      create_slide: {
        Args: {
          p_config?: Json
          p_event_id: string
          p_type: Database["public"]["Enums"]["slide_type"]
        }
        Returns: {
          config: Json
          created_at: string
          event_id: string
          id: string
          position: number
          type: Database["public"]["Enums"]["slide_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "slides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_session: { Args: { p_session_id: string }; Returns: undefined }
      delete_slide: { Args: { p_slide_id: string }; Returns: undefined }
      diag_rls_state: {
        Args: { p_user: string }
        Returns: {
          events_owned: number
          events_visible_via_member: number
          member_rows: number
          policies_on_events: string
          total_events: number
        }[]
      }
      get_active_slide: {
        Args: { p_slug: string }
        Returns: {
          config: Json
          event_id: string
          event_name: string
          slide_id: string
          slide_type: Database["public"]["Enums"]["slide_type"]
        }[]
      }
      get_event_by_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          name: string
          slug: string
          submissions_open: boolean
          theme_id: string
        }[]
      }
      get_moderator_email: { Args: { p_user_id: string }; Returns: string }
      get_open_ended_state: {
        Args: { p_slide_id: string; p_slug: string }
        Returns: {
          author_name: string
          created_at: string
          id: string
          text: string
          vote_count: number
        }[]
      }
      get_pinned_submission: {
        Args: { p_slug: string }
        Returns: {
          comment: string
          id: string
          name: string
          sent_at: string
        }[]
      }
      get_pinned_via_token: {
        Args: { p_token: string }
        Returns: {
          comment: string
          id: string
          name: string
          sent_at: string
        }[]
      }
      get_poll_state: {
        Args: { p_slide_id: string; p_slug: string }
        Returns: {
          option_index: number
          vote_count: number
        }[]
      }
      get_submissions_via_token: {
        Args: { p_status_filter?: string; p_token: string }
        Returns: {
          comment: string
          created_at: string
          error_message: string
          id: string
          name: string
          status: Database["public"]["Enums"]["submission_status"]
        }[]
      }
      get_telao_config: {
        Args: { p_slug: string }
        Returns: {
          config: Json
          configs: Json
          event_id: string
          event_name: string
          theme_id: string
        }[]
      }
      get_telao_submissions_since: {
        Args: { p_since: string; p_slug: string }
        Returns: {
          comment: string
          created_at: string
          id: string
          name: string
          sent_at: string
        }[]
      }
      get_wordcloud_settings: {
        Args: { p_slug: string }
        Returns: {
          active: boolean
          config: Json
          event_id: string
        }[]
      }
      get_wordcloud_state: {
        Args: { p_slide_id?: string; p_slug: string }
        Returns: {
          count: number
          word: string
        }[]
      }
      list_event_members: {
        Args: { p_event_id: string }
        Returns: {
          added_at: string
          email: string
          is_owner: boolean
          user_id: string
        }[]
      }
      list_platform_users: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      list_sessions: {
        Args: { p_event_id: string }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          responses_count: number
          sort_order: number
          submissions_count: number
          votes_count: number
          words_count: number
        }[]
      }
      list_slides: {
        Args: { p_event_id: string }
        Returns: {
          config: Json
          created_at: string
          event_id: string
          id: string
          position: number
          type: Database["public"]["Enums"]["slide_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "slides"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_submission_failed: {
        Args: { p_error: string; p_submission_id: string }
        Returns: undefined
      }
      mark_submission_sent: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      moderate_with_token: {
        Args: { p_action: string; p_submission_id: string; p_token: string }
        Returns: undefined
      }
      pin_submission: { Args: { p_submission_id: string }; Returns: undefined }
      record_heartbeat: {
        Args: { p_event_id: string; p_secret: string }
        Returns: boolean
      }
      redeem_pairing_code: {
        Args: { p_code: string; p_source_id: string; p_tunnel_url: string }
        Returns: {
          event_id: string
          event_name: string
          heartbeat_secret: string
        }[]
      }
      reject_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      remove_event_member: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: undefined
      }
      rename_session: {
        Args: { p_name: string; p_session_id: string }
        Returns: undefined
      }
      reorder_slides: {
        Args: { p_event_id: string; p_slide_ids: string[] }
        Returns: undefined
      }
      reset_all_event_slides: { Args: { p_event_id: string }; Returns: Json }
      reset_event_all: { Args: { p_event_id: string }; Returns: Json }
      reset_event_submissions: { Args: { p_event_id: string }; Returns: Json }
      reset_open_ended_slide: { Args: { p_slide_id: string }; Returns: Json }
      reset_poll_slide: { Args: { p_slide_id: string }; Returns: undefined }
      reset_session: {
        Args: { p_session_id: string }
        Returns: {
          responses_deleted: number
          submissions_deleted: number
          votes_deleted: number
          words_deleted: number
        }[]
      }
      reset_slide_words: { Args: { p_slide_id: string }; Returns: undefined }
      reset_submission_for_retry: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      reset_wordcloud: { Args: { p_event_id: string }; Returns: undefined }
      set_active_session: {
        Args: { p_event_id: string; p_session_id: string }
        Returns: undefined
      }
      set_active_slide: {
        Args: { p_event_id: string; p_slide_id: string }
        Returns: {
          active_session_id: string | null
          active_slide_id: string | null
          auto_send_on_approve: boolean
          created_at: string
          dispatch_interval_seconds: number
          enabled_display_modes: Database["public"]["Enums"]["telao_display_mode"][]
          h2r_last_heartbeat: string | null
          h2r_paired_at: string | null
          h2r_source_id: string | null
          h2r_webhook_url: string | null
          id: string
          name: string
          owner_id: string
          pinned_submission_id: string | null
          slug: string
          submissions_open: boolean
          telao_config: Json
          telao_configs: Json
          theme_id: string
          wordcloud_active: boolean
          wordcloud_config: Json
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_wordcloud_active: {
        Args: { p_active: boolean; p_event_id: string }
        Returns: {
          active_session_id: string | null
          active_slide_id: string | null
          auto_send_on_approve: boolean
          created_at: string
          dispatch_interval_seconds: number
          enabled_display_modes: Database["public"]["Enums"]["telao_display_mode"][]
          h2r_last_heartbeat: string | null
          h2r_paired_at: string | null
          h2r_source_id: string | null
          h2r_webhook_url: string | null
          id: string
          name: string
          owner_id: string
          pinned_submission_id: string | null
          slug: string
          submissions_open: boolean
          telao_config: Json
          telao_configs: Json
          theme_id: string
          wordcloud_active: boolean
          wordcloud_config: Json
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_comment: {
        Args: {
          p_comment: string
          p_ip_hash: string
          p_name: string
          p_slug: string
        }
        Returns: string
      }
      submit_open_ended: {
        Args: {
          p_author_name: string
          p_fp: string
          p_slug: string
          p_text: string
        }
        Returns: Json
      }
      submit_poll_vote: {
        Args: {
          p_option_index: number
          p_participant_fp: string
          p_slide_id: string
          p_slug: string
        }
        Returns: Json
      }
      submit_word: {
        Args: { p_ip_hash: string; p_slug: string; p_word: string }
        Returns: Json
      }
      toggle_open_ended_vote: {
        Args: { p_fp: string; p_response_id: string }
        Returns: Json
      }
      touch_moderator_token: { Args: { p_token: string }; Returns: undefined }
      unpin_submission: { Args: { p_event_id: string }; Returns: undefined }
      update_slide: {
        Args: { p_config: Json; p_slide_id: string }
        Returns: {
          config: Json
          created_at: string
          event_id: string
          id: string
          position: number
          type: Database["public"]["Enums"]["slide_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "slides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_wordcloud_config: {
        Args: { p_config: Json; p_event_id: string }
        Returns: {
          active_session_id: string | null
          active_slide_id: string | null
          auto_send_on_approve: boolean
          created_at: string
          dispatch_interval_seconds: number
          enabled_display_modes: Database["public"]["Enums"]["telao_display_mode"][]
          h2r_last_heartbeat: string | null
          h2r_paired_at: string | null
          h2r_source_id: string | null
          h2r_webhook_url: string | null
          id: string
          name: string
          owner_id: string
          pinned_submission_id: string | null
          slug: string
          submissions_open: boolean
          telao_config: Json
          telao_configs: Json
          theme_id: string
          wordcloud_active: boolean
          wordcloud_config: Json
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_moderator_token: { Args: { p_token: string }; Returns: string }
      whoami_probe: { Args: never; Returns: string }
    }
    Enums: {
      slide_type:
        | "wordcloud"
        | "poll"
        | "open_ended"
        | "rating"
        | "qa"
        | "comments"
      submission_status: "pending" | "approved" | "rejected" | "sent" | "failed"
      telao_display_mode:
        | "h2r"
        | "browser_source"
        | "chrome_pip"
        | "desktop_app"
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
      slide_type: [
        "wordcloud",
        "poll",
        "open_ended",
        "rating",
        "qa",
        "comments",
      ],
      submission_status: ["pending", "approved", "rejected", "sent", "failed"],
      telao_display_mode: [
        "h2r",
        "browser_source",
        "chrome_pip",
        "desktop_app",
      ],
    },
  },
} as const
