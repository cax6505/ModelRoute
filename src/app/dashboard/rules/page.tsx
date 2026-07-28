'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TASK_TYPES, PRIORITY_MODES } from '@/lib/core/types';
import { ArrowUp, ArrowDown, RotateCcw, Save, Sparkles, Sliders } from 'lucide-react';

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

const PROVIDER_COLORS: Record<string, string> = {
  groq: 'provider-badge-groq',
  gemini: 'provider-badge-gemini',
  ollama: 'provider-badge-ollama',
};

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
    <div className="h-full flex flex-col overflow-hidden bg-[#05060a]">
      <header className="h-20 flex items-center justify-between px-8 border-b border-white/10 bg-[#080912]/80 backdrop-blur-xl flex-shrink-0">
        <div>
          <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Routing Engine Policy Editor
          </h1>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">
            Configure candidate ordering and fallback weights for task types and priority policies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setRules(INITIAL_RULES)} className="h-9 px-4 text-xs font-semibold border-white/10 text-zinc-300">
            <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reset Defaults
          </Button>
          <Button size="sm" onClick={handleSave} className="h-9 px-5 text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
            <Save className="w-3.5 h-3.5 mr-2" /> {isSaved ? 'Policy Saved!' : 'Save Policy Changes'}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-5xl mx-auto w-full">
        {/* Selectors */}
        <Card className="card-glass">
          <CardContent className="p-6 flex flex-wrap items-center gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider block">Task Type Intent</label>
              <Select value={selectedTask} onValueChange={(val) => val && setSelectedTask(val)}>
                <SelectTrigger className="w-[200px] h-10 text-xs bg-white/5 border-white/10 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#11121d] border-white/10 text-zinc-200">
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider block">Priority Mode Policy</label>
              <Select value={selectedPriority} onValueChange={(val) => val && setSelectedPriority(val)}>
                <SelectTrigger className="w-[160px] h-10 text-xs bg-white/5 border-white/10 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#11121d] border-white/10 text-zinc-200">
                  {PRIORITY_MODES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Priority Candidates Chain */}
        <Card className="card-glass">
          <CardHeader className="p-6 pb-4 border-b border-white/10">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Candidate Priority Order for <span className="font-mono text-indigo-400">{selectedTask}</span> ({selectedPriority})
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Drag or re-order candidate models below. The router evaluates top-ranked candidates first and automatically fails over if rate limits or errors occur.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {activeRule.candidates.map((candidate, idx) => (
              <div
                key={`${candidate.provider}-${candidate.model}`}
                className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-7 h-7 rounded-lg bg-white/5 text-zinc-300 font-mono text-xs flex items-center justify-center font-bold">
                    #{idx + 1}
                  </span>
                  <Badge className={`text-xs font-mono ${PROVIDER_COLORS[candidate.provider]}`}>
                    {candidate.provider}
                  </Badge>
                  <span className="font-mono text-sm font-semibold text-white">{candidate.model}</span>
                </div>

                <div className="flex items-center gap-6">
                  <span className="text-xs font-mono text-zinc-400 font-semibold">
                    Candidate Weight: {candidate.weight}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === 0}
                      onClick={() => moveCandidate(idx, 'up')}
                    >
                      <ArrowUp className="w-4 h-4 text-zinc-300" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === activeRule.candidates.length - 1}
                      onClick={() => moveCandidate(idx, 'down')}
                    >
                      <ArrowDown className="w-4 h-4 text-zinc-300" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Live Simulation */}
        <Card className="card-glass border-indigo-500/20 bg-indigo-950/10">
          <CardContent className="p-6">
            <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider block mb-2">
              Policy Explanation Preview
            </span>
            <p className="text-xs font-mono text-zinc-300 leading-relaxed">
              &quot;task_type={selectedTask}, priority={selectedPriority}, top_candidate={activeRule.candidates[0]?.provider}/{activeRule.candidates[0]?.model}, reason=highest weight ({activeRule.candidates[0]?.weight}) for {selectedPriority} {selectedTask}&quot;
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
