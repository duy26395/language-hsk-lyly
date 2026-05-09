import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  History,
  Layers3,
  Lightbulb,
  Link as LinkIcon,
  Loader2,
  MessageSquareQuote,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { AIModel, WordExplanation, explainWord, readAloud } from '../lib/ai';

interface SearchPageProps {
  selectedModel: AIModel;
  onAddToNotebook: (word: string, explanation: WordExplanation) => Promise<boolean>;
  fadeVariants: any;
}

const SAMPLE_WORDS = ['把', '已经', '虽然', '方便', '影响', '越来越'];

const getHskColor = (level: string) => {
  const match = level.match(/\d/);
  if (!match) return '#64748b';
  const colors: Record<string, string> = {
    '1': '#059669',
    '2': '#2563eb',
    '3': '#d97706',
    '4': '#dc2626',
    '5': '#7c3aed',
    '6': '#db2777',
  };
  return colors[match[0]] || '#64748b';
};

const getList = (value?: string[] | string) => {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[;,]|(?:\r?\n)/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const getMeaningList = (item: WordExplanation) => {
  const meanings = getList(item.meanings);
  if (meanings.length > 0) return meanings;
  return getList(item.meaning);
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
    { title: 'Hanzii', url: `https://hanzii.net/search/word/${q}` },
    { title: 'YoHanzi', url: `https://yohanzi.com/vi/search?q=${q}` },
    { title: 'MDBG', url: `https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${q}` },
    { title: 'Zdic', url: `https://www.zdic.net/hans/${q}` },
  ];
};

function SectionTitle({
  icon: Icon,
  title,
  tone = 'text-slate-700',
}: {
  icon: React.ElementType;
  title: string;
  tone?: string;
}) {
  return (
    <div className={`mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${tone}`}>
      <Icon className="h-4 w-4" />
      {title}
    </div>
  );
}

