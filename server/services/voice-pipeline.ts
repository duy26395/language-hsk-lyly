import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { synthesizeChineseSpeech } from './tts-provider';

let groqClient: Groq | null = null;
let groqOpenAI: OpenAI | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

function getGroqOpenAI(): OpenAI {
  if (!groqOpenAI) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');
    groqOpenAI = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return groqOpenAI;
}

const WHISPER_MODEL = 'whisper-large-v3-turbo';

export async function transcribeAudio(
  audioBuffer: Buffer,
  language: string = 'zh',
  fileName: string = 'audio.webm',
): Promise<string> {
  const client = getGroqClient();

  const file = new File([audioBuffer], fileName, {
    type: getMimeType(fileName),
  });

  const transcription = await client.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
    language,
    response_format: 'text',
    temperature: 0.0,
  });

  const result: any = transcription;
  return typeof result === 'string' ? result.trim() : result?.text?.trim() || '';
}

const LLM_MODELS = [
  'qwen/qwen3-32b',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.1-8b-instant',
] as const;
const MAX_STREAM_TTS_CHUNKS = 2;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface VoiceHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TeacherFeedback {
  spokenReply: string;
  correction: string | null;
  betterSentence: string | null;
  vocabTips: string[];
  followUpQuestion: string | null;
}

const EMPTY_FEEDBACK: TeacherFeedback = {
  spokenReply: '',
  correction: null,
  betterSentence: null,
  vocabTips: [],
  followUpQuestion: null,
};

export function sanitizeVoiceHistory(history: unknown, maxMessages: number = 12): VoiceHistoryMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item: any) => (
      (item?.role === 'user' || item?.role === 'assistant') &&
      typeof item?.content === 'string' &&
      item.content.trim()
    ))
    .map((item: any) => ({
      role: item.role as VoiceHistoryMessage['role'],
      content: item.content.trim().slice(0, 2000),
    }))
    .slice(-maxMessages);
}

export async function chatWithGroq(
  userMessage: string,
  history: VoiceHistoryMessage[],
  hskLevel: string,
  summary = '',
): Promise<string | null> {
  const systemPrompt = `You are a Chinese teacher for HSK learners.
Strict output policy:
1) Respond ONLY in Simplified Chinese.
2) Match language difficulty to ${hskLevel} vocabulary and grammar.
3) Keep each reply concise (1-2 short sentences) for low-latency conversation practice.
4) If correcting the learner, do it in Chinese only, then continue naturally.
5) Do not include meta text, translations, analysis, or <think> tags.
Return only the final teacher reply in Chinese.`;
  const summaryPrompt = summary.trim()
    ? `Conversation summary so far:\n${summary.trim().slice(0, 3000)}`
    : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(summaryPrompt ? [{ role: 'system' as const, content: summaryPrompt }] : []),
    ...history,
    { role: 'user', content: userMessage },
  ];

  const client = getGroqOpenAI();
  let lastError: any = null;

  for (const model of LLM_MODELS) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return stripThinkBlocks(content).trim();
      }
    } catch (e: any) {
      lastError = e;
      console.warn(`Groq LLM model ${model} failed: ${e.message}`);
    }
  }

  console.error('All Groq LLM models failed:', lastError);
  return null;
}

