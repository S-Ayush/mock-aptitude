#!/usr/bin/env node

/**
 * Import Questions Script
 * This script imports questions from questions.json into the Supabase database
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://blhvdmyjipvhtaqzqttf.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsaHZkbXlqaXB2aHRhcXpxdHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMDQ4NzYsImV4cCI6MjA3Mzg4MDg3Nn0.BDAW0s1P56Ppb9fOAyf6QrcoE8HtN5MRoZ9eb_9eLKg'

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function importQuestions() {
  try {
    console.log('🚀 Starting question import process...')
    
    // Read the questions.json file
    const questionsPath = path.join(__dirname, '..', 'questions.json')
    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'))
    
    console.log(`📄 Loaded ${questionsData.questions.length} questions from JSON`)
    
    // Get the current active test
    const { data: currentTest, error: testError } = await supabase
      .from('tests')
      .select('*')
      .eq('is_active', true)
      .single()
    
    if (testError || !currentTest) {
      console.error('❌ No active test found. Please create and activate a test first.')
      return
    }
    
    console.log(`📝 Found active test: ${currentTest.title} (ID: ${currentTest.id})`)
    
    // Clear existing questions for this test
    console.log('🗑️  Clearing existing questions...')
    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .eq('test_id', currentTest.id)
    
    if (deleteError) {
      console.error('❌ Error clearing existing questions:', deleteError)
      return
    }
    
    // Update the test with enhanced information
    console.log('📊 Updating test information...')
    const { error: updateTestError } = await supabase
      .from('tests')
      .update({
        title: questionsData.test_info.title,
        duration_minutes: questionsData.test_info.duration_minutes,
        total_questions: questionsData.test_info.total_questions
      })
      .eq('id', currentTest.id)
    
    if (updateTestError) {
      console.error('❌ Error updating test:', updateTestError)
      return
    }
    
    // Prepare questions for insertion
    const questionsToInsert = questionsData.questions.map((q, index) => ({
      test_id: currentTest.id,
      question_text: q.question,
      option_a: q.options[0].a,
      option_b: q.options[1].b,
      option_c: q.options[2].c,
      option_d: q.options[3].d,
      correct_answer: q.correct_answer.toUpperCase(),
      section: q.section,
      category: q.category,
      difficulty: q.difficulty,
      explanation: q.explanation,
      question_order: index + 1
    }))
    
    console.log('💾 Inserting questions into database...')
    
    // Insert questions in batches of 10
    const batchSize = 10
    for (let i = 0; i < questionsToInsert.length; i += batchSize) {
      const batch = questionsToInsert.slice(i, i + batchSize)
      
      const { error: insertError } = await supabase
        .from('questions')
        .insert(batch)
      
      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError)
        return
      }
      
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(questionsToInsert.length/batchSize)}`)
    }
    
    
    console.log('🎉 Successfully imported all questions!')
    console.log(`📊 Summary:`)
    console.log(`   - Total questions: ${questionsData.questions.length}`)
    console.log(`   - Test title: ${questionsData.test_info.title}`)
    console.log(`   - Duration: ${questionsData.test_info.duration_minutes} minutes`)
    console.log(`   - Sections: ${questionsData.test_info.sections.length}`)
    
    // Show section breakdown
    const sectionBreakdown = questionsData.questions.reduce((acc, q) => {
      acc[q.section] = (acc[q.section] || 0) + 1
      return acc
    }, {})
    
    console.log(`   - Section breakdown:`)
    Object.entries(sectionBreakdown).forEach(([section, count]) => {
      console.log(`     • ${section}: ${count} questions`)
    })
    
  } catch (error) {
    console.error('❌ Import failed:', error)
    process.exit(1)
  }
}

// Run the import
importQuestions()
