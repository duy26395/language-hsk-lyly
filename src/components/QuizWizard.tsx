import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transition } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Trophy,
  Loader2,
  Coffee,
  BriefcaseBusiness,
  Plane,
  GraduationCap,
  RotateCcw,
  XCircle,
  ListChecks,
  Headphones,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { generateQuiz, QuizQuestion, AIModel, QuizType, readAloud } from '../lib/ai';

const HSK_LEVELS = [1, 2, 3, 4, 5, 6];
const TOPICS = [
  { id: 'daily', name: 'Daily Life', Icon: Coffee },
  { id: 'work', name: 'Work & Office', Icon: BriefcaseBusiness },
  { id: 'travel', name: 'Travel & Shopping', Icon: Plane },
  { id: 'school', name: 'School & Study', Icon: GraduationCap },
];

const springTransition: Transition = { type: 'spring', stiffness: 340, damping: 31, mass: 0.72 };

interface QuizWizardProps {
  selectedModel: AIModel;
}

export default function QuizWizard({ selectedModel }: QuizWizardProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [level, setLevel] = useState<number | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [quizType, setQuizType] = useState<QuizType>('general');
  const [questionCount, setQuestionCount] = useState<number>(5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [step]);

  const nextStep = () => {
    setDirection(1);
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setDirection(-1);
    setStep((prev) => prev - 1);
  };

  const handleGenerateQuiz = async () => {
    if (!level || !topic) return;
    window.speechSynthesis?.cancel();
    setIsGenerating(true);
    const result = await generateQuiz(level, topic, questionCount, selectedModel, quizType);
    if (result && result.length > 0) {
      setQuestions(result);
      setCurrentQIndex(0);
      setSelectedAnswers(new Array(result.length).fill(-1));
      nextStep();
    } else {
      alert('Failed to generate quiz. Please try again.');
    }
    setIsGenerating(false);
  };

  const selectAnswer = (optionIdx: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQIndex] = optionIdx;
    setSelectedAnswers(newAnswers);
  };

  const nextQuestion = () => {
    window.speechSynthesis?.cancel();
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const prevQuestion = () => {
    window.speechSynthesis?.cancel();
    if (currentQIndex > 0) {
      setCurrentQIndex(currentQIndex - 1);
    }
  };

  const finishQuiz = () => {
    window.speechSynthesis?.cancel();
    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
      if (selectedAnswers[i] === questions[i].correctAnswerIndex) {
        correct++;
      }
    }
    setScore(Math.round((correct / questions.length) * 100));
    nextStep();
  };

  const resetWizard = () => {
    window.speechSynthesis?.cancel();
    setDirection(-1);
    setStep(1);
    setLevel(null);
    setTopic(null);
    setQuizType('general');
    setQuestionCount(5);
    setScore(null);
    setQuestions([]);
    setSelectedAnswers([]);
    setCurrentQIndex(0);
  };

  const currentQuestion = questions[currentQIndex];
  const listeningDialogue = questions.find((question) => question.dialogue)?.dialogue;

  const variants = {
    enter: (moveDirection: number) => ({
      x: moveDirection > 0 ? 70 : -70,
      opacity: 0,
      filter: 'blur(6px)',
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: 'blur(0px)',
    },
    exit: (moveDirection: number) => ({
      x: moveDirection < 0 ? 70 : -70,
      opacity: 0,
      filter: 'blur(6px)',
    }),
  };

  return (
    <div className="relative flex min-h-[460px] min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-violet-100 bg-white/95 p-4 shadow-sm sm:p-6 md:min-h-[500px] md:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet-50/80 to-transparent" />

      <div className="relative z-10 mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-2">
          {step > 1 && (
            <button onClick={prevStep} className="p-2 hover:bg-violet-50 rounded-full text-violet-600 transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex flex-col justify-center">
            <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Step {step} / 4</span>
            <span className="text-lg font-bold text-slate-800">
              {step === 1 && 'Select Level'}
              {step === 2 && 'Select Topic'}
              {step === 3 && 'Practice'}
              {step === 4 && 'Result'}
            </span>
          </div>
        </div>

        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              layout
              transition={springTransition}
              className={`h-1.5 rounded-full ${i === step ? 'w-8 bg-violet-500' : i < step ? 'w-4 bg-violet-300' : 'w-4 bg-slate-100'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 relative flex flex-col z-10">
        <AnimatePresence custom={direction} mode="wait">
          {step === 1 && (
            <motion.div key="step1" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={springTransition} className="flex-1 flex flex-col">
              <p className="text-slate-500 mb-6">Which HSK level do you want to practice?</p>
              <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 md:gap-4">
                {HSK_LEVELS.map((hskLevel) => (
                  <motion.button
                    key={hskLevel}
                    onClick={() => {
                      setLevel(hskLevel);
                      nextStep();
                    }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.96 }}
                    className={`flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-center transition-colors duration-200 hover:shadow-lg hover:shadow-violet-100 sm:p-6 ${level === hskLevel ? 'border-violet-500 bg-violet-50' : 'border-slate-100 hover:border-violet-200 bg-white'}`}
                  >
                    <span className="text-2xl font-bold text-slate-800 sm:text-3xl">HSK {hskLevel}</span>
                    <span className="text-sm text-slate-400">Vocabulary & Grammar</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={springTransition} className="flex-1 flex flex-col">
              <p className="text-slate-500 mb-6">Select how you want AI to generate exercises</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {[
                  { id: 'general' as QuizType, name: 'Vocabulary & Grammar', Icon: ListChecks },
                  { id: 'listening' as QuizType, name: 'Listening Dialogue', Icon: Headphones },
                ].map(({ id, name, Icon }) => (
                  <motion.button
                    key={id}
                    onClick={() => setQuizType(id)}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex min-w-0 items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors duration-200 hover:shadow-lg hover:shadow-violet-100 sm:gap-4 sm:p-5 ${quizType === id ? 'border-violet-500 bg-violet-50' : 'border-slate-100 hover:border-violet-200 bg-white'}`}
                  >
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl ${quizType === id ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-500'}`}>
                      <Icon className="w-6 h-6" />
                    </span>
                    <span className="min-w-0 text-base font-bold text-slate-700 sm:text-lg">{name}</span>
                  </motion.button>
                ))}
              </div>

              <p className="text-slate-500 mb-6">Select a topic</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TOPICS.map(({ id, name, Icon }) => (
                  <motion.button
                    key={id}
                    onClick={() => setTopic(id)}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex min-w-0 items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors duration-200 hover:shadow-lg hover:shadow-violet-100 sm:gap-4 sm:p-5 ${topic === id ? 'border-violet-500 bg-violet-50' : 'border-slate-100 hover:border-violet-200 bg-white'}`}
                  >
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl ${topic === id ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-500'}`}>
                      <Icon className="w-6 h-6" />
                    </span>
                    <span className="min-w-0 text-base font-bold text-slate-700 sm:text-lg">{name}</span>
                  </motion.button>
                ))}
              </div>

              <div className="mt-8">
                <label className="block text-sm font-bold text-slate-600 mb-3">Number of questions: {questionCount}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full md:w-72 accent-violet-600"
                />
              </div>

              <div className="mt-auto flex justify-stretch pt-8 sm:justify-end">
                <button onClick={handleGenerateQuiz} disabled={!topic || isGenerating} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-6 py-3.5 font-bold text-white shadow-lg shadow-violet-200 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:px-8">
                  {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Preparing...</> : <><CheckCircle2 className="w-5 h-5" /> Start Quiz</>}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && questions.length > 0 && (
            <motion.div key="step3" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={springTransition} className="flex-1 flex flex-col">
              <div className="mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xl font-bold text-slate-800">Question {currentQIndex + 1} of {questions.length}</h3>
              </div>

              {listeningDialogue && (
                <motion.div layout className="bg-white p-5 rounded-2xl border border-violet-100 mb-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-violet-500">
                    <Headphones className="h-4 w-4" />
                    Dialogue Audio
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => readAloud(listeningDialogue)} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-violet-700 active:scale-95">
                      <Volume2 className="h-4 w-4" />
                      Play Dialogue
                    </button>
                    <button onClick={() => window.speechSynthesis?.cancel()} className="inline-flex items-center gap-2 rounded-xl border border-violet-100 bg-white px-5 py-3 text-sm font-bold text-violet-600 transition-all hover:bg-violet-50 active:scale-95">
                      <VolumeX className="h-4 w-4" />
                      Stop
                    </button>
                  </div>
                </motion.div>
              )}

              <motion.div layout className="mb-5 rounded-2xl border border-slate-100 bg-slate-50/90 p-4 shadow-inner sm:mb-6 sm:p-6">
                <p className="chinese break-words text-xl text-slate-800 sm:text-2xl">{currentQuestion.question}</p>
              </motion.div>

              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedAnswers[currentQIndex] === idx;
                  return (
                    <motion.button
                      key={`${currentQIndex}-${idx}`}
                      onClick={() => selectAnswer(idx)}
                      whileHover={{ x: 3 }}
                      whileTap={{ scale: 0.98 }}
                      className={`rounded-xl border-2 p-3 text-left chinese text-base transition-colors sm:p-4 sm:text-lg ${isSelected ? 'border-violet-500 bg-violet-50 text-violet-700 font-bold shadow-sm' : 'border-slate-100 bg-white hover:border-violet-200 text-slate-700'}`}
                    >
                      {opt}
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-auto flex gap-2 pt-8">
                <button onClick={prevQuestion} disabled={currentQIndex === 0} className="flex-1 rounded-xl px-4 py-3 font-bold text-slate-500 transition-all hover:bg-slate-100 disabled:opacity-50 sm:flex-none sm:px-6">
                  Previous
                </button>
                <button onClick={nextQuestion} disabled={selectedAnswers[currentQIndex] === -1} className="flex-1 rounded-xl bg-violet-600 px-4 py-3 font-bold text-white shadow-md transition-all hover:bg-violet-700 active:scale-95 disabled:opacity-50 sm:flex-none sm:px-8">
                  {currentQIndex === questions.length - 1 ? 'Submit' : 'Next'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={springTransition} className="flex-1 flex flex-col items-center text-center py-8">
              <motion.div initial={{ scale: 0, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.48 }} className="relative mb-6">
                <div className="absolute inset-0 bg-fuchsia-400 blur-2xl opacity-40 rounded-full" />
                <div className="w-32 h-32 bg-gradient-to-br from-fuchsia-400 to-violet-600 rounded-full flex flex-col items-center justify-center text-white relative z-10 shadow-2xl border-4 border-white">
                  <Trophy className="w-10 h-10 mb-1 text-yellow-300" />
                  <span className="text-3xl font-black">{score}%</span>
                </div>
              </motion.div>

              <h3 className="text-2xl font-bold text-slate-800 mb-2">Excellent Job!</h3>
              <p className="text-slate-500 mb-8 max-w-md">You have completed the HSK {level} practice. Review your answers, then try another set when you are ready.</p>

              <div className="w-full max-w-2xl space-y-3 mb-8 text-left">
                {listeningDialogue && (
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-violet-500">
                      <Headphones className="h-4 w-4" />
                      Dialogue
                    </div>
                    <p className="chinese whitespace-pre-line text-lg leading-relaxed text-slate-800">{listeningDialogue}</p>
                  </div>
                )}
                {questions.map((question, idx) => {
                  const userAnswer = selectedAnswers[idx];
                  const isCorrect = userAnswer === question.correctAnswerIndex;
                  return (
                    <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        {isCorrect ? <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="mt-1 h-5 w-5 shrink-0 text-rose-500" />}
                        <div className="min-w-0">
                          <p className="chinese font-bold text-slate-800">{idx + 1}. {question.question}</p>
                          <p className="mt-2 text-sm text-slate-500">
                            Your answer: <span className={isCorrect ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{question.options[userAnswer] ?? 'Skipped'}</span>
                          </p>
                          {!isCorrect && (
                            <p className="mt-1 text-sm text-slate-500">
                              Correct answer: <span className="font-semibold text-violet-600">{question.options[question.correctAnswerIndex]}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={resetWizard} className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-violet-100 text-violet-700 font-bold hover:bg-violet-200 transition-all active:scale-95">
                <RotateCcw className="w-4 h-4" />
                Try Another Quiz
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
