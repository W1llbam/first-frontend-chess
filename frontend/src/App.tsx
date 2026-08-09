import './App.css'
import Header from './components/Header.tsx'
import Hero from './components/Hero.tsx'
import Footer from './components/Footer.tsx'
import { Route, Routes } from "react-router-dom"
import CreateMatchPage from './pages/CreateMatchPage.tsx'

function HomePage() {
  return <Hero />
}

function App() {
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
