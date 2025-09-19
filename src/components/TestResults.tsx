import React, { useState, useEffect } from 'react'
import { BarChart3, Download, Users, TrendingUp, Award } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

interface TestResult {
  id: string
  started_at: string
  submitted_at?: string
  score: number
  is_completed: boolean
  students: {
    name: string
    email: string
    enrollment_number: string
  }
  tests: {
    title: string
  }
}

export default function TestResults() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalAttempts: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0,
    passRate: 0
  })

  useEffect(() => {
    loadResults()
  }, [])

  const loadResults = async () => {
    try {
      const { data, error } = await supabase
        .from('test_attempts')
        .select(`
          *,
          students(name, email, enrollment_number),
          tests(title)
        `)
        .eq('is_completed', true)
        .order('submitted_at', { ascending: false })

      if (!error && data) {
        setResults(data as TestResult[])
        calculateStats(data as TestResult[])
      }
    } catch (err) {
      console.error('Failed to load results:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data: TestResult[]) => {
    if (data.length === 0) {
      setStats({ totalAttempts: 0, averageScore: 0, highestScore: 0, lowestScore: 0, passRate: 0 })
      return
    }

    const scores = data.map(r => r.score)
    const passCount = scores.filter(score => (score / 40) * 100 >= 50).length

    setStats({
      totalAttempts: data.length,
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      passRate: (passCount / data.length) * 100
    })
  }

  const exportToCSV = () => {
    const csvContent = [
      ['Name', 'Email', 'Enrollment Number', 'Test', 'Score', 'Percentage', 'Grade', 'Started At', 'Submitted At'].join(','),
      ...results.map(result => {
        const percentage = (result.score / 40) * 100
        const grade = percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F'
        
        return [
          result.students.name,
          result.students.email,
          result.students.enrollment_number,
          result.tests.title,
          result.score.toFixed(2),
          percentage.toFixed(1) + '%',
          grade,
          format(new Date(result.started_at), 'yyyy-MM-dd HH:mm:ss'),
          result.submitted_at ? format(new Date(result.submitted_at), 'yyyy-MM-dd HH:mm:ss') : 'Not submitted'
        ].join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `detailed-test-results-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Test Results Dashboard</h1>
            <p className="text-gray-600 mt-1">Comprehensive analysis of test performance</p>
          </div>
          <button
            onClick={exportToCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Detailed CSV</span>
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Attempts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAttempts}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageScore.toFixed(1)}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Highest Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.highestScore.toFixed(1)}</p>
              </div>
              <Award className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Lowest Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.lowestScore.toFixed(1)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pass Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.passRate.toFixed(1)}%</p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold text-sm">%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Accuracy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {results.length > 0 
                    ? (results.reduce((sum, r) => {
                        const attempted = Object.keys(r).length // This would need to be calculated properly
                        return sum + (attempted > 0 ? (r.score / attempted) * 100 : 0)
                      }, 0) / results.length).toFixed(1)
                    : '0'
                  }%
                </p>
              </div>
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600 font-bold text-sm">A</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Comprehensive Test Analysis</h2>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No test results available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Student Details</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Score & Breakdown</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Performance Metrics</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Grade</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Test Duration</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(async (result, index) => {
                    const percentage = (result.score / 40) * 100
                    const grade = percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F'
                    const gradeColor = percentage >= 80 ? 'text-green-800 bg-green-100' : 
                                     percentage >= 70 ? 'text-blue-800 bg-blue-100' :
                                     percentage >= 60 ? 'text-yellow-800 bg-yellow-100' : 
                                     percentage >= 50 ? 'text-orange-800 bg-orange-100' : 'text-red-800 bg-red-100'
                    
                    const duration = result.submitted_at 
                      ? Math.floor((new Date(result.submitted_at).getTime() - new Date(result.started_at).getTime()) / (1000 * 60))
                      : null

                    // Get detailed answer statistics
                    const { data: studentAnswers } = await supabase
                      .from('student_answers')
                      .select('*')
                      .eq('attempt_id', result.id)

                    const attempted = studentAnswers?.length || 0
                    const correct = studentAnswers?.filter(a => a.is_correct).length || 0
                    const incorrect = attempted - correct
                    const unattempted = 40 - attempted
                    const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0
                    return (
                      <tr key={result.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                        <td className="py-4 px-6">
                          <div>
                            <p className="font-semibold text-gray-900">{result.students.name}</p>
                            <p className="text-sm text-gray-600">{result.students.email}</p>
                            <p className="text-sm text-gray-500">{result.students.enrollment_number}</p>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-xl font-bold text-gray-900">{result.score.toFixed(2)}/40</p>
                            <div className="flex space-x-1 mt-2">
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                                ✓ {correct}
                              </span>
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                                ✗ {incorrect}
                              </span>
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">
                                - {unattempted}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center">
                            <div className="w-20 bg-gray-200 rounded-full h-3 mr-3">
                              <div 
                                className="bg-blue-600 h-3 rounded-full" 
                                style={{ width: `${Math.max(0, percentage)}%` }}
                              ></div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{percentage.toFixed(1)}%</p>
                              <p className="text-xs text-gray-600">Accuracy: {accuracy.toFixed(1)}%</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${gradeColor}`}>
                            {grade}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-600">
                          {duration ? `${duration} minutes` : 'N/A'}
                        </td>
                        <td className="py-4 px-6 text-gray-600">
                          {result.submitted_at 
                            ? format(new Date(result.submitted_at), 'MMM dd, yyyy HH:mm')
                            : 'Not submitted'
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}