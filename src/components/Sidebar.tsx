import React from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, PenTool, Book, Target, BrainCircuit, Settings, Mic } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}

const springTransition = { type: 'spring', stiffness: 360, damping: 32, mass: 0.7 };

export default function Sidebar({ activeTab, setActiveTab, showSettings, setShowSettings }: SidebarProps) {
  const tabs = [
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'read', icon: BookOpen, label: 'Read' },
    { id: 'speaking', icon: Mic, label: 'Speak' },
    { id: 'create', icon: PenTool, label: 'Create' },
    { id: 'study', icon: BrainCircuit, label: 'Study' },
    { id: 'quiz', icon: Target, label: 'Practice' },
    { id: 'notebook', icon: Book, label: 'Notebook' }
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-2xl border-b border-violet-100/40 sticky top-0 z-40 shadow-sm">
         <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-fuchsia-400 shadow-sm">
             <img src="/src/asset/public/lyly_logo.jpg" alt="Logo" className="w-full h-full object-cover" />
           </div>
           <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 to-violet-600 text-lg tracking-tight">Chinese for LyLy</span>
         </div>
         <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-violet-400 hover:text-violet-600 hover:bg-violet-50 rounded-full transition-colors active:scale-95">
           <Settings className="w-6 h-6" />
         </button>
      </div>

      {/* Sidebar (Desktop) / Floating Bottom Nav (Mobile) */}
      <nav className="fixed bottom-6 left-4 right-4 md:static md:w-[96px] shrink-0 flex flex-row md:flex-col print:hidden justify-around md:justify-start z-50 bg-white/70 backdrop-blur-2xl md:bg-white/80 border border-white/40 md:border-r md:border-violet-50/50 shadow-2xl md:shadow-none rounded-[2rem] md:rounded-none p-2 md:p-4 md:py-8 md:gap-4 transition-all duration-300">
        <div className="hidden md:flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-xl rotate-3 hover:rotate-0 transition-transform duration-500 cursor-pointer group">
            <img src="/src/asset/public/lyly_logo.jpg" alt="LyLy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
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

        <div className="hidden md:flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl cursor-pointer text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-all md:mt-auto" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="w-6 h-6" strokeWidth={2} />
        </div>
      </nav>
    </>
  );
}
