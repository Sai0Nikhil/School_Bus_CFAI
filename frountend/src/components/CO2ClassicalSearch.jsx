import React, { useState, useEffect, useRef } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'
import { Search, Play, RotateCcw, Award, MapPin } from 'lucide-react'
import { playMove, playPickup, playSuccess } from '../utils/audio'

function CO2ClassicalSearch({ config, backendUrl }) {
  const [startNode, setStartNode] = useState('Stop_B')
  const [goalNode, setGoalNode] = useState('School')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  
  // Step tracer state
  const [traceAlg, setTraceAlg] = useState('A*')
  const [traceStep, setTraceStep] = useState(0)

  // Map Animation State
  const [selectedAlgForAnim, setSelectedAlgForAnim] = useState('A*')
  const [isAnimating, setIsAnimating] = useState(false)
  const [busPos, setBusPos] = useState({ x: 250, y: 100 })
  const [activePath, setActivePath] = useState([])
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(0)

  const animationRef = useRef(null)

  if (!config) return null

  const { graph, coordinates } = config
  const nodes = Object.keys(coordinates)

  const triggerSearch = () => {
    setSearching(true)
    // Clear any active animations
    if (animationRef.current) clearInterval(animationRef.current)
    setIsAnimating(false)
    setActivePath([])
    
    fetch(`${backendUrl}/api/co2/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: startNode, goal: goalNode })
    })
      .then(res => res.json())
      .then(data => {
        setSearchResults(data)
        setTraceStep(0)
        setSearching(false)
        playSuccess()
        
        // Auto-initialize bus position to start node
        const startCoord = coordinates[startNode]
        setBusPos({ x: startCoord[0], y: startCoord[1] })
      })
      .catch(err => {
        console.error("Search failed:", err)
        setSearching(false)
      })
  }

  const handleStepChange = (newStep) => {
    setTraceStep(newStep)
    playMove()
  }

  const startRouteAnimation = () => {
    if (isAnimating || !searchResults) return
    const path = searchResults[selectedAlgForAnim]?.path || []
    if (path.length === 0) return

    setIsAnimating(true)
    setCurrentSegmentIdx(0)
    setActivePath(path)
    
    const startCoord = coordinates[path[0]]
    setBusPos({ x: startCoord[0], y: startCoord[1] })

    animateSegment(path, 0)
  }

  const animateSegment = (path, segmentIdx) => {
    if (segmentIdx >= path.length - 1) {
      playSuccess()
      setIsAnimating(false)
      setActivePath([])
      return
    }

    const startNodeName = path[segmentIdx]
    const endNodeName = path[segmentIdx + 1]
    
    const [x1, y1] = coordinates[startNodeName]
    const [x2, y2] = coordinates[endNodeName]

    let frame = 0
    const totalFrames = 30 // 30 frames per edge (~1.5s)
    
    playMove()

    const interval = setInterval(() => {
      frame++
      const ratio = frame / totalFrames
      
      const currentX = x1 + (x2 - x1) * ratio
      const currentY = y1 + (y2 - y1) * ratio
      
      setBusPos({ x: currentX, y: currentY })

      if (frame % 8 === 0 && frame < totalFrames) {
        playMove()
      }

      if (frame >= totalFrames) {
        clearInterval(interval)
        setCurrentSegmentIdx(segmentIdx + 1)
        
        if (endNodeName !== 'School') {
          playPickup() // Play pickup chime at intermediate stop
          setTimeout(() => {
            animateSegment(path, segmentIdx + 1)
          }, 800)
        } else {
          animateSegment(path, segmentIdx + 1)
        }
      }
    }, 45)

    animationRef.current = interval
  }

  const resetAnimation = () => {
    if (animationRef.current) clearInterval(animationRef.current)
    setIsAnimating(false)
    setActivePath([])
    const startCoord = coordinates[startNode]
    setBusPos({ x: startCoord[0], y: startCoord[1] })
  }

  useEffect(() => {
    // Sync bus starting position when start node selector changes
    const startCoord = coordinates[startNode]
    setBusPos({ x: startCoord[0], y: startCoord[1] })
    resetAnimation()
    
    return () => {
      if (animationRef.current) clearInterval(animationRef.current)
    }
  }, [startNode])

  const getChartData = () => {
    if (!searchResults) return []
    const algs = ["BFS", "DFS", "UCS", "A*", "Greedy", "IDA*"]
    return algs.map(alg => {
      const data = searchResults[alg]
      return {
        name: alg,
        expansions: data?.expansions || 0,
        runtime_ms: parseFloat(data?.runtime_ms?.toFixed(4)) || 0,
        peak_memory_kb: parseFloat(data?.peak_memory_kb?.toFixed(4)) || 0
      }
    })
  }

  const activeTrace = searchResults ? searchResults[traceAlg]?.trace : null
  const currentTraceNode = activeTrace && activeTrace[traceStep]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Search Input Controls */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Start Location</label>
            <select 
              className="select-input" 
              value={startNode} 
              onChange={e => setStartNode(e.target.value)}
            >
              {nodes.filter(n => n !== 'School').map(node => (
                <option key={node} value={node}>{node.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Goal Destination</label>
            <select 
              className="select-input" 
              value={goalNode} 
              onChange={e => setGoalNode(e.target.value)}
              disabled
            >
              <option value="School">School</option>
            </select>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={triggerSearch} 
          disabled={searching}
          style={{ height: '42px', marginTop: '16px' }}
        >
          <Search size={18} />
          {searching ? 'Searching...' : 'Search Paths'}
        </button>
      </div>

      {searchResults && (
        <>
          {/* Row 2: Map & Performance Table */}
          <div className="grid-cols-3">
            {/* SVG Visualizer Map */}
            <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>Path Visualizer Map</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    Select an algorithm to animate the calculated route.
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select 
                    className="select-input" 
                    value={selectedAlgForAnim}
                    onChange={e => { setSelectedAlgForAnim(e.target.value); resetAnimation(); }}
                    style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                    disabled={isAnimating}
                  >
                    {["BFS", "DFS", "UCS", "A*", "Greedy", "IDA*"].map(alg => (
                      <option key={alg} value={alg}>{alg} Path</option>
                    ))}
                  </select>
                  
                  {isAnimating ? (
                    <button className="btn btn-outline" onClick={resetAnimation} style={{ borderColor: 'var(--error)', color: 'var(--error)', padding: '6px 12px', fontSize: '0.85rem' }}>
                      <RotateCcw size={14} />
                      Stop
                    </button>
                  ) : (
                    <button 
                      className="btn btn-primary" 
                      onClick={startRouteAnimation}
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      <Play size={14} />
                      Animate Bus
                    </button>
                  )}
                </div>
              </div>

              {/* SVG Network Map */}
              <div style={{ height: '360px', position: 'relative' }}>
                <svg viewBox="50 50 500 400" className="network-map-svg">
                  {/* Draw Edges */}
                  {Object.entries(graph).map(([nodeName, neighbors]) => {
                    const [x1, y1] = coordinates[nodeName]
                    return Object.entries(neighbors).map(([neighborName, cost]) => {
                      const [x2, y2] = coordinates[neighborName]
                      if (nodeName >= neighborName) return null
                      
                      // Highlight the edge if it is part of the active path animation
                      const isActiveEdge = activePath.length > 0 && (
                        (activePath.indexOf(nodeName) !== -1 && activePath.indexOf(neighborName) !== -1 && 
                         Math.abs(activePath.indexOf(nodeName) - activePath.indexOf(neighborName)) === 1)
                      )

                      return (
                        <g key={`${nodeName}-${neighborName}`}>
                          <line 
                            x1={x1} 
                            y1={y1} 
                            x2={x2} 
                            y2={y2} 
                            className={`map-edge ${isActiveEdge ? 'active' : ''}`}
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
                            fill={isActiveEdge ? 'var(--accent)' : 'var(--muted)'} 
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
                    const isStart = nodeName === startNode
                    const isPartofPath = searchResults[selectedAlgForAnim]?.path?.includes(nodeName)
                    
                    return (
                      <g 
                        key={nodeName} 
                        transform={`translate(${x}, ${y})`} 
                        className="map-node"
                      >
                        <circle 
                          r={isSchool ? 14 : 10} 
                          fill={isSchool ? 'var(--primary)' : isStart ? 'var(--warning)' : isPartofPath ? 'rgba(79,70,229,0.15)' : '#e2e8f0'}
                          stroke={isStart ? 'var(--warning)' : isPartofPath ? 'var(--primary)' : 'rgba(15,23,42,0.15)'}
                          strokeWidth={isStart || isPartofPath ? 2 : 1}
                        />
                        <text 
                          y={isSchool ? 26 : 22} 
                          fill={isStart ? 'var(--warning)' : isPartofPath ? 'var(--primary)' : '#475569'} 
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
                  {(isAnimating || searchResults) && (
                    <g transform={`translate(${busPos.x - 12}, ${busPos.y - 10})`}>
                      <rect 
                        width="24" 
                        height="15" 
                        rx="3" 
                        fill="#fbbf24" 
                        stroke="#1e293b" 
                        strokeWidth="1.5" 
                      />
                      <rect x="3" y="3" width="5" height="4" fill="#60a5fa" rx="1" />
                      <rect x="10" y="3" width="5" height="4" fill="#60a5fa" rx="1" />
                      <rect x="17" y="3" width="4" height="4" fill="#60a5fa" rx="1" />
                      <circle cx="6" cy="15" r="3" fill="#1e293b" />
                      <circle cx="18" cy="15" r="3" fill="#1e293b" />
                    </g>
                  )}
                </svg>
              </div>
            </div>

            {/* Performance Matrix */}
            <div className="glass-card" style={{ overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Metrics Matrix</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <th style={{ padding: '8px' }}>Alg</th>
                    <th style={{ padding: '8px' }}>Cost</th>
                    <th style={{ padding: '8px' }}>Exp</th>
                  </tr>
                </thead>
                <tbody>
                  {["BFS", "DFS", "UCS", "A*", "Greedy", "IDA*"].map(alg => {
                    const data = searchResults[alg]
                    if (!data) return null
                    const isActive = selectedAlgForAnim === alg
                    return (
                      <tr 
                        key={alg} 
                        onClick={() => setSelectedAlgForAnim(alg)}
                        style={{ 
                          borderBottom: '1px solid var(--border)', 
                          cursor: 'pointer',
                          background: isActive ? 'rgba(79,70,229,0.06)' : 'transparent',
                          fontWeight: isActive ? 600 : 400
                        }}
                      >
                        <td style={{ padding: '10px 8px', color: isActive ? 'var(--primary)' : 'var(--foreground)' }}>
                          {alg}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--accent)' }}>
                          {data.cost?.toFixed(1)}m
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--warning)' }}>
                          {data.expansions}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 'auto', padding: '10px', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--muted)' }}>
                <strong>Click rows</strong> in the matrix to select that algorithm's path for visual animation on the map!
              </div>
            </div>
          </div>

          {/* Profiling Charts Grid */}
          <div className="grid-cols-3">
            {/* Chart 1: Expanded Nodes */}
            <div className="glass-card" style={{ height: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>Node Expansions (Less is better)</h4>
              <div style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" stroke="var(--muted)" fontSize={10} />
                    <YAxis stroke="var(--muted)" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#ffffff', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                    <Bar dataKey="expansions" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Runtime */}
            <div className="glass-card" style={{ height: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>Runtime (Milliseconds)</h4>
              <div style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" stroke="var(--muted)" fontSize={10} />
                    <YAxis stroke="var(--muted)" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#ffffff', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                    <Bar dataKey="runtime_ms" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Memory */}
            <div className="glass-card" style={{ height: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>Memory Usage (Peak KB)</h4>
              <div style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" stroke="var(--muted)" fontSize={10} />
                    <YAxis stroke="var(--muted)" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#ffffff', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                    <Bar dataKey="peak_memory_kb" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Interactive Step-by-Step Tracer */}
          {activeTrace && (
            <div className="grid-cols-3">
              {/* Trace Control Console */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Search Frontier Step Tracer</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    Inspect Closed and Open (Frontier) Sets as search proceeds.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Algorithm to trace:</label>
                    <select 
                      className="select-input" 
                      value={traceAlg}
                      onChange={e => { setTraceAlg(e.target.value); handleStepChange(0); }}
                      style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                    >
                      {["BFS", "DFS", "UCS", "A*", "Greedy"].map(alg => (
                        <option key={alg} value={alg}>{alg}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                      Step: {traceStep + 1} / {activeTrace.length}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        className="btn btn-outline" 
                        disabled={traceStep === 0}
                        onClick={() => handleStepChange(traceStep - 1)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        Prev
                      </button>
                      <button 
                        className="btn btn-primary" 
                        disabled={traceStep === activeTrace.length - 1}
                        onClick={() => handleStepChange(traceStep + 1)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>

                {currentTraceNode && (
                  <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <strong style={{ color: 'var(--foreground)', display: 'block', marginBottom: '6px' }}>
                      Expanding: {currentTraceNode.expanding.replace('Stop_', 'Stop ')}
                    </strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--muted)' }}>
                        Path So Far: {currentTraceNode.current_path.join(' → ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Closed Set & Open Set Lists */}
              <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Frontier States Visualized</h4>
                {currentTraceNode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Open Set / Frontier */}
                    <div>
                      <h5 style={{ fontSize: '0.85rem', color: 'var(--warning)', marginBottom: '8px', fontWeight: 600 }}>
                        Open Set (Frontier Queue)
                      </h5>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {currentTraceNode.open_set.length > 0 ? (
                          currentTraceNode.open_set.map((item, idx) => (
                            <span 
                              key={idx}
                              style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.15)', color: 'var(--warning)', borderRadius: '4px' }}
                            >
                              {item.replace('Stop_', 'Stop ')}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>Empty</span>
                        )}
                      </div>
                    </div>

                    {/* Closed Set */}
                    <div>
                      <h5 style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>
                        Closed Set (Explored)
                      </h5>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {currentTraceNode.closed_set.length > 0 ? (
                          currentTraceNode.closed_set.map((item, idx) => (
                            <span 
                              key={idx}
                              style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)', color: '#475569', borderRadius: '4px' }}
                            >
                              {item.replace('Stop_', 'Stop ')}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>Empty</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Heuristics Table */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Heuristic Design Analysis (Scaled Euclidean Distance to School)</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '16px' }}>
              For A* search to be optimal on graphs, the heuristic $h(n)$ must be <strong>admissible</strong> (never overestimates the remaining time) and <strong>consistent</strong> (triangle inequality: $h(A) \le c(A, B) + h(B)$). Below are the pre-calculated heuristic values to the School:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {searchResults.heuristics && Object.entries(searchResults.heuristics).map(([nodeName, hVal]) => (
                <div 
                  key={nodeName}
                  style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 12px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}
                >
                  <span style={{ color: 'var(--muted)', fontWeight: 550 }}>{nodeName.replace('Stop_', 'Stop ')}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>h(n): {hVal.toFixed(2)} mins</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CO2ClassicalSearch
