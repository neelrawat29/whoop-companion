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
      chat_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          kind: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_entries: {
        Row: {
          created_at: string
          entry_date: string
          hrv: number | null
          id: string
          recovery: number | null
          rhr: number | null
          sleep_hours: number | null
          sleep_score: number | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          hrv?: number | null
          id?: string
          recovery?: number | null
          rhr?: number | null
          sleep_hours?: number | null
          sleep_score?: number | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          hrv?: number | null
          id?: string
          recovery?: number | null
          rhr?: number | null
          sleep_hours?: number | null
          sleep_score?: number | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          icon: string | null
          id: string
          invite_code: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          icon?: string | null
          id?: string
          invite_code?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          icon?: string | null
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      habits_log: {
        Row: {
          bedtime: string | null
          cool_room: boolean | null
          created_at: string
          drinks: number | null
          energy: number | null
          entry_date: string
          hydration: number | null
          id: string
          last_caffeine_time: string | null
          last_meal_time: string | null
          mood: number | null
          note: string | null
          screen_cutoff: string | null
          strain: number | null
          supplements: string[] | null
          updated_at: string
          user_id: string
          wake_time: string | null
          work_location: string | null
        }
        Insert: {
          bedtime?: string | null
          cool_room?: boolean | null
          created_at?: string
          drinks?: number | null
          energy?: number | null
          entry_date: string
          hydration?: number | null
          id?: string
          last_caffeine_time?: string | null
          last_meal_time?: string | null
          mood?: number | null
          note?: string | null
          screen_cutoff?: string | null
          strain?: number | null
          supplements?: string[] | null
          updated_at?: string
          user_id: string
          wake_time?: string | null
          work_location?: string | null
        }
        Update: {
          bedtime?: string | null
          cool_room?: boolean | null
          created_at?: string
          drinks?: number | null
          energy?: number | null
          entry_date?: string
          hydration?: number | null
          id?: string
          last_caffeine_time?: string | null
          last_meal_time?: string | null
          mood?: number | null
          note?: string | null
          screen_cutoff?: string | null
          strain?: number | null
          supplements?: string[] | null
          updated_at?: string
          user_id?: string
          wake_time?: string | null
          work_location?: string | null
        }
        Relationships: []
      }
      meal_presets: {
        Row: {
          carbs_g: number | null
          created_at: string
          description: string
          fat_g: number | null
          id: string
          kcal: number | null
          name: string
          protein_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          created_at?: string
          description?: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          name: string
          protein_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          created_at?: string
          description?: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          name?: string
          protein_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          barcode: string | null
          carbs_g: number | null
          created_at: string
          description: string
          entry_date: string
          fat_g: number | null
          id: string
          image_url: string | null
          kcal: number | null
          protein_g: number | null
          slot: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          carbs_g?: number | null
          created_at?: string
          description?: string
          entry_date: string
          fat_g?: number | null
          id?: string
          image_url?: string | null
          kcal?: number | null
          protein_g?: number | null
          slot: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          carbs_g?: number | null
          created_at?: string
          description?: string
          entry_date?: string
          fat_g?: number | null
          id?: string
          image_url?: string | null
          kcal?: number | null
          protein_g?: number | null
          slot?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pinned_insights: {
        Row: {
          content: string
          created_at: string
          id: string
          source: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          source?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          birth_year: number | null
          carbs_target: number | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          fat_target: number | null
          goal: string | null
          height_cm: number | null
          id: string
          kcal_target: number | null
          phone: string | null
          protein_target: number | null
          resting_hr_baseline: number | null
          sex: Database["public"]["Enums"]["sex_enum"] | null
          sleep_target_hours: number | null
          threshold_push: number
          threshold_rest: number
          timezone: string | null
          updated_at: string
          weight_goal_date: string | null
          weight_goal_kg: number | null
          weight_kg: number | null
          weight_unit: string
        }
        Insert: {
          activity_level?: string | null
          birth_year?: number | null
          carbs_target?: number | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          fat_target?: number | null
          goal?: string | null
          height_cm?: number | null
          id: string
          kcal_target?: number | null
          phone?: string | null
          protein_target?: number | null
          resting_hr_baseline?: number | null
          sex?: Database["public"]["Enums"]["sex_enum"] | null
          sleep_target_hours?: number | null
          threshold_push?: number
          threshold_rest?: number
          timezone?: string | null
          updated_at?: string
          weight_goal_date?: string | null
          weight_goal_kg?: number | null
          weight_kg?: number | null
          weight_unit?: string
        }
        Update: {
          activity_level?: string | null
          birth_year?: number | null
          carbs_target?: number | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          fat_target?: number | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          kcal_target?: number | null
          phone?: string | null
          protein_target?: number | null
          resting_hr_baseline?: number | null
          sex?: Database["public"]["Enums"]["sex_enum"] | null
          sleep_target_hours?: number | null
          threshold_push?: number
          threshold_rest?: number
          timezone?: string | null
          updated_at?: string
          weight_goal_date?: string | null
          weight_goal_kg?: number | null
          weight_kg?: number | null
          weight_unit?: string
        }
        Relationships: []
      }
      user_supplements: {
        Row: {
          brand: string | null
          calories: number | null
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          id: string
          name: string
          notes: string | null
          nutrients: Json
          protein_g: number | null
          serving_size: string | null
          time_of_day: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          name: string
          notes?: string | null
          nutrients?: Json
          protein_g?: number | null
          serving_size?: string | null
          time_of_day?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          name?: string
          notes?: string | null
          nutrients?: Json
          protein_g?: number | null
          serving_size?: string | null
          time_of_day?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weight_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          updated_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          updated_at?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: { Args: never; Returns: string }
      group_leaderboard: {
        Args: { _group_id: string }
        Returns: {
          avg_energy_7d: number
          avg_mood_7d: number
          avg_recovery_7d: number
          avg_sleep_hours_7d: number
          current_streak: number
          days_logged_7d: number
          display_name: string
          is_owner: boolean
          logged_today: boolean
          user_id: string
        }[]
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      sex_enum: "male" | "female" | "other"
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
      sex_enum: ["male", "female", "other"],
    },
  },
} as const
