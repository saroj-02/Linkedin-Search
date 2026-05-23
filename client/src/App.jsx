import { useState, useEffect, useCallback, useRef } from 'react'
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
  
  // Direct LinkedIn Search States
  const [discoveryMode, setDiscoveryMode] = useState('batch')
  const [directSearchQuery, setDirectSearchQuery] = useState('')
  const [newlyFetchedCandidates, setNewlyFetchedCandidates] = useState([])

  // AI Recruiter talent hub states
  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [scoredCandidates, setScoredCandidates] = useState([])
  const [scoringLoading, setScoringLoading] = useState(false)
  
  // Job Description Upload Form
  const [jdTitle, setJdTitle] = useState('')
  const [jdDescription, setJdDescription] = useState('')
  const [uploadingJd, setUploadingJd] = useState(false)
  const jdFileInputRef = useRef(null)

  // Resume Parsing Form
  const [resumeText, setResumeText] = useState('')
  const [parsingResume, setParsingResume] = useState(false)
  const resumeFileInputRef = useRef(null)

  // Comparison Dashboard States
  const [comparedCandidateIds, setComparedCandidateIds] = useState([])

  // AI Interview Questions States
  const [interviewCandidate, setInterviewCandidate] = useState(null)
  const [interviewJob, setInterviewJob] = useState(null)
  const [interviewQuestions, setInterviewQuestions] = useState([])
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [interviewSource, setInterviewSource] = useState('')

  // Recruitment Analytics States
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // API Local Gemini Key State
  const [geminiKeyInput, setGeminiKeyInput] = useState(localStorage.getItem('gemini_api_key') || '')

  // Details Modal Candidate state
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  // --- API FETCH HELPER (INJECTS CLIENT GEMINI KEY) ---
  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (savedKey) {
      headers['x-gemini-key'] = savedKey;
    }
    return fetch(`${import.meta.env.VITE_API_URL || ''}${endpoint}`, {
      ...options,
      headers
    });
  }, []);

  const checkServer = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/health`)
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
      const response = await apiFetch(`/api/students/search?${query.toString()}`)
      const data = await response.json()
      setStudents(data)
    } catch (error) {
      console.error('Error fetching students:', error)
    } finally {
      setLoading(false)
    }
  }, [search, yearFilter, apiFetch])

  const fetchHistory = useCallback(async () => {
    try {
      const response = await apiFetch('/api/history')
      const data = await response.json()
      setHistory(data)
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }, [apiFetch])

  const fetchSettings = useCallback(async () => {
    try {
      const response = await apiFetch('/api/settings')
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }, [apiFetch])

  const fetchJobs = useCallback(async () => {
    try {
      const response = await apiFetch('/api/jobs')
      const data = await response.json()
      setJobs(data)
      if (data.length > 0 && !selectedJobId) {
        setSelectedJobId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }, [selectedJobId, apiFetch])

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const response = await apiFetch('/api/recruitment-analytics')
      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    checkServer()
    const interval = setInterval(checkServer, 30000)
    return () => clearInterval(interval)
  }, [checkServer])

  useEffect(() => {
    if (activeTab === 'dashboard') fetchStudents()
    if (activeTab === 'history') fetchHistory()
    if (activeTab === 'settings') fetchSettings()
    if (activeTab === 'jds') fetchJobs()
    if (activeTab === 'matcher') {
      fetchJobs()
      fetchStudents()
    }
    if (activeTab === 'analytics') fetchAnalytics()
  }, [activeTab, fetchStudents, fetchHistory, fetchSettings, fetchJobs, fetchAnalytics])

  // Recalculate scores when job selection or student list changes
  useEffect(() => {
    if (activeTab === 'matcher' && selectedJobId) {
      const scoreCandidates = async () => {
        setScoringLoading(true)
        try {
          const response = await apiFetch(`/api/jobs/${selectedJobId}/score`, { method: 'POST' })
          const data = await response.json()
          setScoredCandidates(data.candidates || [])
        } catch (error) {
          console.error('Error scoring candidates:', error)
        } finally {
          setScoringLoading(false)
        }
      }
      scoreCandidates()
    }
  }, [selectedJobId, activeTab, students, apiFetch])

  const handleFetchLinkedIn = async () => {
    if (!targetYear) {
      alert("Please enter a graduation year")
      return
    }
    setFetching(true)
    setMessage(null)
    try {
      const response = await apiFetch('/api/fetch-linkedin', {
        method: 'POST',
        body: JSON.stringify({ year: targetYear })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to fetch data')
      setMessage({ type: 'success', text: data.message })
      setYearFilter(targetYear)
      
      // Append unique new candidates to accumulate search history in the drawer
      setNewlyFetchedCandidates(prev => {
        const newBatch = data.candidates || []
        const existingIds = new Set(prev.map(c => c.id))
        const uniqueNew = newBatch.filter(c => !existingIds.has(c.id))
        return [...uniqueNew, ...prev]
      })
      
      fetchStudents()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setFetching(false)
    }
  }

  const handleFetchDirectProfile = async () => {
    if (!directSearchQuery) {
      alert("Please enter a candidate name, email, or LinkedIn URL")
      return
    }
    setFetching(true)
    setMessage(null)
    try {
      const response = await apiFetch('/api/fetch-linkedin-profile', {
        method: 'POST',
        body: JSON.stringify({ q: directSearchQuery })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to fetch candidate profile')
      setMessage({ type: 'success', text: data.message })
      
      const queryText = directSearchQuery.trim()
      setDirectSearchQuery('')
      
      // Append unique new candidates to accumulate search history in the drawer
      setNewlyFetchedCandidates(prev => {
        const newBatch = data.candidates || []
        const existingIds = new Set(prev.map(c => c.id))
        const uniqueNew = newBatch.filter(c => !existingIds.has(c.id))
        return [...uniqueNew, ...prev] // Newest search results display at the top of the list!
      })
      
      // Clear any search and year filters so that all stored profiles and newly resolved ones are visible together
      setSearch('')
      setYearFilter('')
      
      fetchStudents()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setFetching(false)
    }
  }

  const handleCreateJd = async (e) => {
    if (e) e.preventDefault()
    if (!jdDescription) {
      alert("Please paste a job description first")
      return
    }
    setUploadingJd(true)
    setMessage(null)
    try {
      const response = await apiFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: jdTitle, description: jdDescription })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to upload JD')
      setMessage({ type: 'success', text: `Job Description "${data.title}" uploaded and analyzed successfully using ${data.methodUsed}!` })
      setJdTitle('')
      setJdDescription('')
      fetchJobs()
      setSelectedJobId(data.id)
      setActiveTab('matcher')
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setUploadingJd(false)
    }
  }

  const handleDeleteJd = async (id, title) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return
    try {
      const response = await apiFetch(`/api/jobs/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setMessage({ type: 'success', text: `Job "${title}" deleted.` })
        fetchJobs()
        if (selectedJobId === id) setSelectedJobId('')
      }
    } catch (error) {
      console.error("Error deleting job:", error)
    }
  }

  const handleParseResume = async (e) => {
    if (e) e.preventDefault()
    if (!resumeText) {
      alert("Please paste a candidate resume first")
      return
    }
    setParsingResume(true)
    setMessage(null)
    try {
      const response = await apiFetch('/api/candidates/parse-resume', {
        method: 'POST',
        body: JSON.stringify({ resumeText })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to parse resume')
      setMessage({ type: 'success', text: `Resume for "${data.name}" parsed and candidate added successfully!` })
      setResumeText('')
      fetchStudents()
      setSelectedCandidate(data)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setParsingResume(false)
    }
  }

  const handleGenerateQuestions = async (candidate, job) => {
    setInterviewCandidate(candidate)
    setInterviewJob(job)
    setGeneratingQuestions(true)
    setActiveTab('interview')
    try {
      const response = await apiFetch(`/api/jobs/${job.id}/candidates/${candidate.id}/interview-questions`, { method: 'POST' })
      const data = await response.json()
      setInterviewQuestions(data.questions || [])
      setInterviewSource(data.source || 'AI')
    } catch (error) {
      console.error('Error generating questions:', error)
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const saveGeminiKey = () => {
    localStorage.setItem('gemini_api_key', geminiKeyInput.trim())
    setMessage({ type: 'success', text: "Gemini API key updated successfully." })
    fetchSettings()
  }

  const clearGeminiKey = () => {
    localStorage.removeItem('gemini_api_key')
    setGeminiKeyInput('')
    setMessage({ type: 'success', text: "Gemini API key cleared from browser memory." })
    fetchSettings()
  }

  const toggleComparison = (id) => {
    setComparedCandidateIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(cId => cId !== id)
      } else {
        if (prev.length >= 3) {
          alert("You can compare a maximum of 3 candidates at once.")
          return prev
        }
        return [...prev, id]
      }
    })
  }

  const handleJdFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setJdDescription(event.target.result)
      const nameWithoutExtension = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      setJdTitle(nameWithoutExtension)
    }
    reader.readAsText(file)
  }

  const handleResumeFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setResumeText(event.target.result)
    }
    reader.readAsText(file)
  }

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text)
    alert(`Copied Question #${idx + 1} to clipboard!`)
  }

  const clearFilters = () => {
    setYearFilter('')
    setSearch('')
  }

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981' // Green
    if (score >= 60) return '#fbbf24' // Yellow
    return '#f87171' // Red
  }

  const getJobById = (id) => jobs.find(j => j.id === id)

  // --- SUB-RENDERS FOR NEW TABS ---

  const renderDashboard = () => (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem' }}>LinkedIn Integration</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Fetch, search, and import real-world technical candidates.</p>
        </div>
      </header>

      {/* Discovery Mode Selector Tabs */}
      <div className="glass" style={{ display: 'flex', gap: '1rem', padding: '0.75rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.02)' }}>
        <button 
          onClick={() => setDiscoveryMode('batch')} 
          className={`nav-link`} 
          style={{ 
            margin: 0, 
            textAlign: 'center', 
            background: discoveryMode === 'batch' ? 'var(--accent-color)' : 'none',
            color: discoveryMode === 'batch' ? 'white' : 'var(--text-secondary)',
            boxShadow: discoveryMode === 'batch' ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none'
          }}
        >
          🎓 Batch Class Discovery
        </button>
        <button 
          onClick={() => setDiscoveryMode('direct')} 
          className={`nav-link`} 
          style={{ 
            margin: 0, 
            textAlign: 'center', 
            background: discoveryMode === 'direct' ? 'var(--accent-color)' : 'none',
            color: discoveryMode === 'direct' ? 'white' : 'var(--text-secondary)',
            boxShadow: discoveryMode === 'direct' ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none'
          }}
        >
          🔍 Direct LinkedIn Profile Fetch
        </button>
      </div>

      {/* Search Input Panels */}
      <div className="glass fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
        {discoveryMode === 'batch' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ color: 'white', fontWeight: '600', marginBottom: '0.25rem' }}>Find Graduation Class Leads</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Scrapes and maps students graduating in the specified year using integrated search keys.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="number" 
                className="search-bar" 
                placeholder="Year (e.g. 2025)" 
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                style={{ width: '180px' }}
              />
              <button className="btn-primary" onClick={handleFetchLinkedIn} disabled={fetching} style={{ whiteSpace: 'nowrap' }}>
                {fetching ? 'Searching...' : 'Scrape Class'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ color: 'white', fontWeight: '600', marginBottom: '0.25rem' }}>Direct Candidate Fetch & Import</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Enter a Name, Email, or LinkedIn URL. The engine resolves their handle, enriches their detailed profile, and saves them to the DB.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '300px' }}>
              <input 
                type="text" 
                className="search-bar" 
                placeholder="Name, Email (e.g. saroj@example.com), or Profile URL" 
                value={directSearchQuery}
                onChange={(e) => setDirectSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn-primary" onClick={handleFetchDirectProfile} disabled={fetching} style={{ whiteSpace: 'nowrap' }}>
                {fetching ? 'Searching...' : 'Search & Fetch Profile'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Newly Fetched Profiles Drawer */}
      {newlyFetchedCandidates.length > 0 && (
        <div className="glass fade-in" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid rgba(52, 211, 153, 0.3)', background: 'rgba(16, 185, 129, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#34d399', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700' }}>
              <span style={{ fontSize: '1.4rem' }}>⚡</span> Resolved LinkedIn Profiles ({newlyFetchedCandidates.length})
            </h3>
            <button 
              onClick={() => setNewlyFetchedCandidates([])} 
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', padding: 0 }}
            >
              ✕ Close Panel
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {newlyFetchedCandidates.map(c => (
              <div key={c.id} className="glass fade-in" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <h4 style={{ color: 'white', fontWeight: '700', fontSize: '0.95rem' }}>{c.name}</h4>
                    <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: '600', whiteSpace: 'nowrap' }}>✓ Added</span>
                  </div>
                  <p style={{ color: '#818cf8', fontSize: '0.75rem', marginTop: '0.2rem', fontWeight: '500' }}>{c.title}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{c.company}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                  <a href={c.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#34d399', textDecoration: 'none', fontSize: '0.8rem', fontWeight: '700' }}>LinkedIn Profile ↗</a>
                  <button 
                    onClick={() => setSelectedCandidate(c)} 
                    style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', padding: 0 }}
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            type="text" className="search-bar" placeholder="Quick filter candidates by name, email, or skill..." 
            value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }}
          />
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading candidates...</div>
        ) : (
          <div className="candidate-card-list">
            {students.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No candidates found. Try searching for a different year or skill.</div>
            ) : (
              students.map(student => (
                <div key={student.id} className="glass candidate-card fade-in" onClick={() => setSelectedCandidate(student)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: 'white' }}>{student.name}</h3>
                      <p style={{ color: '#818cf8', fontSize: '0.85rem', marginTop: '0.1rem', fontWeight: '500' }}>{student.title} @ {student.company}</p>
                    </div>
                    <span className="badge">{student.year}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineBreak: 'anywhere', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{student.summary}</p>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                    {(student.skills || []).slice(0, 4).map((sk, i) => (
                      <span key={i} className="badge" style={{ background: 'rgba(255,255,255,0.03)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.05)', padding: '2px 8px', fontSize: '0.7rem' }}>{sk}</span>
                    ))}
                    {(student.skills || []).length > 4 && (
                      <span className="badge" style={{ background: 'none', border: 'none', padding: '2px 4px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>+{student.skills.length - 4} more</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.85rem' }}>
                    <a href={student.linkedin} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '600' }}>LinkedIn Profile ↗</a>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{student.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </>
  )

  const renderJDs = () => (
    <>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem' }}>Job Descriptions</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Upload Job Descriptions and extract technical parameters using AI.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '2rem' }}>
        {/* Upload Form */}
        <section className="glass fade-in" style={{ padding: '2.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.3rem' }}>Upload New Job Description</h3>
          <form onSubmit={handleCreateJd} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Job Title (Optional - AI extracts standard titles)</label>
              <input 
                type="text" 
                className="search-bar" 
                placeholder="e.g. Senior Frontend Engineer" 
                value={jdTitle}
                onChange={(e) => setJdTitle(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Drag & Drop file or Paste JD Text</label>
              <div 
                className="dropzone" 
                onClick={() => jdFileInputRef.current.click()}
              >
                <input 
                  type="file" 
                  ref={jdFileInputRef} 
                  onChange={handleJdFileChange} 
                  accept=".txt" 
                  style={{ display: 'none' }}
                />
                <span className="dropzone-icon">📄</span>
                <div>
                  <p style={{ fontWeight: '600', color: 'white' }}>Choose a text file or Drag it here</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Supports standard text documents (.txt)</p>
                </div>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Or Paste Job Description Details</label>
              <textarea 
                className="search-bar" 
                rows="8" 
                placeholder="Paste raw JD text here including required skills, years of experience, and role specifications..."
                value={jdDescription}
                onChange={(e) => setJdDescription(e.target.value)}
                style={{ resize: 'vertical', width: '100%' }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={uploadingJd} style={{ alignSelf: 'flex-start', padding: '12px 28px' }}>
              {uploadingJd ? 'Extracting Technical Skills...' : 'Upload & Extract JD'}
            </button>
          </form>
        </section>

        {/* Existing JDs List */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass" style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>Active Roles ({jobs.length})</h3>
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {jobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', margin: 'auto' }}>No job descriptions uploaded yet.</div>
              ) : (
                jobs.map(job => (
                  <div key={job.id} className="glass" style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h4 style={{ color: 'white', fontWeight: '600' }}>{job.title}</h4>
                      <button 
                        onClick={() => handleDeleteJd(job.id, job.title)} 
                        style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '0.75rem', borderRadius: '6px' }}
                      >
                        Delete
                      </button>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.8rem', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{job.summary}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.8rem' }}>
                      {(job.skills || []).map((sk, i) => (
                        <span key={i} className="badge" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>{sk}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                      <span>Exp Required: {job.experienceRequired}+ Years</span>
                      <button 
                        onClick={() => { setSelectedJobId(job.id); setActiveTab('matcher'); }} 
                        className="btn-primary" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                      >
                        Match Candidates
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  )

  const renderMatcher = () => {
    const activeJob = getJobById(selectedJobId)
    return (
      <>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem' }}>Candidate Matching Matrix</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Automated technical scoring and gap analysis matching candidates against active JDs.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Select Target Role:</label>
            <select 
              className="custom-select" 
              value={selectedJobId} 
              onChange={(e) => setSelectedJobId(e.target.value)}
              style={{ width: '250px' }}
            >
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>
        </header>

        {!selectedJobId ? (
          <section className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>No job descriptions available. Please upload a JD first to score candidates.</p>
            <button className="btn-primary" onClick={() => setActiveTab('jds')}>Go to Job Descriptions</button>
          </section>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Job Summary Banner */}
            {activeJob && (
              <section className="glass fade-in" style={{ padding: '1.5rem 2rem', borderLeft: '4px solid var(--accent-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ color: 'white', fontSize: '1.25rem' }}>{activeJob.title} Requirements</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>{activeJob.summary}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Skills Evaluated</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#818cf8' }}>{activeJob.skills.length} Required</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Exp Required</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#818cf8' }}>{activeJob.experienceRequired}+ Years</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Scored Candidate Table */}
            <section className="glass" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>Ranked Candidate Pipeline ({scoredCandidates.length})</h3>
                {comparedCandidateIds.length > 0 && (
                  <button 
                    className="btn-primary" 
                    onClick={() => setActiveTab('comparison')}
                    style={{ background: 'linear-gradient(90deg, #10b981, #059669)', boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)' }}
                  >
                    Compare Selected ({comparedCandidateIds.length}/3) Side-by-Side ↗
                  </button>
                )}
              </div>

              {scoringLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Calculating matching matrix and analyzing technical skill gaps...</div>
              ) : scoredCandidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>No candidates in database. Fetch leads from LinkedIn dashboard first.</div>
              ) : (
                <table className="student-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>SELECT</th>
                      <th>CANDIDATE</th>
                      <th style={{ textAlign: 'center' }}>COMPATIBILITY</th>
                      <th>TECHNICAL SKILL GAP DETAILS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoredCandidates.map(candidate => {
                      const color = getScoreColor(candidate.score)
                      const isCompared = comparedCandidateIds.includes(candidate.id)
                      return (
                        <tr key={candidate.id} className="fade-in" style={{ cursor: 'pointer' }} onClick={() => setSelectedCandidate(candidate)}>
                          <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={isCompared}
                              onChange={() => toggleComparison(candidate.id)}
                              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: '600', color: 'white', fontSize: '0.95rem' }}>{candidate.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                              {candidate.title} • {candidate.experienceYears} Years Exp
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{ fontSize: '1.25rem', fontWeight: '800', color: color }}>{candidate.score}%</span>
                              <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', marginTop: '0.25rem', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${candidate.score}%`, backgroundColor: color }}></div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                              {/* Matched skills */}
                              {candidate.matchDetails?.matchedSkills.map((sk, i) => (
                                <span key={`match-${i}`} className="badge badge-matched" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>✓ {sk}</span>
                              ))}
                              {/* Missing skills */}
                              {candidate.matchDetails?.missingSkills.map((sk, i) => (
                                <span key={`miss-${i}`} className="badge badge-missing" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>✗ {sk}</span>
                              ))}
                              {/* Extra secondary skills */}
                              {candidate.matchDetails?.extraSkills.slice(0, 3).map((sk, i) => (
                                <span key={`extra-${i}`} className="badge badge-extra" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>+ {sk}</span>
                              ))}
                              {candidate.matchDetails?.extraSkills.length > 3 && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>+{candidate.matchDetails.extraSkills.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => handleGenerateQuestions(candidate, activeJob)}
                              className="btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
                            >
                              AI Interview
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}
      </>
    )
  }

  const renderComparison = () => {
    const activeJob = getJobById(selectedJobId)
    const candidatesToCompare = scoredCandidates.filter(c => comparedCandidateIds.includes(c.id))

    return (
      <>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem' }}>Candidate Comparison</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Side-by-side matrices contrasting core skills, experiences, and technical gaps.</p>
          </div>
          <button className="btn-primary" onClick={() => setActiveTab('matcher')}>Back to Matcher</button>
        </header>

        {candidatesToCompare.length === 0 ? (
          <section className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Please select candidates from the Matcher checkbox table to compare side-by-side.</p>
            <button className="btn-primary" onClick={() => setActiveTab('matcher')}>Go to Matcher</button>
          </section>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {activeJob && (
              <div className="glass" style={{ padding: '1.2rem 2rem', background: 'rgba(79, 70, 229, 0.05)', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                <span style={{ fontWeight: '700', color: 'white' }}>Comparing Candidates for Position: </span>
                <span style={{ color: '#818cf8', fontWeight: '700' }}>{activeJob.title}</span>
              </div>
            )}

            <div className="comparison-grid">
              {candidatesToCompare.map((c, idx) => {
                const color = getScoreColor(c.score)
                const isBest = idx === 0 // Since list is pre-sorted, first item has the highest compatibility score
                return (
                  <div key={c.id} className={`glass comparison-card ${isBest ? 'best-match' : ''} fade-in`} style={{ padding: '2rem' }}>
                    {isBest && (
                      <span className="badge" style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: '700' }}>
                        TOP CHOICE
                      </span>
                    )}
                    <h3 style={{ fontSize: '1.4rem', color: 'white', fontWeight: '700', marginBottom: '0.2rem' }}>{c.name}</h3>
                    <p style={{ color: '#818cf8', fontSize: '0.9rem', marginBottom: '1.5rem', fontWeight: '500' }}>{c.title} • {c.company}</p>

                    {/* Score section */}
                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: '800', color: color }}>{c.score}%</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Compatibility Score</div>
                      <div className="progress-bar-container" style={{ width: '80%', margin: '0.8rem auto 0 auto' }}>
                        <div className="progress-bar-fill" style={{ width: `${c.score}%`, backgroundColor: color }}></div>
                      </div>
                    </div>

                    {/* Breakdown Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.85rem' }}>
                      <div>
                        <strong style={{ color: 'white', display: 'block', marginBottom: '0.4rem' }}>Professional Experience</strong>
                        <p style={{ color: 'var(--text-secondary)' }}>{c.experienceYears} Years total experience</p>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{c.education}</p>
                      </div>

                      <div>
                        <strong style={{ color: '#34d399', display: 'block', marginBottom: '0.4rem' }}>Matched Core Skills ({c.matchDetails?.matchedSkills.length})</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {c.matchDetails?.matchedSkills.map((sk, i) => (
                            <span key={i} className="badge badge-matched" style={{ fontSize: '0.65rem' }}>{sk}</span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <strong style={{ color: '#f87171', display: 'block', marginBottom: '0.4rem' }}>Missing Core Skills ({c.matchDetails?.missingSkills.length})</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {c.matchDetails?.missingSkills.length === 0 ? (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>None! Fully qualified.</span>
                          ) : (
                            c.matchDetails?.missingSkills.map((sk, i) => (
                              <span key={i} className="badge badge-missing" style={{ fontSize: '0.65rem' }}>{sk}</span>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '0.4rem' }}>Secondary Skillsets ({c.matchDetails?.extraSkills.length})</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {c.matchDetails?.extraSkills.map((sk, i) => (
                            <span key={i} className="badge badge-extra" style={{ fontSize: '0.65rem' }}>{sk}</span>
                          ))}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem', marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn-primary" 
                          onClick={() => handleGenerateQuestions(c, activeJob)}
                          style={{ flex: 1, padding: '10px', fontSize: '0.8rem', borderRadius: '8px' }}
                        >
                          Generate AI Interview
                        </button>
                        <button 
                          className="btn-primary" 
                          onClick={() => toggleComparison(c.id)}
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', fontSize: '0.8rem', borderRadius: '8px' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </>
    )
  }

  const renderResume = () => (
    <>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem' }}>AI Resume Parser</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Instantly extract profiles, skills, and experience from resumes into the candidate pipeline.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '5fr 4fr', gap: '2rem' }}>
        <section className="glass fade-in" style={{ padding: '2.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.3rem' }}>Parse Candidate Resume</h3>
          <form onSubmit={handleParseResume} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Drag & Drop Resume Document</label>
              <div 
                className="dropzone" 
                onClick={() => resumeFileInputRef.current.click()}
              >
                <input 
                  type="file" 
                  ref={resumeFileInputRef} 
                  onChange={handleResumeFileChange} 
                  accept=".txt" 
                  style={{ display: 'none' }}
                />
                <span className="dropzone-icon">📤</span>
                <div>
                  <p style={{ fontWeight: '600', color: 'white' }}>Choose a text file or Drag it here</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Supports standard text documents (.txt)</p>
                </div>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Or Paste Resume Text</label>
              <textarea 
                className="search-bar" 
                rows="10" 
                placeholder="Paste the full text of candidate's resume here (work history, skills section, contact details)..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                style={{ resize: 'vertical', width: '100%' }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={parsingResume} style={{ alignSelf: 'flex-start', padding: '12px 28px' }}>
              {parsingResume ? 'AI Parsing & Mapping Stacks...' : 'Parse Resume & Add Candidate'}
            </button>
          </form>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass" style={{ padding: '2rem', flex: 1 }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#818cf8' }}>How it works</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <span style={{ background: 'var(--accent-color)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: '700', flexShrink: 0 }}>1</span>
                <div>
                  <strong style={{ color: 'white', display: 'block', marginBottom: '0.2rem' }}>Extract Text</strong>
                  Paste resume text or upload an extracted text copy of the candidate's CV.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <span style={{ background: 'var(--accent-color)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: '700', flexShrink: 0 }}>2</span>
                <div>
                  <strong style={{ color: 'white', display: 'block', marginBottom: '0.2rem' }}>AI Structuring</strong>
                  Our backend employs Gemini semantic parsing to map contact metadata, core technical stacks, and years of experience.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <span style={{ background: 'var(--accent-color)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: '700', flexShrink: 0 }}>3</span>
                <div>
                  <strong style={{ color: 'white', display: 'block', marginBottom: '0.2rem' }}>Pipeline Mapping</strong>
                  The candidate is added directly to the database. You can instantly run matching calculations for any active JD!
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )

  const renderInterview = () => (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem' }}>AI Interview Assistant</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Personalized, target-oriented interview questions focusing specifically on candidate stack gaps.</p>
        </div>
        <button className="btn-primary" onClick={() => setActiveTab('matcher')}>Back to Matcher</button>
      </header>

      {generatingQuestions ? (
        <section className="glass" style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Compiling candidate profile and job requirements...</p>
          <div style={{ color: '#818cf8', fontWeight: '700', animation: 'float 2s ease-in-out infinite' }}>Synthesizing personalized behavioral and technical questions...</div>
        </section>
      ) : !interviewCandidate ? (
        <section className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Select a candidate from the Matching Matrix and click "AI Interview" to begin.</p>
          <button className="btn-primary" onClick={() => setActiveTab('matcher')}>Go to Matcher</button>
        </section>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          {/* Left panel: Info summary */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '1.2rem' }}>Interview Target</h3>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Candidate</div>
                <div style={{ fontSize: '1.15rem', color: 'white', fontWeight: '700', marginTop: '0.2rem' }}>{interviewCandidate.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#818cf8', marginTop: '0.1rem' }}>{interviewCandidate.title}</div>
              </div>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target Role</div>
                <div style={{ fontSize: '1.15rem', color: 'white', fontWeight: '700', marginTop: '0.2rem' }}>{interviewJob?.title}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Targeted Skill Gaps Evaluated</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {interviewCandidate.matchDetails?.missingSkills.map((sk, i) => (
                    <span key={i} className="badge badge-missing" style={{ fontSize: '0.65rem' }}>✗ {sk}</span>
                  ))}
                  {interviewCandidate.matchDetails?.missingSkills.length === 0 && (
                    <span style={{ fontSize: '0.8rem', color: '#34d399', fontStyle: 'italic' }}>None (Perfect Match!)</span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(79, 70, 229, 0.05)', borderRadius: '8px', border: '1px solid rgba(79, 70, 229, 0.1)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong>Method:</strong> Questions generated using <strong>{interviewSource}</strong>, analyzing candidate experience relative to role criteria.
              </div>
            </div>
          </section>

          {/* Right panel: Questions list */}
          <section className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Custom Interview Questions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {interviewQuestions.map((q, idx) => (
                <div key={idx} className="question-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span className="badge" style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#818cf8', fontWeight: '700' }}>{q.type}</span>
                    <button 
                      onClick={() => copyToClipboard(q.question, idx)}
                      style={{ padding: '4px 8px', background: 'none', color: '#818cf8', fontSize: '0.75rem', fontWeight: '600' }}
                    >
                      Copy Question
                    </button>
                  </div>
                  <p style={{ color: 'white', fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Q{idx + 1}: {q.question}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}><strong>Evaluation Goal:</strong> {q.purpose}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )

  const renderAnalytics = () => (
    <>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem' }}>Recruitment Analytics</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Dynamic visual insights summarizing candidate pipelines, demanded skills, and recruiter search profiles.</p>
      </header>

      {analyticsLoading || !analytics ? (
        <div className="glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Aggregating analytics data and calculating stack distributions...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Top row: aggregates */}
          <section className="stats-grid">
            <div className="stat-card glass">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Active Positions</div>
              <div className="analytics-metric" style={{ marginTop: '0.5rem' }}>{analytics.totalJobs}</div>
            </div>
            <div className="stat-card glass">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Candidates Enrolled</div>
              <div className="analytics-metric" style={{ marginTop: '0.5rem', color: '#818cf8' }}>{analytics.totalCandidates}</div>
            </div>
            <div className="stat-card glass">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Average Experience</div>
              <div className="analytics-metric" style={{ marginTop: '0.5rem', color: '#34d399' }}>3.2 Years</div>
            </div>
          </section>

          {/* Grid row: skills demand vs candidates */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
            {/* Demanded Skills */}
            <section className="glass" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Skills in Highest Demand (from JDs)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {analytics.topDemandedSkills.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem' }}>No job descriptions to analyze.</p>
                ) : (
                  analytics.topDemandedSkills.map((sk, idx) => {
                    const widthPercent = analytics.totalJobs > 0 ? (sk.count / analytics.totalJobs) * 100 : 100
                    return (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: '600', color: 'white' }}>{sk.name}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{sk.count} Jobs ({Math.round(widthPercent)}%)</span>
                        </div>
                        <div className="progress-bar-container" style={{ height: '14px', background: 'rgba(255,255,255,0.02)' }}>
                          <div className="progress-bar-fill" style={{ width: `${widthPercent}%`, backgroundColor: '#818cf8', background: 'linear-gradient(90deg, var(--accent-color), #818cf8)' }}></div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* Candidate Skill pools */}
            <section className="glass" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Candidate Competency Strengths</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {analytics.topCandidateSkills.map((sk, idx) => {
                  const widthPercent = analytics.totalCandidates > 0 ? (sk.count / analytics.totalCandidates) * 100 : 100
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: '600', color: 'white' }}>{sk.name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{sk.count} Profiles ({Math.round(widthPercent)}%)</span>
                      </div>
                      <div className="progress-bar-container" style={{ height: '14px', background: 'rgba(255,255,255,0.02)' }}>
                        <div className="progress-bar-fill" style={{ width: `${widthPercent}%`, backgroundColor: '#34d399', background: 'linear-gradient(90deg, #10b981, #34d399)' }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          {/* Source distribution */}
          <section className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Candidate Source Distribution</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
              {analytics.sourceDistribution.map((src, idx) => (
                <div key={idx} className="glass" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{src.name}</div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: 'white', marginTop: '0.5rem' }}>{src.count}</div>
                  <div style={{ fontSize: '0.8rem', color: '#818cf8', marginTop: '0.25rem', fontWeight: '600' }}>{src.percentage}% of talent</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )

  const renderSettings = () => (
    <section className="glass fade-in" style={{ padding: '2.5rem' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.6rem' }}>API & AI Configuration</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Configure external keys for scraping and enable Gemini AI analysis locally.</p>
      
      {/* Local Gemini key config */}
      <div className="glass" style={{ padding: '2rem', border: '1px solid rgba(79, 70, 229, 0.2)', background: 'rgba(79, 70, 229, 0.02)', marginBottom: '2.5rem' }}>
        <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '0.8rem' }}>Client-Side Gemini API Key</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Provide your custom Gemini API key to enable live, high-precision AI resume parsing, JD skill extraction, and personalized interview questions. Your key remains securely saved inside your local browser memory (`localStorage`) and is only passed via headers to backend processors.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input 
            type="password" 
            className="search-bar" 
            placeholder="AIzaSy..." 
            value={geminiKeyInput}
            onChange={(e) => setGeminiKeyInput(e.target.value)}
            style={{ fontFamily: 'monospace', flex: 1 }}
          />
          <button className="btn-primary" onClick={saveGeminiKey}>Save Key</button>
          {localStorage.getItem('gemini_api_key') && (
            <button className="btn-primary" onClick={clearGeminiKey} style={{ background: '#f87171' }}>Clear</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}>
          <h4 style={{ color: '#818cf8' }}>Gemini Core Services</h4>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Status: {settings?.gemini}</p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Powers Resume & JD Extractors</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}>
          <h4 style={{ color: '#818cf8' }}>Serper.dev API</h4>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Status: {settings?.serper}</p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Primary Page Scraper Discovery</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}>
          <h4 style={{ color: '#818cf8' }}>NinjaPear (Proxycurl)</h4>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Status: {settings?.proxycurl}</p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Enriched Profile Aggregators</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}>
          <h4 style={{ color: '#818cf8' }}>Apollo.io</h4>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Status: {settings?.apollo}</p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Contact fallback lookup</div>
        </div>
      </div>
    </section>
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

  // --- DETAILS OVERLAY MODAL ---
  const renderCandidateModal = () => {
    if (!selectedCandidate) return null
    return (
      <div className="modal-overlay" onClick={() => setSelectedCandidate(null)}>
        <div className="modal-content glass" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setSelectedCandidate(null)}>×</button>
          
          <h3 style={{ fontSize: '1.6rem', color: 'white', fontWeight: '700', marginBottom: '0.2rem' }}>{selectedCandidate.name}</h3>
          <p style={{ color: '#818cf8', fontSize: '0.95rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            {selectedCandidate.title} @ {selectedCandidate.company}
          </p>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
            <strong style={{ color: 'white', display: 'block', marginBottom: '0.5rem' }}>Professional Summary</strong>
            <span style={{ color: 'var(--text-secondary)' }}>{selectedCandidate.summary}</span>
          </div>

          <div className="detail-grid" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h4 style={{ color: 'white', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '700' }}>Contact Details</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>✉ {selectedCandidate.email}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>📞 {selectedCandidate.phone}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>🎓 Graduation: {selectedCandidate.year}</p>
            </div>
            <div>
              <h4 style={{ color: 'white', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '700' }}>Technical Stacks</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {(selectedCandidate.skills || []).map((sk, i) => (
                  <span key={i} className="badge" style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>{sk}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
            <a 
              href={selectedCandidate.linkedin} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-primary" 
              style={{ textAlign: 'center', textDecoration: 'none', display: 'inline-block', flex: 1, padding: '10px', fontSize: '0.9rem', borderRadius: '8px' }}
            >
              LinkedIn Profile ↗
            </a>
            <button 
              className="btn-primary" 
              onClick={() => { toggleComparison(selectedCandidate.id); setSelectedCandidate(null); }}
              style={{ flex: 1, background: comparedCandidateIds.includes(selectedCandidate.id) ? '#f87171' : 'var(--accent-color)', padding: '10px', fontSize: '0.9rem', borderRadius: '8px' }}
            >
              {comparedCandidateIds.includes(selectedCandidate.id) ? 'Remove from Comparison' : 'Select for Comparison'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h1 style={{ marginBottom: '2rem', fontSize: '1.4rem', fontWeight: '800', background: 'linear-gradient(90deg, #fff, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          TALENT HUD SUITE
        </h1>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.4rem', opacity: 0.6 }}>Main Menu</div>
          <button onClick={() => setActiveTab('dashboard')} className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}>🔍 Discover Leads</button>
          <button onClick={() => setActiveTab('jds')} className={`nav-link ${activeTab === 'jds' ? 'active' : ''}`}>📄 Job Descriptions</button>
          <button onClick={() => setActiveTab('matcher')} className={`nav-link ${activeTab === 'matcher' ? 'active' : ''}`}>🎯 Candidate Matcher</button>
          <button onClick={() => setActiveTab('comparison')} className={`nav-link ${activeTab === 'comparison' ? 'active' : ''}`}>📊 Compare Suite</button>
          <button onClick={() => setActiveTab('resume')} className={`nav-link ${activeTab === 'resume' ? 'active' : ''}`}>📤 Resume Parser</button>
          <button onClick={() => setActiveTab('interview')} className={`nav-link ${activeTab === 'interview' ? 'active' : ''}`}>💬 AI Interviewer</button>
          <button onClick={() => setActiveTab('analytics')} className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`}>📈 Analytics Dashboard</button>
          
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', margin: '1rem 0 0.4rem 0', opacity: 0.6 }}>Administration</div>
          <button onClick={() => setActiveTab('history')} className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}>🕒 Activity History</button>
          <button onClick={() => setActiveTab('settings')} className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}>⚙ API Configuration</button>
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
        {activeTab === 'jds' && renderJDs()}
        {activeTab === 'matcher' && renderMatcher()}
        {activeTab === 'comparison' && renderComparison()}
        {activeTab === 'resume' && renderResume()}
        {activeTab === 'interview' && renderInterview()}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'settings' && renderSettings()}

        {renderCandidateModal()}

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
