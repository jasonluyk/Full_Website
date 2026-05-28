import { useState, useEffect } from 'react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

function ScoreCell({ score, winner }) {
  if (!score) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return <strong style={{ color: winner ? 'var(--green)' : 'var(--text-primary)', fontSize: 16 }}>{score}</strong>
}

function seedTeams(teams, poolGames) {
  const h2h = {}
  for (const g of poolGames.filter(g => g.complete)) {
    const sa = parseInt(g.score_a), sb = parseInt(g.score_b)
    if (isNaN(sa) || isNaN(sb)) continue
    const ta = g.team_a?.trim(), tb = g.team_b?.trim()
    if (!ta || !tb) continue
    if (!h2h[ta]) h2h[ta] = {}
    if (!h2h[tb]) h2h[tb] = {}
    if (!h2h[ta][tb]) h2h[ta][tb] = { winsA: 0, winsB: 0 }
    if (!h2h[tb][ta]) h2h[tb][ta] = { winsA: 0, winsB: 0 }
    if (sa > sb) { h2h[ta][tb].winsA++; h2h[tb][ta].winsB++ }
    else if (sb > sa) { h2h[tb][ta].winsA++; h2h[ta][tb].winsB++ }
  }
  const sorted = [...teams].sort((a, b) => {
    const wonDiff = b.won - a.won
    if (wonDiff !== 0) return wonDiff
    const lostDiff = a.lost - b.lost
    if (lostDiff !== 0) return lostDiff
    const tied = teams.filter(t => t.won === a.won && t.lost === a.lost)
    if (tied.length === 2) {
      const ab = h2h[a.team]?.[b.team]
      if (ab && ab.winsA !== ab.winsB) return ab.winsB - ab.winsA
    }
    if (a.runs_allowed !== b.runs_allowed) return a.runs_allowed - b.runs_allowed
    if (b.runs_scored !== a.runs_scored) return b.runs_scored - a.runs_scored
    return (b.runs_scored - b.runs_allowed) - (a.runs_scored - a.runs_allowed)
  })
  return sorted.map((t, i) => ({ ...t, seed: i + 1 }))
}

