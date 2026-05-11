export type AIModel = 'gemini' | 'gpt-4o' | 'gpt-3.5-turbo' | 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile' | 'qwen/qwen3-32b' | 'meta-llama/llama-4-scout-17b-16e-instruct' | 'openai/gpt-oss-120b' | 'github-gpt-4o' | 'github-gpt-4o-mini';

export interface WordExplanation {
  word: string;
  pinyin: string;
  meaning: string;
  meanings?: string[];
  pronunciations?: string[];
  hskLevel: string;
  radical?: string;
  strokes?: string;
  decomposition?: string[];
  grammarFocus?: string[];
  commonPatterns?: {
    pattern: string;
    meaning: string;
    example: string;
    examplePinyin?: string;
    exampleMeaning: string;
  }[];
  commonMistakes?: string[];
  learningTip: string;
  usage?: string;
  usageExamples?: string[];
  videoLinks?: { title: string; url: string }[];
  example: string;
  examplePinyin?: string;
  exampleMeaning: string;
  synonyms?: string;
  antonyms?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  dialogue?: string;
}

export type QuizType = 'general' | 'listening' | 'interview';

export interface InterviewTurn {
  question: string;
  answer: string;
  speechConfidence?: number;
}

export interface InterviewEvaluation {
  overallScore: number;
  estimatedHskLevel: string;
  grammarScore: number;
  pronunciationScore: number;
  fluencyScore: number;
  strengths: string[];
  improvements: string[];
  grammarFeedback: string;
  pronunciationFeedback: string;
  nextPractice: string[];
}

const WORD_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const WORD_CACHE_VERSION = 'pronunciations-v2';
const wordCache = new Map<string, { result: WordExplanation | null; expiresAt: number }>();
const pendingWordRequests = new Map<string, Promise<WordExplanation | null>>();

const createWordCacheKey = (word: string, contextContext: string, model: AIModel, race = false) => {
  const mode = race ? 'race' : 'single';
  return `${WORD_CACHE_VERSION}::${mode}::${model}::${word.trim().toLowerCase()}::${contextContext.trim().slice(0, 160).toLowerCase()}`;
};

const getCachedWord = (cacheKey: string) => {
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
};

const setCachedWord = (cacheKey: string, result: WordExplanation | null) => {
  const entry = { result, expiresAt: Date.now() + WORD_CACHE_TTL_MS };
  wordCache.set(cacheKey, entry);
  try {
    sessionStorage.setItem(`word-cache:${cacheKey}`, JSON.stringify(entry));
  } catch {}
};

const compactHistory = (
  history: { role: 'user' | 'assistant'; content: string }[],
  maxMessages = 12,
) =>
  history
    .slice(-maxMessages)
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, 3000),
    }))
    .filter((item) => item.content.trim());

async function postJson<TResponse>(
  url: string,
  body: unknown,
  timeoutMs = 28000
): Promise<TResponse> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json() as TResponse;
  } finally {
    clearTimeout(id);
  }
}

export async function explainWord(
  word: string,
  contextContext: string,
  model: AIModel = 'gemini',
  race = false,
): Promise<WordExplanation | null> {
  const cacheKey = createWordCacheKey(word, contextContext, model, race);
  const cached = getCachedWord(cacheKey);
  if (cached !== undefined) return cached;

  const pending = pendingWordRequests.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
  try {
    const { result } = await postJson<{ result: WordExplanation | null }>(
      '/api/explain-word',
      {
        word,
        context: contextContext,
        model,
        race,
      },
    );

    setCachedWord(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Explain word API error:', error);
    return null;
  } finally {
    pendingWordRequests.delete(cacheKey);
  }
  })();

  pendingWordRequests.set(cacheKey, request);
  return request;
}

export async function generateChineseText(
  words: string[],
  hskLevel: string,
  model: AIModel = 'gemini',
): Promise<string | null> {
  try {
    const { result } = await postJson<{ result: string | null }>(
      '/api/generate-text',
      {
        words,
        hskLevel,
        model,
      },
    );

    return result;
  } catch (error) {
    console.error('Generate text API error:', error);
    return null;
  }
}