export default function SearchPage({
  selectedModel,
  onAddToNotebook,
  fadeVariants,
}: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingWord, setSavingWord] = useState(false);
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState('');
  const requestSeqRef = useRef(0);

  const handleSearch = async (event?: React.FormEvent, overrideQuery?: string) => {
    if (event) event.preventDefault();
    const searchTerm = (overrideQuery ?? query).trim();
    if (!searchTerm || loading) return;

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setLoading(true);
    setError('');

    const result = await explainWord(searchTerm, 'Tra theo phong cách từ điển Hanzi, nhấn mạnh cách dùng và ngữ pháp trọng tâm.', selectedModel);
    if (requestSeq !== requestSeqRef.current) return;

    if (result) {
      setExplanation(result);
      setQuery(searchTerm);
      setHistory((items) => [searchTerm, ...items.filter((item) => item !== searchTerm)].slice(0, 6));
    } else {
      setError('Chưa tra được mục này. Thử nhập Hán tự/pinyin khác hoặc đổi model trong Settings nhé.');
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
      className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10"
    >
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">
            Từ điển Hanzi
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Tra Hán tự, pinyin, nghĩa Việt, bộ thủ, mẫu câu và lỗi ngữ pháp thường gặp trong một màn hình học.
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/20 glass px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
          {selectedModel}
        </span>

      </div>

      <div className="glass rounded-2xl p-3 shadow-xl md:p-4 transition-all hover:shadow-2xl hover:bg-white/50 group">

        <form onSubmit={handleSearch} className="relative min-w-0">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nhập Hán tự, pinyin hoặc cụm từ: 学习, ba, càng ngày càng..."
            className="h-14 w-full rounded-xl border border-white/40 bg-white/90 pl-11 pr-24 text-base font-semibold text-slate-700 outline-none transition-all focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-500/10 shadow-inner"


          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 flex h-10 min-w-16 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tra'}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_WORDS.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => handleSearch(undefined, word)}
              disabled={loading}
              className="rounded-full border border-slate-200 bg-white/60 px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-white disabled:opacity-50"

            >
              {word}
            </button>
          ))}
        </div>
      </div>

        <div className="flex flex-wrap items-center gap-2">
          <History className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Gần đây</span>
          {history.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSearch(undefined, item)}
              className="rounded-full border border-white/60 bg-white/50 px-3 py-1 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-white/80"

            >
              {item}
            </button>
          ))}
        </div>


      {loading && explanation && (
        <div className="flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Đang cập nhật kết quả mới...
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading && !explanation ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-4 py-24 text-slate-400"
          >
            <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
            <p className="font-semibold">Đang phân tích theo kiểu từ điển Hanzi...</p>
          </motion.div>
        ) : explanation ? (
          <motion.section
            key={explanation.word}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]"
          >
            <div className="min-w-0 space-y-4">
              <div className="glass rounded-2xl p-5 shadow-xl md:p-6 transition-all hover:bg-white/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                  <BookOpen size={120} className="-rotate-12" />
                </div>

                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <h2 className="chinese break-words text-5xl font-bold leading-tight text-slate-900 md:text-6xl">
                        {explanation.word}
                      </h2>
                      <span
                        className="rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm"
                        style={{ backgroundColor: getHskColor(explanation.hskLevel) }}
                      >
                        {explanation.hskLevel || 'HSK'}
                      </span>
                    </div>
                    <p className="break-words text-xl font-bold text-slate-500">{explanation.pinyin}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => readAloud(explanation.word)}
                    className="shrink-0 rounded-xl bg-slate-900 p-3 text-white shadow-sm transition-colors hover:bg-slate-700"
                    aria-label="Đọc từ"
                    title="Đọc từ"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-5 space-y-2">
                  {getMeaningList(explanation).map((meaning, index) => (
                    <p key={`${meaning}-${index}`} className="text-base font-semibold leading-7 text-slate-700 md:text-lg">
                      <span className="mr-2 text-slate-400">{index + 1}.</span>
                      {meaning}
                    </p>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100/50 bg-emerald-50/20 p-4 backdrop-blur-sm">

                  <SectionTitle icon={Layers3} title="Hán tự" tone="text-emerald-700" />
                  <div className="space-y-2 text-sm leading-6 text-slate-700">
                    <p><span className="font-bold">Bộ thủ:</span> {explanation.radical || 'Đang cập nhật'}</p>
                    <p><span className="font-bold">Số nét:</span> {explanation.strokes || 'Đang cập nhật'}</p>
                    {getList(explanation.decomposition).length > 0 && (
                      <div className="space-y-1">
                        {getList(explanation.decomposition).map((item, index) => (
                          <p key={`${item}-${index}`}>- {item}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-100/50 bg-amber-50/20 p-4 backdrop-blur-sm">

                  <SectionTitle icon={Lightbulb} title="Mẹo nhớ" tone="text-amber-700" />
                  <p className="text-sm leading-6 text-slate-700">{explanation.learningTip || 'Gắn nghĩa với ví dụ bên dưới để nhớ theo ngữ cảnh.'}</p>
                </div>
              </div>

              <div className="glass rounded-2xl border-sky-100/50 bg-sky-50/40 p-4 md:p-5 relative overflow-hidden group">
                <div className="absolute -bottom-4 -right-4 opacity-[0.1] text-sky-600">
                   <Sparkles size={80} />
                </div>

                <SectionTitle icon={BookOpen} title="Ví dụ chuẩn" tone="text-sky-700" />
                <p className="chinese text-lg font-semibold leading-8 text-slate-900">{explanation.example}</p>
                {explanation.examplePinyin && <p className="mt-1 text-sm font-semibold text-sky-700/70">{explanation.examplePinyin}</p>}
                <p className="mt-2 text-sm leading-6 text-slate-600">{explanation.exampleMeaning}</p>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-2xl border border-indigo-100/50 bg-indigo-50/20 p-4 md:p-5 backdrop-blur-sm">

                <SectionTitle icon={GraduationCap} title="Ngữ pháp trọng tâm" tone="text-indigo-700" />
                {getList(explanation.grammarFocus).length > 0 ? (
                  <ul className="space-y-2 text-sm leading-6 text-slate-700">
                    {getList(explanation.grammarFocus).map((item, index) => (
                      <li key={`${item}-${index}`} className="flex gap-2">
                        <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">{explanation.usage || 'Tập trung vào vị trí của từ trong câu và cụm từ hay đi kèm.'}</p>
                )}
              </div>

              {explanation.commonPatterns && explanation.commonPatterns.length > 0 && (
                <div className="glass rounded-2xl border-violet-100/50 bg-white/40 p-4 shadow-xl md:p-5 transition-all hover:bg-white/60">

                  <SectionTitle icon={MessageSquareQuote} title="Mẫu câu hay dùng" tone="text-violet-700" />
                  <div className="space-y-3">
                    {explanation.commonPatterns.slice(0, 4).map((pattern, index) => (
                      <div key={`${pattern.pattern}-${index}`} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                        <p className="font-mono text-sm font-bold text-slate-900">{pattern.pattern}</p>
                        {pattern.meaning && <p className="mt-1 text-sm leading-6 text-slate-600">{pattern.meaning}</p>}
                        {pattern.example && <p className="chinese mt-2 text-base font-semibold text-slate-800">{pattern.example}</p>}
                        {pattern.examplePinyin && <p className="text-xs font-semibold text-violet-500/70">{pattern.examplePinyin}</p>}
                        {pattern.exampleMeaning && <p className="mt-1 text-sm text-slate-500">{pattern.exampleMeaning}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getList(explanation.commonMistakes).length > 0 && (
                <div className="rounded-2xl border border-rose-100/50 bg-rose-50/20 p-4 md:p-5 backdrop-blur-sm">
                  <SectionTitle icon={PenLine} title="Lỗi dễ mắc" tone="text-rose-700" />
                  <ul className="space-y-2 text-sm leading-6 text-slate-700">
                    {getList(explanation.commonMistakes).map((mistake, index) => (
                      <li key={`${mistake}-${index}`}>- {mistake}</li>
                    ))}
                  </ul>
                </div>
              )}


              {explanation.usageExamples && explanation.usageExamples.length > 0 && (
                <div className="glass rounded-2xl p-4 shadow-xl md:p-5 transition-all hover:bg-white/60">

                  <SectionTitle icon={Sparkles} title="Cụm dùng nhanh" />
                  <div className="flex flex-wrap gap-2">
                    {explanation.usageExamples.map((item, index) => (
                      <span key={`${item}-${index}`} className="chinese rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <SectionTitle icon={LinkIcon} title="Từ điển" tone="text-emerald-700" />
                  <div className="space-y-2">
                    {getDictionaryLinks(explanation.word).map((dict) => (
                      <a
                        key={dict.url}
                        href={dict.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm font-semibold text-emerald-700 hover:underline"
                      >
                        {dict.title}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
                  <SectionTitle icon={Volume2} title="Video" tone="text-rose-700" />
                  <div className="space-y-2">
                    {getSafeVideoLinks(explanation).slice(0, 3).map((video) => (
                      <a
                        key={video.url}
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block break-words text-sm font-semibold text-rose-700 hover:underline"
                      >
                        {video.title || video.url}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {(explanation.synonyms || explanation.antonyms) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {explanation.synonyms && explanation.synonyms !== 'none' && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Đồng nghĩa</p>
                      <p className="chinese text-slate-800">{explanation.synonyms}</p>
                    </div>
                  )}
                  {explanation.antonyms && explanation.antonyms !== 'none' && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Trái nghĩa</p>
                      <p className="chinese text-slate-800">{explanation.antonyms}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  setSavingWord(true);
                  await onAddToNotebook(explanation.word, explanation);
                  setSavingWord(false);
                }}
                disabled={savingWord}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg shadow-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                {savingWord ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                {savingWord ? 'Đang lưu...' : 'Lưu vào Sổ tay'}
              </button>
            </div>
          </motion.section>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-5 py-20 text-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
              <Search className="h-10 w-10" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-600">Tra như từ điển, học như giáo trình nhỏ</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                Mỗi kết quả ưu tiên nghĩa đúng ngữ cảnh, cấu tạo Hán tự, mẫu câu và lỗi người Việt hay gặp.
              </p>
            </div>
            {error && (
              <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
