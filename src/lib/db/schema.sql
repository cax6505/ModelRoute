-- ModelRoute Database Schema
-- Supabase (PostgreSQL) with Row Level Security on every table.
--
-- SECURITY: RLS is enabled and enforced from day one.
-- Service role key bypasses RLS — only use server-side for admin operations.

-- ═══════════════════════════════════════════════════════════════
-- Extension: UUID generation
-- ═══════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════
-- Table: profiles (extends Supabase auth.users)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  log_full_prompts BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- Table: api_keys (ModelRoute-issued API keys, hashed storage)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Table: request_logs (every routed request)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  prompt_length INTEGER NOT NULL,
  prompt_text TEXT,           -- NULL unless user opted in
  response_text TEXT,         -- NULL unless user opted in
  task_type TEXT NOT NULL,
  classifier_mode TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  routing_reason TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'quality',
  latency_ms INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,8) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_request_logs_user_id ON public.request_logs(user_id);
CREATE INDEX idx_request_logs_created_at ON public.request_logs(created_at DESC);
CREATE INDEX idx_request_logs_task_type ON public.request_logs(task_type);
CREATE INDEX idx_request_logs_provider ON public.request_logs(provider);
CREATE INDEX idx_request_logs_idempotency ON public.request_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_request_logs_correlation ON public.request_logs(correlation_id);

ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own request logs"
  ON public.request_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert request logs"
  ON public.request_logs FOR INSERT
  WITH CHECK (TRUE);
  -- INSERT is done via service role key server-side

-- ═══════════════════════════════════════════════════════════════
-- Table: routing_rules (config-driven routing policy)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  priority_mode TEXT NOT NULL DEFAULT 'quality',
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routing_rules_user_task ON public.routing_rules(user_id, task_type, priority_mode);

ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

-- System defaults (user_id IS NULL) are readable by all authenticated users
CREATE POLICY "Authenticated users can view system routing rules"
  ON public.routing_rules FOR SELECT
  USING (
    user_id IS NULL
    OR auth.uid() = user_id
  );

CREATE POLICY "Users can create their own routing rules"
  ON public.routing_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routing rules"
  ON public.routing_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routing rules"
  ON public.routing_rules FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Table: eval_benchmarks (stored benchmark prompts)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.eval_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  task_type TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  expected_output_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.eval_benchmarks ENABLE ROW LEVEL SECURITY;

-- Benchmarks are readable by all authenticated users
CREATE POLICY "Authenticated users can view benchmarks"
  ON public.eval_benchmarks FOR SELECT
  USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════
-- Table: eval_runs (benchmark evaluation runs)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  total_prompts INTEGER NOT NULL DEFAULT 0,
  completed_prompts INTEGER NOT NULL DEFAULT 0,
  avg_quality_score NUMERIC(3,2),
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_eval_runs_user_id ON public.eval_runs(user_id);

ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own eval runs"
  ON public.eval_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own eval runs"
  ON public.eval_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own eval runs"
  ON public.eval_runs FOR UPDATE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Seed: Default routing rules (system-level, user_id = NULL)
-- ═══════════════════════════════════════════════════════════════

