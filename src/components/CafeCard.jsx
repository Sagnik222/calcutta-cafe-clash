import React, { useState, useEffect } from 'react';

function CafeCard({ cafe, onVote, disabled }) {
  const [showReviews, setShowReviews] = useState(false);

  useEffect(() => {
    if (showReviews) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showReviews]);

  if (!cafe) return null;

  return (
    <>
      <div 
        className={`card flex flex-col w-full max-w-sm mx-auto overflow-hidden animate-pop-in ${disabled ? 'opacity-80 pointer-events-none' : ''} card-unselected cursor-pointer`}
        onClick={!disabled ? onVote : undefined}
      >
        <div className="h-64 w-full bg-sepia/10 relative">
          {cafe.image_url ? (
            <img src={cafe.image_url} alt={cafe.name} className="w-full h-full object-cover shrink-0" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-display italic text-sepia">No Image</div>
          )}
          {cafe.google_rating && (
            <div 
              className="absolute top-3 right-3 bg-cream/90 backdrop-blur text-forest px-3 py-1.5 rounded shadow-md text-sm font-bold flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowReviews(true);
              }}
            >
              <span>★</span>
              <span>{cafe.google_rating}</span>
            </div>
          )}
        </div>
        
        <div className="p-6 flex flex-col flex-1 bg-cream">
          <h3 className="font-display text-2xl text-ink mb-1">{cafe.name}</h3>
          <p className="font-body italic text-sepia text-sm mb-4">
            {cafe.neighborhood}, {cafe.region}
          </p>
          
          <p className="font-body text-ink/80 text-sm mb-6 line-clamp-3 leading-relaxed">
            {cafe.short_description}
          </p>

          {cafe.well_known_for && cafe.well_known_for.length > 0 && (
            <div className="mt-auto">
              <div className="smallcaps text-sepia mb-3 text-[10px] tracking-widest font-semibold">KNOWN FOR</div>
              <div className="flex flex-wrap gap-2">
                {cafe.well_known_for.map((tag, i) => (
                  <span key={i} className="text-xs font-body italic text-walnut bg-sepia/5 border border-sepia/20 px-3 py-1.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <button 
          className="w-full py-5 font-display italic text-xl tracking-wide bg-forest text-cream transition-colors hover:bg-forest/90"
          disabled={disabled}
        >
          Vote for {cafe.name}
        </button>
      </div>

      {showReviews && (
        <div 
          className="fixed inset-0 z-[100] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowReviews(false)}
        >
          <div 
            className="bg-paper w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-forest p-6 text-center relative">
              <h3 className="font-display italic text-3xl text-cream mb-2">{cafe.name}</h3>
              <div className="flex items-center justify-center gap-2 text-cream font-body">
                <span className="text-xl">★ {cafe.google_rating}</span>
                <span className="opacity-70 text-sm">({cafe.google_review_count} reviews)</span>
              </div>
              <button 
                onClick={() => setShowReviews(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-cream/10 text-cream hover:bg-cream/20 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              
              {/* Detailed Info Section */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-sepia/5 p-4 rounded-lg border border-sepia/10">
                <div className="flex-1">
                  <div className="smallcaps text-forest text-[10px] tracking-widest font-bold mb-1">LOCATION</div>
                  <p className="font-body text-ink text-sm mb-3">{cafe.neighborhood}, {cafe.region}</p>
                  
                  <div className="smallcaps text-forest text-[10px] tracking-widest font-bold mb-1">HOURS</div>
                  <p className="font-body text-ink text-sm">
                    {cafe.operating_hours || 'Usually 10:00 AM - 10:00 PM'}
                  </p>
                </div>
                <div className="flex flex-col justify-center sm:border-l border-sepia/20 sm:pl-4">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name + ' ' + cafe.neighborhood + ' Kolkata')}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-forest text-cream font-serif uppercase tracking-widest text-[10px] px-5 py-3 rounded hover:bg-forest/90 transition-colors shadow-sm"
                  >
                    <span>🗺️</span> Get Directions
                  </a>
                </div>
              </div>

              <div className="smallcaps text-sepia mb-6 text-center text-xs tracking-widest font-bold">What people are saying</div>
              <div className="space-y-4">
                {cafe.google_reviews && cafe.google_reviews.length > 0 ? (
                  cafe.google_reviews.map((review, i) => (
                    <div key={i} className="bg-cream border border-sepia/20 p-5 rounded-lg relative">
                      <div className="absolute top-3 left-3 text-4xl text-sepia/20 font-serif leading-none">"</div>
                      <p className="font-body italic text-ink/90 text-sm leading-relaxed relative z-10 pl-4 pt-2">
                        {review}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center font-body italic text-sepia py-8">No reviews available for this café.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CafeCard;
