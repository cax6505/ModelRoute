# ModelRoute — Intelligent LLM Model Router

**ModelRoute** is an enterprise-grade LLM routing system that dynamically classifies incoming user prompts and dispatches them to the optimal model provider (Groq, Gemini, Ollama) based on task intent, cost, latency, and capability tradeoffs.

Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Upstash Redis**, and **Supabase (PostgreSQL)**.

---

## 📐 System Architecture & Design

```
                     ┌─────────────────────────────────────────┐
                     │          Client / API Consumer          │
                     │    (Playground UI / REST API Client)   │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │           Next.js API Gateway           │
                     │          (POST /api/route)              │
                     └────────────────────┬────────────────────┘
                                          │
       ┌──────────────────────────────────┼──────────────────────────────────┐
       │                                  │                                  │
       ▼                                  ▼                                  ▼
┌───────────────┐              ┌────────────────────┐              ┌───────────────────┐
│ Zod Boundary  │              │  Upstash Rate Limit│              │  API Key Vault    │
│ Validation    │              │ (Burst & Budget)   │              │  (SHA-256 Auth)   │
└───────┬───────┘              └──────────┬─────────┘              └─────────┬─────────┘
        │                                 │                                  │
        └─────────────────────────────────┼──────────────────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │            Classifier Layer             │
                     │   (Rules / LLM / Hybrid Intent Tag)     │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │          Routing Policy Engine          │
                     │ (Candidate Ranking & Fallback Ordering) │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │         Circuit Breaker Manager         │
                     │    (CLOSED ➔ OPEN ➔ HALF_OPEN State)     │
                     └────────────────────┬────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
        ▼                                 ▼                                 ▼
┌───────────────┐                 ┌───────────────┐                 ┌───────────────┐
│ Groq Provider │                 │Gemini Provider│                 │Ollama Provider│
│ (Llama 70B/8B)│                 │ (Flash 2.0)   │                 │ (Local Llama) │
└───────┬───────┘                 └───────┬───────┘                 └───────┬───────┘
        │                                 │                                 │
        └─────────────────────────────────┼─────────────────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │   Streaming Output & Request Logging    │
                     │   (SSE Stream + Supabase Audit Logs)    │
                     └─────────────────────────────────────────┘
```

---

## 🗝 Key Features & System Architecture

### 1. Multi-Mode Task Classification
- **Rules-Based Engine**: Ultra-fast deterministic regex, keyword, and structural pattern matching across 8 task intent categories:
  - `code_generation`, `summarization`, `extraction`, `creative_writing`, `reasoning`, `simple_qa`, `translation`, `general`
- **LLM-Based Classifier**: Dispatches to lightweight classifier models using strict structured message roles to prevent prompt injection.
- **Hybrid Mode**: Evaluates rules first; falls back to LLM classification only when rule confidence is below threshold.

### 2. Config-Driven Routing Engine
- Maps task intent + priority policy (`quality`, `fast`, `cheap`) to ranked model candidate chains.
- Formulates transparent, audit-ready decision resolution strings (e.g., `task_type=code_generation, top_candidate=groq/llama-3.3-70b-versatile, reason=highest weight (10) for quality code_generation`).

### 3. Provider Resilience & Circuit Breakers
- **Circuit Breaker States**:
  - `CLOSED`: Healthy state; requests pass through.
  - `OPEN`: Provider failing (trips after N errors in window); automatically bypasses provider.
  - `HALF_OPEN`: Cooldown elapsed; permits probe requests to test recovery.
- **Exponential Backoff & Jitter**: Automatically retries transient 5xx/429 errors before attempting fallback candidates.

### 4. Enterprise Security & Rate Limiting
- **SHA-256 API Key Storage**: Issued keys (`mr_live_...`) are hashed prior to storage. Raw keys are revealed once upon creation.
- **Two-Tier Rate Limiting**: Upstash Redis sliding window enforcement (15 RPM burst limit, 100 RPH budget limit).
- **Privacy Controls**: Prompts are hashed with SHA-256 by default. Full prompt text logging is strictly opt-in.

---

## 📊 Benchmark Model Catalog

| Provider | Model ID | Tier | Context Window | Best For | Free Quota |
| :--- | :--- | :---: | :---: | :--- | :---: |
| **Groq** | `llama-3.3-70b-versatile` | Quality | 131K | Complex Code & Reasoning | 30 RPM |
| **Groq** | `llama-3.1-8b-instant` | Speed | 131K | Ultra-Low Latency Q&A | 30 RPM |
| **Gemini** | `gemini-2.0-flash` | Quality | 1M | Summarization & Analysis | 15 RPM |
| **Gemini** | `gemini-2.0-flash-lite` | Balanced | 1M | Fast Multimodal Tasks | 15 RPM |
| **Ollama** | `llama3.2` | Local | 128K | Zero-Cost Fallback & Dev | Unlimited |

---

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router with Turbopack)
- **Language**: TypeScript (Strict Mode)
- **UI Components**: Tailwind CSS v4, shadcn/ui, Lucide Icons, Plus Jakarta Sans & Fira Code typography
- **Data Visualizations**: Recharts
- **Database & Auth**: Supabase (PostgreSQL with RLS policies enabled on all tables)
- **Rate Limiting**: Upstash Redis (`@upstash/ratelimit`)
- **Testing**: Vitest (`24/24` passing tests)

---

## 🚀 Quick Start Guide

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/ModelRoute.git
cd ModelRoute
npm install
```

### 2. Environment Configuration (`.env.local`)
Create a `.env.local` file in the root directory:

```env
# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM Providers
GROQ_API_KEY=gsk_your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
OLLAMA_BASE_URL=http://localhost:11434

# Upstash Redis Rate Limiting
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# App Config
CLASSIFIER_MODE=rules
MAX_PROMPT_LENGTH=32000
LOG_FULL_PROMPTS=true
```

### 3. Database Schema Setup
Execute the PostgreSQL migrations in [schema.sql](file:///Users/kollicharanadithya/Desktop/ModelRoute/src/lib/db/schema.sql) inside your Supabase SQL Editor.

### 4. Run Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to open the Playground Studio.

### 5. Run Unit Tests
```bash
npm test
```

---

## 📡 API Reference

### Unified Route Endpoint (`POST /api/route`)

**Request Body**:
```json
{
  "prompt": "Write a Python function to check if a number is prime",
  "priority": "quality",
  "stream": false
}
```

**Response**:
```json
{
  "content": "def is_prime(n: int) -> bool: ...",
  "routingDecision": {
    "taskType": "code_generation",
    "classifierMode": "rules",
    "classifierConfidence": 0.86,
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "reason": "task_type=code_generation, priority=quality, top_candidate=groq/llama-3.3-70b-versatile",
    "fallbacksConsidered": [
      { "provider": "gemini", "model": "gemini-2.0-flash" },
      { "provider": "ollama", "model": "llama3.2" }
    ],
    "latencyMs": 592,
    "inputTokens": 48,
    "outputTokens": 22,
    "estimatedCostUsd": 0.0000457
  }
}
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
