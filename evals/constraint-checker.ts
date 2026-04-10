/**
 * Constraint Violation Checker
 *
 * Detects when recommendation results violate the user's
 * explicitly stated constraints (player count, time, complexity, etc.)
 */

import type { GameResult, EvalCase, ConstraintViolation } from './types';

export function checkConstraintViolations(
  results: GameResult[],
  evalCase: EvalCase,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const pc = evalCase.playerCount;
  const constraints = evalCase.constraints ?? {};

  results.forEach((game, idx) => {
    const rank = idx + 1;

    // Player count violations
    if (pc) {
      const gMin = game.minPlayers;
      const gMax = game.maxPlayers;
      if (gMin != null && gMax != null) {
        if (gMin > pc.max) {
          violations.push({
            gameId: game.id,
            gameName: game.name,
            rank,
            type: 'player-count',
            detail: `Needs ${gMin}+ players, user wants max ${pc.max}`,
          });
        }
        if (gMax < pc.min) {
          violations.push({
            gameId: game.id,
            gameName: game.name,
            rank,
            type: 'player-count',
            detail: `Max ${gMax} players, user wants min ${pc.min}`,
          });
        }
      }
    }

    // Time violations -- aligned with engine's actual hard filter logic
    // (route.ts applyHardFilters): hard = maxMinutes + 10, soft = maxMinutes * 1.25
    if (constraints.maxMinutes) {
      const gTime = game.avgPlayTime;
      if (gTime != null) {
        const limit = constraints.timeStrictness === 'hard'
          ? constraints.maxMinutes + 10
          : constraints.maxMinutes * 1.25;
        if (gTime > limit) {
          violations.push({
            gameId: game.id,
            gameName: game.name,
            rank,
            type: 'time',
            detail: `Takes ${gTime}min, limit is ${constraints.maxMinutes}min (${constraints.timeStrictness ?? 'soft'})`,
          });
        }
      }
    }

    // Complexity violations
    if (constraints.complexity) {
      const gCx = game.complexity;
      if (gCx != null) {
        if (constraints.complexity.max && gCx > constraints.complexity.max + 0.5) {
          violations.push({
            gameId: game.id,
            gameName: game.name,
            rank,
            type: 'complexity',
            detail: `Complexity ${gCx.toFixed(1)}, max requested ${constraints.complexity.max}`,
          });
        }
        if (constraints.complexity.min && gCx < constraints.complexity.min - 0.5) {
          violations.push({
            gameId: game.id,
            gameName: game.name,
            rank,
            type: 'complexity',
            detail: `Complexity ${gCx.toFixed(1)}, min requested ${constraints.complexity.min}`,
          });
        }
      }
    }

    // Game type violations
    if (evalCase.gameTypes?.length) {
      if (game.types?.length) {
        const hasMatch = game.types.some(t =>
          evalCase.gameTypes!.includes(t)
        );
        if (!hasMatch) {
          violations.push({
            gameId: game.id,
            gameName: game.name,
            rank,
            type: 'game-type',
            detail: `Game is ${game.types.join('/')}, user wants ${evalCase.gameTypes.join('/')}`,
          });
        }
      }
    }
  });

  return violations;
}
