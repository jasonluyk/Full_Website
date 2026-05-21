import { useState } from 'react'

export default function SoftballAdmin() {
  const [pass, setPass] = useState('')
  const [authed, setAuthed] = useState(false)
  const [trnid, setTrnid] = useState('12799')
  const [trnName, setTrnName] = useState('')
  const [division, setDivision] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [upcoming, setUpcoming] = useState([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(false)
  const [upcomingError, setUpcomingError] = useState('')

  const handle = async (fn) => {
    setLoading(true)
    setMessage('')
    try { await fn() }
    catch (e) { setMessage('Error: ' + e.message) }
    setLoading(false)
  }

  const fetchUpcoming = async () => {
    setLoadingUpcoming(true)
    setUpcomingError('')
    try {
      const r = await fetch('/softball/api/softball/upcoming-tournaments')
      const d = await r.json()
      setUpcoming(d.tournaments || [])
      if ((d.tournaments || []).length === 0) {
        setUpcomingError('No tournaments found. Click Discover to scrape from Top Gun.')
      }
    } catch (e) {
      setUpcomingError('Failed to load: ' + e.message)
    }
    setLoadingUpcoming(false)
  }

  const discoverTournaments = async () => {
    setLoadingUpcoming(true)
    setUpcomingError('')
    try {
      const r = await fetch('/softball/api/admin/softball/discover-tournaments', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + btoa('admin:' + pass) }
      })
      const d = await r.json()
      setUpcomingError(d.message)
      // Poll for results after 35 seconds
      setTimeout(fetchUpcoming, 35000)
    } catch (e) {
      setUpcomingError('Failed: ' + e.message)
      setLoadingUpcoming(false)
    }
  }

  if (!authed) return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
      <div className="card" style={{ padding: 32 }}>
        <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 28, marginBottom: 24 }}>
          🔒 Admin Login
        </h2>
        <input className="input" type="password" placeholder="Password"
          value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setAuthed(true)}
          style={{ marginBottom: 12 }} />
        <button className="btn btn-primary" style={{ width: '100%' }}
          onClick={() => setAuthed(true)}>Login</button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h1 className="page-title">🥎 Softball Admin</h1>

      {/* Upcoming Tournaments Browser */}
      <div className="card" style={{ padding: 28, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, margin: 0 }}>
            📅 Upcoming Tournaments
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={fetchUpcoming} disabled={loadingUpcoming}>
              {loadingUpcoming ? 'Loading...' : '🔄 Refresh'}
            </button>
            <button className="btn btn-primary" onClick={discoverTournaments} disabled={loadingUpcoming}>
              🔍 Discover
            </button>
          </div>
        </div>

        {upcomingError && <div className="alert alert-info">{upcomingError}</div>}

        {upcoming.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Click a tournament to pre-fill the name field. Enter the trnid manually once schedules post Thu/Fri.
            </p>
            <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Date</th>
                    <th>Tournament</th>
                    <th style={{ width: 160 }}>Location</th>
                    <th style={{ width: 60 }}>Teams</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((t, i) => (
                    <tr key={i} style={{ cursor: 'pointer', background: 'rgba(99,102,241,0.05)' }}
                      onClick={() => { setTrnid(t.trnid); setTrnName(t.name + ' — ' + t.location) }}>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{t.date}</td>
                      <td style={{ fontWeight: 500 }}>
                        {t.name}
                        <span className="badge badge-gold" style={{ marginLeft: 8, fontSize: 10 }}>
                          trnid: {t.trnid}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{t.location}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-primary"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={e => { e.stopPropagation(); setTrnid(t.trnid); setTrnName(t.name + ' — ' + t.location) }}>
                          Load →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              💡 Click any row or "Load →" to fill the trnid and name fields below
            </p>
          </>
        )}
      </div>

      {/* Sync Tournament */}
      <div className="card" style={{ padding: 28, marginTop: 16 }}>
        <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
          Sync Tournament
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Tournament ID (trnid)
            </label>
            <input className="input" value={trnid} onChange={e => setTrnid(e.target.value)}
              placeholder="e.g. 12799" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Tournament Name (optional)
            </label>
            <input className="input" value={trnName} onChange={e => setTrnName(e.target.value)}
              placeholder="e.g. Spring Slam May 17" />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Division Filter (optional — leave blank to sync ALL age groups)
          </label>
          <input className="input" value={division} onChange={e => setDivision(e.target.value)}
            placeholder="e.g. 10U : BB#2 — leave blank for all age groups" />
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          URL: <code>https://playtopgunsports.com/GameTimesResults.aspx?trnid={trnid}</code>
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={loading}
            onClick={() => handle(async () => {
              const r = await fetch('/softball/api/admin/softball/sync', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Basic ' + btoa('admin:' + pass)
                },
                body: JSON.stringify({ trnid, division, name: trnName })
              })
              const d = await r.json()
              setMessage(d.message || 'Done')
            })}>
            {loading ? 'Syncing...' : '🔄 Sync Now'}
          </button>

          <button className="btn btn-danger"
            onClick={() => handle(async () => {
              if (!confirm('Clear all softball data?')) return
              const r = await fetch('/softball/api/admin/softball/clear', {
                method: 'DELETE',
                headers: { 'Authorization': 'Basic ' + btoa('admin:' + pass) }
              })
              const d = await r.json()
              setMessage(d.message || 'Cleared')
            })}>
            🗑️ Clear
          </button>
        </div>

        {message && (
          <div className="alert alert-info" style={{ marginTop: 16 }}>{message}</div>
        )}
      </div>

      <div className="card" style={{ padding: 28, marginTop: 16 }}>
        <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          How it works
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8 }}>
          1. Browse upcoming tournaments and click one to pre-fill the name<br/>
          2. Enter the trnid once schedules are posted (Thu/Fri before tournament)<br/>
          3. Leave division blank to sync ALL age groups at once<br/>
          4. Click Sync — data loads in ~20-40 seconds<br/>
          5. Division tabs appear on the Tracker page automatically<br/>
          6. Page auto-refreshes every 2 minutes during the tournament
        </p>
      </div>
    </div>
  )
}