import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { AIModel } from '../lib/ai';

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  selectedModel: AIModel;
  setSelectedModel: (model: AIModel) => void;
}

const springTransition: Transition = { type: 'spring', stiffness: 360, damping: 32, mass: 0.7 };

const modelGroups: {
  provider: string;
  description: string;
  models: { id: AIModel; name: string; description: string }[];
}[] = [
  {
    provider: 'Gemini',
    description: 'Google AI',
    models: [
      { id: 'gemini', name: 'Gemini Flash', description: 'Fast, suitable for daily learning' },
    ],
  },
  {
    provider: 'Groq',
    description: 'Llama, Qwen & GPT-OSS',
    models: [
      { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B', description: 'Fast and smart open weights (Priority 1)' },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Large model, versatile (Priority 2)' },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', description: 'Next-gen reasoning (Priority 3)' },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', description: 'Massive open weights model (Priority 4)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Ultra-fast inference (Priority 5)' },
    ],
  },
  {
    provider: 'GitHub Copilot',
    description: 'Azure Inference',
    models: [
      { id: 'github-gpt-4o', name: 'Copilot GPT-4o', description: 'Flagship model via GitHub' },
      { id: 'github-gpt-4o-mini', name: 'Copilot GPT-4o Mini', description: 'Fast and cost-effective' },
    ],
  },
];

export default function SettingsModal({ showSettings, setShowSettings, selectedModel, setSelectedModel }: SettingsModalProps) {
  const btnPrimary = "flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 hover:from-fuchsia-500 hover:via-violet-600 hover:to-indigo-600 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-violet-200/70 hover:shadow-xl hover:shadow-violet-200 transition-all duration-300 active:scale-[0.97] disabled:opacity-60 disabled:shadow-none disabled:active:scale-100";

  return (
    <AnimatePresence>
      {showSettings && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 py-5 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setShowSettings(false)}
        >
          <motion.div 
            initial={{ scale: 0.94, opacity: 0, y: 22, filter: 'blur(8px)' }}
            animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ scale: 0.96, opacity: 0, y: 12, filter: 'blur(8px)' }}
            transition={springTransition}
            className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-[1.5rem] bg-white p-4 shadow-2xl ring-1 ring-slate-900/5 sm:rounded-[2rem] sm:p-6 md:p-8" onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-6 text-slate-800">AI Settings</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-500 mb-3">Select AI Model</label>
                <div className="space-y-4">
                  {modelGroups.map((group) => (
                    <div key={group.provider} className="rounded-2xl border border-violet-100 bg-violet-50/30 p-3">
                      <div className="mb-2 flex min-w-0 flex-col gap-1 px-1 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
                        <span className="text-sm font-bold text-slate-700">{group.provider}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">{group.description}</span>
                      </div>
                      <div className="space-y-2">
                        {group.models.map((model) => {
                          const isSelected = selectedModel === model.id;

                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => setSelectedModel(model.id)}
                              className={`w-full text-left rounded-xl border p-3 transition-all active:scale-[0.98] ${
                                isSelected
                                  ? 'border-violet-400 bg-white shadow-md shadow-violet-100 ring-4 ring-violet-500/10'
                                  : 'border-transparent bg-white/70 hover:bg-white hover:border-violet-200'
                              }`}
                            >
                              <div className="flex min-w-0 items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-slate-800">{model.name}</div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">{model.description}</div>
                                </div>
                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-violet-500 bg-violet-500' : 'border-slate-200 bg-white'
                                }`}>
                                  {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-3 font-medium">
                  The selected model will be used for dictionary lookups and text generation.
                </p>
              </div>
              <button onClick={() => setShowSettings(false)} className={`${btnPrimary} w-full mt-2`}>
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
