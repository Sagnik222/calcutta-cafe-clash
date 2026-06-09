import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getCurrentProfile } from '../lib/auth';
import FriendSearch from '../components/FriendSearch';
import ContactPicker from '../components/ContactPicker';

function Friends() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [pendingIncoming, setPendingIncoming] = useState([]);
  const [pendingOutgoing, setPendingOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = async () => {
    const p = await getCurrentProfile();
    if (!p) return;
    setProfile(p);

    // Accepted friendships
    const { data: accepted } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${p.id},addressee_id.eq.${p.id}`)
      .eq('status', 'accepted');

    const friendsList = (accepted || []).map(f =>
      f.requester_id === p.id ? f.addressee : f.requester
    );
    setFriends(friendsList);

    // Pending incoming
    const { data: incoming } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*)')
      .eq('addressee_id', p.id)
      .eq('status', 'pending');
    setPendingIncoming(incoming || []);

    // Pending outgoing
    const { data: outgoing } = await supabase
      .from('friendships')
      .select('*, addressee:profiles!friendships_addressee_id_fkey(*)')
      .eq('requester_id', p.id)
      .eq('status', 'pending');
    setPendingOutgoing(outgoing || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const acceptRequest = async (friendshipId) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    fetchFriends();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-body italic text-sepia bg-paper">Loading friends...</div>;
  }

  return (
    <div className="min-h-screen px-6 pt-12 pb-20 bg-paper animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/')} className="font-body italic text-sepia hover:text-ink transition-colors text-sm">
          ← Back
        </button>
        <div className="text-right">
          <span className="font-body italic text-sepia text-sm">@{profile?.username}</span>
        </div>
      </div>

      <h1 className="font-display italic text-forest text-3xl mb-8">Your Friends</h1>

      {/* Add friends area */}
      <div className="mb-10 flex flex-col gap-6">
        <div>
          <div className="smallcaps text-sepia text-[10px] tracking-widest font-bold mb-3">ADD FROM CONTACTS</div>
          <ContactPicker currentUserId={profile?.id} onFriendsFound={fetchFriends} />
        </div>
        
        <div>
          <div className="smallcaps text-sepia text-[10px] tracking-widest font-bold mb-3">ADD BY USERNAME</div>
          <FriendSearch currentUserId={profile?.id} onRequestSent={fetchFriends} />
        </div>
      </div>

      {/* Pending Incoming */}
      {pendingIncoming.length > 0 && (
        <div className="mb-10">
          <div className="smallcaps text-sepia text-[10px] tracking-widest font-bold mb-4">FRIEND REQUESTS</div>
          <div className="flex flex-col gap-3">
            {pendingIncoming.map(req => (
              <div key={req.id} className="bg-cream border border-forest/20 rounded-lg px-5 py-4 flex items-center justify-between shadow-sm">
                <div>
                  <span className="font-display text-ink text-base">{req.requester.display_name}</span>
                  <span className="font-body italic text-sepia text-xs ml-2">@{req.requester.username}</span>
                </div>
                <button
                  onClick={() => acceptRequest(req.id)}
                  className="smallcaps text-[9px] tracking-widest bg-forest text-cream px-5 py-2 rounded-full font-bold hover:bg-forest/90 transition-colors"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Outgoing */}
      {pendingOutgoing.length > 0 && (
        <div className="mb-10">
          <div className="smallcaps text-sepia text-[10px] tracking-widest font-bold mb-4">SENT REQUESTS</div>
          <div className="flex flex-col gap-3">
            {pendingOutgoing.map(req => (
              <div key={req.id} className="bg-cream/50 border border-sepia/15 rounded-lg px-5 py-4 flex items-center justify-between">
                <div>
                  <span className="font-display text-ink/70 text-base">{req.addressee.display_name}</span>
                  <span className="font-body italic text-sepia text-xs ml-2">@{req.addressee.username}</span>
                </div>
                <span className="font-body italic text-sepia text-xs">Pending...</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div>
        <div className="smallcaps text-sepia text-[10px] tracking-widest font-bold mb-4">
          {friends.length > 0 ? `YOUR CREW · ${friends.length}` : 'NO FRIENDS YET'}
        </div>
        {friends.length === 0 ? (
          <p className="font-body italic text-sepia text-sm">Search for a username above to add your first friend!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {friends.map(friend => (
              <div key={friend.id} className="bg-cream border border-sepia/10 rounded-lg px-5 py-4 flex items-center gap-4 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-forest animate-pulse"></div>
                <div>
                  <span className="font-display text-ink text-base">{friend.display_name}</span>
                  <span className="font-body italic text-sepia text-xs ml-2">@{friend.username}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Friends;
