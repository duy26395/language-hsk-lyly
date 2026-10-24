import { useRef, useState } from 'react';
import { summarizeConversation } from '../lib/ai';
import type { AIModel } from '../types';

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SummaryResult {
  summaryForRequest: string;
  conversationHistory: HistoryMessage[];
}

/**
 * Manages rolling conversation summarization so chat history stays within
 * context window limits.
 *
 * When the unsummarized portion of `messages` exceeds 12 turns, the oldest
 * 10 turns are summarized and replaced with a compact text summary.
 * The last 12 turns are always sent verbatim to the API.
 */
export function useConversationSummary(selectedModel: AIModel) {
  const [conversationSummary, setConversationSummary] = useState('');
  const summarizedCountRef = useRef(0);

  /**
   * Call before each API request. Returns the summary text and the slice of
   * recent history to send alongside it.
   */
  const updateSummaryIfNeeded = async (
    messages: HistoryMessage[],
  ): Promise<SummaryResult> => {
    let summaryForRequest = conversationSummary;
    let summarizedCountForRequest = summarizedCountRef.current;

    if (messages.length - summarizedCountForRequest > 12) {
      const nextSummarizedCount = Math.max(summarizedCountForRequest, messages.length - 10);
      const messagesToSummarize = messages
        .slice(summarizedCountForRequest, nextSummarizedCount)
        .map(({ role, content }) => ({ role, content }));

      const nextSummary = await summarizeConversation(
        messagesToSummarize,
        conversationSummary,
        selectedModel,
      );

      if (nextSummary) {
        summaryForRequest = nextSummary;
        summarizedCountForRequest = nextSummarizedCount;
        summarizedCountRef.current = nextSummarizedCount;
        setConversationSummary(nextSummary);
      }
    }

    const conversationHistory = messages
      .slice(Math.max(summarizedCountForRequest, messages.length - 12))
      .map(({ role, content }) => ({ role, content }));

    return { summaryForRequest, conversationHistory };
  };

  /** Reset when conversation is cleared. */
  const resetSummary = () => {
    setConversationSummary('');
    summarizedCountRef.current = 0;
  };

  return { conversationSummary, updateSummaryIfNeeded, resetSummary };
}
