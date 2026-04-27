import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Loader2, RotateCcw, Send, Sparkles, User } from 'lucide-react';
import { AIModel, chatNormally } from '../lib/ai';

interface Message {
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
  | { type: 'paragraph'; lines: string[] };

const parseMarkdown = (content: string): MarkdownBlock[] => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
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
      continue;
    }

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
  return blocks;
};

const renderInlineMarkdown = (text: string) => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-700">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

function AssistantMessageContent({ content }: { content: string }) {
  const blocks = parseMarkdown(content);

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    const response = await chatNormally(userMessage.content, messages, selectedModel);
    if (response) {
      setMessages([...nextMessages, { role: 'assistant', content: response }]);
    }
    setLoading(false);
  };

  const resetChat = () => {
    setMessages([]);
    setInput('');
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
        <div ref={scrollRef} className="no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden bg-slate-50 px-3 py-4 scroll-smooth md:px-8 md:py-6">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm">
                <Sparkles className="h-8 w-8" />
              </div>
              <p className="text-base font-bold text-slate-600">Start a new conversation</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">
                Chat normally, just like on the web.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <motion.div
                key={index}
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
                <div className={`min-w-0 max-w-[calc(100%-3rem)] break-words p-3 text-[15px] leading-7 shadow-sm sm:max-w-[84%] md:max-w-[78%] md:p-4 md:text-base ${
                  msg.role === 'user'
                    ? 'rounded-3xl rounded-br-md bg-slate-900 text-white'
                    : 'rounded-3xl rounded-bl-md border border-slate-200 bg-white text-slate-800'
                }`}>
                  {msg.role === 'assistant' ? (
                    <AssistantMessageContent content={msg.content} />
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
        </div>

        <div className="border-t border-slate-200 bg-white p-3 md:p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetChat}
              className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              aria-label="Reset chat"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSend()}
              placeholder="Message AI..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white py-0 pl-4 pr-12 text-[15px] font-medium text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 md:h-14 md:pl-5 md:pr-14 md:text-base"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md transition-all hover:bg-slate-700 active:scale-95 disabled:opacity-50 md:right-2 md:h-10 md:w-10"
              aria-label="Send message"
            >
              <Send className="h-4 w-4 md:h-5 md:w-5" />
            </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
