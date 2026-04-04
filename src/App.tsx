import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage.tsx'
import InvitePage from './pages/InvitePage.tsx'
import './App.css'

function App() {
  const [count, setCount] = useState(0) // What does this do?

  return (
    <>
    <Routes>
      <Route path="/" element={<HomePage />}/>
      <Route path="/invite" element={<InvitePage />}/>
    </Routes>
    </>
  )
}

export default App
