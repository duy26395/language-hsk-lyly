import React, { useState, useEffect } from 'react';
import QuizWizard from './components/QuizWizard';
import StudyDeck, { ReviewGrade, SavedWordEntry, WordReview } from './components/StudyDeck';
import { WordExplanation, AIModel } from './lib/ai';
import { motion, AnimatePresence } from 'framer-motion';

// New Components
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ReadPage from './components/ReadPage';
import CreatePage from './components/CreatePage';
import NotebookPage from './components/NotebookPage';
import SearchPage from './components/SearchPage';
import SpeakingPage from './components/SpeakingPage';

const softEase = [0.22, 1, 0.36, 1] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const createInitialReview = (): WordReview => ({
  dueAt: Date.now(),
  intervalDays: 0,
  ease: 2.5,
  lapses: 0,
  streak: 0,
});

const normalizeSavedWord = (item: SavedWordEntry): SavedWordEntry => ({
  ...item,
  review: {
    ...createInitialReview(),
    ...item.review,
  },
});

const scheduleReview = (currentReview: WordReview | undefined, grade: ReviewGrade): WordReview => {
  const now = Date.now();
  const review = { ...createInitialReview(), ...currentReview };
  const ease = review.ease || 2.5;
  let nextEase = ease;
  let intervalDays = review.intervalDays || 0;
  let streak = review.streak || 0;
  let lapses = review.lapses || 0;
  let dueAt = now;

  if (grade === 'again') {
    nextEase = Math.max(1.3, ease - 0.2);
    intervalDays = 0;
    streak = 0;
    lapses += 1;
    dueAt = now + 10 * 60 * 1000;
  }

  if (grade === 'hard') {
    nextEase = Math.max(1.3, ease - 0.05);
    intervalDays = Math.max(1, Math.ceil(Math.max(1, intervalDays) * 1.2));
    streak += 1;
    dueAt = now + intervalDays * DAY_MS;
  }

  if (grade === 'good') {
    intervalDays = intervalDays <= 0 ? 1 : Math.ceil(intervalDays * nextEase);
    streak += 1;
    dueAt = now + intervalDays * DAY_MS;
  }

  if (grade === 'easy') {
    nextEase = Math.min(3.2, ease + 0.15);
    intervalDays = intervalDays <= 0 ? 3 : Math.ceil(intervalDays * (nextEase + 0.7));
    streak += 1;
    dueAt = now + intervalDays * DAY_MS;
  }

  return {
    dueAt,
    intervalDays,
    ease: nextEase,
    lapses,
    streak,
    lastReviewedAt: now,
  };
};

