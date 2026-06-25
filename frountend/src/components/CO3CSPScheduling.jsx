import React, { useState } from 'react'
import { Play, ShieldAlert, Award, FileText } from 'lucide-react'
import { playSuccess, playError } from '../utils/audio'

function CO3CSPScheduling({ config, backendUrl }) {
  const [capacity, setCapacity] = useState(8)
  const [cspResults, setCspResults] = useState(null)
  const [running, setRunning] = useState(false)

  const triggerCsp = () => {
    setRunning(true)
    fetch(`${backendUrl}/api/co3/csp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity: parseInt(capacity) })
    })
      .then(res => res.json())
      .then(data => {
        setCspResults(data)
        setRunning(false)
        if (data.backtracking.success) {
          playSuccess() // Play positive chime when CSP solver finds solution
        } else {
          playError() // Play low warning buzz when constraint solver fails
        }
      })
      .catch(err => {
        console.error("CSP failed:", err)
        setRunning(false)
        playError()
      })
  }

  const renderRoster = (solution) => {
    if (!solution) return null
    const bus1 = []
    const bus2 = []
    Object.entries(solution).forEach(([student, bus]) => {
      if (bus === 'Bus_1') bus1.push(student)
      else bus2.push(student)
    })

    return (
      <div className="grid-cols-2" style={{ marginTop: '16px' }}>
        <div style={{ padding: '16px', background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.12)', borderRadius: '12px' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '12px', fontWeight: 700, fontSize: '0.95rem' }}>
            BUS 1 ({bus1.length} students)
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {bus1.map(s => (
              <span key={s} style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#ffffff', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: '20px' }}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px', background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.12)', borderRadius: '12px' }}>
          <h4 style={{ color: 'var(--accent)', marginBottom: '12px', fontWeight: 700, fontSize: '0.95rem' }}>
            BUS 2 ({bus2.length} students)
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {bus2.map(s => (
              <span key={s} style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#ffffff', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: '20px' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Description */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>Course Outcome 3: Constraint Satisfaction & Scheduling</h3>
        <p style={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>
          CO3 focuses on constraint optimization. We allocate 13 students to 2 buses while satisfying: 
          <strong>(1) capacity constraints</strong>, <strong>(2) sibling grouping constraints</strong> (Alice & Aaron, Harry & Helen), and 
          <strong>(3) wheelchair compatibility constraints</strong> (Chloe must ride Bus 1).
        </p>
      </div>

      {/* Solver Controls */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Set Bus Capacity:</span>
          <input 
            type="range" 
            min="4" 
            max="12" 
            value={capacity}
            onChange={e => setCapacity(e.target.value)}
            style={{ width: '150px', accentColor: 'var(--primary)' }}
          />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{capacity} students</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '10px' }}>
            (Total students = 13. Capacity &lt; 7 is mathematically unsatisfiable)
          </span>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={triggerCsp}
          disabled={running}
        >
          <Play size={16} />
          {running ? 'Running Solvers...' : 'Run CSP Solvers'}
        </button>
      </div>

      {cspResults && (
        <>
          {/* Backtracking results card */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Systematic Backtracking Solver
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: cspResults.backtracking.success ? 'var(--success-glow)' : 'var(--error-glow)', color: cspResults.backtracking.success ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                    {cspResults.backtracking.success ? 'SATISFIABLE' : 'UNSATISFIABLE'}
                  </span>
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  Propagates constraints via Forward Checking, selecting variables using MRV/Degree heuristics.
                </p>
              </div>
              <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '0.9rem' }}>
                Search Steps: {cspResults.backtracking.steps}
              </span>
            </div>

            {cspResults.backtracking.success ? (
              renderRoster(cspResults.backtracking.solution)
            ) : (
              <div style={{ marginTop: '16px', border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.03)', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ color: 'var(--error)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <ShieldAlert size={16} />
                  Explainability Log: Why the solver failed
                </h4>
                <div className="trace-console" style={{ maxHeight: '180px' }}>
                  {cspResults.backtracking.logs.map((log, idx) => (
                    <div key={idx} className="trace-line error">
                      <span className="trace-tag">[FAIL]</span>
                      <span className="trace-msg">{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Min Conflicts & SAT Intuition Grid */}
          <div className="grid-cols-2">
            {/* Min Conflicts */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Local Search (Min-Conflicts)
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: cspResults.min_conflicts.success ? 'var(--success-glow)' : 'var(--error-glow)', color: cspResults.min_conflicts.success ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                  {cspResults.min_conflicts.success ? 'SOLVED' : 'STUCK'}
                </span>
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                Iterative local optimization repairing conflicts.
              </p>
              
              {cspResults.min_conflicts.success ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justify: 'space-between', gap: '16px' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>
                    Successfully solved student scheduling in <strong>{cspResults.min_conflicts.steps} conflicts-repair steps</strong>.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                    <div>
                      <strong>Bus 1: </strong> 
                      <span style={{ color: 'var(--muted)' }}>
                        {Object.entries(cspResults.min_conflicts.solution).filter(([_, b]) => b === 'Bus_1').map(([s]) => s).join(', ')}
                      </span>
                    </div>
                    <div>
                      <strong>Bus 2: </strong> 
                      <span style={{ color: 'var(--muted)' }}>
                        {Object.entries(cspResults.min_conflicts.solution).filter(([_, b]) => b === 'Bus_2').map(([s]) => s).join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.875rem', padding: '20px 0' }}>
                  Local search exceeded maximum steps. Stuck in local minima (e.g. tight wheelchair/sibling restraints).
                </p>
              )}
            </div>

            {/* SAT Translation info */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--primary)" />
                SAT Clause Translation Intuition
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                Propositional logic modeling using Boolean variables X_s_b (student s on bus b).
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', overflowY: 'auto', maxHeight: '180px' }}>
                {cspResults.sat_info.ExampleClauses.map((c, idx) => (
                  <div key={idx} style={{ padding: '8px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <strong style={{ color: 'var(--foreground)', display: 'block', marginBottom: '2px' }}>{c.Constraint}</strong>
                    <code style={{ color: 'var(--accent)' }}>{c.CNF}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CO3CSPScheduling
