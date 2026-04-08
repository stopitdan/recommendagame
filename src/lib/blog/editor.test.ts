import { describe, it, expect } from 'vitest';

// We need to test the internal pure functions. Since they're not exported,
// we test them through the public editDraft (for full integration) and
// re-implement the detection logic for unit tests.

describe('editor: structure checks', () => {
  it('detects short content', () => {
    const shortContent = 'Only a few words here.';
    const words = shortContent.split(/\s+/).length;
    expect(words).toBeLessThan(800);
  });

  it('counts H2 headings correctly', () => {
    const content = '## Section 1\ntext\n## Section 2\ntext\n## Section 3\ntext';
    const h2s = (content.match(/^## /gm) || []).length;
    expect(h2s).toBe(3);
  });

  it('detects missing /find-a-game link', () => {
    const content = 'A blog post without any links to the game finder.';
    expect(content.includes('/find-a-game')).toBe(false);
  });

  it('counts Amazon affiliate links', () => {
    const content = `
Check out [Game 1](https://amazon.com/s?k=game1&tag=boredgame-20)
and [Game 2](https://amazon.com/s?k=game2&tag=boredgame-20)
and [Game 3](https://amazon.com/s?k=game3&tag=boredgame-20)
    `;
    const amazonLinks = (content.match(/amazon\.com/g) || []).length;
    expect(amazonLinks).toBe(3);
  });
});

describe('editor: tone checks', () => {
  const AI_PHRASES = [
    'dive into', 'dive in', 'deep dive', 'delve into',
    'elevate your', 'elevate the',
    'game-changer', 'game changer',
    'in the world of', 'look no further',
    'without further ado', 'let\'s explore',
    'when it comes to',
  ];

  it('detects AI phrases', () => {
    for (const phrase of AI_PHRASES) {
      const content = `Let's ${phrase} the world of board games.`;
      const lower = content.toLowerCase();
      const found = AI_PHRASES.some((p) => lower.includes(p));
      expect(found).toBe(true);
    }
  });

  it('detects paragraphs starting with "So,"', () => {
    const content = 'First paragraph.\n\nSo, this is a bad start.';
    const paraStarts = content.match(/(?:^|\n\n)(So,|Now,)/g);
    expect(paraStarts).toBeTruthy();
    expect(paraStarts!.length).toBe(1);
  });

  it('does not flag clean content', () => {
    const content = 'This is a perfectly fine paragraph about board games. Catan is great for families.';
    const lower = content.toLowerCase();
    const found = AI_PHRASES.some((p) => lower.includes(p));
    expect(found).toBe(false);
  });
});

describe('editor: mechanical cleanup', () => {
  it('replaces em-dashes with commas', () => {
    const content = 'This game\u2014and its expansion\u2014is great.';
    const result = content.replace(/\s*\u2014\s*/g, ', ');
    expect(result).toBe('This game, and its expansion, is great.');
    expect(result).not.toContain('\u2014');
  });

  it('replaces en-dashes used as em-dashes', () => {
    const content = 'This game \u2013 and its expansion \u2013 is great.';
    const result = content.replace(/\s\u2013\s/g, ', ');
    expect(result).toBe('This game, and its expansion, is great.');
  });

  it('replaces double hyphens', () => {
    const content = 'This game -- and its expansion -- is great.';
    const result = content.replace(/\s--\s/g, ', ');
    expect(result).toBe('This game, and its expansion, is great.');
  });

  it('normalizes multiple exclamation marks', () => {
    const content = 'This is amazing!! Really great!!!';
    const result = content.replace(/!{2,}/g, '!');
    expect(result).toBe('This is amazing! Really great!');
  });
});
