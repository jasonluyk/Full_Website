import { useState, useEffect } from 'react'

function ScoreCell({ score, winner }) {
  if (!score) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <strong style={{ color: winner ? 'var(--green)' : 'var(--text-primary)', fontSize: 16 }}>
      {score}
    </strong>
  )
}

function seedTeams(teams, poolGames) {
  // Build head-to-head results from completed pool games
  const h2h = {} // h2h[teamA][teamB] = {winsA, winsB}
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

  function compareTwo(a, b) {
    // 1. Win-Loss
    if (b.won !== a.won) return b.won - a.won
    if (a.lost !== b.lost) return a.lost - b.lost

    // 2. Head-to-head (only if exactly 2 teams tied)
    const ab = h2h[a.team]?.[b.team]
    if (ab) {
      if (ab.winsA !== ab.winsB) return ab.winsB - ab.winsA // higher wins = better
    }

    // 3. Runs Allowed
    if (a.runs_allowed !== b.runs_allowed) return a.runs_allowed - b.runs_allowed

    // 4. Runs Scored
    if (b.runs_scored !== a.runs_scored) return b.runs_scored - a.runs_scored

    // 5. Run Differential
    const diffA = a.runs_scored - a.runs_allowed
    const diffB = b.runs_scored - b.runs_allowed
    if (diffB !== diffA) return diffB - diffA

    // 6. Coin flip — show as tied
    return 0
  }

  // Group by win-loss record, apply tiebreakers within groups
  const sorted = [...teams].sort((a, b) => {
    const wonDiff = b.won - a.won
    if (wonDiff !== 0) return wonDiff
    const lostDiff = a.lost - b.lost
    if (lostDiff !== 0) return lostDiff

    // Both have same W-L — check if 2 or 3+ tied
    const tied = teams.filter(t =>
      t.won === a.won && t.lost === a.lost
    )

    if (tied.length === 2) {
      // Head-to-head applicable
      return compareTwo(a, b)
    } else {
      // 3+ tied — skip H2H, go to runs allowed
      if (a.runs_allowed !== b.runs_allowed) return a.runs_allowed - b.runs_allowed
      if (b.runs_scored !== a.runs_scored) return b.runs_scored - a.runs_scored
      const diffA = a.runs_scored - a.runs_allowed
      const diffB = b.runs_scored - b.runs_allowed
      return diffB - diffA
    }
  })

  return sorted.map((t, i) => ({ ...t, seed: i + 1 }))
}

function StandingsTable({ teams, poolGames }) {
  const anyScored = teams.some(t => t.won > 0 || t.lost > 0)
  const seeded = anyScored ? seedTeams(teams, poolGames) : teams.map((t, i) => ({ ...t, seed: i + 1 }))

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
                <td style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20,
                  fontWeight: 800, color: 'var(--accent)', textAlign: 'center' }}>
                  {t.seed}
                </td>
                <td style={{ fontWeight: 600 }}>{t.team}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.location}</td>
                <td style={{ color: 'var(--green)', fontWeight: 700 }}>
                  {t.won % 1 === 0.5 ? `${Math.floor(t.won)}.5` : t.won}
                </td>
                <td style={{ color: 'var(--red)' }}>
                  {t.lost % 1 === 0.5 ? `${Math.floor(t.lost)}.5` : t.lost}
                </td>
                <td>{t.runs_scored}</td>
                <td>{t.runs_allowed}</td>
                <td style={{
                  color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)',
                  fontWeight: 600
                }}>
                  {diff > 0 ? `+${diff}` : diff}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {anyScored && (
        <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)' }}>
          Projected seeds: W-L → H2H (2-way ties) → RA → RS → Run Diff · Seeds finalized by Top Gun after pool play
        </div>
      )}
    </div>
  )
}

function GamesTable({ games, title }) {
  if (!games || games.length === 0) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700,
        color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase',
        marginBottom: 12 }}>{title}</h3>
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Game</th>
              <th style={{ width: 50 }}>Day</th>
              <th style={{ width: 80 }}>Time</th>
              <th style={{ width: 150 }}>Field</th>
              <th>Team A</th>
              <th style={{ width: 60 }}>Score</th>
              <th>Team B</th>
              <th style={{ width: 60 }}>Score</th>
              <th style={{ width: 100 }}>Status</th>
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
                  <td style={{ color: 'var(--text-muted)' }}>{g.day}</td>
                  <td style={{ color: 'var(--accent)' }}>{g.time}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.field}</td>
                  <td style={{ fontWeight: aWins ? 700 : 400, color: aWins ? 'var(--green)' : 'var(--text-primary)' }}>
                    {g.team_a}
                  </td>
                  <td><ScoreCell score={g.score_a} winner={aWins} /></td>
                  <td style={{ fontWeight: bWins ? 700 : 400, color: bWins ? 'var(--green)' : 'var(--text-primary)' }}>
                    {g.team_b}
                  </td>
                  <td><ScoreCell score={g.score_b} winner={bWins} /></td>
                  <td>
                    {g.complete
                      ? <span className="badge badge-green">Final</span>
                      : <span className="badge badge-gray">Scheduled</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Tournament() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('none')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = () => {
    fetch('/softball/api/softball/tournament')
      .then(r => r.json())
      .then(res => {
        setData(res.data)
        setStatus(res.status)
        setLastUpdated(new Date())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 120000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner" />
    </div>
  )

  if (status === 'none' || !data) return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <h1 className="page-title">🥎 Softball Tournament Tracker</h1>
      <div className="alert alert-info" style={{ marginTop: 20 }}>
        No tournament loaded. Use Admin to sync a tournament.
      </div>
    </div>
  )

  const completedPool = data.pool_play?.filter(g => g.complete).length || 0
  const totalPool = data.pool_play?.length || 0
  const completedBracket = data.brackets?.flatMap(b => b.games).filter(g => g.complete).length || 0
  const totalBracket = data.brackets?.flatMap(b => b.games).length || 0

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--accent)' }}>TOP GUN SPORTS</span>
          </div>
          <h1 className="page-title">🥎 {data.name}</h1>
          {lastUpdated && (
            <p className="page-subtitle">Last updated: {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 2 min</p>
          )}
        </div>
        <button className="btn btn-secondary" onClick={fetchData}>↻ Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-value">{data.standings?.length || 0}</div>
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
          <div className="stat-value">{data.brackets?.length || 0}</div>
          <div className="stat-label">Brackets</div>
        </div>
      </div>

      {data.standings?.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 24, fontWeight: 800, margin: 0 }}>
              📊 Projected Seeding
            </h2>
            <span className="badge badge-gold">Updates Live</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Based on pool play results · determines bracket placement
            </span>
          </div>
          <StandingsTable teams={data.standings} poolGames={data.pool_play || []} />
        </>
      )}

      {data.pool_play?.length > 0 && (
        <GamesTable games={data.pool_play} title="Pool Play" />
      )}

      {data.brackets?.map((bracket, i) => (
        <GamesTable key={i} games={bracket.games} title={bracket.name} />
      ))}
    </div>
  )
}