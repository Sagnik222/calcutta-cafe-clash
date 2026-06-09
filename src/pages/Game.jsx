import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import CafeCard from '../components/CafeCard';
import VoteStatus from '../components/VoteStatus';

function Game() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [cafes, setCafes] = useState({});
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [hasVotedThisRound, setHasVotedThisRound] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setCurrentPlayerId(localStorage.getItem('currentPlayerId'));

    const fetchData = async () => {
      const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      setSession(s);

      if (s?.status === 'ranking') {
        navigate(`/ranking/${sessionId}`);
        return;
      }
      
      if (s?.status === 'completed') {
        navigate(`/results/${sessionId}`);
        return;
      }

      const { data: p } = await supabase.from('players').select('*').eq('session_id', sessionId);
      setPlayers(p || []);
      
      const me = p?.find(player => player.id === localStorage.getItem('currentPlayerId'));
      if (me) setHasVotedThisRound(me.current_round_voted);

      if (s?.cafe_pairings) {
        const cafeIds = [...new Set(s.cafe_pairings.flat())];
        const { data: c } = await supabase.from('cafes').select('*').in('id', cafeIds);
        
        const cafeMap = {};
        c?.forEach(cafe => { cafeMap[cafe.id] = cafe; });
        setCafes(cafeMap);
      }
    };
    
    fetchData();

    const sessionSub = supabase
      .channel(`sessions:${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, payload => {
        setIsTransitioning(true);
        setTimeout(() => {
          setSession(payload.new);
          if (payload.new.status === 'ranking') {
            navigate(`/ranking/${sessionId}`);
          } else if (payload.new.status === 'completed') {
            navigate(`/results/${sessionId}`);
          } else {
            setHasVotedThisRound(false);
            setIsTransitioning(false);
          }
        }, 500); // 500ms fade transition
      })
      .subscribe();

    const playersSub = supabase
      .channel(`players:${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` }, payload => {
        setPlayers(current => current.map(p => p.id === payload.new.id ? payload.new : p));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionSub);
      supabase.removeChannel(playersSub);
    };
  }, [sessionId, navigate]);

  const checkRoundAdvance = useCallback(async () => {
    if (!session || !players.length) return;
    
    const isHost = session.host_player_id === currentPlayerId;
    if (!isHost) return;

    const allVoted = players.every(p => p.current_round_voted);
    
    if (allVoted) {
      const nextRound = session.current_round + 1;
      const isComplete = nextRound > session.cafe_pairings.length;
      
      await supabase
        .from('sessions')
        .update({ 
          current_round: isComplete ? session.current_round : nextRound,
          status: isComplete ? 'ranking' : 'active'
        })
        .eq('id', sessionId);
        
      if (!isComplete) {
        await supabase
          .from('players')
          .update({ current_round_voted: false })
          .eq('session_id', sessionId);
      }
    }
  }, [session, players, currentPlayerId, sessionId]);

  useEffect(() => {
    checkRoundAdvance();
  }, [players, checkRoundAdvance]);

  const handleVote = async (cafeId) => {
    if (hasVotedThisRound || !session) return;
    
    setHasVotedThisRound(true);

    await supabase.from('votes').insert({
      session_id: sessionId,
      player_id: currentPlayerId,
      round_number: session.current_round,
      cafe_id: cafeId,
      is_abstain: false
    });

    await supabase
      .from('players')
      .update({ current_round_voted: true })
      .eq('id', currentPlayerId);
  };

  if (!session || !Object.keys(cafes).length) {
    return <div className="min-h-screen flex items-center justify-center font-body italic text-sepia bg-paper">Preparing the cafés...</div>;
  }

  const currentPairing = session.cafe_pairings[session.current_round - 1];
  if (!currentPairing) return null;

  const cafeA = cafes[currentPairing[0]];
  const cafeB = cafes[currentPairing[1]];

  return (
    <div className="min-h-screen flex flex-col bg-paper py-10 px-4 relative pb-32">
      <div className={`transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        <div className="text-center mb-10">
          <div className="smallcaps text-sepia mb-3 tracking-widest text-xs">Round {session.current_round} of {session.cafe_pairings.length}</div>
          <h2 className="font-display italic text-forest text-4xl md:text-5xl">Which café?</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch max-w-5xl mx-auto w-full relative">
          <CafeCard 
            cafe={cafeA} 
            onVote={() => handleVote(cafeA.id)} 
            disabled={hasVotedThisRound}
          />
          
          <div className="flex items-center justify-center py-2 md:py-0 relative z-10 md:-mx-4">
            <div className="bg-paper border border-sepia/30 rounded-full w-14 h-14 flex items-center justify-center font-display italic text-sepia shadow-md text-xl">
              VS
            </div>
          </div>

          <CafeCard 
            cafe={cafeB} 
            onVote={() => handleVote(cafeB.id)}
            disabled={hasVotedThisRound}
          />
        </div>
      </div>

      <VoteStatus players={players} />
    </div>
  );
}

export default Game;
