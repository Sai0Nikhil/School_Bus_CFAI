import { useState, useEffect } from 'react'
import { 
  Bus, 
  Map, 
  Search, 
  Layers, 
  ShieldAlert, 
  TrendingUp, 
  Compass, 
  AlertTriangle 
} from 'lucide-react'

// Import subcomponents
import DashboardOverview from './components/DashboardOverview'
import CO1AgentModel from './components/CO1AgentModel'
import CO2ClassicalSearch from './components/CO2ClassicalSearch'
import CO3CSPScheduling from './components/CO3CSPScheduling'
import CO4AdversarialStochastic from './components/CO4AdversarialStochastic'
import CO5ProbabilisticReasoning from './components/CO5ProbabilisticReasoning'
import CO6HybridSystem from './components/CO6HybridSystem'

const BACKEND_URL = "http://127.0.0.1:8081"

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch system configuration from FastAPI backend
    fetch(`${BACKEND_URL}/api/config`)
      .then(res => {
        if (!res.ok) throw new Error("Could not contact the Python backend. Make sure uvicorn is running on port 8000.")
        return res.json()
      })
      .then(data => {
        setConfig(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Map },
    { id: 'co1', label: 'CO1: Agent Model', icon: Bus },
    { id: 'co2', label: 'CO2: Classical Search', icon: Search },
    { id: 'co3', label: 'CO3: CSP Scheduling', icon: Layers },
    { id: 'co4', label: 'CO4: Game Routing', icon: Compass },
    { id: 'co5', label: 'CO5: Probability & HMM', icon: TrendingUp },
    { id: 'co6', label: 'CO6: Hybrid & Ethics', icon: ShieldAlert }
  ]

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ color: 'var(--muted)', fontWeight: 500 }}>Connecting to AI Backend...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )
    }

    if (error) {
      return (
        <div className="glass-card" style={{ borderColor: 'var(--error)', marginTop: '40px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <AlertTriangle color="var(--error)" size={32} />
          <div>
            <h3 style={{ color: 'var(--error)', marginBottom: '8px', fontSize: '1.25rem' }}>Backend Connection Error</h3>
            <p style={{ color: '#cbd5e1', marginBottom: '16px' }}>
              We could not connect to the Python backend API. Please ensure that the FastAPI uvicorn server is running on <strong>http://127.0.0.1:8000</strong>.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
              Error trace: {error}
            </p>
            <div style={{ marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry Connection</button>
            </div>
          </div>
        </div>
      )
    }

    switch(activeTab) {
      case 'overview':
        return <DashboardOverview config={config} backendUrl={BACKEND_URL} />
      case 'co1':
        return <CO1AgentModel config={config} backendUrl={BACKEND_URL} />
      case 'co2':
        return <CO2ClassicalSearch config={config} backendUrl={BACKEND_URL} />
      case 'co3':
        return <CO3CSPScheduling config={config} backendUrl={BACKEND_URL} />
      case 'co4':
        return <CO4AdversarialStochastic config={config} backendUrl={BACKEND_URL} />
      case 'co5':
        return <CO5ProbabilisticReasoning config={config} backendUrl={BACKEND_URL} />
      case 'co6':
        return <CO6HybridSystem config={config} backendUrl={BACKEND_URL} />
      default:
        return <DashboardOverview config={config} backendUrl={BACKEND_URL} />
    }
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Bus color="#8b5cf6" size={28} />
          <h2>SmartBus AI</h2>
        </div>
        <ul className="sidebar-menu">
          {menuItems.map(item => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <a 
                  className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </a>
              </li>
            )
          })}
        </ul>
        <div style={{ padding: '20px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p>Computational Foundations For AI</p>
          <p>Capstone Project Report</p>
        </div>
      </aside>

      {/* Main Dashboard Screen */}
      <main className="main-content">
        <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              School Bus Route Optimization
            </span>
            <h1 style={{ fontSize: '1.75rem', marginTop: '2px' }}>
              {menuItems.find(m => m.id === activeTab)?.label} Dashboard
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: error ? 'var(--error)' : 'var(--success)' }}></span>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 500 }}>
              {error ? 'API Offline' : 'API Online (Port 8081)'}
            </span>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  )
}

export default App
