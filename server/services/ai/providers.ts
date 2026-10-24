import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { AIModel } from '../../../src/types';

export const GROQ_PRIORITY_LIST: AIModel[] = [
  'qwen/qwen3-32b',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
  'llama-3.1-8b-instant',
];

export const GEMINI_MODEL_FALLBACKS = [
  'gemini-3.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-live',
] as const;

let openai: OpenAI | null = null;
let groq: OpenAI | null = null;
let github: OpenAI | null = null;

export function getOpenAI() {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server.');
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: openAiApiKey });
  }
  return openai;
}

export function getGemini() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({ apiKey: geminiApiKey });
}

export function getGroq() {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }
  if (!groq) {
    groq = new OpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return groq;
}

export function getGithub() {
  const githubApiKey = process.env.GITHUB_API_KEY;
  if (!githubApiKey) {
    throw new Error('GITHUB_API_KEY is not configured on the server.');
  }
  if (!github) {
    github = new OpenAI({
      apiKey: githubApiKey,
      baseURL: 'https://models.inference.ai.azure.com',
    });
  }
  return github;
}

export function hasProviderForModel(model: AIModel) {
  if (model === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  if (model.startsWith('github-')) return Boolean(process.env.GITHUB_API_KEY);
  if (GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant') {
    return Boolean(process.env.GROQ_API_KEY);
  }
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getExplainRaceModels(preferredModel: AIModel) {
  const candidates: AIModel[] = [];
  const add = (m: AIModel) => {
    if (candidates.includes(m) || !hasProviderForModel(m)) return;
    candidates.push(m);
  };

  add(preferredModel);
  add('qwen/qwen3-32b');
  add('llama-3.1-8b-instant');
  add('gemini');
  add('github-gpt-5-mini');
  add('gpt-3.5-turbo');

  return candidates.slice(0, 3);
}

export function cleanThinkingTags(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export function cleanJsonContent(content: string): string {
  const noThinking = cleanThinkingTags(content);
  return noThinking.replace(/```json\n?|```/g, '').trim();
}

export async function generateGeminiContentWithFallback(
  contents: any,
  config?: Record<string, any>,
): Promise<any> {
  const client = getGemini();
  let lastError: any = null;

  for (const geminiModel of GEMINI_MODEL_FALLBACKS) {
    try {
      return await client.models.generateContent({
        model: geminiModel,
        contents,
        ...(config ? { config } : {}),
      });
    } catch (error: any) {
      lastError = error;
      const status = error?.status;
      const message = error?.message || '';
      const missingModel =
        status === 404 || /not found|not supported/i.test(message);
      if (!missingModel) throw error;
      console.warn(`Gemini model ${geminiModel} unavailable, trying fallback.`);
    }
  }

  throw lastError;
}
