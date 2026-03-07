import { normalizeSummaryOutput } from '../summarizer.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';

function extractResponseText(payload = {}) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  const contentItems = payload?.output?.flatMap((entry) => entry?.content ?? []) ?? [];
  const firstText = contentItems.find((item) => typeof item?.text === 'string' && item.text.trim());
  return firstText?.text ?? '';
}

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
  const rawText = extractResponseText(payload);
  if (!rawText) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawText);
    return normalizeSummaryOutput(parsed, threads.length);
  } catch (_err) {
    return null;
  }
}
