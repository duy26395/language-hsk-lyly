import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  History,
  Volume2,
  Lightbulb,
  Plus,
  BookOpen,
  Sparkles,
  Video,
  Link as LinkIcon,
} from 'lucide-react';
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

export default function SearchPage({
  selectedModel,
  onAddToNotebook,
  fadeVariants,
}: SearchPageProps) {
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
    <motion.div
      key="search"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10"
    >
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Tìm kiếm Từ điển</h1>
          <p className="mt-1 text-sm text-slate-500">Tra nghĩa, cấp độ HSK, ví dụ và mẹo học nhanh.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <form onSubmit={handleSearch} className="group relative min-w-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm từ tiếng Trung, VD: 学习, 朋友..."
            className="w-full rounded-2xl border border-violet-100 bg-white/95 py-4 pl-11 pr-20 text-base shadow-sm transition-all group-hover:shadow-md focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10 md:pl-12 md:pr-28 md:text-lg"
          />
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-400 transition-colors group-focus-within:text-violet-600" />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white transition-all hover:bg-violet-700 active:scale-95 disabled:opacity-50 md:px-4"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tìm'}
          </button>
        </form>

        {history.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <History className="mr-1 h-4 w-4 text-slate-400" />
            <span className="mr-2 text-xs font-bold uppercase tracking-wider text-slate-400">Gần đây:</span>
            {history.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleSearch(undefined, h)}
                className="rounded-full border border-violet-50 bg-white px-3 py-1 text-sm text-slate-600 transition-colors hover:bg-violet-50"
              >
                {h}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-4 py-20 text-slate-400"
            >
              <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
              <p className="animate-pulse font-medium">Đang tìm kiếm bằng AI Dictionary...</p>
            </motion.div>
          ) : explanation ? (
            <motion.section
              key={explanation.word}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative min-w-0 overflow-hidden rounded-[1.5rem] border border-violet-50 bg-white/95 p-4 shadow-[0_18px_50px_rgba(139,92,246,0.12)] sm:p-5 md:p-7"
            >
              <div className="floral-corner absolute right-0 top-0 h-28 w-36 opacity-70" />
              <div className="relative flex flex-col gap-6">
                <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-3">
                      <h2 className="chinese break-words text-4xl font-bold text-slate-800 md:text-5xl">
                        {explanation.word}
                      </h2>
                      <span
                        className="rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
                        style={{ background: getHskColor(explanation.hskLevel) }}
                      >
                        {explanation.hskLevel}
                      </span>
                    </div>
                    <div className="mb-3 break-words text-lg font-medium text-violet-500 sm:text-xl">
                      {explanation.pinyin}
                    </div>
                    <div className="space-y-1">
                      {getMeaningList(explanation).map((meaningItem, index) => (
                        <div
                          key={`${meaningItem}-${index}`}
                          className="text-base font-semibold leading-relaxed text-slate-700 md:text-lg"
                        >
                          {index + 1}. {meaningItem}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => readAloud(explanation.word)}
                    className="shrink-0 rounded-2xl bg-violet-50 p-3 text-violet-600 shadow-sm transition-all hover:bg-violet-100 active:scale-95"
                    aria-label="Read word aloud"
                  >
                    <Volume2 className="h-6 w-6" />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                  <div className="min-w-0 rounded-2xl border border-violet-100/70 bg-violet-50/70 p-4 sm:p-5">
                    <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-500">
                      <BookOpen className="h-4 w-4" /> Ví dụ
                    </h4>
                    <div className="chinese mb-1 text-lg leading-relaxed text-slate-800">{explanation.example}</div>
                    {explanation.examplePinyin && (
                      <div className="mb-2 text-sm text-violet-500/70">{explanation.examplePinyin}</div>
                    )}
                    <div className="text-sm italic text-slate-500">{explanation.exampleMeaning}</div>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:p-5">
                    <h4 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-600">
                      <Lightbulb className="h-4 w-4" /> Mẹo học
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-700">{explanation.learningTip}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="min-w-0 rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
                    <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-sky-600">Phát âm</h4>
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
                    <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600">Cách dùng</h4>
                    {explanation.usage ? (
                      <p className="text-sm leading-relaxed text-slate-700">{explanation.usage}</p>
                    ) : (
                      <p className="text-sm leading-relaxed text-slate-500">
                        Xem ví dụ bên dưới để áp dụng trong hội thoại.
                      </p>
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
                    <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-rose-600">
                      <Video className="h-4 w-4" /> Video tham khảo
                    </h4>
                    <div className="space-y-2">
                      {getSafeVideoLinks(explanation).map((video, index) => (
                        <a
                          key={`${video.url}-${index}`}
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block break-all text-sm text-rose-700 hover:text-rose-800 hover:underline"
                        >
                          {index + 1}. {video.title || video.url}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
                    <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                      <LinkIcon className="h-4 w-4" /> Từ điển Hanzi
                    </h4>
                    <div className="space-y-2">
                      {getDictionaryLinks(explanation.word).map((dict, index) => (
                        <a
                          key={`${dict.url}-${index}`}
                          href={dict.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block break-all text-sm text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          {index + 1}. {dict.title}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {(explanation.synonyms || explanation.antonyms) && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {explanation.synonyms && explanation.synonyms !== 'none' && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          Đồng nghĩa
                        </h4>
                        <div className="chinese text-slate-700">{explanation.synonyms}</div>
                      </div>
                    )}
                    {explanation.antonyms && explanation.antonyms !== 'none' && (
                      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                        <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                          Trái nghĩa
                        </h4>
                        <div className="chinese text-slate-700">{explanation.antonyms}</div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onAddToNotebook(explanation.word, explanation)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 font-bold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 active:scale-95"
                >
                  <Plus className="h-5 w-5" /> Lưu vào Sổ tay
                </button>
              </div>
            </motion.section>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-6 py-24 opacity-40"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 via-fuchsia-50 to-emerald-50 text-violet-300 shadow-inner">
                <Search className="h-12 w-12" />
              </div>
              <p className="text-center text-lg font-medium text-slate-400">
                <Sparkles className="mr-2 inline h-5 w-5 text-fuchsia-300" />
                Tìm bất kỳ từ tiếng Trung nào để xem ý nghĩa, cấp độ HSK, từ liên quan và ví dụ.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
