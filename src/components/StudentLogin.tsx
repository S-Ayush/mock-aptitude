import React, { useState } from 'react'
import { User, Mail, Hash, LogIn, Shield, BookOpen } from 'lucide-react'
import { supabase, Student } from '../lib/supabase'

interface StudentLoginProps {
  onStudentLogin: (student: Student) => void
  onAdminLogin: () => void
}

export default function StudentLogin({ onStudentLogin, onAdminLogin }: StudentLoginProps) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [isAdminAccess, setIsAdminAccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    enrollment_number: '',
    admin_code: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isAdminAccess) {
        if (formData.admin_code === 'cw@123') {
          onAdminLogin()
        } else {
          setError('Invalid admin code')
        }
        return
      }

      if (isRegistering) {
        // Register new student
        const { data, error } = await supabase
          .from('students')
          .insert([{
            name: formData.name,
            email: formData.email,
            enrollment_number: formData.enrollment_number
          }])
          .select()
          .single()

        if (error) {
          if (error.code === '23505') {
            setError('Email or enrollment number already exists')
          } else {
            setError('Registration failed. Please try again.')
          }
          return
        }

        onStudentLogin(data)
      } else {
        // Login existing student
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('email', formData.email)
          .eq('enrollment_number', formData.enrollment_number)
          .single()

        if (error) {
          setError('Invalid credentials. Please check your email and enrollment number.')
          return
        }

        onStudentLogin(data)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', email: '', enrollment_number: '', admin_code: '' })
    setError('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Testing Platform</h1>
          <p className="text-gray-600">Professional online examination system</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                {isAdminAccess ? (
                  <Shield className="w-8 h-8 text-white" />
                ) : (
                  <User className="w-8 h-8 text-white" />
                )}
              </div>
              <h2 className="text-xl font-bold text-white">
                {isAdminAccess ? 'Admin Access' : isRegistering ? 'Create Account' : 'Student Login'}
              </h2>
              <p className="text-blue-100 mt-2 text-sm">
                {isAdminAccess 
                  ? 'Enter admin code to access management panel' 
                  : isRegistering 
                    ? 'Register to start taking tests' 
                    : 'Sign in with your credentials'
                }
              </p>
            </div>
          </div>

          <div className="px-8 py-6">
            {!isAdminAccess && (
              <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                <button
                  type="button"
                  onClick={() => { setIsRegistering(false); resetForm() }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    !isRegistering 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setIsRegistering(true); resetForm() }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    isRegistering 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {isAdminAccess ? (
                <div className="relative">
                  <Shield className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Enter admin code"
                    value={formData.admin_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, admin_code: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              ) : (
                <>
                  {isRegistering && (
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  )}

                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Hash className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Enrollment Number"
                      value={formData.enrollment_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, enrollment_number: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <LogIn className="w-5 h-5 mr-2" />
                    {isAdminAccess ? 'Access Admin Panel' : isRegistering ? 'Create Account' : 'Sign In'}
                  </div>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsAdminAccess(!isAdminAccess)
                  resetForm()
                }}
                className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
              >
                {isAdminAccess ? '← Back to Student Login' : 'Admin Access →'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Secure • Reliable • Professional Testing Platform</p>
        </div>
      </div>
    </div>
  )
}