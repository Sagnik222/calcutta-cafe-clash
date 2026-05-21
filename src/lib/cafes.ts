export type Cafe = {
  id: string;
  name: string;
  neighborhood: string;
  city: string | null;
  region: string | null;
  is_published: boolean | null;
  image_url: string | null;
  well_known_for: string[] | null;
  vibe_tags: string[] | null;
  short_description: string | null;
  price_tier: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_reviews: string[] | null;
  google_about: string | null;
  total_battles: number | null;
  total_wins: number | null;
  total_appearances: number | null;
};

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export const REGIONS = [
  "All Kolkata",
  "South Kolkata",
  "Salt Lake",
  "Park Street",
  "North Kolkata",
  "New Town",
] as const;
export type Region = (typeof REGIONS)[number];

export function roundsForCount(n: number): number {
  if (n >= 10) return 5;
  if (n >= 8) return 4;
  if (n >= 6) return 3;
  if (n >= 4) return 2;
  return 0;
}

const NUM_WORDS: Record<number, string> = {
  2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six",
  8: "Eight", 10: "Ten", 12: "Twelve", 16: "Sixteen", 42: "Forty-two",
};
export function numWord(n: number): string {
  return NUM_WORDS[n] ?? String(n);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildBattles(cafes: Cafe[], rounds: number): [string, string][] {
  const picked = shuffle(cafes).slice(0, rounds * 2);
  const pairs: [string, string][] = [];
  for (let i = 0; i < picked.length; i += 2) {
    pairs.push([picked[i].id, picked[i + 1].id]);
  }
  return pairs;
}
