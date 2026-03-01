import React, { useState, useEffect } from 'react'

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch insights from /insights endpoint
    setLoading(false)
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Deep Work Dashboard</h1>
      <p>Coming in HOUR 8-9: AI-powered insights will appear here</p>
      
      {loading && <p>Loading...</p>}
      
      {/* Placeholder for cards showing:
        - Productivity score
        - Focus time
        - Distractions blocked
        - Top distracting sites
        - Focus patterns
      */}
    </div>
  )
}

export default App
