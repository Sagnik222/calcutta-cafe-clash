import { useEffect, useMemo, useState } from "react";
import { type Cafe, ROMAN, buildBattles } from "@/lib/cafes";
import { CafeImage } from "@/components/CafeImage";
import { supabase } from "@/lib/supabase";

type Screen = "welcome" | "battle" | "rank" | "result" | "share" | "leaderboard";

export default function App() {
  const [cafes, setCafes] = useState<Cafe[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setCafes(null);
    setLoadError(null);
    supabase
      .from("cafes")
      .select("*")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error("Supabase fetch error:", error);
          setLoadError(error.message);
          return;
        }
        console.log(`${data?.length ?? 0} cafés loaded from Supabase`);
        setCafes((data ?? []) as Cafe[]);
      });
    return () => { alive = false; };
  }, [reloadKey]);

  const cafesById = useMemo(() => {
    const m: Record<string, Cafe> = {};
    (cafes ?? []).forEach((c) => { m[c.id] = c; });
    return m;
  }, [cafes]);

  const [screen, setScreen] = useState<Screen>("welcome");
  const [tab, setTab] = useState<"battle" | "leaderboard">("battle");
  const [battles, setBattles] = useState<[string, string][]>([]);
  const [round, setRound] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [ranked, setRanked] = useState<string[]>([]);

  const goBattle = () => {
    if (!cafes || cafes.length < 10) return;
    const pairs = buildBattles(cafes);
    const byId: Record<string, Cafe> = {};
    cafes.forEach((c) => { byId[c.id] = c; });
    console.log(
      "Battles generated for this session:",
      pairs.map(([a, b]) => `${byId[a]?.name} vs ${byId[b]?.name}`)
    );
    setBattles(pairs);
    setRound(0);
    setPicks([]);
    setRanked([]);
    setTab("battle");
    setScreen("battle");
  };

  const onPick = (cafeId: string) => {
    const next = [...picks, cafeId];
    setPicks(next);
    setTimeout(() => {
      if (next.length >= battles.length) {
        setScreen("rank");
      } else {
        setRound(round + 1);
      }
    }, 600);
  };

  if (loadError) return <ErrorScreen onRetry={() => setReloadKey((k) => k + 1)} />;
  if (!cafes) return <LoadingScreen />;

  const showNav = screen === "battle" || screen === "leaderboard";

  return (
    <div className="min-h-screen bg-paper text-ink font-body" style={{ maxWidth: 430, margin: "0 auto", paddingBottom: showNav ? 72 : 0 }}>
      {screen === "welcome" && <Welcome onBegin={goBattle} />}
      {screen === "battle" && tab === "battle" && battles[round] && (
        <Battle
          key={round}
          a={cafesById[battles[round][0]]}
          b={cafesById[battles[round][1]]}
          round={round}
          onPick={onPick}
        />
      )}
      {screen === "rank" && (
        <RankTopV
          picks={picks.map((id) => cafesById[id])}
          onDone={(order) => { setRanked(order); setScreen("result"); }}
        />
      )}
      {screen === "result" && (
        <Result
          picks={(ranked.length ? ranked : picks).map((id) => cafesById[id])}
          onShare={() => setScreen("share")}
          onAgain={goBattle}
        />
      )}
      {screen === "share" && (
        <SharePreview
          picks={(ranked.length ? ranked : picks).map((id) => cafesById[id])}
          onBack={() => setScreen("result")}
        />
      )}
      {tab === "leaderboard" && (screen === "battle" || screen === "leaderboard") && (
        <Leaderboard cafes={cafes} />
      )}

      {showNav && (
        <BottomNav
          tab={tab}
          onChange={(t) => {
            setTab(t);
            setScreen(t === "battle" ? "battle" : "leaderboard");
          }}
        />
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#F4ECD8" }}>
      <h1 className="font-display italic text-forest" style={{ fontSize: 28, fontWeight: 500 }}>SwipeLeague</h1>
      <p className="font-body italic text-sepia mt-3" style={{ fontSize: 12 }}>preparing the cafés...</p>
      <div className="text-sepia mt-4" style={{ fontSize: 14, letterSpacing: "0.4em" }}>· · ·</div>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: "#F4ECD8" }}>
      <h1 className="font-display italic text-forest" style={{ fontSize: 22, fontWeight: 500 }}>Couldn't reach the cafés</h1>
      <p className="font-body italic text-sepia mt-3" style={{ fontSize: 12 }}>Check your connection and try again.</p>
      <button
        onClick={onRetry}
        className="mt-6 smallcaps"
        style={{ background: "#1F4D3C", color: "#FBF6E9", padding: "12px 36px", borderRadius: 4, fontSize: 11, letterSpacing: "0.22em" }}
      >
        Retry
      </button>
    </div>
  );
}