export async function generateQuiz(
  hskLevel: number,
  topic: string,
  questionCount: number = 5,
  model: AIModel = 'gemini',
  quizType: QuizType = 'general',
): Promise<QuizQuestion[] | null> {
  try {
    const { result } = await postJson<{ result: QuizQuestion[] | null }>(
      '/api/generate-quiz',
      {
        hskLevel,
        topic,
        questionCount,
        model,
        quizType,
      },
    );

    return result;
  } catch (error) {
    console.error('Generate quiz API error:', error);
    return null;
  }
}

export async function generateInterviewQuestion(
  hskLevel: number,
  topic: string,
  turns: InterviewTurn[],
  questionNumber: number,
  totalQuestions: number,
  model: AIModel = 'gemini',
): Promise<string | null> {
  try {
    const { result } = await postJson<{ result: string | null }>(
      '/api/interview-question',
      {
        hskLevel,
        topic,
        turns,
        questionNumber,
        totalQuestions,
        model,
      },
    );

    return result;
  } catch (error) {
    console.error('Generate interview question API error:', error);
    return null;
  }
}

export async function evaluateInterview(
  hskLevel: number,
  topic: string,
  turns: InterviewTurn[],
  model: AIModel = 'gemini',
): Promise<InterviewEvaluation | null> {
  try {
    const { result } = await postJson<{ result: InterviewEvaluation | null }>(
      '/api/evaluate-interview',
      {
        hskLevel,
        topic,
        turns,
        model,
      },
      42000,
    );

    return result;
  } catch (error) {
    console.error('Evaluate interview API error:', error);
    return null;
  }
}

export async function chatWithTeacher(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  hskLevel: string,
  model: AIModel = 'gemini',
): Promise<string | null> {
  try {
    const { result } = await postJson<{ result: string | null }>(
      '/api/chat-teacher',
      {
        message,
        history: compactHistory(history),
        hskLevel,
        model,
      },
    );

    return result;
  } catch (error) {
    console.error('Chat with teacher API error:', error);
    return null;
  }
}

export async function chatNormally(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  model: AIModel = 'gemini',
  summary = '',
): Promise<string | null> {
  try {
    const { result } = await postJson<{ result: unknown }>(
      '/api/chat',
      {
        message,
        history: compactHistory(history),
        model,
        summary,
      },
    );

    return normalizeChatResult(result);
  } catch (error) {
    console.error('Chat API error:', error);
    return null;
  }
}

export async function summarizeConversation(
  messages: { role: 'user' | 'assistant'; content: string }[],
  previousSummary = '',
  model: AIModel = 'gemini',
): Promise<string | null> {
  try {
    const { result } = await postJson<{ result: string | null }>(
      '/api/chat-summary',
      {
        messages: compactHistory(messages, 24),
        previousSummary,
        model,
      },
      22000,
    );

    return result;
  } catch (error) {
    console.error('Summarize conversation API error:', error);
    return null;
  }
}

export async function translateToVietnamese(
  text: string,
  model: AIModel = 'gemini',
): Promise<string | null> {
  const prompt = [
    'Translate the following text into natural Vietnamese.',
    'Return only the Vietnamese translation.',
    'Do not explain anything.',
    '',
    text,
  ].join('\n');

  return chatNormally(prompt, [], model);
}

function normalizeChatResult(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (result == null) return null;
  if (Array.isArray(result)) {
    return result
      .map((item) => normalizeChatResult(item))
      .filter((item): item is string => Boolean(item))
      .join('\n');
  }
  if (typeof result === 'object') {
    const record = result as Record<string, unknown>;
    const preferredFields = ['content', 'text', 'message', 'response', 'answer', 'output'];
    for (const field of preferredFields) {
      const value = normalizeChatResult(record[field]);
      if (value) return value;
    }
    return JSON.stringify(result, null, 2);
  }
  return String(result);
}

export function readAloud(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
