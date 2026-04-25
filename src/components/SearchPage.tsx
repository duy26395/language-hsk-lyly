import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, History } from 'lucide-react';
import { WordExplanation, explainWord, AIModel } from '../lib/ai';
import WordModal from './WordModal';

interface SearchPageProps {
  selectedModel: AIModel;
  onAddToNotebook: (word: string, explanation: WordExplanation) => void;
  fadeVariants: any;
}

export default function SearchPage({ selectedModel, onAddToNotebook, fadeVariants }: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setExplanation(null);
    
    const result = await explainWord(query.trim(), '', selectedModel);
    if (result) {
      setExplanation(result);
      setShowModal(true);
      if (!history.includes(query.trim())) {
        setHistory([query.trim(), ...history].slice(0, 5));
      }
    }
    setLoading(false);
  };

  return (
    <motion.div key="search" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="max-w-4xl mx-auto p-5 md:p-10 flex flex-col gap-6 min-h-full">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Tìm kiếm Từ điển</h1>
      </div>

      <div className="flex flex-col gap-6">
        <form onSubmit={handleSearch} className="relative group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm từ tiếng Trung (VD: 学习, 朋友)..."
            className="w-full bg-white/90 border border-violet-100 rounded-2xl py-4 pl-12 pr-4 text-lg focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 shadow-sm transition-all group-hover:shadow-md"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400 group-focus-within:text-violet-600 transition-colors" />
          <button 
            type="submit"
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tìm kiếm'}
          </button>
        </form>

        {history.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <History className="w-4 h-4 text-slate-400 mr-1" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Gần đây:</span>
            {history.map(h => (
              <button 
                key={h} 
                onClick={() => { setQuery(h); handleSearch(); }}
                className="px-3 py-1 bg-white border border-violet-50 text-slate-600 rounded-full text-sm hover:bg-violet-50 transition-colors"
              >
                {h}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-violet-400" />
              <p className="font-medium animate-pulse">Đang tìm kiếm bằng AI Dictionary...</p>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 gap-6 opacity-40">
              <div className="w-24 h-24 bg-violet-100 rounded-full flex items-center justify-center text-violet-300">
                <Search className="w-12 h-12" />
              </div>
              <p className="text-lg font-medium text-slate-400 text-center">Tìm bất kỳ từ tiếng Trung nào để xem ý nghĩa, cấp độ HSK, từ đồng nghĩa và nhiều hơn nữa.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <WordModal 
        explanation={explanation} 
        onClose={() => setShowModal(false)} 
        onAddToNotebook={onAddToNotebook}
      />
    </motion.div>
  );
}
