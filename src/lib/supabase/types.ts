export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string; city: string | null; created_at: string };
        Insert: { id: string; name: string; city?: string | null; created_at?: string };
        Update: { id?: string; name?: string; city?: string | null; created_at?: string };
        Relationships: [];
      };
      challenges: {
        Row: {
          id: string;
          title: string;
          emoji: string;
          metric: "distance_km" | "distinct_days" | "single_run_km";
          goal: number;
          description: string;
          window_label: string;
          points: number;
          bonus: number;
          sort_order: number;
        };
        Insert: {
          id: string;
          title: string;
          emoji: string;
          metric: "distance_km" | "distinct_days" | "single_run_km";
          goal: number;
          description: string;
          window_label: string;
          points: number;
          bonus: number;
          sort_order?: number;
        };
        Update: {
          id?: string;
          title?: string;
          emoji?: string;
          metric?: "distance_km" | "distinct_days" | "single_run_km";
          goal?: number;
          description?: string;
          window_label?: string;
          points?: number;
          bonus?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
      runs: {
        Row: {
          id: string;
          runner_id: string;
          distance_km: number;
          date: string;
          source: string;
          challenge_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          runner_id: string;
          distance_km: number;
          date: string;
          source: string;
          challenge_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          runner_id?: string;
          distance_km?: number;
          date?: string;
          source?: string;
          challenge_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      completions: {
        Row: {
          id: string;
          challenge_id: string;
          runner_id: string;
          points: number;
          champion: boolean;
          completed_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          runner_id: string;
          points: number;
          champion?: boolean;
          completed_at?: string;
        };
        Update: {
          id?: string;
          challenge_id?: string;
          runner_id?: string;
          points?: number;
          champion?: boolean;
          completed_at?: string;
        };
        Relationships: [];
      };
      champions: {
        Row: { challenge_id: string; runner_id: string; completed_at: string };
        Insert: { challenge_id: string; runner_id: string; completed_at?: string };
        Update: { challenge_id?: string; runner_id?: string; completed_at?: string };
        Relationships: [];
      };
      rewards: {
        Row: { id: string; name: string; emoji: string; cost: number; description: string; sort_order: number };
        Insert: {
          id: string;
          name: string;
          emoji: string;
          cost: number;
          description: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          name?: string;
          emoji?: string;
          cost?: number;
          description?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      redemptions: {
        Row: {
          id: string;
          runner_id: string;
          reward_id: string;
          points_cost: number;
          status: string;
          redeemed_at: string;
        };
        Insert: {
          id?: string;
          runner_id: string;
          reward_id: string;
          points_cost: number;
          status?: string;
          redeemed_at?: string;
        };
        Update: {
          id?: string;
          runner_id?: string;
          reward_id?: string;
          points_cost?: number;
          status?: string;
          redeemed_at?: string;
        };
        Relationships: [];
      };
      running_zones: {
        Row: {
          id: string;
          district: string;
          name: string;
          description: string | null;
          submitted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          district: string;
          name: string;
          description?: string | null;
          submitted_by: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          district?: string;
          name?: string;
          description?: string | null;
          submitted_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      log_run: {
        Args: {
          p_distance_km: number;
          p_date: string;
          p_source: string;
          p_challenge_id: string | null;
          p_note: string | null;
        };
        Returns: Json;
      };
      redeem_reward: {
        Args: { p_reward_id: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}