export async function chatWithGroqFeedback(
  userMessage: string,
  history: VoiceHistoryMessage[],
  hskLevel: string,
  summary = '',
): Promise<TeacherFeedback | null> {
  const systemPrompt = `You are a Chinese speaking coach for Vietnamese HSK learners.
Return ONLY valid JSON. Do not include markdown, analysis, or <think> tags.
The JSON object must have exactly these keys:
{
  "spokenReply": "Simplified Chinese only. 1-2 short teacher sentences suitable for ${hskLevel}. Include a natural follow-up question when helpful.",
  "correction": "Vietnamese. One concise correction note, or empty string if the learner's sentence is acceptable.",
  "betterSentence": "Simplified Chinese. A more natural corrected version of the learner's sentence, or empty string.",
  "vocabTips": ["Vietnamese. 1-3 short notes about useful Chinese words or patterns from this turn."],
  "followUpQuestion": "Simplified Chinese. A short question to continue the conversation, or empty string if already included in spokenReply."
}
Keep the coaching practical and friendly. Do not over-correct.`;
  const summaryPrompt = summary.trim()
    ? `Conversation summary so far:\n${summary.trim().slice(0, 3000)}`
    : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(summaryPrompt ? [{ role: 'system' as const, content: summaryPrompt }] : []),
    ...history,
    { role: 'user', content: userMessage },
  ];

  const client = getGroqOpenAI();
  let lastError: any = null;

  for (const model of LLM_MODELS) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 450,
        temperature: 0.4,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      const feedback = parseTeacherFeedback(content);
      if (feedback?.spokenReply) {
        return feedback;
      }
    } catch (e: any) {
      lastError = e;
      console.warn(`Groq feedback model ${model} failed: ${e.message}`);
    }
  }

  console.error('All Groq feedback models failed:', lastError);
  return null;
}

export interface SpeakPipelineResult {
  userText: string;
  assistantText: string;
  feedback: TeacherFeedback;
  audioBuffer: Buffer;
  mimeType: string;
  ttsProvider: string;
}

export async function runSpeakPipelineStream(
  audioBuffer: Buffer,
  history: VoiceHistoryMessage[],
  hskLevel: string,
  fileName: string = 'audio.webm',
  ttsVoice: string = 'zh-CN-XiaoxiaoNeural',
  summary = '',
  onEvent: (event: string, payload: any) => void,
): Promise<void> {
  onEvent('processing_stt', {});
  const userText = await transcribeAudio(audioBuffer, 'zh', fileName);
  if (!userText) {
    onEvent('error', { message: 'Không thể nhận diện giọng nói.' });
    return;
  }
  onEvent('user_text', { text: userText });

  onEvent('processing_llm', {});
  const systemPrompt = `You are a Chinese teacher for HSK learners.
Strict output policy:
1) Respond ONLY in Simplified Chinese.
2) Match language difficulty to ${hskLevel} vocabulary and grammar.
3) Keep each reply concise (1-2 short sentences) for low-latency conversation practice.
4) If correcting the learner, do it in Chinese only, then continue naturally.
5) Do not include meta text, translations, analysis, or <think> tags.
Return only the final teacher reply in Chinese.`;
  const summaryPrompt = summary.trim()
    ? `Conversation summary so far:\n${summary.trim().slice(0, 3000)}`
    : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(summaryPrompt ? [{ role: 'system' as const, content: summaryPrompt }] : []),
    ...history,
    { role: 'user', content: userText },
  ];

  const client = getGroqOpenAI();
  let fullResponse = '';
  let sentenceBuffer = '';
  let audioSequence = 0;
  let ttsChunkCount = 0;
  let ttsQueue = Promise.resolve();
  const thinkFilter = createThinkTagFilter();

  const enqueueTts = (sentence: string) => {
    if (ttsChunkCount >= MAX_STREAM_TTS_CHUNKS) return;
    ttsChunkCount += 1;
    const sequence = audioSequence++;
    ttsQueue = ttsQueue.then(async () => {
      try {
        const audio = await synthesizeChineseSpeech(sentence, ttsVoice);
        onEvent('audio_chunk', {
          audio: audio.audioBuffer.toString('base64'),
          mimeType: audio.mimeType,
          provider: audio.provider,
          sequence,
          text: sentence,
        });
      } catch (error) {
        console.error('Streaming TTS error:', error);
        onEvent('tts_error', { sequence, text: sentence });
      }
    });
  };

  const handleVisibleContent = (content: string) => {
    if (!content) return;

    fullResponse += content;
    sentenceBuffer += content;

    if (/[。！？.!?]/.test(content)) {
      const sentence = sentenceBuffer.trim();
      sentenceBuffer = '';
      if (sentence) {
        enqueueTts(sentence);
      }
    }

    onEvent('llm_text_chunk', { chunk: content });
  };

  try {
    const stream = await client.chat.completions.create({
      model: LLM_MODELS[0],
      messages,
      max_tokens: 400,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (!content) continue;
      handleVisibleContent(thinkFilter.push(content));
    }

    handleVisibleContent(thinkFilter.flush());

    if (sentenceBuffer.trim()) {
      enqueueTts(sentenceBuffer.trim());
    }

    await ttsQueue;
    onEvent('audio_complete', {});
    onEvent('pipeline_complete', { assistantText: fullResponse });
  } catch (error) {
    console.error('Streaming pipeline error:', error);
    onEvent('error', { message: 'Lỗi khi xử lý phản hồi từ AI.' });
  }
}

