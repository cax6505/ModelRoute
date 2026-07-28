/**
 * Task Classifier — determines the task type of an incoming prompt.
 *
 * Three modes (controlled by CLASSIFIER_MODE env var):
 * 1. 'rules' — fast, deterministic regex/heuristic classification
 * 2. 'llm' — uses cheapest available model for classification
 * 3. 'hybrid' — rules first, LLM only if confidence is low
 *
 * SECURITY: In LLM mode, user input is placed in the user message role,
 * never concatenated into system instructions. This prevents prompt injection
 * from influencing the classification system prompt.
 */

import type {
  ClassificationResult,
  TaskType,
  LLMProvider,
  Message,
} from './types';
import { TASK_TYPES } from './types';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'classifier' });

// ─── Rules-Based Classifier ─────────────────────────────────

interface ClassificationRule {
  taskType: TaskType;
  /** Keywords that strongly indicate this task type */
  keywords: RegExp[];
  /** Patterns in the prompt structure */
  patterns: RegExp[];
  /** Weight multiplier for prompt length heuristic */
  lengthBias: 'short' | 'medium' | 'long' | 'any';
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    taskType: 'creative_writing',
    keywords: [
      /\b(write|compose|create|craft|draft)\s+(a\s+)?(story|poem|haiku|essay|blog|article|description|narrative|dialogue|script|limerick|sonnet)\b/i,
      /\b(creative|fiction|imaginative|original)\s+(writing|piece|work|story)\b/i,
      /\b(haiku|poem|short\s+story|flash\s+fiction|product\s+description|origin\s+story)\b/i,
    ],
    patterns: [
      /\b(once\s+upon|in\s+a\s+world|imagine)\b/i,
      /\b(tone|style|voice|mood|genre)\b/i,
      /\b(\d+-\d+\s*words?)\b/i,
    ],
    lengthBias: 'any',
  },
  {
    taskType: 'translation',
    keywords: [
      /\b(translate|translation|convert)\s+(this\s+)?(to|into|from)\s+\w+/i,
      /\b(in\s+(spanish|french|german|japanese|chinese|korean|portuguese|italian|russian|arabic|hindi))\b/i,
      /\b(locali[sz]e|locali[sz]ation|i18n)\b/i,
    ],
    patterns: [
      /\b(target\s+language|source\s+language)\b/i,
    ],
    lengthBias: 'any',
  },
  {
    taskType: 'code_generation',
    keywords: [
      /\b(implement|build|code|function|class|method|script|program|algorithm)\b/i,
      /\b(write\s+(a\s+)?(function|class|method|script|program|module|component|hook|query|api|endpoint))\b/i,
      /\b(typescript|javascript|python|java|rust|golang|sql|html|css|react|vue|angular)\b/i,
      /\b(api|endpoint|component|hook|module|package|library)\b/i,
    ],
    patterns: [
      /```/,                           // Code blocks in prompt
      /\b(def |function |class |const |let |var |import |from )\b/,
      /\b(return|if|else|for|while|switch)\b.*[{(]/,
    ],
    lengthBias: 'any',
  },
  {
    taskType: 'summarization',
    keywords: [
      /\b(summarize|summary|summarise|tldr|tl;dr|brief|overview|recap|condense|digest)\b/i,
      /\b(key\s*(points|takeaways|findings|ideas))\b/i,
      /\b(in\s*(short|brief|a\s*nutshell))\b/i,
    ],
    patterns: [
      /\b(bullet\s*points?|numbered\s*list)\b/i,
    ],
    lengthBias: 'long',
  },
  {
    taskType: 'extraction',
    keywords: [
      /\b(extract|parse|find\s+all|identify|list\s+all|pull\s+out|get\s+the)\b/i,
      /\b(structured|json|csv|table|data|fields?|entities?|values?)\b/i,
    ],
    patterns: [
      /\b(from\s+(this|the|following)\s+(text|data|document|log|email))\b/i,
      /\breturn\s+(as\s+)?(json|structured|a\s+table)\b/i,
    ],
    lengthBias: 'any',
  },
  {
    taskType: 'reasoning',
    keywords: [
      /\b(explain|analyze|analyse|compare|evaluate|assess|reason|deduce|infer|prove|solve)\b/i,
      /\b(why|how\s+does|what\s+causes|what\s+if|trade-?offs?|pros?\s+and\s+cons?)\b/i,
      /\b(logic|mathematical|proof|theorem|hypothesis|estimate|calculate)\b/i,
    ],
    patterns: [
      /\b(step\s+by\s+step|show\s+(your\s+)?work|reasoning)\b/i,
      /\d+\s*[\+\-\*\/\^]\s*\d+/,     // Math expressions
    ],
    lengthBias: 'medium',
  },
  {
    taskType: 'simple_qa',
    keywords: [
      /^(what|who|when|where|which|how\s+many|how\s+much|is|are|does|do|can|will)\b/i,
      /\b(definition|meaning|difference\s+between)\b/i,
    ],
    patterns: [
      /\?$/, // Ends with question mark
    ],
    lengthBias: 'short',
  },
];

/**
 * Classify a prompt using rule-based heuristics.
 */
export function classifyWithRules(prompt: string): ClassificationResult {
  const scores: Map<TaskType, number> = new Map();

  // Initialize all task types with 0
  for (const tt of TASK_TYPES) {
    scores.set(tt, 0);
  }

  const promptLength = prompt.length;
  const promptLower = prompt.toLowerCase();

  for (const rule of CLASSIFICATION_RULES) {
    let score = 0;

    // Keyword matching (high weight)
    for (const keyword of rule.keywords) {
      if (keyword.test(promptLower)) {
        score += 3;
      }
    }

    // Pattern matching (medium weight)
    for (const pattern of rule.patterns) {
      if (pattern.test(prompt)) {
        score += 2;
      }
    }

    // Length bias
    if (rule.lengthBias === 'short' && promptLength < 100) {
      score += 1;
    } else if (rule.lengthBias === 'medium' && promptLength >= 100 && promptLength <= 500) {
      score += 1;
    } else if (rule.lengthBias === 'long' && promptLength > 500) {
      score += 1;
    }

    scores.set(rule.taskType, (scores.get(rule.taskType) ?? 0) + score);
  }

  // Find highest scoring task type
  let bestType: TaskType = 'general';
  let bestScore = 0;
  let totalScore = 0;

  for (const [taskType, score] of scores.entries()) {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestType = taskType;
    }
  }

  // Confidence: normalize to 0-1 based on score
  const confidence = totalScore > 0
    ? Math.min(bestScore / Math.max(totalScore, 1), 1)
    : 0.1; // Very low confidence if no rules matched

  // If no rules matched at all, default to general
  if (bestScore === 0) {
    bestType = 'general';
  }

  return {
    taskType: bestType,
    confidence: Math.round(confidence * 100) / 100,
    method: 'rules',
  };
}

// ─── LLM-Based Classifier ───────────────────────────────────

const CLASSIFIER_SYSTEM_PROMPT = `You are a task classifier for an LLM routing system. Your job is to classify the user's prompt into exactly one of these task types:

- code_generation: Writing, debugging, or explaining code
- summarization: Condensing longer text into key points
- extraction: Pulling structured data from unstructured text
- creative_writing: Stories, poems, descriptions, marketing copy
- reasoning: Logic, math, analysis, comparisons, step-by-step thinking
- simple_qa: Factual questions with short answers
- translation: Converting text between languages
- general: Anything that doesn't clearly fit the above

Respond with ONLY a JSON object in this exact format, nothing else:
{"taskType": "<type>", "confidence": <0.0-1.0>}

Do not include any explanation, markdown formatting, or additional text.`;

/**
 * Classify a prompt using an LLM call.
 * Uses structured message roles to prevent prompt injection.
 */
export async function classifyWithLLM(
  prompt: string,
  provider: LLMProvider,
  model: string,
): Promise<ClassificationResult> {
  // SECURITY: User input is in the user role, not concatenated into system instructions
  const messages: Message[] = [
    { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
    { role: 'user', content: `Classify this prompt:\n\n${prompt}` },
  ];

  try {
    const response = await provider.complete({
      model,
      messages,
      maxTokens: 50,
      temperature: 0,
      timeoutMs: 5_000, // Classification should be fast
    });

    // Parse and validate the LLM's response
    const parsed = JSON.parse(response.content.trim());

    if (
      parsed.taskType &&
      TASK_TYPES.includes(parsed.taskType) &&
      typeof parsed.confidence === 'number'
    ) {
      return {
        taskType: parsed.taskType as TaskType,
        confidence: Math.min(Math.max(parsed.confidence, 0), 1),
        method: 'llm',
      };
    }

    log.warn('LLM classifier returned invalid format, falling back to rules', {
      response: response.content.substring(0, 200),
    });
    return classifyWithRules(prompt);
  } catch (error) {
    log.warn('LLM classification failed, falling back to rules', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return classifyWithRules(prompt);
  }
}

// ─── Hybrid Classifier ──────────────────────────────────────

const HYBRID_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Hybrid classifier: rules first, LLM only if rules confidence is too low.
 */
export async function classifyHybrid(
  prompt: string,
  provider: LLMProvider,
  model: string,
): Promise<ClassificationResult> {
  const rulesResult = classifyWithRules(prompt);

  if (rulesResult.confidence >= HYBRID_CONFIDENCE_THRESHOLD) {
    return rulesResult;
  }

  log.info('Rules confidence too low, using LLM classifier', {
    rulesTaskType: rulesResult.taskType,
    rulesConfidence: rulesResult.confidence,
  });

  const llmResult = await classifyWithLLM(prompt, provider, model);
  return {
    ...llmResult,
    method: 'hybrid',
  };
}

/**
 * Main classification entry point.
 * Routes to the appropriate classifier based on mode.
 */
export async function classify(
  prompt: string,
  mode: 'rules' | 'llm' | 'hybrid',
  provider?: LLMProvider,
  model?: string,
): Promise<ClassificationResult> {
  if (mode === 'rules') {
    return classifyWithRules(prompt);
  }

  if (!provider || !model) {
    log.warn('LLM/hybrid mode requested but no provider available, falling back to rules');
    return classifyWithRules(prompt);
  }

  if (mode === 'llm') {
    return classifyWithLLM(prompt, provider, model);
  }

  return classifyHybrid(prompt, provider, model);
}
