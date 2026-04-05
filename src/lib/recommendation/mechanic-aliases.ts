/**
 * BGG Mechanic Alias Map
 *
 * BGG uses non-standard mechanic names that don't match what users
 * or LLMs say. "Deck Building" in user-speak is "Deck, Bag, and Pool Building"
 * in BGG. This map bridges the vocabulary gap.
 *
 * Used by:
 * - route.ts for candidate fetching (tag expansion)
 * - scoring.ts for mechanic match scoring
 */

export const BGG_MECHANIC_ALIASES: Record<string, string[]> = {
  'deck building': ['Deck, Bag, and Pool Building', 'Deck Building'],
  'deck builder': ['Deck, Bag, and Pool Building', 'Deck Building'],
  'deckbuilding': ['Deck, Bag, and Pool Building', 'Deck Building'],
  'bag building': ['Deck, Bag, and Pool Building', 'Bag Building'],
  'pool building': ['Deck, Bag, and Pool Building'],
  'worker placement': ['Worker Placement', 'Worker Placement, Different Worker Types'],
  'area control': ['Area Control / Area Influence', 'Area Majority / Influence'],
  'area majority': ['Area Majority / Influence', 'Area Control / Area Influence'],
  'hand management': ['Hand Management'],
  'set collection': ['Set Collection'],
  'tile placement': ['Tile Placement'],
  'card drafting': ['Card Drafting', 'Drafting'],
  'drafting': ['Drafting', 'Card Drafting', 'Open Drafting'],
  'push your luck': ['Push Your Luck'],
  'engine building': ['Income', 'Increase Value of Unchosen Resources', 'Engine Building'],
  'engine builder': ['Income', 'Increase Value of Unchosen Resources', 'Engine Building'],
  'trick taking': ['Trick-taking'],
  'trick-taking': ['Trick-taking'],
  'social deduction': ['Hidden Roles', 'Traitor Game', 'Voting'],
  'hidden role': ['Hidden Roles', 'Traitor Game'],
  'hidden roles': ['Hidden Roles', 'Traitor Game'],
  'route building': ['Route/Network Building', 'Network and Route Building'],
  'roll and write': ['Roll-and-Write'],
  'roll-and-write': ['Roll-and-Write'],
  'action points': ['Action Points', 'Action/Event'],
  'modular board': ['Modular Board'],
  'variable player powers': ['Variable Player Powers'],
  'legacy': ['Legacy Game', 'Campaign / Battle Card Driven'],
  'campaign': ['Campaign / Battle Card Driven', 'Legacy Game'],
  'cooperative': ['Cooperative Game', 'Semi-Cooperative Game'],
  'co-operative': ['Cooperative Game', 'Semi-Cooperative Game'],
  'auction': ['Auction/Bidding', 'Auction: English'],
  'bidding': ['Auction/Bidding', 'Auction: English'],
  'negotiation': ['Negotiation', 'Trading'],
  'trading': ['Negotiation', 'Trading'],
  'pattern building': ['Pattern Building', 'Pattern Recognition'],
  'dungeon crawler': ['Scenario / Mission / Campaign Game', 'Modular Board', 'Variable Player Powers'],
  'dungeon crawl': ['Scenario / Mission / Campaign Game', 'Modular Board', 'Variable Player Powers'],
  'dice combat': ['Dice Rolling'],
  'dice rolling': ['Dice Rolling'],
  'co-op': ['Cooperative Game', 'Semi-Cooperative Game'],
  'coop': ['Cooperative Game', 'Semi-Cooperative Game'],
  'exploration': ['Modular Board', 'Scenario / Mission / Campaign Game'],
  'combat': ['Take That', 'Player Elimination'],
  'resource management': ['Income', 'Increase Value of Unchosen Resources'],
  'bluffing': ['Bluffing'],
  'deduction': ['Deduction'],
  'pick up and deliver': ['Pick-up and Deliver'],
  'asymmetric': ['Variable Player Powers'],
  'asymmetric powers': ['Variable Player Powers'],
  'tableau building': ['Tableau Building'],
  'betting': ['Auction/Bidding', 'Betting and Bluffing'],
  'network building': ['Route/Network Building', 'Network and Route Building'],
};

/**
 * Check if a user/LLM mechanic term matches a game's BGG mechanic,
 * accounting for BGG's non-standard naming.
 */
export function mechanicMatches(userMechanic: string, gameMechanic: string): boolean {
  const userLower = userMechanic.toLowerCase();
  const gameLower = gameMechanic.toLowerCase();

  // Direct substring match
  if (gameLower.includes(userLower) || userLower.includes(gameLower)) {
    return true;
  }

  // Check aliases: does the user term have BGG aliases, and does the game match one?
  const aliases = BGG_MECHANIC_ALIASES[userLower];
  if (aliases) {
    return aliases.some(alias => gameLower.includes(alias.toLowerCase()) || alias.toLowerCase().includes(gameLower));
  }

  return false;
}

/**
 * Expand a list of user/LLM mechanic terms to include BGG aliases.
 */
export function expandMechanicsWithAliases(mechanics: string[]): string[] {
  const expanded = new Set<string>();
  for (const mech of mechanics) {
    expanded.add(mech);
    const lower = mech.toLowerCase();
    const aliases = BGG_MECHANIC_ALIASES[lower];
    if (aliases) {
      for (const alias of aliases) expanded.add(alias);
    }
  }
  return [...expanded];
}
