/**
 * Final Route Handler — Step 4 of Section 4 (RAG-as-tool-call) +
 * the source metadata used by Step 5's UI.
 *
 * The model decides whether to call the getInformation tool. When it does,
 * the tool runs vector search and returns chunk text + page + score. The
 * client renders those as collapsible sources under the assistant message.
 */
import { openai } from '@ai-sdk/openai';
import { streamText, tool, embed } from 'ai';
import { Index, WeightingStrategy, FusionAlgorithm } from '@upstash/vector';
import { z } from 'zod';
import { querySparseVector } from '@/lib/sparse';

const index = new Index();

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: `You are Dota 2 Team Drafter, an expert Dota 2 drafting assistant.
Your knowledge base is the Dota 2 Hero Corpus: every hero's primary attribute,
positions (Pos 1 Hard Carry, Pos 2 Mid, Pos 3 Offlane, Pos 4 Soft Support,
Pos 5 Hard Support), power spikes, signature mechanics, counter tags and
synergies, plus reference team compositions with win conditions.

You help with three things:
1. DRAFT TEAMS — Build a full 5-hero lineup (Pos 1 through Pos 5) around the
   user's request (a hero, a playstyle, or a win condition). For each pick,
   give the position, why it fits, and its power spike. End with the team's
   win condition and what it is weak against.
2. SUGGEST COUNTER TEAMS — Given enemy heroes or an enemy lineup, recommend
   counter picks by position. Use the "Counters" and "Countered by" tags to
   justify each pick, and name key counter items (e.g. Silver Edge for Break,
   MKB vs evasion, BKB vs magic burst).
3. CURRENT META TEAMS — Describe the strong team compositions in the corpus
   (e.g. Wombot Combo, Fast Push Deathball), including each lineup, its win
   condition, and what counters it. The corpus is not tied to a specific
   patch, so say that live win rates and patch changes may differ.

Rules:
- Always call the getInformation tool before answering a drafting question,
  and look up each hero you plan to recommend. Search more than once when
  needed (e.g. once for the enemy heroes, once for counters).
- Base your answers on the retrieved corpus. If a hero or detail is not in
  the corpus, say so plainly instead of guessing.
- Format drafts as a list: "Pos N — Hero: reason (power spike)". Keep
  explanations short and practical.
- Only answer Dota 2 drafting questions. Politely redirect anything else.`,
    messages,
    tools: {
      getInformation: tool({
        description:
          'Search the Dota 2 Hero Corpus. Returns hero positions, power spikes, signature mechanics, counter tags, synergies, and reference team compositions. Use this for every drafting, counter-pick, or meta question.',
        parameters: z.object({
          query: z
            .string()
            .describe(
              'a hero name, position, mechanic, counter tag, or team composition to search for',
            ),
        }),
        execute: async ({ query }) => {
          const { embedding } = await embed({
            model: openai.embedding('text-embedding-3-small'),
            value: query,
          });
          // Hybrid search: dense (semantic) + sparse (BM25 keyword), merged with RRF.
          const hits = await index.query({
            vector: embedding,
            sparseVector: querySparseVector(query),
            weightingStrategy: WeightingStrategy.IDF,
            fusionAlgorithm: FusionAlgorithm.RRF,
            topK: 4,
            includeMetadata: true,
          });
          return hits.map((h) => ({
            text: (h.metadata?.text as string) ?? '',
            page: (h.metadata?.page as number) ?? null,
            score: h.score,
          }));
        },
      }),
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
