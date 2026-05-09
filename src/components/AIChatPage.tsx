import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  Check,
  Clipboard,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { AIModel, chatNormally, summarizeConversation } from '../lib/ai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatPageProps {
  selectedModel: AIModel;
  fadeVariants: any;
}

type MarkdownBlock =
  | { type: 'code'; content: string; language?: string }
  | { type: 'heading'; content: string; level: number }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'paragraph'; lines: string[] };

const isTableLine = (line: string) => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.slice(1, -1).includes('|');
};

const isTableSeparator = (line: string) =>
  /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim());

const parseTableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const normalizeTableRows = (headers: string[], rows: string[][]) => {
  const normalizedHeaders = [...headers];
  const normalizedRows = rows.map((row) => [...row]);
  const pinyinIndex = normalizedHeaders.findIndex((header) => /pinyin/i.test(header));

  if (pinyinIndex > 0) {
    for (const row of normalizedRows) {
      if (row.length === normalizedHeaders.length - 1 && /\([^()]+\)/.test(row[pinyinIndex - 1] || '')) {
        const combinedCell = row[pinyinIndex - 1];
        const match = combinedCell.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
        if (match) {
          row.splice(pinyinIndex - 1, 1, match[1].trim(), match[2].trim());
        }
      }
    }
  }

  const columnCount = Math.max(
    normalizedHeaders.length,
    ...normalizedRows.map((row) => row.length),
  );

  while (normalizedHeaders.length < columnCount) {
    normalizedHeaders.push('');
  }

  return {
    headers: normalizedHeaders,
    rows: normalizedRows.map((row) => [
      ...row,
      ...Array(Math.max(0, columnCount - row.length)).fill(''),
    ]),
  };
};

const parseMarkdown = (content: string): MarkdownBlock[] => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let codeLines: string[] = [];
  let codeLanguage = '';
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', lines: paragraph });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: 'list', ordered: listOrdered, items: listItems });
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableHeaders.length) {
      const table = normalizeTableRows(tableHeaders, tableRows);
      blocks.push({ type: 'table', headers: table.headers, rows: table.rows });
      tableHeaders = [];
      tableRows = [];
    }
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      if (inCode) {
        blocks.push({ type: 'code', content: codeLines.join('\n'), language: codeLanguage });
        codeLines = [];
        codeLanguage = '';
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        flushTable();
        inCode = true;
        codeLanguage = fenceMatch[1] || '';
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (isTableLine(line)) {
      flushParagraph();
      flushList();
      if (!isTableSeparator(line)) {
        const cells = parseTableCells(line);
        if (!tableHeaders.length) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
      }
      continue;
    }

    flushTable();

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    const listMatch = unorderedMatch || orderedMatch;
    if (listMatch) {
      flushParagraph();
      const ordered = Boolean(orderedMatch);
      if (listItems.length && listOrdered !== ordered) flushList();
      listOrdered = ordered;
      listItems.push(listMatch[1].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  if (inCode) {
    blocks.push({ type: 'code', content: codeLines.join('\n'), language: codeLanguage });
  }
  flushParagraph();
  flushList();
  flushTable();
  return blocks;
};

const QUICK_PROMPTS = [
  'Giải thích ngữ pháp 把 cho mình bằng tiếng Việt, kèm 3 ví dụ HSK 3.',
  'Tạo một đoạn hội thoại ngắn ở HSK 2 về gọi món ăn.',
  'Sửa câu này giúp mình và giải thích lỗi: 我昨天去学校了学习中文。',
  'Cho mình 10 từ vựng chủ đề du lịch, có pinyin và ví dụ.',
];

const createMessage = (role: Message['role'], content: string): Message => ({
  id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
});

const renderInlineMarkdownSegment = (text: string, keyPrefix: string) => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`${keyPrefix}-code-${index}`} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-700">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-strong-${index}`} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={`${keyPrefix}-em-${index}`}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={`${keyPrefix}-text-${index}`}>{part}</React.Fragment>;
  });
};

const renderInlineMarkdown = (text: string) => {
  const segments = text.split(/(<br\s*\/?>)/gi);
  return segments.map((segment, index) => {
    if (/^<br\s*\/?>$/i.test(segment)) {
      return <br key={`br-${index}`} />;
    }
    return (
      <React.Fragment key={`segment-${index}`}>
        {renderInlineMarkdownSegment(segment, `segment-${index}`)}
      </React.Fragment>
    );
  });
};

function AssistantMessageContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="space-y-3 text-left">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <pre key={index} className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-sm leading-6 text-slate-100">
              <code>{block.content}</code>
            </pre>
          );
        }

        if (block.type === 'heading') {
          const headingClass = "font-bold leading-snug text-slate-900";
          if (block.level === 1) {
            return <h4 key={index} className={headingClass}>{renderInlineMarkdown(block.content)}</h4>;
          }
          if (block.level === 2) {
            return <h5 key={index} className={headingClass}>{renderInlineMarkdown(block.content)}</h5>;
          }
          return <h6 key={index} className={headingClass}>{renderInlineMarkdown(block.content)}</h6>;
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={index}
              className={`space-y-1 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={index} className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[520px] border-collapse bg-white text-left text-sm leading-6">
                <thead className="bg-slate-100 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th key={`${header}-${headerIndex}`} className="border-b border-slate-200 px-3 py-2 align-top">
                        {renderInlineMarkdown(header || `Cột ${headerIndex + 1}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-slate-100 last:border-b-0">
                      {row.map((cell, cellIndex) => (
                        <td key={`${cell}-${cellIndex}`} className="px-3 py-2 align-top text-slate-700">
                          {renderInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInlineMarkdown(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function AIChatPage({ selectedModel, fadeVariants }: AIChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [conversationSummary, setConversationSummary] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const summarizedCountRef = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = '0px';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
  }, [input]);

  const handleSend = async (messageText = input) => {
    const trimmedInput = messageText.trim();
    if (!trimmedInput || loading) return;

    const userMessage = createMessage('user', trimmedInput);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      let summaryForRequest = conversationSummary;
      let summarizedCountForRequest = summarizedCountRef.current;

      if (messages.length - summarizedCountForRequest > 12) {
        const nextSummarizedCount = Math.max(summarizedCountForRequest, messages.length - 10);
        const messagesToSummarize = messages
          .slice(summarizedCountForRequest, nextSummarizedCount)
          .map(({ role, content }) => ({ role, content }));
        const nextSummary = await summarizeConversation(messagesToSummarize, conversationSummary, selectedModel);
        if (nextSummary) {
          summaryForRequest = nextSummary;
          summarizedCountForRequest = nextSummarizedCount;
          summarizedCountRef.current = nextSummarizedCount;
          setConversationSummary(nextSummary);
        }
      }

      const history = messages
        .slice(Math.max(summarizedCountForRequest, messages.length - 12))
        .map(({ role, content }) => ({ role, content }));
      const response = await chatNormally(userMessage.content, history, selectedModel, summaryForRequest);
      if (response) {
        setMessages([...nextMessages, createMessage('assistant', response)]);
      } else {
        setMessages(nextMessages);
        setError('AI chưa trả lời được. Thử gửi lại hoặc đổi model trong Settings nhé.');
      }
    } catch (sendError) {
      console.error('AI chat failed', sendError);
      setMessages(nextMessages);
      setError('Có lỗi khi gọi AI. Kiểm tra server/API key rồi thử lại nhé.');
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput('');
    setError('');
    setCopiedMessageId(null);
    setConversationSummary('');
    summarizedCountRef.current = 0;
  };

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => (current === message.id ? null : current)), 1400);
    } catch {
      setError('Không copy được nội dung trên trình duyệt này.');
    }
  };

  return (
    <motion.div
      key="ai-chat"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden p-3 pb-2 sm:p-4 md:p-6 md:pb-6"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white bg-white/95 shadow-xl backdrop-blur-3xl relative">

        {/* Subtle decorative sparkles in corners */}
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Sparkles size={140} />
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white/40 px-4 py-3 md:px-6 backdrop-blur-md">


          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 md:text-lg">
                AI Chat
              </h1>
              <p className="truncate text-xs font-semibold text-slate-400 md:text-sm">
                Model: {selectedModel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetChat}
            disabled={messages.length === 0 && !input && !error}
            className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-35"
            aria-label="Reset chat"
            title="Reset chat"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} className="no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-3 py-4 scroll-smooth md:px-8 md:py-6 relative z-10">


          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm">
                <Sparkles className="h-8 w-8" />
              </div>
              <p className="text-base font-bold text-slate-700">Hỏi AI như gia sư tiếng Trung</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">
                Nhờ giải thích ngữ pháp, sửa câu, tạo hội thoại, hoặc luyện từ vựng theo cấp HSK.
              </p>
              <div className="mt-5 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    disabled={loading}
                    className="min-h-12 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold leading-5 text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex min-w-0 gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`group relative min-w-0 max-w-[calc(100%-3rem)] break-words p-3 text-[15px] leading-7 shadow-xl sm:max-w-[84%] md:max-w-[78%] md:p-4 md:text-base transition-all hover:shadow-2xl ${
                  msg.role === 'user'
                    ? 'rounded-3xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 text-white'
                    : 'rounded-3xl rounded-bl-md glass text-slate-800'
                }`}>



                  {msg.role === 'assistant' ? (
                    <>
                      <AssistantMessageContent content={msg.content} />
                      <button
                        type="button"
                        onClick={() => copyMessage(msg)}
                        className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 opacity-0 shadow-sm transition-all hover:text-slate-700 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Copy assistant message"
                        title="Copy"
                      >
                        {copiedMessageId === msg.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Clipboard className="h-4 w-4" />}
                      </button>
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))
          )}

          {loading && (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
              <div className="flex h-12 w-16 items-center justify-center rounded-3xl rounded-bl-md border border-slate-200 bg-white p-4">
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0s' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0.2s' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-semibold leading-6 text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white/40 p-3 md:p-4 backdrop-blur-md">


          <div className="relative flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Nhập câu hỏi... Shift + Enter để xuống dòng"
              rows={1}
              className="max-h-40 min-h-12 w-full resize-none rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-14 text-[15px] font-medium leading-6 text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 md:min-h-14 md:py-4 md:pl-5 md:pr-16 md:text-base"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md transition-all hover:bg-slate-700 active:scale-95 disabled:opacity-50 md:bottom-2 md:right-2 md:h-10 md:w-10"
              aria-label="Send message"
            >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
                ) : (
                  <Send className="h-4 w-4 md:h-5 md:w-5" />
                )}
              </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
