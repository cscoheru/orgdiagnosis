/**
 * Supabase 数据库类型定义
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          role: string
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          role?: string
          created_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          name: string
          industry: string | null
          employee_count: number | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          industry?: string | null
          employee_count?: number | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          industry?: string | null
          employee_count?: number | null
          created_by?: string
          created_at?: string
        }
      }
      diagnosis_sessions: {
        Row: {
          id: string
          client_id: string | null
          created_by: string
          raw_input: string
          data_strategy: Json | null
          data_structure: Json | null
          data_performance: Json | null
          data_compensation: Json | null
          data_talent: Json | null
          overall_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          created_by: string
          raw_input: string
          data_strategy?: Json | null
          data_structure?: Json | null
          data_performance?: Json | null
          data_compensation?: Json | null
          data_talent?: Json | null
          overall_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          created_by?: string
          raw_input?: string
          data_strategy?: Json | null
          data_structure?: Json | null
          data_performance?: Json | null
          data_compensation?: Json | null
          data_talent?: Json | null
          overall_score?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
