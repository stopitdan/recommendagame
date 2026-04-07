/**
 * Triple Edit Sequence
 *
 * Edit 1: Structure and SEO (mostly code, LLM for fixes)
 * Edit 2: Tone and voice (code detection + LLM cleanup)
 * Edit 3: Mechanical cleanup (pure code, no LLM)
 */

import type OpenAI from 'openai';
import type { EditResult } from './types';
import { MODELS } from '@/lib/llm/models';

// ── Blocklists ──────────────────────────────────────────────

const AI_PHRASES = [
  'dive into', 'dive in', 'deep dive', 'delve into',
  'elevate your', 'elevate the',
  'game-changer', 'game changer',
  'whether you\'re a seasoned', 'whether you are a seasoned',
  'in the world of', 'in today\'s world',
  'look no further', 'search no further',
  'without further ado',
  'take your .* to the next level',
  'a must-have for any',
  'it\'s worth noting', 'it is worth noting',
  'it goes without saying',
  'at the end of the day',
  'in conclusion',
  'all in all',
  'when it comes to',
  'if you\'re looking for',
  'you won\'t be disappointed',
  'has something for everyone',
  'stands out from the crowd',
  'a breath of fresh air',
  'the cherry on top',
  'offers a unique blend',
  'seamlessly blends',
  'testament to',
  'in this article',
  'let\'s explore',
  'buckle up',
  'strap in',
];

const CRINGEY_ENTHUSIASM = [
  'absolutely incredible',
  'you won\'t believe',
  'mind-blowing',
  'jaw-dropping',
  'you need this in your life',
  'the ultimate',
  'a true masterpiece',
  'nothing short of',
];

// ── Edit 1: Structure and SEO (code checks) ────────────────

function checkStructure(content: string): string[] {
  const issues: string[] = [];

  // Word count
  const words = content.split(/\s+/).length;
  if (words < 800) issues.push(`Too short: ${words} words (target 1000-1500)`);
  if (words > 2000) issues.push(`Too long: ${words} words (target 1000-1500)`);

  // H2 headings
  const h2s = (content.match(/^## /gm) || []).length;
  if (h2s < 3) issues.push(`Only ${h2s} H2 headings (need at least 3-4)`);

  // Internal links to /find-a-game
  if (!content.includes('/find-a-game')) {
    issues.push('Missing CTA link to /find-a-game');
  }

  // Amazon affiliate links
  const amazonLinks = (content.match(/amazon\.com/g) || []).length;
  if (amazonLinks < 2) {
    issues.push(`Only ${amazonLinks} Amazon affiliate links (need at least 3-4)`);
  }

  // Check for very long paragraphs (more than 4 sentences)
  const paragraphs = content.split(/\n\n+/);
  let longParas = 0;
  for (const p of paragraphs) {
    if (p.startsWith('#') || p.startsWith('-') || p.startsWith('|') || p.startsWith('<')) continue;
    const sentences = p.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    if (sentences.length > 4) longParas++;
  }
  if (longParas > 2) {
    issues.push(`${longParas} paragraphs with 5+ sentences (keep to 2-3 sentences)`);
  }

  return issues;
}

// ── Edit 2: Tone and Voice (code detection) ─────────────────

function checkTone(content: string): string[] {
  const issues: string[] = [];
  const lower = content.toLowerCase();

  // AI phrases
  for (const phrase of AI_PHRASES) {
    const regex = new RegExp(phrase, 'gi');
    if (regex.test(lower)) {
      issues.push(`AI phrase detected: "${phrase}"`);
    }
  }

  // Cringey enthusiasm
  for (const phrase of CRINGEY_ENTHUSIASM) {
    if (lower.includes(phrase)) {
      issues.push(`Cringey phrase: "${phrase}"`);
    }
  }

  // Paragraphs starting with "So," or "Now,"
  const paraStarts = content.match(/(?:^|\n\n)(So,|Now,)/g);
  if (paraStarts) {
    issues.push(`${paraStarts.length} paragraph(s) start with "So," or "Now,"`);
  }

  return issues;
}

// ── Edit 3: Mechanical Cleanup (pure code) ──────────────────

function mechanicalCleanup(content: string): { content: string; edits: string[] } {
  let result = content;
  const edits: string[] = [];

  // Replace em-dashes with appropriate alternatives
  const emDashCount = (result.match(/\u2014/g) || []).length;
  if (emDashCount > 0) {
    // Replace em-dash between words with comma or parenthetical
    result = result.replace(/\s*\u2014\s*/g, ', ');
    edits.push(`Replaced ${emDashCount} em-dash(es)`);
  }

  // Replace en-dashes used as em-dashes (between spaces)
  const enDashCount = (result.match(/\s\u2013\s/g) || []).length;
  if (enDashCount > 0) {
    result = result.replace(/\s\u2013\s/g, ', ');
    edits.push(`Replaced ${enDashCount} en-dash(es) used as em-dashes`);
  }

  // Replace double hyphens used as dashes
  const doubleHyphen = (result.match(/\s--\s/g) || []).length;
  if (doubleHyphen > 0) {
    result = result.replace(/\s--\s/g, ', ');
    edits.push(`Replaced ${doubleHyphen} double-hyphen(s)`);
  }

  // Remove excessive exclamation marks
  const multiExclaim = (result.match(/!{2,}/g) || []).length;
  if (multiExclaim > 0) {
    result = result.replace(/!{2,}/g, '!');
    edits.push(`Normalized ${multiExclaim} multiple exclamation marks`);
  }

  return { content: result, edits };
}

// ── LLM Fix Pass (only if issues found) ─────────────────────

async function llmFixIssues(
  openai: OpenAI,
  content: string,
  issues: string[],
): Promise<string> {
  if (issues.length === 0) return content;

  const response = await openai.chat.completions.create({
    model: MODELS.blogAnalysis,
    temperature: 0.3,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Fix the following issues in this blog post. Change ONLY what's needed to fix these specific issues. Preserve all facts, links, formatting, and style.

## Issues to fix
${issues.map((i) => `- ${i}`).join('\n')}

## Blog post
${content}

Return the fixed blog post content only. No commentary.`,
    }],
  });

  return response.choices[0]?.message?.content ?? content;
}

// ── Main Export ──────────────────────────────────────────────

export async function editDraft(
  openai: OpenAI,
  content: string,
): Promise<EditResult> {
  const allEdits: string[] = [];

  // Edit 1: Structure and SEO
  const structureIssues = checkStructure(content);
  let edited = content;
  if (structureIssues.length > 0) {
    edited = await llmFixIssues(openai, edited, structureIssues);
    allEdits.push(...structureIssues.map((i) => `[structure] ${i}`));
  }

  // Edit 2: Tone and voice
  const toneIssues = checkTone(edited);
  if (toneIssues.length > 0) {
    edited = await llmFixIssues(openai, edited, toneIssues);
    allEdits.push(...toneIssues.map((i) => `[tone] ${i}`));
  }

  // Edit 3: Mechanical cleanup (pure code, no LLM)
  const { content: cleaned, edits: mechEdits } = mechanicalCleanup(edited);
  allEdits.push(...mechEdits.map((e) => `[mechanical] ${e}`));

  return { content: cleaned, edits: allEdits };
}