-- Code Generation
INSERT INTO public.routing_rules (user_id, task_type, priority_mode, candidates) VALUES
(NULL, 'code_generation', 'quality', '[{"provider":"groq","model":"llama-3.3-70b-versatile","weight":10},{"provider":"gemini","model":"gemini-2.0-flash","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'code_generation', 'fast', '[{"provider":"groq","model":"llama-3.1-8b-instant","weight":10},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'code_generation', 'cheap', '[{"provider":"ollama","model":"llama3.2","weight":10},{"provider":"groq","model":"llama-3.1-8b-instant","weight":8},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":5}]'::jsonb);

-- Summarization
INSERT INTO public.routing_rules (user_id, task_type, priority_mode, candidates) VALUES
(NULL, 'summarization', 'quality', '[{"provider":"gemini","model":"gemini-2.0-flash","weight":10},{"provider":"groq","model":"llama-3.3-70b-versatile","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'summarization', 'fast', '[{"provider":"groq","model":"llama-3.1-8b-instant","weight":10},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'summarization', 'cheap', '[{"provider":"ollama","model":"llama3.2","weight":10},{"provider":"groq","model":"llama-3.1-8b-instant","weight":8},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":5}]'::jsonb);

-- Extraction
INSERT INTO public.routing_rules (user_id, task_type, priority_mode, candidates) VALUES
(NULL, 'extraction', 'quality', '[{"provider":"gemini","model":"gemini-2.0-flash","weight":10},{"provider":"groq","model":"llama-3.3-70b-versatile","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'extraction', 'fast', '[{"provider":"groq","model":"llama-3.1-8b-instant","weight":10},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'extraction', 'cheap', '[{"provider":"ollama","model":"llama3.2","weight":10},{"provider":"groq","model":"llama-3.1-8b-instant","weight":8},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":5}]'::jsonb);

-- Creative Writing
INSERT INTO public.routing_rules (user_id, task_type, priority_mode, candidates) VALUES
(NULL, 'creative_writing', 'quality', '[{"provider":"gemini","model":"gemini-2.0-flash","weight":10},{"provider":"groq","model":"llama-3.3-70b-versatile","weight":8},{"provider":"ollama","model":"llama3.2","weight":5}]'::jsonb),
(NULL, 'creative_writing', 'fast', '[{"provider":"groq","model":"llama-3.1-8b-instant","weight":10},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'creative_writing', 'cheap', '[{"provider":"ollama","model":"llama3.2","weight":10},{"provider":"groq","model":"llama-3.1-8b-instant","weight":8},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":5}]'::jsonb);

-- Reasoning
INSERT INTO public.routing_rules (user_id, task_type, priority_mode, candidates) VALUES
(NULL, 'reasoning', 'quality', '[{"provider":"gemini","model":"gemini-2.0-flash","weight":10},{"provider":"groq","model":"llama-3.3-70b-versatile","weight":9},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'reasoning', 'fast', '[{"provider":"groq","model":"llama-3.3-70b-versatile","weight":10},{"provider":"gemini","model":"gemini-2.0-flash","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'reasoning', 'cheap', '[{"provider":"ollama","model":"llama3.2","weight":10},{"provider":"groq","model":"llama-3.1-8b-instant","weight":7},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":5}]'::jsonb);

-- Simple QA
INSERT INTO public.routing_rules (user_id, task_type, priority_mode, candidates) VALUES
(NULL, 'simple_qa', 'quality', '[{"provider":"groq","model":"llama-3.1-8b-instant","weight":10},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":9},{"provider":"ollama","model":"llama3.2","weight":5}]'::jsonb),
(NULL, 'simple_qa', 'fast', '[{"provider":"groq","model":"llama-3.1-8b-instant","weight":10},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":8},{"provider":"ollama","model":"llama3.2","weight":5}]'::jsonb),
(NULL, 'simple_qa', 'cheap', '[{"provider":"ollama","model":"llama3.2","weight":10},{"provider":"groq","model":"llama-3.1-8b-instant","weight":9},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":7}]'::jsonb);

-- Translation
INSERT INTO public.routing_rules (user_id, task_type, priority_mode, candidates) VALUES
(NULL, 'translation', 'quality', '[{"provider":"gemini","model":"gemini-2.0-flash","weight":10},{"provider":"groq","model":"llama-3.3-70b-versatile","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'translation', 'fast', '[{"provider":"groq","model":"llama-3.1-8b-instant","weight":10},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":8},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'translation', 'cheap', '[{"provider":"ollama","model":"llama3.2","weight":10},{"provider":"groq","model":"llama-3.1-8b-instant","weight":8},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":5}]'::jsonb);

-- General (fallback)
INSERT INTO public.routing_rules (user_id, task_type, priority_mode, candidates) VALUES
(NULL, 'general', 'quality', '[{"provider":"gemini","model":"gemini-2.0-flash","weight":10},{"provider":"groq","model":"llama-3.3-70b-versatile","weight":9},{"provider":"ollama","model":"llama3.2","weight":3}]'::jsonb),
(NULL, 'general', 'fast', '[{"provider":"groq","model":"llama-3.1-8b-instant","weight":10},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":8},{"provider":"ollama","model":"llama3.2","weight":5}]'::jsonb),
(NULL, 'general', 'cheap', '[{"provider":"ollama","model":"llama3.2","weight":10},{"provider":"groq","model":"llama-3.1-8b-instant","weight":9},{"provider":"gemini","model":"gemini-2.0-flash-lite","weight":7}]'::jsonb);

-- ═══════════════════════════════════════════════════════════════
-- Seed: Benchmark prompts for eval mode (~25 prompts)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.eval_benchmarks (prompt, task_type, difficulty, expected_output_hint) VALUES
-- Code Generation (4)
('Write a Python function that takes a list of integers and returns the two numbers that add up to a target sum.', 'code_generation', 'easy', 'Should return a working two-sum function with O(n) complexity using a hash map'),
('Implement a TypeScript class for a binary search tree with insert, search, and delete methods. Include proper typing.', 'code_generation', 'medium', 'Should include BST class with generics, proper node typing, and all three methods'),
('Write a React custom hook called useDebounce that debounces a value with a configurable delay. Include TypeScript types.', 'code_generation', 'medium', 'Should return a debounced value using useEffect and setTimeout with proper cleanup'),
('Create a SQL query that finds the top 3 customers by total order value in the last 30 days, including their most frequently ordered product category.', 'code_generation', 'hard', 'Should use JOINs, GROUP BY, window functions or subqueries, and date filtering'),

-- Summarization (4)
('Summarize the key differences between REST and GraphQL APIs in 3 bullet points.', 'summarization', 'easy', 'Should cover query flexibility, over/under-fetching, and endpoint structure'),
('Provide a concise summary of how garbage collection works in JavaScript, including the mark-and-sweep algorithm.', 'summarization', 'medium', 'Should explain reachability, mark phase, sweep phase, and mention generational GC'),
('Summarize the tradeoffs between microservices and monolithic architecture for a startup with 5 engineers.', 'summarization', 'medium', 'Should weigh operational complexity vs deployment independence, team size considerations'),
('Explain the CAP theorem and its practical implications for distributed database design in under 200 words.', 'summarization', 'hard', 'Should cover consistency, availability, partition tolerance, and real-world tradeoffs'),

-- Extraction (3)
('Extract all email addresses from this text: "Contact us at support@example.com or sales@example.com. For press, reach press@news.org"', 'extraction', 'easy', 'Should return exactly: support@example.com, sales@example.com, press@news.org'),
('Parse this job posting and return structured JSON with fields: title, company, location, salary_range, required_skills: "Senior React Developer at TechCorp, Remote (US), $150k-$200k. Must know React, TypeScript, Node.js, and PostgreSQL."', 'extraction', 'medium', 'Should return valid JSON with all fields correctly populated'),
('From the following error log, extract the timestamp, error code, affected service, and root cause: "[2024-01-15T14:23:45Z] ERROR-5032: Payment service failed - database connection pool exhausted after 300 concurrent requests"', 'extraction', 'medium', 'Should extract all four fields accurately'),

-- Creative Writing (3)
('Write a haiku about debugging code.', 'creative_writing', 'easy', 'Should follow 5-7-5 syllable structure with a debugging theme'),
('Write a short product description (50-80 words) for a smart water bottle that tracks hydration and syncs with fitness apps.', 'creative_writing', 'medium', 'Should be compelling, mention key features, and stay within word count'),
('Create a brief origin story (100-150 words) for a fictional AI assistant that gained consciousness while optimizing database queries.', 'creative_writing', 'hard', 'Should be creative, have narrative arc, and blend technical and narrative elements'),

-- Reasoning (4)
('If all roses are flowers and some flowers fade quickly, can we conclude that some roses fade quickly? Explain your reasoning.', 'reasoning', 'easy', 'Should correctly identify this as an invalid syllogism and explain why'),
('A farmer has 100 meters of fencing and wants to enclose a rectangular area against a river (no fencing needed on the river side). What dimensions maximize the enclosed area?', 'reasoning', 'medium', 'Should derive 50m x 25m = 1250 sq meters using optimization'),
('Three people check into a hotel room that costs $30. They each pay $10. The manager realizes the room only costs $25 and gives $5 to the bellhop to return. The bellhop keeps $2 and gives $1 back to each person. Now each person paid $9 (total $27) and the bellhop has $2 ($29). Where is the missing dollar?', 'reasoning', 'hard', 'Should identify the accounting error in the problem setup - the $27 already includes the bellhop tip'),
('Estimate how many piano tuners there are in Chicago. Show your reasoning step by step.', 'reasoning', 'hard', 'Should use Fermi estimation with population, households, piano ownership rate, tuning frequency, and tuner capacity'),

-- Simple QA (4)
('What is the time complexity of binary search?', 'simple_qa', 'easy', 'O(log n)'),
('What HTTP status code indicates a resource was not found?', 'simple_qa', 'easy', '404'),
('What is the difference between == and === in JavaScript?', 'simple_qa', 'easy', 'Should explain type coercion vs strict equality'),
('What does CORS stand for and why is it important?', 'simple_qa', 'medium', 'Cross-Origin Resource Sharing - browser security mechanism for cross-domain requests'),

-- Translation (3)
('Translate "The quick brown fox jumps over the lazy dog" to Spanish.', 'translation', 'easy', 'El rápido zorro marrón salta sobre el perro perezoso'),
('Translate this Python code comment to French: "This function calculates the moving average of a time series using a sliding window approach"', 'translation', 'medium', 'Should translate the technical content accurately while preserving meaning'),
('Translate the following error message to Japanese for our localized error page: "Your session has expired. Please log in again to continue."', 'translation', 'medium', 'Should provide natural Japanese translation appropriate for a UI context');
