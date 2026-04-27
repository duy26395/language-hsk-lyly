import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { synthesizeChineseSpeech } from './tts-provider';

// ─── Groq client singletons ───────────────────────────────────────────────────

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

// ─── STT: Groq Whisper ────────────────────────────────────────────────────────

const WHISPER_MODEL = 'whisper-large-v3-turbo';

/**
 * Transcribe audio buffer to text using Groq Whisper.
 * Accepts raw audio bytes (wav/webm/ogg/mp3) and returns the transcribed text.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  language: string = 'zh',
  fileName: string = 'audio.webm',
): Promise<string> {
  const client = getGroqClient();

  // Create a File-like object from the buffer for the SDK
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

  // response_format: 'text' returns a plain string
  const result: any = transcription;
  return typeof result === 'string'
    ? result.trim()
    : result?.text?.trim() || '';
}

// ─── LLM: Groq Chat ──────────────────────────────────────────────────────────

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

/**
 * Chat with the Chinese teacher via Groq LLM.
 * Tries multiple models in priority order for resilience.
 */
export async function chatWithGroq(
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  hskLevel: string,
): Promise<string | null> {
  const systemPrompt = `You are a Chinese teacher for HSK learners.
Strict output policy:
1) Respond ONLY in Simplified Chinese.
2) Match language difficulty to ${hskLevel} vocabulary and grammar.
3) Keep each reply concise (1-2 short sentences) for low-latency conversation practice.
4) If correcting the learner, do it in Chinese only, then continue naturally.
5) Do not include meta text, translations, analysis, or <think> tags.
Return only the final teacher reply in Chinese.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
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

// ─── TTS: Microsoft Edge TTS (Free Neural Voices) ─────────────────────────────


// ─── Full Pipeline: Audio → Text → LLM → Audio ───────────────────────────────

export interface SpeakPipelineResult {
  /** The user's speech transcribed to text */
  userText: string;
  /** The AI teacher's reply text */
  assistantText: string;
  /** The AI teacher's reply as audio */
  audioBuffer: Buffer;
  mimeType: string;
  ttsProvider: string;
}

/**
 * Streaming version of the voice pipeline for WebSockets.
 * Emits events via onEvent callback as data becomes available.
 */
export async function runSpeakPipelineStream(
  audioBuffer: Buffer,
  history: { role: 'user' | 'assistant'; content: string }[],
  hskLevel: string,
  fileName: string = 'audio.webm',
  ttsVoice: string = 'zh-CN-XiaoxiaoNeural',
  onEvent: (event: string, payload: any) => void
): Promise<void> {
  // 1. Transcribe (Wait for full audio since Whisper is file-based)
  onEvent('processing_stt', {});
  const userText = await transcribeAudio(audioBuffer, 'zh', fileName);
  if (!userText) {
    onEvent('error', { message: 'Không thể nhận diện giọng nói.' });
    return;
  }
  onEvent('user_text', { text: userText });

  // 2. Stream LLM and TTS
  onEvent('processing_llm', {});
  const systemPrompt = `You are a Chinese teacher for HSK learners.
Strict output policy:
1) Respond ONLY in Simplified Chinese.
2) Match language difficulty to ${hskLevel} vocabulary and grammar.
3) Keep each reply concise (1-2 short sentences) for low-latency conversation practice.
4) If correcting the learner, do it in Chinese only, then continue naturally.
5) Do not include meta text, translations, analysis, or <think> tags.
Return only the final teacher reply in Chinese.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
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

    // Detect sentence end for immediate TTS.
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
      model: LLM_MODELS[0], // Use primary model for streaming
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

    // Finalize any remaining text
    if (sentenceBuffer.trim()) {
      const finalSentence = sentenceBuffer.trim();
      enqueueTts(finalSentence);
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
  history: { role: 'user' | 'assistant'; content: string }[],
  hskLevel: string,
  fileName: string = 'audio.webm',
  ttsVoice: string = 'zh-CN-XiaoxiaoNeural'
): Promise<SpeakPipelineResult | null> {
  // Step 1: Speech-to-Text
  const userText = await transcribeAudio(audioBuffer, 'zh', fileName);
  if (!userText) {
    console.warn('STT returned empty transcription');
    return null;
  }

  // Step 2: LLM response
  const assistantText = await chatWithGroq(userText, history, hskLevel);
  if (!assistantText) {
    console.warn('LLM returned empty response');
    return null;
  }

  // Step 3: Text-to-Speech
  const resultAudio = await synthesizeChineseSpeech(assistantText, ttsVoice);

  return {
    userText,
    assistantText,
    audioBuffer: resultAudio.audioBuffer,
    mimeType: resultAudio.mimeType,
    ttsProvider: resultAudio.provider,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
            pending = pending.slice(-('</think'.length));
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
