import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import './App.css';

// Error messages configuration
const API_ERRORS = {
  RATE_LIMIT: "Too many requests! Please wait 1 minute before refreshing.",
  INVALID_KEY: "Invalid API key. Check your .env file.",
  NETWORK: "Network error. Check your internet connection.",
  DEFAULT: "Failed to load matches. Try again later."
};

// Skeleton Loader Component
const SkeletonLoader = ({ count = 3 }) => {
  return (
    <div className="skeleton-loader" aria-label="Loading matches">
      {[...Array(count)].map((_, index) => (
        <div key={index} className="skeleton-match" />
      ))}
    </div>
  );
};

SkeletonLoader.propTypes = {
  count: PropTypes.number
};

// Match Card Skeleton (Detailed)
const MatchCardSkeleton = () => (
  <div className="match-card skeleton">
    <div className="match-header">
      <div className="skeleton-line" style={{ width: '120px' }} />
      <div className="skeleton-line" style={{ width: '60px' }} />
    </div>
    <div className="teams">
      <div className="team">
        <div className="skeleton-line" style={{ width: '80px' }} />
      </div>
      <div className="score skeleton-line" style={{ width: '50px' }} />
      <div className="team">
        <div className="skeleton-line" style={{ width: '80px' }} />
      </div>
    </div>
    <div className="match-footer">
      <div className="skeleton-line" style={{ width: '40px' }} />
      <div className="skeleton-line" style={{ width: '80px' }} />
    </div>
  </div>
);

function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [rateLimit, setRateLimit] = useState({
    remaining: 10,
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
    try {
      localStorage.setItem('lastMatches', JSON.stringify({
        data: data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('LocalStorage quota exceeded', e);
    }
  };

  // Load cached matches
  const loadCachedMatches = () => {
    try {
      const cached = localStorage.getItem('lastMatches');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) {
          setMatches(data);
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached matches', e);
    }
    return false;
  };

  // Main data fetching function
  const fetchMatches = async () => {
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
        },
        timeout: 10000 // 10 second timeout
      });

      setRateLimit({
        remaining: parseInt(response.headers['x-ratelimit-remaining']) || 10,
        resetTime: parseInt(response.headers['x-ratelimit-reset']) * 1000 || Date.now() + 60000
      });

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
      const errorMsg = getErrorMessage(error);
      setError(errorMsg);
      console.error('API Error:', error);
      
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
    if (!loadCachedMatches()) {
      fetchMatches();
    }

    const intervalId = setInterval(() => {
      if (rateLimit.remaining > 3) {
        fetchMatches();
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const handleRefresh = () => {
    if (rateLimit.remaining > 0 && !loading) {
      setIsManualRefresh(true);
      fetchMatches();
    }
  };

  // Optimized match rendering
  const renderedMatches = useMemo(() => (
    matches.map(match => (
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
    ))
  ), [matches]);

  return (
    <div className="App">
      <header className="header">
        <h1>Live Football ⚽</h1>
        <div className="refresh-controls">
          <div className="rate-limit" aria-live="polite">
            <span>API Calls Left: {rateLimit.remaining}/10</span>
            {rateLimit.resetTime && (
              <span>Resets in: {Math.max(0, Math.ceil((rateLimit.resetTime - Date.now()) / 1000))}s</span>
            )}
          </div>
          
          <button 
            onClick={handleRefresh}
            disabled={loading || rateLimit.remaining <= 0}
            className={isManualRefresh ? 'refreshing' : ''}
            aria-label={loading ? 'Refreshing data' : 'Refresh data'}
          >
            {loading && isManualRefresh ? (
              'Refreshing...'
            ) : (
              <>
                <span className="icon" aria-hidden="true">🔄</span> Refresh
              </>
            )}
          </button>
          
          {lastUpdated && (
            <span className="update-time">
              Last updated: {lastUpdated}
            </span>
          )}
        </div>
      </header>

      <main>
        {error && (
          <div className={`error ${error.includes('wait') ? 'warning' : 'critical'}`} role="alert">
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

        {loading && !isManualRefresh ? (
          <SkeletonLoader count={3} />
        ) : matches.length === 0 ? (
          <div className="empty-state">
            <p>No live matches currently</p>
            <button onClick={fetchMatches}>Check again</button>
          </div>
        ) : (
          <div className="matches">
            {renderedMatches}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;