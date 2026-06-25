import React, { useState } from 'react'
import { Compass, ShieldCheck, HelpCircle, ChevronRight } from 'lucide-react'

function CO4AdversarialStochastic({ config, backendUrl }) {
  const [startNode, setStartNode] = useState('Stop_A')
  const [depth, setDepth] = useState(4)
  const [gameResults, setGameResults] = useState(null)
  const [running, setRunning] = useState(false)

  if (!config) return null

  const nodes = Object.keys(config.coordinates)

  const triggerSearch = () => {
    setRunning(true)
    fetch(`${backendUrl}/api/co4/adversarial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: startNode, goal: 'School', depth: parseInt(depth) })
    })
      .then(res => res.json())
      .then(data => {
        setGameResults(data)
        setRunning(false)
      })
      .catch(err => {
        console.error("Adversarial search failed:", err)
        setRunning(false)
      })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Description */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>Course Outcome 4: Adversarial & Stochastic Decision Trees</h3>
        <p style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
          CO4 explores decision-making under adversity and probability. We model the school bus routing as a tree game:
          <strong>(1) Minimax with Alpha-Beta Pruning</strong> plans routes to minimize travel time against an active "Traffic Congestion" adversary (worst-case scenario),
          and <strong>(2) Expectimax</strong> plans routes to optimize expected values under natural stochastic delay probabilities.
        </p>
      </div>

      {/* Control Panel */}
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
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Search Depth Limit (Bounded Rationality)</label>
            <select 
              className="select-input" 
              value={depth} 
              onChange={e => setDepth(e.target.value)}
            >
              {[1, 2, 3, 4, 5].map(d => (
                <option key={d} value={d}>Depth {d} (Horizon limit)</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={triggerSearch} 
          disabled={running}
          style={{ height: '42px', marginTop: '16px' }}
        >
          <Compass size={18} />
          {running ? 'Evaluating Game Tree...' : 'Evaluate Decision Policies'}
        </button>
      </div>

      {gameResults && (
        <>
          {/* Main Side-by-Side Comparison */}
          <div className="grid-cols-2">
            {/* Minimax Card */}
            <div className="glass-card primary-glow" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck color="var(--primary)" size={20} />
                  Minimax (Worst-Case Adversary)
                </h3>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                Optimizes travel choices assuming the environment is actively trying to delay the bus (e.g. preparing for worst-case lane blockages).
              </p>

              <div style={{ padding: '16px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
                <div>
                  <strong style={{ color: 'var(--muted)' }}>Robust Routing Path:</strong>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#fff', marginTop: '4px' }}>
                    {gameResults.minimax.path.join(' → ')}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Guaranteed Worst-Case Utility:</span>
                  <strong style={{ color: 'var(--primary)' }}>{gameResults.minimax.utility.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Alpha-Beta Node Expansions:</span>
                  <span>{gameResults.minimax.expansions}</span>
                </div>
              </div>
            </div>

            {/* Expectimax Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle color="var(--accent)" size={20} />
                  Expectimax (Stochastic Environment)
                </h3>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                Optimizes travel choices by averaging travel times across weather and traffic probability distributions.
              </p>

              <div style={{ padding: '16px', background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.12)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
                <div>
                  <strong style={{ color: 'var(--muted)' }}>Expected Optimal Path:</strong>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#fff', marginTop: '4px' }}>
                    {gameResults.expectimax.path.join(' → ')}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Average Expected Utility:</span>
                  <strong style={{ color: 'var(--accent)' }}>{gameResults.expectimax.utility.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Stochastic Node Expansions:</span>
                  <span>{gameResults.expectimax.expansions}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Iterative Deepening & Bounded Rationality Panel */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Bounded Rationality & Iterative Deepening</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '16px' }}>
              Real-world school bus routing agents possess <strong>bounded rationality</strong>: they cannot compute the infinite game tree to the end of time. 
              Instead, search is cut off at a <strong>depth limit</strong>, and leaf nodes are valued using an <strong>evaluation function</strong>: 
              $Utility = 120 - (TimeSpent + h(n))$. To ensure a route selection is always ready within a time budget, we wrap the search in 
              <strong>Iterative Deepening</strong>, checking depth 1, then depth 2, and so on.
            </p>
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <strong>Iterative Deepening Result (Max Depth: {gameResults.iterative_deepening.depth_reached})</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
                <div>Path Chosen: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{gameResults.iterative_deepening.path.join(' → ')}</span></div>
                <div>Utility Score: <strong style={{ color: '#fff' }}>{gameResults.iterative_deepening.utility.toFixed(2)}</strong></div>
                <div>Expansions in final step: <span style={{ color: 'var(--muted)' }}>{gameResults.iterative_deepening.expansions}</span></div>
              </div>
            </div>
          </div>

          {/* Policy Selection Analysis */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Policy Selection Analysis</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem', color: 'var(--muted)' }}>
              <p>
                • <strong>Minimax policy</strong> is highly risk-averse. It chooses the path `Stop_A → Stop_D → Stop_E` because it assumes the traffic adversary will maximize delay on other edges. It selects routes that guarantee a minimum utility boundary.
              </p>
              <p>
                • <strong>Expectimax policy</strong> assumes the environment is neutral rather than adversarial. By weighting outcomes (70% light traffic, 30% heavy traffic), it produces a higher expected utility score. However, it is vulnerable if extreme traffic events occur.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CO4AdversarialStochastic
