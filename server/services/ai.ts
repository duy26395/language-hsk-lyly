import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

export type AIModel = 'gemini' | 'gpt-4o' | 'gpt-3.5-turbo' | 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile' | 'qwen/qwen3-32b' | 'meta-llama/llama-4-scout-17b-16e-instruct' | 'openai/gpt-oss-120b' | 'github-gpt-4o' | 'github-gpt-4o-mini';

const GROQ_PRIORITY_LIST: AIModel[] = [
  'qwen/qwen3-32b',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
  'llama-3.1-8b-instant'
];

interface ExplainWordOptions {
  fallbackGroq?: boolean;
}

export interface WordExplanation {
  word: string;
  pinyin: string;
  meaning: string;
  meanings?: string[];
  pronunciations?: string[];
  hskLevel: string;
  radical?: string;
  strokes?: string;
  decomposition?: string[];
  grammarFocus?: string[];
  commonPatterns?: {
    pattern: string;
    meaning: string;
    example: string;
    examplePinyin?: string;
    exampleMeaning: string;
  }[];
  commonMistakes?: string[];
  learningTip: string;
  usage?: string;
  usageExamples?: string[];
  videoLinks?: { title: string; url: string }[];
  example: string;
  examplePinyin?: string;
  exampleMeaning: string;
  synonyms?: string;
  antonyms?: string;
}

// API keys are accessed via process.env inside getter functions to ensure they are loaded after dotenv.

let openai: OpenAI | null = null;
let groq: OpenAI | null = null;
let github: OpenAI | null = null;
const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
] as const;

const WORD_EXPLANATION_FIELDS = [
  'word',
  'pinyin',
  'meaning',
  'meanings',
  'pronunciations',
  'hskLevel',
  'radical',
  'strokes',
  'decomposition',
  'grammarFocus',
  'commonPatterns',
  'commonMistakes',
  'learningTip',
  'usage',
  'usageExamples',
  'videoLinks',
  'example',
  'examplePinyin',
  'exampleMeaning',
  'synonyms',
  'antonyms',
].join(',');

const EXPLAIN_WORD_SYSTEM_PROMPT =
  'Chinese dictionary assistant. Return only valid JSON. Vietnamese for meanings, usage, tips, mistakes, pattern notes, and exampleMeaning. No reasoning.';

function createExplainWordPrompt(word: string, contextContext: string) {
  return [
    `Input=${JSON.stringify(word)}.`,
    `Context=${JSON.stringify(contextContext)}.`,
    `Return JSON with fields: ${WORD_EXPLANATION_FIELDS}.`,
    'Use empty strings/arrays if unknown.',
    'pronunciations: all valid pinyin/readings, including main pinyin and alternates.',
    'commonPatterns items: {pattern,meaning,example,examplePinyin,exampleMeaning}.',
    'videoLinks: 0-3 https YouTube/Bilibili links only.',
    'Prioritize Hanzi dictionary analysis, common Vietnamese meanings, practical usage, grammar, learner mistakes.',
  ].join(' ');
}

function getOpenAI() {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server.');
  }

  if (!openai) {
    openai = new OpenAI({ apiKey: openAiApiKey });
  }

  return openai;
}

function getGemini() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  return new GoogleGenAI({ apiKey: geminiApiKey });
}

function getGroq() {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }

  if (!groq) {
    groq = new OpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  return groq;
}

function getGithub() {
  const githubApiKey = process.env.GITHUB_API_KEY;
  if (!githubApiKey) {
    throw new Error('GITHUB_API_KEY is not configured on the server.');
  }

  if (!github) {
    github = new OpenAI({
      apiKey: githubApiKey,
      baseURL: 'https://models.inference.ai.azure.com',
    });
  }

  return github;
}

