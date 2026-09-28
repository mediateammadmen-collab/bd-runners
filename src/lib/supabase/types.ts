export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CompletionStatus = "awaiting_proof" | "pending" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          city: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          city?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
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
          starts_at: string | null;
          ends_at: string | null;
          archived: boolean;
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
          starts_at?: string | null;
          ends_at?: string | null;
          archived?: boolean;
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
          starts_at?: string | null;
          ends_at?: string | null;
          archived?: boolean;
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
          status: CompletionStatus;
          photo_path: string | null;
          proof_path: string | null;
          submitted_at: string | null;
          reviewed_at: string | null;
          review_note: string | null;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          runner_id: string;
          points: number;
          champion?: boolean;
          completed_at?: string;
          status?: CompletionStatus;
          photo_path?: string | null;
          proof_path?: string | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
        };
        Update: {
          id?: string;
          challenge_id?: string;
          runner_id?: string;
          points?: number;
          champion?: boolean;
          completed_at?: string;
          status?: CompletionStatus;
          photo_path?: string | null;
          proof_path?: string | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
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
    Views: {
      challenge_progress: {
        Row: { challenge_id: string; runner_id: string; runner_name: string; progress: number };
        Relationships: [];
      };
      challenge_stats: {
        Row: { challenge_id: string; participants: number; completions: number; pending_reviews: number };
        Relationships: [];
      };
    };
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
      public_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      submit_completion_proof: {
        Args: { p_challenge_id: string; p_photo_path: string; p_proof_path: string | null };
        Returns: Json;
      };
      review_completion: {
        Args: { p_completion_id: string; p_approve: boolean; p_note: string | null };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}
