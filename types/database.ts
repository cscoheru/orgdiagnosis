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
      // ===== Project Management System =====
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          client_name: string | null
          client_industry: string | null
          status: 'draft' | 'requirement' | 'outline' | 'slides' | 'export' | 'completed' | 'archived'
          current_step: 'requirement' | 'outline' | 'slides' | 'export'
          langgraph_thread_id: string | null
          langgraph_checkpoint: string | null
          created_by: string | null
          client_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          client_name?: string | null
          client_industry?: string | null
          status?: 'draft' | 'requirement' | 'outline' | 'slides' | 'export' | 'completed' | 'archived'
          current_step?: 'requirement' | 'outline' | 'slides' | 'export'
          langgraph_thread_id?: string | null
          langgraph_checkpoint?: string | null
          created_by?: string | null
          client_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          client_name?: string | null
          client_industry?: string | null
          status?: 'draft' | 'requirement' | 'outline' | 'slides' | 'export' | 'completed' | 'archived'
          current_step?: 'requirement' | 'outline' | 'slides' | 'export'
          langgraph_thread_id?: string | null
          langgraph_checkpoint?: string | null
          created_by?: string | null
          client_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_requirements: {
        Row: {
          id: string
          project_id: string
          form_step: number
          form_completed: boolean
          client_name: string | null
          industry: string | null
          company_stage: string | null
          employee_count: number | null
          diagnosis_session_id: string | null
          pain_points: Json
          goals: Json
          timeline: string | null
          report_type: string
          slide_count: number
          focus_areas: Json
          reference_materials: Json
          tone: string
          language: string
          template_style: string
          special_requirements: string | null
          last_saved_at: string | null
          last_saved_field: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          form_step?: number
          form_completed?: boolean
          client_name?: string | null
          industry?: string | null
          company_stage?: string | null
          employee_count?: number | null
          diagnosis_session_id?: string | null
          pain_points?: Json
          goals?: Json
          timeline?: string | null
          report_type?: string
          slide_count?: number
          focus_areas?: Json
          reference_materials?: Json
          tone?: string
          language?: string
          template_style?: string
          special_requirements?: string | null
          last_saved_at?: string | null
          last_saved_field?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          form_step?: number
          form_completed?: boolean
          client_name?: string | null
          industry?: string | null
          company_stage?: string | null
          employee_count?: number | null
          diagnosis_session_id?: string | null
          pain_points?: Json
          goals?: Json
          timeline?: string | null
          report_type?: string
          slide_count?: number
          focus_areas?: Json
          reference_materials?: Json
          tone?: string
          language?: string
          template_style?: string
          special_requirements?: string | null
          last_saved_at?: string | null
          last_saved_field?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_outlines: {
        Row: {
          id: string
          project_id: string
          sections: Json
          version: number
          is_confirmed: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          generation_model: string | null
          generation_tokens: number | null
          rag_sources: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          sections?: Json
          version?: number
          is_confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          generation_model?: string | null
          generation_tokens?: number | null
          rag_sources?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          sections?: Json
          version?: number
          is_confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          generation_model?: string | null
          generation_tokens?: number | null
          rag_sources?: Json
          created_at?: string
          updated_at?: string
        }
      }
      project_slides: {
        Row: {
          id: string
          project_id: string
          slide_index: number
          section_id: string | null
          title: string
          subtitle: string | null
          key_message: string | null
          content: Json
          layout_type: string
          model_id: string | null
          model_params: Json
          status: 'draft' | 'generated' | 'edited' | 'approved'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          slide_index: number
          section_id?: string | null
          title: string
          subtitle?: string | null
          key_message?: string | null
          content?: Json
          layout_type?: string
          model_id?: string | null
          model_params?: Json
          status?: 'draft' | 'generated' | 'edited' | 'approved'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          slide_index?: number
          section_id?: string | null
          title?: string
          subtitle?: string | null
          key_message?: string | null
          content?: Json
          layout_type?: string
          model_id?: string | null
          model_params?: Json
          status?: 'draft' | 'generated' | 'edited' | 'approved'
          created_at?: string
          updated_at?: string
        }
      }
      project_exports: {
        Row: {
          id: string
          project_id: string
          format: string
          file_path: string | null
          file_size_kb: number | null
          download_url: string | null
          slide_count: number | null
          generation_time_ms: number | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          error_message: string | null
          created_at: string
          completed_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          project_id: string
          format?: string
          file_path?: string | null
          file_size_kb?: number | null
          download_url?: string | null
          slide_count?: number | null
          generation_time_ms?: number | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          format?: string
          file_path?: string | null
          file_size_kb?: number | null
          download_url?: string | null
          slide_count?: number | null
          generation_time_ms?: number | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
          created_by?: string | null
        }
      }
      slide_models: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string | null
          layout_type: string
          default_config: Json
          preview_image_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          category?: string | null
          layout_type: string
          default_config?: Json
          preview_image_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string | null
          layout_type?: string
          default_config?: Json
          preview_image_url?: string | null
          is_active?: boolean
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
