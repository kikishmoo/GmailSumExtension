import { normalizeSummaryOutput } from '../summarizer.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';

export async function summarizeWithOpenAI({ apiKey, model = 'gpt-4o-mini', threads = [] } = {}) {
  if (!apiKey) {
    return null;
  }

  const prompt = [
    'Summarize these Gmail threads as JSON only.',
    'Schema: {"summaryText":string,"highPriority":string[],"actionItems":string[],"threadsIncluded":number}',
    JSON.stringify(threads),
  ].join('\n\n');

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const payload = await response.json();
  const rawText = payload?.output?.[0]?.content?.[0]?.text;
  if (!rawText) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawText);
    return normalizeSummaryOutput({ ...parsed, source: 'openai' }, threads.length);
  } catch (_err) {
    return null;
  }
}
