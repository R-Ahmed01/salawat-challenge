let pending: string | null = null;

export function holdDedication(name: string): void {
  const trimmed = name.trim();
  pending = trimmed.length > 0 ? trimmed : null;
}

export function takeDedication(): string {
  const name = pending ?? '';
  pending = null;
  return name;
}
