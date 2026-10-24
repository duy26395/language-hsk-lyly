import { Router } from 'express';
import {
  explainWord,
  explainWordFastest,
  generateChineseText,
  generateQuiz,
  chatWithTeacher,
  chatNormally,
  summarizeChatHistory,
  generateInterviewQuestion,
  evaluateInterview,
  AIModel,
  QuizType,
} from '../services/ai';
import {
  createExplainCacheKey,
  getExplainCache,
  setExplainCache,
} from '../cache/explain-cache';
import { ALLOWED_MODELS, DEFAULT_MODEL } from '../constants';

const router = Router();

function normalizeModel(model: unknown): AIModel {
  return ALLOWED_MODELS.includes(model as AIModel)
    ? (model as AIModel)
    : DEFAULT_MODEL;
}

function sanitizeChatHistory(history: unknown, maxMessages = 12) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (item: any) =>
        item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string',
    )
    .slice(-maxMessages)
    .map((item: any) => ({
      role: item.role as 'user' | 'assistant',
      content: item.content.slice(0, 3000),
    }))
    .filter((item) => item.content.trim());
}

router.post('/explain-word', async (req, res) => {
  try {
    const { word, context, model, race } = req.body as {
      word?: unknown;
      context?: unknown;
      model?: unknown;
      race?: unknown;
    };

    if (typeof word !== 'string' || !word.trim()) {
      return res.status(400).json({ error: 'word is required.' });
    }

    if (typeof context !== 'string') {
      return res.status(400).json({ error: 'context must be a string.' });
    }

    const safeWord = word.trim().slice(0, 500);
    const safeContext = context.slice(0, 1000);
    const safeModel = normalizeModel(model);
    const useRace = race === true;
    const cacheKey = createExplainCacheKey(
      safeWord,
      safeContext,
      safeModel,
      useRace,
    );
    const cached = getExplainCache(cacheKey);
    if (cached !== undefined) {
      return res.json({ result: cached, cached: true });
    }

    const { result, model: resolvedModel } = useRace
      ? await explainWordFastest(safeWord, safeContext, safeModel)
      : {
          result: await explainWord(safeWord, safeContext, safeModel),
          model: safeModel,
        };
    setExplainCache(cacheKey, result);
    return res.json({ result, resolvedModel, race: useRace });
  } catch (error) {
    console.error('/api/explain-word error:', error);
    return res.status(500).json({ error: 'Failed to explain word.' });
  }
});

router.post('/generate-text', async (req, res) => {
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

router.post('/generate-quiz', async (req, res) => {
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

    const safeCount =
      typeof questionCount === 'number'
        ? Math.min(Math.max(questionCount, 1), 10)
        : 5;
    const safeQuizType: QuizType =
      quizType === 'listening' ? 'listening' : 'general';

    const result = await generateQuiz(
      hskLevel,
      topic,
      safeCount,
      normalizeModel(model),
      safeQuizType,
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/generate-quiz error:', error);
    return res.status(500).json({ error: 'Failed to generate quiz.' });
  }
});

router.post('/interview-question', async (req, res) => {
  try {
    const { hskLevel, topic, turns, questionNumber, totalQuestions, model } =
      req.body as {
        hskLevel?: unknown;
        topic?: unknown;
        turns?: unknown;
        questionNumber?: unknown;
        totalQuestions?: unknown;
        model?: unknown;
      };

    if (typeof hskLevel !== 'number' || hskLevel < 1 || hskLevel > 6) {
      return res.status(400).json({ error: 'hskLevel must be 1 to 6.' });
    }

    if (typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'topic must be a string.' });
    }

    const safeTurns = Array.isArray(turns) ? turns : [];
    const safeQuestionNumber =
      typeof questionNumber === 'number'
        ? Math.min(Math.max(questionNumber, 1), 10)
        : 1;
    const safeTotalQuestions =
      typeof totalQuestions === 'number'
        ? Math.min(Math.max(totalQuestions, 1), 10)
        : 5;
    const result = await generateInterviewQuestion(
      hskLevel,
      topic.trim().slice(0, 120),
      safeTurns as any,
      safeQuestionNumber,
      safeTotalQuestions,
      normalizeModel(model),
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/interview-question error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to generate interview question.' });
  }
});

router.post('/evaluate-interview', async (req, res) => {
  try {
    const { hskLevel, topic, turns, model } = req.body as {
      hskLevel?: unknown;
      topic?: unknown;
      turns?: unknown;
      model?: unknown;
    };

    if (typeof hskLevel !== 'number' || hskLevel < 1 || hskLevel > 6) {
      return res.status(400).json({ error: 'hskLevel must be 1 to 6.' });
    }

    if (typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'topic must be a string.' });
    }

    if (!Array.isArray(turns)) {
      return res.status(400).json({ error: 'turns must be an array.' });
    }

    const result = await evaluateInterview(
      hskLevel,
      topic.trim().slice(0, 120),
      turns as any,
      normalizeModel(model),
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/evaluate-interview error:', error);
    return res.status(500).json({ error: 'Failed to evaluate interview.' });
  }
});

router.post('/chat-teacher', async (req, res) => {
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
      sanitizeChatHistory(history),
      typeof hskLevel === 'string' ? hskLevel : 'HSK 3',
      normalizeModel(model),
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/chat-teacher error:', error);
    return res.status(500).json({ error: 'Failed to chat with teacher.' });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { message, history, model, summary } = req.body as {
      message?: unknown;
      history?: unknown;
      model?: unknown;
      summary?: unknown;
    };

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required.' });
    }

    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'history must be an array.' });
    }

    const result = await chatNormally(
      message,
      sanitizeChatHistory(history),
      normalizeModel(model),
      typeof summary === 'string' ? summary.slice(0, 5000) : '',
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/chat error:', error);
    return res.status(500).json({ error: 'Failed to chat.' });
  }
});

router.post('/chat-summary', async (req, res) => {
  try {
    const { messages, previousSummary, model } = req.body as {
      messages?: unknown;
      previousSummary?: unknown;
      model?: unknown;
    };

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages must be an array.' });
    }

    const result = await summarizeChatHistory(
      sanitizeChatHistory(messages, 24),
      typeof previousSummary === 'string' ? previousSummary.slice(0, 5000) : '',
      normalizeModel(model),
    );
    return res.json({ result });
  } catch (error) {
    console.error('/api/chat-summary error:', error);
    return res.status(500).json({ error: 'Failed to summarize chat.' });
  }
});

export { router as aiRouter };
