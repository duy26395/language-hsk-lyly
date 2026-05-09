import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Cloud,
  FileText,
  LibraryBig,
  Loader2,
  NotebookPen,
  Printer,
  Search,
  Trash2,
  Type,
} from 'lucide-react';
import { SavedNoteEntry, SavedPassageEntry, SavedWordEntry } from './StudyDeck';

interface NotebookPageProps {
  noteContent: string;
  setNoteContent: (val: string) => void;
  savedNotes: SavedNoteEntry[];
  handleRemoveSavedNote: (id: string) => Promise<boolean>;
  savedWords: SavedWordEntry[];
  handleRemoveWord: (word: string) => Promise<boolean>;
  savedPassages: SavedPassageEntry[];
  handleRemovePassage: (id: string) => Promise<boolean>;
  onOpenPassage: (text: string) => void;
  isSyncing: boolean;
  isSavingNote: boolean;
  notebookToast: { type: 'success' | 'error'; title: string; message: string } | null;
  lastSynced: number | null;
  saveToServer: (
    words: SavedWordEntry[],
    passages?: SavedPassageEntry[],
    notes?: SavedNoteEntry[],
    options?: { showToast?: boolean; successMessage?: string; errorMessage?: string },
  ) => Promise<boolean>;
  onSaveNotes: () => void;
  handlePrint: () => void;
  fadeVariants: any;
}

type NotebookFilter = 'all' | 'words' | 'passages' | 'notes';

