import 'dotenv/config';
import express from 'express';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { AIModel, QuizType, explainWord, generateChineseText, generateQuiz, chatWithTeacher, chatNormally } from './services/ai';

import { runSpeakPipeline } from './services/voice-pipeline';
import { normalizeChineseVoice, synthesizeChineseSpeech } from './services/tts-provider';
import { db, initDb } from './services/db';

// Initialize DB on start and let DB-backed routes wait for it.
const dbReady = initDb().catch(err => {
  console.error('DB Init Error:', err);
  throw err;
});

const app = express();
const allowedModels: AIModel[] = ['gemini', 'gpt-4o', 'gpt-3.5-turbo', 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'openai/gpt-oss-120b', 'github-gpt-4o', 'github-gpt-4o-mini'];

app.use(express.json({ limit: '10mb' }));

const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 200;

app.use('/api', (req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const bucket = requestBuckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    requestBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res
      .status(429)
      .json({ error: 'Too many requests. Please try again later.' });
  }

  bucket.count += 1;
  return next();
});

function normalizeModel(model: unknown): AIModel {
  return allowedModels.includes(model as AIModel)
    ? (model as AIModel)
    : 'qwen/qwen3-32b';
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/explain-word', async (req, res) => {
  try {
    const { word, context, model } = req.body as {
      word?: unknown;
      context?: unknown;
      model?: unknown;
    };

    if (typeof word !== 'string' || !word.trim()) {
      return res.status(400).json({ error: 'word is required.' });
    }

    if (typeof context !== 'string') {
      return res.status(400).json({ error: 'context must be a string.' });
    }

    const result = await explainWord(
      word.trim().slice(0, 500),
      context.slice(0, 1000),
      normalizeModel(model),
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/explain-word error:', error);
    return res.status(500).json({ error: 'Failed to explain word.' });
  }
});

app.post('/api/generate-text', async (req, res) => {
  try {
    const { words, hskLevel, model } = req.body as {
      words?: unknown;
      hskLevel?: unknown;
      model?: unknown;
    };

    if (
      !Array.isArray(words) ||
      !words.every((word) => typeof word === 'string')
    ) {
      return res
        .status(400)
        .json({ error: 'words must be an array of strings.' });
    }

    if (typeof hskLevel !== 'string' || !/^HSK [1-6]$/.test(hskLevel)) {
      return res
        .status(400)
        .json({ error: 'hskLevel must be HSK 1 to HSK 6.' });
    }

    const cleanedWords = words
      .map((word) => word.trim())
      .filter(Boolean)
      .slice(0, 20);
    const result = await generateChineseText(
      cleanedWords,
      hskLevel,
      normalizeModel(model),
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/generate-text error:', error);
    return res.status(500).json({ error: 'Failed to generate text.' });
  }
});

app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { hskLevel, topic, questionCount, model, quizType } = req.body as {
      hskLevel?: unknown;
      topic?: unknown;
      questionCount?: unknown;
      model?: unknown;
      quizType?: unknown;
    };

    if (typeof hskLevel !== 'number' || hskLevel < 1 || hskLevel > 6) {
      return res.status(400).json({ error: 'hskLevel must be 1 to 6.' });
    }

    if (typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'topic must be a string.' });
    }

    const safeCount = typeof questionCount === 'number' ? Math.min(Math.max(questionCount, 1), 10) : 5;
    const safeQuizType: QuizType = quizType === 'listening' ? 'listening' : 'general';

    const result = await generateQuiz(hskLevel, topic, safeCount, normalizeModel(model), safeQuizType);
    return res.json({ result });
  } catch (error) {
    console.error('/api/generate-quiz error:', error);
    return res.status(500).json({ error: 'Failed to generate quiz.' });
  }
});

app.post('/api/chat-teacher', async (req, res) => {
  try {
    const { message, history, hskLevel, model } = req.body as {
      message?: unknown;
      history?: unknown;
      hskLevel?: unknown;
      model?: unknown;
    };

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required.' });
    }

    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'history must be an array.' });
    }

    const result = await chatWithTeacher(
      message,
      history,
      typeof hskLevel === 'string' ? hskLevel : 'HSK 3',
      normalizeModel(model)
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/chat-teacher error:', error);
    return res.status(500).json({ error: 'Failed to chat with teacher.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, model } = req.body as {
      message?: unknown;
      history?: unknown;
      model?: unknown;
    };

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required.' });
    }

    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'history must be an array.' });
    }

    const result = await chatNormally(
      message,
      history,
      normalizeModel(model)
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/chat error:', error);
    return res.status(500).json({ error: 'Failed to chat.' });
  }
});



// ─── Voice Pipeline Endpoint (Groq STT → LLM → TTS) ──────────────────────────

