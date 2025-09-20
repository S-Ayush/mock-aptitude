import React, { useState, useEffect, useCallback } from 'react'
import { Clock, User, LogOut, CheckCircle, AlertTriangle, Send, BookOpen, Target, Award, Brain, Code, BarChart3, Zap } from 'lucide-react'
import { supabase, Student, Test, Question } from '../lib/supabase'

interface StudentTestProps {
  student: Student
  onLogout: () => void
}

export default function StudentTest({ student, onLogout }: StudentTestProps) {
  const [currentTest, setCurrentTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(3600) // 60 minutes in seconds
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [testStatus, setTestStatus] = useState<'not-started' | 'in-progress' | 'completed'>('not-started')
  const [submitting, setSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<{ 
    score: number
    totalQuestions: number
    attempted: number
    correct: number
    incorrect: number
    unattempted: number
  } | null>(null)
  const [currentSection, setCurrentSection] = useState<string>('')

  // Static test metadata
  const testMetadata = {
    title: "Mock Placement Drive - Aptitude Round",
    duration_minutes: 60,
    total_questions: 40,
    marking_scheme: {
      correct_answer: 1,
      incorrect_answer: -0.25,
      unanswered: 0
    },
    passing_criteria: "50% (20/40 questions)",
    sections: [
      { section_name: "Logical Reasoning", question_range: "1-20" },
      { section_name: "Basic Programming Concepts", question_range: "21-40" }
    ]
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-management`
  const apiHeaders = {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }

  const loadActiveTest = useCallback(async () => {
    try {
      const { data: tests, error } = await supabase
        .from('tests')
        .select('*')
        .eq('is_active', true)
        .single()

      if (error || !tests) {
        setError('No active test available at the moment.')
        return
      }

      const now = new Date()
      const startTime = new Date(tests.start_time)
      const endTime = new Date(tests.end_time)

      if (now < startTime) {
        setError(`Test will start at ${startTime.toLocaleString()}`)
        return
      }

      if (now > endTime) {
        setError('Test time has expired.')
        return
      }

      setCurrentTest(tests)
      setTimeLeft(tests.duration_minutes * 60)

      // Load questions ordered by question_order
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('test_id', tests.id)
        .order('question_order', { ascending: true })

      if (questionsError) {
        setError('Failed to load test questions.')
        return
      }

      if (!questionsData || questionsData.length !== 40) {
        setError('Test must have exactly 40 questions. Please contact administrator.')
        return
      }

      setQuestions(questionsData)

      // Check if student has already started this test
      const { data: existingAttempt } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('student_id', student.id)
        .eq('test_id', tests.id)
        .single()

      if (existingAttempt) {
        if (existingAttempt.is_completed) {
          setTestStatus('completed')
          // Calculate detailed results
          const { data: studentAnswers } = await supabase
            .from('student_answers')
            .select('*')
            .eq('attempt_id', existingAttempt.id)

          const attempted = studentAnswers?.length || 0
          const correct = studentAnswers?.filter(a => a.is_correct).length || 0
          const incorrect = attempted - correct
          const unattempted = 40 - attempted

          setTestResult({
            score: existingAttempt.score,
            totalQuestions: 40,
            attempted,
            correct,
            incorrect,
            unattempted
          })
        } else {
          setAttemptId(existingAttempt.id)
          setTestStatus('in-progress')
          
          // Calculate remaining time
          const startTime = new Date(existingAttempt.started_at)
          const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
          const remaining = Math.max(0, 3600 - elapsed)
          setTimeLeft(remaining)

          // Load existing answers
          const { data: existingAnswers } = await supabase
            .from('student_answers')
            .select('question_id, selected_answer')
            .eq('attempt_id', existingAttempt.id)

          const answersMap: Record<string, string> = {}
          existingAnswers?.forEach(answer => {
            answersMap[answer.question_id] = answer.selected_answer
          })
          setAnswers(answersMap)
        }
      }
    } catch (err) {
      setError('Failed to load test. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [student.id])

  const startTest = async () => {
    if (!currentTest) return

    try {
      const response = await fetch(`${apiUrl}?action=start-test`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          studentId: student.id,
          testId: currentTest.id
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        setError(result.error || 'Failed to start test')
        return
      }

      setAttemptId(result.attemptId)
      setTestStatus('in-progress')
      setTimeLeft(3600)
    } catch (err) {
      setError('Failed to start test. Please try again.')
    }
  }

  const saveAnswer = async (questionId: string, selectedAnswer: string) => {
    if (!attemptId) return

    try {
      await fetch(`${apiUrl}?action=submit-answer`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          attemptId,
          questionId,
          selectedAnswer
        })
      })
    } catch (err) {
      console.error('Failed to save answer:', err)
    }
  }

  const handleAnswerSelect = (questionId: string, selectedAnswer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: selectedAnswer }))
    saveAnswer(questionId, selectedAnswer)
  }

  const submitTest = async () => {
    if (!attemptId) return

    const confirmSubmit = window.confirm(
      `Are you sure you want to submit the test?\n\nAttempted: ${Object.keys(answers).length}/40 questions\nUnattempted: ${40 - Object.keys(answers).length} questions\n\nYou cannot change your answers after submission.`
    )

    if (!confirmSubmit) return

    setSubmitting(true)
    try {
      const response = await fetch(`${apiUrl}?action=submit-test`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ attemptId })
      })

      const result = await response.json()
      
      if (response.ok) {
        // Calculate detailed results
        const attempted = Object.keys(answers).length
        const { data: studentAnswers } = await supabase
          .from('student_answers')
          .select('*')
          .eq('attempt_id', attemptId)

        const correct = studentAnswers?.filter(a => a.is_correct).length || 0
        const incorrect = attempted - correct
        const unattempted = 40 - attempted

        setTestResult({
          score: result.score,
          totalQuestions: 40,
          attempted,
          correct,
          incorrect,
          unattempted
        })
        setTestStatus('completed')
      }
    } catch (err) {
      setError('Failed to submit test. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Timer effect
  useEffect(() => {
    if (testStatus === 'in-progress' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            submitTest()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [testStatus, timeLeft])

  useEffect(() => {
    loadActiveTest()
  }, [loadActiveTest])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getQuestionStatus = (questionId: string) => {
    return answers[questionId] ? 'answered' : 'unanswered'
  }

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'Logical Reasoning':
        return <Brain className="w-5 h-5" />
      case 'Basic Programming':
        return <Code className="w-5 h-5" />
      default:
        return <BookOpen className="w-5 h-5" />
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'text-green-600 bg-green-100'
      case 'Medium':
        return 'text-yellow-600 bg-yellow-100'
      case 'Hard':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  // Update current section when question changes
  useEffect(() => {
    if (questions[currentQuestionIndex]) {
      setCurrentSection(questions[currentQuestionIndex].section || '')
    }
  }, [currentQuestionIndex, questions])

  // Function to format question text with simple code highlighting
  const formatQuestionText = (text: string) => {
    if (!text) return null
    
    const lines = text.split('\n')
    let result: JSX.Element[] = []
    let codeLines: string[] = []
    let inCodeBlock = false
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      
      // Only start code block if we see specific code indicators
      if (trimmedLine.toLowerCase().includes('pseudocode') || 
          trimmedLine.toLowerCase().includes('algorithm') ||
          trimmedLine.toLowerCase().includes('program') ||
          trimmedLine.toLowerCase().includes('output of') ||
          trimmedLine.toLowerCase().includes('what will be the output')) {
        
        // Close any existing code block first
        if (codeLines.length > 0) {
          result.push(
            <div key={`code-${index}`} className="my-4">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-t-lg text-sm font-semibold">
                💻 Code
              </div>
              <pre className="bg-gray-50 border border-gray-200 text-gray-800 p-4 rounded-b-lg overflow-x-auto font-mono text-sm">
                <code>{codeLines.join('\n')}</code>
              </pre>
            </div>
          )
          codeLines = []
        }
        
        inCodeBlock = true
        return
      }
      
      // Check if this is a code line (more restrictive)
      const isCodeLine = 
        (trimmedLine.startsWith('x =') && trimmedLine.length < 20) || 
        (trimmedLine.startsWith('if (') && trimmedLine.includes(')')) || 
        (trimmedLine.startsWith('while (') && trimmedLine.includes(')')) || 
        (trimmedLine.startsWith('for ') && trimmedLine.includes('to')) ||
        (trimmedLine.startsWith('array ') && trimmedLine.includes('=')) ||
        (trimmedLine.startsWith('function ') && trimmedLine.includes('(')) ||
        (trimmedLine.startsWith('print ') && trimmedLine.includes('"')) ||
        (trimmedLine.startsWith('return ') && trimmedLine.length < 30) ||
        (trimmedLine.startsWith('else:') && trimmedLine.length < 10) ||
        (trimmedLine.startsWith('}') && trimmedLine.length < 5) ||
        (trimmedLine.startsWith('{') && trimmedLine.length < 5) ||
        (trimmedLine.startsWith('result') && trimmedLine.includes('=')) ||
        (trimmedLine.startsWith('i =') && trimmedLine.length < 15) ||
        (trimmedLine.startsWith('j =') && trimmedLine.length < 15) ||
        (trimmedLine.startsWith('n =') && trimmedLine.length < 15) ||
        (trimmedLine.startsWith('num') && trimmedLine.includes('=')) ||
        (trimmedLine.startsWith('for i') && trimmedLine.includes('to')) ||
        (trimmedLine.startsWith('for j') && trimmedLine.includes('to')) ||
        (trimmedLine.startsWith('for each') && trimmedLine.includes('in')) ||
        (trimmedLine.startsWith('do ') && trimmedLine.length < 10) ||
        (trimmedLine.startsWith('end') && trimmedLine.length < 10) ||
        (trimmedLine.startsWith('begin') && trimmedLine.length < 10) ||
        (trimmedLine.includes('MOD') && trimmedLine.includes('==')) ||
        (trimmedLine.includes('AND') && trimmedLine.includes('(')) ||
        (trimmedLine.includes('OR') && trimmedLine.includes('(')) ||
        (trimmedLine.length > 0 && (trimmedLine.startsWith('    ') || trimmedLine.startsWith('\t')))
      
      if (inCodeBlock && isCodeLine) {
        codeLines.push(line)
      } else if (inCodeBlock && !isCodeLine && trimmedLine === '') {
        // Empty line in code block, continue
        codeLines.push(line)
      } else if (inCodeBlock && !isCodeLine && trimmedLine !== '') {
        // End of code block
        if (codeLines.length > 0) {
          result.push(
            <div key={`code-${index}`} className="my-4">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-t-lg text-sm font-semibold">
                💻 Code
              </div>
              <pre className="bg-gray-50 border border-gray-200 text-gray-800 p-4 rounded-b-lg overflow-x-auto font-mono text-sm">
                <code>{codeLines.join('\n')}</code>
              </pre>
            </div>
          )
          codeLines = []
        }
        inCodeBlock = false
        result.push(<div key={index} className="mb-2">{line}</div>)
      } else {
        // Always show the question text
        result.push(<div key={index} className="mb-2">{line}</div>)
      }
    })
    
    // Handle any remaining code block
    if (inCodeBlock && codeLines.length > 0) {
      result.push(
        <div key="code-final" className="my-4">
          <div className="bg-blue-600 text-white px-3 py-1 rounded-t-lg text-sm font-semibold">
            💻 Code
          </div>
          <pre className="bg-gray-50 border border-gray-200 text-gray-800 p-4 rounded-b-lg overflow-x-auto font-mono text-sm">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      )
    }
    
    return result
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-gray-600 text-lg">Loading test...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertTriangle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Test Unavailable</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">{error}</p>
          <button
            onClick={onLogout}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 font-semibold"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (testStatus === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-6 text-white text-center">
            <CheckCircle className="w-20 h-20 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Test Completed Successfully!</h2>
            <p className="text-green-100">Your results have been recorded</p>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                <BookOpen className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-900">{testResult?.totalQuestions}</p>
                <p className="text-sm text-blue-600 font-medium">Total Questions</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl text-center">
                <Target className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-900">{testResult?.attempted}</p>
                <p className="text-sm text-green-600 font-medium">Attempted</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl text-center">
                <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-emerald-900">{testResult?.correct}</p>
                <p className="text-sm text-emerald-600 font-medium">Correct</p>
              </div>
              <div className="bg-red-50 p-4 rounded-xl text-center">
                <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-900">{testResult?.incorrect}</p>
                <p className="text-sm text-red-600 font-medium">Incorrect</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 text-center">
              <Award className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-2">Your Final Score</p>
              <p className="text-4xl font-bold text-blue-600 mb-2">{testResult?.score?.toFixed(2)}</p>
              <p className="text-gray-600">out of 40 marks</p>
              <div className="mt-4 bg-white rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  Accuracy: {testResult?.attempted ? ((testResult.correct / testResult.attempted) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 font-semibold text-lg"
            >
              Exit Test Platform
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (testStatus === 'not-started') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{student.name}</h2>
                <p className="text-gray-600">{student.enrollment_number}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors px-4 py-2 rounded-lg hover:bg-white"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-8 text-white text-center">
                <BookOpen className="w-16 h-16 mx-auto mb-4" />
                <h1 className="text-3xl font-bold mb-2">{testMetadata?.title || currentTest?.title}</h1>
                <p className="text-blue-100 text-lg">Online Examination System</p>
                {testMetadata?.sections && (
                  <div className="mt-4 flex justify-center space-x-4">
                    {testMetadata.sections.map((section, index) => (
                      <div key={index} className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
                        {getSectionIcon(section.section_name)}
                        <span className="text-sm font-medium">{section.section_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl text-center">
                    <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                    <p className="text-sm text-blue-600 font-semibold uppercase tracking-wide">Questions</p>
                    <p className="text-3xl font-bold text-blue-900">{testMetadata?.total_questions || currentTest?.total_questions || 40}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl text-center">
                    <Clock className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <p className="text-sm text-green-600 font-semibold uppercase tracking-wide">Duration</p>
                    <p className="text-3xl font-bold text-green-900">{testMetadata?.duration_minutes || currentTest?.duration_minutes || 60} min</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl text-center">
                    <Target className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                    <p className="text-sm text-purple-600 font-semibold uppercase tracking-wide">Scoring</p>
                    <p className="text-lg font-bold text-purple-900">
                      +{testMetadata?.marking_scheme?.correct_answer || 1} / {testMetadata?.marking_scheme?.incorrect_answer || -0.25}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl text-center">
                    <BarChart3 className="w-12 h-12 text-orange-600 mx-auto mb-3" />
                    <p className="text-sm text-orange-600 font-semibold uppercase tracking-wide">Passing</p>
                    <p className="text-lg font-bold text-orange-900">{testMetadata?.passing_criteria || '50%'}</p>
                  </div>
                </div>

                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-6 mb-8">
                  <h3 className="font-bold text-amber-800 mb-4 flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    Important Instructions
                  </h3>
                  <ul className="text-amber-700 space-y-2">
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Each correct answer awards <strong>+1 mark</strong>
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Each incorrect answer deducts <strong>-0.25 marks</strong>
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Test will <strong>auto-submit after 60 minutes</strong>
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      You can <strong>submit anytime</strong> before time expires
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      You <strong>cannot restart</strong> once the test begins
                    </li>
                  </ul>
                </div>

                <button
                  onClick={startTest}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-8 rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg"
                >
                  Start Test Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100
  const answeredCount = Object.keys(answers).length
  const unansweredCount = 40 - answeredCount

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-4">
        {/* Enhanced Header */}
        <div className="bg-white rounded-xl shadow-sm mb-6 p-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{student.name}</p>
                <p className="text-sm text-gray-600">{student.enrollment_number}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Answered: <strong>{answeredCount}</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <span className="text-gray-600">Remaining: <strong>{unansweredCount}</strong></span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 bg-red-50 px-4 py-2 rounded-lg">
                <Clock className="w-5 h-5 text-red-600" />
                <span className="font-mono font-bold text-red-800 text-lg">{formatTime(timeLeft)}</span>
              </div>
              
              <button
                onClick={submitTest}
                disabled={submitting}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center space-x-2 font-semibold"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Submit Test'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Enhanced Question Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Question Navigator</h3>
                <div className="text-sm text-gray-600">
                  {currentQuestionIndex + 1}/40
                </div>
              </div>
              
              <div className="mb-4">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 mt-1">{progress.toFixed(0)}% Complete</p>
              </div>

              <div className="space-y-4">
                {/* Show all questions in a simple grid */}
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((question, index) => {
                    const isAnswered = answers[question?.id]
                    const isCurrent = index === currentQuestionIndex
                    
                    return (
                      <button
                        key={index}
                        onClick={() => setCurrentQuestionIndex(index)}
                        className={`aspect-square rounded-lg text-sm font-semibold transition-all transform hover:scale-105 ${
                          isCurrent
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                            : isAnswered
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={`Question ${index + 1}${question?.section ? ` - ${question.section}` : ''}${question?.difficulty ? ` (${question.difficulty})` : ''}`}
                      >
                        {index + 1}
                      </button>
                    )
                  })}
                </div>
                
                {/* Section breakdown for reference */}
                {testMetadata?.sections && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-gray-600">Section Breakdown:</p>
                    {testMetadata.sections.map((section, index) => {
                      return (
                        <div key={index} className="flex items-center space-x-2 text-xs text-gray-500">
                          {getSectionIcon(section.section_name)}
                          <span>{section.section_name}: 20 questions</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded"></div>
                  <span className="text-gray-600">Current Question</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded"></div>
                  <span className="text-gray-600">Answered</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-100 rounded"></div>
                  <span className="text-gray-600">Not Answered</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Question Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm p-8">
              <div className="mb-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <div className="flex items-center space-x-4 mb-2">
                      <h2 className="text-2xl font-bold text-gray-900">
                        Question {currentQuestionIndex + 1}
                      </h2>
                      {currentQuestion?.section && (
                        <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {getSectionIcon(currentQuestion.section)}
                          <span>{currentQuestion.section}</span>
                        </div>
                      )}
                      {currentQuestion?.difficulty && (
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(currentQuestion.difficulty)}`}>
                          <Zap className="w-4 h-4 inline mr-1" />
                          {currentQuestion.difficulty}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600">Choose the correct answer</p>
                    {currentQuestion?.category && (
                      <p className="text-sm text-gray-500 mt-1">Category: {currentQuestion.category}</p>
                    )}
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    getQuestionStatus(currentQuestion?.id) === 'answered'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {getQuestionStatus(currentQuestion?.id) === 'answered' ? 'Answered' : 'Not Answered'}
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <div className="text-lg text-gray-800 leading-relaxed font-medium">
                    {currentQuestion?.question_text && (
                      <div className="space-y-2">
                        {formatQuestionText(currentQuestion.question_text)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {['A', 'B', 'C', 'D'].map((option) => (
                  <label
                    key={option}
                    className={`block p-5 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                      answers[currentQuestion?.id] === option
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <input
                        type="radio"
                        name={`question-${currentQuestion?.id}`}
                        value={option}
                        checked={answers[currentQuestion?.id] === option}
                        onChange={() => handleAnswerSelect(currentQuestion?.id, option)}
                        className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            answers[currentQuestion?.id] === option
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {option}
                          </span>
                          <span className="text-gray-800 text-lg">
                            {currentQuestion?.[`option_${option.toLowerCase()}` as keyof Question]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
                >
                  ← Previous
                </button>
                
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Question Progress</p>
                  <p className="font-bold text-gray-900">{currentQuestionIndex + 1} of 40</p>
                </div>
                
                <button
                  onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}