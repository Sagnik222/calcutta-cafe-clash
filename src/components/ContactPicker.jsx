import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

function ContactPicker({ currentUserId, onFriendsFound }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(new Set());

  const isSupported = 'contacts' in navigator && 'ContactsManager' in window;

  const normalizePhone = (phone) => {
    // Strip all non-digits
    let digits = phone.replace(/\D/g, '');
    // Handle Indian numbers: if starts with 91 and is 12 digits, strip 91
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    }
    // If 10 digits, add +91
    if (digits.length === 10) {
      return '+91' + digits;
    }
    // Otherwise return with + prefix
    return '+' + digits;
  };

  const handlePickContacts = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const contacts = await navigator.contacts.select(
        ['name', 'tel'],
        { multiple: true }
      );

      if (!contacts || contacts.length === 0) {
        setLoading(false);
        return;
      }

      // Extract and normalize all phone numbers
      const phoneMap = {};
      contacts.forEach(contact => {
        const name = contact.name?.[0] || 'Unknown';
        (contact.tel || []).forEach(tel => {
          const normalized = normalizePhone(tel);
          phoneMap[normalized] = name;
        });
      });

      const phoneNumbers = Object.keys(phoneMap);

      if (phoneNumbers.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Search for matching profiles
      const { data: matches } = await supabase
        .from('profiles')
        .select('*')
        .in('phone', phoneNumbers)
        .neq('id', currentUserId);

      // Also check for existing friendships
      const { data: existingFriendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

      const friendIds = new Set();
      (existingFriendships || []).forEach(f => {
        friendIds.add(f.requester_id);
        friendIds.add(f.addressee_id);
      });

      const matchesWithStatus = (matches || []).map(m => ({
        ...m,
        contactName: phoneMap[m.phone] || m.display_name,
        alreadyFriend: friendIds.has(m.id),
      }));

      setResults(matchesWithStatus);
      if (onFriendsFound) onFriendsFound(matchesWithStatus);
    } catch (err) {
      if (err.name === 'InvalidStateError' || err.message?.includes('not supported')) {
        setError('Contacts access is not supported in this browser. Try Chrome on Android.');
      } else if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (friendId) => {
    const { error: err } = await supabase.from('friendships').insert({
      requester_id: currentUserId,
      addressee_id: friendId,
      status: 'pending',
    });
    if (!err) {
      setSent(prev => new Set([...prev, friendId]));
    }
  };

  // Fallback: manual phone number input
  const [manualPhone, setManualPhone] = useState('');
  const [manualResults, setManualResults] = useState(null);
  const [manualSearching, setManualSearching] = useState(false);

  const handleManualSearch = async () => {
    if (!manualPhone.trim()) return;
    setManualSearching(true);
    setManualResults(null);

    const normalized = normalizePhone(manualPhone);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalized)
      .neq('id', currentUserId);

    setManualResults(data || []);
    setManualSearching(false);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Crown',
      text: 'Rank cafes in Kolkata with me on Crown!',
      url: 'https://calcutta-cafe-clash.vercel.app',
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.log('Error sharing:', err);
    }
  };

  return (
    <div className="w-full">
      {/* Contact Picker Button */}
      {isSupported && (
        <button
          onClick={handlePickContacts}
          disabled={loading}
          className="w-full bg-cream text-forest font-serif uppercase tracking-widest text-[10px] border-2 border-forest py-3.5 shadow-[2px_2px_0px_rgba(31,77,60,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(31,77,60,1)] transition-all flex items-center justify-center gap-3 mb-4"
        >
          <span className="text-base">📱</span>
          {loading ? 'Searching contacts...' : 'Add from Contacts'}
        </button>
      )}

      {/* Manual phone search fallback */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <input
            className="input-field text-left pl-1"
            placeholder="Or enter phone number..."
            value={manualPhone}
            onChange={e => setManualPhone(e.target.value)}
            type="tel"
          />
        </div>
        <button
          onClick={handleManualSearch}
          disabled={manualSearching || !manualPhone.trim()}
          className="shrink-0 smallcaps text-[9px] tracking-widest bg-forest text-cream px-5 py-2.5 font-bold hover:bg-forest/90 transition-colors disabled:opacity-40 mb-[1px]"
        >
          {manualSearching ? '...' : 'Find'}
        </button>
      </div>

      {error && (
        <p className="font-body italic text-red-500 text-sm mt-3">{error}</p>
      )}

      {/* Contact Picker Results */}
      {results !== null && (
        <div className="mt-5">
          {results.length === 0 ? (
            <div className="bg-cream/50 border border-sepia/20 rounded-lg p-5 text-center">
              <p className="font-body italic text-sepia text-sm">None of your selected contacts are on Crown yet.</p>
              <button 
                onClick={handleShare}
                className="mt-4 bg-forest text-cream font-serif uppercase tracking-widest text-[10px] px-6 py-2 rounded-full hover:bg-forest/90 transition-colors"
              >
                Invite them to join!
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="smallcaps text-forest text-[10px] tracking-widest font-bold mb-1">
                {results.length} CONTACT{results.length > 1 ? 'S' : ''} FOUND ON CROWN
              </div>
              {results.map(user => (
                <div key={user.id} className="bg-cream border border-sepia/20 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="font-display text-ink text-sm">{user.display_name}</span>
                    <span className="font-body italic text-sepia text-xs ml-2">@{user.username}</span>
                    {user.contactName !== user.display_name && (
                      <span className="font-body text-sepia/50 text-[10px] ml-1">({user.contactName})</span>
                    )}
                  </div>
                  {user.alreadyFriend ? (
                    <span className="font-body italic text-forest text-xs">✓ Friends</span>
                  ) : sent.has(user.id) ? (
                    <span className="font-body italic text-sepia text-xs">Sent ✓</span>
                  ) : (
                    <button
                      onClick={() => sendRequest(user.id)}
                      className="smallcaps text-[8px] tracking-widest bg-forest text-cream px-4 py-1.5 rounded-full font-bold hover:bg-forest/90 transition-colors"
                    >
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Search Results */}
      {manualResults !== null && (
        <div className="mt-4">
          {manualResults.length === 0 ? (
            <p className="font-body italic text-sepia text-sm text-center py-3">No user found with that phone number.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {manualResults.map(user => (
                <div key={user.id} className="bg-cream border border-sepia/20 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="font-display text-ink text-sm">{user.display_name}</span>
                    <span className="font-body italic text-sepia text-xs ml-2">@{user.username}</span>
                  </div>
                  {sent.has(user.id) ? (
                    <span className="font-body italic text-sepia text-xs">Sent ✓</span>
                  ) : (
                    <button
                      onClick={() => sendRequest(user.id)}
                      className="smallcaps text-[8px] tracking-widest bg-forest text-cream px-4 py-1.5 rounded-full font-bold hover:bg-forest/90 transition-colors"
                    >
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ContactPicker;
