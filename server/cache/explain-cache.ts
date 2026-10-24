import { CACHE_VERSION } from '../constants';

const EXPLAIN_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const explainCache = new Map<string, { result: unknown; expiresAt: number }>();

export function createExplainCacheKey(word: string, context: string, model: string, race = false) {
  const mode = race ? 'race' : 'single';
  return `${CACHE_VERSION}::${mode}::${model}::${word.trim().toLowerCase()}::${context.trim().slice(0, 160).toLowerCase()}`;
}

export function getExplainCache(cacheKey: string): unknown | undefined {
  const entry = explainCache.get(cacheKey);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    explainCache.delete(cacheKey);
    return undefined;
  }
  return entry.result;
}

export function setExplainCache(cacheKey: string, result: unknown) {
  explainCache.set(cacheKey, {
    result,
    expiresAt: Date.now() + EXPLAIN_CACHE_TTL_MS,
  });

  if (explainCache.size > 300) {
    const oldestKey = explainCache.keys().next().value;
    if (oldestKey) explainCache.delete(oldestKey);
  }
}
