'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TASK_TYPES, PRIORITY_MODES } from '@/lib/core/types';
import { ArrowUp, ArrowDown, RotateCcw, Save, Sparkles, Sliders, GripVertical } from 'lucide-react';
import { DsButton, DsProviderBadge, DsCard } from '@/components/design-system';

interface Candidate {
  provider: 'groq' | 'gemini' | 'ollama';
  model: string;
  weight: number;
}

interface PolicyRule {
  taskType: string;
  priorityMode: string;
  candidates: Candidate[];
}

const INITIAL_RULES: PolicyRule[] = [
  {
    taskType: 'code_generation',
    priorityMode: 'quality',
    candidates: [
      { provider: 'groq', model: 'llama-3.3-70b-versatile', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
  },
  {
    taskType: 'code_generation',
    priorityMode: 'fast',
    candidates: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
  },
];

export default function RulesEditorPage() {
  const [rules, setRules] = useState<PolicyRule[]>(INITIAL_RULES);
  const [selectedTask, setSelectedTask] = useState<string>('code_generation');
  const [selectedPriority, setSelectedPriority] = useState<string>('quality');
  const [isSaved, setIsSaved] = useState(false);

  const activeRule = rules.find(
    (r) => r.taskType === selectedTask && r.priorityMode === selectedPriority,
  ) || {
    taskType: selectedTask,
    priorityMode: selectedPriority,
    candidates: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 5 },
    ],
  };

  const moveCandidate = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === activeRule.candidates.length - 1)
    ) {
      return;
    }

    const newCandidates = [...activeRule.candidates];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newCandidates[index];
    newCandidates[index] = newCandidates[targetIndex];
    newCandidates[targetIndex] = temp;

    newCandidates.forEach((c, idx) => {
      c.weight = 10 - idx * 2;
    });

    const newRules = rules.map((r) => {
      if (r.taskType === selectedTask && r.priorityMode === selectedPriority) {
        return { ...r, candidates: newCandidates };
      }
      return r;
    });

    if (!rules.some((r) => r.taskType === selectedTask && r.priorityMode === selectedPriority)) {
      newRules.push({
        taskType: selectedTask,
        priorityMode: selectedPriority,
        candidates: newCandidates,
      });
    }

    setRules(newRules);
    setIsSaved(false);
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#07080e]">
      {/* Console Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-white/10 bg-[#0c0d15] flex-shrink-0">
        <div>
          <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Routing Engine Policy Manager
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Configure candidate priority ranking, fallback ordering, and candidate weight allocations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DsButton variant="secondary" size="sm" onClick={() => setRules(INITIAL_RULES)} icon={<RotateCcw className="w-3.5 h-3.5" />}>
            Reset Defaults
          </DsButton>
          <DsButton variant="primary" size="sm" onClick={handleSave} icon={<Save className="w-3.5 h-3.5" />}>
            {isSaved ? 'Policy Saved!' : 'Save Policy Changes'}
          </DsButton>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-5xl mx-auto w-full">
        {/* Task & Priority Selectors */}
        <DsCard>
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Task Type Intent</label>
              <Select value={selectedTask} onValueChange={(val) => val && setSelectedTask(val)}>
                <SelectTrigger className="w-[200px] h-10 text-xs bg-white/5 border-white/10 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#171929] border-white/10 text-slate-200">
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Priority Mode Policy</label>
              <Select value={selectedPriority} onValueChange={(val) => val && setSelectedPriority(val)}>
                <SelectTrigger className="w-[160px] h-10 text-xs bg-white/5 border-white/10 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#171929] border-white/10 text-slate-200">
                  {PRIORITY_MODES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DsCard>

        {/* Priority Ranked Candidate List */}
        <DsCard
          title={
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Candidate Priority Order for <span className="font-mono text-indigo-400">{selectedTask}</span> ({selectedPriority})</span>
            </div>
          }
          subtitle="Re-order candidates below. Top-ranked candidates receive highest evaluation weight during routing."
        >
          <div className="space-y-4">
            {activeRule.candidates.map((candidate, idx) => (
              <div
                key={`${candidate.provider}-${candidate.model}`}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  idx === 0
                    ? 'border-indigo-500/40 bg-gradient-to-r from-indigo-950/20 via-[#11131f] to-purple-950/20 shadow-lg shadow-indigo-500/10'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <GripVertical className="w-4 h-4 text-slate-500 cursor-grab" />
                  <span className="w-8 h-8 rounded-lg bg-white/5 text-slate-300 font-mono text-xs flex items-center justify-center font-bold border border-white/5">
                    #{idx + 1}
                  </span>
                  <DsProviderBadge provider={candidate.provider} />
                  <span className="font-mono text-sm font-bold text-white">{candidate.model}</span>
                </div>

                <div className="flex items-center gap-6">
                  {/* Visual Weight Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      Weight: {candidate.weight}
                    </span>
                    <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${(candidate.weight / 10) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <DsButton
                      variant="ghost"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => moveCandidate(idx, 'up')}
                      icon={<ArrowUp className="w-4 h-4" />}
                    />
                    <DsButton
                      variant="ghost"
                      size="sm"
                      disabled={idx === activeRule.candidates.length - 1}
                      onClick={() => moveCandidate(idx, 'down')}
                      icon={<ArrowDown className="w-4 h-4" />}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DsCard>

        {/* Code Terminal Output for Policy Resolution */}
        <div className="rounded-2xl border border-white/10 bg-[#07080e] overflow-hidden">
          <div className="px-5 py-3 bg-[#0c0d15] border-b border-white/10 text-xs font-mono text-indigo-400 font-bold uppercase tracking-wider">
            Policy Resolution Output Preview
          </div>
          <div className="p-5 font-mono text-xs text-slate-300 leading-relaxed">
            &quot;task_type={selectedTask}, priority={selectedPriority}, top_candidate={activeRule.candidates[0]?.provider}/{activeRule.candidates[0]?.model}, reason=highest weight ({activeRule.candidates[0]?.weight}) for {selectedPriority} {selectedTask}&quot;
          </div>
        </div>
      </div>
    </div>
  );
}
