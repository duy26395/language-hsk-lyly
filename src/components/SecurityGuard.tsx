import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, ChevronRight, AlertCircle, Heart, Sparkles, Star, Cloud, Moon, Sun } from 'lucide-react';

interface SecurityGuardProps {
  children: React.ReactNode;
}

const SECURITY_QUESTIONS = [
  {
    id: 1,
    question: "Tên đầy đủ của chủ app là gì?",
    answers: ["nguyễn phương thảo", "nguyen phuong thao", "phương thảo", "phuong thao"],
    hint: "Họ và tên lót đầy đủ nhé"
  },
  {
    id: 2,
    question: "Thảo sinh ngày tháng năm nào? (dd/mm/yyyy)",
    answers: ["12/02/2002", "12/2/2002", "12-02-2002", "12-2-2002", "12/02/02"],
    hint: "Định dạng dd/mm/yyyy"
  },
  {
    id: 3,
    question: "Gia đình Thảo có bao nhiêu người?",
    answers: ["5", "năm"],
    hint: "Một con số"
  },
  {
    id: 4,
    question: "Anh trai của Thảo tên là gì?",
    answers: ["thiên", "nguyễn thiên"],
    hint: "Tên 1 người anh"
  },
  {
    id: 5,
    question: "Em út của Thảo tên là gì?",
    answers: ["thuận", "nguyễn thuận"],
    hint: "Tên người em út"
  },
  {
    id: 6,
    question: "Người yêu của Thảo tên là gì?",
    answers: ["nguyen huu duy", "nguyễn hữu duy", "duy", "nguyen huu duy"],
    hint: "Họ và tên đầy đủ của anh ấy"
  },
  {
    id: 7,
    question: "Người yêu của Thảo sinh ngày tháng năm nào? (dd/mm/yyyy)",
    answers: ["26/03/1995", "26/3/1995", "26-03-1995", "26-3-1995"],
    hint: "Ngày sinh của anh Duy"
  },
];

export default function SecurityGuard({ children }: SecurityGuardProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const savedStatus = localStorage.getItem('app_unlocked');
    const expiry = localStorage.getItem('app_unlocked_expiry');
    
    if (savedStatus === 'true' && expiry && Date.now() < parseInt(expiry)) {
      setIsUnlocked(true);
    } else {
      setIsUnlocked(false);
      // Pick a random question
      const randomIdx = Math.floor(Math.random() * SECURITY_QUESTIONS.length);
      setCurrentQuestion(SECURITY_QUESTIONS[randomIdx]);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedAnswer = answer.trim().toLowerCase();
    
    if (currentQuestion.answers.includes(normalizedAnswer)) {
      setIsUnlocked(true);
      // Keep unlocked for 7 days
      localStorage.setItem('app_unlocked', 'true');
      localStorage.setItem('app_unlocked_expiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setAnswer('');
    }
  };

  if (isUnlocked === null) return null;

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-transparent font-sans overflow-hidden">

      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Main Gradient Blobs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-[10%] -left-[10%] h-[60%] w-[60%] rounded-full bg-gradient-to-br from-violet-300/40 to-fuchsia-300/40 blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -45, 0],
            x: [0, -80, 0],
            y: [0, 120, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -bottom-[10%] -right-[10%] h-[70%] w-[70%] rounded-full bg-gradient-to-tr from-rose-300/40 to-orange-300/40 blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 80, 0],
            y: [0, -80, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-[20%] right-[10%] h-[40%] w-[40%] rounded-full bg-gradient-to-bl from-blue-200/40 to-cyan-200/40 blur-[80px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            x: [0, -40, 0],
            y: [0, -60, 0],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute bottom-[20%] left-[15%] h-[40%] w-[40%] rounded-full bg-gradient-to-tr from-emerald-200/30 to-teal-200/30 blur-[90px]"
        />


        {/* Floating Icons */}
        {[...Array(6)].map((_, i) => {
          const colors = ['text-violet-400', 'text-fuchsia-400', 'text-emerald-400', 'text-rose-400', 'text-sky-400', 'text-amber-400'];
          const colorClass = colors[i % colors.length];
          return (
            <motion.div
              key={`icon-${i}`}
              initial={{ 
                x: Math.random() * 100 + "%", 
                y: Math.random() * 100 + "%",
                opacity: 0,
                scale: 0.5 + Math.random() * 0.5
              }}
              animate={{
                y: [null, (Math.random() - 0.5) * 200],
                x: [null, (Math.random() - 0.5) * 200],
                rotate: [0, 180, -180],
                opacity: [0, 0.15 + Math.random() * 0.1, 0],
                scale: [null, 1 + Math.random() * 0.5, 0.5]
              }}
              transition={{
                duration: 15 + Math.random() * 20,
                repeat: Infinity,
                ease: "easeInOut",
                delay: Math.random() * 10
              }}
              className={`absolute ${colorClass} pointer-events-none`}
            >
              {i % 4 === 0 && <Sparkles size={16 + Math.random() * 16} />}
              {i % 4 === 1 && <Heart size={14 + Math.random() * 14} />}
              {i % 4 === 2 && <Star size={16 + Math.random() * 16} />}
              {i % 4 === 3 && <Cloud size={20 + Math.random() * 20} />}
            </motion.div>
          )
        })}
        
        {/* Subtle Grid & Noise Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay contrast-150 brightness-100"
             style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />


      </div>

      <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />

      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md px-6"
      >
        <div className="mb-8 text-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ 
              scale: 1,
              y: [0, -8, 0],
            }}
            transition={{ 
              scale: { type: 'spring', damping: 12, stiffness: 200, delay: 0.2 },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-violet-600 to-indigo-600 shadow-xl shadow-violet-200"
          >
            <Lock className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800">
            Security Check
          </h1>
          <p className="mt-2 text-slate-500">
            Trả lời đúng câu hỏi để truy cập vào ứng dụng.
          </p>
        </div>

        <motion.div 
          animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="group relative overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/40 p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] backdrop-blur-3xl transition-all hover:shadow-[0_48px_80px_-20px_rgba(0,0,0,0.15)] hover:bg-white/50"
        >
          {/* Animated Border */}
          <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-violet-500/20 to-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          
          <div className="mb-6 flex items-center gap-3 text-violet-600">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Security Protocol</span>
          </div>

          <h2 className="mb-6 text-xl font-bold leading-tight text-slate-800">
            {currentQuestion.question}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                autoFocus
                type="text"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setError(false);
                }}
                placeholder="Nhập câu trả lời..."
                className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-4 text-lg font-medium transition-all outline-none ${
                  error 
                    ? 'border-red-100 bg-red-50/50 text-red-900 placeholder:text-red-300 focus:border-red-200' 
                    : 'border-slate-100 focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-50'
                }`}
              />
              <button
                type="submit"
                className="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-100 transition-transform active:scale-95 hover:bg-violet-700"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {error ? (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Sai rồi bạn ơi! Vui lòng thử lại.</span>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-1 text-xs text-slate-400"
                >
                  Gợi ý: {currentQuestion.hint}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>

        <div className="mt-8 flex items-center justify-center gap-3 text-slate-400">
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Heart className="h-4 w-4 text-rose-400 fill-rose-400" />
          </motion.div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Designed for Thảo & Duy</span>
        </div>
      </motion.div>
    </div>
  );
}