function hasProviderForModel(model: AIModel) {
  if (model === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  if (model.startsWith('github-')) return Boolean(process.env.GITHUB_API_KEY);
  if (GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant') {
    return Boolean(process.env.GROQ_API_KEY);
  }
  return Boolean(process.env.OPENAI_API_KEY);
}

function getExplainRaceModels(preferredModel: AIModel) {
  const candidates: AIModel[] = [];
  const add = (model: AIModel) => {
    if (candidates.includes(model) || !hasProviderForModel(model)) return;
    candidates.push(model);
  };

  add(preferredModel);
  add('qwen/qwen3-32b');
  add('llama-3.1-8b-instant');
  add('gemini');
  add('github-gpt-4o-mini');
  add('gpt-3.5-turbo');

  return candidates.slice(0, 3);
}

function cleanThinkingTags(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function cleanJsonContent(content: string): string {
  const noThinking = cleanThinkingTags(content);
  return noThinking.replace(/```json\n?|```/g, '').trim();
}

async function generateGeminiContentWithFallback(
  contents: any,
  config?: Record<string, any>,
): Promise<any> {
  const client = getGemini();
  let lastError: any = null;

  for (const geminiModel of GEMINI_MODEL_FALLBACKS) {
    try {
      return await client.models.generateContent({
        model: geminiModel,
        contents,
        ...(config ? { config } : {}),
      });
    } catch (error: any) {
      lastError = error;
      const status = error?.status;
      const message = error?.message || '';
      const missingModel = status === 404 || /not found|not supported/i.test(message);
      if (!missingModel) throw error;
      console.warn(`Gemini model ${geminiModel} unavailable, trying fallback.`);
    }
  }

  throw lastError;
}

export async function explainWord(
  word: string,
  contextContext: string,
  model: AIModel = 'gemini',
  options: ExplainWordOptions = {},
): Promise<WordExplanation | null> {
  const explainPrompt = createExplainWordPrompt(word, contextContext);

  if (model === 'gemini') {
    const result = await generateGeminiContentWithFallback(
      [{ role: 'user', parts: [{ text: `${EXPLAIN_WORD_SYSTEM_PROMPT} ${explainPrompt}` }] }],
      { responseMimeType: 'application/json' },
    );

    const jsonStr = cleanJsonContent(result.text || '{}');
    const parsed = JSON.parse(jsonStr) as any;
    return normalizeWordExplanation(parsed);
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;
  
  if (isGroq) {
    const modelsToTry = options.fallbackGroq === false
      ? [model]
      : [model, ...GROQ_PRIORITY_LIST.filter(m => m !== model)];
    let lastError: any = null;

    for (const groqModel of modelsToTry) {
      try {
        const client = getGroq();
        const response = await client.chat.completions.create({
          model: groqModel,
          messages: [
            {
              role: 'system',
              content: EXPLAIN_WORD_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: explainPrompt,
            },
          ],
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        if (!content) continue;
        const result = JSON.parse(cleanJsonContent(content));
        return normalizeWordExplanation(result);
      } catch (e: any) {
        lastError = e;
        console.warn(`Groq model ${groqModel} failed: ${e.message}`);
        // Continue to try next model regardless of error type
      }
    }
    console.error('All Groq models failed:', lastError);
    return null; // Return null instead of throwing to prevent server crash and allow client to handle it
  }

  const client = isGithub ? getGithub() : getOpenAI();
  const response = await client.chat.completions.create({
    model: actualModel,
    messages: [
      {
        role: 'system',
        content: EXPLAIN_WORD_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: explainPrompt,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) return null;
  try {
    const result = JSON.parse(cleanJsonContent(content));
    return normalizeWordExplanation(result);
  } catch (e) {
    console.error('JSON Parse Error:', e, content);
    return null;
  }
}

export async function explainWordFastest(
  word: string,
  contextContext: string,
  preferredModel: AIModel = 'gemini',
): Promise<{ result: WordExplanation | null; model: AIModel }> {
  const raceModels = getExplainRaceModels(preferredModel);

  if (raceModels.length <= 1) {
    return {
      result: await explainWord(word, contextContext, preferredModel),
      model: preferredModel,
    };
  }

  const attempts = raceModels.map(async (raceModel) => {
    const result = await explainWord(word, contextContext, raceModel, { fallbackGroq: false });
    if (!result) {
      throw new Error(`No explanation from ${raceModel}`);
    }
    return { result, model: raceModel };
  });

  try {
    return await Promise.any(attempts);
  } catch (error) {
    console.warn('All explain-word race models failed, falling back to preferred model:', error);
    return {
      result: await explainWord(word, contextContext, preferredModel),
      model: preferredModel,
    };
  }
}

export async function generateChineseText(
  words: string[],
  hskLevel: string,
  model: AIModel = 'gemini',
): Promise<string | null> {
  const prompt =
    words.length > 0
      ? `Write a short, engaging Chinese paragraph at the ${hskLevel} level using these specific words: ${words.join(', ')}. Return only the Chinese text. Do not include any thinking, reasoning, or English translation.`
      : `Write a short, engaging Chinese paragraph at the ${hskLevel} level using random appropriate vocabulary for this level. Return only the Chinese text. Do not include any thinking, reasoning, or English translation.`;

  if (model === 'gemini') {
    const result = await generateGeminiContentWithFallback([
      { role: 'user', parts: [{ text: prompt }] },
    ]);
    return cleanThinkingTags(result.text || '').trim() || null;
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;

  if (isGroq) {
    const modelsToTry = [model, ...GROQ_PRIORITY_LIST.filter(m => m !== model)];
    let lastError: any = null;

    for (const groqModel of modelsToTry) {
      try {
        const client = getGroq();
        const response = await client.chat.completions.create({
          model: groqModel,
          messages: [{ role: 'user', content: prompt }],
        });
        return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
      } catch (e: any) {
        lastError = e;
        console.warn(`Groq model ${groqModel} failed: ${e.message}`);
      }
    }
    console.error('All Groq models failed for generateChineseText:', lastError);
    return null;
  }

  const client = isGithub ? getGithub() : getOpenAI();
  const response = await client.chat.completions.create({
    model: actualModel,
    messages: [{ role: 'user', content: prompt }],
  });

  return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  dialogue?: string;
}

export type QuizType = 'general' | 'listening';

export interface InterviewTurn {
  question: string;
  answer: string;
  speechConfidence?: number;
}

export interface InterviewEvaluation {
  overallScore: number;
  estimatedHskLevel: string;
  grammarScore: number;
  pronunciationScore: number;
  fluencyScore: number;
  strengths: string[];
  improvements: string[];
  grammarFeedback: string;
  pronunciationFeedback: string;
  nextPractice: string[];
}

export async function generateQuiz(
  hskLevel: number,
  topic: string,
  questionCount: number = 5,
  model: AIModel = 'gemini',
  quizType: QuizType = 'general',
): Promise<QuizQuestion[] | null> {
  const prompt = quizType === 'listening'
    ? `Generate a Chinese listening comprehension quiz at the HSK ${hskLevel} level about the topic: "${topic}". First write one short natural Chinese dialogue between two people appropriate for HSK ${hskLevel}. Use Chinese speaker names like "小李：" and "小王：" and keep it easy to read aloud. Then create ${questionCount} multiple-choice questions based ONLY on that dialogue. Provide the response as a JSON object with "dialogue" (string in Chinese) and "questions" (array of objects). Each question object must have: "question" (string in Chinese), "options" (array of 2 to 4 strings in Chinese), and "correctAnswerIndex" (integer). Respond ONLY with the JSON object. Do not include reasoning process or <think> tags.`
    : `Generate a ${questionCount}-question Chinese quiz at the HSK ${hskLevel} level about the topic: "${topic}". Include diverse question types (e.g., multiple choice, true/false, fill in the blanks, matching translations) where applicable. Provide the response as a JSON object containing a single key "questions", which is an array of objects. Each object must have: "question" (string in Chinese), "options" (array of 2 to 4 strings in Chinese), and "correctAnswerIndex" (integer). Respond ONLY with the JSON object. Do not include reasoning process or <think> tags.`;

  const normalizeQuizResponse = (parsed: any): QuizQuestion[] => {
    const dialogue = typeof parsed?.dialogue === 'string'
      ? parsed.dialogue.trim()
      : typeof parsed?.passage === 'string'
        ? parsed.passage.trim()
        : '';
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    return questions.map((question: any) => ({
      question: String(question.question || ''),
      options: Array.isArray(question.options) ? question.options.map((option: any) => String(option)) : [],
      correctAnswerIndex: Number.isInteger(question.correctAnswerIndex) ? question.correctAnswerIndex : 0,
      dialogue: typeof question.dialogue === 'string' && question.dialogue.trim()
        ? question.dialogue.trim()
        : dialogue || undefined,
    }));
  };

  if (model === 'gemini') {
    const result = await generateGeminiContentWithFallback(
      [{ role: 'user', parts: [{ text: prompt }] }],
      { responseMimeType: 'application/json' },
    );

    const jsonStr = cleanJsonContent(result.text || '{"questions":[]}');
    try {
      const parsed = JSON.parse(jsonStr);
      return normalizeQuizResponse(parsed);
    } catch {
      return null;
    }
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;

  if (isGroq) {
    const modelsToTry = [model, ...GROQ_PRIORITY_LIST.filter(m => m !== model)];
    let lastError: any = null;

    for (const groqModel of modelsToTry) {
      try {
        const client = getGroq();
        const response = await client.chat.completions.create({
          model: groqModel,
          messages: [
            { role: 'system', content: 'You are a helpful Chinese language assistant. Respond ONLY with a JSON object.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        if (!content) continue;
        const parsed = JSON.parse(cleanJsonContent(content));
        return normalizeQuizResponse(parsed);
      } catch (e: any) {
        lastError = e;
        console.warn(`Groq model ${groqModel} failed: ${e.message}`);
      }
    }
    console.error('All Groq models failed for generateQuiz:', lastError);
    return null;
  }

  const client = isGithub ? getGithub() : getOpenAI();
  const response = await client.chat.completions.create({
    model: actualModel,
    messages: [
      { role: 'system', content: 'You are a helpful Chinese language assistant. Respond ONLY with a JSON object.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (content) {
    try {
      const parsed = JSON.parse(cleanJsonContent(content));
      return normalizeQuizResponse(parsed);
    } catch (e) {
      console.error('Quiz JSON Parse Error:', e, content);
      return null;
    }
  }
  return null;
}

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

  if (model === 'gemini') {
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: message }] }
    ];
    // Keep teacher prompt as first turn; fallback model chooser handles unavailable Gemini model ids.
    const result = await generateGeminiContentWithFallback(contents as any);
    return cleanThinkingTags(result.text || '').trim() || null;
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message }
  ];

  if (isGroq) {
    const modelsToTry = [model, ...GROQ_PRIORITY_LIST.filter(m => m !== model)];
    let lastError: any = null;
    for (const groqModel of modelsToTry) {
      try {
        const client = getGroq();
        const response = await client.chat.completions.create({
          model: groqModel,
          messages: messages as any,
        });
        return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
      } catch (e: any) {
        lastError = e;
        console.warn(`Groq model ${groqModel} failed for chat: ${e.message}`);
      }
    }
    console.error('All Groq models failed for chatWithTeacher:', lastError);
    return null;
  }

  const client = isGithub ? getGithub() : getOpenAI();
  const response = await client.chat.completions.create({
    model: actualModel,
    messages: messages as any,
  });

  return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
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

  if (model === 'gemini') {
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...(summaryPrompt ? [{ role: 'user', parts: [{ text: summaryPrompt }] }] : []),
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: message }] }
    ];
    const result = await generateGeminiContentWithFallback(contents as any);
    return cleanThinkingTags(result.text || '').trim() || null;
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(summaryPrompt ? [{ role: 'system', content: summaryPrompt }] : []),
    ...history,
    { role: 'user', content: message }
  ];

  if (isGroq) {
    const modelsToTry = [model, ...GROQ_PRIORITY_LIST.filter(m => m !== model)];
    let lastError: any = null;
    for (const groqModel of modelsToTry) {
      try {
        const client = getGroq();
        const response = await client.chat.completions.create({
          model: groqModel,
          messages: messages as any,
        });
        return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
      } catch (e: any) {
        lastError = e;
        console.warn(`Groq model ${groqModel} failed for normal chat: ${e.message}`);
      }
    }
    console.error('All Groq models failed for chatNormally:', lastError);
    return null;
  }

  const client = isGithub ? getGithub() : getOpenAI();
  const response = await client.chat.completions.create({
    model: actualModel,
    messages: messages as any,
  });

  return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
}

export async function summarizeChatHistory(
  messagesToSummarize: { role: 'user' | 'assistant'; content: string }[],
  previousSummary = '',
  model: AIModel = 'gemini',
): Promise<string | null> {
  const transcript = messagesToSummarize
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
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

  if (model === 'gemini') {
    const result = await generateGeminiContentWithFallback([
      { role: 'user', parts: [{ text: prompt }] },
    ]);
    return cleanThinkingTags(result.text || '').trim() || null;
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;

  if (isGroq) {
    const modelsToTry = [model, ...GROQ_PRIORITY_LIST.filter(m => m !== model)];
    let lastError: any = null;
    for (const groqModel of modelsToTry) {
      try {
        const client = getGroq();
        const response = await client.chat.completions.create({
          model: groqModel,
          messages: [{ role: 'user', content: prompt }],
        });
        return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
      } catch (e: any) {
        lastError = e;
        console.warn(`Groq model ${groqModel} failed for chat summary: ${e.message}`);
      }
    }
    console.error('All Groq models failed for summarizeChatHistory:', lastError);
    return null;
  }

  const client = isGithub ? getGithub() : getOpenAI();
  const response = await client.chat.completions.create({
    model: actualModel,
    messages: [{ role: 'user', content: prompt }],
  });

  return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
}

function normalizeInterviewTurns(turns: InterviewTurn[]): InterviewTurn[] {
  return turns
    .filter((turn) => turn && typeof turn.question === 'string' && typeof turn.answer === 'string')
    .map((turn) => ({
      question: turn.question.trim().slice(0, 500),
      answer: turn.answer.trim().slice(0, 800),
      speechConfidence: typeof turn.speechConfidence === 'number'
        ? Math.min(Math.max(turn.speechConfidence, 0), 1)
        : undefined,
    }))
    .filter((turn) => turn.question && turn.answer)
    .slice(-12);
}

function normalizeInterviewEvaluation(data: any): InterviewEvaluation {
  const numberInRange = (value: any, fallback: number) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(Math.max(Math.round(numeric), 0), 100);
  };
  const stringArray = (value: any): string[] => (
    Array.isArray(value)
      ? value.map((item) => String(item || '').trim()).filter(Boolean)
      : []
  );

  return {
    overallScore: numberInRange(data?.overallScore, 0),
    estimatedHskLevel: String(data?.estimatedHskLevel || 'HSK ?'),
    grammarScore: numberInRange(data?.grammarScore, 0),
    pronunciationScore: numberInRange(data?.pronunciationScore, 0),
    fluencyScore: numberInRange(data?.fluencyScore, 0),
    strengths: stringArray(data?.strengths),
    improvements: stringArray(data?.improvements),
    grammarFeedback: String(data?.grammarFeedback || ''),
    pronunciationFeedback: String(data?.pronunciationFeedback || ''),
    nextPractice: stringArray(data?.nextPractice),
  };
}

export async function generateInterviewQuestion(
  hskLevel: number,
  topic: string,
  turns: InterviewTurn[],
  questionNumber: number,
  totalQuestions: number,
  model: AIModel = 'gemini',
): Promise<string | null> {
  const safeTurns = normalizeInterviewTurns(turns);
  const historyText = safeTurns.length
    ? safeTurns.map((turn, index) => `Q${index + 1}: ${turn.question}\nA${index + 1}: ${turn.answer}`).join('\n')
    : 'No answers yet.';
  const systemPrompt = `You are a friendly Chinese HSK interview teacher.
Ask exactly one interview question in Simplified Chinese.
Match HSK ${hskLevel}. Topic: ${topic}.
Question ${questionNumber} of ${totalQuestions}.
Use natural teacher language, keep it short, and adapt to the learner's previous answers.
Return only the Chinese question, no pinyin, no translation, no explanation, no <think> tags.`;
  const userPrompt = `Previous interview:\n${historyText}\n\nAsk the next question now.`;

  if (model === 'gemini') {
    const result = await generateGeminiContentWithFallback([
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'user', parts: [{ text: userPrompt }] },
    ]);
    return cleanThinkingTags(result.text || '').trim() || null;
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;

  if (isGroq) {
    const modelsToTry = [model, ...GROQ_PRIORITY_LIST.filter(m => m !== model)];
    for (const groqModel of modelsToTry) {
      try {
        const response = await getGroq().chat.completions.create({
          model: groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
      } catch (e: any) {
        console.warn(`Groq model ${groqModel} failed for interview question: ${e.message}`);
      }
    }
    return null;
  }

  const response = await (isGithub ? getGithub() : getOpenAI()).chat.completions.create({
    model: actualModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  return cleanThinkingTags(response.choices[0].message.content || '').trim() || null;
}

export async function evaluateInterview(
  hskLevel: number,
  topic: string,
  turns: InterviewTurn[],
  model: AIModel = 'gemini',
): Promise<InterviewEvaluation | null> {
  const safeTurns = normalizeInterviewTurns(turns);
  const transcript = safeTurns.map((turn, index) => [
    `Question ${index + 1}: ${turn.question}`,
    `Student answer: ${turn.answer}`,
    typeof turn.speechConfidence === 'number' ? `Speech recognition confidence: ${Math.round(turn.speechConfidence * 100)}%` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  const prompt = `Evaluate this Chinese HSK interview for a Vietnamese learner.
Target level: HSK ${hskLevel}
Topic: ${topic}

Transcript:
${transcript || 'No valid answers.'}

Return ONLY JSON with this exact shape:
{
  "overallScore": 0-100,
  "estimatedHskLevel": "HSK 1-6",
  "grammarScore": 0-100,
  "pronunciationScore": 0-100,
  "fluencyScore": 0-100,
  "strengths": ["Vietnamese feedback"],
  "improvements": ["Vietnamese feedback"],
  "grammarFeedback": "Vietnamese feedback with corrected Chinese examples when useful",
  "pronunciationFeedback": "Vietnamese feedback. If speech confidence is unavailable, say pronunciation is estimated from transcript only.",
  "nextPractice": ["Vietnamese action item"]
}
Score pronunciation using speech recognition confidence when present, but do not pretend to hear audio if only text is available.`;

  if (model === 'gemini') {
    const result = await generateGeminiContentWithFallback(
      [{ role: 'user', parts: [{ text: prompt }] }],
      { responseMimeType: 'application/json' },
    );
    try {
      return normalizeInterviewEvaluation(JSON.parse(cleanJsonContent(result.text || '{}')));
    } catch {
      return null;
    }
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;

  if (isGroq) {
    const modelsToTry = [model, ...GROQ_PRIORITY_LIST.filter(m => m !== model)];
    for (const groqModel of modelsToTry) {
      try {
        const response = await getGroq().chat.completions.create({
          model: groqModel,
          messages: [
            { role: 'system', content: 'You evaluate Chinese speaking practice. Respond ONLY with JSON.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        });
        const content = response.choices[0].message.content;
        if (content) return normalizeInterviewEvaluation(JSON.parse(cleanJsonContent(content)));
      } catch (e: any) {
        console.warn(`Groq model ${groqModel} failed for interview evaluation: ${e.message}`);
      }
    }
    return null;
  }

  const response = await (isGithub ? getGithub() : getOpenAI()).chat.completions.create({
    model: actualModel,
    messages: [
      { role: 'system', content: 'You evaluate Chinese speaking practice. Respond ONLY with JSON.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0].message.content;
  if (!content) return null;
  try {
    return normalizeInterviewEvaluation(JSON.parse(cleanJsonContent(content)));
  } catch {
    return null;
  }
}

function normalizeWordExplanation(data: any): WordExplanation {
  const normalizeStringArray = (value: any): string[] => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => normalizeStringArray(item));
    }
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(/[;,]|(?:\r?\n)/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (value && typeof value === 'object') {
      const text = value.pinyin || value.reading || value.pronunciation || value.value || value.text;
      const note = value.note || value.meaning || value.usage;
      const normalizedText = String(text || '').trim();
      const normalizedNote = String(note || '').trim();
      if (normalizedText && normalizedNote) return [`${normalizedText} (${normalizedNote})`];
      if (normalizedText) return [normalizedText];
    }
    return [];
  };

  const uniqueStrings = (values: string[]) => {
    const seen = new Set<string>();
    return values.filter((value) => {
      const normalized = value.trim();
      if (!normalized) return false;
      const key = normalized.replace(/\s+/g, ' ').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const normalizePatterns = (value: any): WordExplanation['commonPatterns'] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (!trimmed) return null;
          return {
            pattern: trimmed,
            meaning: '',
            example: '',
            examplePinyin: '',
            exampleMeaning: '',
          };
        }
        const pattern = String(item?.pattern || item?.structure || '').trim();
        const meaning = String(item?.meaning || item?.usage || '').trim();
        const example = String(item?.example || '').trim();
        const examplePinyin = String(item?.examplePinyin || item?.pinyin || '').trim();
        const exampleMeaning = String(item?.exampleMeaning || item?.translation || '').trim();
        if (!pattern && !meaning && !example) return null;
        return { pattern, meaning, example, examplePinyin, exampleMeaning };
      })
      .filter(Boolean) as WordExplanation['commonPatterns'];
  };

  const normalizeVideoLinks = (value: any): { title: string; url: string }[] => {
    const isAllowedVideoHost = (host: string) => {
      const normalizedHost = host.toLowerCase();
      return (
        normalizedHost === 'youtube.com' ||
        normalizedHost === 'www.youtube.com' ||
        normalizedHost === 'm.youtube.com' ||
        normalizedHost === 'youtu.be' ||
        normalizedHost === 'bilibili.com' ||
        normalizedHost === 'www.bilibili.com' ||
        normalizedHost === 'm.bilibili.com' ||
        normalizedHost === 'b23.tv'
      );
    };

    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        const title = String(item?.title || item?.name || '').trim();
        const url = String(item?.url || item?.link || '').trim();
        if (!/^https:\/\//i.test(url)) return null;
        try {
          const parsed = new URL(url);
          if (!isAllowedVideoHost(parsed.hostname)) return null;
          return { title: title || 'Video tham kh?o', url: parsed.toString() };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { title: string; url: string }[];
  };

  const pinyinCandidates = normalizeStringArray(data.pinyin || data.mainPinyin || data.reading);
  const pinyin = pinyinCandidates[0] || '';
  const pronunciations = uniqueStrings([
    ...pinyinCandidates,
    ...normalizeStringArray(data.pronunciations),
    ...normalizeStringArray(data.pronunciation),
    ...normalizeStringArray(data.readings),
    ...normalizeStringArray(data.alternatePinyin),
    ...normalizeStringArray(data.alternatePronunciations),
    ...normalizeStringArray(data.otherPronunciations),
  ]);

  return {
    word: String(data.word || ''),
    pinyin,
    meaning: String(data.meaning || ''),
    meanings: normalizeStringArray(data.meanings),
    pronunciations,
    hskLevel: typeof data.hskLevel === 'object' 
      ? (data.hskLevel.level?.toString() || data.hskLevel.hsk?.toString() || JSON.stringify(data.hskLevel))
      : String(data.hskLevel || ''),
    radical: String(data.radical || data.radicals || ''),
    strokes: String(data.strokes || data.strokeCount || data.totalStrokes || ''),
    decomposition: normalizeStringArray(data.decomposition || data.components || data.hanziBreakdown),
    grammarFocus: normalizeStringArray(data.grammarFocus || data.grammarNotes || data.grammar),
    commonPatterns: normalizePatterns(data.commonPatterns || data.patterns || data.collocations),
    commonMistakes: normalizeStringArray(data.commonMistakes || data.mistakes),
    learningTip: String(data.learningTip || ''),
    usage: String(data.usage || ''),
    usageExamples: normalizeStringArray(data.usageExamples),
    videoLinks: normalizeVideoLinks(data.videoLinks),
    example: String(data.example || ''),
    examplePinyin: String(data.examplePinyin || ''),
    exampleMeaning: String(data.exampleMeaning || ''),
    synonyms: String(data.synonyms || ''),
    antonyms: String(data.antonyms || ''),
  };
}
