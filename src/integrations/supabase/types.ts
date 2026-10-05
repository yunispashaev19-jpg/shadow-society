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
      achievements: {
        Row: {
          description: string
          icon: string
          id: string
          name: string
        }
        Insert: {
          description: string
          icon?: string
          id: string
          name: string
        }
        Update: {
          description?: string
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          channel: Database["public"]["Enums"]["chat_channel"]
          content: string
          created_at: string
          game_id: string | null
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["chat_channel"]
          content: string
          created_at?: string
          game_id?: string | null
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["chat_channel"]
          content?: string
          created_at?: string
          game_id?: string | null
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_actions: {
        Row: {
          actor_id: string
          created_at: string
          game_id: string
          id: string
          kind: string
          phase: Database["public"]["Enums"]["game_phase"]
          round: number
          target_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          game_id: string
          id?: string
          kind: string
          phase: Database["public"]["Enums"]["game_phase"]
          round: number
          target_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          game_id?: string
          id?: string
          kind?: string
          phase?: Database["public"]["Enums"]["game_phase"]
          round?: number
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_actions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_actions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_events: {
        Row: {
          audience: string | null
          created_at: string
          game_id: string
          id: string
          kind: string
          message: string
          payload: Json
          phase: Database["public"]["Enums"]["game_phase"]
          round: number
        }
        Insert: {
          audience?: string | null
          created_at?: string
          game_id: string
          id?: string
          kind: string
          message: string
          payload?: Json
          phase: Database["public"]["Enums"]["game_phase"]
          round: number
        }
        Update: {
          audience?: string | null
          created_at?: string
          game_id?: string
          id?: string
          kind?: string
          message?: string
          payload?: Json
          phase?: Database["public"]["Enums"]["game_phase"]
          round?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          alive: boolean
          eliminated_round: number | null
          game_id: string
          id: string
          left_game: boolean
          seat: number
          user_id: string
        }
        Insert: {
          alive?: boolean
          eliminated_round?: number | null
          game_id: string
          id?: string
          left_game?: boolean
          seat: number
          user_id: string
        }
        Update: {
          alive?: boolean
          eliminated_round?: number | null
          game_id?: string
          id?: string
          left_game?: boolean
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_roles: {
        Row: {
          game_id: string
          role: Database["public"]["Enums"]["game_role"]
          user_id: string
        }
        Insert: {
          game_id: string
          role: Database["public"]["Enums"]["game_role"]
          user_id: string
        }
        Update: {
          game_id?: string
          role?: Database["public"]["Enums"]["game_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_roles_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          phase: Database["public"]["Enums"]["game_phase"]
          phase_ends_at: string
          room_id: string
          round: number
          settings: Json
          version: number
          winner: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          phase?: Database["public"]["Enums"]["game_phase"]
          phase_ends_at?: string
          room_id: string
          round?: number
          settings?: Json
          version?: number
          winner?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          phase?: Database["public"]["Enums"]["game_phase"]
          phase_ends_at?: string
          room_id?: string
          round?: number
          settings?: Json
          version?: number
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      match_chat_analyses: {
        Row: {
          analysis: Json
          created_at: string
          game_id: string
          message_count: number
          requested_by: string
        }
        Insert: {
          analysis: Json
          created_at?: string
          game_id: string
          message_count?: number
          requested_by: string
        }
        Update: {
          analysis?: Json
          created_at?: string
          game_id?: string
          message_count?: number
          requested_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_chat_analyses_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_chat_analyses_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          coins_earned: number
          created_at: string
          game_id: string
          id: string
          role: Database["public"]["Enums"]["game_role"]
          survived: boolean
          user_id: string
          won: boolean
          xp_earned: number
        }
        Insert: {
          coins_earned?: number
          created_at?: string
          game_id: string
          id?: string
          role: Database["public"]["Enums"]["game_role"]
          survived?: boolean
          user_id: string
          won: boolean
          xp_earned?: number
        }
        Update: {
          coins_earned?: number
          created_at?: string
          game_id?: string
          id?: string
          role?: Database["public"]["Enums"]["game_role"]
          survived?: boolean
          user_id?: string
          won?: boolean
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_results_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string
          civilian_games: number
          coins: number
          created_at: string
          detective_games: number
          doctor_games: number
          frame_key: string
          games_played: number
          id: string
          level: number
          mafia_games: number
          updated_at: string
          username: string
          wins: number
          xp: number
        }
        Insert: {
          avatar_key?: string
          civilian_games?: number
          coins?: number
          created_at?: string
          detective_games?: number
          doctor_games?: number
          frame_key?: string
          games_played?: number
          id: string
          level?: number
          mafia_games?: number
          updated_at?: string
          username: string
          wins?: number
          xp?: number
        }
        Update: {
          avatar_key?: string
          civilian_games?: number
          coins?: number
          created_at?: string
          detective_games?: number
          doctor_games?: number
          frame_key?: string
          games_played?: number
          id?: string
          level?: number
          mafia_games?: number
          updated_at?: string
          username?: string
          wins?: number
          xp?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          room_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          room_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_players: {
        Row: {
          id: string
          is_ready: boolean
          joined_at: string
          last_seen: string
          room_id: string
          seat: number
          user_id: string
        }
        Insert: {
          id?: string
          is_ready?: boolean
          joined_at?: string
          last_seen?: string
          room_id: string
          seat: number
          user_id: string
        }
        Update: {
          id?: string
          is_ready?: boolean
          joined_at?: string
          last_seen?: string
          room_id?: string
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          current_game_id: string | null
          host_id: string
          id: string
          is_private: boolean
          max_players: number
          name: string
          settings: Json
          status: Database["public"]["Enums"]["room_status"]
        }
        Insert: {
          code: string
          created_at?: string
          current_game_id?: string | null
          host_id: string
          id?: string
          is_private?: boolean
          max_players?: number
          name: string
          settings?: Json
          status?: Database["public"]["Enums"]["room_status"]
        }
        Update: {
          code?: string
          created_at?: string
          current_game_id?: string | null
          host_id?: string
          id?: string
          is_private?: boolean
          max_players?: number
          name?: string
          settings?: Json
          status?: Database["public"]["Enums"]["room_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rooms_current_game_fk"
            columns: ["current_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_items: {
        Row: {
          description: string
          id: string
          kind: string
          name: string
          price: number
          rarity: string
        }
        Insert: {
          description: string
          id: string
          kind: string
          name: string
          price: number
          rarity?: string
        }
        Update: {
          description?: string
          id?: string
          kind?: string
          name?: string
          price?: number
          rarity?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          reference?: string | null
          user_id?: string
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
      user_achievements: {
        Row: {
          achievement_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_items: {
        Row: {
          acquired_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_items_user_id_fkey"
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
      can_read_chat: {
        Args: {
          _channel: Database["public"]["Enums"]["chat_channel"]
          _game_id: string
          _room_id: string
        }
        Returns: boolean
      }
      charge_entry_fees: {
        Args: { _fee: number; _game_id: string; _user_ids: string[] }
        Returns: undefined
      }
      is_game_participant: { Args: { _game_id: string }; Returns: boolean }
      is_room_member: { Args: { _room_id: string }; Returns: boolean }
      shares_table_with: { Args: { _other: string }; Returns: boolean }
    }
    Enums: {
      chat_channel: "lobby" | "day" | "mafia" | "dead"
      game_phase: "lobby" | "night" | "day" | "voting" | "results" | "ended"
      game_role: "mafia" | "civilian" | "detective" | "doctor"
      room_status: "lobby" | "in_game" | "closed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      chat_channel: ["lobby", "day", "mafia", "dead"],
      game_phase: ["lobby", "night", "day", "voting", "results", "ended"],
      game_role: ["mafia", "civilian", "detective", "doctor"],
      room_status: ["lobby", "in_game", "closed"],
    },
  },
} as const
