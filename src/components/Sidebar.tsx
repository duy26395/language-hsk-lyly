import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { Search, BookOpen, PenTool, Book, Target, BrainCircuit, Settings, Mic, Menu, X as CloseIcon, MessageCircle } from 'lucide-react';
import logoUrl from '../asset/public/lyly_logo.jpg';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}

const springTransition: Transition = { type: 'spring', stiffness: 360, damping: 32, mass: 0.7 };

export default function Sidebar({ activeTab, setActiveTab, showSettings, setShowSettings }: SidebarProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const tabs = [
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'read', icon: BookOpen, label: 'Read' },
    { id: 'speaking', icon: Mic, label: 'Speak' },
    { id: 'chat', icon: MessageCircle, label: 'AI Chat' },
    { id: 'create', icon: PenTool, label: 'Create' },
    { id: 'study', icon: BrainCircuit, label: 'Study' },
    { id: 'quiz', icon: Target, label: 'Practice' },
    { id: 'notebook', icon: Book, label: 'Notebook' }
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="z-[60] flex shrink-0 items-center justify-between gap-2 border-b border-violet-100/40 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-2xl md:hidden">
         <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="shrink-0 p-2 text-violet-600 hover:bg-violet-50 rounded-xl transition-colors active:scale-95">
           {isMenuOpen ? <CloseIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
         </button>
         <div className="flex min-w-0 flex-1 items-center gap-3">
           <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-fuchsia-400 shadow-sm">
             <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
           </div>
           <span className="truncate bg-gradient-to-r from-fuchsia-500 to-violet-600 bg-clip-text text-base font-bold tracking-tight text-transparent min-[360px]:text-lg">Chinese for LyLy</span>
         </div>
         <div className="flex shrink-0 items-center gap-2">
           <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-violet-400 hover:text-violet-600 hover:bg-violet-50 rounded-full transition-colors active:scale-95">
             <Settings className="w-6 h-6" />
           </button>
         </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 top-0 z-[56] flex w-[280px] max-w-[86vw] flex-col overflow-y-auto bg-white p-5 shadow-2xl md:hidden"
            >
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-fuchsia-400 shadow-sm">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                </div>
                <span className="font-bold text-slate-800 text-xl">HSK LyLy</span>
              </div>

              <div className="flex flex-col gap-2">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      activeTab === item.id 
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' 
                        : 'text-slate-500 hover:bg-violet-50 hover:text-violet-600'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-semibold text-base">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-6 border-t border-slate-100">
                <button 
                  onClick={() => {
                    setShowSettings(true);
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-4 p-4 w-full text-slate-500 hover:bg-violet-50 hover:text-violet-600 rounded-2xl transition-all"
                >
                  <Settings className="w-5 h-5" />
                  <span className="font-semibold text-base">Settings</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop) */}
      <nav className="hidden md:flex md:w-[96px] shrink-0 flex-col print:hidden justify-start z-50 bg-white/80 border-r border-violet-50/50 p-4 py-8 gap-4 transition-all duration-300">
        <div className="hidden md:flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-xl rotate-3 hover:rotate-0 transition-transform duration-500 cursor-pointer group">
            <img src={logoUrl} alt="LyLy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 mt-3 shadow-[0_0_10px_#10b981]" />
        </div>
        
        {tabs.map((item) => (
          <motion.button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            whileTap={{ scale: 0.94 }}
            className={`flex flex-col items-center justify-center gap-1.5 p-3 md:p-4 rounded-[1.5rem] md:rounded-2xl cursor-pointer transition-colors duration-300 relative overflow-hidden flex-1 md:flex-none ${
              activeTab === item.id 
                ? 'text-violet-600 bg-violet-50 shadow-inner' 
                : 'text-slate-400 hover:text-violet-500 hover:bg-violet-50/50 active:scale-95'
            }`}
          >
            {activeTab === item.id && (
              <motion.div layoutId="navIndicator" transition={springTransition} className="absolute inset-0 bg-violet-100/70 rounded-[1.5rem] md:rounded-2xl" />
            )}
            <item.icon className={`w-6 h-6 md:w-7 md:h-7 transition-transform duration-300 relative z-10 ${activeTab === item.id ? 'scale-110' : ''}`} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            <span className="text-[10px] md:text-[11px] font-medium relative z-10 md:hidden">{item.label}</span>
          </motion.button>
        ))}

        <div className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl cursor-pointer text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-all mt-auto" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="w-6 h-6" strokeWidth={2} />
        </div>
      </nav>
    </>
  );
}
