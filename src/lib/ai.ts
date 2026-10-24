// Re-export all shared types from the canonical source of truth
export type {
  AIModel,
  WordExplanation,
  QuizQuestion,
  QuizType,
  InterviewTurn,
  InterviewEvaluation,
} from '../types';
import type {
  AIModel,
  WordExplanation,
  QuizQuestion,
  QuizType,
  InterviewTurn,
  InterviewEvaluation,
} from '../types';
import {
  createWordCacheKey,
  getCachedWord,
  setCachedWord,
  getPendingWordRequest,
  setPendingWordRequest,
  deletePendingWordRequest,
} from './word-cache';

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

  const pending = getPendingWordRequest(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { result } = await postJson<{ result: WordExplanation | null }>(
        '/api/explain-word',
        { word, context: contextContext, model, race },
      );
      setCachedWord(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Explain word API error:', error);
      return null;
    } finally {
      deletePendingWordRequest(cacheKey);
    }
  })();

  setPendingWordRequest(cacheKey, request);
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

