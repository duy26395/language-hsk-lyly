import { AIModel, InterviewEvaluation, InterviewTurn } from '../../../src/types';
import { cleanJsonContent, cleanThinkingTags } from './providers';
import { callAI } from './router';

function normalizeInterviewTurns(turns: InterviewTurn[]): InterviewTurn[] {
  return turns
    .filter(
      (turn) =>
        turn &&
        typeof turn.question === 'string' &&
        typeof turn.answer === 'string',
    )
    .map((turn) => ({
      question: turn.question.trim().slice(0, 500),
      answer: turn.answer.trim().slice(0, 800),
      speechConfidence:
        typeof turn.speechConfidence === 'number'
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
  const stringArray = (value: any): string[] =>
    Array.isArray(value)
      ? value.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

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
    ? safeTurns
        .map(
          (turn, index) =>
            `Q${index + 1}: ${turn.question}\nA${index + 1}: ${turn.answer}`,
        )
        .join('\n')
    : 'No answers yet.';
  const systemPrompt = `You are a friendly Chinese HSK interview teacher.
Ask exactly one interview question in Simplified Chinese.
Match HSK ${hskLevel}. Topic: ${topic}.
Question ${questionNumber} of ${totalQuestions}.
Use natural teacher language, keep it short, and adapt to the learner's previous answers.
Return only the Chinese question, no pinyin, no translation, no explanation, no <think> tags.`;
  const userPrompt = `Previous interview:\n${historyText}\n\nAsk the next question now.`;

  try {
    const { content } = await callAI(model, systemPrompt, userPrompt);
    if (!content) return null;
    return cleanThinkingTags(content).trim() || null;
  } catch (error) {
    console.error('generateInterviewQuestion error:', error);
    return null;
  }
}

export async function evaluateInterview(
  hskLevel: number,
  topic: string,
  turns: InterviewTurn[],
  model: AIModel = 'gemini',
): Promise<InterviewEvaluation | null> {
  const safeTurns = normalizeInterviewTurns(turns);
  const transcript = safeTurns
    .map((turn, index) =>
      [
        `Question ${index + 1}: ${turn.question}`,
        `Student answer: ${turn.answer}`,
        typeof turn.speechConfidence === 'number'
          ? `Speech recognition confidence: ${Math.round(turn.speechConfidence * 100)}%`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
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

  try {
    const { content } = await callAI(
      model,
      'You evaluate Chinese speaking practice. Respond ONLY with JSON.',
      prompt,
      { responseFormat: 'json_object' },
    );

    if (!content) return null;
    return normalizeInterviewEvaluation(JSON.parse(cleanJsonContent(content)));
  } catch (error) {
    console.error('evaluateInterview error:', error);
    return null;
  }
}
