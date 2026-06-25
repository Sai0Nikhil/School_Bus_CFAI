import React, { useState, useEffect } from 'react'
import { Play, RotateCcw, Activity } from 'lucide-react'
import { playMove, playPickup, playSuccess, playError } from '../utils/audio'

function CO1AgentModel({ config, backendUrl }) {
  const [peasInfo, setPeasInfo] = useState(null)
  const [simulationLogs, setSimulationLogs] = useState([])
  const [playbackLogs, setPlaybackLogs] = useState([])
  const [finalState, setFinalState] = useState(null)
  const [simulating, setSimulating] = useState(false)

  useEffect(() => {
    fetch(`${backendUrl}/api/co1/peas`)
      .then(res => res.json())
      .then(data => setPeasInfo(data))
      .catch(err => console.error("Error loading PEAS:", err))
  }, [backendUrl])

  const startSimulation = () => {
    setSimulating(true)
    setPlaybackLogs([])
    setFinalState(null)
    
    fetch(`${backendUrl}/api/co1/simulate`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        setSimulationLogs(data.logs)
        // Run step-by-step playback with audio effects
        playbackSteps(data.logs, 0, data.final_state)
      })
      .catch(err => {
        console.error("Simulation failed:", err)
        setSimulating(false)
      })
  }

  const playbackSteps = (logs, index, fState) => {
    if (index >= logs.length) {
      setFinalState(fState)
      setSimulating(false)
      return
    }

    const logEntry = logs[index]
    setPlaybackLogs(prev => [...prev, logEntry])

    // Play corresponding Web Audio API sound
    if (logEntry.step === "MOVE" || logEntry.step === "SIMULATION_START") {
      playMove()
    } else if (logEntry.step === "PICKUP") {
      playPickup()
    } else if (logEntry.step === "CONSTRAINT_VIOLATION") {
      playError()
    } else if (logEntry.step === "DROP" || logEntry.step === "SIMULATION_END") {
      playSuccess()
    }

    setTimeout(() => {
      playbackSteps(logs, index + 1, fState)
    }, 450) // Playback interval
  }

  const resetSimulation = () => {
    setSimulationLogs([])
    setPlaybackLogs([])
    setFinalState(null)
  }

  if (!peasInfo) return <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Loading PEAS specifications...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Description */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>Course Outcome 1: Agent Formulation</h3>
        <p style={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>
          CO1 establishes the formal AI Agent Model. We define the School Bus Agent's environment, state space, transition rules,
          and performance evaluation. All variables use explicit Python typing hints, dataclasses, and complexity-efficient custom data structures.
        </p>
      </div>

      {/* PEAS Specifications Grid */}
      <div className="grid-cols-4">
        {Object.entries(peasInfo.peas).map(([category, items]) => (
          <div key={category} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {category}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(items).map(([name, description]) => (
                <div key={name} style={{ fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--foreground)', display: 'block', marginBottom: '2px' }}>{name}:</strong>
                  <span style={{ color: 'var(--muted)' }}>{description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Environment properties & Simulation */}
      <div className="grid-cols-2">
        {/* Environment Attributes */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '4px' }}>Environment Properties</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
              Taxonomy of the school bus routing environment.
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(peasInfo.environment).map(([property, value]) => (
              <div 
                key={property}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem' }}
              >
                <span style={{ fontWeight: 600, color: 'var(--muted)' }}>{property}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 550 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Simulator Console */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '4px' }}>State Transition Simulator</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                Run the agent transition model on a predefined path.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {playbackLogs.length > 0 && !simulating ? (
                <button className="btn btn-outline" onClick={resetSimulation}>
                  <RotateCcw size={16} />
                  Reset
                </button>
              ) : (
                <button 
                  className="btn btn-primary" 
                  onClick={startSimulation}
                  disabled={simulating}
                >
                  <Play size={16} />
                  {simulating ? 'Running...' : 'Run Simulation'}
                </button>
              )}
            </div>
          </div>

          {/* Trace Console */}
          <div className="trace-console" style={{ flex: 1, minHeight: '240px' }}>
            {playbackLogs.length > 0 ? (
              playbackLogs.map((entry, idx) => {
                let tagClass = "success"
                if (entry.step === "MOVE") tagClass = "success"
                else if (entry.step === "PICKUP") tagClass = "warning"
                else if (entry.step === "CONSTRAINT_VIOLATION") tagClass = "error"
                else if (entry.step === "DROP") tagClass = "accent"
                
                return (
                  <div key={idx} className={`trace-line ${tagClass}`}>
                    <span className="trace-tag">[{entry.step}]</span>
                    <span className="trace-msg">{entry.message}</span>
                  </div>
                )
              })
            ) : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.875rem' }}>
                Click 'Run Simulation' to execute the agent.
              </div>
            )}
          </div>

          {/* Final state box */}
          {finalState && (
            <div style={{ padding: '12px 16px', background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--success)' }}>
                <Activity size={16} />
                Final State Reached
              </span>
              <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
                Time: {finalState.time_elapsed} mins | Passengers: {finalState.passengers.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CO1AgentModel
