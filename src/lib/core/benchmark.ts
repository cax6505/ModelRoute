import type { TaskType } from "./types";
import { classifyWithRules } from "./classifier";

export interface BenchmarkCase {
  id: string;
  prompt: string;
  taskType: TaskType;
  difficulty: "easy" | "medium" | "hard";
}

export const CLASSIFIER_BENCHMARK: BenchmarkCase[] = [
  {
    id: "code-01",
    prompt: "Write a TypeScript function that debounces a callback.",
    taskType: "code_generation",
    difficulty: "easy",
  },
  {
    id: "code-02",
    prompt: "Fix this Python function so it handles an empty list.",
    taskType: "code_generation",
    difficulty: "easy",
  },
  {
    id: "code-03",
    prompt: "Implement a retrying HTTP client with typed errors.",
    taskType: "code_generation",
    difficulty: "medium",
  },
  {
    id: "code-04",
    prompt: "Generate a SQL query that finds duplicate email addresses.",
    taskType: "code_generation",
    difficulty: "medium",
  },
  {
    id: "summary-01",
    prompt: "Summarize the key differences between REST and GraphQL.",
    taskType: "summarization",
    difficulty: "easy",
  },
  {
    id: "summary-02",
    prompt: "Give me a concise summary of this incident report.",
    taskType: "summarization",
    difficulty: "easy",
  },
  {
    id: "summary-03",
    prompt: "Condense these meeting notes into five bullet points.",
    taskType: "summarization",
    difficulty: "medium",
  },
  {
    id: "summary-04",
    prompt: "What are the main conclusions from this long article?",
    taskType: "summarization",
    difficulty: "medium",
  },
  {
    id: "extract-01",
    prompt: "Extract all email addresses from this customer text.",
    taskType: "extraction",
    difficulty: "easy",
  },
  {
    id: "extract-02",
    prompt: "Return the order IDs and totals as JSON.",
    taskType: "extraction",
    difficulty: "easy",
  },
  {
    id: "extract-03",
    prompt: "Find every date and timestamp in this log.",
    taskType: "extraction",
    difficulty: "medium",
  },
  {
    id: "extract-04",
    prompt: "Identify the product names and quantities in this invoice.",
    taskType: "extraction",
    difficulty: "medium",
  },
  {
    id: "creative-01",
    prompt: "Write a haiku about debugging code.",
    taskType: "creative_writing",
    difficulty: "easy",
  },
  {
    id: "creative-02",
    prompt: "Create a short mystery story set on Mars.",
    taskType: "creative_writing",
    difficulty: "easy",
  },
  {
    id: "creative-03",
    prompt: "Give me three poetic names for a coffee shop.",
    taskType: "creative_writing",
    difficulty: "medium",
  },
  {
    id: "creative-04",
    prompt: "Write a playful bedtime story about a robot.",
    taskType: "creative_writing",
    difficulty: "medium",
  },
  {
    id: "reason-01",
    prompt: "Explain why the sky is blue step by step.",
    taskType: "reasoning",
    difficulty: "easy",
  },
  {
    id: "reason-02",
    prompt: "Compare these tradeoffs and recommend one with justification.",
    taskType: "reasoning",
    difficulty: "medium",
  },
  {
    id: "reason-03",
    prompt: "Prove whether this argument is logically valid.",
    taskType: "reasoning",
    difficulty: "medium",
  },
  {
    id: "reason-04",
    prompt: "Analyze the likely causes of this system failure.",
    taskType: "reasoning",
    difficulty: "hard",
  },
  {
    id: "qa-01",
    prompt: "What is the time complexity of binary search?",
    taskType: "simple_qa",
    difficulty: "easy",
  },
  {
    id: "qa-02",
    prompt: "Who wrote Pride and Prejudice?",
    taskType: "simple_qa",
    difficulty: "easy",
  },
  {
    id: "qa-03",
    prompt: "What does HTTP status code 404 mean?",
    taskType: "simple_qa",
    difficulty: "easy",
  },
  {
    id: "qa-04",
    prompt: "How many bytes are in a kilobyte?",
    taskType: "simple_qa",
    difficulty: "easy",
  },
  {
    id: "translate-01",
    prompt: "Translate this sentence to Spanish: Hello world.",
    taskType: "translation",
    difficulty: "easy",
  },
  {
    id: "translate-02",
    prompt: "Translate the following French message into English.",
    taskType: "translation",
    difficulty: "easy",
  },
  {
    id: "translate-03",
    prompt: "Convert this support email from German to English.",
    taskType: "translation",
    difficulty: "medium",
  },
  {
    id: "translate-04",
    prompt: "Translate this API notification into Japanese.",
    taskType: "translation",
    difficulty: "medium",
  },
  {
    id: "general-01",
    prompt: "Help me think through a better way to organize my work.",
    taskType: "general",
    difficulty: "medium",
  },
  {
    id: "general-02",
    prompt: "I am not sure what approach to take here.",
    taskType: "general",
    difficulty: "medium",
  },
  {
    id: "general-03",
    prompt: "Can you help me decide what to do next?",
    taskType: "general",
    difficulty: "easy",
  },
  {
    id: "general-04",
    prompt: "Tell me something useful about this situation.",
    taskType: "general",
    difficulty: "medium",
  },
];

export interface BenchmarkReport {
  total: number;
  correct: number;
  accuracy: number;
  byTask: Record<string, { total: number; correct: number; accuracy: number }>;
  confusion: Array<{ expected: string; actual: string; count: number }>;
}

export function runClassifierBenchmark(
  cases: BenchmarkCase[] = CLASSIFIER_BENCHMARK,
): BenchmarkReport {
  const byTask: BenchmarkReport["byTask"] = {};
  const confusion = new Map<string, number>();
  let correct = 0;

  for (const item of cases) {
    const actual = classifyWithRules(item.prompt).taskType;
    const task = byTask[item.taskType] ?? { total: 0, correct: 0, accuracy: 0 };
    task.total += 1;
    if (actual === item.taskType) {
      correct += 1;
      task.correct += 1;
    } else {
      const key = `${item.taskType}\u0000${actual}`;
      confusion.set(key, (confusion.get(key) ?? 0) + 1);
    }
    task.accuracy = task.correct / task.total;
    byTask[item.taskType] = task;
  }

  return {
    total: cases.length,
    correct,
    accuracy: cases.length ? correct / cases.length : 0,
    byTask,
    confusion: [...confusion.entries()].map(([key, count]) => {
      const [expected, actual] = key.split("\u0000");
      return { expected, actual, count };
    }),
  };
}
