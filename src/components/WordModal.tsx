import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Lightbulb, Plus } from 'lucide-react';
import { WordExplanation, readAloud } from '../lib/ai';

interface WordModalProps {
  explanation: WordExplanation | null;
  onClose: () => void;
  onAddToNotebook?: (word: string, explanation: WordExplanation) => void;
}

export default function WordModal({ explanation, onClose, onAddToNotebook }: WordModalProps) {
  if (!explanation) return null;

  const getHskColor = (level: string) => {
    const l = level.match(/\d/);
    if (!l) return '#94a3b8';
    const colors: Record<string, string> = {
      '1': '#10b981', '2': '#3b82f6', '3': '#f59e0b', 
      '4': '#ef4444', '5': '#8b5cf6', '6': '#ec4899'
    };
    return colors[l[0]] || '#94a3b8';
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 py-5 backdrop-blur-md sm:items-center sm:p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] bg-white p-4 shadow-2xl sm:rounded-[2.5rem] sm:p-8"
          onClick={e => e.stopPropagation()}
        >
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-bl-full -mr-8 -mt-8" />
          
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 sm:right-6 sm:top-6">
            <X className="w-6 h-6" />
          </button>

          <div className="flex flex-col gap-6">
            <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-3 pr-9 sm:pr-0">
                  <h2 className="chinese break-words text-4xl font-bold text-slate-800">{explanation.word}</h2>
                  <span 
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg text-white shadow-sm uppercase tracking-wider"
                    style={{ background: getHskColor(explanation.hskLevel) }}
                  >
                    {explanation.hskLevel}
                  </span>
                </div>
                <div className="mb-3 break-words text-lg font-medium text-violet-500 sm:text-xl">{explanation.pinyin}</div>
                <div className="text-base font-semibold leading-relaxed text-slate-700 sm:text-lg">
                  {explanation.meaning}
                </div>
              </div>
              <button 
                onClick={() => readAloud(explanation.word)}
                className="p-3 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-2xl transition-all active:scale-95 shadow-sm mt-1"
              >
                <Volume2 className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Ví dụ sử dụng</h4>
                <div className="chinese text-lg text-slate-800 mb-1 leading-relaxed">
                  {explanation.example}
                </div>
                {explanation.examplePinyin && (
                  <div className="text-violet-500/70 text-sm mb-2">{explanation.examplePinyin}</div>
                )}
                <div className="text-slate-500 italic text-sm">
                  {explanation.exampleMeaning}
                </div>
              </div>

              <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:gap-4 sm:p-5">
                <Lightbulb className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Mẹo học tập</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{explanation.learningTip}</p>
                </div>
              </div>

              {(explanation.synonyms || explanation.antonyms) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  {explanation.synonyms && explanation.synonyms !== 'none' && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                      <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Đồng nghĩa</h4>
                      <div className="chinese text-slate-700">{explanation.synonyms}</div>
                    </div>
                  )}
                  {explanation.antonyms && explanation.antonyms !== 'none' && (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                      <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">Trái nghĩa</h4>
                      <div className="chinese text-slate-700">{explanation.antonyms}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {onAddToNotebook && (
              <button 
                onClick={() => {
                  onAddToNotebook(explanation.word, explanation);
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-4 bg-violet-600 text-white rounded-2xl font-bold hover:bg-violet-700 transition-all active:scale-95 shadow-lg shadow-violet-200"
              >
                <Plus className="w-5 h-5" /> Lưu vào Sổ tay
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
