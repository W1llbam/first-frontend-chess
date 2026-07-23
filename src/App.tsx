import { useState } from 'react'
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

    </>
  )
}

export default App
