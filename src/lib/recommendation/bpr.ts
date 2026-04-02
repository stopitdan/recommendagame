/**
 * Bayesian Personalized Ranking (BPR)
 *
 * Implementation of Rendle et al. (UAI 2009) "BPR: Bayesian Personalized
 * Ranking from Implicit Feedback" for learning user-item preference
 * rankings from implicit feedback (thumbs up/down).
 *
 * Core idea: learn latent factor vectors for users and items such that
 * the user's dot product with liked items is higher than with disliked items.
 *
 * Algorithm:
 *   For each epoch:
 *     For each (user, positive_item, negative_item) triple:
 *       x_uij = dot(user[u], item[i]) - dot(user[u], item[j])
 *       gradient = sigmoid(-x_uij)
 *       user[u]  += lr * (gradient * (item[i] - item[j]) - reg * user[u])
 *       item[i]  += lr * (gradient * user[u] - reg * item[i])
 *       item[j]  += lr * (-gradient * user[u] - reg * item[j])
 *
 * Usage:
 *   const model = new BPRModel(64);
 *   model.train(feedbackData, { epochs: 50, lr: 0.01 });
 *   const score = model.predict(userId, gameId);
 */

// ─── Types ───────────────────────────────────────────────────

export interface FeedbackEntry {
  userId: string;
  gameId: string;
  /** 1 = positive (liked), -1 = negative (disliked) */
  rating: 1 | -1;
}

export interface BPRConfig {
  /** Number of latent factors (default: 64) */
  factors: number;
  /** Learning rate (default: 0.01) */
  lr: number;
  /** L2 regularization strength (default: 0.01) */
  reg: number;
  /** Number of training epochs (default: 50) */
  epochs: number;
  /** Number of negative samples per positive (default: 5) */
  negSamples: number;
}

const DEFAULT_CONFIG: BPRConfig = {
  factors: 64,
  lr: 0.01,
  reg: 0.01,
  epochs: 50,
  negSamples: 5,
};

// ─── BPR Model ──────────────────────────────────────────────

export class BPRModel {
  private userFactors: Map<string, Float64Array> = new Map();
  private itemFactors: Map<string, Float64Array> = new Map();
  private config: BPRConfig;
  private allItemIds: string[] = [];

  constructor(config: Partial<BPRConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Train the model on implicit feedback data.
   *
   * @param feedback Array of user-item feedback entries
   * @param onEpoch Optional callback for progress reporting
   */
  train(
    feedback: FeedbackEntry[],
    onEpoch?: (epoch: number, loss: number) => void,
  ): void {
    if (feedback.length === 0) return;

    // Build data structures
    const userPositives = new Map<string, Set<string>>();
    const userNegatives = new Map<string, Set<string>>();
    const allItems = new Set<string>();
    const allUsers = new Set<string>();

    for (const f of feedback) {
      allUsers.add(f.userId);
      allItems.add(f.gameId);

      if (f.rating === 1) {
        if (!userPositives.has(f.userId)) userPositives.set(f.userId, new Set());
        userPositives.get(f.userId)!.add(f.gameId);
      } else {
        if (!userNegatives.has(f.userId)) userNegatives.set(f.userId, new Set());
        userNegatives.get(f.userId)!.add(f.gameId);
      }
    }

    this.allItemIds = [...allItems];

    // Initialize factor vectors (Xavier initialization)
    const scale = Math.sqrt(2.0 / this.config.factors);
    for (const userId of allUsers) {
      if (!this.userFactors.has(userId)) {
        this.userFactors.set(userId, randomVector(this.config.factors, scale));
      }
    }
    for (const itemId of allItems) {
      if (!this.itemFactors.has(itemId)) {
        this.itemFactors.set(itemId, randomVector(this.config.factors, scale));
      }
    }

    // SGD training
    const { lr, reg, epochs, negSamples } = this.config;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let epochLoss = 0;
      let updates = 0;

      // For each user with positive feedback
      for (const [userId, positives] of userPositives) {
        const userVec = this.userFactors.get(userId)!;
        const negatives = userNegatives.get(userId) ?? new Set<string>();

        for (const posItemId of positives) {
          const posVec = this.itemFactors.get(posItemId)!;

          // Sample negative items (items the user hasn't liked)
          for (let s = 0; s < negSamples; s++) {
            // Priority: use explicitly disliked items first, then random unrated items
            let negItemId: string;
            if (negatives.size > 0 && Math.random() < 0.5) {
              const negArr = [...negatives];
              negItemId = negArr[Math.floor(Math.random() * negArr.length)];
            } else {
              // Random item not in positives
              let attempts = 0;
              do {
                negItemId = this.allItemIds[Math.floor(Math.random() * this.allItemIds.length)];
                attempts++;
              } while (positives.has(negItemId) && attempts < 10);
            }

            const negVec = this.itemFactors.get(negItemId);
            if (!negVec) continue;

            // BPR update step
            const x_uij = dot(userVec, posVec) - dot(userVec, negVec);
            const gradient = sigmoid(-x_uij);

            epochLoss += -Math.log(sigmoid(x_uij) + 1e-10);
            updates++;

            // Update vectors
            for (let f = 0; f < this.config.factors; f++) {
              const userGrad = gradient * (posVec[f] - negVec[f]) - reg * userVec[f];
              const posGrad = gradient * userVec[f] - reg * posVec[f];
              const negGrad = -gradient * userVec[f] - reg * negVec[f];

              userVec[f] += lr * userGrad;
              posVec[f] += lr * posGrad;
              negVec[f] += lr * negGrad;
            }
          }
        }
      }

      if (onEpoch) {
        onEpoch(epoch + 1, updates > 0 ? epochLoss / updates : 0);
      }
    }
  }