type NotebookTimelineItem =
  | { id: string; type: 'word'; savedAt: number; word: SavedWordEntry }
  | { id: string; type: 'passage'; savedAt: number; passage: SavedPassageEntry }
  | { id: string; type: 'note'; savedAt: number; note: SavedNoteEntry };

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayLabel(ts: number) {
  return new Date(ts).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function dayKey(ts: number) {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWordSearchText(item: SavedWordEntry) {
  return [
    item.word,
    item.explanation.pinyin,
    item.explanation.meaning,
    item.explanation.example,
    item.explanation.exampleMeaning,
    item.explanation.hskLevel,
  ]
    .join(' ')
    .toLowerCase();
}

function getPassageSearchText(item: SavedPassageEntry) {
  return [item.text, item.source ?? ''].join(' ').toLowerCase();
}

function getNoteSearchText(item: SavedNoteEntry) {
  return item.content.toLowerCase();
}

export default function NotebookPage({
  noteContent,
  setNoteContent,
  savedNotes,
  handleRemoveSavedNote,
  savedWords,
  handleRemoveWord,
  savedPassages,
  handleRemovePassage,
  onOpenPassage,
  isSyncing,
  isSavingNote,
  notebookToast,
  lastSynced,
  saveToServer,
  onSaveNotes,
  handlePrint,
  fadeVariants,
}: NotebookPageProps) {
  const [activeFilter, setActiveFilter] = useState<NotebookFilter>('all');
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const normalizedQuery = query.trim().toLowerCase();

  // Reset page when filter or query changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, normalizedQuery]);

  const timelineItems: NotebookTimelineItem[] = (() => {
    const wordItems = savedWords.map((word, index) => ({
      id: `word-${word.word}-${index}`,
      type: 'word' as const,
      savedAt: word.savedAt ?? 0,
      word,
    }));

    const passageItems = savedPassages.map((passage) => ({
      id: `passage-${passage.id}`,
      type: 'passage' as const,
      savedAt: passage.savedAt,
      passage,
    }));

    const noteItems = savedNotes.map((note) => ({
      id: `note-${note.id}`,
      type: 'note' as const,
      savedAt: note.savedAt,
      note,
    }));

    return [...wordItems, ...passageItems, ...noteItems].sort((a, b) => b.savedAt - a.savedAt);
  })();

  const filteredTimeline = timelineItems.filter((item) => {
    if (activeFilter === 'words' && item.type !== 'word') return false;
    if (activeFilter === 'passages' && item.type !== 'passage') return false;
    if (activeFilter === 'notes' && item.type !== 'note') return false;
    if (!normalizedQuery) return true;

    if (item.type === 'word') {
      return getWordSearchText(item.word).includes(normalizedQuery);
    }

    if (item.type === 'note') {
      return getNoteSearchText(item.note).includes(normalizedQuery);
    }

    return getPassageSearchText(item.passage).includes(normalizedQuery);
  });

  const totalPages = Math.ceil(filteredTimeline.length / ITEMS_PER_PAGE);
  const paginatedTimeline = filteredTimeline.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const groups = new Map<string, { label: string; items: NotebookTimelineItem[]; sortTs: number }>();

  for (const item of paginatedTimeline) {
    const stamp = item.savedAt > 0 ? item.savedAt : 1;
    const key = item.savedAt > 0 ? dayKey(item.savedAt) : 'older';
    const label = item.savedAt > 0 ? formatDayLabel(item.savedAt) : 'Saved before date tracking';
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
      existing.sortTs = Math.max(existing.sortTs, stamp);
      continue;
    }

    groups.set(key, { label, items: [item], sortTs: stamp });
  }

  const groupedTimeline = Array.from(groups.entries())
    .sort((a, b) => b[1].sortTs - a[1].sortTs)
    .map(([key, value]) => ({ key, ...value }));

  const notesCount = noteContent.trim().length;
  const savedNotesCount = savedNotes.length;
  const visibleWords = filteredTimeline.filter((item) => item.type === 'word').length;
  const visiblePassages = filteredTimeline.filter((item) => item.type === 'passage').length;
  const visibleNotes = filteredTimeline.filter((item) => item.type === 'note').length;

  const btnSecondary =
    'inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl glass px-4 py-3 text-sm font-semibold text-violet-700 transition-all duration-300 hover:border-violet-300 hover:bg-white/90 hover:shadow-sm active:scale-[0.98]';


   const panelClass =
    'rounded-[1.5rem] border border-white/50 glass shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] backdrop-blur-3xl transition-all hover:bg-white/50';


  return (
    <motion.div
      key="notebook"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mx-auto flex w-full max-w-7xl flex-col p-4 sm:p-5 md:p-10"
    >
      <div className="min-w-0 rounded-[2rem] bg-white/95 p-4 shadow-xl flex flex-col gap-6 backdrop-blur-3xl border border-white sm:p-6 md:p-8">
      <AnimatePresence>
        {notebookToast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="fixed right-4 top-4 z-[140] w-[calc(100vw-2rem)] max-w-sm sm:right-6 sm:top-6"
            role="status"
            aria-live="polite"
          >
            <div
              className={`flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.18)] ${
                notebookToast.type === 'success'
                  ? 'border-emerald-100 text-emerald-700'
                  : 'border-rose-100 text-rose-700'
              }`}
            >
              {notebookToast.type === 'success' ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-black">
                  {notebookToast.title}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-600">{notebookToast.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="overflow-hidden rounded-[2rem] border border-white/50 glass bg-[radial-gradient(circle_at_top_left,_rgba(196,181,253,0.35),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,0.4),_rgba(245,243,255,0.3))] p-5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] print:shadow-none sm:p-6 md:p-8 relative group">
        <div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
          <LibraryBig size={180} className="-rotate-12" />
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-violet-500">
                <NotebookPen className="h-3.5 w-3.5" />
                My Notebook
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                All your saved words, passages, and notes in one workspace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">
                Data is still saved by day in the backend, but here we surface everything together so users can search,
                scan, review, and reopen content faster.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <button
                onClick={() => {
                  void saveToServer(savedWords, savedPassages, savedNotes, {
                    successMessage: 'Notebook synced successfully.',
                    errorMessage: 'Could not sync notebook. Please try again.',
                  });
                }}
                disabled={isSyncing || (savedWords.length === 0 && savedPassages.length === 0)}
                className={`${btnSecondary} ${isSyncing ? 'opacity-70' : ''}`}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : lastSynced && Date.now() - lastSynced < 5000 ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Cloud className="h-4 w-4 text-violet-500" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync data'}
              </button>
              <button onClick={handlePrint} className={btnSecondary}>
                <Printer className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCard icon={Type} label="Saved words" value={savedWords.length} tone="violet" />
            <OverviewCard icon={FileText} label="Saved passages" value={savedPassages.length} tone="sky" />
            <OverviewCard icon={LibraryBig} label="Saved notes" value={savedNotesCount} tone="rose" />
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.95fr)]">
        <div className="min-w-0 space-y-5">
          <div className={`${panelClass} p-4 sm:p-5`}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-400">Library view</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Everything saved, organized for quick action</h2>
                </div>

                <div className="relative inline-flex w-full max-w-full items-center gap-2 rounded-2xl border border-white/60 bg-white/60 px-3 py-3 text-sm text-slate-500 lg:max-w-sm backdrop-blur-md transition-all duration-300 focus-within:bg-white focus-within:border-violet-300 focus-within:shadow-lg focus-within:shadow-violet-100/50">
                  <Search className="h-4 w-4 shrink-0 text-violet-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search words, pinyin, meaning..."
                    className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="rounded-full p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    active={activeFilter === 'all'}
                    label={`All (${filteredTimeline.length})`}
                    onClick={() => setActiveFilter('all')}
                  />
                  <FilterChip
                    active={activeFilter === 'words'}
                    label={`Words (${visibleWords})`}
                    onClick={() => setActiveFilter('words')}
                  />
                  <FilterChip
                    active={activeFilter === 'passages'}
                    label={`Passages (${visiblePassages})`}
                    onClick={() => setActiveFilter('passages')}
                  />
                  <FilterChip
                    active={activeFilter === 'notes'}
                    label={`Notes (${visibleNotes})`}
                    onClick={() => setActiveFilter('notes')}
                  />
                </div>
                <p className="text-sm text-slate-500">
                  Grouped by save day for new content, while still showing your full notebook together.
                </p>
              </div>
            </div>
          </div>

          {groupedTimeline.length === 0 ? (
            <div className={`${panelClass} flex flex-col items-center justify-center px-6 py-16 text-center`}>
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-violet-50 text-violet-500">
                <BookOpen className="h-8 w-8" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-slate-900">No matching items</h3>
              <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
                Try another keyword, or save more words and reading passages to build your notebook.
              </p>
            </div>
          ) : (
            groupedTimeline.map((group) => (
              <section key={group.key} className="space-y-3">
                <div className="flex items-center gap-3 px-1 pt-4 first:pt-0">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-violet-400/80">{group.label}</h3>
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-violet-100/50 to-transparent" />
                  <span className="rounded-lg bg-violet-50/50 px-2 py-0.5 text-[10px] font-bold text-violet-500/70 border border-violet-100/50">
                    {group.items.length} items
                  </span>
                </div>

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {group.items.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        layout
                      >
                        {item.type === 'word' ? (
                          <WordCard
                            item={item.word}
                            savedAt={item.savedAt}
                            onRemove={handleRemoveWord}
                            onOpenPassage={onOpenPassage}
                          />
                        ) : item.type === 'passage' ? (
                          <PassageCard
                            item={item.passage}
                            onOpenPassage={onOpenPassage}
                            onRemove={handleRemovePassage}
                          />
                        ) : (
                          <SavedNoteCard
                            item={item.note}
                            onRemove={handleRemoveSavedNote}
                            onOpenPassage={onOpenPassage}
                          />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            ))
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-8">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl glass text-violet-600 transition-all hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-1.5 px-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Basic pagination logic: show current, first, last, and neighbors
                  const isGap = page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1;
                  if (isGap) {
                    if (page === 2 || page === totalPages - 1) {
                      return <span key={page} className="text-slate-400">...</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all ${
                        currentPage === page
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                          : 'glass text-slate-600 hover:bg-white hover:text-violet-600'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-10 w-10 items-center justify-center rounded-xl glass text-violet-600 transition-all hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-5">
          <div className={`${panelClass} p-5 sm:p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-500">Personal notes</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Scratchpad for what you want to remember</h2>
              </div>
              <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-600">{notesCount} chars</div>
            </div>

            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your notes here..."
              className="mt-4 min-h-[260px] w-full resize-none rounded-[1.5rem] border border-amber-200/50 glass bg-amber-50/20 p-4 text-[15px] leading-7 text-slate-700 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-amber-400 focus:bg-white/60 focus:ring-4 focus:ring-amber-200/40"
            />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-slate-500">
                Keep quick mnemonics, grammar reminders, or examples you want to revisit while studying.
              </p>
              <button
                onClick={onSaveNotes}
                disabled={isSavingNote || !noteContent.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-200 transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.98]"
              >
                {isSavingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                {isSavingNote ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </aside>
      </section>
      </div>
    </motion.div>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'violet' | 'sky' | 'amber' | 'emerald' | 'rose';
}) {
  const toneMap = {
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
  } as const;

  return (
    <div className="group relative overflow-hidden rounded-[1.5rem] border border-white/50 glass p-4 shadow-xl backdrop-blur-3xl transition-all duration-500 hover:-translate-y-1.5 hover:bg-white/70 hover:shadow-2xl hover:shadow-violet-200/30">
      <div className={`absolute -right-4 -top-4 h-24 w-24 opacity-[0.03] transition-all duration-500 group-hover:scale-150 group-hover:opacity-[0.08] ${toneMap[tone].split(' ')[1]}`}>
        <Icon className="h-full w-full" />
      </div>
      
      <div className={`grid h-11 w-11 place-items-center rounded-2xl transition-transform duration-500 group-hover:rotate-12 ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-5 py-2 text-[13px] font-black uppercase tracking-wider transition-all duration-300 active:scale-[0.98] ${
        active
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 ring-2 ring-violet-600 ring-offset-2'
          : 'glass text-violet-500 hover:bg-white/90 hover:text-violet-600 hover:shadow-md'
      }`}
    >
      {label}
    </button>
  );
}

function WordCard({
  item,
  savedAt,
  onRemove,
  onOpenPassage,
}: {
  item: SavedWordEntry;
  savedAt: number;
  onRemove: (word: string) => Promise<boolean>;
  onOpenPassage: (text: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  return (
    <article className="group overflow-hidden rounded-[1.25rem] border border-violet-100/80 bg-white/95 shadow-[0_4px_20px_rgba(139,92,246,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_12px_24px_rgba(139,92,246,0.08)]">
      <div className="h-[3px] w-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400" />
      <div className="grid gap-3 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className={`chinese break-words font-black tracking-wide text-slate-900 ${item.word.length > 15 ? 'text-xl' : 'text-2xl'}`}>
                {item.word}
              </span>
              {item.explanation.hskLevel && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600">{item.explanation.hskLevel}</span>
              )}
              {savedAt > 0 && (
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">{formatDateTime(savedAt)}</span>
              )}
            </div>
            {item.explanation.pinyin && (
              <p className="mt-1 text-sm font-semibold text-violet-600">{item.explanation.pinyin}</p>
            )}
          </div>

          <button
            onClick={async () => {
              setRemoving(true);
              await onRemove(item.word);
              setRemoving(false);
            }}
            disabled={removing}
            className="shrink-0 rounded-full p-1.5 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="Remove word"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {item.explanation.meaning && (
          <p className="text-sm font-semibold leading-6 text-slate-700">{item.explanation.meaning}</p>
        )}

        {(item.explanation.example || item.explanation.exampleMeaning) && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            {item.explanation.example && <p className="chinese text-sm text-slate-800">{item.explanation.example}</p>}
            {item.explanation.exampleMeaning && (
              <p className="mt-1.5 text-[13px] italic text-slate-500">{item.explanation.exampleMeaning}</p>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            <FileText className="h-3 w-3" />
            <span className="truncate">Reading source</span>
          </div>
          <button
            onClick={() => onOpenPassage(item.word)}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-100 transition-all hover:bg-violet-700 active:scale-[0.98]"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Open
          </button>
        </div>
      </div>
    </article>
  );
}

function PassageCard({
  item,
  onOpenPassage,
  onRemove,
}: {
  item: SavedPassageEntry;
  onOpenPassage: (text: string) => void;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [removing, setRemoving] = useState(false);

  return (
    <article className="group overflow-hidden rounded-[1.25rem] border border-sky-100/80 bg-white/95 shadow-[0_4px_20px_rgba(2,132,199,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_12px_24px_rgba(2,132,199,0.08)]">
      <div className="h-[3px] w-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400" />
      <div className="grid gap-3 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                {item.source === 'create' ? 'AI' : 'Read'}
              </span>
              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">{formatDateTime(item.savedAt)}</span>
            </div>
            <p className="mt-2 text-[13px] text-slate-400">Len: {item.text.replace(/\s/g, '').length}</p>
          </div>

          <button
            onClick={async () => {
              setRemoving(true);
              await onRemove(item.id);
              setRemoving(false);
            }}
            disabled={removing}
            className="shrink-0 rounded-full p-1.5 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="Remove passage"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        <p className="chinese text-sm leading-7 text-slate-700 line-clamp-3">{item.text}</p>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            <FileText className="h-3 w-3" />
            <span className="truncate">Passage</span>
          </div>
          <button
            onClick={() => onOpenPassage(item.text)}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-sky-100 transition-all hover:bg-sky-700 active:scale-[0.98]"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Open
          </button>
        </div>
      </div>
    </article>
  );
}

function SavedNoteCard({
  item,
  onRemove,
  onOpenPassage,
}: {
  item: SavedNoteEntry;
  onRemove: (id: string) => Promise<boolean>;
  onOpenPassage: (text: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  return (
    <article className="group overflow-hidden rounded-[1.25rem] border border-rose-100/80 bg-white/95 shadow-[0_4px_20px_rgba(244,63,94,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_12px_24px_rgba(244,63,94,0.1)]">
      <div className="h-[3px] w-full bg-gradient-to-r from-rose-400 via-amber-300 to-fuchsia-400" />
      <div className="grid gap-3 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Note</span>
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {item.savedAt > 0 ? formatDateTime(item.savedAt) : 'Saved'}
            </span>
          </div>
          <button
            onClick={async () => {
              setRemoving(true);
              await onRemove(item.id);
              setRemoving(false);
            }}
            disabled={removing}
            className="shrink-0 rounded-full p-1.5 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="Remove note"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-6 text-slate-600 line-clamp-3">{item.content}</p>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            <FileText className="h-3 w-3" />
            <span className="truncate">Memo</span>
          </div>
          <button
            onClick={() => onOpenPassage(item.content)}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-rose-100 transition-all hover:bg-rose-700 active:scale-[0.98]"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Open
          </button>
        </div>
      </div>
    </article>
  );
}
