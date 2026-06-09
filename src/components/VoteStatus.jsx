import React from 'react';

function VoteStatus({ players }) {
  const totalPlayers = players.length;
  const votedPlayers = players.filter(p => p.current_round_voted).length;
  const isComplete = votedPlayers === totalPlayers;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 animate-fade-in">
      <div className="bg-cream/90 backdrop-blur-md p-5 rounded-2xl border border-sepia/20 shadow-xl">
        <div className="text-center mb-4">
          <span className={`smallcaps tracking-widest font-bold text-xs ${isComplete ? 'text-forest' : 'text-sepia'}`}>
            {isComplete 
              ? "Round Complete! Advancing..." 
              : `Waiting for votes (${votedPlayers}/${totalPlayers})`}
          </span>
        </div>
        
        <div className="flex flex-wrap justify-center gap-3">
          {players.map(p => (
            <div 
              key={p.id} 
              className={`px-4 py-2 rounded-full text-sm font-body italic flex items-center gap-2 transition-colors ${
                p.current_round_voted 
                  ? 'bg-forest/10 text-forest border border-forest/30' 
                  : 'bg-paper text-sepia border border-sepia/20'
              }`}
            >
              <span className="truncate max-w-[100px]">{p.display_name}</span>
              <span className="text-xs font-sans not-italic">{p.current_round_voted ? '✓' : '○'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VoteStatus;
