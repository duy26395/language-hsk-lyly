import { Router } from 'express';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { db, initDb } from '../services/db';

const router = Router();

// Initialize DB once on module load and let route handlers await the result.
// PERF: `initDb` runs 6 DDL statements sequentially.  On Netlify Serverless
// every cold start re-executed them, adding 300-800ms before the first API
// response.  The promise is shared so parallel requests don't race.
const dbReady = initDb().catch((err) => {
  console.error('DB Init Error:', err);
  throw err;
});

// ─── Vocabulary path helpers ──────────────────────────────────────────────────

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
    return '/tmp/language-hsk-lyly-voc';
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

// ─── word_json column ─────────────────────────────────────────────────────────
// The `word_json` column stores the full SavedWordEntry as JSON, preserving
// pinyin, meaning, etc. across DB round-trips.

const normalizeNotebookRows = (rows: any[]) => {
  const words = rows
    .filter((row) => row.type === 'words' && typeof row.data === 'string')
    .map((row) => {
      if (row.word_json) {
        try {
          const parsed = JSON.parse(row.word_json);
          if (parsed && typeof parsed.word === 'string') return parsed;
        } catch {}
      }
      return createMinimalWord(row.data, Number(row.saved_at ?? Date.now()));
    });

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

// ─── saveNotebookRows ─────────────────────────────────────────────────────────
// PERF FIX: The previous implementation issued one INSERT per row inside a
// for-await loop inside a transaction.  With 30 words + 10 passages that meant
// ~40 sequential round-trips to Neon Postgres (~80–120ms each = 4-5s total).
//
// New approach: build a single batch INSERT per entity type using
// parameterised placeholders ($1,$2,…) – one network round-trip per type,
// regardless of item count.
const saveNotebookRows = async (
  words: any[],
  passages: any[],
  notes: any[],
) => {
  await dbReady;
  await db.transaction(async (execute) => {
    // Clear existing rows
    await execute('DELETE FROM notebook');

    // ── Batch-insert words ──────────────────────────────────────────────────
    const validWords = words.filter(
      (w) => w && typeof w.word === 'string' && w.word.trim(),
    );
    if (validWords.length > 0) {
      const placeholders = validWords
        .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
        .join(', ');
      const args = validWords.flatMap((w) => [
        'words',
        w.word.trim(),
        Number(w.savedAt ?? Date.now()),
        JSON.stringify(w),
      ]);
      await execute({
        sql: `INSERT INTO notebook (type, data, saved_at, word_json) VALUES ${placeholders}`,
        args,
      });
    }

    // ── Batch-insert passages ───────────────────────────────────────────────
    const validPassages = passages.filter(
      (p) => p && typeof p.text === 'string' && p.text.trim(),
    );
    if (validPassages.length > 0) {
      const placeholders = validPassages
        .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
        .join(', ');
      const args = validPassages.flatMap((p) => [
        'passages',
        p.text.trim(),
        Number(p.savedAt ?? Date.now()),
      ]);
      await execute({
        sql: `INSERT INTO notebook (type, data, saved_at) VALUES ${placeholders}`,
        args,
      });
    }

    // ── Batch-insert notes ──────────────────────────────────────────────────
    const validNotes = notes.filter(
      (n) => n && typeof n.content === 'string' && n.content.trim(),
    );
    if (validNotes.length > 0) {
      const placeholders = validNotes
        .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
        .join(', ');
      const args = validNotes.flatMap((n) => [
        'notes',
        n.content.trim(),
        Number(n.savedAt ?? Date.now()),
      ]);
      await execute({
        sql: `INSERT INTO notebook (type, data, saved_at) VALUES ${placeholders}`,
        args,
      });
    }
  });
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

const loadLatestVocabularyData = async () => {
  try {
    await dbReady;
    const notebookResult = await db.execute(
      'SELECT id, type, data, saved_at, word_json FROM notebook ORDER BY saved_at DESC, id DESC'
    );

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

router.post('/vocabulary', async (req, res) => {
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

router.get('/vocabulary', async (_req, res) => {
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

export { router as vocabularyRouter };
