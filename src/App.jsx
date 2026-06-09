import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import Landing from './pages/Landing';
import Friends from './pages/Friends';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Ranking from './pages/Ranking';
import Results from './pages/Results';

function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = not logged in

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading state
  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="font-display italic text-forest text-2xl animate-pulse">Crown</div>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return <Auth />;
  }

  // Logged in
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/lobby/:sessionId" element={<Lobby />} />
        <Route path="/game/:sessionId" element={<Game />} />
        <Route path="/ranking/:sessionId" element={<Ranking />} />
        <Route path="/results/:sessionId" element={<Results />} />
      </Routes>
    </Router>
  );
}

export default App;
