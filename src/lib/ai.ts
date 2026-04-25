export type AIModel = 'gemini' | 'gpt-4o' | 'gpt-3.5-turbo' | 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile' | 'qwen/qwen3-32b' | 'meta-llama/llama-4-scout-17b-16e-instruct' | 'openai/gpt-oss-120b' | 'github-gpt-4o' | 'github-gpt-4o-mini';

export interface WordExplanation {
  word: string;
  pinyin: string;
  meaning: string;
  hskLevel: string;
  learningTip: string;
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
}

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
): Promise<WordExplanation | null> {
  try {
    const { result } = await postJson<{ result: WordExplanation | null }>(
      '/api/explain-word',
      {
        word,
        context: contextContext,
        model,
      },
    );

    return result;
  } catch (error) {
    console.error('Explain word API error:', error);
    return null;
  }
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
): Promise<QuizQuestion[] | null> {
  try {
    const { result } = await postJson<{ result: QuizQuestion[] | null }>(
      '/api/generate-quiz',
      {
        hskLevel,
        topic,
        questionCount,
        model,
      },
    );

    return result;
  } catch (error) {
    console.error('Generate quiz API error:', error);
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
        history,
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

export function readAloud(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
