import React, { useState, useEffect, useRef } from 'react'
import { MapPin, Users, Navigation, CloudSun, Play, RotateCcw } from 'lucide-react'
import { playMove, playPickup, playSuccess } from '../utils/audio'

function DashboardOverview({ config, backendUrl }) {
  const [selectedNode, setSelectedNode] = useState(null)
  
  // Animation States
  const [isAnimating, setIsAnimating] = useState(false)
  const [busPos, setBusPos] = useState({ x: 100, y: 100 })
  const [activeRoute, setActiveRoute] = useState([])
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(0)
  const [boardingStudents, setBoardingStudents] = useState([])
  const [simulatedStudentsState, setSimulatedStudentsState] = useState(null)

  const animationRef = useRef(null)

  if (!config) return null

  const { graph, coordinates, students } = config

  // Initialize simulated student state to track boardings locally during animations
  if (!simulatedStudentsState) {
    const copy = {}
    Object.keys(students).forEach(k => {
      copy[k] = [...students[k]]
    })
    setSimulatedStudentsState(copy)
  }

  // Calculate total students count
  let totalStudents = 0
  Object.values(students).forEach(roster => {
    totalStudents += roster.length
  })
  const totalStops = Object.keys(coordinates).length - 1 // Exclude School

  // Define two tracks for the user to simulate:
  // Track 1 (Bus 1 Route): Stop_A -> Stop_B -> Stop_C -> School
  // Track 2 (Bus 2 Route): Stop_F -> Stop_H -> Stop_E -> School
  const tracks = {
    "Track 1 (Bus 1 - North Line)": ["Stop_A", "Stop_B", "Stop_C", "School"],
    "Track 2 (Bus 2 - South Line)": ["Stop_F", "Stop_H", "Stop_E", "School"]
  }

  const startTrackSimulation = (trackKey) => {
    if (isAnimating) return
    
    // Reset simulated students to configuration baseline
    const copy = {}
    Object.keys(students).forEach(k => {
      copy[k] = [...students[k]]
    })
    setSimulatedStudentsState(copy)
    setBoardingStudents([])
    
    const path = tracks[trackKey]
    setActiveRoute(path)
    setIsAnimating(true)
    setCurrentSegmentIdx(0)
    
    const startCoord = coordinates[path[0]]
    setBusPos({ x: startCoord[0], y: startCoord[1] })
    
    // Start segment interpolation
    animateSegment(path, 0, copy)
  }

  const animateSegment = (path, segmentIdx, currentStudents) => {
    if (segmentIdx >= path.length - 1) {
      // Arrived at School! Play success chime
      playSuccess()
      setIsAnimating(false)
      setActiveRoute([])
      return
    }

    const startNode = path[segmentIdx]
    const endNode = path[segmentIdx + 1]
    
    const [x1, y1] = coordinates[startNode]
    const [x2, y2] = coordinates[endNode]

    let frame = 0
    const totalFrames = 30 // 30 frames per segment (approx 1.5s at 50ms)
    
    // Play move start sound
    playMove()

    const interval = setInterval(() => {
      frame++
      const ratio = frame / totalFrames
      
      // Linear interpolation (lerp)
      const currentX = x1 + (x2 - x1) * ratio
      const currentY = y1 + (y2 - y1) * ratio
      
      setBusPos({ x: currentX, y: currentY })

      // Play subtle movement clicks
      if (frame % 8 === 0 && frame < totalFrames) {
        playMove()
      }

      if (frame >= totalFrames) {
        clearInterval(interval)
        // Arrived at next node!
        setCurrentSegmentIdx(segmentIdx + 1)
        
        if (endNode !== 'School') {
          // Play pickup chime
          playPickup()
          
          // Board students from the node
          const waiting = currentStudents[endNode] || []
          if (waiting.length > 0) {
            setBoardingStudents(prev => [...prev, ...waiting.map(s => s.name)])
            currentStudents[endNode] = [] // board all
            setSimulatedStudentsState({ ...currentStudents })
          }
          
          // Pause for passenger loading before moving to next segment
          setTimeout(() => {
            animateSegment(path, segmentIdx + 1, currentStudents)
          }, 1000)
        } else {
          // Go straight to arrival
          animateSegment(path, segmentIdx + 1, currentStudents)
        }
      }
    }, 45)

    animationRef.current = interval
  }

  useEffect(() => {
    return () => {
      if (animationRef.current) clearInterval(animationRef.current)
    }
  }, [])

  const resetSimulation = () => {
    if (animationRef.current) clearInterval(animationRef.current)
    setIsAnimating(false)
    setActiveRoute([])
    setBoardingStudents([])
    const copy = {}
    Object.keys(students).forEach(k => {
      copy[k] = [...students[k]]
    })
    setSimulatedStudentsState(copy)
    if (activeRoute.length > 0) {
      const startCoord = coordinates[activeRoute[0]]
      setBusPos({ x: startCoord[0], y: startCoord[1] })
    }
  }

  const activeStudentsList = simulatedStudentsState || students

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* KPI Stats Grid */}
      <div className="grid-cols-4">
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(79,70,229,0.08)', borderRadius: '12px' }}>
            <Users color="var(--primary)" size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 500 }}>Total Students</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)' }}>{totalStudents}</h3>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(6,182,212,0.08)', borderRadius: '12px' }}>
            <MapPin color="var(--accent)" size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 500 }}>Active Pickup Stops</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)' }}>{totalStops}</h3>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(5,150,105,0.08)', borderRadius: '12px' }}>
            <Navigation color="var(--success)" size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 500 }}>Available Buses</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)' }}>2 (Bus 1, Bus 2)</h3>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(217,119,6,0.08)', borderRadius: '12px' }}>
            <CloudSun color="var(--warning)" size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 500 }}>Global Traffic State</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)' }}>Dynamic / Stochastic</h3>
          </div>
        </div>
      </div>

      {/* Interactive Simulation Controls */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>Real-time Bus Track Simulator</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Test active paths to trigger Web Audio API synthesized sound effects and coordinate boardings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isAnimating ? (
            <button className="btn btn-outline" onClick={resetSimulation} style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
              <RotateCcw size={16} />
              Reset Simulation
            </button>
          ) : (
            Object.keys(tracks).map(trackKey => (
              <button 
                key={trackKey}
                className="btn btn-outline"
                onClick={() => startTrackSimulation(trackKey)}
                style={{ fontSize: '0.8rem', padding: '8px 12px' }}
              >
                <Play size={14} />
                {trackKey.split(' ')[1]} Run
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Grid: Map & Node Inspector */}
      <div className="grid-cols-3">
        {/* Interactive Graph Map */}
        <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '4px' }}>Road Network Topology</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
              Interactive road graph. Tap nodes to inspect rosters.
            </p>
          </div>
          
          <div style={{ height: '380px', position: 'relative' }}>
            <svg viewBox="50 50 500 400" className="network-map-svg">
              {/* Draw Edges */}
              {Object.entries(graph).map(([nodeName, neighbors]) => {
                const [x1, y1] = coordinates[nodeName]
                return Object.entries(neighbors).map(([neighborName, cost]) => {
                  const [x2, y2] = coordinates[neighborName]
                  if (nodeName >= neighborName) return null
                  
                  return (
                    <g key={`${nodeName}-${neighborName}`}>
                      <line 
                        x1={x1} 
                        y1={y1} 
                        x2={x2} 
                        y2={y2} 
                        className="map-edge"
                      />
                      <rect 
                        x={(x1 + x2) / 2 - 10} 
                        y={(y1 + y2) / 2 - 8} 
                        width="20" 
                        height="16" 
                        rx="4" 
                        fill="#ffffff" 
                        stroke="var(--border)"
                        strokeWidth="1"
                      />
                      <text 
                        x={(x1 + x2) / 2} 
                        y={(y1 + y2) / 2 + 4} 
                        fill="var(--accent)" 
                        fontSize="9px" 
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {cost}m
                      </text>
                    </g>
                  )
                })
              })}

              {/* Draw Nodes */}
              {Object.entries(coordinates).map(([nodeName, [x, y]]) => {
                const isSchool = nodeName === 'School'
                const isSelected = selectedNode === nodeName
                const studentCount = activeStudentsList[nodeName]?.length || 0
                
                return (
                  <g 
                    key={nodeName} 
                    transform={`translate(${x}, ${y})`} 
                    className="map-node"
                    onClick={() => setSelectedNode(nodeName)}
                  >
                    <circle 
                      r={isSchool ? 14 : 10} 
                      fill={isSchool ? 'var(--primary)' : isSelected ? 'var(--accent)' : '#e2e8f0'}
                      stroke={isSelected ? 'var(--primary)' : 'rgba(15,23,42,0.15)'}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                    {studentCount > 0 && !isSchool && (
                      <circle 
                        cx="8" 
                        cy="-8" 
                        r="6" 
                        fill="var(--warning)"
                      />
                    )}
                    {studentCount > 0 && !isSchool && (
                      <text 
                        x="8" 
                        y="-5" 
                        fill="#fff" 
                        fontSize="8px" 
                        fontWeight="800" 
                        textAnchor="middle"
                      >
                        {studentCount}
                      </text>
                    )}
                    <text 
                      y={isSchool ? 26 : 22} 
                      fill={isSelected ? 'var(--primary)' : '#475569'} 
                      fontSize="10px" 
                      fontWeight="700" 
                      textAnchor="middle"
                    >
                      {nodeName.replace('Stop_', 'Stop ')}
                    </text>
                  </g>
                )
              })}

              {/* Draw Animated Bus Icon */}
              {isAnimating && (
                <g transform={`translate(${busPos.x - 12}, ${busPos.y - 10})`}>
                  {/* Bus Body */}
                  <rect 
                    width="24" 
                    height="15" 
                    rx="3" 
                    fill="#fbbf24" 
                    stroke="#1e293b" 
                    strokeWidth="1.5" 
                  />
                  {/* Windows */}
                  <rect x="3" y="3" width="5" height="4" fill="#60a5fa" rx="1" />
                  <rect x="10" y="3" width="5" height="4" fill="#60a5fa" rx="1" />
                  <rect x="17" y="3" width="4" height="4" fill="#60a5fa" rx="1" />
                  {/* Wheels */}
                  <circle cx="6" cy="15" r="3" fill="#1e293b" />
                  <circle cx="18" cy="15" r="3" fill="#1e293b" />
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Node Details & Boarding Panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '4px' }}>Live Dashboard</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
              Rosters and real-time boarding tracker.
            </p>
          </div>

          {/* Boarded Roster if Animating */}
          {isAnimating && (
            <div style={{ padding: '12px', background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.12)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--primary)', display: 'block' }}>
                On Board Passengers ({boardingStudents.length})
              </strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                {boardingStudents.length > 0 ? (
                  boardingStudents.map((s, idx) => (
                    <span key={idx} style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px' }}>
                      {s}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>Empty (Bus is empty)</span>
                )}
              </div>
            </div>
          )}

          {selectedNode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>
                  {selectedNode.replace('_', ' ')}
                </span>
                <span style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.03)', padding: '4px 8px', borderRadius: '4px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  Coords: {coordinates[selectedNode].join(', ')}
                </span>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>
                  Students at stop ({activeStudentsList[selectedNode]?.length || 0})
                </h4>
                {activeStudentsList[selectedNode] && activeStudentsList[selectedNode].length > 0 ? (
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeStudentsList[selectedNode].map((s, idx) => (
                      <li 
                        key={idx} 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem' }}
                      >
                        <span style={{ fontWeight: 500 }}>{s.name}</span>
                        {s.wheelchair && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            Wheelchair
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    No students currently waiting here.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.875rem', fontStyle: 'italic', textAlign: 'center', padding: '40px 20px' }}>
              Select a node on the network map to view its details.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardOverview
