import { useState } from 'react'

export default function SoftballAdmin() {
  const [pass, setPass] = useState('')
  const [authed, setAuthed] = useState(false)
  const [trnid, setTrnid] = useState('12799')
  const [trnName, setTrnName] = useState('')
  const [division, setDivision] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handle = async (fn) => {
    setLoading(true)
    setMessage('')
    try { await fn() }
    catch (e) { setMessage('Error: ' + e.message) }
    setLoading(false)
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

  const [upcoming, setUpcoming] = useState([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(false)
  const [upcomingError, setUpcomingError] = useState('')

  const fetchUpcoming = async () => {
    setLoadingUpcoming(true)
    setUpcomingError('')
    try {
      // Fetch from browser (residential IP — not blocked)
      const resp = await fetch('https://playtopgunsports.com/UpcomingTournaments.aspx')
      const html = await resp.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const rows = doc.querySelectorAll('#ctl00_siteContentPlaceHolder_softballGridView tr:not(:first-child)')
      const tournaments = []
      rows.forEach(row => {
        const cells = row.querySelectorAll('td')
        if (cells.length >= 4) {
          const btn = cells[4]?.querySelector('input')
          const teamsMatch = btn?.value?.match(/(\d+)\s*Teams?/)
          tournaments.push({
            date: cells[0]?.textContent?.trim(),
            name: cells[1]?.textContent?.trim(),
            location: cells[2]?.textContent?.trim(),
            director: cells[3]?.textContent?.trim(),
            teams: teamsMatch ? parseInt(teamsMatch[1]) : 0,
          })
        }
      })
      setUpcoming(tournaments)
    } catch (e) {
      setUpcomingError('Failed to load: ' + e.message)
    }
    setLoadingUpcoming(false)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h1 className="page-title">🥎 Softball Admin</h1>

      {/* Upcoming Tournaments Browser */}
      <div className="card" style={{ padding: 28, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, margin: 0 }}>
            📅 Upcoming Tournaments
          </h3>
          <button className="btn btn-secondary" onClick={fetchUpcoming} disabled={loadingUpcoming}>
            {loadingUpcoming ? 'Loading...' : '🔍 Browse'}
          </button>
        </div>

        {upcomingError && <div className="alert alert-info">{upcomingError}</div>}

        {upcoming.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Click a tournament to pre-fill the trnid field below once schedules are posted Thursday/Friday.
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
                    <tr key={i} style={{ cursor: 'pointer' }}
                      onClick={() => setTrnName(t.name + ' — ' + t.location)}>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{t.date}</td>
                      <td style={{ fontWeight: 500 }}>{t.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{t.location}</td>
                      <td style={{ textAlign: 'center' }}>
                        {t.teams > 0
                          ? <span className="badge badge-green">{t.teams}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              ⚠️ trnid not available until schedules are posted (typically Thu/Fri before the tournament)
            </p>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 28, marginTop: 24 }}>
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
          1. Enter the tournament ID from the Top Gun URL<br/>
          2. Optionally add a tournament name and filter to a specific division<br/>
          &nbsp;&nbsp;&nbsp;<em>Leave division blank to sync ALL age groups at once</em><br/>
          3. Click Sync — data loads in ~20-40 seconds (Playwright scrape)<br/>
          4. Division tabs appear on the Tracker page automatically<br/>
          5. Page auto-refreshes every 2 minutes during the tournament
        </p>
      </div>
    </div>
  )
}