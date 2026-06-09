import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function Results() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [cafes, setCafes] = useState({});
  const [viewMode, setViewMode] = useState('yours'); // 'yours' or 'ours'
  const [myRanking, setMyRanking] = useState([]);
  const [groupRanking, setGroupRanking] = useState([]);
  const [firstPicks, setFirstPicks] = useState({});
  const [loading, setLoading] = useState(true);
  const currentPlayerId = localStorage.getItem('currentPlayerId');

  useEffect(() => {
    const fetchResults = async () => {
      const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      const { data: p } = await supabase.from('players').select('*').eq('session_id', sessionId);
      
      setSession(s);

      const me = p?.find(player => player.id === currentPlayerId);
      const myRankIds = me?.individual_ranking || [];
      const groupRankIds = s?.collective_ranking || [];
      
      // Calculate first picks for 'ours' view
      const picks = {};
      p?.forEach(player => {
        if (player.individual_ranking && player.individual_ranking.length > 0) {
          const firstPickId = player.individual_ranking[0];
          if (!picks[firstPickId]) picks[firstPickId] = [];
          picks[firstPickId].push(player.display_name.split(' ')[0]);
        }
      });
      setFirstPicks(picks);

      const allCafeIds = [...new Set([...myRankIds, ...groupRankIds])];
      
      if (allCafeIds.length > 0) {
        const { data: c } = await supabase.from('cafes').select('*').in('id', allCafeIds);
        const cafeMap = {};
        c?.forEach(cafe => { cafeMap[cafe.id] = cafe; });
        setCafes(cafeMap);
      }

      setMyRanking(myRankIds);
      setGroupRanking(groupRankIds);
      setLoading(false);
    };

    fetchResults();
  }, [sessionId, currentPlayerId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-body italic text-sepia bg-paper">Calculating final results...</div>;
  }

  const currentRanking = viewMode === 'yours' ? myRanking : groupRanking;
  const regionText = session?.region || 'All Kolkata';

  return (
    <div className="min-h-screen px-6 pt-12 pb-24 bg-paper animate-fade-in flex flex-col items-center">
      <div className="text-center mb-8">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-forest mx-auto opacity-80">
          <path d="M2 20h20M4 16l3-7 5 4 5-4 3 7z"/>
        </svg>
      </div>

      <div className="flex gap-2 justify-center mb-8 bg-sepia/5 p-1 rounded-full border border-sepia/20 shadow-sm">
        <button
          onClick={() => setViewMode('yours')}
          className={`px-6 py-2 rounded-full smallcaps text-[10px] tracking-widest transition-all duration-300 font-bold ${
            viewMode === 'yours' ? 'bg-forest text-cream shadow-md' : 'bg-transparent text-sepia hover:bg-sepia/10'
          }`}
        >
          YOURS
        </button>
        <button
          onClick={() => setViewMode('ours')}
          className={`px-6 py-2 rounded-full smallcaps text-[10px] tracking-widest transition-all duration-300 font-bold ${
            viewMode === 'ours' ? 'bg-forest text-cream shadow-md' : 'bg-transparent text-sepia hover:bg-sepia/10'
          }`}
        >
          OURS
        </button>
      </div>

      <div className="hairline w-10 mb-8 opacity-40"></div>

      <h2 className="font-display text-forest text-2xl md:text-3xl mb-10 text-center font-medium">
        {viewMode === 'yours' ? 'Your' : 'Our'} {regionText} Top {currentRanking.length}
      </h2>

      <div className="w-full max-w-lg flex flex-col gap-6">
        {currentRanking.map((cafeId, index) => {
          const cafe = cafes[cafeId];
          if (!cafe) return null;
          
          const isFirstPick = viewMode === 'ours' && firstPicks[cafeId] && firstPicks[cafeId].length > 0;

          return (
            <div key={cafe.id} className="flex items-start gap-4 animate-pop-in" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="font-display text-ink text-2xl w-8 text-center pt-1 font-medium">
                {ROMAN_NUMERALS[index]}
              </div>
              
              <div className="w-16 h-16 rounded overflow-hidden shrink-0 border border-sepia/20 shadow-sm bg-sepia/10">
                {cafe.image_url && <img src={cafe.image_url} alt={cafe.name} className="w-full h-full object-cover" />}
              </div>

              <div className="flex-1 min-w-0 pt-1 pb-4 border-b border-sepia/10">
                <h3 className="font-display text-lg text-ink font-medium leading-tight">{cafe.name}</h3>
                <p className="font-body italic text-sepia text-[11px] mt-0.5">{cafe.neighborhood}</p>
                
                {cafe.well_known_for && cafe.well_known_for.length > 0 && (
                  <div className="font-body italic text-walnut text-[10px] mt-1.5 opacity-80">
                    known for <span className="underline decoration-dotted">{cafe.well_known_for[0]}</span>
                  </div>
                )}
                
                {isFirstPick && (
                  <div className="smallcaps text-walnut text-[9px] tracking-[0.2em] mt-2 font-bold opacity-70">
                    {firstPicks[cafeId].join(' · ')}'S #1
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {currentRanking.length === 0 && (
          <p className="text-center text-sepia font-body italic my-8">No ranking data available.</p>
        )}
      </div>

      <div className="flex gap-4 w-full max-w-xs mt-16">
        <button 
          className="btn-primary flex-1 shadow-md"
          onClick={() => navigate('/')}
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

export default Results;
