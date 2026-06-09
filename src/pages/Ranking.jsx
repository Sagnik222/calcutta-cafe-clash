import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function Ranking() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myCafes, setMyCafes] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const currentPlayerId = localStorage.getItem('currentPlayerId');

  useEffect(() => {
    const fetchData = async () => {
      const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      setSession(s);

      if (s?.status === 'completed') {
        navigate(`/results/${sessionId}`);
        return;
      }

      const { data: p } = await supabase.from('players').select('*').eq('session_id', sessionId);
      setPlayers(p || []);
      
      const me = p?.find(player => player.id === currentPlayerId);
      if (me?.status === 'finished') {
        setIsSubmitted(true);
      }

      // Fetch my votes
      const { data: votes } = await supabase
        .from('votes')
        .select('cafe_id')
        .eq('session_id', sessionId)
        .eq('player_id', currentPlayerId);
        
      const cafeIds = [...new Set((votes || []).map(v => v.cafe_id))];
      
      if (cafeIds.length > 0 && (!me?.individual_ranking || me.individual_ranking.length === 0)) {
        const { data: cafes } = await supabase.from('cafes').select('*').in('id', cafeIds);
        setMyCafes(cafes || []);
        setRanking(cafes || []);
      }
    };
    fetchData();

    const sessionSub = supabase
      .channel(`sessions-ranking:${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, payload => {
        setSession(payload.new);
        if (payload.new.status === 'completed') {
          navigate(`/results/${sessionId}`);
        }
      })
      .subscribe();

    const playersSub = supabase
      .channel(`players-ranking:${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` }, payload => {
        setPlayers(current => current.map(p => p.id === payload.new.id ? payload.new : p));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionSub);
      supabase.removeChannel(playersSub);
    };
  }, [sessionId, navigate, currentPlayerId]);

  const checkGroupFinished = useCallback(async () => {
    if (!session || !players.length) return;
    
    const isHost = session.host_player_id === currentPlayerId;
    if (!isHost || session.status === 'completed') return;

    const allFinished = players.every(p => p.status === 'finished');
    
    if (allFinished) {
      // Calculate collective ranking
      const scores = {};
      players.forEach(p => {
        const rankArr = p.individual_ranking || [];
        const n = rankArr.length;
        rankArr.forEach((cafeId, idx) => {
          scores[cafeId] = (scores[cafeId] || 0) + (n - idx);
        });
      });

      const collectiveRanking = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

      await supabase
        .from('sessions')
        .update({ 
          collective_ranking: collectiveRanking,
          status: 'completed'
        })
        .eq('id', sessionId);
    }
  }, [session, players, currentPlayerId, sessionId]);

  useEffect(() => {
    checkGroupFinished();
  }, [players, checkGroupFinished]);

  const moveUp = (index) => {
    if (index === 0) return;
    const newRanking = [...ranking];
    const temp = newRanking[index];
    newRanking[index] = newRanking[index - 1];
    newRanking[index - 1] = temp;
    setRanking(newRanking);
  };

  const moveDown = (index) => {
    if (index === ranking.length - 1) return;
    const newRanking = [...ranking];
    const temp = newRanking[index];
    newRanking[index] = newRanking[index + 1];
    newRanking[index + 1] = temp;
    setRanking(newRanking);
  };

  const handleSubmit = async () => {
    setIsSubmitted(true);
    const cafeIds = ranking.map(c => c.id);
    await supabase
      .from('players')
      .update({ 
        individual_ranking: cafeIds,
        status: 'finished'
      })
      .eq('id', currentPlayerId);
  };

  if (!session) return null;

  if (isSubmitted) {
    const finishedCount = players.filter(p => p.status === 'finished').length;
    return (
      <div className="min-h-screen px-6 pt-24 pb-10 text-center flex flex-col bg-paper animate-fade-in">
        <div className="text-forest opacity-50 mx-auto">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20h20M4 16l3-7 5 4 5-4 3 7z"/>
          </svg>
        </div>
        <div className="hairline mt-6 mx-auto w-8"></div>
        <h2 className="font-display italic text-forest mt-6 text-2xl font-medium">Waiting for group to finish ranking…</h2>
        <div className="smallcaps mt-4 text-[11px] tracking-[0.22em] text-walnut">
          {finishedCount} of {players.length} players done
        </div>

        <ul className="mt-10 space-y-3 mx-auto w-full max-w-xs">
          {players.map(p => {
            const isDone = p.status === 'finished';
            return (
              <li key={p.id} className="flex items-center justify-between font-body text-lg border-b border-sepia/10 pb-2">
                <span className="smallcaps text-ink text-sm tracking-widest">{p.display_name}</span>
                <span className={`text-xl ${isDone ? 'text-forest' : 'text-sepia opacity-50'}`}>{isDone ? '✓' : '…'}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 pt-16 pb-12 bg-paper animate-fade-in flex flex-col items-center">
      <div className="text-center mb-8">
        <h2 className="font-display italic text-forest text-4xl mb-3">Rank your choices</h2>
        <p className="font-body italic text-sepia text-sm">Organize your top {ranking.length} cafés from best to worst.</p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-3">
        {ranking.map((cafe, index) => (
          <div key={cafe.id} className="bg-cream border border-sepia/30 rounded-lg p-3 flex items-center shadow-sm">
            <div className="w-8 font-display italic text-forest text-2xl text-center font-medium mr-2">
              {index + 1}
            </div>
            
            <div className="w-12 h-12 rounded object-cover overflow-hidden bg-sepia/10 mr-4 shrink-0">
              {cafe.image_url && <img src={cafe.image_url} alt={cafe.name} className="w-full h-full object-cover" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg text-ink truncate">{cafe.name}</h3>
              <p className="font-body italic text-sepia text-[10px] truncate">{cafe.neighborhood}</p>
            </div>

            <div className="flex flex-col ml-2">
              <button 
                onClick={() => moveUp(index)} 
                disabled={index === 0}
                className="p-2 text-sepia hover:text-forest disabled:opacity-20 transition-colors"
              >
                ▲
              </button>
              <button 
                onClick={() => moveDown(index)} 
                disabled={index === ranking.length - 1}
                className="p-2 text-sepia hover:text-forest disabled:opacity-20 transition-colors"
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>

      <button 
        className="btn-primary mt-12 max-w-xs shadow-md"
        onClick={handleSubmit}
      >
        Submit Ranking
      </button>
    </div>
  );
}

export default Ranking;
