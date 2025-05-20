import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RegisterForm from './pages/Register'
import LoginForm from './pages/Login'
import ChatPage from './pages/chat'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<RegisterForm />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/chat" element={<ChatPage />} />
        {/* Redirect to login by default */}
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App