import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../lib/http.js';

/** Shape the AI service returns for one extracted announcement. Fields not present in the source stay null. */
export const extractedSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  organizerName: z.string().nullable(),
  eventStart: z.string().nullable(),
  eventEnd: z.string().nullable(),
  registrationDeadline: z.string().nullable(),
  mode: z.string().nullable(),
  venue: z.string().nullable(),
  onlineLink: z.string().nullable(),
  eligibility: z.object({
    branches: z.array(z.string()),
    years: z.array(z.number().int()),
    minTeamSize: z.number().int().nullable(),
    maxTeamSize: z.number().int().nullable(),
    notes: z.string().nullable(),
  }),
  requiredSkills: z.array(z.string()),
  tags: z.array(z.string()),
  registrationUrl: z.string().nullable(),
  contactDetails: z.string().nullable(),
  additionalInstructions: z.string().nullable(),
  benefits: z.string().nullable(),
  targetAudience: z.string().nullable(),
  priority: z.string().nullable(),
  missingFields: z.array(z.string()),
  uncertainFields: z.array(z.string()),
});
export type Extracted = z.infer<typeof extractedSchema>;

const responseSchema = z.object({
  provider: z.enum(['llm', 'rules']),
  announcements: z.array(extractedSchema),
  splitSuggested: z.boolean(),
  notes: z.array(z.string()),
});
export type ExtractionResponse = z.infer<typeof responseSchema>;

async function callAi<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.AI_SERVICE_TOKEN ? { authorization: `Bearer ${env.AI_SERVICE_TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI service responded ${res.status}`);
    return schema.parse(await res.json());
  } catch (err) {
    // Never forward the raw AI error to the client; it can contain internal URLs.
    console.error('[ai-service]', err instanceof Error ? err.message : 'unknown error');
    throw new HttpError(503, 'The AI assistant is unavailable right now. You can fill the form manually.');
  } finally {
    clearTimeout(timer);
  }
}

export const extractAnnouncements = (text: string) => callAi('/v1/extract', { text }, responseSchema);

export const answerQuestion = (question: string, records: Record<string, unknown>[]) =>
  callAi('/v1/assistant', { question, records }, z.object({ answer: z.string(), provider: z.enum(['llm', 'rules']) }));
