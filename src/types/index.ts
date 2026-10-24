// ─── AI Models ────────────────────────────────────────────────────────────────

export type AIModel =
  | 'gemini-3.8-flash'
  | 'gemini-3.8-flash-lite-tts'
  | 'gemini-3.8-flash-tts'
  | 'gemini'
  | 'gpt-3.5-turbo'
  | 'llama-3.1-8b-instant'
  | 'llama-3.3-70b-versatile'
  | 'qwen/qwen3-32b'
  | 'meta-llama/llama-4-scout-17b-16e-instruct'
  | 'openai/gpt-oss-120b'
  | 'github-gpt-5-mini'
  | 'github-gpt-4o-mini';

// ─── Word Explanation ─────────────────────────────────────────────────────────

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

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  dialogue?: string;
}

export type QuizType = 'general' | 'listening' | 'interview';

// ─── Interview ────────────────────────────────────────────────────────────────

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

// ─── Notebook / SRS ───────────────────────────────────────────────────────────

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface WordReview {
  dueAt: number;
  intervalDays: number;
  ease: number;
  lapses: number;
  streak: number;
  lastReviewedAt?: number;
}

export interface SavedWordEntry {
  word: string;
  explanation: WordExplanation;
  review?: WordReview;
  savedAt?: number;
}

export interface SavedPassageEntry {
  id: string;
  text: string;
  savedAt: number;
  source?: 'read' | 'create';
}

export interface SavedNoteEntry {
  id: string;
  content: string;
  savedAt: number;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
