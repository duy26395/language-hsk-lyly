import { EdgeTTS } from 'edge-tts-universal';

export type TtsProvider = 'edge' | 'azure' | 'google-translate';

export interface TtsAudio {
  audioBuffer: Buffer;
  mimeType: string;
  provider: TtsProvider;
}

const DEFAULT_CHINESE_VOICE = 'zh-CN-XiaoxiaoNeural';
const ALLOWED_CHINESE_VOICES = new Set([
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunxiNeural',
  'zh-CN-YunjianNeural',
]);

export function normalizeChineseVoice(voiceName: unknown): string {
  return typeof voiceName === 'string' && ALLOWED_CHINESE_VOICES.has(voiceName)
    ? voiceName
    : DEFAULT_CHINESE_VOICE;
}

export async function synthesizeChineseSpeech(
  text: string,
  voiceName: unknown = DEFAULT_CHINESE_VOICE,
): Promise<TtsAudio> {
  const safeText = text.trim().slice(0, 2000);
  if (!safeText) {
    throw new Error('TTS text is empty.');
  }

  const voice = normalizeChineseVoice(voiceName);
  const provider = normalizeProvider(process.env.CHINESE_TTS_PROVIDER);

  if (provider === 'azure') {
    return synthesizeWithAzure(safeText, voice);
  }

  if (provider === 'google-translate') {
    return synthesizeWithGoogleTranslate(safeText);
  }

  try {
    return await synthesizeWithEdge(safeText, voice);
  } catch (error) {
    console.warn('Edge TTS failed, falling back to Google Translate TTS:', error);
    return synthesizeWithGoogleTranslate(safeText);
  }
}

async function synthesizeWithEdge(text: string, voiceName: string): Promise<TtsAudio> {
  const tts = new EdgeTTS(text, voiceName);
  const { audio } = await tts.synthesize();
  const arrayBuffer = await audio.arrayBuffer();

  return {
    audioBuffer: Buffer.from(arrayBuffer),
    mimeType: audio.type || 'audio/mpeg',
    provider: 'edge',
  };
}

async function synthesizeWithAzure(text: string, voiceName: string): Promise<TtsAudio> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!key || !region) {
    throw new Error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are required for Azure TTS.');
  }

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = [
    '<speak version="1.0" xml:lang="zh-CN">',
    `<voice xml:lang="zh-CN" name="${escapeXml(voiceName)}">`,
    escapeXml(text),
    '</voice>',
    '</speak>',
  ].join('');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': key,
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'language-hsk-lyly',
    },
    body: ssml,
  });

  if (!response.ok) {
    throw new Error(`Azure TTS failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    audioBuffer: Buffer.from(arrayBuffer),
    mimeType: 'audio/mpeg',
    provider: 'azure',
  };
}

async function synthesizeWithGoogleTranslate(text: string): Promise<TtsAudio> {
  const safeText = text.slice(0, 200);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=zh-CN&client=tw-ob`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Translate TTS failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    audioBuffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') || 'audio/mpeg',
    provider: 'google-translate',
  };
}

function normalizeProvider(value: unknown): TtsProvider {
  if (value === 'azure' || value === 'google-translate') return value;
  return 'edge';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
