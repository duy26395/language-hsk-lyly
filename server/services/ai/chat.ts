import { AIModel } from '../../../src/types';
import { cleanThinkingTags } from './providers';
import { callAI, callAIChat } from './router';

export async function chatWithTeacher(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  hskLevel: string,
  model: AIModel = 'gemini',
): Promise<string | null> {
  const systemPrompt = `You are a Chinese teacher for HSK learners.
Strict output policy:
1) Respond ONLY in Simplified Chinese.
2) Match language difficulty to ${hskLevel} vocabulary and grammar.
3) Keep each reply concise for conversation practice.
4) If correcting the learner, do it in Chinese only (no Vietnamese, no English), then continue naturally in Chinese.
5) Do not include meta text, translations, analysis, or <think> tags.
Return only the final teacher reply in Chinese.`;

  try {
    const { content } = await callAIChat(model, systemPrompt, history, message);
    if (!content) return null;
    return cleanThinkingTags(content).trim() || null;
  } catch (error) {
    console.error('chatWithTeacher error:', error);
    return null;
  }
}

export async function chatNormally(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  model: AIModel = 'gemini',
  summary = '',
): Promise<string | null> {
  const systemPrompt = `You are Lyly AI, a warm, practical assistant for Vietnamese learners of Chinese.
Default behavior:
1) Reply in Vietnamese unless the user asks for another language or is practicing Chinese conversation.
2) When explaining Chinese, include Simplified Chinese, pinyin, Vietnamese meaning, and short natural examples when useful.
3) Prefer concise, structured answers with Markdown bullets or tables only when they improve readability.
4) Correct learner mistakes gently and explain the correction clearly.
5) Do not include hidden reasoning, <think> tags, or irrelevant meta text.`;

  const summaryPrompt = summary.trim()
    ? `Conversation summary so far:\n${summary.trim().slice(0, 4000)}`
    : '';

  try {
    const { content } = await callAIChat(model, systemPrompt, history, message, summaryPrompt);
    if (!content) return null;
    return cleanThinkingTags(content).trim() || null;
  } catch (error) {
    console.error('chatNormally error:', error);
    return null;
  }
}

export async function summarizeChatHistory(
  messagesToSummarize: { role: 'user' | 'assistant'; content: string }[],
  previousSummary = '',
  model: AIModel = 'gemini',
): Promise<string | null> {
  const transcript = messagesToSummarize
    .map(
      (message) =>
        `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`,
    )
    .join('\n\n')
    .slice(0, 18000);

  const prompt = `Update the rolling summary for a Chinese-learning chat.

Previous summary:
${previousSummary.trim() || '(none)'}

New transcript:
${transcript}

Return a concise Vietnamese summary that preserves:
- user's goals, preferences, current lesson/topic, HSK level if mentioned
- important Chinese words, grammar points, corrections, examples already discussed
- unresolved questions or commitments

Do not add new facts. Return only the updated summary.`;

  try {
    const { content } = await callAI(model, '', prompt);
    if (!content) return null;
    return cleanThinkingTags(content).trim() || null;
  } catch (error) {
    console.error('summarizeChatHistory error:', error);
    return null;
  }
}
