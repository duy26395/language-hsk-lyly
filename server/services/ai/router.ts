import { AIModel } from '../../../src/types';
import {
  getOpenAI,
  getGroq,
  getGemini,
  getGithub,
  GROQ_PRIORITY_LIST,
  generateGeminiContentWithFallback,
  cleanThinkingTags,
} from './providers';

export interface CallAIOptions {
  responseFormat?: 'json_object';
  fallbackGroq?: boolean;
}

export async function callAI(
  model: AIModel,
  systemPrompt: string,
  userPrompt: string,
  options: CallAIOptions = {},
): Promise<{ content: string | null; resolvedModel: AIModel }> {
  // ─── Gemini Provider ───
  if (model === 'gemini' || model.startsWith('gemini')) {
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'user', parts: [{ text: userPrompt }] },
    ];
    const config = options.responseFormat === 'json_object'
      ? { responseMimeType: 'application/json' }
      : undefined;

    const targetModel = model === 'gemini' ? 'gemini-3.8-flash' : model;
    const result = await generateGeminiContentWithFallback(contents, config, targetModel);
    return {
      content: result.text || null,
      resolvedModel: model,
    };
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;

  // ─── Groq Provider (with fallback list) ───
  if (isGroq) {
    const modelsToTry = options.fallbackGroq === false
      ? [model]
      : [model, ...GROQ_PRIORITY_LIST.filter((m) => m !== model)];
    let lastError: any = null;

    for (const groqModel of modelsToTry) {
      try {
        const client = getGroq();
        const response = await client.chat.completions.create({
          model: groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: options.responseFormat === 'json_object'
            ? { type: 'json_object' }
            : undefined,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          return { content, resolvedModel: groqModel };
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`Groq model ${groqModel} failed: ${e.message}`);
      }
    }
    console.error('All Groq models failed:', lastError);
    return { content: null, resolvedModel: model };
  }

  // ─── OpenAI or Github Provider ───
  const client = isGithub ? getGithub() : getOpenAI();
  const response = await client.chat.completions.create({
    model: actualModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: options.responseFormat === 'json_object'
      ? { type: 'json_object' }
      : undefined,
  });

  return {
    content: response.choices[0]?.message?.content || null,
    resolvedModel: model,
  };
}

export async function callAIChat(
  model: AIModel,
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string,
  summaryPrompt?: string,
): Promise<{ content: string | null; resolvedModel: AIModel }> {
  // ─── Gemini Provider ───
  if (model === 'gemini' || model.startsWith('gemini')) {
    const contents: any[] = [
      { role: 'user', parts: [{ text: systemPrompt }] },
    ];
    if (summaryPrompt) {
      contents.push({ role: 'user', parts: [{ text: summaryPrompt }] });
    }
    contents.push(
      ...history.map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: userMessage }] },
    );

    const targetModel = model === 'gemini' ? 'gemini-3.8-flash' : model;
    const result = await generateGeminiContentWithFallback(contents, undefined, targetModel);
    return {
      content: result.text || null,
      resolvedModel: model,
    };
  }

  const isGroq = GROQ_PRIORITY_LIST.includes(model) || model === 'llama-3.1-8b-instant';
  const isGithub = model.startsWith('github-');
  const actualModel = isGithub ? model.replace('github-', '') : model;

  const messages = [
    { role: 'system', content: systemPrompt },
  ];
  if (summaryPrompt) {
    messages.push({ role: 'system', content: summaryPrompt });
  }
  messages.push(
    ...history,
    { role: 'user', content: userMessage },
  );

  // ─── Groq Provider (with fallback list) ───
  if (isGroq) {
    const modelsToTry = [model, ...GROQ_PRIORITY_LIST.filter((m) => m !== model)];
    let lastError: any = null;

    for (const groqModel of modelsToTry) {
      try {
        const client = getGroq();
        const response = await client.chat.completions.create({
          model: groqModel,
          messages: messages as any,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          return { content, resolvedModel: groqModel };
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`Groq model ${groqModel} failed for chat: ${e.message}`);
      }
    }
    console.error('All Groq models failed for chat:', lastError);
    return { content: null, resolvedModel: model };
  }

  // ─── OpenAI or Github Provider ───
  const client = isGithub ? getGithub() : getOpenAI();
  const response = await client.chat.completions.create({
    model: actualModel,
    messages: messages as any,
  });

  return {
    content: response.choices[0]?.message?.content || null,
    resolvedModel: model,
  };
}
