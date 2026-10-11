export function tasbihPlace(count: number): { position: number; bead: 33 | 66 | 99 | null } {
  if (count <= 0) return { position: 0, bead: null };
  const position = ((count - 1) % 99) + 1;
  const bead = position === 33 || position === 66 || position === 99 ? position : null;
  return { position, bead };
}