app.post('/api/speak', async (req, res) => {
  try {
    const { audio, history, hskLevel, ttsVoice, fileName } = req.body as {
      audio?: string;       // base64 encoded audio
      history?: unknown;
      hskLevel?: unknown;
      ttsVoice?: unknown;
      fileName?: unknown;
    };

    if (typeof audio !== 'string' || !audio) {
      return res.status(400).json({ error: 'audio (base64) is required.' });
    }

    const audioBuffer = Buffer.from(audio, 'base64');
    if (audioBuffer.byteLength === 0 || audioBuffer.byteLength > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'Audio is empty or too large.' });
    }

    const chatHistory = Array.isArray(history)
      ? history.filter((h: any) => h.role && h.content).slice(-12)
      : [];
    const level = typeof hskLevel === 'string' && /^HSK [1-6]$/.test(hskLevel) ? hskLevel : 'HSK 3';
    const voice = normalizeChineseVoice(ttsVoice);
    const name = typeof fileName === 'string' && /\.(webm|wav|mp3|ogg|m4a|flac)$/i.test(fileName) ? fileName : 'audio.webm';

    const result = await runSpeakPipeline(audioBuffer, chatHistory, level, name, voice);

    if (!result) {
      return res.status(422).json({ error: 'Could not process audio. Try speaking more clearly.' });
    }

    return res.json({
      userText: result.userText,
      assistantText: result.assistantText,
      audio: result.audioBuffer.toString('base64'),
      mimeType: result.mimeType,
      ttsProvider: result.ttsProvider,
    });
  } catch (error: any) {
    console.error('/api/speak error:', error);
    return res.status(500).json({ error: 'Voice pipeline failed: ' + (error.message || 'Unknown error') });
  }
});

// ─── TTS-only Endpoint ────────────────────────────────────────────────────────

app.post('/api/tts', async (req, res) => {
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

// Vocabulary path logic
const getLegacyVocDir = () => {
  try {
    return path.join(process.cwd(), 'server', 'voc');
  } catch (e) {
    return null;
  }
};

const getVocDir = () => {
  try {
    const customDir = process.env.VOCABULARY_DIR?.trim();
    if (customDir) {
      return customDir;
    }

    return path.join(os.homedir(), '.language-hsk-lyly', 'voc');
  } catch (e) {
    return '/tmp/language-hsk-lyly-voc'; // Fallback for some serverless environments
  }
};

const getReadableVocDirs = () => {
  const dirs = [getVocDir(), getLegacyVocDir()].filter(Boolean) as string[];
  return [...new Set(dirs)];
};

const createMinimalWord = (word: string, savedAt: number) => ({
  word,
  savedAt,
  explanation: {
    word,
    pinyin: '',
    meaning: word,
    hskLevel: 'Saved',
    learningTip: '',
    example: word,
    exampleMeaning: '',
  },
});

const normalizeNotebookRows = (rows: any[]) => {
  const words = rows
    .filter((row) => row.type === 'words' && typeof row.data === 'string')
    .map((row) => createMinimalWord(row.data, Number(row.saved_at ?? Date.now())));

  const passages = rows
    .filter((row) => row.type === 'passages' && typeof row.data === 'string')
    .map((row) => ({
      id: String(row.id),
      text: row.data,
      savedAt: Number(row.saved_at ?? Date.now()),
      source: 'read' as const,
    }));

  const notes = rows
    .filter((row) => row.type === 'notes' && typeof row.data === 'string')
    .map((row) => ({
      id: String(row.id),
      content: row.data,
      savedAt: Number(row.saved_at ?? Date.now()),
    }));

  return { words, passages, notes };
};

const saveNotebookRows = async (
  words: any[],
  passages: any[],
  notes: any[],
) => {
  await dbReady;
  await db.transaction(async (execute) => {
    await execute('DELETE FROM notebook');

    for (const word of words) {
      if (!word || typeof word.word !== 'string' || !word.word.trim()) continue;
      await execute({
        sql: 'INSERT INTO notebook (type, data, saved_at) VALUES (?, ?, ?)',
        args: ['words', word.word.trim(), Number(word.savedAt ?? Date.now())],
      });
    }

    for (const passage of passages) {
      if (!passage || typeof passage.text !== 'string' || !passage.text.trim()) continue;
      await execute({
        sql: 'INSERT INTO notebook (type, data, saved_at) VALUES (?, ?, ?)',
        args: ['passages', passage.text.trim(), Number(passage.savedAt ?? Date.now())],
      });
    }

    for (const note of notes) {
      if (!note || typeof note.content !== 'string' || !note.content.trim()) continue;
      await execute({
        sql: 'INSERT INTO notebook (type, data, saved_at) VALUES (?, ?, ?)',
        args: ['notes', note.content.trim(), Number(note.savedAt ?? Date.now())],
      });
    }
  });
};

const loadLatestVocabularyData = async () => {
  try {
    await dbReady;
    const notebookResult = await db.execute(`
      SELECT id, type, data, saved_at FROM notebook ORDER BY saved_at DESC, id DESC
    `);

    if (notebookResult.rows.length > 0) {
      return {
        data: normalizeNotebookRows(notebookResult.rows),
        fileName: 'notebook',
      };
    }

    const candidates: Array<{ dir: string; fileName: string }> = [];

    for (const dir of getReadableVocDirs()) {
      try {
        const files = await fs.readdir(dir);
        const jsonFiles = files
          .filter(f => f.startsWith('vocabulary_') && f.endsWith('.json'))
          .sort()
          .reverse();

        if (jsonFiles[0]) {
          candidates.push({ dir, fileName: jsonFiles[0] });
        }
      } catch (e) {}
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.fileName.localeCompare(a.fileName));
    const latest = candidates[0];
    const content = await fs.readFile(path.join(latest.dir, latest.fileName), 'utf-8');
    const data = JSON.parse(content);
    const legacyData = Array.isArray(data)
      ? { words: data, passages: [], notes: [] }
      : data;

    await saveNotebookRows(
      Array.isArray(legacyData.words) ? legacyData.words : [],
      Array.isArray(legacyData.passages) ? legacyData.passages : [],
      normalizeSavedNotes(legacyData),
    );

    return {
      data: legacyData,
      fileName: latest.fileName,
    };
  } catch (error) {
    console.error('Error loading from DB:', error);
    return null;
  }
};

const normalizeSavedNotes = (data: any) => {
  if (Array.isArray(data?.notes)) {
    return data.notes
      .filter((item: any) => item && typeof item.content === 'string')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' ? item.id : `note-${index}`,
        content: item.content,
        savedAt: typeof item.savedAt === 'number' ? item.savedAt : Date.now(),
      }));
  }

  if (typeof data?.noteContent === 'string' && data.noteContent.trim()) {
    return [{
      id: typeof data?.noteSavedAt === 'number' ? `${data.noteSavedAt}` : 'legacy-note',
      content: data.noteContent,
      savedAt: typeof data?.noteSavedAt === 'number' ? data.noteSavedAt : Date.now(),
    }];
  }

  return [];
};

