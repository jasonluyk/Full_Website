import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Tournament from './pages/Tournament'
import Admin from './pages/Admin'
import Predictor from './pages/Predictor'
import './index.css'

export default function App() {
  return (
    <BrowserRouter basename="/softball">
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Tournament />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/predictor" element={<Predictor />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}