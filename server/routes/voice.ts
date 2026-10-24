import { Router } from 'express';
import { runSpeakPipeline, sanitizeVoiceHistory } from '../services/voice-pipeline';
import { normalizeChineseVoice, synthesizeChineseSpeech } from '../services/tts-provider';

const router = Router();

router.post('/speak', async (req, res) => {
  try {
    const { audio, history, hskLevel, ttsVoice, fileName, summary } = req.body as {
      audio?: string;       // base64 encoded audio
      history?: unknown;
      hskLevel?: unknown;
      ttsVoice?: unknown;
      fileName?: unknown;
      summary?: unknown;
    };

    if (typeof audio !== 'string' || !audio) {
      return res.status(400).json({ error: 'audio (base64) is required.' });
    }

    const audioBuffer = Buffer.from(audio, 'base64');
    if (audioBuffer.byteLength === 0 || audioBuffer.byteLength > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'Audio is empty or too large.' });
    }

    const chatHistory = sanitizeVoiceHistory(history);
    const level = typeof hskLevel === 'string' && /^HSK [1-6]$/.test(hskLevel) ? hskLevel : 'HSK 3';
    const voice = normalizeChineseVoice(ttsVoice);
    const name = typeof fileName === 'string' && /\.(webm|wav|mp3|ogg|m4a|flac)$/i.test(fileName) ? fileName : 'audio.webm';

    const result = await runSpeakPipeline(
      audioBuffer,
      chatHistory,
      level,
      name,
      voice,
      typeof summary === 'string' ? summary.slice(0, 5000) : '',
    );

    if (!result) {
      return res.status(422).json({ error: 'Could not process audio. Try speaking more clearly.' });
    }

    return res.json({
      userText: result.userText,
      assistantText: result.assistantText,
      feedback: result.feedback,
      audio: result.audioBuffer.toString('base64'),
      mimeType: result.mimeType,
      ttsProvider: result.ttsProvider,
    });
  } catch (error: any) {
    console.error('/api/speak error:', error);
    return res.status(500).json({ error: 'Voice pipeline failed: ' + (error.message || 'Unknown error') });
  }
});

router.post('/tts', async (req, res) => {
  try {
    const { text, ttsVoice } = req.body as { text?: unknown, ttsVoice?: unknown };

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required.' });
    }

    const voice = normalizeChineseVoice(ttsVoice);
    const audio = await synthesizeChineseSpeech(text.trim().slice(0, 2000), voice);
    return res.json({
      audio: audio.audioBuffer.toString('base64'),
      mimeType: audio.mimeType,
      ttsProvider: audio.provider,
    });
  } catch (error: any) {
    console.error('/api/tts error:', error);
    return res.status(500).json({ error: 'TTS failed: ' + (error.message || 'Unknown error') });
  }
});

export { router as voiceRouter };
