export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      event_members: {
        Row: {
          added_at: string;
          added_by: string | null;
          event_id: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          added_by?: string | null;
          event_id: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string | null;
          event_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_members_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          created_at: string;
          dispatch_interval_seconds: number;
          enabled_display_modes: Database['public']['Enums']['telao_display_mode'][];
          h2r_last_heartbeat: string | null;
          h2r_paired_at: string | null;
          h2r_source_id: string | null;
          h2r_webhook_url: string | null;
          id: string;
          name: string;
          owner_id: string;
          pinned_submission_id: string | null;
          slug: string;
          submissions_open: boolean;
          telao_config: Json;
          telao_configs: Json;
          theme_id: string;
          wordcloud_active: boolean;
          wordcloud_config: Json;
        };
        Insert: {
          created_at?: string;
          dispatch_interval_seconds?: number;
          enabled_display_modes?: Database['public']['Enums']['telao_display_mode'][];
          h2r_last_heartbeat?: string | null;
          h2r_paired_at?: string | null;
          h2r_source_id?: string | null;
          h2r_webhook_url?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          pinned_submission_id?: string | null;
          slug: string;
          submissions_open?: boolean;
          telao_config?: Json;
          telao_configs?: Json;
          theme_id: string;
          wordcloud_active?: boolean;
          wordcloud_config?: Json;
        };
        Update: {
          created_at?: string;
          dispatch_interval_seconds?: number;
          enabled_display_modes?: Database['public']['Enums']['telao_display_mode'][];
          h2r_last_heartbeat?: string | null;
          h2r_paired_at?: string | null;
          h2r_source_id?: string | null;
          h2r_webhook_url?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          pinned_submission_id?: string | null;
          slug?: string;
          submissions_open?: boolean;
          telao_config?: Json;
          telao_configs?: Json;
          theme_id?: string;
          wordcloud_active?: boolean;
          wordcloud_config?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'events_pinned_submission_id_fkey';
            columns: ['pinned_submission_id'];
            isOneToOne: false;
            referencedRelation: 'submissions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_theme_id_fkey';
            columns: ['theme_id'];
            isOneToOne: false;
            referencedRelation: 'themes';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          token: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          token?: string;
        };
        Relationships: [];
      };
      moderator_tokens: {
        Row: {
          created_at: string;
          created_by: string;
          display_name: string | null;
          event_id: string;
          expires_at: string;
          id: string;
          last_used_at: string | null;
          revoked_at: string | null;
          token: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          display_name?: string | null;
          event_id: string;
          expires_at?: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          display_name?: string | null;
          event_id?: string;
          expires_at?: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'moderator_tokens_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      pairing_codes: {
        Row: {
          code: string;
          consumed_at: string | null;
          event_id: string;
          expires_at: string;
          heartbeat_secret: string;
        };
        Insert: {
          code: string;
          consumed_at?: string | null;
          event_id: string;
          expires_at: string;
          heartbeat_secret: string;
        };
        Update: {
          code?: string;
          consumed_at?: string | null;
          event_id?: string;
          expires_at?: string;
          heartbeat_secret?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pairing_codes_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      submissions: {
        Row: {
          approved_at: string | null;
          comment: string;
          created_at: string;
          display_count: number;
          error_message: string | null;
          event_id: string;
          id: string;
          ip_hash: string | null;
          moderated_by: string | null;
          name: string;
          sent_at: string | null;
          status: Database['public']['Enums']['submission_status'];
        };
        Insert: {
          approved_at?: string | null;
          comment: string;
          created_at?: string;
          display_count?: number;
          error_message?: string | null;
          event_id: string;
          id?: string;
          ip_hash?: string | null;
          moderated_by?: string | null;
          name: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['submission_status'];
        };
        Update: {
          approved_at?: string | null;
          comment?: string;
          created_at?: string;
          display_count?: number;
          error_message?: string | null;
          event_id?: string;
          id?: string;
          ip_hash?: string | null;
          moderated_by?: string | null;
          name?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['submission_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'submissions_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      themes: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          tokens: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          tokens: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          tokens?: Json;
        };
        Relationships: [];
      };
      wordcloud_words: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          ip_hash: string | null;
          word: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          ip_hash?: string | null;
          word: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          ip_hash?: string | null;
          word?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wordcloud_words_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_event_member: {
        Args: { p_email: string; p_event_id: string };
        Returns: {
          email: string;
          user_id: string;
        }[];
      };
      claim_submission_for_send: {
        Args: { p_submission_id: string };
        Returns: {
          comment: string;
          display_name: string;
          event_id: string;
          event_name: string;
          event_slug: string;
          submission_id: string;
          webhook_url: string;
        }[];
      };
      diag_rls_state: {
        Args: { p_user: string };
        Returns: {
          events_owned: number;
          events_visible_via_member: number;
          member_rows: number;
          policies_on_events: string;
          total_events: number;
        }[];
      };
      get_event_by_slug: {
        Args: { p_slug: string };
        Returns: {
          id: string;
          name: string;
          slug: string;
          submissions_open: boolean;
          theme_id: string;
        }[];
      };
      get_moderator_email: { Args: { p_user_id: string }; Returns: string };
      get_pinned_submission: {
        Args: { p_slug: string };
        Returns: {
          comment: string;
          id: string;
          name: string;
          sent_at: string;
        }[];
      };
      get_submissions_via_token: {
        Args: { p_status_filter?: string; p_token: string };
        Returns: {
          comment: string;
          created_at: string;
          error_message: string;
          id: string;
          name: string;
          status: Database['public']['Enums']['submission_status'];
        }[];
      };
      get_telao_config: {
        Args: { p_slug: string };
        Returns: {
          config: Json;
          configs: Json;
          event_id: string;
          event_name: string;
          theme_id: string;
        }[];
      };
      get_telao_submissions_since: {
        Args: { p_since: string; p_slug: string };
        Returns: {
          comment: string;
          created_at: string;
          id: string;
          name: string;
          sent_at: string;
        }[];
      };
      get_wordcloud_settings: {
        Args: { p_slug: string };
        Returns: {
          active: boolean;
          config: Json;
          event_id: string;
        }[];
      };
      get_wordcloud_state: {
        Args: { p_slug: string };
        Returns: {
          count: number;
          word: string;
        }[];
      };
      list_event_members: {
        Args: { p_event_id: string };
        Returns: {
          added_at: string;
          email: string;
          is_owner: boolean;
          user_id: string;
        }[];
      };
      list_platform_users: {
        Args: never;
        Returns: {
          email: string;
          user_id: string;
        }[];
      };
      mark_submission_failed: {
        Args: { p_error: string; p_submission_id: string };
        Returns: undefined;
      };
      mark_submission_sent: {
        Args: { p_submission_id: string };
        Returns: undefined;
      };
      moderate_with_token: {
        Args: { p_action: string; p_submission_id: string; p_token: string };
        Returns: undefined;
      };
      pin_submission: { Args: { p_submission_id: string }; Returns: undefined };
      record_heartbeat: {
        Args: { p_event_id: string; p_secret: string };
        Returns: boolean;
      };
      redeem_pairing_code: {
        Args: { p_code: string; p_source_id: string; p_tunnel_url: string };
        Returns: {
          event_id: string;
          event_name: string;
          heartbeat_secret: string;
        }[];
      };
      reject_submission: {
        Args: { p_submission_id: string };
        Returns: undefined;
      };
      remove_event_member: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: undefined;
      };
      reset_submission_for_retry: {
        Args: { p_submission_id: string };
        Returns: undefined;
      };
      reset_wordcloud: { Args: { p_event_id: string }; Returns: undefined };
      set_wordcloud_active: {
        Args: { p_active: boolean; p_event_id: string };
        Returns: {
          created_at: string;
          dispatch_interval_seconds: number;
          enabled_display_modes: Database['public']['Enums']['telao_display_mode'][];
          h2r_last_heartbeat: string | null;
          h2r_paired_at: string | null;
          h2r_source_id: string | null;
          h2r_webhook_url: string | null;
          id: string;
          name: string;
          owner_id: string;
          pinned_submission_id: string | null;
          slug: string;
          submissions_open: boolean;
          telao_config: Json;
          telao_configs: Json;
          theme_id: string;
          wordcloud_active: boolean;
          wordcloud_config: Json;
        };
        SetofOptions: {
          from: '*';
          to: 'events';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_comment: {
        Args: {
          p_comment: string;
          p_ip_hash: string;
          p_name: string;
          p_slug: string;
        };
        Returns: string;
      };
      submit_word: {
        Args: { p_ip_hash: string; p_slug: string; p_word: string };
        Returns: Json;
      };
      unpin_submission: { Args: { p_event_id: string }; Returns: undefined };
      update_wordcloud_config: {
        Args: { p_config: Json; p_event_id: string };
        Returns: {
          created_at: string;
          dispatch_interval_seconds: number;
          enabled_display_modes: Database['public']['Enums']['telao_display_mode'][];
          h2r_last_heartbeat: string | null;
          h2r_paired_at: string | null;
          h2r_source_id: string | null;
          h2r_webhook_url: string | null;
          id: string;
          name: string;
          owner_id: string;
          pinned_submission_id: string | null;
          slug: string;
          submissions_open: boolean;
          telao_config: Json;
          telao_configs: Json;
          theme_id: string;
          wordcloud_active: boolean;
          wordcloud_config: Json;
        };
        SetofOptions: {
          from: '*';
          to: 'events';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      validate_moderator_token: { Args: { p_token: string }; Returns: string };
      whoami_probe: { Args: never; Returns: string };
    };
    Enums: {
      submission_status: 'pending' | 'approved' | 'rejected' | 'sent' | 'failed';
      telao_display_mode: 'h2r' | 'browser_source' | 'chrome_pip' | 'desktop_app';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      submission_status: ['pending', 'approved', 'rejected', 'sent', 'failed'],
      telao_display_mode: ['h2r', 'browser_source', 'chrome_pip', 'desktop_app'],
    },
  },
} as const;
