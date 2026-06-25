import React, { useState } from 'react'
import { Play, ShieldAlert, Award, FileText, AlertTriangle, HelpCircle } from 'lucide-react'
import { playSuccess, playError, playBreakdown } from '../utils/audio'

function CO6HybridSystem({ config, backendUrl }) {
  const [weather, setWeather] = useState('Sunny')
  const [accident, setAccident] = useState(false)
  const [capacity, setCapacity] = useState(8)
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState(false)

  // Breakdown state
  const [breakdownResult, setBreakdownResult] = useState(null)
  const [simulatingBreakdown, setSimulatingBreakdown] = useState(false)

  const triggerHybridRun = () => {
    setRunning(false)
    setBreakdownResult(null)
    setRunning(true)
    fetch(`${backendUrl}/api/co6/hybrid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weather: weather,
        accident: accident,
        capacity: parseInt(capacity)
      })
    })
      .then(res => res.json())
      .then(data => {
        setRunResult(data)
        setRunning(false)
        if (data.operation.status === "Success") {
          playSuccess() // Play positive chime on successful morning dispatch
        } else {
          playError() // Play error buzz on scheduling collapse
        }
      })
      .catch(err => {
        console.error("Hybrid run failed:", err)
        setRunning(false)
        playError()
      })
  }

  const triggerBreakdown = () => {
    if (!runResult) return
    setSimulatingBreakdown(true)
    playBreakdown() // Play alarm siren immediately when breakdown occurs
    
    fetch(`${backendUrl}/api/co6/breakdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        broken_bus: "Bus_1",
        breakdown_node: "Stop_B",
        hybrid_result: runResult.operation
      })
    })
      .then(res => res.json())
      .then(data => {
        setBreakdownResult(data)
        setSimulatingBreakdown(false)
        if (data.recovery_status === "Success") {
          playSuccess() // Play positive arpeggio if all stranded students were rescued
        } else {
          playError() // Play low warning buzz if students were left behind
        }
      })
      .catch(err => {
        console.error("Breakdown simulation failed:", err)
        setSimulatingBreakdown(false)
        playError()
      })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Description */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>Course Outcome 6: Hybrid Architecture & Ethical AI</h3>
        <p style={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>
          CO6 represents the final capstone integration. The system coordinates: 
          <strong>(1) CSP scheduling</strong> for student assignments, <strong>(2) A* search</strong> for pathfinding, 
          <strong>(3) Bayesian Net inference</strong> for traffic estimation, and <strong>(4) Decision logic</strong> for dynamic rerouting.
        </p>
      </div>

      {/* Control Inputs */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Weather Condition</label>
            <select className="select-input" value={weather} onChange={e => setWeather(e.target.value)}>
              <option value="Sunny">Sunny</option>
              <option value="Rainy">Rainy</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Accident Status</label>
            <select className="select-input" value={accident ? 'True' : 'False'} onChange={e => setAccident(e.target.value === 'True')}>
              <option value="False">No Accident</option>
              <option value="True">Accident Reported</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Capacity Limit</label>
            <select className="select-input" value={capacity} onChange={e => setCapacity(e.target.value)}>
              <option value={8}>8 Students</option>
              <option value={6}>6 Students (Tighter limit)</option>
              <option value={10}>10 Students</option>
            </select>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={triggerHybridRun}
          disabled={running}
          style={{ height: '42px', marginTop: '16px' }}
        >
          <Play size={16} />
          {running ? 'Executing System...' : 'Run Morning Operation'}
        </button>
      </div>

      {runResult && (
        <>
          {/* Visual trace console */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Orchestration Trace Logs</h3>
            <div className="trace-console" style={{ maxHeight: '200px' }}>
              {runResult.operation.logs.map((log, idx) => {
                let isAlert = log.includes('[ALERT]') || log.includes('[FAILURE]')
                let tag = isAlert ? '[ALERT]' : '[INFO]'
                return (
                  <div key={idx} className={`trace-line ${isAlert ? 'warning' : 'success'}`}>
                    <span className="trace-tag">{tag}</span>
                    <span className="trace-msg">{log.replace('[ALERT] ', '').replace('[FAILURE] ', '')}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bus Route Details Cards */}
          {runResult.operation.status === "Success" && (
            <div className="grid-cols-2">
              {Object.entries(runResult.operation.routes).map(([busName, route]) => (
                <div key={busName} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                    <h3 style={{ fontSize: '1.15rem', color: busName === 'Bus_1' ? 'var(--primary)' : 'var(--accent)' }}>
                      {busName.replace('_', ' ')} Route Details
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
                    <div>
                      <strong style={{ color: 'var(--muted)' }}>Assigned Stops:</strong>
                      <div style={{ color: 'var(--foreground)', marginTop: '2px' }}>{route.stops.join(', ')}</div>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--muted)' }}>Roster:</strong>
                      <div style={{ color: 'var(--foreground)', marginTop: '2px' }}>{route.roster.join(', ')}</div>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--muted)' }}>Optimal Navigation Path:</strong>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent)', marginTop: '2px' }}>
                        {route.path.join(' → ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                      <span>Calculated Duration:</span>
                      <strong style={{ color: 'var(--foreground)' }}>
                        {route.actual_duration.toFixed(1)} mins 
                        {route.actual_duration > route.base_duration && (
                          <span style={{ color: 'var(--warning)', fontSize: '0.75rem', marginLeft: '6px' }}>
                            (+{(route.actual_duration - route.base_duration).toFixed(0)}m traffic penalty)
                          </span>
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Breakdown Rescue Simulation */}
          {runResult.operation.status === "Success" && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Failure Mode Engineering Simulation</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    Simulate real-time vehicle breakdown. The system will coordinate a rescue path utilizing the other active bus.
                  </p>
                </div>

                {!breakdownResult ? (
                  <button 
                    className="btn btn-outline" 
                    onClick={triggerBreakdown}
                    disabled={simulatingBreakdown}
                    style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                  >
                    <AlertTriangle size={16} />
                    {simulatingBreakdown ? 'Processing Rescue...' : 'Simulate Bus 1 Breakdown at Stop B'}
                  </button>
                ) : (
                  <button className="btn btn-outline" onClick={() => setBreakdownResult(null)}>
                    Reset Simulation
                  </button>
                )}
              </div>

              {breakdownResult && (
                <div style={{ marginTop: '16px', border: `1px solid ${breakdownResult.recovery_status === 'Success' ? 'var(--success)' : 'var(--error)'}`, background: breakdownResult.recovery_status === 'Success' ? 'rgba(16,185,129,0.03)' : 'rgba(239,68,68,0.03)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ color: breakdownResult.recovery_status === 'Success' ? 'var(--success)' : 'var(--error)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>
                    Recovery Engine Action: {breakdownResult.recovery_status.toUpperCase()}
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--foreground)', marginBottom: '10px' }}>
                    {breakdownResult.message}
                  </p>
                  
                  {breakdownResult.new_roster && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      <strong>Bus 2 Updated Roster:</strong> {breakdownResult.new_roster.join(', ')}
                    </div>
                  )}
                  {breakdownResult.left_behind && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Rescued by Bus 2:</strong> {breakdownResult.rescued.join(', ')}</div>
                      <div style={{ color: 'var(--error)' }}>
                        <strong>Stranded:</strong> {breakdownResult.left_behind.join(', ')} (Requires external support due to capacity limits).
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ethics and Limitations Check */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--primary)" />
              Technical Ethics & Algorithmic Limitations
            </h3>
            
            <div className="grid-cols-2">
              <div style={{ padding: '14px', background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: '10px' }}>
                <h4 style={{ color: 'var(--error)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} />
                  Heuristic Bias (Algorithmic Discrimination)
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.4 }}>
                  {runResult.ethics["Heuristic Bias"]}
                </p>
              </div>

              <div style={{ padding: '14px', background: 'rgba(217,119,6,0.03)', border: '1px solid rgba(217,119,6,0.15)', borderRadius: '10px' }}>
                <h4 style={{ color: 'var(--warning)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HelpCircle size={14} />
                  Uncertainty Calibration Limitations
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.4 }}>
                  {runResult.ethics["Uncertainty Calibration Errors"]}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CO6HybridSystem
