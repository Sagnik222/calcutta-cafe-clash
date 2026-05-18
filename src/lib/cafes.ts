export type Cafe = {
  id: string;
  name: string;
  neighborhood: string;
  city: string | null;
  image_url: string | null;
  well_known_for: string[] | null;
  vibe_tags: string[] | null;
  short_description: string | null;
  price_tier: number | null;
  total_battles: number | null;
  total_wins: number | null;
  total_appearances: number | null;
};

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildBattles(cafes: Cafe[]): [string, string][] {
  const picked = shuffle(cafes).slice(0, 10);
  const pairs: [string, string][] = [];
  for (let i = 0; i < 10; i += 2) {
    pairs.push([picked[i].id, picked[i + 1].id]);
  }
  return pairs;
}
