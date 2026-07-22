import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage.tsx'
import InvitePage from './pages/InvitePage.tsx'
import './App.css'
import Header from './components/Header.tsx'
import Hero from './components/Hero.tsx'
import Footer from './components/Footer.tsx'

function App() {
  const [count, setCount] = useState(0) // What does this do?

  return (
    <>
    <Header />
    <Hero />
    <Footer />


    <Routes>
      <Route path="/" element={<HomePage />}/>
      <Route path="/invite" element={<InvitePage />}/>
    </Routes>
    </>
  )
}

export default App
