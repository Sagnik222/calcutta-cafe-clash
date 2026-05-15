export type Cafe = {
  id: string;
  name: string;
  neighborhood: string;
  vibe: string;
  image: string;
};

export const CAFES: Record<string, Cafe> = {
  eighth: { id: "eighth", name: "8th Day Café", neighborhood: "Hindustan Park", vibe: "indie · bookish", image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&q=70&auto=format" },
  sienna: { id: "sienna", name: "Sienna Café", neighborhood: "Hindustan Park", vibe: "curated · slow", image: "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=400&q=70&auto=format" },
  daily: { id: "daily", name: "The Daily", neighborhood: "Salt Lake", vibe: "bright · brunchy", image: "https://images.unsplash.com/photo-1525610553991-2bede1a236e2?w=400&q=70&auto=format" },
  mezzuna: { id: "mezzuna", name: "Cafe Mezzuna", neighborhood: "Camac Street", vibe: "plush · date-night", image: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400&q=70&auto=format" },
  roastery: { id: "roastery", name: "Roastery Coffee House", neighborhood: "Hindustan Park", vibe: "serious coffee · quiet", image: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&q=70&auto=format" },
  abar: { id: "abar", name: "Abar Baithak", neighborhood: "Lake Gardens", vibe: "cosy · Bengali soul", image: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=400&q=70&auto=format" },
  paris: { id: "paris", name: "Paris Café", neighborhood: "Park Street", vibe: "old-school · iconic", image: "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=400&q=70&auto=format" },
  artsy: { id: "artsy", name: "Artsy Café", neighborhood: "Ballygunge", vibe: "creative · bohemian", image: "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&q=70&auto=format" },
  owl: { id: "owl", name: "Wise Owl Café", neighborhood: "Salt Lake", vibe: "study · affordable", image: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=70&auto=format" },
  magpie: { id: "magpie", name: "Mrs. Magpie", neighborhood: "Hindustan Park", vibe: "cakes · cheerful", image: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=400&q=70&auto=format" },
};

export const BATTLES: [string, string][] = [
  ["eighth", "sienna"],
  ["daily", "mezzuna"],
  ["roastery", "abar"],
  ["paris", "artsy"],
  ["owl", "magpie"],
];

export const LEADERBOARD: { id: string; votes: number }[] = [
  { id: "eighth", votes: 198 },
  { id: "sienna", votes: 174 },
  { id: "abar", votes: 162 },
  { id: "paris", votes: 151 },
  { id: "roastery", votes: 138 },
  { id: "magpie", votes: 119 },
  { id: "mezzuna", votes: 96 },
  { id: "daily", votes: 81 },
  { id: "artsy", votes: 64 },
  { id: "owl", votes: 47 },
].sort((a, b) => b.votes - a.votes);

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
