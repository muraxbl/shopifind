import { SITE_CONFIG, type NicheId } from '@/lib/config';

export const MAX_PROFILE_NAME_LENGTH = 80;

export type ProfileInput = {
  fullName: string | null;
  nichePrefs: NicheId[];
};

export type ProfileInputResult =
  | { success: true; data: ProfileInput }
  | { success: false; error: 'invalid_name' | 'invalid_niche' };

const allowedNiches = new Set<string>(SITE_CONFIG.primaryNiches);

export function normalizeProfileInput(input: {
  fullName: unknown;
  nichePrefs: unknown[];
}): ProfileInputResult {
  if (typeof input.fullName !== 'string') {
    return { success: false, error: 'invalid_name' };
  }

  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (fullName.length > MAX_PROFILE_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(fullName)) {
    return { success: false, error: 'invalid_name' };
  }

  const nichePrefs: NicheId[] = [];
  for (const value of input.nichePrefs) {
    if (typeof value !== 'string' || !allowedNiches.has(value)) {
      return { success: false, error: 'invalid_niche' };
    }
    const niche = value as NicheId;
    if (!nichePrefs.includes(niche)) nichePrefs.push(niche);
  }

  return {
    success: true,
    data: {
      fullName: fullName || null,
      nichePrefs,
    },
  };
}
