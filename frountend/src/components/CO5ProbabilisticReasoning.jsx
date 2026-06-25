import React, { useState } from 'react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { TrendingUp, BarChart2, ShieldAlert } from 'lucide-react'

function CO5ProbabilisticReasoning({ config, backendUrl }) {
  // Bayes net state
  const [weather, setWeather] = useState('Rainy')
  const [accident, setAccident] = useState('True')
  const [bayesResult, setBayesResult] = useState(null)
  const [queryingBayes, setQueryingBayes] = useState(false)

  // HMM state
  const [obsSeq, setObsSeq] = useState('Fast,Moderate,Crawling')
  const [hmmResult, setHmmResult] = useState(null)
  const [runningHmm, setRunningHmm] = useState(false)

  const queryBayesNet = () => {
    setQueryingBayes(true)
    const evidence = { Weather: weather }
    if (accident !== 'Unknown') {
      evidence.Accident = accident === 'True'
    }

    const eliminate = ["RoadWork", "TrafficCongestion"]
    if (accident === 'Unknown') {
      eliminate.push("Accident")
    }

    fetch(`${backendUrl}/api/co5/probabilistic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evidence: evidence,
        query_var: "BusDelay",
        eliminate_vars: eliminate
      })
    })
      .then(res => res.json())
      .then(data => {
        setBayesResult(data)
        setQueryingBayes(false)
      })
      .catch(err => {
        console.error("Bayes net query failed:", err)
        setQueryingBayes(false)
      })
  }

  const runHmmFilter = () => {
    setRunningHmm(true)
    const observations = obsSeq.split(',').map(o => o.trim())
    
    fetch(`${backendUrl}/api/co5/hmm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observations: observations })
    })
      .then(res => res.json())
      .then(data => {
        setHmmResult(data)
        setRunningHmm(false)
      })
      .catch(err => {
        console.error("HMM filter failed:", err)
        setRunningHmm(false)
      })
  }

  // Format HMM data for area chart
  const getHmmChartData = () => {
    if (!hmmResult) return []
    const observations = obsSeq.split(',').map(o => o.trim())
    return hmmResult.beliefs.map((b, idx) => ({
      name: `Step ${idx} (${observations[idx]})`,
      Clear: parseFloat((b.Clear * 100).toFixed(1)),
      Slow: parseFloat((b.Slow * 100).toFixed(1)),
      Congested: parseFloat((b.Congested * 100).toFixed(1))
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Bayes Net Panel */}
      <div className="grid-cols-3">
        {/* Bayes Net Input Controls */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Bayesian Net Traffic Predictor</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Set observed evidence to query the probability of a High Bus Delay.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Weather Condition</label>
              <select className="select-input" value={weather} onChange={e => setWeather(e.target.value)}>
                <option value="Sunny">Sunny</option>
                <option value="Rainy">Rainy</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Accident Status</label>
              <select className="select-input" value={accident} onChange={e => setAccident(e.target.value)}>
                <option value="True">Accident Reported</option>
                <option value="False">No Accident</option>
                <option value="Unknown">Unknown (Marginalize)</option>
              </select>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={queryBayesNet} 
              disabled={queryingBayes}
              style={{ marginTop: '8px' }}
            >
              <TrendingUp size={16} />
              {queryingBayes ? 'Running Inference...' : 'Run Variable Elimination'}
            </button>
          </div>
        </div>

        {/* Bayes Net Results */}
        <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Inference Results</h3>
          {bayesResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Variable elimination results */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>
                  Exact Posterior Distribution: P(BusDelay | Evidence)
                </h4>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {bayesResult.variable_elimination.map((item, idx) => (
                    <div 
                      key={idx}
                      style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}
                    >
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                        Delay = {item.value ? 'HIGH' : 'LOW'}
                      </span>
                      <strong style={{ fontSize: '1.5rem', color: item.value ? 'var(--primary)' : 'var(--accent)' }}>
                        {(item.probability * 100).toFixed(1)}%
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approximate Likelihood Weighting Estimate */}
              <div style={{ padding: '12px 16px', background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.12)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                <span style={{ color: '#cbd5e1' }}>
                  Approximate Sampling (Likelihood Weighting, N=2000):
                </span>
                <strong style={{ color: 'var(--accent)' }}>
                  {(bayesResult.likelihood_weighting_estimate * 100).toFixed(1)}%
                </strong>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center' }}>
              Click 'Run Variable Elimination' to view inference.
            </div>
          )}
        </div>
      </div>

      {/* HMM Panel */}
      <div className="grid-cols-3">
        {/* HMM Controls */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Hidden Markov Model Tracker</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Filters noisy GPS velocity observations to track the true hidden traffic state of a road segment.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Observations Sequence</label>
              <select className="select-input" value={obsSeq} onChange={e => setObsSeq(e.target.value)}>
                <option value="Fast,Moderate,Crawling">Fast → Moderate → Crawling (Decelerating)</option>
                <option value="Crawling,Crawling,Moderate">Crawling → Crawling → Moderate (Recovering)</option>
                <option value="Fast,Fast,Fast">Fast → Fast → Fast (Clear Highway)</option>
              </select>
            </div>

            <button 
              className="btn btn-accent" 
              onClick={runHmmFilter} 
              disabled={runningHmm}
              style={{ marginTop: '8px' }}
            >
              <BarChart2 size={16} />
              {runningHmm ? 'Filtering HMM...' : 'Filter HMM Sequence'}
            </button>
          </div>
        </div>

        {/* HMM belief history chart */}
        <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '16px', height: '320px' }}>
          <h3 style={{ fontSize: '1.1rem' }}>HMM Congestion Belief Tracking</h3>
          
          {hmmResult ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <div style={{ flex: 1, minHeight: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getHmmChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="var(--muted)" fontSize={10} />
                    <YAxis stroke="var(--muted)" fontSize={10} unit="%" />
                    <Tooltip contentStyle={{ background: '#0d1423', borderColor: 'var(--border)' }} />
                    <Legend />
                    <Area type="monotone" dataKey="Clear" stackId="1" stroke="var(--success)" fill="var(--success-glow)" />
                    <Area type="monotone" dataKey="Slow" stackId="1" stroke="var(--warning)" fill="var(--warning-glow)" />
                    <Area type="monotone" dataKey="Congested" stackId="1" stroke="var(--error)" fill="var(--error-glow)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Expected Utility Decision */}
              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#fff' }}>Expected Utility Routing:</strong>
                  <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>
                    Safe Highway: {hmmResult.expected_utility_decision["Route 1 Safe Expected Utility"].toFixed(1)} EU vs Shortcut: {hmmResult.expected_utility_decision["Route 2 Shortcut Expected Utility"].toFixed(1)} EU
                  </span>
                </div>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                  Choice: {hmmResult.expected_utility_decision["Optimal Decision"].split(' ')[0]}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center' }}>
              Click 'Filter HMM Sequence' to trace beliefs.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CO5ProbabilisticReasoning
