// =============================================================================
// Supabase generated types.
// Improve manually until you run `pnpm db:types` from a connected Supabase project.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserPlan = 'free' | 'plus' | 'pro';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          plan: UserPlan;
          niche_prefs: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: UserPlan;
          niche_prefs?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: UserPlan;
          niche_prefs?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      niches: {
        Row: {
          id: string;
          label: string;
          description: string | null;
          emoji: string | null;
          display_order: number;
          active: boolean;
        };
        Insert: {
          id: string;
          label: string;
          description?: string | null;
          emoji?: string | null;
          display_order?: number;
          active?: boolean;
        };
        Update: {
          id?: string;
          label?: string;
          description?: string | null;
          emoji?: string | null;
          display_order?: number;
          active?: boolean;
        };
      };
      stores: {
        Row: {
          id: string;
          slug: string;
          name: string;
          url: string;
          niche: string;
          logo_url: string | null;
          short_description: string | null;
          long_description: string | null;
          eco_score: number;
          values: string[];
          country: string | null;
          affiliate_program: string;
          affiliate_id: string | null;
          feed_source: string | null;
          active: boolean;
          verified: boolean;
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          url: string;
          niche: string;
          logo_url?: string | null;
          short_description?: string | null;
          long_description?: string | null;
          eco_score?: number;
          values?: string[];
          country?: string | null;
          affiliate_program?: string;
          affiliate_id?: string | null;
          feed_source?: string | null;
          active?: boolean;
          verified?: boolean;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['stores']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          niche: string;
          label: string;
          parent_id: string | null;
          display_order: number;
        };
        Insert: {
          id: string;
          niche: string;
          label: string;
          parent_id?: string | null;
          display_order?: number;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          slug: string;
          title: string;
          description: string | null;
          price_cents: number;
          currency: string;
          image_url: string;
          source_url: string;
          affiliate_url: string | null;
          category_id: string | null;
          attributes: Json;
          eco_tags: string[];
          in_stock: boolean;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          slug: string;
          title: string;
          description?: string | null;
          price_cents: number;
          currency?: string;
          image_url: string;
          source_url: string;
          affiliate_url?: string | null;
          category_id?: string | null;
          attributes?: Json;
          eco_tags?: string[];
          in_stock?: boolean;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      wishlists: {
        Row: {
          user_id: string;
          items: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          items?: Json;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          items?: Json;
          updated_at?: string;
        };
      };
      search_history: {
        Row: {
          id: number;
          user_id: string | null;
          query: string;
          filters: Json | null;
          results_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          query: string;
          filters?: Json | null;
          results_count?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['search_history']['Insert']>;
      };
      editorial_collections: {
        Row: {
          id: string;
          slug: string;
          title: string;
          subtitle: string | null;
          description: string | null;
          cover_image_url: string | null;
          niche: string | null;
          product_ids: string[];
          published: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          subtitle?: string | null;
          description?: string | null;
          cover_image_url?: string | null;
          niche?: string | null;
          product_ids?: string[];
          published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['editorial_collections']['Insert']>;
      };
    };
    Views: {
      v_products_with_store: {
        Row: {
          id: string;
          store_id: string;
          slug: string;
          title: string;
          description: string | null;
          price_cents: number;
          currency: string;
          image_url: string;
          source_url: string;
          affiliate_url: string | null;
          category_id: string | null;
          attributes: Json;
          eco_tags: string[];
          in_stock: boolean;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
          // Joined from stores:
          store_name: string;
          store_slug: string;
          niche: string;
          country: string | null;
          store_eco_score: number;
          store_values: string[];
          store_featured: boolean;
          verified: boolean;
          short_description: string | null;
        };
      };
    };
    Enums: {
      user_plan: UserPlan;
    };
  };
}
