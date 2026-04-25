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

export interface WordExplanation {
  word: string;
  pinyin: string;
  meaning: string;
  hskLevel: string;
  learningTip: string;
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

function cleanThinkingTags(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function cleanJsonContent(content: string): string {
  const noThinking = cleanThinkingTags(content);
  return noThinking.replace(/```json\n?|```/g, '').trim();
}

export async function explainWord(
  word: string,
  contextContext: string,
  model: AIModel = 'gemini',
): Promise<WordExplanation | null> {
  if (model === 'gemini') {
    const prompt = `Explain the Chinese word "${word}" in the following context: "${contextContext}".
Important: All explanations (meaning, learningTip, exampleMeaning) MUST be in Vietnamese.
Provide the response as a JSON object with this exact structure:
{
  "word": "${word}",
  "pinyin": "pinyin here",
  "meaning": "Vietnamese meaning here",
  "hskLevel": "HSK level string here (e.g. 'HSK 3')",
  "learningTip": "short learning tip in Vietnamese",
  "example": "example sentence in Chinese",
  "examplePinyin": "pinyin of the example sentence",
  "exampleMeaning": "example sentence meaning in Vietnamese",
  "synonyms": "synonyms separated by comma",
  "antonyms": "antonyms separated by comma"
}
Respond ONLY with the JSON object. Do not include any thinking or reasoning process.`;

    const client = getGemini();
    const result = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const jsonStr = cleanJsonContent(result.text || '{}');
    const parsed = JSON.parse(jsonStr) as any;
    return normalizeWordExplanation(parsed);
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
            {
              role: 'system',
              content: 'You are a helpful Chinese language assistant. Respond ONLY with a JSON object. All explanation fields (meaning, learningTip, exampleMeaning) MUST be in Vietnamese.',
            },
            {
              role: 'user',
              content: `Explain the Chinese word "${word}" in context: "${contextContext}". JSON Schema: { word: string, pinyin: string, meaning: string (in Vietnamese), hskLevel: string, learningTip: string (in Vietnamese), example: string (Chinese), examplePinyin: string, exampleMeaning: string (in Vietnamese), synonyms: string, antonyms: string }. Respond ONLY with JSON.`,
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
        content: 'You are a helpful Chinese language assistant. Respond ONLY with a JSON object. All explanation fields (meaning, learningTip, exampleMeaning) MUST be in Vietnamese. Ensure hskLevel is a string. Do not include any <think> tags or reasoning process.',
      },
      {
        role: 'user',
        content: `Explain the Chinese word "${word}" in context: "${contextContext}". JSON Schema: { word: string, pinyin: string, meaning: string (in Vietnamese), hskLevel: string, learningTip: string (in Vietnamese), example: string (Chinese), examplePinyin: string, exampleMeaning: string (in Vietnamese), synonyms: string, antonyms: string }. Do not include reasoning.`,
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
    const client = getGemini();
    const result = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
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
    const client = getGemini();
    const result = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });

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
  const systemPrompt = `You are an encouraging and professional Chinese teacher. Your goal is to help the user practice speaking/writing Chinese at the ${hskLevel} level.
  Rules:
  1. Always respond in Chinese at the ${hskLevel} level.
  2. If the user makes a mistake in their Chinese, briefly correct it in Vietnamese before continuing the conversation in Chinese.
  3. Keep your responses relatively short to encourage back-and-forth conversation.
  4. Use Pinyin for difficult words if appropriate for the level.
  5. Do not include any <think> tags or reasoning. Return ONLY the teacher's response.`;

  if (model === 'gemini') {
    const client = getGemini();
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: message }] }
    ];
    // Gemini 1.5-flash doesn't strictly follow system instruction if not in system_instruction field, 
    // but here we use it as a first message which works well for simple roleplay.
    const result = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: contents as any,
    });
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

function normalizeWordExplanation(data: any): WordExplanation {
  return {
    word: String(data.word || ''),
    pinyin: String(data.pinyin || ''),
    meaning: String(data.meaning || ''),
    hskLevel: typeof data.hskLevel === 'object' 
      ? (data.hskLevel.level?.toString() || data.hskLevel.hsk?.toString() || JSON.stringify(data.hskLevel))
      : String(data.hskLevel || ''),
    learningTip: String(data.learningTip || ''),
    example: String(data.example || ''),
    examplePinyin: String(data.examplePinyin || ''),
    exampleMeaning: String(data.exampleMeaning || ''),
    synonyms: String(data.synonyms || ''),
    antonyms: String(data.antonyms || ''),
  };
}
