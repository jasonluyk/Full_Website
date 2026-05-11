import { useState, useEffect } from 'react'

// ── Seeding logic ─────────────────────────────────────────────────────
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

export default function Predictor() {
  const [data, setData] = useState(null)
  const [allDivisions, setAllDivisions] = useState([])
  const [activeDivision, setActiveDivision] = useState(
    () => localStorage.getItem('active_division') || ''
  )
  const [loading, setLoading] = useState(true)
  const [scores, setScores] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pred_scores') || '{}') }
    catch { return {} }
  })
  const [highlightTeam, setHighlightTeam] = useState(
    () => localStorage.getItem('pred_highlight') || ''
  )
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/softball/api/softball/tournament')
      .then(r => r.json())
      .then(res => {
        const divisions = res.divisions || []
        setAllDivisions(divisions)
        const saved = localStorage.getItem('active_division')
        const match = divisions.find(d => d.name === saved)
        const active = match || divisions[0]
        if (active) {
          setActiveDivision(active.name)
          setData(active)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const switchDivision = (name) => {
    const div = allDivisions.find(d => d.name === name)
    if (div) {
      setActiveDivision(name)
      setData(div)
      localStorage.setItem('active_division', name)
      setScores({})
      localStorage.removeItem('pred_scores')
    }
  }

  useEffect(() => {
    localStorage.setItem('pred_highlight', highlightTeam)
  }, [highlightTeam])

  const save = () => {
    localStorage.setItem('pred_scores', JSON.stringify(scores))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const clearAll = () => {
    setScores({})
    localStorage.removeItem('pred_scores')
  }

  const setScore = (gameNum, field, val) => {
    setScores(prev => ({
      ...prev,
      [gameNum]: { ...(prev[gameNum] || { a: '', b: '' }), [field]: val }
    }))
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>

  if (!data) return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <h1 className="page-title">🔮 Score Predictor</h1>
      <div className="alert alert-info" style={{ marginTop: 20 }}>No tournament loaded yet.</div>
    </div>
  )

  const poolGames = data.pool_play || []
  const teams = data.standings || []

  // Build merged game list — use actual score if complete, predicted if entered
  const mergedGames = poolGames.map(g => {
    if (g.complete) return { ...g }
    const pred = scores[g.game]
    const sa = pred?.a !== undefined ? pred.a : ''
    const sb = pred?.b !== undefined ? pred.b : ''
    const saInt = parseInt(sa), sbInt = parseInt(sb)
    const hasPred = sa !== '' && sb !== '' && !isNaN(saInt) && !isNaN(sbInt)
    return {
      ...g,
      score_a: hasPred ? String(saInt) : null,
      score_b: hasPred ? String(sbInt) : null,
      complete: hasPred,
      predicted: hasPred,
    }
  })

  const projStandings = calcStandings(teams, mergedGames)
  const seeded = seedTeams(projStandings, mergedGames)

  const filledCount = Object.values(scores).filter(s => s.a !== '' && s.b !== '' && !isNaN(parseInt(s.a)) && !isNaN(parseInt(s.b))).length
  const totalPending = poolGames.filter(g => !g.complete).length

  // Group games by time slot
  const timeSlots = {}
  for (const g of poolGames) {
    if (!timeSlots[g.time]) timeSlots[g.time] = []
    timeSlots[g.time].push(g)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">🔮 Score Predictor</h1>
          <p className="page-subtitle">
            Enter scores for any game — projected seeding updates instantly
            {filledCount > 0 && ` · ${filledCount} of ${totalPending} games predicted`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={save}>
            {saved ? '✅ Saved!' : '💾 Save'}
          </button>
          {filledCount > 0 && (
            <button className="btn btn-danger" onClick={clearAll}>🗑️ Clear All</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

        {/* Left — game score entry */}
        <div>
          {Object.entries(timeSlots)
            .sort((a, b) => {
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
            .map(([slotTime, slotGames]) => (
              <div key={slotTime} style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13,
                  fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--accent)', marginBottom: 8 }}>
                  ⏰ {slotTime}
                </div>
                {slotGames.map(g => {
                  const pred = scores[g.game] || { a: '', b: '' }
                  const isComplete = g.complete
                  const saInt = parseInt(pred.a), sbInt = parseInt(pred.b)
                  const hasPred = !isNaN(saInt) && !isNaN(sbInt) && pred.a !== '' && pred.b !== ''
                  const aWins = isComplete ? parseInt(g.score_a) > parseInt(g.score_b) : hasPred && saInt > sbInt
                  const bWins = isComplete ? parseInt(g.score_b) > parseInt(g.score_a) : hasPred && sbInt > saInt
                  const aTie = isComplete ? parseInt(g.score_a) === parseInt(g.score_b) : hasPred && saInt === sbInt

                  const aIsHL = g.team_a === highlightTeam
                  const bIsHL = g.team_b === highlightTeam

                  return (
                    <div key={g.game} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                      gap: 8, alignItems: 'center', marginBottom: 8,
                      padding: '10px 14px', borderRadius: 10,
                      background: 'var(--bg-card)', border: `1px solid ${
                        isComplete ? 'rgba(34,197,94,0.2)' :
                        hasPred ? 'var(--accent-dim)' : 'var(--border)'
                      }`
                    }}>
                      {/* Team A */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <span style={{
                          fontWeight: aIsHL ? 800 : 500,
                          color: aIsHL ? 'var(--accent)' : 'var(--text-primary)',
                          fontSize: aIsHL ? 14 : 13, textAlign: 'right'
                        }}>{g.team_a}</span>
                        {isComplete ? (
                          <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22,
                            fontWeight: 800, color: aWins ? 'var(--green)' : aTie ? 'var(--accent)' : 'var(--text-muted)',
                            minWidth: 32, textAlign: 'center' }}>
                            {g.score_a}
                          </span>
                        ) : (
                          <input type="number" min="0" max="99"
                            className="input"
                            style={{ width: 52, textAlign: 'center', fontSize: 18, fontWeight: 700,
                              padding: '4px 6px',
                              borderColor: hasPred && aWins ? 'var(--green)' : hasPred && aTie ? 'var(--accent)' : undefined }}
                            placeholder="—"
                            value={pred.a}
                            onChange={e => setScore(g.game, 'a', e.target.value)}
                          />
                        )}
                      </div>

                      {/* Divider */}
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)',
                        fontSize: 11, fontWeight: 600 }}>
                        {isComplete ? <span className="badge badge-green" style={{ fontSize: 10 }}>Final</span>
                          : hasPred ? <span className="badge badge-gold" style={{ fontSize: 10 }}>Pred</span>
                          : <span style={{ color: 'var(--border)' }}>vs</span>}
                      </div>

                      {/* Team B */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isComplete ? (
                          <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22,
                            fontWeight: 800, color: bWins ? 'var(--green)' : aTie ? 'var(--accent)' : 'var(--text-muted)',
                            minWidth: 32, textAlign: 'center' }}>
                            {g.score_b}
                          </span>
                        ) : (
                          <input type="number" min="0" max="99"
                            className="input"
                            style={{ width: 52, textAlign: 'center', fontSize: 18, fontWeight: 700,
                              padding: '4px 6px',
                              borderColor: hasPred && bWins ? 'var(--green)' : hasPred && aTie ? 'var(--accent)' : undefined }}
                            placeholder="—"
                            value={pred.b}
                            onChange={e => setScore(g.game, 'b', e.target.value)}
                          />
                        )}
                        <span style={{
                          fontWeight: bIsHL ? 800 : 500,
                          color: bIsHL ? 'var(--accent)' : 'var(--text-primary)',
                          fontSize: bIsHL ? 14 : 13
                        }}>{g.team_b}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
        </div>

        {/* Right — live projected standings */}
        <div style={{ position: 'sticky', top: 70 }}>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700 }}>
              📊 Projected Seeding
            </div>
          </div>

          {/* Highlight team selector */}
          <select className="select" style={{ marginBottom: 12, fontSize: 12 }}
            value={highlightTeam}
            onChange={e => setHighlightTeam(e.target.value)}>
            <option value="">— Highlight a team —</option>
            {teams.map(t => <option key={t.team} value={t.team}>{t.team}</option>)}
          </select>

          <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Team</th>
                  <th style={{ width: 40 }}>W</th>
                  <th style={{ width: 40 }}>L</th>
                  <th style={{ width: 50 }}>+/-</th>
                </tr>
              </thead>
              <tbody>
                {seeded.map((t, i) => {
                  const isHL = t.team === highlightTeam
                  const diff = t.runs_scored - t.runs_allowed
                  return (
                    <tr key={i} style={isHL ? {
                      background: 'var(--accent-dim)',
                      outline: '2px solid var(--accent)',
                      outlineOffset: '-2px'
                    } : {}}>
                      <td style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16,
                        fontWeight: 800, color: isHL ? 'var(--accent)' : 'var(--text-muted)',
                        textAlign: 'center' }}>{t.seed}</td>
                      <td style={{ fontWeight: isHL ? 700 : 400, fontSize: 11 }}>
                        {t.team.length > 22 ? t.team.substring(0, 22) + '…' : t.team}
                      </td>
                      <td style={{ color: 'var(--green)', fontWeight: 700 }}>
                        {t.won % 1 === 0.5 ? `${Math.floor(t.won)}.5` : t.won}
                      </td>
                      <td style={{ color: 'var(--red)' }}>
                        {t.lost % 1 === 0.5 ? `${Math.floor(t.lost)}.5` : t.lost}
                      </td>
                      <td style={{ color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)',
                        fontWeight: 600, fontSize: 11 }}>
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
              {filledCount} predicted · {poolGames.filter(g => g.complete).length} final · updates live
            </p>
          )}
        </div>

      </div>
    </div>
  )
}