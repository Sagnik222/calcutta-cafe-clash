import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getCurrentProfile } from '../lib/auth';

function Lobby() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    setCurrentPlayerId(localStorage.getItem('currentPlayerId'));

    const fetchLobby = async () => {
      const p = await getCurrentProfile();
      setProfile(p);

      const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      const { data: pl } = await supabase.from('players').select('*').eq('session_id', sessionId);
      setSession(s);
      setPlayers(pl || []);

      if (s?.status === 'active') {
        navigate(`/game/${sessionId}`);
      }

      // Fetch invitations for this session
      const { data: invites } = await supabase
        .from('game_invitations')
        .select('*, invitee:profiles!game_invitations_invitee_id_fkey(*)')
        .eq('session_id', sessionId);
      setInvitations(invites || []);
    };
    fetchLobby();

    const playersSub = supabase
      .channel(`players:${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` }, payload => {
        setPlayers(current => [...current, payload.new]);
      })
      .subscribe();

    const sessionSub = supabase
      .channel(`sessions:${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, payload => {
        if (payload.new.status === 'active') {
          navigate(`/game/${sessionId}`);
        }
      })
      .subscribe();

    const inviteSub = supabase
      .channel(`invitations:${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_invitations', filter: `session_id=eq.${sessionId}` }, payload => {
        setInvitations(current => current.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersSub);
      supabase.removeChannel(sessionSub);
      supabase.removeChannel(inviteSub);
    };
  }, [sessionId, navigate]);

  const handleStartGame = async () => {
    if (players.length < 1) return;
    await supabase
      .from('sessions')
      .update({
        status: 'active',
        current_round: 1,
        round_started_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  };

  if (!session) return <div className="min-h-screen flex items-center justify-center font-body italic text-sepia bg-paper">Loading lobby...</div>;

  const isHost = session.host_player_id === currentPlayerId;

  // Group invitations by status
  const pendingInvites = invitations.filter(i => i.status === 'pending');
  const acceptedInvites = invitations.filter(i => i.status === 'accepted');
  const declinedInvites = invitations.filter(i => i.status === 'declined');

  return (
    <div className="min-h-screen flex flex-col items-center pt-16 px-6 bg-paper animate-fade-in pb-12">
      <div className="smallcaps text-sepia mb-2 tracking-widest text-[10px] font-bold">WAITING ROOM</div>
      <h2 className="font-display italic text-forest text-3xl mb-2">{session.region}</h2>
      <p className="font-body italic text-sepia text-sm mb-10">
        {session.cafe_pairings?.length || 0} rounds · {session.max_players} players max
      </p>

      {/* Players who have joined */}
      <div className="w-full max-w-md bg-cream rounded-xl shadow-md p-6 mb-6 border border-sepia/10">
        <h3 className="font-display italic text-xl text-ink mb-4 pb-3 border-b border-sepia/10">In the Room</h3>
        <ul className="flex flex-col gap-3">
          {players.map(p => (
            <li key={p.id} className="flex justify-between items-center font-body text-base py-1">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-forest animate-pulse"></span>
                <span className="text-ink">{p.display_name} {p.id === currentPlayerId ? <span className="italic text-sepia text-xs ml-1">(You)</span> : ''}</span>
              </div>
              {p.is_host && <span className="smallcaps text-[9px] text-forest bg-forest/10 px-2 py-1 rounded tracking-widest font-bold">Host</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Invitation Statuses */}
      {invitations.length > 0 && (
        <div className="w-full max-w-md bg-cream/50 rounded-xl p-6 mb-8 border border-sepia/10">
          <h3 className="font-display italic text-xl text-ink mb-4 pb-3 border-b border-sepia/10">Invitations</h3>
          <ul className="flex flex-col gap-3">
            {pendingInvites.map(inv => (
              <li key={inv.id} className="flex justify-between items-center font-body text-base py-1">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-sepia/50"></span>
                  <span className="text-ink/70">{inv.invitee?.display_name || 'Unknown'}</span>
                </div>
                <span className="font-body italic text-sepia text-xs">Waiting...</span>
              </li>
            ))}
            {acceptedInvites.map(inv => (
              <li key={inv.id} className="flex justify-between items-center font-body text-base py-1">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-forest"></span>
                  <span className="text-ink">{inv.invitee?.display_name || 'Unknown'}</span>
                </div>
                <span className="text-forest text-sm font-bold">✓ Joined</span>
              </li>
            ))}
            {declinedInvites.map(inv => (
              <li key={inv.id} className="flex justify-between items-center font-body text-base py-1">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-300"></span>
                  <span className="text-ink/50 line-through">{inv.invitee?.display_name || 'Unknown'}</span>
                </div>
                <span className="font-body italic text-red-400 text-xs">Declined</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="w-full max-w-md">
        {isHost ? (
          <button
            className="btn-primary w-full shadow-md"
            onClick={handleStartGame}
            disabled={players.length < 2}
          >
            {players.length < 2 ? 'Waiting for players...' : 'Start Game'}
          </button>
        ) : (
          <div className="text-center p-4 bg-sepia/5 rounded-lg border border-sepia/10">
            <p className="font-body italic text-sepia">Waiting for the host to start the game...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Lobby;
