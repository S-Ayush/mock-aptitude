import React, { useState, useEffect } from 'react'
import { Settings, Users, BarChart3, LogOut, Clock, Play, Square, Calendar, Download } from 'lucide-react'
import { supabase, Test } from '../lib/supabase'
import { format } from 'date-fns'

interface AdminPanelProps {
  onLogout: () => void
}

interface TestAttemptWithStudent {
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

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'monitoring' | 'results'>('settings')
  const [currentTest, setCurrentTest] = useState<Test | null>(null)
  const [testSettings, setTestSettings] = useState({
    title: '',
    start_time: '',
    end_time: '',
    is_active: false
  })
  const [liveAttempts, setLiveAttempts] = useState<TestAttemptWithStudent[]>([])
  const [completedResults, setCompletedResults] = useState<TestAttemptWithStudent[]>([])
  const [loading, setLoading] = useState(false)

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-management`
  const apiHeaders = {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }

  useEffect(() => {
    loadCurrentTest()
    loadResults()
    
    // Set up real-time updates
    const interval = setInterval(() => {
      if (activeTab === 'monitoring') {
        loadLiveAttempts()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [activeTab])

  const loadCurrentTest = async () => {
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) {
        setCurrentTest(data)
        setTestSettings({
          title: data.title,
          start_time: format(new Date(data.start_time), "yyyy-MM-dd'T'HH:mm"),
          end_time: format(new Date(data.end_time), "yyyy-MM-dd'T'HH:mm"),
          is_active: data.is_active
        })
      }
    } catch (err) {
      console.error('Failed to load test:', err)
    }
  }

  const loadLiveAttempts = async () => {
    try {
      const { data, error } = await supabase
        .from('test_attempts')
        .select(`
          *,
          students(name, email, enrollment_number),
          tests(title)
        `)
        .eq('is_completed', false)
        .order('started_at', { ascending: false })

      if (!error && data) {
        setLiveAttempts(data as TestAttemptWithStudent[])
      }
    } catch (err) {
      console.error('Failed to load live attempts:', err)
    }
  }

  const loadResults = async () => {
    try {
      const response = await fetch(`${apiUrl}?action=get-results`, {
        headers: apiHeaders
      })
      
      if (response.ok) {
        const data = await response.json()
        setCompletedResults(data)
      }
    } catch (err) {
      console.error('Failed to load results:', err)
    }
  }

  const updateTestSettings = async () => {
    if (!currentTest) return
    
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}?action=manage-test`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          testId: currentTest.id,
          updates: {
            title: testSettings.title,
            start_time: new Date(testSettings.start_time).toISOString(),
            end_time: new Date(testSettings.end_time).toISOString(),
            is_active: testSettings.is_active
          }
        })
      })

      if (response.ok) {
        await loadCurrentTest()
        alert('Test settings updated successfully!')
      }
    } catch (err) {
      console.error('Failed to update test:', err)
      alert('Failed to update test settings')
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    const csvContent = [
      ['Name', 'Email', 'Enrollment Number', 'Test', 'Score', 'Started At', 'Submitted At'].join(','),
      ...completedResults.map(result => [
        result.students.name,
        result.students.email,
        result.students.enrollment_number,
        result.tests.title,
        result.score.toFixed(2),
        format(new Date(result.started_at), 'yyyy-MM-dd HH:mm:ss'),
        result.submitted_at ? format(new Date(result.submitted_at), 'yyyy-MM-dd HH:mm:ss') : 'Not submitted'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `test-results-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const getTimeElapsed = (startTime: string) => {
    const start = new Date(startTime)
    const now = new Date()
    const diffMs = now.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000)
    return `${diffMins}:${diffSecs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-sm text-gray-600">Test Management System</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'settings', label: 'Test Settings', icon: Settings },
                { id: 'monitoring', label: 'Live Monitoring', icon: Users },
                { id: 'results', label: 'Results & Analytics', icon: BarChart3 }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as typeof activeTab)}
                  className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                    activeTab === id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Test Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Test Configuration</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Test Title</label>
                  <input
                    type="text"
                    value={testSettings.title}
                    onChange={(e) => setTestSettings(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="datetime-local"
                    value={testSettings.start_time}
                    onChange={(e) => setTestSettings(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    type="datetime-local"
                    value={testSettings.end_time}
                    onChange={(e) => setTestSettings(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={testSettings.is_active}
                    onChange={(e) => setTestSettings(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Test is Active
                  </label>
                </div>

                <button
                  onClick={updateTestSettings}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Updating...' : 'Update Test Settings'}
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Current Test Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${currentTest?.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-600">
                      Status: {currentTest?.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Duration: {currentTest ? `${currentTest.duration_minutes} minutes` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Questions: {currentTest?.total_questions || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Monitoring Tab */}
        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Live Test Monitoring</h2>
                <button
                  onClick={loadLiveAttempts}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refresh
                </button>
              </div>

              {liveAttempts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No students currently taking the test</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Student</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Enrollment</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Started At</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Time Elapsed</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveAttempts.map((attempt) => (
                        <tr key={attempt.id} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{attempt.students.name}</p>
                              <p className="text-sm text-gray-600">{attempt.students.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{attempt.students.enrollment_number}</td>
                          <td className="py-3 px-4 text-gray-600">
                            {format(new Date(attempt.started_at), 'HH:mm:ss')}
                          </td>
                          <td className="py-3 px-4 text-gray-600">{getTimeElapsed(attempt.started_at)}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              In Progress
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Test Results & Analytics</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={loadResults}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Total Attempts</p>
                  <p className="text-2xl font-bold text-blue-900">{completedResults.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Average Score</p>
                  <p className="text-2xl font-bold text-green-900">
                    {completedResults.length > 0 
                      ? (completedResults.reduce((sum, r) => sum + r.score, 0) / completedResults.length).toFixed(1)
                      : '0'
                    }
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-600 font-medium">Highest Score</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {completedResults.length > 0 
                      ? Math.max(...completedResults.map(r => r.score)).toFixed(1)
                      : '0'
                    }
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">Lowest Score</p>
                  <p className="text-2xl font-bold text-red-900">
                    {completedResults.length > 0 
                      ? Math.min(...completedResults.map(r => r.score)).toFixed(1)
                      : '0'
                    }
                  </p>
                </div>
              </div>

              {/* Results Table */}
              {completedResults.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No completed test results yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Student</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Enrollment</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Score</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Submitted At</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedResults
                        .sort((a, b) => b.score - a.score)
                        .map((result) => {
                          const percentage = (result.score / 40) * 100
                          const grade = percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F'
                          const gradeColor = percentage >= 80 ? 'text-green-800 bg-green-100' : 
                                           percentage >= 60 ? 'text-yellow-800 bg-yellow-100' : 'text-red-800 bg-red-100'
                          
                          return (
                            <tr key={result.id} className="border-b border-gray-100">
                              <td className="py-3 px-4">
                                <div>
                                  <p className="font-medium text-gray-900">{result.students.name}</p>
                                  <p className="text-sm text-gray-600">{result.students.email}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-gray-600">{result.students.enrollment_number}</td>
                              <td className="py-3 px-4">
                                <div>
                                  <p className="font-semibold text-gray-900">{result.score.toFixed(2)}</p>
                                  <p className="text-sm text-gray-600">{percentage.toFixed(1)}%</p>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-gray-600">
                                {result.submitted_at 
                                  ? format(new Date(result.submitted_at), 'MMM dd, HH:mm')
                                  : 'Not submitted'
                                }
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${gradeColor}`}>
                                  {grade}
                                </span>
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
        )}
      </div>
    </div>
  )
}