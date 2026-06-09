import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

function FriendSearch({ currentUserId, onRequestSent }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState(null);

  const handleSearch = async (q) => {
    setQuery(q);
    setSent(null);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', currentUserId)
      .ilike('username', `%${q.trim()}%`)
      .limit(5);
    setResults(data || []);
    setSearching(false);
  };

  const sendRequest = async (friendId) => {
    const { error } = await supabase.from('friendships').insert({
      requester_id: currentUserId,
      addressee_id: friendId,
      status: 'pending',
    });
    if (error) {
      if (error.code === '23505') {
        setSent('Already sent!');
      } else {
        setSent('Error: ' + error.message);
      }
    } else {
      setSent('Request sent!');
      if (onRequestSent) onRequestSent();
    }
    setResults([]);
    setQuery('');
  };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          className="input-field text-left pl-1"
          placeholder="Search by username..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {searching && <div className="absolute right-2 top-3 text-sepia text-sm animate-pulse">...</div>}
      </div>

      {results.length > 0 && (
        <div className="mt-2 bg-cream border border-sepia/20 rounded-lg overflow-hidden shadow-md">
          {results.map((user) => (
            <div key={user.id} className="flex items-center justify-between px-4 py-3 border-b border-sepia/10 last:border-0">
              <div>
                <span className="font-display text-ink text-base">{user.display_name}</span>
                <span className="font-body italic text-sepia text-xs ml-2">@{user.username}</span>
              </div>
              <button
                onClick={() => sendRequest(user.id)}
                className="smallcaps text-[9px] tracking-widest bg-forest text-cream px-4 py-1.5 rounded-full font-bold hover:bg-forest/90 transition-colors"
              >
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {sent && (
        <p className={`font-body italic text-sm mt-3 ${sent.startsWith('Error') ? 'text-red-500' : 'text-forest'}`}>
          {sent}
        </p>
      )}
    </div>
  );
}

export default FriendSearch;
