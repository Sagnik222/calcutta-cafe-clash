import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Crown as CrownIcon } from "lucide-react";

function BrandTitle({ size }: { size: number }) {
  return (
    <h1
      className="font-display italic text-forest flex items-center justify-center"
      style={{ fontSize: size, fontWeight: 500, lineHeight: 1.1, gap: size * 0.25 }}
    >
      <span>Crown</span>
      <CrownIcon style={{ width: size * 0.85, height: size * 0.85, color: "#1F4D3C" }} strokeWidth={1.75} />
    </h1>
  );
}
import { type Cafe, ROMAN, REGIONS, type Region, buildBattles, roundsForCount, numWord } from "@/lib/cafes";
import { CafeImage } from "@/components/CafeImage";
import { supabase } from "@/lib/supabase";

type Screen =
  | "welcome"
  | "battle"
  | "rank"
  | "result"
  | "share"
  | "leaderboard"
  | "mp-host-name"
  | "mp-host-region"
  | "mp-join"
  | "mp-lobby"
  | "mp-battle"
  | "mp-rank"
  | "mp-waiting-rank"
  | "mp-result"
  | "mp-share";

type MPSession = {
  id: string;
  join_code: string;
  region: string | null;
  status: string;
  host_player_id: string | null;
  max_players: number | null;
  current_round: number | null;
  round_started_at?: string | null;
  cafe_pairings?: [string, string][] | null;
  collective_ranking?: string[] | null;
};
type MPPlayer = {
  id: string;
  session_id: string;
  display_name: string;
  is_host: boolean;
  joined_at: string | null;
  last_seen_at?: string | null;
  status: string | null;
  individual_ranking?: string[] | null;
};
type MPVote = {
  id: string;
  session_id: string;
  player_id: string;
  round_number: number;
  cafe_id: string;
  is_abstain: boolean | null;
};

const LS_KEY = "crown_mp_session";

