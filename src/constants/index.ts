import type { AIModel } from '../types';

// ─── AI Models ────────────────────────────────────────────────────────────────

export const ALLOWED_MODELS: AIModel[] = [
  'gemini-3.8-flash',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini',
];

export const DEFAULT_MODEL: AIModel = 'gemini-3.8-flash';

// ─── Cache ────────────────────────────────────────────────────────────────────

/** Bump this string to invalidate all client-side word caches on deploy. */
export const CACHE_VERSION = 'gemini-3.8-v2';
