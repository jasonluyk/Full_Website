import { useState, useEffect } from 'react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

function calcStandings(baseTeams, allGames) {
  const stats = {}
  for (const t of baseTeams) {
    stats[t.team] = { ...t, won: 0, lost: 0, runs_scored: 0, runs_allowed: 0 }
  }
  for (const g of allGames) {
    if (!g.complete) continue
    const sa = parseInt(g.score_a), sb = parseInt(g.score_b)
    if (isNaN(sa) || isNaN(sb)) continue
    const ta = g.team_a?.trim(), tb = g.team_b?.trim()
    if (stats[ta]) {
      stats[ta].won += sa > sb ? 1 : sa === sb ? 0.5 : 0
      stats[ta].lost += sb > sa ? 1 : sa === sb ? 0.5 : 0
      stats[ta].runs_scored += sa
      stats[ta].runs_allowed += sb
    }
    if (stats[tb]) {
      stats[tb].won += sb > sa ? 1 : sa === sb ? 0.5 : 0
      stats[tb].lost += sa > sb ? 1 : sa === sb ? 0.5 : 0
      stats[tb].runs_scored += sb
      stats[tb].runs_allowed += sa
    }
  }
  return Object.values(stats)
}

function seedTeams(standings, allGames) {
  const h2h = {}
  for (const g of allGames.filter(g => g.complete)) {
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
  return [...standings].sort((a, b) => {
    if (b.won !== a.won) return b.won - a.won
    if (a.lost !== b.lost) return a.lost - b.lost
    const tied = standings.filter(t => t.won === a.won && t.lost === a.lost)
    if (tied.length === 2) {
      const ab = h2h[a.team]?.[b.team]
      if (ab && ab.winsA !== ab.winsB) return ab.winsB - ab.winsA
    }
    if (a.runs_allowed !== b.runs_allowed) return a.runs_allowed - b.runs_allowed
    if (b.runs_scored !== a.runs_scored) return b.runs_scored - a.runs_scored
    return (b.runs_scored - b.runs_allowed) - (a.runs_scored - a.runs_allowed)
  }).map((t, i) => ({ ...t, seed: i + 1 }))
}

function StandingsSidebar({ seeded, highlightTeam, setHighlightTeam, teams, filledCount, totalPending, completedCount }) {
  return (
    <div>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
        📊 Projected Seeding
      </div>
      <select className="select" style={{ marginBottom: 10, fontSize: 12, width: '100%' }}
        value={highlightTeam} onChange={e => setHighlightTeam(e.target.value)}>
        <option value="">— Highlight a team —</option>
        {teams.map(t => <option key={t.team} value={t.team}>{t.team}</option>)}
      </select>
      <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Team</th>
              <th style={{ width: 36 }}>W</th>
              <th style={{ width: 36 }}>L</th>
              <th style={{ width: 46 }}>+/-</th>
            </tr>
          </thead>
          <tbody>
            {seeded.map((t, i) => {
              const isHL = t.team === highlightTeam
              const diff = t.runs_scored - t.runs_allowed
              return (
                <tr key={i} style={isHL ? { background: 'var(--accent-dim)', outline: '2px solid var(--accent)', outlineOffset: '-2px' } : {}}>
                  <td style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800,
                    color: isHL ? 'var(--accent)' : 'var(--text-muted)', textAlign: 'center' }}>{t.seed}</td>
                  <td style={{ fontWeight: isHL ? 700 : 400, fontSize: 11 }}>
                    {t.team.length > 20 ? t.team.substring(0, 20) + '…' : t.team}
                  </td>
                  <td style={{ color: 'var(--green)', fontWeight: 700 }}>
                    {t.won % 1 === 0.5 ? `${Math.floor(t.won)}.5` : t.won}
                  </td>
                  <td style={{ color: 'var(--red)' }}>
                    {t.lost % 1 === 0.5 ? `${Math.floor(t.lost)}.5` : t.lost}
                  </td>
                  <td style={{ color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filledCount > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          {filledCount} predicted · {completedCount} final · updates live
        </p>
      )}
    </div>
  )
}

export default function Predictor() {
  const isMobile = useIsMobile()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scores, setScores] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pred_scores') || '{}') }
    catch { return {} }
  })
  const [highlightTeam, setHighlightTeam] = useState(
    () => localStorage.getItem('pred_highlight') || ''
  )
  const [saved, setSaved] = useState(false)
  const [showStandings, setShowStandings] = useState(false)

  useEffect(() => {
    fetch('/softball/api/softball/tournament')
      .then(r => r.json())
      .then(res => { setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { localStorage.setItem('pred_highlight', highlightTeam) }, [highlightTeam])

  const save = () => {
    localStorage.setItem('pred_scores', JSON.stringify(scores))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const clearAll = () => { setScores({}); localStorage.removeItem('pred_scores') }

  const setScore = (gameNum, field, val) => {
    setScores(prev => ({ ...prev, [gameNum]: { ...(prev[gameNum] || { a: '', b: '' }), [field]: val } }))
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>

  if (!data) return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h1 className="page-title">🔮 Score Predictor</h1>
      <div className="alert alert-info" style={{ marginTop: 20 }}>No tournament loaded yet.</div>
    </div>
  )

  const poolGames = data.pool_play || []
  const teams = data.standings || []

  const mergedGames = poolGames.map(g => {
    if (g.complete) return { ...g }
    const pred = scores[g.game]
    const sa = pred?.a !== undefined ? pred.a : ''
    const sb = pred?.b !== undefined ? pred.b : ''
    const saInt = parseInt(sa), sbInt = parseInt(sb)
    const hasPred = sa !== '' && sb !== '' && !isNaN(saInt) && !isNaN(sbInt)
    return { ...g, score_a: hasPred ? String(saInt) : null, score_b: hasPred ? String(sbInt) : null,
      complete: hasPred, predicted: hasPred }
  })

  const projStandings = calcStandings(teams, mergedGames)
  const seeded = seedTeams(projStandings, mergedGames)

  const filledCount = Object.values(scores).filter(s =>
    s.a !== '' && s.b !== '' && !isNaN(parseInt(s.a)) && !isNaN(parseInt(s.b))
  ).length
  const totalPending = poolGames.filter(g => !g.complete).length
  const completedCount = poolGames.filter(g => g.complete).length

  const timeSlots = {}
  for (const g of poolGames) {
    if (!timeSlots[g.time]) timeSlots[g.time] = []
    timeSlots[g.time].push(g)
  }

  const sortedSlots = Object.entries(timeSlots).sort((a, b) => {
    const toMin = t => {
      const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
      if (!m) return 0
      let h = parseInt(m[1]), min = parseInt(m[2])
      if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
      if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
      return h * 60 + min
    }
    return toMin(a[0]) - toMin(b[0])
  })

  const GameEntry = ({ g }) => {
    const pred = scores[g.game] || { a: '', b: '' }
    const isComplete = g.complete
    const saInt = parseInt(pred.a), sbInt = parseInt(pred.b)
    const hasPred = !isNaN(saInt) && !isNaN(sbInt) && pred.a !== '' && pred.b !== ''
    const aWins = isComplete ? parseInt(g.score_a) > parseInt(g.score_b) : hasPred && saInt > sbInt
    const bWins = isComplete ? parseInt(g.score_b) > parseInt(g.score_a) : hasPred && sbInt > saInt
    const isTie = isComplete ? parseInt(g.score_a) === parseInt(g.score_b) : hasPred && saInt === sbInt
    const aIsHL = g.team_a === highlightTeam
    const bIsHL = g.team_b === highlightTeam

    return (
      <div style={{
        padding: isMobile ? '12px' : '10px 14px',
        borderRadius: 10, marginBottom: 8,
        background: 'var(--bg-card)',
        border: `1px solid ${isComplete ? 'rgba(34,197,94,0.2)' : hasPred ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`
      }}>
        {/* Status badge */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          {isComplete
            ? <span className="badge badge-green" style={{ fontSize: 10 }}>Final</span>
            : hasPred
            ? <span className="badge badge-gold" style={{ fontSize: 10 }}>Predicted</span>
            : <span className="badge badge-gray" style={{ fontSize: 10 }}>Scheduled</span>}
        </div>

        {/* Team A row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{
            flex: 1, fontWeight: aIsHL ? 800 : 500,
            color: aIsHL ? 'var(--accent)' : aWins ? 'var(--green)' : 'var(--text-primary)',
            fontSize: isMobile ? 15 : 14
          }}>{g.team_a}</span>
          {isComplete ? (
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: isMobile ? 28 : 22,
              fontWeight: 800, color: aWins ? 'var(--green)' : isTie ? 'var(--accent)' : 'var(--text-muted)',
              minWidth: 36, textAlign: 'center' }}>{g.score_a}</span>
          ) : (
            <input type="number" min="0" max="99" className="input"
              style={{ width: isMobile ? 64 : 52, textAlign: 'center',
                fontSize: isMobile ? 22 : 18, fontWeight: 700,
                padding: isMobile ? '8px 6px' : '4px 6px' }}
              placeholder="—" value={pred.a}
              onChange={e => setScore(g.game, 'a', e.target.value)}
            />
          )}
        </div>

        {/* Team B row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            flex: 1, fontWeight: bIsHL ? 800 : 500,
            color: bIsHL ? 'var(--accent)' : bWins ? 'var(--green)' : 'var(--text-primary)',
            fontSize: isMobile ? 15 : 14
          }}>{g.team_b}</span>
          {isComplete ? (
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: isMobile ? 28 : 22,
              fontWeight: 800, color: bWins ? 'var(--green)' : isTie ? 'var(--accent)' : 'var(--text-muted)',
              minWidth: 36, textAlign: 'center' }}>{g.score_b}</span>
          ) : (
            <input type="number" min="0" max="99" className="input"
              style={{ width: isMobile ? 64 : 52, textAlign: 'center',
                fontSize: isMobile ? 22 : 18, fontWeight: 700,
                padding: isMobile ? '8px 6px' : '4px 6px' }}
              placeholder="—" value={pred.b}
              onChange={e => setScore(g.game, 'b', e.target.value)}
            />
          )}
        </div>

        {/* Field */}
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{g.field}</div>
      </div>
    )
  }

  const gamesSection = (
    <div>
      {sortedSlots.map(([slotTime, slotGames]) => (
        <div key={slotTime} style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
            ⏰ {slotTime}
          </div>
          {slotGames.map(g => <GameEntry key={g.game} g={g} />)}
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 12px' : '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: isMobile ? 22 : 28,
            fontWeight: 800, margin: '0 0 4px' }}>🔮 Score Predictor</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {filledCount > 0 ? `${filledCount} of ${totalPending} games predicted` : 'Enter scores to project seeding'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={save}
            style={{ fontSize: isMobile ? 13 : 14, padding: isMobile ? '8px 12px' : undefined }}>
            {saved ? '✅' : '💾'}
          </button>
          {filledCount > 0 && (
            <button className="btn btn-danger" onClick={clearAll}
              style={{ fontSize: isMobile ? 13 : 14, padding: isMobile ? '8px 12px' : undefined }}>
              🗑️
            </button>
          )}
        </div>
      </div>

      {isMobile ? (
        /* Mobile: games stacked, standings togglable */
        <>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginBottom: 16, fontSize: 14 }}
            onClick={() => setShowStandings(s => !s)}>
            {showStandings ? '▲ Hide Standings' : '📊 Show Projected Standings'}
          </button>
          {showStandings && (
            <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg-card)',
              borderRadius: 10, border: '1px solid var(--border)' }}>
              <StandingsSidebar seeded={seeded} highlightTeam={highlightTeam}
                setHighlightTeam={setHighlightTeam} teams={teams}
                filledCount={filledCount} totalPending={totalPending} completedCount={completedCount} />
            </div>
          )}
          {gamesSection}
        </>
      ) : (
        /* Desktop: side-by-side */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          <div>{gamesSection}</div>
          <div style={{ position: 'sticky', top: 70 }}>
            <StandingsSidebar seeded={seeded} highlightTeam={highlightTeam}
              setHighlightTeam={setHighlightTeam} teams={teams}
              filledCount={filledCount} totalPending={totalPending} completedCount={completedCount} />
          </div>
        </div>
      )}
    </div>
  )
}