function genCode(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

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
      .eq("is_published", true)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error("Supabase fetch error:", error);
          setLoadError(error.message);
          return;
        }
        const list = (data ?? []) as Cafe[];
        console.log(`Total published cafés: ${list.length}`);
        const perRegion: Record<string, number> = {};
        list.forEach((c) => {
          const r = c.region ?? "Unknown";
          perRegion[r] = (perRegion[r] ?? 0) + 1;
        });
        console.log("Cafés per region:", perRegion);
        setCafes(list);
      });
    return () => { alive = false; };
  }, [reloadKey]);

  const cafesById = useMemo(() => {
    const m: Record<string, Cafe> = {};
    (cafes ?? []).forEach((c) => { m[c.id] = c; });
    return m;
  }, [cafes]);

  const regionCounts = useMemo(() => {
    const m: Record<string, number> = {};
    (cafes ?? []).forEach((c) => {
      const r = c.region ?? "Unknown";
      m[r] = (m[r] ?? 0) + 1;
    });
    return m;
  }, [cafes]);

  const [region, setRegion] = useState<Region>("All Kolkata");
  const [screen, setScreen] = useState<Screen>("welcome");
  const [tab, setTab] = useState<"battle" | "leaderboard">("battle");
  const [battles, setBattles] = useState<[string, string][]>([]);
  const [round, setRound] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [ranked, setRanked] = useState<string[]>([]);

  // multiplayer state
  const [mpName, setMpName] = useState("");
  const [mpRegion, setMpRegion] = useState<Region>("All Kolkata");
  const [mpSession, setMpSession] = useState<MPSession | null>(null);
  const [mpPlayer, setMpPlayer] = useState<MPPlayer | null>(null);
  const [mpPlayers, setMpPlayers] = useState<MPPlayer[]>([]);
  const [mpVotes, setMpVotes] = useState<MPVote[]>([]); // votes for current round
  const [mpReconnecting, setMpReconnecting] = useState(false);

  // refs for stable handlers in realtime callbacks
  const mpSessionRef = useRef<MPSession | null>(null);
  const mpPlayerRef = useRef<MPPlayer | null>(null);
  const mpPlayersRef = useRef<MPPlayer[]>([]);
  const mpVotesRef = useRef<MPVote[]>([]);
  const cafesRef = useRef<Cafe[] | null>(null);
  useEffect(() => { mpSessionRef.current = mpSession; }, [mpSession]);
  useEffect(() => { mpPlayerRef.current = mpPlayer; }, [mpPlayer]);
  useEffect(() => { mpPlayersRef.current = mpPlayers; }, [mpPlayers]);
  useEffect(() => { mpVotesRef.current = mpVotes; }, [mpVotes]);
  useEffect(() => { cafesRef.current = cafes; }, [cafes]);


  const goBattle = () => {
    if (!cafes) return;
    const pool = region === "All Kolkata" ? cafes : cafes.filter((c) => c.region === region);
    const rounds = roundsForCount(pool.length);
    if (rounds === 0) return;
    const pairs = buildBattles(pool, rounds);
    const byId: Record<string, Cafe> = {};
    pool.forEach((c) => { byId[c.id] = c; });
    console.log(
      `Starting session — region: ${region}, rounds: ${rounds}, cafés:`,
      pairs.flatMap(([a, b]) => [byId[a]?.name, byId[b]?.name]),
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

  const refreshLobby = async (sessionId: string): Promise<MPSession | null> => {
    const [{ data: sess }, { data: pls }] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
      supabase.from("players").select("*").eq("session_id", sessionId).order("joined_at", { ascending: true }),
    ]);
    if (sess) setMpSession(sess as MPSession);
    if (pls) setMpPlayers(pls as MPPlayer[]);
    return (sess as MPSession) ?? null;
  };

  const createHostSession = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    // try up to 5 times for unique code
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = genCode();
      const { data: existing } = await supabase.from("sessions").select("id").eq("join_code", code).maybeSingle();
      if (existing) continue;
      const { data: sess, error: sErr } = await supabase
        .from("sessions")
        .insert({ mode: "group", join_code: code, region: mpRegion, status: "lobby", max_players: 6, current_round: 0 })
        .select("*")
        .single();
      if (sErr || !sess) return { ok: false, error: sErr?.message ?? "Could not create session" };
      const { data: player, error: pErr } = await supabase
        .from("players")
        .insert({ session_id: sess.id, display_name: mpName.trim(), is_host: true, status: "waiting" })
        .select("*")
        .single();
      if (pErr || !player) return { ok: false, error: pErr?.message ?? "Could not create host" };
      await supabase.from("sessions").update({ host_player_id: player.id }).eq("id", sess.id);
      console.log(`Host created session: ${code}, region: ${mpRegion}`);
      setMpSession({ ...(sess as MPSession), host_player_id: player.id });
      setMpPlayer(player as MPPlayer);
      setMpPlayers([player as MPPlayer]);
      setScreen("mp-lobby");
      return { ok: true };
    }
    return { ok: false, error: "Could not generate a unique code, please try again." };
  };

  const joinSession = async (code: string, name: string): Promise<string | null> => {
    const upper = code.toUpperCase();
    const { data: sess } = await supabase.from("sessions").select("*").eq("join_code", upper).maybeSingle();
    if (!sess) return "Code not found. Check with your group.";
    if (sess.status !== "lobby") return "Session already underway. Ask the host to start a new one.";
    const { data: existingPlayers } = await supabase.from("players").select("id").eq("session_id", sess.id);
    const max = sess.max_players ?? 6;
    if ((existingPlayers?.length ?? 0) >= max) return `Session is full (${max} players max). Ask the host to start another one.`;
    const { data: player, error: pErr } = await supabase
      .from("players")
      .insert({ session_id: sess.id, display_name: name.trim(), is_host: false, status: "waiting" })
      .select("*")
      .single();
    if (pErr || !player) return pErr?.message ?? "Could not join session";
    console.log(`Player joined session: ${upper}, total players: ${(existingPlayers?.length ?? 0) + 1}`);
    setMpSession(sess as MPSession);
    setMpPlayer(player as MPPlayer);
    await refreshLobby(sess.id);
    setScreen("mp-lobby");
    return null;
  };

  const leaveLobby = async () => {
    if (!mpPlayer || !mpSession) { setScreen("welcome"); return; }
    const wasHost = mpPlayer.is_host;
    await supabase.from("players").delete().eq("id", mpPlayer.id);
    console.log(`Player ${mpPlayer.display_name} left session`);
    if (wasHost) {
      const { data: remaining } = await supabase
        .from("players").select("*").eq("session_id", mpSession.id)
        .order("joined_at", { ascending: true });
      if (remaining && remaining.length > 0) {
        const newHost = remaining[0];
        await supabase.from("players").update({ is_host: true }).eq("id", newHost.id);
        await supabase.from("sessions").update({ host_player_id: newHost.id }).eq("id", mpSession.id);
      } else {
        await supabase.from("sessions").delete().eq("id", mpSession.id);
      }
    }
    setMpSession(null); setMpPlayer(null); setMpPlayers([]);
    setScreen("welcome");
  };

  const startHostSession = async () => {
    if (!cafes || !mpSession || !mpPlayer?.is_host) return;
    const regionName = (mpSession.region ?? "All Kolkata") as Region;
    const pool = regionName === "All Kolkata" ? cafes : cafes.filter((c) => c.region === regionName);
    const rounds = roundsForCount(pool.length);
    if (rounds === 0) return;
    const pairs = buildBattles(pool, rounds);
    await supabase
      .from("sessions")
      .update({ status: "active", current_round: 1, round_started_at: new Date().toISOString(), cafe_pairings: pairs })
      .eq("id", mpSession.id);
    console.log(`Host started session — round 1, ${mpPlayers.length} players, ${rounds} rounds total`);
    setMpSession({ ...mpSession, status: "active", current_round: 1, cafe_pairings: pairs });
    setScreen("mp-placeholder");
  };

  if (loadError) return <ErrorScreen onRetry={() => setReloadKey((k) => k + 1)} />;
  if (!cafes) return <LoadingScreen />;

  const showNav = screen === "battle" || screen === "leaderboard";
  const totalRounds = battles.length;

  return (
    <div className="min-h-screen bg-paper text-ink font-body" style={{ maxWidth: 430, margin: "0 auto", paddingBottom: showNav ? 72 : 0 }}>
      {screen === "welcome" && (
        <Welcome
          region={region}
          onRegion={setRegion}
          regionCounts={regionCounts}
          totalCount={cafes.length}
          onBegin={goBattle}
          onHost={() => { setMpName(""); setMpRegion("All Kolkata"); setScreen("mp-host-name"); }}
          onJoin={() => { setMpName(""); setScreen("mp-join"); }}
        />
      )}
      {screen === "mp-host-name" && (
        <NameStep
          title="Your name?"
          subtitle="shown to your group"
          name={mpName}
          setName={setMpName}
          ctaLabel="Continue"
          onBack={() => setScreen("welcome")}
          onContinue={() => setScreen("mp-host-region")}
        />
      )}
      {screen === "mp-host-region" && (
        <HostRegionStep
          region={mpRegion}
          onRegion={setMpRegion}
          regionCounts={regionCounts}
          totalCount={cafes.length}
          onBack={() => setScreen("mp-host-name")}
          onCreate={createHostSession}
        />
      )}
      {screen === "mp-join" && (
        <JoinStep
          onBack={() => setScreen("welcome")}
          onJoin={joinSession}
        />
      )}
      {screen === "mp-lobby" && mpSession && mpPlayer && (
        <Lobby
          session={mpSession}
          me={mpPlayer}
          players={mpPlayers}
          onRefresh={async () => {
            const sess = await refreshLobby(mpSession.id);
            if (sess && sess.status === "active") setScreen("mp-placeholder");
          }}
          onLeave={leaveLobby}
          onStart={startHostSession}
        />
      )}
      {screen === "mp-placeholder" && mpSession && (
        <MPPlaceholder
          session={mpSession}
          cafesById={cafesById}
          onExit={() => { setMpSession(null); setMpPlayer(null); setMpPlayers([]); setScreen("welcome"); }}
        />
      )}
      {screen === "battle" && tab === "battle" && battles[round] && (
        <Battle
          key={round}
          a={cafesById[battles[round][0]]}
          b={cafesById[battles[round][1]]}
          round={round}
          totalRounds={totalRounds}
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
          region={region}
          onShare={() => setScreen("share")}
          onAgain={() => setScreen("welcome")}
        />
      )}
      {screen === "share" && (
        <SharePreview
          picks={(ranked.length ? ranked : picks).map((id) => cafesById[id])}
          region={region}
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
      <BrandTitle size={28} />
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

function sessionPreview(region: Region, regionCounts: Record<string, number>, totalCount: number): string {
  if (region === "All Kolkata") {
    const rounds = roundsForCount(totalCount);
    return `${numWord(rounds)} rounds. ${numWord(totalCount)} cafés across Kolkata.`;
  }
  const count = regionCounts[region] ?? 0;
  const rounds = roundsForCount(count);
  if (rounds === 0) return `${region} — coming soon.`;
  return `${numWord(rounds)} rounds. ${numWord(count)} ${region} cafés.`;
}

function Welcome({
  region, onRegion, regionCounts, totalCount, onBegin, onHost, onJoin,
}: {
  region: Region;
  onRegion: (r: Region) => void;
  regionCounts: Record<string, number>;
  totalCount: number;
  onBegin: () => void;
  onHost: () => void;
  onJoin: () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const el = chipRefs.current[region];
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [region]);

  const handleChip = (r: Region) => {
    const count = r === "All Kolkata" ? totalCount : regionCounts[r] ?? 0;
    if (roundsForCount(count) === 0) {
      setToast(`${r} — coming soon. Cafés in curation.`);
      window.setTimeout(() => setToast(null), 2400);
      return;
    }
    onRegion(r);
  };

  const preview = sessionPreview(region, regionCounts, totalCount);
  const canBegin = roundsForCount(region === "All Kolkata" ? totalCount : regionCounts[region] ?? 0) > 0;

  return (
    <div className="min-h-screen flex flex-col px-8 pt-6 relative">
      <div className="absolute top-5 right-6 smallcaps text-sepia" style={{ fontSize: 9 }}>Est. 2026</div>
      <div className="flex-1 flex flex-col items-center justify-center text-center -mt-8">
        <BrandTitle size={38} />
        <div className="hairline mt-5" style={{ width: 32 }} />
        <div className="smallcaps text-sepia mt-5" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Kolkata · Ranked by You</div>
        <button
          onClick={onBegin}
          disabled={!canBegin}
          className="mt-12 smallcaps text-cream"
          style={{ background: "#1F4D3C", color: "#FBF6E9", padding: "14px 56px", borderRadius: 4, fontSize: 12, letterSpacing: "0.2em", transition: "all 200ms", opacity: canBegin ? 1 : 0.5 }}
        >
          Begin
        </button>

        <div className="font-body italic text-sepia mt-6" style={{ fontSize: 10 }}>where are we playing?</div>
        <div
          ref={scrollRef}
          className="mt-2 w-full"
          style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          <div style={{ display: "inline-flex", gap: 8, padding: "4px 8px", whiteSpace: "nowrap" }}>
            {REGIONS.map((r) => {
              const count = r === "All Kolkata" ? totalCount : regionCounts[r] ?? 0;
              const disabled = roundsForCount(count) === 0;
              const selected = region === r;
              return (
                <button
                  key={r}
                  ref={(el) => { chipRefs.current[r] = el; }}
                  onClick={() => handleChip(r)}
                  className="smallcaps shrink-0"
                  style={{
                    background: selected ? "#1F4D3C" : "#FBF6E9",
                    color: selected ? "#FBF6E9" : "#1A1A1A",
                    border: selected ? "none" : "1px solid #8B6F47",
                    borderRadius: 2,
                    padding: "8px 14px",
                    fontSize: 12,
                    letterSpacing: "0.5px",
                    fontFamily: "Georgia, serif",
                    boxShadow: selected ? "2px 2px 0 #6B4423" : "none",
                    transition: "all 200ms ease",
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        {toast && (
          <div
            className="font-body italic mt-4"
            style={{ fontSize: 11, color: "#6B4423", background: "#FBF6E9", padding: "8px 14px", borderRadius: 2, border: "1px solid #8B6F47", animation: "fadeIn 200ms ease-out" }}
          >
            {toast}
          </div>
        )}

        <div className="flex flex-col items-center" style={{ gap: 12, marginTop: 20 }}>
          <button
            onClick={onHost}
            className="font-display"
            style={{ background: "#FBF6E9", color: "#1F4D3C", border: "1px solid #1F4D3C", borderRadius: 2, padding: "12px 24px", fontSize: 16, letterSpacing: "1px", textTransform: "uppercase", fontVariant: "small-caps", boxShadow: "2px 2px 0 #1F4D3C", width: 240 }}
          >
            Play with friends
          </button>
          <button
            onClick={onJoin}
            className="font-display"
            style={{ background: "#FBF6E9", color: "#1F4D3C", border: "1px solid #1F4D3C", borderRadius: 2, padding: "12px 24px", fontSize: 16, letterSpacing: "1px", textTransform: "uppercase", fontVariant: "small-caps", boxShadow: "2px 2px 0 #1F4D3C", width: 240 }}
          >
            Join with code
          </button>
        </div>
      </div>
      <div className="text-center text-sepia pb-8" style={{ fontSize: 14, letterSpacing: "0.4em" }}>· · ·</div>
    </div>
  );
}

function Battle({ a, b, round, totalRounds, onPick }: { a: Cafe; b: Cafe; round: number; totalRounds: number; onPick: (id: string) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const handle = (id: string) => {
    if (chosen) return;
    setChosen(id);
    onPick(id);
  };
  return (
    <div className="px-6 pt-8 pb-6 flex flex-col" style={{ minHeight: "calc(100vh - 72px)" }}>
      <div>
        <div className="smallcaps text-sepia" style={{ fontSize: 10, letterSpacing: "0.15em" }}>
          Round {ROMAN[round]} of {ROMAN[totalRounds - 1]}
        </div>
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
      className={`w-full text-left rounded-[6px] overflow-hidden block relative ${chosen ? "card-selected pulse-once" : "card-unselected"}`}
      style={{ background: "#FBF6E9", opacity: dim ? 0.5 : 1, transition: "opacity 250ms, transform 200ms", outline: "none" }}
    >
      <CafeCardImage cafe={cafe} />
      <div style={{ padding: 16, paddingBottom: 36 }}>
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
      <RatingTag cafe={cafe} />
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

function RatingTag({ cafe }: { cafe: Cafe }) {
  const [open, setOpen] = useState(false);
  if (cafe.google_rating == null) return null;
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation(); e.preventDefault(); setOpen(true);
          }
        }}
        style={{
          position: "absolute", bottom: 8, right: 8,
          background: "#F4ECD8", color: "#6B4423",
          fontFamily: "Georgia, serif", fontSize: 11,
          padding: "3px 7px", borderRadius: 2,
          borderBottom: "1px dotted #6B4423",
          cursor: "pointer", userSelect: "none",
          lineHeight: 1.2, display: "inline-block",
        }}
      >
        ★ {cafe.google_rating.toFixed(1)}
      </span>
      {open && <RatingPopup cafe={cafe} onClose={() => setOpen(false)} />}
    </>
  );
}

function RatingPopup({ cafe, onClose }: { cafe: Cafe; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reviews = cafe.google_reviews ?? [];
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(26, 26, 26, 0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, animation: "fadeIn 200ms ease-out",
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: "#FBF6E9", borderRadius: 4,
          padding: "24px 20px",
          width: "100%", maxWidth: 420,
          maxHeight: "80vh", overflowY: "auto",
          boxShadow: "4px 4px 0 #1F4D3C",
          position: "relative",
          animation: "popIn 200ms ease-out",
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Close"
          style={{
            position: "absolute", top: 10, right: 14,
            background: "transparent", color: "#6B4423",
            fontFamily: "Georgia, serif", fontSize: 18, lineHeight: 1,
            cursor: "pointer", padding: 4,
          }}
        >
          ×
        </button>

        <h3 className="font-display italic text-ink text-center" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}>{cafe.name}</h3>
        <div className="font-body italic text-sepia text-center mt-1" style={{ fontSize: 12 }}>{cafe.neighborhood}</div>

        <div style={{ borderBottom: "1px dotted #6B4423", width: "60%", margin: "16px auto 0" }} />

        <div className="text-center mt-4">
          <div className="font-display text-forest" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
            ★ {cafe.google_rating?.toFixed(1)}
          </div>
          {cafe.google_review_count != null && (
            <div className="font-body text-sepia mt-1" style={{ fontSize: 11 }}>
              based on {cafe.google_review_count.toLocaleString()} Google reviews
            </div>
          )}
        </div>

        {cafe.google_about && (
          <div className="mt-6">
            <div className="smallcaps text-sepia" style={{ fontSize: 10, letterSpacing: "0.2em" }}>About</div>
            <p className="font-body italic text-ink mt-2" style={{ fontSize: 13, lineHeight: 1.5 }}>{cafe.google_about}</p>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mt-6">
            <div className="smallcaps text-sepia" style={{ fontSize: 10, letterSpacing: "0.2em" }}>What people say</div>
            <div className="mt-3">
              {reviews.map((r, i) => (
                <div key={i} style={{ marginBottom: i < reviews.length - 1 ? 14 : 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <span className="font-display" style={{ fontSize: 24, color: "#8B6F47", lineHeight: 1, marginTop: -4 }}>“</span>
                    <p className="font-body text-ink" style={{ fontSize: 12, lineHeight: 1.5, flex: 1 }}>{r}</p>
                  </div>
                  {i < reviews.length - 1 && (
                    <div style={{ borderBottom: "1px dotted #8B6F47", marginTop: 12, opacity: 0.6 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="font-body italic text-sepia text-center mt-6" style={{ fontSize: 9 }}>
          Reviews from Google. Crown does not verify reviews.
        </div>
      </div>
    </div>
  );
}

function rankTitle(region: Region, n: number): string {
  const roman = ROMAN[n - 1] ?? String(n);
  if (region === "All Kolkata") return `Your Top ${roman}`;
  return `Your ${region} Top ${roman}`;
}

function Result({ picks, region, onShare, onAgain }: { picks: Cafe[]; region: Region; onShare: () => void; onAgain: () => void }) {
  return (
    <div className="px-6 pt-10 pb-10">
      <div className="smallcaps" style={{ fontSize: 9, letterSpacing: "2.5px", color: "#8B6F47", marginBottom: 4 }}>Final Ranking</div>
      <h2 className="font-display text-forest" style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.2 }}>{rankTitle(region, picks.length)}</h2>
      <div className="hairline mt-4" style={{ width: 32 }} />

      <ol className="mt-7 space-y-5">
        {picks.map((c, i) => {
          const known = c.well_known_for?.[i % (c.well_known_for.length || 1)];
          return (
            <li key={c.id} className="flex items-start gap-4">
              <div className="font-display text-ink" style={{ fontSize: 20, width: 28, textAlign: "center", lineHeight: 1.2 }}>{ROMAN[i]}</div>
              <CafeImage cafe={c} size={48} />
              <div className="flex-1 min-w-0 relative" style={{ paddingRight: 56 }}>
                <div className="font-display text-ink" style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                <div className="font-body italic text-sepia" style={{ fontSize: 11 }}>{c.neighborhood}</div>
                {known && (
                  <div style={{ fontSize: 10, color: "#6B4423", fontFamily: "Georgia, serif", marginTop: 2 }}>
                    <span className="italic">known for </span>
                    <span className="dotted-under">{known}</span>
                  </div>
                )}
                {c.google_rating != null && (
                  <div style={{ position: "absolute", top: 0, right: 0 }}>
                    <InlineRating cafe={c} />
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

function InlineRating({ cafe }: { cafe: Cafe }) {
  const [open, setOpen] = useState(false);
  if (cafe.google_rating == null) return null;
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{
          background: "#F4ECD8", color: "#6B4423",
          fontFamily: "Georgia, serif", fontSize: 11,
          padding: "3px 7px", borderRadius: 2,
          borderBottom: "1px dotted #6B4423",
          cursor: "pointer", lineHeight: 1.2,
        }}
      >
        ★ {cafe.google_rating.toFixed(1)}
      </button>
      {open && <RatingPopup cafe={cafe} onClose={() => setOpen(false)} />}
    </>
  );
}

function SharePreview({ picks, region, onBack }: { picks: Cafe[]; region: Region; onBack: () => void }) {
  return (
    <div className="px-5 pt-6 pb-10">
      <div className="mx-auto" style={{ aspectRatio: "9 / 16", background: "#F4ECD8", padding: "28px 22px", borderRadius: 6, border: "0.5px solid rgba(139,111,71,0.4)", display: "flex", flexDirection: "column" }}>
        <div className="smallcaps text-sepia" style={{ fontSize: 9, letterSpacing: "0.25em" }}>Est. 2026</div>
        <h2 className="font-display italic text-ink mt-3" style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.1 }}>My {rankTitle(region, picks.length).replace(/^Your /, "")}</h2>
        <div className="smallcaps text-sepia mt-2" style={{ fontSize: 9, letterSpacing: "0.22em" }}>A Crown ranking</div>
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
        <div className="smallcaps text-sepia text-center mt-3" style={{ fontSize: 9, letterSpacing: "0.22em" }}>Crown · Kolkata, ranked by you</div>
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
      <div className="font-body italic text-sepia mt-1" style={{ fontSize: 13 }}>Kolkata · alphabetical</div>
      <div className="hairline mt-4" style={{ width: 32 }} />
      <ul className="mt-5">
        {sorted.map((c, i) => (
          <li key={c.id}>
            <div className="flex items-center gap-4 py-4">
              <div className="font-display text-ink shrink-0" style={{ fontSize: 16, width: 30, textAlign: "center" }}>{i + 1}</div>
              <CafeImage cafe={c} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-display text-ink truncate" style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                <div className="font-body italic text-sepia truncate" style={{ fontSize: 11 }}>{c.neighborhood}</div>
              </div>
              <div className="smallcaps text-sepia shrink-0" style={{ fontSize: 10, letterSpacing: "0.15em" }}>{c.total_wins ?? 0} wins</div>
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
  const total = picks.length;
  const totalRoman = ROMAN[total - 1] ?? String(total);

  const handleTap = (id: string) => {
    const idx = order.indexOf(id);
    let next: string[];
    if (idx >= 0) {
      next = order.filter((x) => x !== id);
    } else {
      if (order.length >= total) return;
      next = [...order, id];
      setPulseId(id);
      setTimeout(() => setPulseId(null), 150);
    }
    setOrder(next);
    if (next.length === total) setTimeout(() => onDone(next), 600);
  };

  return (
    <div className="px-6 pt-8 pb-10">
      <div className="smallcaps" style={{ fontSize: 9, letterSpacing: "2.5px", color: "#8B6F47", marginBottom: 4 }}>Step Two of Two</div>
      <h2 className="font-display italic text-forest" style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.15 }}>Now crown them.</h2>
      <p className="font-body italic text-ink mt-2" style={{ fontSize: 13 }}>Tap in order of preference. Favorite first.</p>
      <div className="hairline mt-4" style={{ width: 32 }} />
      <div className="smallcaps text-sepia mt-4" style={{ fontSize: 10, letterSpacing: "1.5px" }}>{order.length} of {total} ranked · rank I to {totalRoman}</div>

      <ul className="mt-6 space-y-2">
        {picks.map((cafe) => {
          const rankIdx = order.indexOf(cafe.id);
          const ranked = rankIdx >= 0;
          return (
            <li key={cafe.id}>
              <button
                onClick={() => handleTap(cafe.id)}
                className="w-full text-left rounded-[6px] flex items-start gap-3 relative"
                style={{
                  background: "#FBF6E9",
                  padding: 12,
                  paddingBottom: 32,
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
                <RatingTag cafe={cafe} />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="font-body italic text-center mt-8" style={{ fontSize: 12, color: "#8B6F47" }}>Tap a ranked café to undo.</p>
    </div>
  );
}

/* ============================ MULTIPLAYER UI ============================ */

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-body italic"
      style={{ position: "absolute", top: 18, left: 18, color: "#8B6F47", fontSize: 13, background: "transparent" }}
    >
      ← back
    </button>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="smallcaps"
      style={{
        background: "#1F4D3C", color: "#FBF6E9",
        padding: "13px 0", borderRadius: 4,
        fontSize: 12, letterSpacing: "0.22em",
        width: "100%",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity 200ms",
      }}
    >
      {children}
    </button>
  );
}

function NameStep({
  title, subtitle, name, setName, ctaLabel, onBack, onContinue,
}: {
  title: string; subtitle: string; name: string; setName: (s: string) => void;
  ctaLabel: string; onBack: () => void; onContinue: () => void;
}) {
  const valid = name.trim().length >= 2;
  return (
    <div className="min-h-screen px-8 pt-20 relative">
      <BackLink onClick={onBack} />
      <div className="text-center">
        <h2 className="font-display italic text-forest" style={{ fontSize: 24, fontWeight: 500 }}>{title}</h2>
        <p className="font-body italic text-sepia mt-2" style={{ fontSize: 12 }}>{subtitle}</p>
      </div>
      <div className="mt-8" style={{ maxWidth: 320, margin: "32px auto 0" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="your name"
          maxLength={20}
          className="w-full"
          style={{
            background: "#FBF6E9",
            border: "1px solid #8B6F47",
            borderRadius: 2,
            padding: "10px 12px",
            fontFamily: "Georgia, serif",
            fontSize: 16,
            color: "#1A1A1A",
            outline: "none",
          }}
        />
        <div className="mt-6">
          <PrimaryBtn onClick={onContinue} disabled={!valid}>{ctaLabel}</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

function HostRegionStep({
  region, onRegion, regionCounts, totalCount, onBack, onCreate,
}: {
  region: Region;
  onRegion: (r: Region) => void;
  regionCounts: Record<string, number>;
  totalCount: number;
  onBack: () => void;
  onCreate: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canCreate = roundsForCount(region === "All Kolkata" ? totalCount : regionCounts[region] ?? 0) > 0;

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    const res = await onCreate();
    setBusy(false);
    if (!res.ok) setErr(res.error);
  };

  return (
    <div className="min-h-screen px-8 pt-20 pb-10 relative">
      <BackLink onClick={onBack} />
      <h2 className="font-display italic text-forest text-center" style={{ fontSize: 24, fontWeight: 500 }}>Where are you playing?</h2>
      <div
        className="mt-6 w-full"
        style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        <div style={{ display: "inline-flex", gap: 8, padding: "4px 8px", whiteSpace: "nowrap" }}>
          {REGIONS.map((r) => {
            const count = r === "All Kolkata" ? totalCount : regionCounts[r] ?? 0;
            const disabled = roundsForCount(count) === 0;
            const selected = region === r;
            return (
              <button
                key={r}
                onClick={() => !disabled && onRegion(r)}
                className="smallcaps shrink-0"
                style={{
                  background: selected ? "#1F4D3C" : "#FBF6E9",
                  color: selected ? "#FBF6E9" : "#1A1A1A",
                  border: selected ? "none" : "1px solid #8B6F47",
                  borderRadius: 2, padding: "8px 14px", fontSize: 12,
                  letterSpacing: "0.5px", fontFamily: "Georgia, serif",
                  boxShadow: selected ? "2px 2px 0 #6B4423" : "none",
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      {err && <div className="font-body italic text-center mt-4" style={{ fontSize: 11, color: "#6B4423" }}>{err}</div>}
      <div className="mt-8" style={{ maxWidth: 320, margin: "32px auto 0" }}>
        <PrimaryBtn onClick={handleCreate} disabled={!canCreate || busy}>
          {busy ? "Creating…" : "Create Session"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

function JoinStep({
  onBack, onJoin,
}: {
  onBack: () => void;
  onJoin: (code: string, name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const valid = name.trim().length >= 2 && code.length === 6;

  const handleJoin = async () => {
    if (!valid || busy) return;
    setBusy(true); setToast(null);
    const err = await onJoin(code, name);
    setBusy(false);
    if (err) {
      setToast(err);
      window.setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="min-h-screen px-8 pt-20 pb-10 relative">
      <BackLink onClick={onBack} />
      <h2 className="font-display italic text-forest text-center" style={{ fontSize: 24, fontWeight: 500 }}>Join a session</h2>
      <div style={{ maxWidth: 320, margin: "32px auto 0" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="your name"
          maxLength={20}
          className="w-full"
          style={{
            background: "#FBF6E9", border: "1px solid #8B6F47",
            borderRadius: 2, padding: "10px 12px",
            fontFamily: "Georgia, serif", fontSize: 16, color: "#1A1A1A", outline: "none",
          }}
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="6-character code"
          maxLength={6}
          className="w-full mt-4 text-center"
          style={{
            background: "#FBF6E9", border: "1px solid #8B6F47",
            borderRadius: 2, padding: "12px 12px",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 18, letterSpacing: "4px",
            color: "#1A1A1A", outline: "none",
          }}
        />
        <div className="mt-6">
          <PrimaryBtn onClick={handleJoin} disabled={!valid || busy}>
            {busy ? "Joining…" : "Join"}
          </PrimaryBtn>
        </div>
        {toast && (
          <div
            className="font-body italic mt-4 text-center"
            style={{ fontSize: 12, color: "#6B4423", background: "#FBF6E9", padding: "10px 14px", borderRadius: 2, border: "1px solid #8B6F47" }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Lobby({
  session, me, players, onRefresh, onLeave, onStart,
}: {
  session: MPSession;
  me: MPPlayer;
  players: MPPlayer[];
  onRefresh: () => Promise<void>;
  onLeave: () => void;
  onStart: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };
  const handleShare = async () => {
    const text = `Join my Crown — code ${session.join_code} — open ${window.location.href}`;
    const navAny = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (navAny.share) {
      try { await navAny.share({ text }); } catch { /* user dismissed */ }
    } else {
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    }
  };

  const max = session.max_players ?? 6;
  const sorted = [...players].sort((a, b) => {
    if (a.is_host !== b.is_host) return a.is_host ? -1 : 1;
    return (a.joined_at ?? "").localeCompare(b.joined_at ?? "");
  });
  const canStart = me.is_host && players.length >= 2;

  return (
    <div className="min-h-screen px-6 pt-8 pb-24 relative">
      <button
        onClick={onLeave}
        className="font-body italic"
        style={{ position: "absolute", bottom: 16, left: 18, color: "#8B6F47", fontSize: 11, background: "transparent" }}
      >
        ← leave
      </button>

      <div className="text-center">
        <BrandTitle size={28} />
        <div className="text-walnut mt-1" style={{ fontSize: 9, letterSpacing: "0.25em", color: "#6B4423", fontFamily: "Georgia, serif", textTransform: "uppercase" }}>Est · MMXXVI</div>
      </div>

      <div className="text-center" style={{ marginTop: 28 }}>
        <div className="smallcaps" style={{ fontSize: 10, letterSpacing: "0.22em", color: "#8B6F47" }}>Join Code</div>
        <div
          className="font-display"
          style={{
            fontSize: 56, fontWeight: 700, color: "#1F4D3C",
            letterSpacing: "8px", marginTop: 6,
            textShadow: "3px 3px 0 #6B4423",
            lineHeight: 1.1,
          }}
        >
          {session.join_code}
        </div>
        <p className="font-body italic text-sepia mt-3" style={{ fontSize: 12 }}>share this with your group</p>
        <div style={{ maxWidth: 240, margin: "14px auto 0" }}>
          <button
            onClick={handleShare}
            className="font-display"
            style={{ background: "#FBF6E9", color: "#1F4D3C", border: "1px solid #1F4D3C", borderRadius: 2, padding: "10px 20px", fontSize: 14, letterSpacing: "1px", textTransform: "uppercase", fontVariant: "small-caps", boxShadow: "2px 2px 0 #1F4D3C", width: "100%" }}
          >
            Share Invite
          </button>
        </div>
      </div>

      <div style={{ borderBottom: "1px dotted #6B4423", width: "60%", margin: "28px auto 0" }} />

      <div className="text-center mt-6">
        <div className="smallcaps" style={{ fontSize: 11, letterSpacing: "0.22em", color: "#8B6F47" }}>Players</div>
        <ul className="mt-3 space-y-1">
          {sorted.map((p) => (
            <li key={p.id} className="smallcaps" style={{ fontSize: 14, letterSpacing: "0.1em", color: "#1A1A1A", fontFamily: "Georgia, serif" }}>
              <span style={{ color: "#6B4423", marginRight: 8 }}>·</span>
              {p.display_name}
              {p.is_host && (
                <span className="font-body italic" style={{ fontSize: 10, color: "#8B6F47", marginLeft: 6, letterSpacing: 0, textTransform: "none" }}>(host)</span>
              )}
            </li>
          ))}
        </ul>
        <div className="font-body italic text-sepia mt-3" style={{ fontSize: 11 }}>{players.length} of {max} players</div>
      </div>

      <div style={{ maxWidth: 320, margin: "28px auto 0" }}>
        {me.is_host ? (
          <>
            <PrimaryBtn onClick={onStart} disabled={!canStart}>Start Session</PrimaryBtn>
            {!canStart && (
              <p className="font-body italic text-center mt-2" style={{ fontSize: 10, color: "#8B6F47" }}>
                waiting for at least one more player…
              </p>
            )}
          </>
        ) : (
          <div className="font-display italic text-forest text-center" style={{ fontSize: 14 }}>
            Waiting for host to start…
          </div>
        )}
      </div>

      <div className="text-center mt-6">
        <button
          onClick={handleRefresh}
          className="smallcaps"
          style={{
            background: "#FBF6E9", color: "#1F4D3C",
            border: "1px solid #1F4D3C", borderRadius: 2,
            padding: "8px 18px", fontSize: 11, letterSpacing: "0.18em",
            fontFamily: "Georgia, serif",
            boxShadow: "2px 2px 0 #1F4D3C",
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          ↻ {refreshing ? "refreshing" : "refresh"}
        </button>
      </div>
    </div>
  );
}

function MPPlaceholder({
  session, cafesById, onExit,
}: {
  session: MPSession;
  cafesById: Record<string, Cafe>;
  onExit: () => void;
}) {
  const pair = session.cafe_pairings?.[0];
  const a = pair ? cafesById[pair[0]] : null;
  const b = pair ? cafesById[pair[1]] : null;
  return (
    <div className="min-h-screen px-6 pt-12 pb-10 text-center">
      <div className="smallcaps text-sepia" style={{ fontSize: 10, letterSpacing: "0.22em" }}>Round I</div>
      <h2 className="font-display italic text-forest mt-3" style={{ fontSize: 24, fontWeight: 500 }}>battle UI coming in Prompt 2</h2>
      <div className="hairline mt-6 mx-auto" style={{ width: 32 }} />
      {a && b && (
        <div className="mt-8 font-display text-ink" style={{ fontSize: 18, lineHeight: 1.6 }}>
          <div>{a.name}</div>
          <div className="font-body italic text-sepia my-2" style={{ fontSize: 13 }}>— vs —</div>
          <div>{b.name}</div>
        </div>
      )}
      <div className="font-body italic text-sepia mt-10" style={{ fontSize: 12 }}>code · {session.join_code}</div>
      <div className="mt-8" style={{ maxWidth: 240, margin: "32px auto 0" }}>
        <button
          onClick={onExit}
          className="smallcaps"
          style={{ background: "transparent", color: "#8B6F47", padding: "12px 0", borderRadius: 4, fontSize: 11, letterSpacing: "0.22em", border: "0.5px solid #8B6F47", width: "100%" }}
        >
          Exit to Welcome
        </button>
      </div>
    </div>
  );
}
