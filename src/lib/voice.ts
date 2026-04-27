/**
 * Voice pipeline client — calls the backend Groq STT → LLM → TTS pipeline.
 */

interface SpeakResult {
  userText: string;
  assistantText: string;
  /** base64 encoded audio */
  audio: string;
  mimeType?: string;
  ttsProvider?: string;
}

interface TtsResult {
  audio: string;
  mimeType?: string;
  ttsProvider?: string;
}

/**
 * Send recorded audio to the backend voice pipeline.
 * Returns the user transcript, AI reply text, and AI reply audio (base64 WAV).
 */
export async function speakToTeacher(
  audioBlob: Blob,
  history: { role: 'user' | 'assistant'; content: string }[],
  hskLevel: string,
  ttsVoice: string = 'zh-CN-XiaoxiaoNeural'
): Promise<SpeakResult | null> {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
    );

    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: base64,
        history,
        hskLevel,
        ttsVoice,
        fileName: getAudioFileName(audioBlob.type),
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('Speak API error:', response.status, errBody);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Speak API error:', error);
    return null;
  }
}

/**
 * Call the TTS-only endpoint to generate speech from text.
 * Returns base64 WAV audio.
 */
export async function textToSpeech(text: string, ttsVoice: string = 'zh-CN-XiaoxiaoNeural'): Promise<TtsResult | null> {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ttsVoice }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.audio ? data : null;
  } catch (error) {
    console.error('TTS API error:', error);
    return null;
  }
}


// ─── Audio Recording Helper ──────────────────────────────────────────────────

export class AudioPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private resolveCurrent: (() => void) | null = null;

  playBase64(base64Audio: string, format: string = 'audio/wav'): Promise<void> {
    this.stop();

    return new Promise((resolve, reject) => {
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: format });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        this.currentAudio = audio;
        this.currentUrl = url;
        this.resolveCurrent = resolve;

        const cleanup = () => {
          if (this.currentAudio === audio) {
            this.currentAudio = null;
            this.resolveCurrent = null;
          }
          URL.revokeObjectURL(url);
          if (this.currentUrl === url) {
            this.currentUrl = null;
          }
        };

        audio.onended = () => {
          cleanup();
          resolve();
        };
        audio.onerror = (event) => {
          cleanup();
          reject(event);
        };
        audio.play().catch((error) => {
          cleanup();
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.removeAttribute('src');
      this.currentAudio.load();
      this.currentAudio = null;
    }

    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }

    this.resolveCurrent?.();
    this.resolveCurrent = null;
  }
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Prefer webm/opus, fallback to whatever is available
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('Recorder is not active'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder!.mimeType });
        this.cleanup();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

function getAudioFileName(mimeType: string): string {
  if (mimeType.includes('webm')) return 'audio.webm';
  if (mimeType.includes('ogg')) return 'audio.ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'audio.m4a';
  if (mimeType.includes('wav')) return 'audio.wav';
  return 'audio.webm';
}
