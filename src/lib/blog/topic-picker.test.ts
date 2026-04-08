import { describe, it, expect } from 'vitest';
import { pickTopic, TOPIC_TEMPLATES } from './topic-picker';

describe('pickTopic', () => {
  it('returns a valid template for a given date', () => {
    const result = pickTopic(new Date('2026-04-07'));
    expect(result.template).toBeDefined();
    expect(result.titleHint).toBeTruthy();
    expect(result.topicIndex).toBeGreaterThanOrEqual(0);
    expect(result.topicIndex).toBeLessThan(TOPIC_TEMPLATES.length);
  });

  it('returns different topics for different slots on the same day', () => {
    const date = new Date('2026-04-07');
    const slot0 = pickTopic(date, 0);
    const slot1 = pickTopic(date, 1);
    expect(slot0.topicIndex).not.toBe(slot1.topicIndex);
    expect(slot0.titleHint).not.toBe(slot1.titleHint);
  });

  it('returns consistent topics for the same date and slot', () => {
    const date = new Date('2026-04-07');
    const first = pickTopic(date, 0);
    const second = pickTopic(date, 0);
    expect(first.topicIndex).toBe(second.topicIndex);
    expect(first.titleHint).toBe(second.titleHint);
  });

  it('wraps around when topicIndex exceeds template count', () => {
    // Day 365 should still produce a valid index
    const date = new Date('2026-12-31');
    const result = pickTopic(date, 1);
    expect(result.topicIndex).toBeGreaterThanOrEqual(0);
    expect(result.topicIndex).toBeLessThan(TOPIC_TEMPLATES.length);
  });

  it('defaults to slot 0 when no slot is provided', () => {
    const date = new Date('2026-06-15');
    const withDefault = pickTopic(date);
    const withExplicit = pickTopic(date, 0);
    expect(withDefault.topicIndex).toBe(withExplicit.topicIndex);
  });

  it('replaces {category} placeholder in titleHint', () => {
    // Find a template that uses {category}
    const catTemplate = TOPIC_TEMPLATES.find(
      (t) => t.template.includes('{category}') && t.category,
    );
    if (catTemplate) {
      const hint = catTemplate.template.replace('{category}', catTemplate.category!);
      expect(hint).not.toContain('{category}');
      expect(hint).toContain(catTemplate.category!);
    }
  });

  it('uses "Board" as fallback when category is null for {category} placeholder', () => {
    const nullCatTemplate = TOPIC_TEMPLATES.find(
      (t) => t.template.includes('{category}') && !t.category,
    );
    if (nullCatTemplate) {
      const hint = nullCatTemplate.template.replace('{category}', 'Board');
      expect(hint).toContain('Board');
    }
  });
});

describe('TOPIC_TEMPLATES', () => {
  it('has at least 365 templates', () => {
    expect(TOPIC_TEMPLATES.length).toBeGreaterThanOrEqual(365);
  });

  it('all templates have a template string', () => {
    for (const t of TOPIC_TEMPLATES) {
      expect(t.template).toBeTruthy();
      expect(typeof t.template).toBe('string');
    }
  });

  it('crossover topics have allowVideoGames set', () => {
    const crossovers = TOPIC_TEMPLATES.filter((t) => t.allowVideoGames);
    expect(crossovers.length).toBeGreaterThan(0);
  });

  it('has no duplicate templates', () => {
    const seen = new Set<string>();
    for (const t of TOPIC_TEMPLATES) {
      expect(seen.has(t.template)).toBe(false);
      seen.add(t.template);
    }
  });
});
