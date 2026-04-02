/**
 * Tests for BPR (Bayesian Personalized Ranking) model.
 *
 * Verifies:
 * - Training converges (loss decreases)
 * - Positive items score higher than negative items after training
 * - Serialization/deserialization preserves predictions
 * - Edge cases (empty data, single user)
 */

import { describe, it, expect } from 'vitest';
import { BPRModel, type FeedbackEntry } from './bpr';

describe('BPRModel', () => {
  // Generate simple synthetic data: 3 users, 10 items
  function makeFeedback(): FeedbackEntry[] {
    return [
      // User A likes items 1, 2, 3 (strategy games)
      { userId: 'userA', gameId: 'item1', rating: 1 },
      { userId: 'userA', gameId: 'item2', rating: 1 },
      { userId: 'userA', gameId: 'item3', rating: 1 },
      { userId: 'userA', gameId: 'item7', rating: -1 },
      { userId: 'userA', gameId: 'item8', rating: -1 },

      // User B likes items 1, 4, 5 (overlaps with A on item1)
      { userId: 'userB', gameId: 'item1', rating: 1 },
      { userId: 'userB', gameId: 'item4', rating: 1 },
      { userId: 'userB', gameId: 'item5', rating: 1 },
      { userId: 'userB', gameId: 'item9', rating: -1 },

      // User C likes items 2, 3, 6 (overlaps with A on items 2, 3)
      { userId: 'userC', gameId: 'item2', rating: 1 },
      { userId: 'userC', gameId: 'item3', rating: 1 },
      { userId: 'userC', gameId: 'item6', rating: 1 },
      { userId: 'userC', gameId: 'item10', rating: -1 },
    ];
  }

  it('training reduces loss over epochs', () => {
    const model = new BPRModel({ factors: 16, epochs: 20, lr: 0.05 });
    const losses: number[] = [];

    model.train(makeFeedback(), (epoch, loss) => {
      losses.push(loss);
    });

    // Loss should generally decrease (allow some noise)
    const firstThird = losses.slice(0, 7).reduce((a, b) => a + b) / 7;
    const lastThird = losses.slice(-7).reduce((a, b) => a + b) / 7;
    expect(lastThird).toBeLessThan(firstThird);
  });

  it('positive items score higher than negative items after training', () => {
    const model = new BPRModel({ factors: 32, epochs: 50, lr: 0.05, negSamples: 10 });
    model.train(makeFeedback());

    // For user A: liked items (1,2,3) should score higher than disliked (7,8)
    const posScore = model.predict('userA', 'item1');
    const negScore = model.predict('userA', 'item7');
    expect(posScore).toBeGreaterThan(negScore);
  });

  it('recommend returns items sorted by score', () => {
    const model = new BPRModel({ factors: 32, epochs: 50, lr: 0.05 });
    model.train(makeFeedback());

    const recs = model.recommend(
      'userA',
      ['item1', 'item2', 'item3', 'item4', 'item5', 'item6', 'item7', 'item8'],
      new Set(['item1', 'item2', 'item3']), // exclude already-liked
      5,
    );

    // Should return recommendations sorted by score
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });

  it('serialization preserves predictions', () => {
    const model = new BPRModel({ factors: 16, epochs: 30, lr: 0.05 });
    model.train(makeFeedback());

    const scoreBefore = model.predict('userA', 'item1');
    const json = model.serialize();

    const restored = BPRModel.deserialize(json);
    const scoreAfter = restored.predict('userA', 'item1');

    expect(scoreAfter).toBeCloseTo(scoreBefore, 10);
  });

  it('handles empty feedback gracefully', () => {
    const model = new BPRModel({ factors: 8, epochs: 5 });
    model.train([]);
    expect(model.userCount).toBe(0);
    expect(model.itemCount).toBe(0);
    expect(model.predict('nobody', 'nothing')).toBe(0);
  });

  it('predict returns 0 for unknown users/items', () => {
    const model = new BPRModel({ factors: 8, epochs: 5 });
    model.train(makeFeedback());
    expect(model.predict('unknownUser', 'item1')).toBe(0);
    expect(model.predict('userA', 'unknownItem')).toBe(0);
  });

  it('tracks user and item counts', () => {
    const model = new BPRModel({ factors: 8, epochs: 5 });
    model.train(makeFeedback());
    expect(model.userCount).toBe(3); // userA, userB, userC
    expect(model.itemCount).toBe(10); // item1-10
  });
});
