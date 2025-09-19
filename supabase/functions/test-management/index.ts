import { corsHeaders } from '../_shared/cors.ts'

const corsHeadersWithAuth = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { supabaseClient } = await import('../_shared/supabase-client.ts')
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    
    switch (action) {
      case 'start-test': {
        const { studentId, testId } = await req.json()
        
        // Check if test is active and within time bounds
        const { data: test, error: testError } = await supabaseClient
          .from('tests')
          .select('*')
          .eq('id', testId)
          .eq('is_active', true)
          .single()
          
        if (testError || !test) {
          return new Response(
            JSON.stringify({ error: 'Test not found or not active' }), 
            { status: 400, headers: corsHeadersWithAuth }
          )
        }
        
        const now = new Date()
        const startTime = new Date(test.start_time)
        const endTime = new Date(test.end_time)
        
        if (now < startTime || now > endTime) {
          return new Response(
            JSON.stringify({ error: 'Test is not available at this time' }), 
            { status: 400, headers: corsHeadersWithAuth }
          )
        }
        
        // Check if student already has an attempt
        const { data: existingAttempt } = await supabaseClient
          .from('test_attempts')
          .select('*')
          .eq('student_id', studentId)
          .eq('test_id', testId)
          .single()
          
        if (existingAttempt) {
          if (existingAttempt.is_completed) {
            return new Response(
              JSON.stringify({ error: 'You have already completed this test' }), 
              { status: 400, headers: corsHeadersWithAuth }
            )
          } else {
            // Return existing attempt
            return new Response(
              JSON.stringify({ attemptId: existingAttempt.id, startedAt: existingAttempt.started_at }), 
              { headers: corsHeadersWithAuth }
            )
          }
        }
        
        // Create new attempt
        const { data: attempt, error: attemptError } = await supabaseClient
          .from('test_attempts')
          .insert({
            student_id: studentId,
            test_id: testId,
            started_at: new Date().toISOString()
          })
          .select()
          .single()
          
        if (attemptError) {
          return new Response(
            JSON.stringify({ error: 'Failed to start test' }), 
            { status: 500, headers: corsHeadersWithAuth }
          )
        }
        
        return new Response(
          JSON.stringify({ attemptId: attempt.id, startedAt: attempt.started_at }), 
          { headers: corsHeadersWithAuth }
        )
      }
      
      case 'submit-answer': {
        const { attemptId, questionId, selectedAnswer } = await req.json()
        
        // Check if answer is correct
        const { data: question } = await supabaseClient
          .from('questions')
          .select('correct_answer')
          .eq('id', questionId)
          .single()
          
        const isCorrect = question?.correct_answer === selectedAnswer
        
        // Insert or update answer
        const { error: answerError } = await supabaseClient
          .from('student_answers')
          .upsert({
            attempt_id: attemptId,
            question_id: questionId,
            selected_answer: selectedAnswer,
            is_correct: isCorrect
          })
          
        if (answerError) {
          return new Response(
            JSON.stringify({ error: 'Failed to save answer' }), 
            { status: 500, headers: corsHeadersWithAuth }
          )
        }
        
        return new Response(
          JSON.stringify({ success: true }), 
          { headers: corsHeadersWithAuth }
        )
      }
      
      case 'submit-test': {
        const { attemptId } = await req.json()
        
        // Get all answers for this attempt
        const { data: answers } = await supabaseClient
          .from('student_answers')
          .select('*')
          .eq('attempt_id', attemptId)
          
        // Calculate detailed score
        let score = 0
        let correct = 0
        let incorrect = 0
        
        answers?.forEach(answer => {
          if (answer.is_correct) {
            score += 1
            correct += 1
          } else {
            score -= 0.25
            incorrect += 1
          }
        })
        
        const attempted = answers?.length || 0
        const unattempted = 40 - attempted
        
        // Update attempt
        const { error: updateError } = await supabaseClient
          .from('test_attempts')
          .update({
            submitted_at: new Date().toISOString(),
            score: score,
            is_completed: true
          })
          .eq('id', attemptId)
          
        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to submit test' }), 
            { status: 500, headers: corsHeadersWithAuth }
          )
        }
        
        return new Response(
          JSON.stringify({ 
            score,
            attempted,
            correct,
            incorrect,
            unattempted
          }), 
          { headers: corsHeadersWithAuth }
        )
      }
      
      case 'get-results': {
        const { data: results, error: resultsError } = await supabaseClient
          .from('test_attempts')
          .select(`
            *,
            students(name, email, enrollment_number),
            tests(title)
          `)
          .eq('is_completed', true)
          .order('submitted_at', { ascending: false })
          
        if (resultsError) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch results' }), 
            { status: 500, headers: corsHeadersWithAuth }
          )
        }
        
        return new Response(
          JSON.stringify(results), 
          { headers: corsHeadersWithAuth }
        )
      }
      
      case 'manage-test': {
        const { testId, updates } = await req.json()
        
        const { error: updateError } = await supabaseClient
          .from('tests')
          .update(updates)
          .eq('id', testId)
          
        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to update test' }), 
            { status: 500, headers: corsHeadersWithAuth }
          )
        }
        
        return new Response(
          JSON.stringify({ success: true }), 
          { headers: corsHeadersWithAuth }
        )
      }
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }), 
          { status: 400, headers: corsHeadersWithAuth }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: corsHeadersWithAuth }
    )
  }
})