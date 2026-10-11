export type TasbihPlace = {
  position: number;
  round: number;
  bead: 33 | 66 | 99 | null;
};

/** Where today's count sits in the 33 / 66 / 99 round. */
export function tasbihPlace(count: number): TasbihPlace {
  if (count <= 0) return { position: 0, round: 0, bead: null };
  const position = ((count - 1) % 99) + 1;
  const bead = position === 33 || position === 66 || position === 99 ? position : null;
  return { position, round: Math.ceil(count / 99), bead };
}
