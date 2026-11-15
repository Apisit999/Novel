export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
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
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
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
      app_settings: {
        Row: {
          key: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      bookmarks: {
        Row: {
          created_at: string;
          title_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          title_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          title_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarks_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_items: {
        Row: {
          collection_id: string;
          position: number;
          title_id: string;
        };
        ComputedFields: never;
        Insert: {
          collection_id: string;
          position?: number;
          title_id: string;
        };
        Update: {
          collection_id?: string;
          position?: number;
          title_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_items_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          published: boolean;
          slug: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          published?: boolean;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          published?: boolean;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      episodes: {
        Row: {
          access: Database["public"]["Enums"]["episode_access"];
          created_at: string;
          id: string;
          name: string;
          number: number;
          publish_at: string | null;
          status: Database["public"]["Enums"]["publish_status"];
          title_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          access?: Database["public"]["Enums"]["episode_access"];
          created_at?: string;
          id?: string;
          name: string;
          number: number;
          publish_at?: string | null;
          status?: Database["public"]["Enums"]["publish_status"];
          title_id: string;
          updated_at?: string;
        };
        Update: {
          access?: Database["public"]["Enums"]["episode_access"];
          created_at?: string;
          id?: string;
          name?: string;
          number?: number;
          publish_at?: string | null;
          status?: Database["public"]["Enums"]["publish_status"];
          title_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "episodes_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      home_pins: {
        Row: {
          created_at: string;
          ends_at: string | null;
          id: string;
          note: string;
          placement: string;
          position: number;
          starts_at: string | null;
          title_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          note?: string;
          placement: string;
          position?: number;
          starts_at?: string | null;
          title_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          note?: string;
          placement?: string;
          position?: number;
          starts_at?: string | null;
          title_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "home_pins_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      home_sections: {
        Row: {
          config: NonNullable<Json>;
          created_at: string;
          enabled: boolean;
          ends_at: string | null;
          id: string;
          kind: string;
          position: number;
          starts_at: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          config?: NonNullable<Json>;
          created_at?: string;
          enabled?: boolean;
          ends_at?: string | null;
          id?: string;
          kind: string;
          position?: number;
          starts_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Update: {
          config?: NonNullable<Json>;
          created_at?: string;
          enabled?: boolean;
          ends_at?: string | null;
          id?: string;
          kind?: string;
          position?: number;
          starts_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      manga_pages: {
        Row: {
          episode_id: string;
          height: number | null;
          image_key: string;
          page_no: number;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          episode_id: string;
          height?: number | null;
          image_key: string;
          page_no: number;
          width?: number | null;
        };
        Update: {
          episode_id?: string;
          height?: number | null;
          image_key?: string;
          page_no?: number;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "manga_pages_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
        ];
      };
      novel_bodies: {
        Row: {
          body_markdown: string;
          episode_id: string;
          word_count: number;
        };
        ComputedFields: never;
        Insert: {
          body_markdown?: string;
          episode_id: string;
          word_count?: number;
        };
        Update: {
          body_markdown?: string;
          episode_id?: string;
          word_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "novel_bodies_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: true;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
        ];
      };
      novel_translations: {
        Row: {
          body_markdown: string;
          episode_id: string;
          lang: string;
          machine: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body_markdown?: string;
          episode_id: string;
          lang: string;
          machine?: boolean;
          updated_at?: string;
        };
        Update: {
          body_markdown?: string;
          episode_id?: string;
          lang?: string;
          machine?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "novel_translations_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          id: string;
          interval: Database["public"]["Enums"]["plan_interval"];
          name: string;
          price_thb: number;
          stripe_price_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          id?: string;
          interval: Database["public"]["Enums"]["plan_interval"];
          name: string;
          price_thb: number;
          stripe_price_id?: string | null;
        };
        Update: {
          active?: boolean;
          id?: string;
          interval?: Database["public"]["Enums"]["plan_interval"];
          name?: string;
          price_thb?: number;
          stripe_price_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          role: Database["public"]["Enums"]["user_role"];
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Relationships: [];
      };
      progress: {
        Row: {
          completed: boolean;
          episode_id: string;
          position: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed?: boolean;
          episode_id: string;
          position?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          episode_id?: string;
          position?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "progress_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          current_period_end: string | null;
          plan_id: string | null;
          status: Database["public"]["Enums"]["sub_status"];
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          current_period_end?: string | null;
          plan_id?: string | null;
          status: Database["public"]["Enums"]["sub_status"];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          current_period_end?: string | null;
          plan_id?: string | null;
          status?: Database["public"]["Enums"]["sub_status"];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      title_tags: {
        Row: {
          tag_id: string;
          title_id: string;
        };
        ComputedFields: never;
        Insert: {
          tag_id: string;
          title_id: string;
        };
        Update: {
          tag_id?: string;
          title_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_tags_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_views: {
        Row: {
          title_id: string;
          view_count: number;
        };
        ComputedFields: never;
        Insert: {
          title_id: string;
          view_count?: number;
        };
        Update: {
          title_id?: string;
          view_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "title_views_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: true;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_views_daily: {
        Row: {
          day: string;
          title_id: string;
          view_count: number;
        };
        ComputedFields: never;
        Insert: {
          day?: string;
          title_id: string;
          view_count?: number;
        };
        Update: {
          day?: string;
          title_id?: string;
          view_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "title_views_daily_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      titles: {
        Row: {
          access: Database["public"]["Enums"]["access_level"];
          cover_key: string | null;
          created_at: string;
          featured: boolean;
          id: string;
          name: string;
          published: boolean;
          rating: Database["public"]["Enums"]["age_rating"];
          slug: string;
          status: Database["public"]["Enums"]["title_status"];
          synopsis: string;
          type: Database["public"]["Enums"]["content_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          access?: Database["public"]["Enums"]["access_level"];
          cover_key?: string | null;
          created_at?: string;
          featured?: boolean;
          id?: string;
          name: string;
          published?: boolean;
          rating?: Database["public"]["Enums"]["age_rating"];
          slug: string;
          status?: Database["public"]["Enums"]["title_status"];
          synopsis?: string;
          type: Database["public"]["Enums"]["content_type"];
          updated_at?: string;
        };
        Update: {
          access?: Database["public"]["Enums"]["access_level"];
          cover_key?: string | null;
          created_at?: string;
          featured?: boolean;
          id?: string;
          name?: string;
          published?: boolean;
          rating?: Database["public"]["Enums"]["age_rating"];
          slug?: string;
          status?: Database["public"]["Enums"]["title_status"];
          synopsis?: string;
          type?: Database["public"]["Enums"]["content_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      video_assets: {
        Row: {
          duration_sec: number | null;
          episode_id: string;
          ready: boolean;
          stream_uid: string;
        };
        ComputedFields: never;
        Insert: {
          duration_sec?: number | null;
          episode_id: string;
          ready?: boolean;
          stream_uid: string;
        };
        Update: {
          duration_sec?: number | null;
          episode_id?: string;
          ready?: boolean;
          stream_uid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "video_assets_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: true;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access: { Args: { p_episode_id: string }; Returns: boolean };
      episode_is_visible: { Args: { p_episode_id: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      record_title_view: { Args: { p_slug: string }; Returns: undefined };
    };
    Enums: {
      access_level: "free" | "premium";
      age_rating: "all" | "13" | "18";
      content_type: "novel" | "manga" | "video";
      episode_access: "inherit" | "free" | "premium";
      plan_interval: "month" | "year";
      publish_status: "draft" | "scheduled" | "published";
      sub_status: "active" | "past_due" | "canceled";
      title_status: "ongoing" | "completed" | "hiatus";
      user_role: "user" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_level: ["free", "premium"],
      age_rating: ["all", "13", "18"],
      content_type: ["novel", "manga", "video"],
      episode_access: ["inherit", "free", "premium"],
      plan_interval: ["month", "year"],
      publish_status: ["draft", "scheduled", "published"],
      sub_status: ["active", "past_due", "canceled"],
      title_status: ["ongoing", "completed", "hiatus"],
      user_role: ["user", "admin"],
    },
  },
} as const;
