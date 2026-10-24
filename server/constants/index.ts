import type { AIModel } from '../services/ai';

// ─── AI Models ────────────────────────────────────────────────────────────────
// NOTE: Keep in sync with src/constants/index.ts (client side).

export const ALLOWED_MODELS: AIModel[] = [
  'gemini-3.8-flash',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini',
];

export const DEFAULT_MODEL: AIModel = 'gemini-3.8-flash';

// ─── Cache ────────────────────────────────────────────────────────────────────

/** Bump this string to invalidate all server-side explain caches on deploy.
 *  Keep in sync with src/constants/index.ts (client side). */
export const CACHE_VERSION = 'gemini-3.8-v2';
