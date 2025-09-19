/*
  # Testing Platform Database Schema

  1. New Tables
    - `students`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text, unique)
      - `enrollment_number` (text, unique)
      - `created_at` (timestamp)
    
    - `tests`
      - `id` (uuid, primary key)
      - `title` (text)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `duration_minutes` (integer, default 60)
      - `total_questions` (integer, default 40)
      - `is_active` (boolean, default false)
      - `created_at` (timestamp)
    
    - `questions`
      - `id` (uuid, primary key)
      - `test_id` (uuid, foreign key)
      - `question_text` (text)
      - `option_a` (text)
      - `option_b` (text)
      - `option_c` (text)
      - `option_d` (text)
      - `correct_answer` (text)
      - `created_at` (timestamp)
    
    - `test_attempts`
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key)
      - `test_id` (uuid, foreign key)
      - `started_at` (timestamptz)
      - `submitted_at` (timestamptz)
      - `score` (decimal)
      - `is_completed` (boolean, default false)
      - `created_at` (timestamp)
    
    - `student_answers`
      - `id` (uuid, primary key)
      - `attempt_id` (uuid, foreign key)
      - `question_id` (uuid, foreign key)
      - `selected_answer` (text)
      - `is_correct` (boolean)
      - `created_at` (timestamp)

  2. Security
    - No RLS policies as requested
    - Tables are open for the application to manage
*/

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  enrollment_number text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tests table
CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Online Test',
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer DEFAULT 60,
  total_questions integer DEFAULT 40,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES tests(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_answer text NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  created_at timestamptz DEFAULT now()
);

-- Test attempts table
CREATE TABLE IF NOT EXISTS test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  test_id uuid REFERENCES tests(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  score decimal DEFAULT 0,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, test_id)
);

-- Student answers table
CREATE TABLE IF NOT EXISTS student_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES test_attempts(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer text CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
  is_correct boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

-- Insert a default test
INSERT INTO tests (title, start_time, end_time, is_active) VALUES 
('Sample Test', now(), now() + interval '7 days', true)
ON CONFLICT DO NOTHING;

-- Insert sample questions for the default test
DO $$
DECLARE
  test_uuid uuid;
BEGIN
  SELECT id INTO test_uuid FROM tests WHERE title = 'Sample Test' LIMIT 1;
  
  IF test_uuid IS NOT NULL THEN
    INSERT INTO questions (test_id, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES
    (test_uuid, 'What is the capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', 'C'),
    (test_uuid, 'Which planet is known as the Red Planet?', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'B'),
    (test_uuid, 'What is 2 + 2?', '3', '4', '5', '6', 'B'),
    (test_uuid, 'Who wrote Romeo and Juliet?', 'Charles Dickens', 'William Shakespeare', 'Mark Twain', 'Jane Austen', 'B'),
    (test_uuid, 'What is the largest ocean?', 'Atlantic', 'Indian', 'Arctic', 'Pacific', 'D')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;