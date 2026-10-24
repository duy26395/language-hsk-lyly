import type { WordExplanation } from '../types';
import { CACHE_VERSION } from '../constants';

// ─── Cache Configuration ──────────────────────────────────────────────────────

const WORD_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const wordCache = new Map<string, { result: WordExplanation | null; expiresAt: number }>();
const pendingWordRequests = new Map<string, Promise<WordExplanation | null>>();

// ─── Cache Key ────────────────────────────────────────────────────────────────

export function createWordCacheKey(
  word: string,
  context: string,
  model: string,
  race = false,
): string {
  const mode = race ? 'race' : 'single';
  return `${CACHE_VERSION}::${mode}::${model}::${word.trim().toLowerCase()}::${context.trim().slice(0, 160).toLowerCase()}`;
}

// ─── Get / Set ────────────────────────────────────────────────────────────────

export function getCachedWord(cacheKey: string): WordExplanation | null | undefined {
  const memoryEntry = wordCache.get(cacheKey);
  if (memoryEntry && memoryEntry.expiresAt > Date.now()) return memoryEntry.result;
  if (memoryEntry) wordCache.delete(cacheKey);

  try {
    const raw = sessionStorage.getItem(`word-cache:${cacheKey}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { result: WordExplanation | null; expiresAt: number };
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(`word-cache:${cacheKey}`);
      return undefined;
    }
    wordCache.set(cacheKey, parsed);
    return parsed.result;
  } catch {
    return undefined;
  }
}

export function setCachedWord(cacheKey: string, result: WordExplanation | null): void {
  const entry = { result, expiresAt: Date.now() + WORD_CACHE_TTL_MS };
  wordCache.set(cacheKey, entry);
  try {
    sessionStorage.setItem(`word-cache:${cacheKey}`, JSON.stringify(entry));
  } catch {}
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export function getPendingWordRequest(
  cacheKey: string,
): Promise<WordExplanation | null> | undefined {
  return pendingWordRequests.get(cacheKey);
}

export function setPendingWordRequest(
  cacheKey: string,
  promise: Promise<WordExplanation | null>,
): void {
  pendingWordRequests.set(cacheKey, promise);
}

export function deletePendingWordRequest(cacheKey: string): void {
  pendingWordRequests.delete(cacheKey);
}
