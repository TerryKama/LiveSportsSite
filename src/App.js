import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// Error messages configuration
const API_ERRORS = {
  RATE_LIMIT: "Too many requests! Please wait 1 minute before refreshing.",
  INVALID_KEY: "Invalid API key. Check your .env file.",
  NETWORK: "Network error. Check your internet connection.",
  DEFAULT: "Failed to load matches. Try again later."
};

function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [rateLimit, setRateLimit] = useState({
    remaining: 10, // Default API-Sports limit
    resetTime: null
  });

  // Enhanced error message handler
  const getErrorMessage = (error) => {
    if (error.response) {
      if (error.response.status === 429) return API_ERRORS.RATE_LIMIT;
      if (error.response.status === 403) return API_ERRORS.INVALID_KEY;
      if (error.response.data?.errors) {
        return error.response.data.errors.join(', ');
      }
    } else if (error.request) {
      return API_ERRORS.NETWORK;
    }
    return error.message || API_ERRORS.DEFAULT;
  };

  // Cache matches in local storage
  const cacheMatches = (data) => {
    localStorage.setItem('lastMatches', JSON.stringify({
      data: data,
      timestamp: Date.now()
    }));
  };

  // Load cached matches
  const loadCachedMatches = () => {
    const cached = localStorage.getItem('lastMatches');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 3600000) { // 1 hour cache
        setMatches(data);
        return true;
      }
    }
    return false;
  };

  // Main data fetching function
  const fetchMatches = async () => {
    // Block if rate limited
    if (rateLimit.remaining <= 0) {
      const timeLeft = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      setError(`Rate limited! Try again in ${timeLeft}s`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('https://v3.football.api-sports.io/fixtures?live=all', {
        headers: {
          'x-apisports-key': process.env.REACT_APP_API_FOOTBALL_KEY
        }
      });

      // Update rate limit from headers
      setRateLimit({
        remaining: parseInt(response.headers['x-ratelimit-remaining']) || 10,
        resetTime: parseInt(response.headers['x-ratelimit-reset']) * 1000 || Date.now() + 60000
      });

      // Check for API errors in response
      if (response.data.errors?.length > 0) {
        throw new Error(response.data.errors.join(', '));
      }

      const transformedMatches = response.data.response.map(match => ({
        id: match.fixture.id,
        homeTeam: match.teams.home.name,
        awayTeam: match.teams.away.name,
        homeScore: match.goals.home,
        awayScore: match.goals.away,
        time: match.fixture.status.elapsed || 'HT',
        competition: match.league.name,
        status: match.fixture.status.long,
        events: match.events || []
      }));

      setMatches(transformedMatches);
      cacheMatches(transformedMatches);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      setError(getErrorMessage(error));
      console.error('API Error:', error);
      
      // Load cached data if available
      if (!loadCachedMatches()) {
        setMatches([]);
      }
    } finally {
      setLoading(false);
      setIsManualRefresh(false);
    }
  };

  // Initial load and auto-refresh setup
  useEffect(() => {
    // Try loading cached data first
    if (!loadCachedMatches()) {
      fetchMatches();
    }

    const intervalId = setInterval(() => {
      if (rateLimit.remaining > 3) { // Keep 3 requests as buffer
        fetchMatches();
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [rateLimit]); // Now depends on rateLimit

  const handleRefresh = () => {
    if (rateLimit.remaining > 0) {
      setIsManualRefresh(true);
      fetchMatches();
    }
  };

  return (
    <div className="App">
      <div className="header">
        <h1>Live Football ⚽</h1>
        <div className="refresh-controls">
          <div className="rate-limit">
            <span>API Calls Left: {rateLimit.remaining}/10</span>
            {rateLimit.resetTime && (
              <span>Resets in: {Math.max(0, Math.ceil((rateLimit.resetTime - Date.now()) / 1000))}s</span>
            )}
          </div>
          
          <button 
            onClick={handleRefresh}
            disabled={loading || rateLimit.remaining <= 0}
            className={isManualRefresh ? 'refreshing' : ''}
          >
            {loading && isManualRefresh ? (
              'Refreshing...'
            ) : (
              <>
                <span className="icon">🔄</span> Refresh
              </>
            )}
          </button>
          
          {lastUpdated && (
            <span className="update-time">
              Last updated: {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className={`error ${error.includes('wait') ? 'warning' : 'critical'}`}>
          ⚠️ {error}
          {error.includes('wait') && (
            <button 
              onClick={fetchMatches}
              disabled={loading || rateLimit.remaining <= 0}
              className="retry-btn"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Loading and empty states */}
      {loading && !isManualRefresh ? (
        <div className="skeleton-loader">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton-match" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <p>No live matches currently</p>
          <button onClick={fetchMatches}>Check again</button>
        </div>
      ) : (
        <div className="matches">
          {matches.map(match => (
            <div key={match.id} className="match-card">
              <div className="match-header">
                <span className="competition">{match.competition}</span>
                <span className="status">{match.status}</span>
              </div>
              <div className="teams">
                <span className="team home">{match.homeTeam}</span>
                <span className="score">{match.homeScore} - {match.awayScore}</span>
                <span className="team away">{match.awayTeam}</span>
              </div>
              <div className="match-footer">
                <span className="time">{match.time}'</span>
                {match.events.length > 0 && (
                  <span className="events">
                    ⚽ {match.events.filter(e => e.type === 'Goal').length} | 
                    🟨 {match.events.filter(e => e.type === 'Card').length}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;