import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RegisterForm from './pages/Register'
import LoginForm from './pages/Login'
import ChatPage from './pages/chat'
import { isAuthenticated } from './utils/auth'
import './App.css'

function App() {
  // Check if user is authenticated
  const isAuth = isAuthenticated();
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<RegisterForm />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/chat" element={<ChatPage />} />
        {/* Redirect to chat if logged in, otherwise to login */}
        <Route path="/" element={<Navigate to={isAuth ? "/chat" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App