app.post('/api/vocabulary', async (req, res) => {
  try {
    const { words, passages, notes } = req.body as {
      words?: unknown;
      passages?: unknown;
      notes?: unknown;
    };
    const latestSnapshot = await loadLatestVocabularyData();
    const previous = latestSnapshot?.data;

    const safeWords = Array.isArray(words) ? words : [];
    const safePassages = Array.isArray(passages) ? passages : [];
    const safeNotes = Array.isArray(notes)
      ? notes
          .filter((item: any) => item && typeof item.content === 'string')
          .map((item: any, index: number) => ({
            id: typeof item.id === 'string' ? item.id : `note-${Date.now()}-${index}`,
            content: item.content,
            savedAt: typeof item.savedAt === 'number' ? item.savedAt : Date.now(),
          }))
      : normalizeSavedNotes(previous);

    try {
      await saveNotebookRows(safeWords, safePassages, safeNotes);
      return res.json({ success: true, notes: safeNotes });
    } catch (e) {
      console.error('Database save error:', e);
      return res.status(500).json({ error: 'Failed to save vocabulary to database.' });
    }
  } catch (error) {
    console.error('Save vocabulary error:', error);
    return res.status(500).json({ error: 'Failed to save vocabulary.' });
  }
});

app.get('/api/vocabulary', async (_req, res) => {
  try {
    const latest = await loadLatestVocabularyData();

    if (!latest) {
      return res.json({ words: [], passages: [], notes: [] });
    }
    const data = latest.data;

    // Support old format (plain array) and new format ({ words, passages })
    if (Array.isArray(data)) {
      return res.json({ words: data, passages: [], notes: [], fileName: latest.fileName });
    }

    return res.json({
      words: Array.isArray(data.words) ? data.words : [],
      passages: Array.isArray(data.passages) ? data.passages : [],
      notes: normalizeSavedNotes(data),
      fileName: latest.fileName,
    });
  } catch (error) {
    console.error('Load vocabulary error:', error);
    return res.status(500).json({ error: 'Failed to load vocabulary.' });
  }
});

// Serve static files logic - only for local dev
// On Netlify, redirects in netlify.toml handle this.
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

// For SPA routing locally
app.get(/^(?!\/api).+/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (!error) return;
    // If dist doesn't exist (like on Netlify functions), just return 404 for non-API
    res.status(404).send('Not found');
  });
});

export { app };
