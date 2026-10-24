import { AIModel, WordExplanation } from '../../../src/types';
import {
  cleanJsonContent,
  getExplainRaceModels,
} from './providers';
import { callAI } from './router';

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

export function normalizeWordExplanation(data: any): WordExplanation {
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
      const text =
        value.pinyin ||
        value.reading ||
        value.pronunciation ||
        value.value ||
        value.text;
      const note = value.note || value.meaning || value.usage;
      const normalizedText = String(text || '').trim();
      const normalizedNote = String(note || '').trim();
      if (normalizedText && normalizedNote)
        return [`${normalizedText} (${normalizedNote})`];
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
        const examplePinyin = String(
          item?.examplePinyin || item?.pinyin || '',
        ).trim();
        const exampleMeaning = String(
          item?.exampleMeaning || item?.translation || '',
        ).trim();
        if (!pattern && !meaning && !example) return null;
        return { pattern, meaning, example, examplePinyin, exampleMeaning };
      })
      .filter(Boolean) as WordExplanation['commonPatterns'];
  };

  const normalizeVideoLinks = (
    value: any,
  ): { title: string; url: string }[] => {
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
          return { title: title || 'Video tham khảo', url: parsed.toString() };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { title: string; url: string }[];
  };

  const pinyinCandidates = normalizeStringArray(
    data.pinyin || data.mainPinyin || data.reading,
  );
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
    hskLevel:
      typeof data.hskLevel === 'object'
        ? data.hskLevel.level?.toString() ||
          data.hskLevel.hsk?.toString() ||
          JSON.stringify(data.hskLevel)
        : String(data.hskLevel || ''),
    radical: String(data.radical || data.radicals || ''),
    strokes: String(
      data.strokes || data.strokeCount || data.totalStrokes || '',
    ),
    decomposition: normalizeStringArray(
      data.decomposition || data.components || data.hanziBreakdown,
    ),
    grammarFocus: normalizeStringArray(
      data.grammarFocus || data.grammarNotes || data.grammar,
    ),
    commonPatterns: normalizePatterns(
      data.commonPatterns || data.patterns || data.collocations,
    ),
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

export async function explainWord(
  word: string,
  contextContext: string,
  model: AIModel = 'gemini',
  options: { fallbackGroq?: boolean } = {},
): Promise<WordExplanation | null> {
  const explainPrompt = createExplainWordPrompt(word, contextContext);

  try {
    const { content } = await callAI(
      model,
      EXPLAIN_WORD_SYSTEM_PROMPT,
      explainPrompt,
      {
        responseFormat: 'json_object',
        fallbackGroq: options.fallbackGroq,
      },
    );

    if (!content) return null;
    const parsed = JSON.parse(cleanJsonContent(content));
    return normalizeWordExplanation(parsed);
  } catch (error) {
    console.error('explainWord error:', error);
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
    const result = await explainWord(word, contextContext, raceModel, {
      fallbackGroq: false,
    });
    if (!result) {
      throw new Error(`No explanation from ${raceModel}`);
    }
    return { result, model: raceModel };
  });

  try {
    return await Promise.any(attempts);
  } catch (error) {
    console.warn(
      'All explain-word race models failed, falling back to preferred model:',
      error,
    );
    return {
      result: await explainWord(word, contextContext, preferredModel),
      model: preferredModel,
    };
  }
}
