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
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl relative overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-bl-full -mr-8 -mt-8" />
          
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>

          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="chinese text-4xl font-bold text-slate-800">{explanation.word}</h2>
                  <span 
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg text-white shadow-sm uppercase tracking-wider"
                    style={{ background: getHskColor(explanation.hskLevel) }}
                  >
                    {explanation.hskLevel}
                  </span>
                </div>
                <div className="text-xl text-violet-500 font-medium mb-3">{explanation.pinyin}</div>
                <div className="text-lg text-slate-700 font-semibold leading-relaxed">
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
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
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

              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex gap-4">
                <Lightbulb className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Mẹo học tập</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{explanation.learningTip}</p>
                </div>
              </div>

              {(explanation.synonyms || explanation.antonyms) && (
                <div className="grid grid-cols-2 gap-4">
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