const formatReviewDue = (dueAt: number) => {
  const diff = dueAt - Date.now();
  if (diff <= 0) return 'Due now';
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return `${Math.ceil(hours / 24)} day`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'read' | 'create' | 'study' | 'quiz' | 'notebook' | 'speaking'>('search');
  const [selectedModel, setSelectedModel] = useState<AIModel>('qwen/qwen3-32b');
  const [showSettings, setShowSettings] = useState(false);
  
  // Tab State
  const [readInput, setReadInput] = useState('');
  const [readText, setReadText] = useState('');
  const [createWords, setCreateWords] = useState('');
  const [hskLevel, setHskLevel] = useState('HSK 3');
  const [createdText, setCreatedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Global App State
  const [noteContent, setNoteContent] = useState('');
  const [savedWords, setSavedWords] = useState<SavedWordEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  // Sync Logic
  const saveToServer = async (words: SavedWordEntry[]) => {
    if (words.length === 0) return;
    setIsSyncing(true);
    try {
      await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      });
      setLastSynced(Date.now());
    } catch (e) {
      console.error('Sync to server failed');
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  useEffect(() => {
    const savedNotes = localStorage.getItem('chinese-notes');
    if (savedNotes) setNoteContent(savedNotes);

    const loadData = async () => {
      try {
        const res = await fetch('/api/vocabulary');
        const data = await res.json();
        if (data.words && data.words.length > 0) {
          setSavedWords(data.words.map(normalizeSavedWord));
          return;
        }
      } catch (e) {}

      const savedWordsStr = localStorage.getItem('chinese-saved-words');
      if (savedWordsStr) {
        try {
          const parsed = JSON.parse(savedWordsStr) as SavedWordEntry[];
          setSavedWords(parsed.map(normalizeSavedWord));
        } catch (e) {}
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem('chinese-notes', noteContent);
    localStorage.setItem('chinese-saved-words', JSON.stringify(savedWords));
    
    if (savedWords.length > 0) {
      const timeoutId = setTimeout(() => saveToServer(savedWords), 1500);
      return () => clearTimeout(timeoutId);
    }
  }, [noteContent, savedWords]);

  useEffect(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, [activeTab]);

  // Event Handlers
  const handleAddToNotebook = (word: string, explanation: WordExplanation) => {
    if (!savedWords.find(w => w.word === word)) {
      setSavedWords([...savedWords, { word, explanation, review: createInitialReview() }]);
    }
  };

  const handleRemoveWord = (word: string) => {
    setSavedWords(savedWords.filter(w => w.word !== word));
  };

  const handleReviewWord = (word: string, grade: ReviewGrade) => {
    setSavedWords((items) =>
      items.map((item) =>
        item.word === word
          ? { ...item, review: scheduleReview(item.review, grade) }
          : item,
      ),
    );
  };

  const fadeVariants = {
    hidden: { opacity: 0, y: 18, scale: 0.985, filter: 'blur(6px)' },
    visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.45, ease: softEase } },
    exit: { opacity: 0, y: -10, scale: 0.99, filter: 'blur(4px)', transition: { duration: 0.22, ease: 'easeInOut' } }
  };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row font-sans overflow-hidden bg-[#fbfaff] text-slate-800 relative">
      <div className="app-background" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/20" />
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        showSettings={showSettings} 
        setShowSettings={setShowSettings} 
      />

      <SettingsModal 
        showSettings={showSettings} 
        setShowSettings={setShowSettings} 
        selectedModel={selectedModel} 
        setSelectedModel={setSelectedModel} 
      />

      <main className="flex-1 overflow-y-auto pb-32 md:pb-0 relative scroll-smooth bg-transparent">
        <AnimatePresence mode="wait">
          
          {activeTab === 'search' && (
            <SearchPage 
              selectedModel={selectedModel}
              onAddToNotebook={handleAddToNotebook}
              fadeVariants={fadeVariants}
            />
          )}

          {activeTab === 'read' && (
            <ReadPage 
              readInput={readInput} setReadInput={setReadInput}
              readText={readText} setReadText={setReadText}
              selectedModel={selectedModel}
              onAddToNotebook={handleAddToNotebook}
              fadeVariants={fadeVariants}
            />
          )}

          {activeTab === 'speaking' && (
            <SpeakingPage 
              selectedModel={selectedModel}
              fadeVariants={fadeVariants}
            />
          )}

          {activeTab === 'create' && (
            <CreatePage 
              createWords={createWords} setCreateWords={setCreateWords}
              hskLevel={hskLevel} setHskLevel={setHskLevel}
              createdText={createdText} setCreatedText={setCreatedText}
              isGenerating={isGenerating} setIsGenerating={setIsGenerating}
              selectedModel={selectedModel}
              onAddToNotebook={handleAddToNotebook}
              onOpenReading={(text) => {
                setReadInput(text);
                setReadText(text);
                setActiveTab('read');
              }}
              fadeVariants={fadeVariants}
            />
          )}

          {activeTab === 'study' && (
            <motion.div key="study" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="max-w-5xl mx-auto p-5 md:p-10 flex flex-col gap-6 min-h-full">
              <div className="flex justify-between items-center print:hidden">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Daily Study</h1>
                  <p className="mt-1 text-sm text-slate-500">Review saved words with lightweight spaced repetition.</p>
                </div>
              </div>
              <StudyDeck
                words={savedWords}
                onReview={handleReviewWord}
                onOpenNotebook={() => setActiveTab('notebook')}
                onOpenReading={() => setActiveTab('read')}
              />
            </motion.div>
          )}

          {activeTab === 'quiz' && (
            <motion.div key="quiz" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="max-w-4xl mx-auto p-5 md:p-10 flex flex-col gap-6 min-h-full">
               <div className="flex justify-between items-center print:hidden">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">HSK Practice</h1>
              </div>
              <QuizWizard selectedModel={selectedModel} />
            </motion.div>
          )}

          {activeTab === 'notebook' && (
            <NotebookPage 
              noteContent={noteContent} setNoteContent={setNoteContent}
              savedWords={savedWords}
              handleRemoveWord={handleRemoveWord}
              isSyncing={isSyncing}
              lastSynced={lastSynced}
              saveToServer={saveToServer}
              handlePrint={() => window.print()}
              formatReviewDue={formatReviewDue}
              fadeVariants={fadeVariants}
            />
          )}

        </AnimatePresence>
      </main>

      <style>{`
        @media print {
          body { background-color: white !important; }
          .format-avoid-break { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