  /**
   * Predict preference score for a user-item pair.
   * Higher scores = more likely to be preferred.
   */
  predict(userId: string, itemId: string): number {
    const userVec = this.userFactors.get(userId);
    const itemVec = this.itemFactors.get(itemId);
    if (!userVec || !itemVec) return 0;
    return dot(userVec, itemVec);
  }

  /**
   * Get top-N recommendations for a user (excluding already-rated items).
   */
  recommend(
    userId: string,
    candidateIds: string[],
    excludeIds: Set<string> = new Set(),
    limit: number = 20,
  ): { gameId: string; score: number }[] {
    const userVec = this.userFactors.get(userId);
    if (!userVec) return [];

    const scores: { gameId: string; score: number }[] = [];
    for (const itemId of candidateIds) {
      if (excludeIds.has(itemId)) continue;
      const itemVec = this.itemFactors.get(itemId);
      if (!itemVec) continue;
      scores.push({ gameId: itemId, score: dot(userVec, itemVec) });
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Serialize model to JSON for storage.
   */
  serialize(): string {
    const data = {
      config: this.config,
      users: Object.fromEntries(
        [...this.userFactors].map(([k, v]) => [k, Array.from(v)])
      ),
      items: Object.fromEntries(
        [...this.itemFactors].map(([k, v]) => [k, Array.from(v)])
      ),
    };
    return JSON.stringify(data);
  }

  /**
   * Deserialize model from JSON.
   */
  static deserialize(json: string): BPRModel {
    const data = JSON.parse(json);
    const model = new BPRModel(data.config);
    for (const [k, v] of Object.entries(data.users as Record<string, number[]>)) {
      model.userFactors.set(k, new Float64Array(v));
    }
    for (const [k, v] of Object.entries(data.items as Record<string, number[]>)) {
      model.itemFactors.set(k, new Float64Array(v));
    }
    model.allItemIds = [...model.itemFactors.keys()];
    return model;
  }

  /** Number of users in the model */
  get userCount(): number { return this.userFactors.size; }
  /** Number of items in the model */
  get itemCount(): number { return this.itemFactors.size; }
}

// ─── Math Helpers ───────────────────────────────────────────

function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function randomVector(size: number, scale: number): Float64Array {
  const vec = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    vec[i] = (Math.random() * 2 - 1) * scale;
  }
  return vec;
}
