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

export default function InteractiveText({ text, onAddToNotebook, selectedModel = 'gemini' }: InteractiveTextProps) {
  const [segments, setSegments] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ word: string; context: string; x: number; y: number } | null>(null);
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  
  const popoverRef = useRef<HTMLDivElement>(null);
  const explanationCache = useRef<Map<string, WordExplanation>>(new Map());

  useEffect(() => {
    setSegments(segmentChineseText(text));
  }, [text]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelected(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleWordClick = async (e: React.MouseEvent<HTMLSpanElement>, word: string, index: number) => {
    if (!/[\u4e00-\u9fa5]/.test(word)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const start = Math.max(0, index - 10);
    const end = Math.min(segments.length, index + 10);
    const context = segments.slice(start, end).join('');

    const x = Math.max(16, Math.min(rect.left + rect.width / 2 - 140, window.innerWidth - 296));
    const y = Math.min(rect.bottom + 12, window.innerHeight - 332);
    const cacheKey = `${selectedModel}:${word}:${context}`;
    const cached = explanationCache.current.get(cacheKey);

    setSelected({ 
      word, 
      context, 
      x,
      y
    });
    setExplanation(cached ?? null);
    setLoading(!cached);

    if (cached) return;

    const result = await explainWord(word, context, selectedModel);
    if (result) {
      explanationCache.current.set(cacheKey, result);
    }
    setExplanation(result);
    setLoading(false);
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

  return (
    <div className="chinese text-[18px] md:text-[20px] leading-[2.2] text-slate-800" style={{ position: 'relative' }}>
      {segments.map((segment, idx) => {
        const isChinese = /[\u4e00-\u9fa5]/.test(segment);
        const isSelected = selected?.word === segment;
        return (
          <span
            key={idx}
            className={`
              ${isChinese ? 'cursor-pointer transition-all duration-200 border-b-2 border-transparent hover:bg-violet-50 hover:border-violet-200 rounded px-0.5 mx-[1px]' : ''}
              ${isSelected ? '!bg-violet-100 !text-violet-700 !border-violet-500 scale-105 inline-block shadow-sm z-10 relative font-medium' : ''}
            `}
            onClick={(e) => handleWordClick(e, segment, idx)}
          >
            {segment}
          </span>
        );
      })}

      <AnimatePresence>
      {selected && (
        <motion.div 
          ref={popoverRef}
          initial={{ opacity: 0, y: 12, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(10px)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
          className="fixed w-[320px] bg-white/90 backdrop-blur-2xl border border-violet-100 shadow-[0_25px_60px_-15px_rgba(139,92,246,0.2)] p-6 rounded-[2rem] z-[60] text-left overflow-hidden"
          style={{ top: selected.y, left: selected.x }}
        >
          {/* Decorative gradients */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-bl-full -mr-6 -mt-6 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-fuchsia-500/5 rounded-tr-full -ml-4 -mb-4 pointer-events-none" />

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="chinese text-2xl font-bold text-slate-800 tracking-tight leading-none">
                    {selected.word}
                  </h3>
                  {explanation && (
                    <span 
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white shadow-sm uppercase tracking-wider shrink-0"
                      style={{ background: getHskColor(explanation.hskLevel) }}
                    >
                      {explanation.hskLevel}
                    </span>
                  )}
                </div>
                {loading ? (
                  <div className="h-4 bg-slate-100 rounded-full w-24 animate-pulse mt-2"></div>
                ) : (
                  <div className="text-violet-500 font-semibold text-sm tracking-wide">
                    {explanation?.pinyin}
                  </div>
                )}
              </div>
              {!loading && (
                <button 
                  onClick={() => playAudio(selected.word)}
                  className="p-2.5 bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700 rounded-2xl transition-all active:scale-90 shadow-sm"
                  title="Nghe phát âm"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-3 py-2">
                  <div className="flex items-center text-slate-400 text-xs font-medium tracking-wide">
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-violet-500" />
                    ĐANG PHÂN TÍCH...
                  </div>
                  <div className="h-3 bg-slate-50 rounded-full w-full animate-pulse"></div>
                  <div className="h-3 bg-slate-50 rounded-full w-2/3 animate-pulse"></div>
                </div>
              ) : explanation ? (
                <div className="space-y-4">
                  <div className="text-slate-700 text-sm font-medium leading-relaxed bg-violet-50/50 p-3 rounded-xl border border-violet-100/50">
                    {explanation.meaning}
                  </div>

                  <div className="space-y-2">
                    <div className="text-slate-800 text-sm leading-relaxed chinese">
                      {explanation.example}
                    </div>
                    {explanation.examplePinyin && (
                      <div className="text-violet-400 text-[11px] font-medium leading-tight">
                        {explanation.examplePinyin}
                      </div>
                    )}
                    <div className="text-slate-500 text-[11px] italic leading-tight">
                      {explanation.exampleMeaning}
                    </div>
                  </div>

                  <div className="flex gap-3 items-start bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                      {explanation.learningTip}
                    </p>
                  </div>

                  {(explanation.synonyms || explanation.antonyms) && (
                    <div className="grid grid-cols-2 gap-2">
                      {explanation.synonyms && explanation.synonyms !== 'none' && (
                        <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl p-2.5">
                          <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Đồng nghĩa</div>
                          <div className="text-slate-700 text-xs chinese font-medium">{explanation.synonyms}</div>
                        </div>
                      )}
                      {explanation.antonyms && explanation.antonyms !== 'none' && (
                        <div className="bg-rose-50/50 border border-rose-100/50 rounded-xl p-2.5">
                          <div className="text-[9px] font-bold text-rose-600 uppercase tracking-wider mb-1">Trái nghĩa</div>
                          <div className="text-slate-700 text-xs chinese font-medium">{explanation.antonyms}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {onAddToNotebook && (
                    <button 
                      onClick={() => onAddToNotebook(selected.word, explanation)}
                      className="w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-violet-200 transition-all active:scale-[0.98] text-[13px] shadow-sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Lưu vào sổ tay
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-xl border border-rose-100 font-medium">
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
