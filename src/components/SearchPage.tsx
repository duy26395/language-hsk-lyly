import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, History, Volume2, Lightbulb, Plus, BookOpen, Sparkles, Video, Link as LinkIcon } from 'lucide-react';
import { WordExplanation, explainWord, AIModel, readAloud } from '../lib/ai';

interface SearchPageProps {
  selectedModel: AIModel;
  onAddToNotebook: (word: string, explanation: WordExplanation) => void;
  fadeVariants: any;
}

const getHskColor = (level: string) => {
  const l = level.match(/\d/);
  if (!l) return '#94a3b8';
  const colors: Record<string, string> = {
    '1': '#10b981',
    '2': '#3b82f6',
    '3': '#f59e0b',
    '4': '#ef4444',
    '5': '#8b5cf6',
    '6': '#ec4899',
  };
  return colors[l[0]] || '#94a3b8';
};

export default function SearchPage({ selectedModel, onAddToNotebook, fadeVariants }: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const getMeaningList = (item: WordExplanation) => {
    if (item.meanings && item.meanings.length > 0) return item.meanings;
    return item.meaning
      .split(/[;,]|(?:\r?\n)/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  };

  const getSafeVideoLinks = (item: WordExplanation) => {
    const allowedHosts = new Set([
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'bilibili.com',
      'www.bilibili.com',
      'm.bilibili.com',
      'b23.tv',
    ]);
    const links = (item.videoLinks || []).filter((video) => {
      try {
        const parsed = new URL(video.url);
        return allowedHosts.has(parsed.hostname.toLowerCase());
      } catch {
        return false;
      }
    });

    if (links.length > 0) return links;

    const keyword = encodeURIComponent(`${item.word} 中文`);
    return [
      { title: `YouTube: ${item.word}`, url: `https://www.youtube.com/results?search_query=${keyword}` },
      { title: `Bilibili: ${item.word}`, url: `https://search.bilibili.com/all?keyword=${keyword}` },
    ];
  };

  const getDictionaryLinks = (word: string) => {
    const q = encodeURIComponent(word);
    return [
      { title: 'MDBG', url: `https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${q}` },
      { title: 'Zdic', url: `https://www.zdic.net/hans/${q}` },
      { title: 'Wiktionary (zh)', url: `https://zh.wiktionary.org/wiki/${q}` },
    ];
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const searchTerm = (overrideQuery ?? query).trim();
    if (!searchTerm) return;

    setLoading(true);
    setExplanation(null);

    const result = await explainWord(searchTerm, '', selectedModel);
    if (result) {
      setExplanation(result);
      setQuery(searchTerm);
      if (!history.includes(searchTerm)) {
        setHistory([searchTerm, ...history].slice(0, 5));
      }
    }
    setLoading(false);
  };

  return (
    <motion.div key="search" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Tìm kiếm Từ điển</h1>
          <p className="text-sm text-slate-500 mt-1">Tra nghĩa, cấp độ HSK, ví dụ và mẹo học nhanh.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <form onSubmit={handleSearch} className="relative group min-w-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm từ tiếng Trung, VD: 学习, 朋友..."
            className="w-full bg-white/95 border border-violet-100 rounded-2xl py-4 pl-11 pr-20 text-base md:pl-12 md:pr-28 md:text-lg focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 shadow-sm transition-all group-hover:shadow-md"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400 group-focus-within:text-violet-600 transition-colors" />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white transition-all hover:bg-violet-700 active:scale-95 disabled:opacity-50 md:px-4"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tìm'}
          </button>
        </form>

        {history.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <History className="w-4 h-4 text-slate-400 mr-1" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Gần đây:</span>
            {history.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleSearch(undefined, h)}
                className="px-3 py-1 bg-white border border-violet-50 text-slate-600 rounded-full text-sm hover:bg-violet-50 transition-colors"
              >
                {h}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-violet-400" />
              <p className="font-medium animate-pulse">Đang tìm kiếm bằng AI Dictionary...</p>
            </motion.div>
          ) : explanation ? (
            <motion.section
              key={explanation.word}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative min-w-0 overflow-hidden rounded-[1.5rem] border border-violet-50 bg-white/95 p-4 shadow-[0_18px_50px_rgba(139,92,246,0.12)] sm:p-5 md:p-7"
            >
              <div className="absolute right-0 top-0 h-28 w-36 floral-corner opacity-70" />
              <div className="relative flex flex-col gap-6">
                <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <h2 className="chinese break-words text-4xl font-bold text-slate-800 md:text-5xl">{explanation.word}</h2>
                      <span
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg text-white shadow-sm uppercase tracking-wider"
                        style={{ background: getHskColor(explanation.hskLevel) }}
                      >
                        {explanation.hskLevel}
                      </span>
                    </div>
                    <div className="mb-3 break-words text-lg font-medium text-violet-500 sm:text-xl">{explanation.pinyin}</div>
                    <div className="space-y-1">
                      {getMeaningList(explanation).map((meaningItem, index) => (
                        <div key={`${meaningItem}-${index}`} className="text-base md:text-lg text-slate-700 font-semibold leading-relaxed">
                          {index + 1}. {meaningItem}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => readAloud(explanation.word)}
                    className="p-3 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-2xl transition-all active:scale-95 shadow-sm shrink-0"
                    aria-label="Read word aloud"
                  >
                    <Volume2 className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                  <div className="min-w-0 rounded-2xl border border-violet-100/70 bg-violet-50/70 p-4 sm:p-5">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-3">
                      <BookOpen className="w-4 h-4" /> Ví dụ
                    </h4>
                    <div className="chinese text-lg text-slate-800 mb-1 leading-relaxed">{explanation.example}</div>
                    {explanation.examplePinyin && (
                      <div className="text-violet-500/70 text-sm mb-2">{explanation.examplePinyin}</div>
                    )}
                    <div className="text-slate-500 italic text-sm">{explanation.exampleMeaning}</div>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:p-5">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">
                      <Lightbulb className="w-4 h-4" /> Mẹo học
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed">{explanation.learningTip}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="min-w-0 rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
                    <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-2">Phát âm</h4>
                    <div className="text-sm text-slate-700">{explanation.pinyin}</div>
                    {explanation.pronunciations && explanation.pronunciations.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {explanation.pronunciations.map((pronounce, idx) => (
                          <p key={`${pronounce}-${idx}`} className="text-sm text-slate-600">
                            - {pronounce}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 sm:p-5">
                    <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Cách dùng</h4>
                    {explanation.usage ? (
                      <p className="text-sm text-slate-700 leading-relaxed">{explanation.usage}</p>
                    ) : (
                      <p className="text-sm text-slate-500 leading-relaxed">Xem ví dụ bên dưới để áp dụng trong hội thoại.</p>
                    )}
                    {explanation.usageExamples && explanation.usageExamples.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {explanation.usageExamples.map((usageItem, idx) => (
                          <p key={`${usageItem}-${idx}`} className="chinese text-sm text-slate-600">
                            - {usageItem}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="min-w-0 rounded-2xl border border-rose-100 bg-rose-50 p-4 sm:p-5">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-3">
                      <Video className="w-4 h-4" /> Video tham khảo
                    </h4>
                    <div className="space-y-2">
                      {getSafeVideoLinks(explanation).map((video, index) => (
                        <a
                          key={`${video.url}-${index}`}
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-rose-700 hover:text-rose-800 hover:underline break-all"
                        >
                          {index + 1}. {video.title || video.url}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">
                      <LinkIcon className="w-4 h-4" /> Từ điển Hanzi
                    </h4>
                    <div className="space-y-2">
                      {getDictionaryLinks(explanation.word).map((dict, index) => (
                        <a
                          key={`${dict.url}-${index}`}
                          href={dict.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-emerald-700 hover:text-emerald-800 hover:underline break-all"
                        >
                          {index + 1}. {dict.title}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {(explanation.synonyms || explanation.antonyms) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <button
                  type="button"
                  onClick={() => onAddToNotebook(explanation.word, explanation)}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-violet-600 text-white rounded-2xl font-bold hover:bg-violet-700 transition-all active:scale-95 shadow-lg shadow-violet-200"
                >
                  <Plus className="w-5 h-5" /> Lưu vào Sổ tay
                </button>
              </div>
            </motion.section>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 gap-6 opacity-40">
              <div className="w-24 h-24 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-emerald-50 rounded-full flex items-center justify-center text-violet-300 shadow-inner">
                <Search className="w-12 h-12" />
              </div>
              <p className="text-lg font-medium text-slate-400 text-center">
                <Sparkles className="inline w-5 h-5 mr-2 text-fuchsia-300" />
                Tìm bất kỳ từ tiếng Trung nào để xem ý nghĩa, cấp độ HSK, từ liên quan và ví dụ.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
