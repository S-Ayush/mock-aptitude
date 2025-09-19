import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Student = {
  id: string
  name: string
  email: string
  enrollment_number: string
  created_at: string
}

export type Test = {
  id: string
  title: string
  start_time: string
  end_time: string
  duration_minutes: number
  total_questions: number
  is_active: boolean
  created_at: string
}

export type Question = {
  id: string
  test_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  created_at: string
}

export type TestAttempt = {
  id: string
  student_id: string
  test_id: string
  started_at: string
  submitted_at?: string
  score: number
  is_completed: boolean
  created_at: string
}