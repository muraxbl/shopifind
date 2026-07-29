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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          display_order: number | null
          id: string
          label: string
          niche: string
          parent_id: string | null
        }
        Insert: {
          display_order?: number | null
          id: string
          label: string
          niche: string
          parent_id?: string | null
        }
        Update: {
          display_order?: number | null
          id?: string
          label?: string
          niche?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_niche_fkey"
            columns: ["niche"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      click_attribution: {
        Row: {
          commission_cents: number | null
          country_code: string | null
          id: string
          intent: string
          ip_hash: string | null
          merchant_id: string | null
          paid: boolean
          paid_at: string | null
          payload_timestamp: string
          product_id: string | null
          product_slug: string | null
          raw_payload: Json
          received_at: string | null
          source_url: string | null
          xcust: string
        }
        Insert: {
          commission_cents?: number | null
          country_code?: string | null
          id?: string
          intent: string
          ip_hash?: string | null
          merchant_id?: string | null
          paid?: boolean
          paid_at?: string | null
          payload_timestamp: string
          product_id?: string | null
          product_slug?: string | null
          raw_payload: Json
          received_at?: string | null
          source_url?: string | null
          xcust: string
        }
        Update: {
          commission_cents?: number | null
          country_code?: string | null
          id?: string
          intent?: string
          ip_hash?: string | null
          merchant_id?: string | null
          paid?: boolean
          paid_at?: string | null
          payload_timestamp?: string
          product_id?: string | null
          product_slug?: string | null
          raw_payload?: Json
          received_at?: string | null
          source_url?: string | null
          xcust?: string
        }
        Relationships: [
          {
            foreignKeyName: "click_attribution_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_attribution_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_with_store"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_collections: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string
          niche: string | null
          product_ids: string[] | null
          published: boolean | null
          published_at: string | null
          slug: string
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          niche?: string | null
          product_ids?: string[] | null
          published?: boolean | null
          published_at?: string | null
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          niche?: string | null
          product_ids?: string[] | null
          published?: boolean | null
          published_at?: string | null
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "editorial_collections_niche_fkey"
            columns: ["niche"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      niches: {
        Row: {
          active: boolean | null
          description: string | null
          display_order: number | null
          emoji: string | null
          id: string
          label: string
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          display_order?: number | null
          emoji?: string | null
          id: string
          label: string
        }
        Update: {
          active?: boolean | null
          description?: string | null
          display_order?: number | null
          emoji?: string | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      price_alert_deliveries: {
        Row: {
          alert_id: string
          attempt_count: number
          attempted_at: string | null
          created_at: string
          error_message: string | null
          id: string
          price_history_id: number
          provider_message_id: string | null
          reference_currency: string
          reference_price_cents: number
          sent_at: string | null
          status: string
        }
        Insert: {
          alert_id: string
          attempt_count?: number
          attempted_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          price_history_id: number
          provider_message_id?: string | null
          reference_currency: string
          reference_price_cents: number
          sent_at?: string | null
          status?: string
        }
        Update: {
          alert_id?: string
          attempt_count?: number
          attempted_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          price_history_id?: number
          provider_message_id?: string | null
          reference_currency?: string
          reference_price_cents?: number
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "price_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alert_deliveries_price_history_id_fkey"
            columns: ["price_history_id"]
            isOneToOne: false
            referencedRelation: "price_history"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          active: boolean
          baseline_currency: string
          baseline_price_cents: number
          created_at: string
          id: string
          last_evaluated_history_id: number | null
          last_notified_at: string | null
          last_notified_price_cents: number | null
          mode: string
          percentage_drop: number | null
          product_id: string
          target_price_cents: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          baseline_currency: string
          baseline_price_cents: number
          created_at?: string
          id?: string
          last_evaluated_history_id?: number | null
          last_notified_at?: string | null
          last_notified_price_cents?: number | null
          mode?: string
          percentage_drop?: number | null
          product_id: string
          target_price_cents?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          baseline_currency?: string
          baseline_price_cents?: number
          created_at?: string
          id?: string
          last_evaluated_history_id?: number | null
          last_notified_at?: string | null
          last_notified_price_cents?: number | null
          mode?: string
          percentage_drop?: number | null
          product_id?: string
          target_price_cents?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_last_evaluated_history_id_fkey"
            columns: ["last_evaluated_history_id"]
            isOneToOne: false
            referencedRelation: "price_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_with_store"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          currency: string
          id: number
          in_stock: boolean
          observed_at: string
          price_cents: number
          product_id: string
        }
        Insert: {
          currency?: string
          id?: number
          in_stock: boolean
          observed_at?: string
          price_cents: number
          product_id: string
        }
        Update: {
          currency?: string
          id?: number
          in_stock?: boolean
          observed_at?: string
          price_cents?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_with_store"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_url: string | null
          attributes: Json | null
          category_id: string | null
          created_at: string | null
          currency: string
          description: string | null
          eco_tags: string[] | null
          id: string
          image_url: string
          in_stock: boolean | null
          last_seen_at: string | null
          price_cents: number
          slug: string
          source_url: string
          store_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          affiliate_url?: string | null
          attributes?: Json | null
          category_id?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          eco_tags?: string[] | null
          id?: string
          image_url: string
          in_stock?: boolean | null
          last_seen_at?: string | null
          price_cents: number
          slug: string
          source_url: string
          store_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          affiliate_url?: string | null
          attributes?: Json | null
          category_id?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          eco_tags?: string[] | null
          id?: string
          image_url?: string
          in_stock?: boolean | null
          last_seen_at?: string | null
          price_cents?: number
          slug?: string
          source_url?: string
          store_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      search_history: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: number
          query: string
          results_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: number
          query: string
          results_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: number
          query?: string
          results_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean | null
          affiliate_id: string | null
          affiliate_program: string | null
          country: string | null
          created_at: string | null
          eco_score: number | null
          featured: boolean | null
          feed_source: string | null
          id: string
          logo_url: string | null
          long_description: string | null
          name: string
          niche: string
          short_description: string | null
          slug: string
          updated_at: string | null
          url: string
          values: string[] | null
          verified: boolean | null
        }
        Insert: {
          active?: boolean | null
          affiliate_id?: string | null
          affiliate_program?: string | null
          country?: string | null
          created_at?: string | null
          eco_score?: number | null
          featured?: boolean | null
          feed_source?: string | null
          id?: string
          logo_url?: string | null
          long_description?: string | null
          name: string
          niche: string
          short_description?: string | null
          slug: string
          updated_at?: string | null
          url: string
          values?: string[] | null
          verified?: boolean | null
        }
        Update: {
          active?: boolean | null
          affiliate_id?: string | null
          affiliate_program?: string | null
          country?: string | null
          created_at?: string | null
          eco_score?: number | null
          featured?: boolean | null
          feed_source?: string | null
          id?: string
          logo_url?: string | null
          long_description?: string | null
          name?: string
          niche?: string
          short_description?: string | null
          slug?: string
          updated_at?: string | null
          url?: string
          values?: string[] | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_niche_fkey"
            columns: ["niche"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          niche_prefs: string[] | null
          plan: Database["public"]["Enums"]["user_plan"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          niche_prefs?: string[] | null
          plan?: Database["public"]["Enums"]["user_plan"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          niche_prefs?: string[] | null
          plan?: Database["public"]["Enums"]["user_plan"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          items: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          items?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          items?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_products_with_store: {
        Row: {
          affiliate_url: string | null
          attributes: Json | null
          category_id: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          eco_tags: string[] | null
          id: string | null
          image_url: string | null
          in_stock: boolean | null
          last_seen_at: string | null
          niche: string | null
          price_cents: number | null
          short_description: string | null
          slug: string | null
          source_url: string | null
          store_eco_score: number | null
          store_featured: boolean | null
          store_id: string | null
          store_name: string | null
          store_slug: string | null
          store_values: string[] | null
          title: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_niche_fkey"
            columns: ["niche"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      user_plan: "free" | "plus" | "pro"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_plan: ["free", "plus", "pro"],
    },
  },
} as const
