import { isValidTimeZone } from './dates';
import { HttpError } from './errors';
import { MEMBER_COLORS, type MemberColor } from './types';

export function requirePersonName(input: unknown): string {
  return cleanName(input, 24, 'Use a name up to 24 characters.', false);
}

export function requireFamilyName(input: unknown): string {
  return cleanName(input, 40, 'Use a group name up to 40 characters.', true);
}

export function requireEmail(input: unknown): string {
  if (typeof input !== 'string') throw new HttpError(400, 'Enter an email.');
  const email = input.trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email.');
  }
  return email;
}

export function requireJoinCode(input: unknown): string {
  if (typeof input !== 'string') throw new HttpError(400, 'Enter the group code.');
  const code = input.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (code.length < 6 || code.length > 12) throw new HttpError(400, 'Enter the group code from the other phone.');
  return code;
}

export function requirePassword(input: unknown): string {
  if (typeof input !== 'string' || input.length < 8 || input.length > 128) {
    throw new HttpError(400, 'Use a password of at least 8 characters.');
  }
  return input;
}

export function optionalPin(input: unknown): string | null {
  if (input == null || input === '') return null;
  if (typeof input !== 'string' || !/^\d{4}$/.test(input)) {
    throw new HttpError(400, 'A PIN is 4 digits.');
  }
  return input;
}

export function requireGoal(input: unknown): number {
  const value = typeof input === 'number' ? input : Number(input);
  if (!Number.isInteger(value) || value < 1 || value > 5000) {
    throw new HttpError(400, 'Set a daily goal between 1 and 5000.');
  }
  return value;
}

export function optionalMemberGoal(input: unknown): number | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === '') return null;
  return requireGoal(input);
}

export function requireHouseholdGoal(input: unknown): number {
  const value = typeof input === 'number' ? input : Number(input);
  if (!Number.isInteger(value) || value < 100 || value > 1_000_000) {
    throw new HttpError(400, 'Set a household total between 100 and 1000000.');
  }
  return value;
}

export function optionalDedication(input: unknown): string | null {
  if (input == null || input === '') return null;
  if (typeof input !== 'string') throw new HttpError(400, 'Name who this round is for.');
  const name = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 40) throw new HttpError(400, 'Keep that name under 40 characters.');
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u.test(name)) {
    throw new HttpError(400, 'Use letters for who this round is for.');
  }
  return name;
}

export function requirePhraseLabel(input: unknown): string {
  return cleanName(input, 24, 'Use a short name up to 24 characters.', false);
}

export function requireArabic(input: unknown): string {
  if (typeof input !== 'string') throw new HttpError(400, 'Enter the salawat in Arabic.');
  const text = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > 180) throw new HttpError(400, 'Keep the Arabic salawat under 180 characters.');
  if (!/\p{Script=Arabic}/u.test(text)) throw new HttpError(400, 'Enter the salawat in Arabic.');
  return text;
}

export function requireLatin(input: unknown): string {
  if (typeof input !== 'string') throw new HttpError(400, 'Add a transliteration.');
  const text = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > 180) throw new HttpError(400, 'Keep the transliteration under 180 characters.');
  if (!/^[\p{L}\p{M}0-9][\p{L}\p{M}0-9\s'.,-]*$/u.test(text)) {
    throw new HttpError(400, 'Use letters for the transliteration.');
  }
  return text;
}

export function requireMonth(input: unknown): string {
  if (typeof input !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input)) {
    throw new HttpError(400, 'Choose a month.');
  }
  return input;
}

export function requireColor(input: unknown): MemberColor {
  if (typeof input === 'string' && (MEMBER_COLORS as readonly string[]).includes(input)) {
    return input as MemberColor;
  }
  throw new HttpError(400, 'Choose a color.');
}

export function requireTimeZone(input: unknown): string {
  if (typeof input !== 'string' || input.length > 80 || !isValidTimeZone(input)) {
    throw new HttpError(400, 'Choose a valid timezone.');
  }
  return input;
}

export function optionalOpId(input: unknown): string | null {
  if (input == null || input === '') return null;
  if (typeof input !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) {
    throw new HttpError(400, 'That count could not be saved.');
  }
  return input;
}

export function requireAmount(input: unknown): number {
  const value = typeof input === 'number' ? input : Number(input);
  if (!Number.isInteger(value) || value === 0 || value > 1000 || value < -1000) {
    throw new HttpError(400, 'That amount cannot be counted.');
  }
  return value;
}

function cleanName(input: unknown, max: number, lengthMessage: string, allowDigits: boolean): string {
  if (typeof input !== 'string') throw new HttpError(400, 'Enter a name.');
  const name = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > max) throw new HttpError(400, lengthMessage);
  const pattern = allowDigits
    ? /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9\s'.-]*$/u
    : /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;
  if (!pattern.test(name)) throw new HttpError(400, 'Use letters in the name.');
  return name;
}
