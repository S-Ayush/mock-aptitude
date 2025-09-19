import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import StudentLogin from './components/StudentLogin'
import StudentTest from './components/StudentTest'
import AdminPanel from './components/AdminPanel'
import TestResults from './components/TestResults'
import { Student } from './lib/supabase'

function App() {
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const savedStudent = localStorage.getItem('currentStudent')
    if (savedStudent) {
      setCurrentStudent(JSON.parse(savedStudent))
    }
    
    const adminStatus = localStorage.getItem('isAdmin')
    if (adminStatus === 'true') {
      setIsAdmin(true)
    }
  }, [])

  const handleStudentLogin = (student: Student) => {
    setCurrentStudent(student)
    localStorage.setItem('currentStudent', JSON.stringify(student))
  }

  const handleAdminLogin = () => {
    setIsAdmin(true)
    localStorage.setItem('isAdmin', 'true')
  }

  const handleLogout = () => {
    setCurrentStudent(null)
    setIsAdmin(false)
    localStorage.removeItem('currentStudent')
    localStorage.removeItem('isAdmin')
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <Routes>
          <Route 
            path="/" 
            element={
              currentStudent ? (
                <Navigate to="/test" replace />
              ) : isAdmin ? (
                <Navigate to="/admin" replace />
              ) : (
                <StudentLogin 
                  onStudentLogin={handleStudentLogin} 
                  onAdminLogin={handleAdminLogin}
                />
              )
            } 
          />
          <Route 
            path="/test" 
            element={
              currentStudent ? (
                <StudentTest student={currentStudent} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/admin" 
            element={
              isAdmin ? (
                <AdminPanel onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/results" 
            element={
              isAdmin ? (
                <TestResults />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App