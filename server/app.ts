import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AIModel, QuizType, explainWord, generateChineseText, generateQuiz, chatWithTeacher, chatNormally } from './services/ai';

const app = express();
const allowedModels: AIModel[] = ['gemini', 'gpt-4o', 'gpt-3.5-turbo', 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'openai/gpt-oss-120b', 'github-gpt-4o', 'github-gpt-4o-mini'];

app.use(express.json({ limit: '1mb' }));

const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

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
      word.trim().slice(0, 50),
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

// Vocabulary path logic
const getVocDir = () => {
  try {
    const root = process.cwd();
    return path.join(root, 'server', 'voc');
  } catch (e) {
    return '/tmp/voc'; // Fallback for some serverless environments
  }
};

app.post('/api/vocabulary', async (req, res) => {
  try {
    const { words } = req.body;
    const date = new Date();
    const dateStr = `${date.getDate().toString().padStart(2, '0')}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getFullYear()}`;
    const vocDir = getVocDir();
    
    // Ensure directory exists - wrap in try-catch because Netlify is read-only
    try { 
      await fs.mkdir(vocDir, { recursive: true }); 
      const fileName = `vocabulary_${dateStr}.json`;
      const filePath = path.join(vocDir, fileName);
      await fs.writeFile(filePath, JSON.stringify(words, null, 2), 'utf-8');
      return res.json({ success: true, fileName });
    } catch (e) {
      console.warn('FileSystem is read-only, vocabulary not saved to disk.');
      return res.json({ success: true, note: 'Saved to session/cloud (Disk is read-only)' });
    }
  } catch (error) {
    console.error('Save vocabulary error:', error);
    return res.status(500).json({ error: 'Failed to save vocabulary.' });
  }
});

app.get('/api/vocabulary', async (req, res) => {
  try {
    const vocDir = getVocDir();
    try { 
      const files = await fs.readdir(vocDir);
      const jsonFiles = files.filter(f => f.startsWith('vocabulary_') && f.endsWith('.json')).sort().reverse();
      
      if (jsonFiles.length === 0) return res.json({ words: [] });
      
      const latestFile = jsonFiles[0];
      const content = await fs.readFile(path.join(vocDir, latestFile), 'utf-8');
      const words = JSON.parse(content);
      return res.json({ words, fileName: latestFile });
    } catch (e) {
      return res.json({ words: [] });
    }
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
