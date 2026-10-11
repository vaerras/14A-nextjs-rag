# Dota 2 Team Drafter · Next.js RAG

A streaming Dota 2 drafting assistant built on a hero knowledge base, using [Next.js 15](https://nextjs.org/), the [Vercel AI SDK](https://sdk.vercel.ai/), and [Upstash Vector](https://upstash.com/docs/vector). It started as the Week 14A Section 4 RAG starter (the "Acme Spec Bot") and has since been adapted to a Dota 2 corpus with hybrid (dense + sparse) retrieval.

The assistant helps with three things:

1. **Draft teams**: build a full Pos 1–5 lineup around a hero, playstyle, or win condition, with each pick's role, reasoning, and power spike.
2. **Suggest counter teams**: given enemy heroes, recommend counter picks by position, backed by the corpus's "Counters" / "Countered by" tags and key counter items.
3. **Meta team compositions**: describe the reference compositions in the corpus (e.g. Wombot Combo, Fast Push Deathball), their win conditions, and what beats them.

## What's here

```text
14A-nextjs-rag/
├── app/
│   ├── globals.css
│   ├── layout.tsx                        # Page title / metadata
│   ├── page.tsx                          # FINAL UI: useChat, suggested prompts, sources
│   └── api/chat/route.ts                 # FINAL handler: drafter prompt + hybrid RAG tool
├── lib/
│   ├── seed.ts                           # Embeds data/sample.pdf (dense + sparse) into Upstash
│   └── sparse.ts                         # BM25-style sparse encoder for hybrid search
├── data/
│   └── sample.pdf                        # Dota 2 Complete Hero Corpus (128 heroes)
├── steps/                                # Reference snapshots per workshop step (original Acme version)
│   ├── step2-plain-chat/
│   │   ├── page.tsx                      # Step 2: useChat client component
│   │   └── route.ts                      # Step 2: vanilla streamText handler
│   ├── step4-rag-as-tool/
│   │   └── route.ts                      # Step 4: route handler with the tool
│   └── step5-sources/
│       └── page.tsx                      # Step 5: page with <details> sources
├── package.json
├── tsconfig.json
├── next.config.mjs
├── postcss.config.mjs
├── tailwind.config.ts
├── .env.example
├── .gitignore
└── README.md
```

## How retrieval works

The model calls a `getInformation` tool whenever it needs facts from the corpus. It may call it several times per answer (`maxSteps: 5`), e.g. once for the enemy heroes and again for their counters.

Each tool call runs a **hybrid search** against Upstash Vector:

- **Dense**: the query is embedded with OpenAI `text-embedding-3-small` for semantic similarity.
- **Sparse**: the query is turned into a BM25-style keyword vector by `lib/sparse.ts`. Tokens are hashed (FNV-1a) to dimension indices. Documents store BM25-saturated term frequencies, and at query time `WeightingStrategy.IDF` supplies the IDF half of BM25. This boosts exact matches on hero and item names such as "Silver Edge", which dense embeddings alone tend to blur.
- The two result lists are merged with **Reciprocal Rank Fusion** (`FusionAlgorithm.RRF`), and the top 4 chunks are returned with their text, page, and score.

## Setup (5 minutes)

### 1. Create a hybrid Upstash Vector index

In the [Upstash console](https://console.upstash.com/vector), create an index with type **Hybrid** (dense + sparse):

- Dense embedding model: **custom / none** (we embed with OpenAI), dimensions **1536**
- Dense metric: **COSINE**
- Sparse embedding model: **custom / none** (we supply our own sparse vectors)

> A dense-only index from the original starter **will not work**: upserts and queries that include `sparseVector` are rejected. Create a new hybrid index and point your env vars at it.

### 2. Install, configure, seed

```bash
# install
npm install

# environment
cp .env.example .env.local
# edit .env.local and paste your real OPENAI_API_KEY,
# UPSTASH_VECTOR_REST_URL, UPSTASH_VECTOR_REST_TOKEN (from the hybrid index)

# seed the vector index (one-time, or whenever data/sample.pdf changes)
npm run seed
```

The seed script reads `data/sample.pdf`, splits it into ~800-character chunks (100-character overlap), and builds two vectors for each chunk: a dense `text-embedding-3-small` embedding and a BM25 sparse vector normalized against the corpus's average chunk length. It then upserts both to Upstash. Re-running it overwrites the same ids, so it's idempotent.

## Run the app

```bash
npm run dev
# open http://localhost:3000
```

On an empty chat you'll see three suggested prompts you can click. You can also try:

- *"Draft a full Pos 1–5 team around Faceless Void with a teamfight win condition."*
- *"The enemy has Phantom Lancer, Huskar, and Storm Spirit. Suggest a counter team."*
- *"What are the current meta team compositions, and how do I beat them?"*

Tokens stream into the assistant bubble, and a **Sources (N)** disclosure appears beneath it. Expanding it shows the page numbers, fused relevance scores, and chunk text the model retrieved.

The assistant only answers Dota 2 drafting questions and redirects anything else. The corpus isn't tied to a specific patch, so live win rates and patch changes may differ from its answers.

## Walk through the steps

The `/steps` folder contains reference snapshots from the original workshop (Acme spec bot, dense-only search). To try them, copy each file over the matching path in `app/`:

| Step | Files to copy                                                | What it shows                              |
| ---- | ------------------------------------------------------------ | ------------------------------------------ |
| 2    | `steps/step2-plain-chat/page.tsx` → `app/page.tsx`           | useChat working against vanilla streamText |
|      | `steps/step2-plain-chat/route.ts` → `app/api/chat/route.ts`  | (no RAG yet; verify streaming first)       |
| 4    | `steps/step4-rag-as-tool/route.ts` → `app/api/chat/route.ts` | The model decides when to call retrieval   |
| 5    | `steps/step5-sources/page.tsx` → `app/page.tsx`              | Sources rendered below answers             |

The final `app/` files build on Step 5 and add:

- The Dota 2 drafter system prompt and tool description
- Hybrid dense + sparse search with RRF fusion (`lib/sparse.ts`)
- `maxSteps: 5` so the model can run several lookups per answer
- Suggested-prompt buttons, a header, and status / error rendering

## Use your own corpus

1. Replace `data/sample.pdf` with your own PDF.
2. Update the system prompt and tool description in `app/api/chat/route.ts` (and the suggested prompts in `app/page.tsx`) to match the new domain.
3. Re-run `npm run seed`. If the new document produces fewer chunks than the old one, delete stale vectors from the index first; otherwise leftover `chunk_N` ids from the previous corpus remain.
4. Restart `npm run dev`.

For multi-PDF, multi-version, or permission-aware retrieval see Week 14B Section 4.

## Deploy to Vercel

```bash
npm i -g vercel  # if you don't have it
vercel           # first run: log in, link the project
vercel link
vercel env add OPENAI_API_KEY
vercel env add UPSTASH_VECTOR_REST_URL
vercel env add UPSTASH_VECTOR_REST_TOKEN
vercel --prod
```

You'll get a public URL like `https://rag-ui-xxx.vercel.app`. Seeding runs locally, so you only need to seed once per index no matter where the chat app is hosted.

## Common errors

| Symptom                                                  | Fix                                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Error: missing UPSTASH_VECTOR_REST_URL`                 | Set the variables in `.env.local`, then run `npm run seed`. Verify them in Upstash.     |
| Seed or query fails mentioning sparse vectors            | The index is dense-only. Create a **Hybrid** index and update the env vars.             |
| Seed fails with a dimension mismatch                     | The dense side of the index must be 1536 dimensions (`text-embedding-3-small`).         |
| Page renders but submitting hangs                        | Route handler missing `toDataStreamResponse()`. Check `route.ts`.                       |
| Empty / very short answer after a tool call              | `maxSteps` not set or too low. The final handler uses `maxSteps: 5`.                    |
| `Cannot use useChat in a Server Component`               | Forgot `'use client'` at the top of `page.tsx`.                                         |
| Build error: `Type '...' is not assignable to ...`       | Run `npx tsc --noEmit` to see the full type error.                                      |
| `vercel --prod` build fails on missing env vars          | `vercel env add ...` and pick **Production** when prompted.                             |
