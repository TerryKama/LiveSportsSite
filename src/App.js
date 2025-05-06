import { useState, useEffect} from 'react';
import './App.css';
import axios from 'axios';

function App(){
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState([true]);

    return(
        <div className="app">
            <header>
                <h1>Live Sports Updates⚽🏀</h1>
            </header>
            <main>
                {loading ?(
                    <p>Loading Matches...</p>
                ) : (
                    <div className="matches=container">
                        {matches.length > 0 ?(
                            matches.map(match =>(
                                <MatchCard key={match.id} match={match} />
                            ))
                        ):(
                            <p>No live matches currently</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

function MatchCard({match}){
    return(
        <div className="match-card">
            <div className="match-header">
                <span className="competition">{match.competition}</span>
                <span className="match-status">Live</span>
            </div>
            <div className="teams">
                <div className="team">
                    <span className="team-name">{match.homeTeam}</span>
                    <span className="team-score">{match.homeScore}</span>
                </div>
                <span className="vs">vs</span>
                <div className="team">
                    <span className="team-score">{match.awayScore}</span>
                    <span className="team-name">{match.awayTeam}</span>
                </div>
            </div>
            <div className="match-footer">
                <span className="match-time">{match.time}'</span>
                <button className="details-btn">View Details</button>
            </div>
        </div>
    );
}
export default App;