import React, { useState } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'
import { Search, ChevronRight, Play, Award } from 'lucide-react'
import { playMove, playSuccess } from '../utils/audio'

function CO2ClassicalSearch({ config, backendUrl }) {
  const [startNode, setStartNode] = useState('Stop_A')
  const [goalNode, setGoalNode] = useState('School')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  
  // Step tracer state
  const [traceAlg, setTraceAlg] = useState('A*')
  const [traceStep, setTraceStep] = useState(0)

  if (!config) return null

  const nodes = Object.keys(config.coordinates)

  const triggerSearch = () => {
    setSearching(true)
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
        playSuccess() // Play positive chime when results arrive
      })
      .catch(err => {
        console.error("Search failed:", err)
        setSearching(false)
      })
  }

  const handleStepChange = (newStep) => {
    setTraceStep(newStep)
    playMove() // Play movement sweep sound when stepping through frontier
  }

  // Prep data for charts
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
          {/* Main Results Table */}
          <div className="glass-card" style={{ overflowX: 'auto' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Search Performance Matrix</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                  <th style={{ padding: '12px' }}>Algorithm</th>
                  <th style={{ padding: '12px' }}>Path Found</th>
                  <th style={{ padding: '12px' }}>Cost (Minutes)</th>
                  <th style={{ padding: '12px' }}>Expansions</th>
                  <th style={{ padding: '12px' }}>Runtime</th>
                  <th style={{ padding: '12px' }}>Peak Memory</th>
                </tr>
              </thead>
              <tbody>
                {["BFS", "DFS", "UCS", "A*", "Greedy", "IDA*"].map(alg => {
                  const data = searchResults[alg]
                  if (!data) return null
                  const isOptimal = ["UCS", "A*", "IDA*"].includes(alg)
                  return (
                    <tr key={alg} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {alg}
                        {isOptimal && <Award size={14} color="var(--success)" title="Guarantees Optimal Path" />}
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#334155' }}>
                        {data.path?.length > 0 ? data.path.join(' → ') : 'No Path'}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                        {data.cost?.toFixed(1)}m
                      </td>
                      <td style={{ padding: '12px', color: 'var(--warning)' }}>
                        {data.expansions} nodes
                      </td>
                      <td style={{ padding: '12px', color: 'var(--muted)' }}>
                        {data.runtime_ms?.toFixed(3)} ms
                      </td>
                      <td style={{ padding: '12px', color: 'var(--muted)' }}>
                        {data.peak_memory_kb?.toFixed(3)} KB
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
