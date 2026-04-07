/**
 * Quality Evaluation Gate
 *
 * Scores a blog post on 5 dimensions (0-10 each).
 * Posts below 7.0 average are flagged. Below 5.0 are auto-rejected.
 */

import type OpenAI from 'openai';
import type { BlogGameRow, QualityReport } from './types';
import { MODELS } from '@/lib/llm/models';

export async function evaluateQuality(
  openai: OpenAI,
  content: string,
  title: string,
  description: string,
  games: BlogGameRow[],
): Promise<QualityReport> {
  const gameNames = games
    .filter((g) => content.toLowerCase().includes(g.name.toLowerCase()))
    .map((g) => g.name);

  const response = await openai.chat.completions.create({
    model: MODELS.blogAnalysis,
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Score this blog post on 5 dimensions (0-10 each). Be strict.

## Title
${title}

## Meta Description
${description}

## Content
${content}

## Games Referenced in Our Database
${gameNames.join(', ') || 'None found'}

## Scoring Rubric

**accuracy** (0-10): Are game descriptions accurate? Do the games genuinely fit the topic? Are stats like player counts and play times reasonable?

**readability** (0-10): Short paragraphs (2-3 sentences)? Clear H2 structure? Good flow between sections? Easy to scan?

**tone** (0-10): Sounds like a real person wrote it? No generic AI phrases ("dive into", "elevate", "game-changer")? No em-dashes? Playful but not cringey? Has real opinions, not wishy-washy "many consider this good"?

**seo** (0-10): Title under 65 chars with keyword? Meta description under 155 chars? Primary keyword in first 100 words? Internal links present? Affiliate links present?

**completeness** (0-10): At least 4 games featured with 2-3 sentences each? CTA to /find-a-game? Enough depth to be useful? Would a reader find this helpful?

Respond with JSON:
{
  "accuracy": N,
  "readability": N,
  "tone": N,
  "seo": N,
  "completeness": N,
  "feedback": "One sentence of the biggest issue, if any"
}`,
    }],
  });

  const raw = response.choices[0]?.message?.content;

  let scores = { accuracy: 5, readability: 5, tone: 5, seo: 5, completeness: 5 };
  let feedback = 'Could not parse quality evaluation';

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      scores = {
        accuracy: Math.min(10, Math.max(0, Number(parsed.accuracy) || 5)),
        readability: Math.min(10, Math.max(0, Number(parsed.readability) || 5)),
        tone: Math.min(10, Math.max(0, Number(parsed.tone) || 5)),
        seo: Math.min(10, Math.max(0, Number(parsed.seo) || 5)),
        completeness: Math.min(10, Math.max(0, Number(parsed.completeness) || 5)),
      };
      feedback = parsed.feedback ?? '';
    } catch {
      // Use defaults
    }
  }

  const average = Object.values(scores).reduce((a, b) => a + b, 0) / 5;

  return {
    scores,
    average: Math.round(average * 10) / 10,
    passed: average >= 5.0,
    feedback,
  };
}
