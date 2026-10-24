import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, AlertCircle, Heart } from 'lucide-react';

interface SecurityGuardProps {
  children: React.ReactNode;
}

const SECURITY_QUESTIONS = [
  {
    id: 1,
    question: "Tên đầy đủ của chủ app là gì?",
    options: ["Nguyễn Phương Thảo", "Nguyễn Thu Thảo", "Trần Phương Thảo", "Nguyễn Thị Thảo"],
    correctAnswer: "Nguyễn Phương Thảo"
  },
  {
    id: 2,
    question: "Thảo sinh ngày tháng năm nào?",
    options: ["12/02/2002", "26/03/1995", "12/12/2002", "02/12/2002"],
    correctAnswer: "12/02/2002"
  },
  {
    id: 3,
    question: "Gia đình Thảo có bao nhiêu người?",
    options: ["3 người", "4 người", "5 người", "6 người"],
    correctAnswer: "5 người"
  },
  {
    id: 4,
    question: "Anh trai của Thảo tên là gì?",
    options: ["Thiên", "Thuận", "Duy", "Hải"],
    correctAnswer: "Thiên"
  },
  {
    id: 5,
    question: "Em út của Thảo tên là gì?",
    options: ["Thiên", "Thuận", "Minh", "Hùng"],
    correctAnswer: "Thuận"
  },
  {
    id: 6,
    question: "Người yêu của Thảo tên là gì?",
    options: ["Nguyễn Hữu Duy", "Trần Hữu Duy", "Nguyễn Đình Duy", "Lê Hữu Duy"],
    correctAnswer: "Nguyễn Hữu Duy"
  },
  {
    id: 7,
    question: "Người yêu của Thảo sinh ngày tháng năm nào?",
    options: ["26/03/1995", "12/02/2002", "26/05/1995", "23/06/1995"],
    correctAnswer: "26/03/1995"
  },
  {
    id: 8,
    question: "Ba của Thảo tên là gì?",
    options: ["Hiếu", "Hùng", "Hải", "Hòa"],
    correctAnswer: "Hiếu"
  },
  {
    id: 9,
    question: "Mẹ của Thảo tên là gì?",
    options: ["Phường", "Phương", "Phượng", "Phú"],
    correctAnswer: "Phường"
  },
];

export default function SecurityGuard({ children }: SecurityGuardProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const pickNewQuestion = (excludeId?: number) => {
    const available = excludeId
      ? SECURITY_QUESTIONS.filter(q => q.id !== excludeId)
      : SECURITY_QUESTIONS;
    const randomIdx = Math.floor(Math.random() * available.length);
    const question = available[randomIdx];
    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    setCurrentQuestion({ ...question, options: shuffledOptions });
  };

  useEffect(() => {
    const savedStatus = localStorage.getItem('app_unlocked');
    const expiry = localStorage.getItem('app_unlocked_expiry');
    const lockedUntil = localStorage.getItem('app_lock_until');
    const savedFails = localStorage.getItem('app_fail_count');

    if (savedFails) setFailCount(parseInt(savedFails));

    if (lockedUntil && Date.now() < parseInt(lockedUntil)) {
      setLockUntil(parseInt(lockedUntil));
      setIsUnlocked(false);
      pickNewQuestion();
    } else if (savedStatus === 'true' && expiry && Date.now() < parseInt(expiry)) {
      setIsUnlocked(true);
    } else {
      setIsUnlocked(false);
      pickNewQuestion();
    }
  }, []);

  useEffect(() => {
    if (!lockUntil) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setLockUntil(null);
        localStorage.removeItem('app_lock_until');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockUntil]);

  const handleOptionClick = (option: string) => {
    if (lockUntil) return;
    setSelectedOption(option);

    if (option === currentQuestion.correctAnswer) {
      setTimeout(() => {
        setIsUnlocked(true);
        setFailCount(0);
        localStorage.removeItem('app_fail_count');
        localStorage.setItem('app_unlocked', 'true');
        localStorage.setItem('app_unlocked_expiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
      }, 300);
    } else {
      const newFailCount = failCount + 1;
      setFailCount(newFailCount);
      localStorage.setItem('app_fail_count', newFailCount.toString());
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);

      if (newFailCount === 1) {
        setTimeout(() => {
          setError(false);
          setSelectedOption(null);
          pickNewQuestion(currentQuestion.id);
        }, 1500);
      } else {
        const backoffMultiplier = Math.min(Math.pow(2, Math.min(newFailCount - 2, 3)), 8);
        const duration = 30 * backoffMultiplier;
        const until = Date.now() + duration * 1000;

        setTimeout(() => {
          setLockUntil(until);
          localStorage.setItem('app_lock_until', until.toString());
          setError(false);
          setSelectedOption(null);
        }, 1000);
      }
    }
  };

  if (isUnlocked === null) return null;
  if (isUnlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-transparent font-sans overflow-hidden">
      {/* Static background for fast rendering */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] h-[60%] w-[60%] rounded-full bg-gradient-to-br from-violet-300/40 to-fuchsia-300/40 blur-[60px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[65%] w-[65%] rounded-full bg-gradient-to-tr from-rose-300/35 to-orange-300/35 blur-[60px]" />
        <div className="absolute top-[18%] right-[8%] h-[38%] w-[38%] rounded-full bg-gradient-to-bl from-blue-200/35 to-cyan-200/35 blur-[50px]" />
        <div className="absolute bottom-[18%] left-[12%] h-[36%] w-[36%] rounded-full bg-gradient-to-tr from-emerald-200/30 to-teal-200/30 blur-[50px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md px-6"
      >
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2.5rem]
                       bg-gradient-to-br from-violet-600 to-indigo-600 shadow-xl shadow-violet-200"
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
          className="group relative overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/90 p-8
                     shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)]
                     transition-all hover:bg-white"
        >
          <div className="mb-6 flex items-center gap-3 text-violet-600">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Security Protocol</span>
          </div>

          <h2 className="mb-6 text-xl font-bold leading-tight text-slate-800">
            {lockUntil ? "Security Lockout" : currentQuestion.question}
          </h2>

          <div className="space-y-3">
            {lockUntil ? (
              <div className="py-8 text-center">
                <div className="mb-4 text-4xl font-black text-violet-600">
                  {timeLeft}s
                </div>
                <p className="text-sm font-medium text-slate-500">
                  Bạn đã nhập sai quá nhiều lần. <br />Vui lòng đợi để thử lại.
                </p>
              </div>
            ) : (
              currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(option)}
                  disabled={selectedOption !== null && selectedOption !== option && error}
                  className={`w-full rounded-2xl border-2 px-5 py-4 text-left text-lg font-medium transition-all outline-none ${
                    selectedOption === option
                      ? option === currentQuestion.correctAnswer
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : error
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-slate-100 bg-slate-50 text-slate-700 hover:border-violet-200 hover:bg-white active:scale-[0.98]'
                  }`}
                >
                  {option}
                </button>
              ))
            )}

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 mt-2"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Sai rồi bạn ơi! Vui lòng thử lại.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="mt-8 flex items-center justify-center gap-3 text-slate-400">
          <Heart className="h-4 w-4 text-rose-400 fill-rose-400 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Designed for Thảo &amp; Duy</span>
        </div>
      </motion.div>
    </div>
  );
}