export async function runSpeakPipeline(
  audioBuffer: Buffer,
  history: VoiceHistoryMessage[],
  hskLevel: string,
  fileName: string = 'audio.webm',
  ttsVoice: string = 'zh-CN-XiaoxiaoNeural',
  summary = '',
): Promise<SpeakPipelineResult | null> {
  const userText = await transcribeAudio(audioBuffer, 'zh', fileName);
  if (!userText) {
    console.warn('STT returned empty transcription');
    return null;
  }

  const feedback = await chatWithGroqFeedback(userText, history, hskLevel, summary);
  if (!feedback?.spokenReply) {
    console.warn('LLM returned empty response');
    return null;
  }

  const assistantText = feedback.followUpQuestion && !feedback.spokenReply.includes(feedback.followUpQuestion)
    ? `${feedback.spokenReply} ${feedback.followUpQuestion}`
    : feedback.spokenReply;
  const resultAudio = await synthesizeChineseSpeech(assistantText, ttsVoice);

  return {
    userText,
    assistantText,
    feedback,
    audioBuffer: resultAudio.audioBuffer,
    mimeType: resultAudio.mimeType,
    ttsProvider: resultAudio.provider,
  };
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    flac: 'audio/flac',
    m4a: 'audio/m4a',
  };
  return mimeMap[ext || ''] || 'audio/webm';
}

function stripThinkBlocks(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '');
}

function parseTeacherFeedback(content: string): TeacherFeedback | null {
  const cleaned = stripThinkBlocks(content)
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  const candidate = jsonStart >= 0 && jsonEnd > jsonStart
    ? cleaned.slice(jsonStart, jsonEnd + 1)
    : cleaned;

  try {
    const parsed = JSON.parse(candidate);
    const spokenReply = normalizeText(parsed?.spokenReply);

    if (!spokenReply) {
      return null;
    }

    return {
      spokenReply,
      correction: normalizeNullableText(parsed?.correction),
      betterSentence: normalizeNullableText(parsed?.betterSentence),
      vocabTips: normalizeTextList(parsed?.vocabTips).slice(0, 3),
      followUpQuestion: normalizeNullableText(parsed?.followUpQuestion),
    };
  } catch {
    const fallbackReply = cleaned.trim();
    return fallbackReply
      ? { ...EMPTY_FEEDBACK, spokenReply: fallbackReply }
      : null;
  }
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableText(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeText)
    .filter(Boolean);
}

function createThinkTagFilter() {
  let pending = '';
  let inThink = false;

  return {
    push(chunk: string): string {
      pending += chunk;
      let output = '';
      let index = 0;

      while (index < pending.length) {
        const lower = pending.toLowerCase();

        if (inThink) {
          const closeIndex = lower.indexOf('</think>', index);
          if (closeIndex === -1) {
            pending = pending.slice(-'</think'.length);
            return output;
          }

          index = closeIndex + '</think>'.length;
          inThink = false;
          continue;
        }

        const openIndex = lower.indexOf('<think>', index);
        if (openIndex === -1) {
          const safeEnd = Math.max(index, pending.length - '<think'.length);
          output += pending.slice(index, safeEnd);
          pending = pending.slice(safeEnd);
          return output;
        }

        output += pending.slice(index, openIndex);
        index = openIndex + '<think>'.length;
        inThink = true;
      }

      pending = '';
      return output;
    },

    flush(): string {
      if (inThink) {
        pending = '';
        return '';
      }

      const output = pending;
      pending = '';
      return output;
    },
  };
}
