import { useState } from 'react'
import './App.css'
import Header from './components/Header.tsx'
import Hero from './components/Hero.tsx'
import Footer from './components/Footer.tsx'
import { Route, Routes } from "react-router"
import CreateMatchPage from './pages/CreateMatchPage.tsx'

function HomePage() {
  return <Hero />
}

function App() {
  const [count, setCount] = useState(0) // What does this do?

  return (
    <>
    <Header />

    <Routes>
      <Route path="/" element={<HomePage />}/>
      <Route path="/create-match" element={<CreateMatchPage />}/>
    </Routes>
    <Footer />

    </>
  )
}

export default App
