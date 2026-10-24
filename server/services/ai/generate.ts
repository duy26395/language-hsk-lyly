import { AIModel, QuizQuestion, QuizType } from '../../../src/types';
import { cleanJsonContent, cleanThinkingTags } from './providers';
import { callAI } from './router';

export async function generateChineseText(
  words: string[],
  hskLevel: string,
  model: AIModel = 'gemini',
): Promise<string | null> {
  const prompt =
    words.length > 0
      ? `Write a short, engaging Chinese paragraph at the ${hskLevel} level using these specific words: ${words.join(', ')}. Return only the Chinese text. Do not include any thinking, reasoning, or English translation.`
      : `Write a short, engaging Chinese paragraph at the ${hskLevel} level using random appropriate vocabulary for this level. Return only the Chinese text. Do not include any thinking, reasoning, or English translation.`;

  try {
    const { content } = await callAI(model, '', prompt);
    if (!content) return null;
    return cleanThinkingTags(content).trim() || null;
  } catch (error) {
    console.error('generateChineseText error:', error);
    return null;
  }
}

export async function generateQuiz(
  hskLevel: number,
  topic: string,
  questionCount: number = 5,
  model: AIModel = 'gemini',
  quizType: QuizType = 'general',
): Promise<QuizQuestion[] | null> {
  const prompt =
    quizType === 'listening'
      ? `Generate a Chinese listening comprehension quiz at the HSK ${hskLevel} level about the topic: "${topic}". First write one short natural Chinese dialogue between two people appropriate for HSK ${hskLevel}. Use Chinese speaker names like "小李：" and "小王：" and keep it easy to read aloud. Then create ${questionCount} multiple-choice questions based ONLY on that dialogue. Provide the response as a JSON object with "dialogue" (string in Chinese) and "questions" (array of objects). Each question object must have: "question" (string in Chinese), "options" (array of 2 to 4 strings in Chinese), and "correctAnswerIndex" (integer). Respond ONLY with the JSON object. Do not include reasoning process or <think> tags.`
      : `Generate a ${questionCount}-question Chinese quiz at the HSK ${hskLevel} level about the topic: "${topic}". Include diverse question types (e.g., multiple choice, true/false, fill in the blanks, matching translations) where applicable. Provide the response as a JSON object containing a single key "questions", which is an array of objects. Each object must have: "question" (string in Chinese), "options" (array of 2 to 4 strings in Chinese), and "correctAnswerIndex" (integer). Respond ONLY with the JSON object. Do not include reasoning process or <think> tags.`;

  const normalizeQuizResponse = (parsed: any): QuizQuestion[] => {
    const dialogue =
      typeof parsed?.dialogue === 'string'
        ? parsed.dialogue.trim()
        : typeof parsed?.passage === 'string'
          ? parsed.passage.trim()
          : '';
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    return questions.map((question: any) => ({
      question: String(question.question || ''),
      options: Array.isArray(question.options)
        ? question.options.map((option: any) => String(option))
        : [],
      correctAnswerIndex: Number.isInteger(question.correctAnswerIndex)
        ? question.correctAnswerIndex
        : 0,
      dialogue:
        typeof question.dialogue === 'string' && question.dialogue.trim()
          ? question.dialogue.trim()
          : dialogue || undefined,
    }));
  };

  try {
    const { content } = await callAI(
      model,
      'You are a helpful Chinese language assistant. Respond ONLY with a JSON object.',
      prompt,
      { responseFormat: 'json_object' },
    );

    if (!content) return null;
    const parsed = JSON.parse(cleanJsonContent(content));
    return normalizeQuizResponse(parsed);
  } catch (error) {
    console.error('generateQuiz error:', error);
    return null;
  }
}
