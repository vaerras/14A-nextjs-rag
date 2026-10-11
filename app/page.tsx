'use client';

import { useChat } from '@ai-sdk/react';

type Source = { text?: string; page?: number; score?: number };

const SUGGESTED_PROMPTS = [
  'Draft a full Pos 1–5 team around Faceless Void with a teamfight win condition.',
  'The enemy has Phantom Lancer, Huskar, and Storm Spirit. Suggest a counter team.',
  'What are the current meta team compositions, and how do I beat them?',
];

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit, append, status, error } = useChat({
    api: '/api/chat',
  });
  const busy = status === 'streaming' || status === 'submitted';

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dota 2 Team Drafter</h1>
        <p className="text-sm text-slate-500">
          Draft teams, find counter picks, and explore meta compositions. Sources from the hero
          corpus appear under each answer.
        </p>
      </header>

      {messages.length === 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-slate-700 mb-2">Get started</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={busy}
                onClick={() => append({ role: 'user', content: prompt })}
                className="text-left text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 hover:border-cyan-500 disabled:opacity-40"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>
      )}

      <ul className="space-y-4 mb-6 min-h-[200px]">
        {messages.map((m) => (
          <li
            key={m.id}
            className={
              m.role === 'user'
                ? 'flex justify-end'
                : 'flex justify-start flex-col items-start'
            }
          >
            <span
              className={
                m.role === 'user'
                  ? 'inline-block rounded-2xl bg-cyan-600 text-white px-4 py-2 max-w-[85%]'
                  : 'inline-block rounded-2xl bg-white border border-slate-200 px-4 py-2 max-w-[85%]'
              }
            >
              {m.content}
            </span>

            {m.role === 'assistant' &&
              m.toolInvocations?.map(
                (inv) =>
                  inv.state === 'result' &&
                  inv.toolName === 'getInformation' && (
                    <details
                      key={inv.toolCallId}
                      className="mt-2 text-sm text-slate-600 max-w-[85%]"
                    >
                      <summary className="cursor-pointer">
                        Sources ({(inv.result as Source[]).length})
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {(inv.result as Source[]).map((src, i) => (
                          <li
                            key={i}
                            className="border-l-2 border-cyan-500 pl-3"
                          >
                            <span className="text-xs text-slate-400">
                              page {src.page ?? '?'} · score{' '}
                              {typeof src.score === 'number'
                                ? src.score.toFixed(2)
                                : '—'}
                            </span>
                            <p>{src.text}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ),
              )}
          </li>
        ))}
        {status === 'streaming' && (
          <li className="text-sm text-slate-400">…</li>
        )}
        {error && (
          <li className="text-sm text-rose-600">
            Error: {error.message}
          </li>
        )}
      </ul>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
          placeholder="Draft a team, name enemy heroes to counter, or ask about the meta…"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={!input || busy}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </main>
  );
}
