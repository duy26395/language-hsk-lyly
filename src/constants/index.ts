import type { AIModel } from '../types';

// ─── AI Models ────────────────────────────────────────────────────────────────

export const ALLOWED_MODELS: AIModel[] = [
  'gemini',
  'gpt-3.5-turbo',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'qwen/qwen3-32b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
  'github-gpt-5-mini',
  'github-gpt-4o-mini',
];

export const DEFAULT_MODEL: AIModel = 'qwen/qwen3-32b';

// ─── Cache ────────────────────────────────────────────────────────────────────

/** Bump this string to invalidate all client-side word caches on deploy. */
export const CACHE_VERSION = 'pronunciations-v2';
