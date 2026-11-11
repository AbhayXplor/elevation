export const config = { runtime: 'edge' }

/**
 * Turns the numbers already on the borrower page into one plain-English
 * paragraph. The browser never sees the key, and the prompt forbids the model
 * from producing any figure that was not handed to it.
 */

// Tried in order; the first model that exists and answers wins.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']

type Facts = Record<string, unknown> & {
  borrower?: { name?: string }
  clause?: string
}

const SYSTEM = `You explain a climate-risk screen to a UAE bank credit officer.

Write exactly three sentences of plain professional English. No bullets, no headings, no preamble.

Rules:
- Use ONLY the facts given. Never invent, estimate, convert or derive a number, name or place.
- Quote at most two numbers, exactly as written in the facts.
- Sentence 1: what this borrower is exposed to, and where.
- Sentence 2: the financial consequence, using the terms given.
- Sentence 3: the regulatory clause it supports, named as given.
- If a fact is missing, say it is missing rather than guessing.`

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function callGemini(model: string, key: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 300 },
      }),
    })
  } catch {
    return { error: 'network', retry: false as const }
  }

  if (res.status === 404) return { error: 'model-missing', retry: true as const }
  if (!res.ok) return { error: `upstream-${res.status}`, retry: false as const }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim()

  if (!text) return { error: 'empty', retry: false as const }
  return { text, retry: false as const }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = process.env.GEMINI_API_KEY
  if (!key) return json({ error: 'GEMINI_API_KEY is not configured' }, 503)

  let facts: Facts
  try {
    facts = (await req.json()) as Facts
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (!facts?.borrower?.name) return json({ error: 'Missing borrower facts' }, 400)
  const serialised = JSON.stringify(facts)
  if (serialised.length > 4000) return json({ error: 'Facts too large' }, 413)

  const prompt = `Facts about one borrower:\n\n${serialised}\n\nWrite the three sentences.`

  for (const model of MODELS) {
    const out = await callGemini(model, key, prompt)
    if ('text' in out) return json({ text: out.text, model }, 200)
    if (!out.retry) return json({ error: out.error }, 502)
  }

  return json({ error: 'No supported model answered' }, 502)
}
