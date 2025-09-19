-- Enhanced Questions Migration
-- This migration enhances the questions table to support the richer structure from questions.json

-- Add new columns to the existing questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS section text,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS difficulty text,
ADD COLUMN IF NOT EXISTS explanation text,
ADD COLUMN IF NOT EXISTS question_order integer DEFAULT 0;

-- Update the correct_answer constraint to support lowercase letters
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_correct_answer_check;
ALTER TABLE questions ADD CONSTRAINT questions_correct_answer_check 
  CHECK (correct_answer IN ('A', 'B', 'C', 'D', 'a', 'b', 'c', 'd'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_test_id_order ON questions(test_id, question_order);
CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
