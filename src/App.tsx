import { useEffect, useState } from 'react';
import QuizWizard from './components/QuizWizard';
import StudyDeck from './components/StudyDeck';
import type { AIModel } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import AppBackground from './components/AppBackground';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ReadPage from './components/ReadPage';
import CreatePage from './components/CreatePage';
import NotebookPage from './components/NotebookPage';
import SearchPage from './components/SearchPage';
import SpeakingPage from './components/SpeakingPage';
import AIChatPage from './components/AIChatPage';
import SecurityGuard from './components/SecurityGuard';
import { NotebookProvider } from './contexts/NotebookContext';
import { useVoiceNotice } from './hooks/useVoiceNotice';
import VoiceNoticeModal from './components/modals/VoiceNoticeModal';
import { DEFAULT_MODEL } from './constants';

const softEase = [0.22, 1, 0.36, 1] as const;

// Defined at module scope — no re-creation on every render.
// PERF: Removed filter:blur() from all states. Animating blur on a large DOM
// sub-tree forces a full repaint on every frame and compounds with the
// backdrop-filter cost on .glass cards.  opacity + y is enough for a polished
// transition and stays entirely on the compositor thread.
const fadeVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.987 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.38, ease: softEase },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.992,
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
};

function AppContent() {
  const [activeTab, setActiveTab] = useState<
    'search' | 'read' | 'create' | 'study' | 'quiz' | 'notebook' | 'speaking' | 'chat'
  >('search');
  const [selectedModel, setSelectedModel] = useState<AIModel>(DEFAULT_MODEL);
  const [showSettings, setShowSettings] = useState(false);

  const [readInput, setReadInput] = useState('');
  const [readText, setReadText] = useState('');
  const [createWords, setCreateWords] = useState('');
  const [hskLevel, setHskLevel] = useState('HSK 3');
  const [createdText, setCreatedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { showVoiceNotice, closeNotice } = useVoiceNotice();

  const openSpeakingPage = () => {
    closeNotice();
    setActiveTab('speaking');
  };

  useEffect(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, [activeTab]);


  return (
    <SecurityGuard>
      <div className="relative flex h-dvh min-h-dvh w-full min-w-0 flex-col overflow-hidden bg-transparent font-sans text-slate-800 md:flex-row">
        <AppBackground />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-500/10 via-transparent to-fuchsia-500/10 mix-blend-overlay" />

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

        <main className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-transparent scroll-smooth">
          <AnimatePresence mode="wait">
            {activeTab === 'search' && (
              <SearchPage
                selectedModel={selectedModel}
                fadeVariants={fadeVariants}
              />
            )}

            {activeTab === 'read' && (
              <ReadPage
                readInput={readInput}
                setReadInput={setReadInput}
                readText={readText}
                setReadText={setReadText}
                selectedModel={selectedModel}
                fadeVariants={fadeVariants}
              />
            )}

            {activeTab === 'speaking' && (
              <SpeakingPage selectedModel={selectedModel} fadeVariants={fadeVariants} />
            )}

            {activeTab === 'chat' && (
              <AIChatPage selectedModel={selectedModel} fadeVariants={fadeVariants} />
            )}

            {activeTab === 'create' && (
              <CreatePage
                createWords={createWords}
                setCreateWords={setCreateWords}
                hskLevel={hskLevel}
                setHskLevel={setHskLevel}
                createdText={createdText}
                setCreatedText={setCreatedText}
                isGenerating={isGenerating}
                setIsGenerating={setIsGenerating}
                selectedModel={selectedModel}
                onOpenReading={(text) => {
                  setReadInput(text);
                  setReadText(text);
                  setActiveTab('read');
                }}
                fadeVariants={fadeVariants}
              />
            )}

            {activeTab === 'study' && (
              <motion.div
                key="study"
                variants={fadeVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10"
              >
                <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">
                      Daily Study
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      Review saved words with lightweight spaced repetition.
                    </p>
                  </div>
                </div>
                <StudyDeck
                  onOpenNotebook={() => setActiveTab('notebook')}
                  onOpenReading={() => setActiveTab('read')}
                />
              </motion.div>
            )}

            {activeTab === 'quiz' && (
              <motion.div
                key="quiz"
                variants={fadeVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 p-4 sm:p-5 md:gap-6 md:p-10"
              >
                <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">
                    HSK Practice
                  </h1>
                </div>
                <QuizWizard selectedModel={selectedModel} />
              </motion.div>
            )}

            {activeTab === 'notebook' && (
              <NotebookPage
                onOpenPassage={(text) => {
                  setReadInput(text);
                  setReadText(text);
                  setActiveTab('read');
                }}
                handlePrint={() => window.print()}
                fadeVariants={fadeVariants}
              />
            )}
          </AnimatePresence>
        </main>

        <VoiceNoticeModal
          isOpen={showVoiceNotice}
          onClose={closeNotice}
          onAccept={openSpeakingPage}
        />

        <style>{`
          @media print {
            body { background-color: white !important; }
            .format-avoid-break { page-break-inside: avoid; }
          }
        `}</style>
      </div>
    </SecurityGuard>
  );
}

export default function App() {
  return (
    <NotebookProvider>
      <AppContent />
    </NotebookProvider>
  );
}
