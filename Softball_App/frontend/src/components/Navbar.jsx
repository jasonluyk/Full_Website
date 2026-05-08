import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56,
      }}>

        {/* Left side — main nav buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NavLink to="/" end style={({ isActive }) => ({
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 8,
            background: isActive ? 'var(--accent-dim)' : 'var(--bg-card)',
            border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
            transition: 'all 0.2s ease',
          })}>
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 800,
              letterSpacing: '0.05em', color: 'var(--accent)' }}>🥎</span>
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700,
              letterSpacing: '0.05em', color: 'var(--text-primary)' }}>Tracker</span>
          </NavLink>

          <NavLink to="/predictor" style={({ isActive }) => ({
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 8,
            background: isActive ? 'var(--accent-dim)' : 'var(--bg-card)',
            border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700,
            letterSpacing: '0.05em', color: isActive ? 'var(--accent)' : 'var(--text-primary)',
            transition: 'all 0.2s ease',
          })}>
            🔮 Predictor
          </NavLink>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/" style={{
            padding: '6px 12px', borderRadius: 6, textDecoration: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 600,
            letterSpacing: '0.05em', color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}>← My Site</a>

          <NavLink to="/admin" style={({ isActive }) => ({
            padding: '6px 12px', borderRadius: 6, textDecoration: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 600,
            letterSpacing: '0.05em',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          })}>Admin</NavLink>
        </div>

      </div>
    </nav>
  )
}