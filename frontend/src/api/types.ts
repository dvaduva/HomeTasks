// API DTOs — shapes returned by Flask /api/* endpoints.

export type TaskStatus = 'pending' | 'completed' | 'refused';
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface User {
  id: number;
  name: string;
  color: string;
  created_at: string | null;
}

export interface Task {
  id: number;
  description: string;
  user_id: number;
  user_name?: string | null;
  status: TaskStatus | null;
  scheduled_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  recurrence_pattern: RecurrencePattern | null;
  recurrence_end_date: string | null;
  comment_count?: number;
}

export interface Comment {
  id: number;
  text: string;
  task_id: number;
  user_id: number;
  user_name?: string | null;
  created_at: string | null;
}

export interface Preferences {
  id: number;
  language: 'ro' | 'en';
  date_format: string;
  time_format: string;
  weather_city: string;
  weather_units: string;
  weather_update_interval: number;
  ai_enabled: boolean;
  ai_provider: string;
  ollama_base_url: string;
  ai_model: string;
  ai_temperature: number;
  ai_max_tokens: number;
  openrouter_api_key: string;
  groq_api_key: string;
  gemini_api_key: string;
  mistral_api_key: string;
  voice_language: string;
  voice_sensitivity: number;
  voice_auto_start: boolean;
  voice_activation_word: string;
  voice_debug_log: boolean;
  tuya_enabled: boolean;
  tuya_access_id: string;
  tuya_access_secret: string;
  tuya_api_region: string;
}

export interface TaskQuery {
  user_id?: number;
  status?: TaskStatus;
  start_date?: string;
  end_date?: string;
}

export interface TaskCreate {
  description: string;
  user_id: number;
  scheduled_date: string;
  recurrence_pattern?: RecurrencePattern;
  recurrence_end_date?: string | null;
}

export type TaskUpdate = Partial<TaskCreate> & { status?: TaskStatus };
