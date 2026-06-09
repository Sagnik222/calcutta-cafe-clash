import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getCurrentProfile, signOut } from '../lib/auth';

function Landing() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('All Kolkata');
  const [mode, setMode] = useState('home'); // 'home', 'friend-picker'
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const regions = ['All Kolkata', 'South Kolkata', 'Salt Lake', 'New Town', 'North Kolkata', 'Park Street'];

  useEffect(() => {
    const init = async () => {
      const p = await getCurrentProfile();
      if (!p) return;
      setProfile(p);

      // Fetch pending game invitations for this user
      const { data: invites } = await supabase
        .from('game_invitations')
        .select('*, session:sessions(*), inviter:profiles!game_invitations_inviter_id_fkey(*)')
        .eq('invitee_id', p.id)
        .eq('status', 'pending');
      setInvitations(invites || []);

      // Fetch friends list
      const { data: accepted } = await supabase
        .from('friendships')
        .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
        .or(`requester_id.eq.${p.id},addressee_id.eq.${p.id}`)
        .eq('status', 'accepted');

      const friendsList = (accepted || []).map(f =>
        f.requester_id === p.id ? f.addressee : f.requester
      );
      setFriends(friendsList);
    };
    init();
  }, []);

  const toggleFriend = (friendId) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const buildPairings = async () => {
    let query = supabase.from('cafes').select('id');
    if (selectedRegion !== 'All Kolkata') {
      query = query.eq('region', selectedRegion);
    }
    const { data: cafes, error: cafeError } = await query;
    if (cafeError) throw cafeError;
    if (!cafes || cafes.length < 2) throw new Error(`Not enough cafes in ${selectedRegion}`);

    const shuffled = [...cafes].sort(() => 0.5 - Math.random());
    const pairings = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length && pairings.length < 5) {
        pairings.push([shuffled[i].id, shuffled[i + 1].id]);
      }
    }
    return pairings;
  };

  const handleBeginSolo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pairings = await buildPairings();
      const { data: session, error: sErr } = await supabase
        .from('sessions')
        .insert({
          mode: 'solo',
          status: 'active',
          current_round: 1,
          max_players: 1,
          region: selectedRegion,
          cafe_pairings: pairings,
          round_started_at: new Date().toISOString(),
        })
        .select().single();
      if (sErr) throw sErr;

      const { data: player, error: pErr } = await supabase
        .from('players')
        .insert({
          session_id: session.id,
          display_name: profile.display_name,
          is_host: true,
          status: 'waiting',
        })
        .select().single();
      if (pErr) throw pErr;

      await supabase.from('sessions').update({ host_player_id: player.id }).eq('id', session.id);
      localStorage.setItem('currentPlayerId', player.id);
      navigate(`/game/${session.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroupGame = async () => {
    if (selectedFriends.length === 0) {
      setError('Select at least one friend!');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const pairings = await buildPairings();
      const { data: session, error: sErr } = await supabase
        .from('sessions')
        .insert({
          mode: 'group',
          status: 'lobby',
          current_round: 0,
          max_players: selectedFriends.length + 1,
          region: selectedRegion,
          cafe_pairings: pairings,
        })
        .select().single();
      if (sErr) throw sErr;

      // Create host player
      const { data: player, error: pErr } = await supabase
        .from('players')
        .insert({
          session_id: session.id,
          display_name: profile.display_name,
          is_host: true,
          status: 'waiting',
        })
        .select().single();
      if (pErr) throw pErr;

      await supabase.from('sessions').update({ host_player_id: player.id }).eq('id', session.id);
      localStorage.setItem('currentPlayerId', player.id);

      // Send invitations
      const invites = selectedFriends.map(friendId => ({
        session_id: session.id,
        inviter_id: profile.id,
        invitee_id: friendId,
        status: 'pending',
      }));
      await supabase.from('game_invitations').insert(invites);

      navigate(`/lobby/${session.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvite = async (invite) => {
    setIsLoading(true);
    try {
      // Update invitation status
      await supabase
        .from('game_invitations')
        .update({ status: 'accepted' })
        .eq('id', invite.id);

      // Create player in session
      const { data: player, error: pErr } = await supabase
        .from('players')
        .insert({
          session_id: invite.session_id,
          display_name: profile.display_name,
          is_host: false,
          status: 'waiting',
        })
        .select().single();
      if (pErr) throw pErr;

      localStorage.setItem('currentPlayerId', player.id);
      navigate(`/lobby/${invite.session_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    await supabase
      .from('game_invitations')
      .update({ status: 'declined' })
      .eq('id', inviteId);
    setInvitations(prev => prev.filter(i => i.id !== inviteId));
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const CrownIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-forest ml-2 inline-block">
      <path d="M2 20h20M4 16l3-7 5 4 5-4 3 7z"/>
    </svg>
  );

  if (!profile) return <div className="min-h-screen flex items-center justify-center font-body italic text-sepia bg-paper">Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col items-center pt-16 px-6 text-center bg-paper relative animate-fade-in pb-12">
      <div className="absolute top-5 right-6 flex items-center gap-4">
        <button onClick={() => navigate('/friends')} className="smallcaps text-sepia text-[9px] tracking-widest border border-sepia/30 px-3 py-1.5 hover:border-sepia transition-colors rounded-full">
          Friends
        </button>
        <button onClick={handleSignOut} className="font-body italic text-sepia text-xs hover:text-ink transition-colors">
          Sign out
        </button>
      </div>
      <div className="absolute top-5 left-6">
        <span className="font-body italic text-sepia text-xs">Hi, {profile.display_name}</span>
      </div>

      <div className="flex items-center justify-center mb-4 mt-4">
        <h1 className="font-display italic text-forest text-5xl tracking-wide">Crown</h1>
        <CrownIcon />
      </div>
      <div className="w-10 h-px bg-sepia/40 mb-4"></div>
      <p className="smallcaps text-sepia text-xs font-semibold tracking-[0.2em] mb-8">Kolkata · ranked by you</p>

      {error && (
        <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3 text-sm font-body mb-6 w-full max-w-md">
          {error}
        </div>
      )}

      {/* ─── Pending Invitations ─── */}
      {invitations.length > 0 && mode === 'home' && (
        <div className="w-full max-w-md mb-10 animate-pop-in">
          <div className="smallcaps text-forest text-[10px] tracking-widest font-bold mb-4">
            🎮 GAME INVITATIONS
          </div>
          <div className="flex flex-col gap-3">
            {invitations.map(inv => (
              <div key={inv.id} className="bg-cream border-2 border-forest/30 rounded-xl px-5 py-4 flex items-center justify-between shadow-sm">
                <div className="text-left">
                  <span className="font-display text-ink text-base">{inv.inviter.display_name}</span>
                  <p className="font-body italic text-sepia text-xs mt-0.5">wants to play · {inv.session.region}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptInvite(inv)}
                    disabled={isLoading}
                    className="smallcaps text-[8px] tracking-widest bg-forest text-cream px-4 py-2 rounded-full font-bold hover:bg-forest/90 transition-colors"
                  >
                    Join
                  </button>
                  <button
                    onClick={() => handleDeclineInvite(inv.id)}
                    className="smallcaps text-[8px] tracking-widest text-sepia border border-sepia/30 px-3 py-2 rounded-full hover:border-sepia transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Home View ─── */}
      {mode === 'home' && (
        <div className="w-full max-w-md flex flex-col items-center animate-pop-in">
          <button
            onClick={handleBeginSolo}
            disabled={isLoading}
            className="bg-forest text-cream font-display text-lg tracking-[0.15em] px-16 py-4 rounded-sm shadow-md transition-transform hover:-translate-y-1 w-64 mb-10"
          >
            {isLoading ? 'LOADING...' : 'BEGIN'}
          </button>

          <p className="font-body italic text-sepia text-sm mb-4">where are we playing?</p>
          <div className="flex gap-2 overflow-x-auto w-full pb-4 px-4 snap-x justify-start no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            {regions.map(region => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`shrink-0 px-4 py-2 text-xs tracking-widest uppercase font-serif border snap-center transition-all ${
                  selectedRegion === region
                    ? 'bg-forest text-cream border-forest shadow-[2px_2px_0px_rgba(107,68,35,1)]'
                    : 'bg-cream text-ink border-sepia/30 hover:border-sepia'
                }`}
              >
                {region}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 w-full max-w-[280px] mt-8">
            <button
              onClick={() => setMode('friend-picker')}
              className="bg-cream text-forest font-serif uppercase tracking-widest text-xs border-2 border-forest py-4 shadow-[3px_3px_0px_rgba(31,77,60,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_rgba(31,77,60,1)] transition-all"
            >
              Play With Friends
            </button>
          </div>
        </div>
      )}

      {/* ─── Friend Picker ─── */}
      {mode === 'friend-picker' && (
        <div className="w-full max-w-md flex flex-col items-center animate-fade-in">
          <h2 className="font-display italic text-forest text-2xl mb-2">Pick your crew</h2>
          <p className="font-body italic text-sepia text-sm mb-6">for <strong>{selectedRegion}</strong></p>

          {friends.length === 0 ? (
            <div className="bg-cream border border-sepia/20 rounded-xl p-8 text-center w-full mb-6">
              <p className="font-body italic text-sepia text-sm mb-4">You haven't added any friends yet!</p>
              <button
                onClick={() => navigate('/friends')}
                className="smallcaps text-[10px] tracking-widest bg-forest text-cream px-6 py-2 rounded-full font-bold"
              >
                Add Friends
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full mb-8">
              {friends.map(friend => {
                const isSelected = selectedFriends.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    onClick={() => toggleFriend(friend.id)}
                    className={`flex items-center gap-4 px-5 py-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'bg-forest/5 border-forest shadow-[2px_2px_0px_rgba(31,77,60,1)]'
                        : 'bg-cream border-sepia/20 hover:border-sepia/40'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs transition-colors ${
                      isSelected ? 'bg-forest border-forest text-cream' : 'border-sepia/40'
                    }`}>
                      {isSelected && '✓'}
                    </div>
                    <div>
                      <span className="font-display text-ink text-base">{friend.display_name}</span>
                      <span className="font-body italic text-sepia text-xs ml-2">@{friend.username}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {friends.length > 0 && (
            <button
              onClick={handleCreateGroupGame}
              disabled={isLoading || selectedFriends.length === 0}
              className="btn-primary w-full max-w-[280px] shadow-md"
            >
              {isLoading ? 'Creating...' : `Start Game (${selectedFriends.length + 1} players)`}
            </button>
          )}

          <button
            onClick={() => { setMode('home'); setSelectedFriends([]); setError(null); }}
            className="mt-6 font-body italic text-sepia hover:text-ink transition-colors underline decoration-dotted text-sm"
          >
            Back to menu
          </button>
        </div>
      )}
    </div>
  );
}

export default Landing;