function StandingsTable({ teams, poolGames }) {
  const isMobile = useIsMobile()
  const anyScored = teams.some(t => t.won > 0 || t.lost > 0)
  const seeded = anyScored ? seedTeams(teams, poolGames) : teams.map((t, i) => ({ ...t, seed: i + 1 }))

  if (isMobile) {
    return (
      <div style={{ marginBottom: 28 }}>
        {seeded.map((t, i) => {
          const diff = t.runs_scored - t.runs_allowed
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              marginBottom: 6, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 28, fontWeight: 900,
                color: 'var(--accent)', width: 36, textAlign: 'center', flexShrink: 0 }}>{t.seed}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.team}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.location}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0, fontSize: 13 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--green)', fontWeight: 700 }}>{t.won % 1 === 0.5 ? `${Math.floor(t.won)}.5` : t.won}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>W</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--red)' }}>{t.lost % 1 === 0.5 ? `${Math.floor(t.lost)}.5` : t.lost}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>L</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {diff > 0 ? `+${diff}` : diff}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+/-</div>
                </div>
              </div>
            </div>
          )
        })}
        {anyScored && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Tiebreakers: W-L → H2H → RA → RS → Run Diff</div>}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 28 }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 60 }}>Seed</th>
            <th>Team</th>
            <th style={{ width: 120 }}>Location</th>
            <th style={{ width: 55 }}>W</th>
            <th style={{ width: 55 }}>L</th>
            <th style={{ width: 70 }}>RS</th>
            <th style={{ width: 70 }}>RA</th>
            <th style={{ width: 80 }}>+/-</th>
          </tr>
        </thead>
        <tbody>
          {seeded.map((t, i) => {
            const diff = t.runs_scored - t.runs_allowed
            return (
              <tr key={i}>
                <td style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--accent)', textAlign: 'center' }}>{t.seed}</td>
                <td style={{ fontWeight: 600 }}>{t.team}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.location}</td>
                <td style={{ color: 'var(--green)', fontWeight: 700 }}>{t.won % 1 === 0.5 ? `${Math.floor(t.won)}.5` : t.won}</td>
                <td style={{ color: 'var(--red)' }}>{t.lost % 1 === 0.5 ? `${Math.floor(t.lost)}.5` : t.lost}</td>
                <td>{t.runs_scored}</td>
                <td>{t.runs_allowed}</td>
                <td style={{ color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {diff > 0 ? `+${diff}` : diff}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {anyScored && (
        <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          Projected seeds: W-L → H2H (2-way ties) → RA → RS → Run Diff · Seeds finalized by Top Gun after pool play
        </div>
      )}
    </div>
  )
}

function GameCard({ g }) {
  const sa = parseInt(g.score_a), sb = parseInt(g.score_b)
  const aWins = g.complete && !isNaN(sa) && !isNaN(sb) && sa > sb
  const bWins = g.complete && !isNaN(sa) && !isNaN(sb) && sb > sa
  return (
    <div style={{ background: g.complete ? 'rgba(34,197,94,0.04)' : 'var(--bg-card)',
      border: `1px solid ${g.complete ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
      borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{g.time}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.field}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: aWins ? 700 : 500, color: aWins ? 'var(--green)' : 'var(--text-primary)', fontSize: 14, flex: 1 }}>{g.team_a}</span>
          <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800,
            color: aWins ? 'var(--green)' : g.complete ? 'var(--text-muted)' : 'transparent', minWidth: 32, textAlign: 'right' }}>
            {g.complete ? g.score_a : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: bWins ? 700 : 500, color: bWins ? 'var(--green)' : 'var(--text-primary)', fontSize: 14, flex: 1 }}>{g.team_b}</span>
          <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800,
            color: bWins ? 'var(--green)' : g.complete ? 'var(--text-muted)' : 'transparent', minWidth: 32, textAlign: 'right' }}>
            {g.complete ? g.score_b : '—'}
          </span>
        </div>
      </div>
      {g.complete && <div style={{ marginTop: 6, textAlign: 'right' }}><span className="badge badge-green" style={{ fontSize: 10 }}>Final</span></div>}
    </div>
  )
}

function GamesTable({ games, title }) {
  const isMobile = useIsMobile()
  if (!games || games.length === 0) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700,
        color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>{title}</h3>
      {isMobile ? (
        <div>{games.map((g, i) => <GameCard key={i} g={g} />)}</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Game</th>
                <th style={{ width: 80 }}>Time</th>
                <th style={{ width: 150 }}>Field</th>
                <th>Team A</th>
                <th style={{ width: 60 }}>Score</th>
                <th>Team B</th>
                <th style={{ width: 60 }}>Score</th>
                <th style={{ width: 90 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g, i) => {
                const sa = parseInt(g.score_a), sb = parseInt(g.score_b)
                const aWins = g.complete && !isNaN(sa) && !isNaN(sb) && sa > sb
                const bWins = g.complete && !isNaN(sa) && !isNaN(sb) && sb > sa
                return (
                  <tr key={i} style={g.complete ? { background: 'rgba(34,197,94,0.04)' } : {}}>
                    <td style={{ color: 'var(--text-muted)' }}>{g.game}</td>
                    <td style={{ color: 'var(--accent)' }}>{g.time}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.field}</td>
                    <td style={{ fontWeight: aWins ? 700 : 400, color: aWins ? 'var(--green)' : 'var(--text-primary)' }}>{g.team_a}</td>
                    <td><ScoreCell score={g.score_a} winner={aWins} /></td>
                    <td style={{ fontWeight: bWins ? 700 : 400, color: bWins ? 'var(--green)' : 'var(--text-primary)' }}>{g.team_b}</td>
                    <td><ScoreCell score={g.score_b} winner={bWins} /></td>
                    <td>{g.complete ? <span className="badge badge-green">Final</span> : <span className="badge badge-gray">Scheduled</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DivisionView({ division }) {
  const completedPool = division.pool_play?.filter(g => g.complete).length || 0
  const totalPool = division.pool_play?.length || 0
  const completedBracket = division.brackets?.flatMap(b => b.games).filter(g => g.complete).length || 0
  const totalBracket = division.brackets?.flatMap(b => b.games).length || 0
  const isMobile = useIsMobile()

  return (
    <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{division.standings?.length || 0}</div>
          <div className="stat-label">Teams</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedPool}/{totalPool}</div>
          <div className="stat-label">Pool Games</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{completedBracket}/{totalBracket}</div>
          <div className="stat-label">Bracket Games</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{division.brackets?.length || 0}</div>
          <div className="stat-label">Brackets</div>
        </div>
      </div>

      {/* Standings */}
      {division.standings?.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: isMobile ? 20 : 24, fontWeight: 800, margin: 0 }}>
              📊 Projected Seeding
            </h2>
            <span className="badge badge-gold">Live</span>
          </div>
          <StandingsTable teams={division.standings} poolGames={division.pool_play || []} />
        </>
      )}

      {division.pool_play?.length > 0 && <GamesTable games={division.pool_play} title="Pool Play" />}
      {division.brackets?.map((b, i) => <GamesTable key={i} games={b.games} title={b.name} />)}
    </>
  )
}

export default function Tournament() {
  const isMobile = useIsMobile()
  const [divisions, setDivisions] = useState([])
  const [trnName, setTrnName] = useState('')
  const [status, setStatus] = useState('none')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [allTournaments, setAllTournaments] = useState([])
  const [activeTrnid, setActiveTrnid] = useState(
    () => localStorage.getItem('active_trnid') || ''
  )
  const [activeDivision, setActiveDivision] = useState(
    () => localStorage.getItem('active_division') || ''
  )

  const fetchTournaments = () => {
    fetch('/softball/api/softball/tournaments')
      .then(r => r.json())
      .then(res => {
        const list = res.tournaments || []
        setAllTournaments(list)
        // If saved trnid no longer exists, clear it and use first
        const savedTrnid = localStorage.getItem('active_trnid')
        const exists = list.find(t => t.trnid === savedTrnid)
        if (!exists && list.length > 0) {
          localStorage.setItem('active_trnid', list[0].trnid)
          setActiveTrnid(list[0].trnid)
        } else if (!savedTrnid && list.length > 0) {
          setActiveTrnid(list[0].trnid)
        }
      })
      .catch(() => {})
  }

  const fetchData = (trnid) => {
    const url = trnid
      ? `/softball/api/softball/tournament?trnid=${trnid}`
      : '/softball/api/softball/tournament'
    fetch(url)
      .then(r => r.json())
      .then(res => {
        setDivisions(res.divisions || [])
        setTrnName(res.name || '')
        setStatus(res.status)
        setLastUpdated(new Date())
        setLoading(false)
        if (res.divisions?.length > 0) {
          const names = res.divisions.map(d => d.name)
          if (!activeDivision || !names.includes(activeDivision)) {
            setActiveDivision(res.divisions[0].name)
          }
        }
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchTournaments()
    fetchData(activeTrnid)
    const i = setInterval(() => {
      fetchTournaments()
      fetchData(activeTrnid)
    }, 120000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    if (activeTrnid) {
      setLoading(true)
      setDivisions([])
      fetchData(activeTrnid)
    }
  }, [activeTrnid])
  useEffect(() => { localStorage.setItem('active_division', activeDivision) }, [activeDivision])
  useEffect(() => { if (activeTrnid) localStorage.setItem('active_trnid', activeTrnid) }, [activeTrnid])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>

  if (status === 'none' || divisions.length === 0) return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <h1 className="page-title">🥎 Softball Tournament Tracker</h1>
      <div className="alert alert-info" style={{ marginTop: 20 }}>No tournament loaded. Use Admin to sync a tournament.</div>
    </div>
  )

  const currentDivision = divisions.find(d => d.name === activeDivision) || divisions[0]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 12px' : '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>
              TOP GUN SPORTS
            </span>
          </div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: isMobile ? 20 : 28, fontWeight: 800, margin: 0 }}>
            🥎 {trnName || 'Tournament'}
          </h1>
          {lastUpdated && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Updated {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 2 min
            </p>
          )}
        </div>
        <button className="btn btn-secondary" onClick={fetchData}
          style={{ fontSize: isMobile ? 18 : 14, padding: isMobile ? '8px 12px' : undefined }}>↻</button>
      </div>

      {/* Tournament selector */}
      {allTournaments.length > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, scrollbarWidth: 'none' }}>
          {allTournaments.map(t => (
            <button key={t.trnid}
              onClick={() => setActiveTrnid(t.trnid)}
              style={{
                padding: isMobile ? '5px 10px' : '6px 14px',
                borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: isMobile ? 12 : 13, fontWeight: 700,
                background: t.trnid === activeTrnid ? 'var(--text-primary)' : 'var(--bg-card)',
                color: t.trnid === activeTrnid ? 'var(--bg-primary)' : 'var(--text-muted)',
                border: `1px solid ${t.trnid === activeTrnid ? 'var(--text-primary)' : 'var(--border)'}`,
              }}>
              🏟️ {t.name || `Tournament ${t.trnid}`}
            </button>
          ))}
        </div>
      )}

      {/* Division tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 20,
        scrollbarWidth: 'none' }}>
        {divisions.map(d => (
          <button key={d.name}
            onClick={() => setActiveDivision(d.name)}
            style={{
              padding: isMobile ? '6px 12px' : '7px 16px',
              borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: isMobile ? 13 : 14, fontWeight: 700, letterSpacing: '0.04em',
              background: d.name === activeDivision ? 'var(--accent)' : 'var(--bg-card)',
              color: d.name === activeDivision ? '#000' : 'var(--text-secondary)',
              border: `1px solid ${d.name === activeDivision ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.15s ease',
            }}>
            {d.name}
          </button>
        ))}
      </div>

      {/* Current division content */}
      {currentDivision && <DivisionView division={currentDivision} />}
    </div>
  )
}