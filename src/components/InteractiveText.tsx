import React, { useState, useEffect, useRef } from 'react';
import { segmentChineseText } from '../lib/utils';
import { explainWord, WordExplanation, AIModel } from '../lib/ai';
import { Loader2, Plus, Volume2, Lightbulb } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface InteractiveTextProps {
  text: string;
  onAddToNotebook?: (word: string, explanation: WordExplanation) => void;
  selectedModel?: AIModel;
}

type SelectionState = {
  word: string;
  context: string;
  x: number;
  y: number;
};

export default function InteractiveText({
  text,
  onAddToNotebook,
  selectedModel = 'gemini',
}: InteractiveTextProps) {
  const [segments, setSegments] = useState<string[]>([]);
  const [selected, setSelected] = useState<SelectionState | null>(null);
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const explanationCache = useRef<Map<string, WordExplanation>>(new Map());
  const latestLookupKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setSegments(segmentChineseText(text));
    setSelected(null);
    setExplanation(null);
    setLoading(false);
    latestLookupKeyRef.current = null;
  }, [text]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const touchPoints = navigator.maxTouchPoints > 0;
    setIsTouchDevice(coarsePointer || touchPoints);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        latestLookupKeyRef.current = null;
        setSelected(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const runLookup = async (nextSelection: SelectionState) => {
    const cacheKey = `${selectedModel}:${nextSelection.word}:${nextSelection.context}`;
    const cached = explanationCache.current.get(cacheKey);

    latestLookupKeyRef.current = cacheKey;
    setSelected(nextSelection);
    setExplanation(cached ?? null);
    setLoading(!cached);

    if (cached) return;

    const result = await explainWord(nextSelection.word, nextSelection.context, selectedModel);
    if (result) {
      explanationCache.current.set(cacheKey, result);
    }

    if (latestLookupKeyRef.current !== cacheKey) {
      return;
    }

    setExplanation(result);
    setLoading(false);
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        if (containerRef.current && !containerRef.current.contains(selection.anchorNode)) return;

        const selectedText = selection.toString().trim();
        if (!selectedText || !/[\u4e00-\u9fa5]/.test(selectedText)) return;
        if (selectedText.length > 500) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const popoverWidth = Math.min(320, window.innerWidth - 32);
        const x = Math.max(
          16,
          Math.min(rect.left + rect.width / 2 - popoverWidth / 2, window.innerWidth - popoverWidth - 16),
        );
        const y = Math.max(16, Math.min(rect.bottom + 12, window.innerHeight - 332));

        void runLookup({
          word: selectedText,
          context: selectedText,
          x,
          y,
        });
      }, 700);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      clearTimeout(timeoutId);
    };
  }, [selectedModel]);

  const handleWordClick = async (
    e: React.MouseEvent<HTMLSpanElement>,
    word: string,
    index: number,
  ) => {
    if (isTouchDevice) return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      return;
    }

    if (!/[\u4e00-\u9fa5]/.test(word)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const start = Math.max(0, index - 10);
    const end = Math.min(segments.length, index + 10);
    const context = segments.slice(start, end).join('');
    const popoverWidth = Math.min(320, window.innerWidth - 32);

    const x = Math.max(
      16,
      Math.min(rect.left + rect.width / 2 - popoverWidth / 2, window.innerWidth - popoverWidth - 16),
    );
    const y = Math.max(16, Math.min(rect.bottom + 12, window.innerHeight - 332));

    await runLookup({ word, context, x, y });
  };

  const playAudio = (textToPlay: string) => {
    const utterance = new SpeechSynthesisUtterance(textToPlay);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  };

  const getHskColor = (level: string) => {
    const l = level.match(/\d/);
    if (!l) return 'var(--color-hsk-1)';
    return `var(--color-hsk-${l[0]})`;
  };

  const handleMouseUp = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const selectedText = selection.toString().trim();
      if (!selectedText || !/[\u4e00-\u9fa5]/.test(selectedText)) return;
      if (selectedText.length > 500) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const popoverWidth = Math.min(320, window.innerWidth - 32);
      const x = Math.max(
        16,
        Math.min(rect.left + rect.width / 2 - popoverWidth / 2, window.innerWidth - popoverWidth - 16),
      );
      const y = Math.max(16, Math.min(rect.bottom + 12, window.innerHeight - 332));

      void runLookup({
        word: selectedText,
        context: selectedText,
        x,
        y,
      });
    }, 10);
  };

  return (
    <div
      ref={containerRef}
      className="chinese min-w-0 select-text text-[18px] leading-[2.1] text-slate-800 [overflow-wrap:anywhere] md:text-[20px] md:leading-[2.2]"
      style={{
        position: 'relative',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        WebkitTouchCallout: 'default',
      }}
      onMouseUp={handleMouseUp}
    >
      {isTouchDevice ? (
        <div className="whitespace-pre-wrap break-words">{text}</div>
      ) : (
        segments.map((segment, idx) => {
          const isChinese = /[\u4e00-\u9fa5]/.test(segment);
          const isSelected = selected?.word === segment;
          return (
            <span
              key={idx}
              className={`
                ${isChinese ? 'mx-[1px] cursor-pointer rounded border-b-2 border-transparent px-0.5 transition-all duration-200 hover:border-violet-200 hover:bg-violet-50' : ''}
                ${isSelected ? 'relative z-10 inline-block scale-105 !border-violet-500 !bg-violet-100 !text-violet-700 font-medium shadow-sm' : ''}
              `}
              onClick={(e) => void handleWordClick(e, segment, idx)}
              style={{
                userSelect: 'text',
                WebkitUserSelect: 'text',
                WebkitTouchCallout: 'default',
              }}
            >
              {segment}
            </span>
          );
        })
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: 12, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
            className="fixed z-[60] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[320px] overflow-y-auto rounded-[1.5rem] border border-violet-100 bg-white/95 p-4 text-left shadow-[0_25px_60px_-15px_rgba(139,92,246,0.2)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-6"
            style={{ top: selected.y, left: selected.x }}
          >
            <div className="pointer-events-none absolute -mr-6 -mt-6 h-24 w-24 rounded-bl-full bg-violet-500/5" />
            <div className="pointer-events-none absolute -mb-4 -ml-4 bottom-0 left-0 h-16 w-16 rounded-tr-full bg-fuchsia-500/5" />

            <div className="relative z-10">
              <div className="mb-4 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="chinese text-2xl font-bold leading-none tracking-tight text-slate-800">
                      {selected.word}
                    </h3>
                    {explanation && (
                      <span
                        className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
                        style={{ background: getHskColor(explanation.hskLevel) }}
                      >
                        {explanation.hskLevel}
                      </span>
                    )}
                  </div>
                  {loading ? (
                    <div className="mt-2 h-4 w-24 animate-pulse rounded-full bg-slate-100" />
                  ) : (
                    <div className="text-sm font-semibold tracking-wide text-violet-500">
                      {explanation?.pinyin}
                    </div>
                  )}
                </div>
                {!loading && (
                  <button
                    onClick={() => playAudio(selected.word)}
                    className="rounded-2xl bg-violet-50 p-2.5 text-violet-600 shadow-sm transition-all hover:bg-violet-100 hover:text-violet-700 active:scale-90"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {loading ? (
                  <div className="space-y-3 py-2">
                    <div className="flex items-center text-xs font-medium tracking-wide text-slate-400">
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-violet-500" />
                      ĐANG PHÂN TÍCH...
                    </div>
                    <div className="h-3 w-full animate-pulse rounded-full bg-slate-50" />
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-50" />
                  </div>
                ) : explanation ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-violet-100/50 bg-violet-50/50 p-3 text-sm font-medium leading-relaxed text-slate-700">
                      {explanation.meaning}
                    </div>

                    <div className="space-y-2">
                      <div className="chinese text-sm leading-relaxed text-slate-800">{explanation.example}</div>
                      {explanation.examplePinyin && (
                        <div className="text-[11px] font-medium leading-tight text-violet-400">
                          {explanation.examplePinyin}
                        </div>
                      )}
                      <div className="text-[11px] italic leading-tight text-slate-500">
                        {explanation.exampleMeaning}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-amber-100/50 bg-amber-50/50 p-3">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <p className="text-[12px] font-medium leading-relaxed text-slate-600">
                        {explanation.learningTip}
                      </p>
                    </div>

                    {(explanation.synonyms || explanation.antonyms) && (
                      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                        {explanation.synonyms && explanation.synonyms !== 'none' && (
                          <div className="rounded-xl border border-emerald-100/50 bg-emerald-50/50 p-2.5">
                            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                              Đồng nghĩa
                            </div>
                            <div className="chinese text-xs font-medium text-slate-700">
                              {explanation.synonyms}
                            </div>
                          </div>
                        )}
                        {explanation.antonyms && explanation.antonyms !== 'none' && (
                          <div className="rounded-xl border border-rose-100/50 bg-rose-50/50 p-2.5">
                            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-rose-600">
                              Trái nghĩa
                            </div>
                            <div className="chinese text-xs font-medium text-slate-700">
                              {explanation.antonyms}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {onAddToNotebook && (
                      <button
                        onClick={() => onAddToNotebook(selected.word, explanation)}
                        className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-[13px] font-bold text-white shadow-sm transition-all hover:shadow-lg hover:shadow-violet-200 active:scale-[0.98]"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Lưu vào sổ tay
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-medium text-rose-600">
                    Đã có lỗi xảy ra khi tra cứu.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
