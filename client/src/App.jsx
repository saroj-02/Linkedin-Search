import { useState, useEffect, useCallback } from 'react'
import './index.css'

function App() {
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [targetYear, setTargetYear] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [message, setMessage] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [history, setHistory] = useState([])
  const [settings, setSettings] = useState(null)

  const checkServer = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/health`)
      if (response.ok) setServerStatus('online')
      else setServerStatus('offline')
    } catch {
      setServerStatus('offline')
    }
  }, [])

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (search) query.append('q', search)
      if (yearFilter) query.append('year', yearFilter)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/students/search?${query.toString()}`)
      const data = await response.json()
      setStudents(data)
    } catch (error) {
      console.error('Error fetching students:', error)
    } finally {
      setLoading(false)
    }
  }, [search, yearFilter])

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/history`)
      const data = await response.json()
      setHistory(data)
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/settings`)
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }, [])

  useEffect(() => {
    checkServer() // eslint-disable-line react-hooks/set-state-in-effect
    const interval = setInterval(checkServer, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [checkServer])

  useEffect(() => {
    if (activeTab === 'dashboard') fetchStudents() // eslint-disable-line react-hooks/set-state-in-effect
    if (activeTab === 'history') fetchHistory()
    if (activeTab === 'settings') fetchSettings()
  }, [activeTab, fetchStudents, fetchHistory, fetchSettings])

  const handleFetchLinkedIn = async () => {
    if (!targetYear) {
      alert("Please enter a graduation year")
      return
    }
    setFetching(true)
    setMessage(null)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/fetch-linkedin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: targetYear })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to fetch data')
      setMessage({ type: 'success', text: data.message })
      setYearFilter(targetYear)
      // fetchStudents() is redundant here as setYearFilter will trigger the useEffect
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setFetching(false)
    }
  }

  const clearFilters = () => {
    setYearFilter('')
    setSearch('')
  }

  const renderDashboard = () => (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem' }}>LinkedIn Integration</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Fetch real candidates for any graduation year.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input 
            type="number" 
            className="search-bar" 
            placeholder="Year (e.g. 2024)" 
            value={targetYear}
            onChange={(e) => setTargetYear(e.target.value)}
            style={{ width: '150px' }}
          />
          <button className="btn-primary" onClick={handleFetchLinkedIn} disabled={fetching}>
            {fetching ? 'Searching...' : 'Search LinkedIn'}
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card glass">
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Showing Year</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '0.5rem' }}>{yearFilter || 'All Years'}</div>
          {yearFilter && <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>Show All</button>}
        </div>
        <div className="stat-card glass">
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total Candidates</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '0.5rem', color: '#818cf8' }}>{students.length}</div>
        </div>
        <div className="stat-card glass">
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Server Status</div>
          <div style={{ 
            fontSize: '1.2rem', fontWeight: '700', marginTop: '0.5rem', 
            color: serverStatus === 'online' ? '#34d399' : '#f87171',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'currentColor', boxShadow: `0 0 10px currentColor` }}></span>
            {serverStatus.toUpperCase()}
          </div>
        </div>
      </section>

      <section className="glass" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <input 
            type="text" className="search-bar" placeholder="Quick filter by name or email..." 
            value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }}
          />
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading candidates...</div>
        ) : (
          <table className="student-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>GRAD YEAR</th>
                <th>LINKEDIN</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No candidates found. Try searching for a different year.</td></tr>
              ) : (
                students.map(student => (
                  <tr key={student.id} className="fade-in">
                    <td style={{ fontWeight: '600' }}>{student.name}</td>
                    <td><span className="badge">{student.year}</span></td>
                    <td><a href={student.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>Profile ↗</a></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{student.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>
    </>
  )

  const renderHistory = () => (
    <section className="glass fade-in" style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Search History</h2>
      <table className="student-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>YEAR TARGETED</th>
            <th>NEW RESULTS</th>
            <th>SOURCE USED</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}>No search history yet.</td></tr>
          ) : (
            history.map((h, i) => (
              <tr key={i}>
                <td>{new Date(h.timestamp).toLocaleString()}</td>
                <td style={{ fontWeight: '600' }}>{h.year}</td>
                <td style={{ color: '#34d399' }}>+{h.count}</td>
                <td>{h.source}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )

  const renderSettings = () => (
    <section className="glass fade-in" style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>API Configuration</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Status of integrated LinkedIn search providers.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ color: '#818cf8' }}>Serper.dev</h4>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Status: {settings?.serper}</p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Primary Discovery Tool</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ color: '#818cf8' }}>NinjaPear (Proxycurl)</h4>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Status: {settings?.proxycurl}</p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Enrichment & B2B Data</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ color: '#818cf8' }}>Apollo.io</h4>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Status: {settings?.apollo}</p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Fallback Search & Contacts</div>
        </div>
      </div>
      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,191,0,0.05)', border: '1px solid rgba(255,191,0,0.2)', borderRadius: '8px', color: '#fbbf24', fontSize: '0.9rem' }}>
        <strong>Note:</strong> API keys are managed by admin via the server-side for security.
      </div>
    </section>
  )

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h1 style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: '800', background: 'linear-gradient(90deg, #fff, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          TALENT HUB
        </h1>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem', opacity: 0.6 }}>Main Menu</div>
          <button onClick={() => setActiveTab('dashboard')} className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}>Dashboard</button>
          <button onClick={() => setActiveTab('history')} className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}>Search History</button>
          <button onClick={() => setActiveTab('settings')} className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}>API Settings</button>
        </nav>
      </aside>

      <main className="main-content">
        {message && (
          <div className="fade-in" style={{ 
            padding: '1rem', borderRadius: '12px', marginBottom: '2rem', 
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: message.type === 'success' ? '#34d399' : '#f87171',
            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
          }}>
            {message.text}
          </div>
        )}

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'settings' && renderSettings()}

        <footer className="footer fade-in">
          <div className="footer-content">
            <div className="developer-tag">
              Designed and developed by <span className="designer-name">Saroj Padhi</span>
            </div>
            <div className="social-links">
              <a href="https://portfolio-8-4qo4.onrender.com/" target="_blank" rel="noopener noreferrer" className="social-link portfolio">Portfolio</a>
              <a href="https://www.github.com/saroj-02" target="_blank" rel="noopener noreferrer" className="social-link github">GitHub</a>
              <a href="https://www.linkedin.com/in/saroj-padhi-492979270" target="_blank" rel="noopener noreferrer" className="social-link linkedin">LinkedIn</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

export default App