function Welcome({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="min-h-screen flex flex-col px-8 pt-6 relative">
      <div className="absolute top-5 right-6 smallcaps text-sepia" style={{ fontSize: 9 }}>Est. 2026</div>
      <div className="flex-1 flex flex-col items-center justify-center text-center -mt-12">
        <h1 className="font-display italic text-forest" style={{ fontSize: 38, fontWeight: 500, lineHeight: 1.1 }}>SwipeLeague</h1>
        <div className="hairline mt-5" style={{ width: 32 }} />
        <div className="smallcaps text-sepia mt-5" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Kolkata · Ranked by You</div>
        <button
          onClick={onBegin}
          className="mt-14 smallcaps text-cream"
          style={{ background: "#1F4D3C", color: "#FBF6E9", padding: "14px 56px", borderRadius: 4, fontSize: 12, letterSpacing: "0.2em", transition: "all 200ms" }}
        >
          Begin
        </button>
        <p className="font-body italic text-sepia mt-6" style={{ fontSize: 13 }}>Five rounds. South Kolkata cafés.</p>
      </div>
      <div className="text-center text-sepia pb-8" style={{ fontSize: 14, letterSpacing: "0.4em" }}>· · ·</div>
    </div>
  );
}

function Battle({ a, b, round, onPick }: { a: Cafe; b: Cafe; round: number; onPick: (id: string) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const handle = (id: string) => {
    if (chosen) return;
    setChosen(id);
    onPick(id);
  };
  return (
    <div className="px-6 pt-8 pb-6 flex flex-col" style={{ minHeight: "calc(100vh - 72px)" }}>
      <div>
        <div className="smallcaps text-sepia" style={{ fontSize: 10, letterSpacing: "0.15em" }}>Round {ROMAN[round]} of V</div>
        <div className="text-sepia mt-2" style={{ fontSize: 14, letterSpacing: "0.4em" }}>· · ·</div>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-4 py-6">
        <CafeCard cafe={a} chosen={chosen === a.id} dim={chosen !== null && chosen !== a.id} onClick={() => handle(a.id)} />
        <div className="text-center font-display italic text-sepia" style={{ fontSize: 16 }}>— or —</div>
        <CafeCard cafe={b} chosen={chosen === b.id} dim={chosen !== null && chosen !== b.id} onClick={() => handle(b.id)} />
      </div>
      <button
        disabled={!chosen}
        onClick={() => chosen && handle(chosen)}
        className="smallcaps text-cream w-full"
        style={{ background: "#1F4D3C", color: "#FBF6E9", padding: "13px 0", borderRadius: 4, fontSize: 11, letterSpacing: "0.22em", opacity: chosen ? 1 : 0.55, transition: "opacity 200ms" }}
      >
        Cast Your Vote
      </button>
    </div>
  );
}

function CafeCard({ cafe, chosen, dim, onClick }: { cafe: Cafe; chosen: boolean; dim: boolean; onClick: () => void }) {
  const vibe = cafe.vibe_tags?.join(" · ") ?? "";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-[6px] overflow-hidden block ${chosen ? "card-selected pulse-once" : "card-unselected"}`}
      style={{ background: "#FBF6E9", opacity: dim ? 0.5 : 1, transition: "opacity 250ms, transform 200ms", outline: "none" }}
    >
      <CafeCardImage cafe={cafe} />
      <div style={{ padding: 16 }}>
        <div className="font-display text-ink" style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.2 }}>{cafe.name}</div>
        <div className="font-body italic text-sepia mt-1" style={{ fontSize: 12 }}>{cafe.neighborhood}</div>
        {cafe.short_description && (
          <div
            className="font-body italic text-sepia mt-2"
            style={{ fontSize: 11, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {cafe.short_description}
          </div>
        )}
        {cafe.well_known_for && cafe.well_known_for.length > 0 && (
          <div className="mt-2" style={{ fontSize: 10, color: "#6B4423", fontFamily: "Georgia, serif", lineHeight: 1.4 }}>
            <span className="italic">Known for: </span>
            {cafe.well_known_for.map((k, i) => (
              <span key={i}>
                <span className="dotted-under">{k}</span>
                {i < cafe.well_known_for!.length - 1 && <span> · </span>}
              </span>
            ))}
          </div>
        )}
        {vibe && (
          <div className="mt-2 inline-block">
            <span className="dotted-under" style={{ color: "#6B4423", fontSize: 10, fontFamily: "Georgia, serif" }}>{vibe}</span>
          </div>
        )}
      </div>
    </button>
  );
}

function CafeCardImage({ cafe }: { cafe: Cafe }) {
  const [err, setErr] = useState(false);
  if (err || !cafe.image_url) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: 160, background: "#6B4423" }}>
        <span className="font-display italic" style={{ fontSize: 56, color: "#FBF6E9" }}>{cafe.name[0]}</span>
      </div>
    );
  }
  return (
    <img
      src={cafe.image_url}
      onError={() => setErr(true)}
      alt={cafe.name}
      className="w-full object-cover block"
      style={{ height: 160, filter: "saturate(0.75) sepia(0.08)" }}
    />
  );
}

function Result({ picks, onShare, onAgain }: { picks: Cafe[]; onShare: () => void; onAgain: () => void }) {
  return (
    <div className="px-6 pt-10 pb-10">
      <div className="smallcaps" style={{ fontSize: 9, letterSpacing: "2.5px", color: "#8B6F47", marginBottom: 4 }}>Final Ranking</div>
      <h2 className="font-display text-forest" style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.2 }}>Your South Kolkata Top V</h2>
      <div className="hairline mt-4" style={{ width: 32 }} />

      <ol className="mt-7 space-y-5">
        {picks.map((c, i) => {
          const known = c.well_known_for?.[i % (c.well_known_for.length || 1)];
          return (
            <li key={c.id} className="flex items-start gap-4">
              <div className="font-display text-ink" style={{ fontSize: 20, width: 28, textAlign: "center", lineHeight: 1.2 }}>{ROMAN[i]}</div>
              <CafeImage cafe={c} size={48} />
              <div className="flex-1 min-w-0">
                <div className="font-display text-ink" style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                <div className="font-body italic text-sepia" style={{ fontSize: 11 }}>{c.neighborhood}</div>
                {known && (
                  <div style={{ fontSize: 10, color: "#6B4423", fontFamily: "Georgia, serif", marginTop: 2 }}>
                    <span className="italic">known for </span>
                    <span className="dotted-under">{known}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 space-y-3">
        <button onClick={onShare} className="smallcaps w-full" style={{ background: "#1F4D3C", color: "#FBF6E9", padding: "13px 0", borderRadius: 4, fontSize: 11, letterSpacing: "0.22em" }}>Share This Ranking</button>
        <button onClick={onAgain} className="smallcaps w-full" style={{ background: "transparent", color: "#8B6F47", padding: "12px 0", borderRadius: 4, fontSize: 11, letterSpacing: "0.22em", border: "0.5px solid #8B6F47" }}>Play Again</button>
      </div>
    </div>
  );
}

function SharePreview({ picks, onBack }: { picks: Cafe[]; onBack: () => void }) {
  return (
    <div className="px-5 pt-6 pb-10">
      <div className="mx-auto" style={{ aspectRatio: "9 / 16", background: "#F4ECD8", padding: "28px 22px", borderRadius: 6, border: "0.5px solid rgba(139,111,71,0.4)", display: "flex", flexDirection: "column" }}>
        <div className="smallcaps text-sepia" style={{ fontSize: 9, letterSpacing: "0.25em" }}>Est. 2026</div>
        <h2 className="font-display italic text-ink mt-3" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.1 }}>My Kolkata Top V</h2>
        <div className="smallcaps text-sepia mt-2" style={{ fontSize: 9, letterSpacing: "0.22em" }}>A SwipeLeague ranking</div>
        <div className="hairline mt-3" style={{ width: 32 }} />
        <ol className="mt-4 space-y-3 flex-1">
          {picks.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3">
              <div className="font-display text-forest" style={{ fontSize: 16, width: 22, textAlign: "center" }}>{ROMAN[i]}</div>
              <CafeImage cafe={c} size={32} />
              <div className="flex-1 min-w-0">
                <div className="font-display text-ink truncate" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>{c.name}</div>
                <div className="font-body italic text-sepia" style={{ fontSize: 10 }}>{c.neighborhood}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="hairline mt-4" style={{ width: "100%" }} />
        <div className="smallcaps text-sepia text-center mt-3" style={{ fontSize: 9, letterSpacing: "0.22em" }}>SwipeLeague · Kolkata, ranked by you</div>
      </div>
      <button className="smallcaps w-full mt-6" onClick={() => alert("In a real build this would download the card as an image.")} style={{ background: "#1F4D3C", color: "#FBF6E9", padding: "13px 0", borderRadius: 4, fontSize: 11, letterSpacing: "0.22em" }}>Download Image</button>
      <button onClick={onBack} className="font-body italic text-sepia w-full mt-3 text-center" style={{ fontSize: 13, background: "transparent" }}>Back</button>
    </div>
  );
}

function Leaderboard({ cafes }: { cafes: Cafe[] }) {
  const sorted = [...cafes].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="px-6 pt-10 pb-6">
      <div className="smallcaps text-sepia" style={{ fontSize: 10, letterSpacing: "0.2em" }}>The Roster</div>
      <h2 className="font-display text-ink mt-2" style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.2 }}>Cafés in the league</h2>
      <div className="font-body italic text-sepia mt-1" style={{ fontSize: 13 }}>South Kolkata · alphabetical</div>
      <div className="hairline mt-4" style={{ width: 32 }} />
      <ul className="mt-5">
        {sorted.map((c, i) => (
          <li key={c.id}>
            <div className="flex items-center gap-4 py-4">
              <div className="font-display text-ink" style={{ fontSize: 18, width: 30, textAlign: "center" }}>{ROMAN[i] ?? i + 1}</div>
              <CafeImage cafe={c} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-display text-ink" style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                <div className="font-body italic text-sepia" style={{ fontSize: 11 }}>{c.neighborhood}</div>
              </div>
              <div className="smallcaps text-sepia" style={{ fontSize: 10, letterSpacing: "0.15em" }}>{c.total_wins ?? 0} wins</div>
            </div>
            {i < sorted.length - 1 && <div className="hairline" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BottomNav({ tab, onChange }: { tab: "battle" | "leaderboard"; onChange: (t: "battle" | "leaderboard") => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 mx-auto" style={{ maxWidth: 430, background: "#FBF6E9", borderTop: "0.5px solid rgba(139,111,71,0.4)", display: "flex", padding: "14px 0 18px" }}>
      {(["battle", "leaderboard"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="smallcaps flex-1"
          style={{ color: tab === t ? "#1F4D3C" : "#8B6F47", fontSize: 11, letterSpacing: "0.22em", background: "transparent", fontWeight: tab === t ? 600 : 400 }}
        >
          {t}
        </button>
      ))}
    </nav>
  );
}

function RankTopV({ picks, onDone }: { picks: Cafe[]; onDone: (order: string[]) => void }) {
  const [order, setOrder] = useState<string[]>([]);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const handleTap = (id: string) => {
    const idx = order.indexOf(id);
    let next: string[];
    if (idx >= 0) {
      next = order.filter((x) => x !== id);
    } else {
      if (order.length >= 5) return;
      next = [...order, id];
      setPulseId(id);
      setTimeout(() => setPulseId(null), 150);
    }
    setOrder(next);
    if (next.length === 5) setTimeout(() => onDone(next), 600);
  };

  return (
    <div className="px-6 pt-8 pb-10">
      <div className="smallcaps" style={{ fontSize: 9, letterSpacing: "2.5px", color: "#8B6F47", marginBottom: 4 }}>Step Two of Two</div>
      <h2 className="font-display italic text-forest" style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.15 }}>Now crown them.</h2>
      <p className="font-body italic text-ink mt-2" style={{ fontSize: 13 }}>Tap in order of preference. Favorite first.</p>
      <div className="hairline mt-4" style={{ width: 32 }} />
      <div className="smallcaps text-sepia mt-4" style={{ fontSize: 10, letterSpacing: "1.5px" }}>{order.length} of 5 ranked</div>

      <ul className="mt-6 space-y-2">
        {picks.map((cafe) => {
          const rankIdx = order.indexOf(cafe.id);
          const ranked = rankIdx >= 0;
          return (
            <li key={cafe.id}>
              <button
                onClick={() => handleTap(cafe.id)}
                className="w-full text-left rounded-[6px] flex items-start gap-3"
                style={{
                  background: "#FBF6E9",
                  padding: 12,
                  border: ranked ? "1.5px solid #1F4D3C" : "0.5px solid rgba(139,111,71,0.4)",
                  boxShadow: ranked ? "2px 2px 0 #1F4D3C" : "none",
                  outline: "none",
                  transform: pulseId === cafe.id ? "scale(1.02)" : "scale(1)",
                  transition: "transform 100ms ease-out",
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: ranked ? "#1F4D3C" : "transparent",
                    border: ranked ? "none" : "0.5px solid #8B6F47",
                    transition: "background 200ms", marginTop: 2,
                  }}
                >
                  {ranked && (
                    <span className="font-display" style={{ color: "#FBF6E9", fontSize: 18, fontWeight: 500, lineHeight: 1, animation: "fadeIn 200ms ease-out" }}>
                      {ROMAN[rankIdx]}
                    </span>
                  )}
                </div>
                <CafeImage cafe={cafe} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="font-display text-ink" style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.2 }}>{cafe.name}</div>
                  <div className="font-body italic text-sepia" style={{ fontSize: 11 }}>{cafe.neighborhood}</div>
                  {cafe.short_description && (
                    <div className="font-body italic text-sepia mt-1" style={{ fontSize: 10.5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {cafe.short_description}
                    </div>
                  )}
                  {cafe.well_known_for && cafe.well_known_for.length > 0 && (
                    <div className="mt-1" style={{ fontSize: 9.5, color: "#6B4423", fontFamily: "Georgia, serif", lineHeight: 1.4 }}>
                      <span className="italic">Known for: </span>
                      {cafe.well_known_for.map((k, i) => (
                        <span key={i}>
                          <span className="dotted-under">{k}</span>
                          {i < cafe.well_known_for!.length - 1 && <span> · </span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="font-body italic text-center mt-8" style={{ fontSize: 12, color: "#8B6F47" }}>Tap a ranked café to undo.</p>
    </div>
  );
}
