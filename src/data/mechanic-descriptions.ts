/**
 * Plain-English descriptions of board game mechanics.
 * Shown as tooltips when users hover/tap mechanic chips on game detail pages.
 *
 * Each entry includes a 1-2 sentence description and 2-3 well-known example games.
 */

export interface MechanicInfo {
  description: string;
  examples: string[];
}

export const MECHANIC_DESCRIPTIONS: Record<string, MechanicInfo> = {
  'Action Points': {
    description: 'Each turn you get a budget of action points to spend on different actions. Do you move, attack, or build? You decide how to split them.',
    examples: ['Pandemic', 'Mechs vs. Minions', 'Dead of Winter'],
  },
  'Area Control': {
    description: 'Players compete to dominate regions on the map. Having the most units or influence in an area earns you points or special abilities.',
    examples: ['Risk', 'Root', 'El Grande'],
  },
  'Area Movement': {
    description: 'Players move pieces between connected regions on a map, often to control territory or achieve objectives.',
    examples: ['Risk', 'Twilight Imperium', 'Axis & Allies'],
  },
  'Auction/Bidding': {
    description: 'Players bid resources or currency to win items, actions, or turn order. Knowing when to push and when to fold is key.',
    examples: ['Ra', 'Power Grid', 'Modern Art'],
  },
  'Betting and Bluffing': {
    description: "Players wager or bluff about hidden information. Can you read your opponents, or will they read you first?",
    examples: ['Skull', "Sheriff of Nottingham", "Coup"],
  },
  'Campaign / Battle Card Driven': {
    description: 'Cards drive the action, representing historical events, military orders, or strategic decisions that shape the campaign.',
    examples: ['Twilight Struggle', 'War of the Ring', 'Hannibal: Rome vs. Carthage'],
  },
  'Card Drafting': {
    description: 'Pick a card from a shared hand, then pass the rest. What you take matters, but so does what you leave for opponents.',
    examples: ['7 Wonders', 'Sushi Go!', 'Blood Rage'],
  },
  'Chit-Pull System': {
    description: 'Random tokens drawn from a bag determine turn order or events. Creates tension because you never know what comes next.',
    examples: ['Undaunted: Normandy', 'War of the Ring', 'Thunder Alley'],
  },
  'Cooperative Game': {
    description: "All players work together against the game itself. You win as a team or lose as a team. No backstabbing here.",
    examples: ['Pandemic', 'Spirit Island', 'Forbidden Island'],
  },
  'Deck Building': {
    description: "Start with a weak deck and buy better cards to add to it during the game. Your deck evolves and gets more powerful as you play.",
    examples: ['Dominion', 'Star Realms', 'Clank!'],
  },
  'Dice Rolling': {
    description: 'Roll dice to determine outcomes. Some games let you mitigate bad luck, others embrace the chaos.',
    examples: ['King of Tokyo', 'Yahtzee', 'Dice Forge'],
  },
  'Drafting': {
    description: 'Choose items from a shared pool one at a time. Each pick shapes your strategy and narrows options for everyone else.',
    examples: ['Azul', 'Sagrada', 'Villagers'],
  },
  'Engine Building': {
    description: 'Build up a system where your early investments generate increasingly powerful combos. Slow start, satisfying payoff.',
    examples: ['Terraforming Mars', 'Wingspan', 'Splendor'],
  },
  'Grid Movement': {
    description: 'Pieces move on a grid of squares or hexes, often with movement rules determining how far and in what direction.',
    examples: ['Chess', 'Gloomhaven', 'Descent'],
  },
  'Hand Management': {
    description: 'Managing the cards in your hand is the core challenge. When to play them, when to save them, and which to discard.',
    examples: ['Ticket to Ride', 'Agricola', 'Concordia'],
  },
  'Hidden Movement': {
    description: "One player moves secretly while others try to track them down. A tense cat-and-mouse dynamic.",
    examples: ['Scotland Yard', 'Fury of Dracula', 'Letters from Whitechapel'],
  },
  'Hidden Roles': {
    description: "Players have secret identities or allegiances. Trust no one -- your best friend at the table might be working against you.",
    examples: ['Secret Hitler', 'The Resistance', 'Werewolf'],
  },
  'Hexagon Grid': {
    description: 'The board uses hexagonal tiles, allowing six directions of movement instead of four. Common in wargames and exploration games.',
    examples: ['Settlers of Catan', 'Twilight Imperium', 'Eclipse'],
  },
  'Income': {
    description: 'Players receive regular resource income based on their holdings. Building your income engine is key to long-term success.',
    examples: ['Brass: Birmingham', 'Terraforming Mars', 'Scythe'],
  },
  'Legacy Game': {
    description: 'The game permanently changes between sessions. You might destroy cards, add stickers to the board, or unlock sealed boxes.',
    examples: ['Pandemic Legacy', 'Gloomhaven', 'Charterstone'],
  },
  'Line of Sight': {
    description: 'Whether units can see or target each other depends on terrain and positioning. Tactical positioning becomes crucial.',
    examples: ['Gloomhaven', 'Star Wars: Imperial Assault', 'Memoir 44'],
  },
  'Market': {
    description: 'A shared pool of available items, cards, or resources that changes as players buy from it. Timing your purchases is key.',
    examples: ['Century: Spice Road', 'Istanbul', 'The Quacks of Quedlinburg'],
  },
  'Memory': {
    description: 'Remembering hidden information gives you an advantage. Can you recall where things are or what was played?',
    examples: ['Mysterium', 'Hanabi', 'Clue'],
  },
  'Modular Board': {
    description: 'The game board is assembled from tiles or pieces, creating a different layout each time you play.',
    examples: ['Catan', 'Betrayal at House on the Hill', 'Eclipse'],
  },
  'Move Through Deck': {
    description: 'Your deck or discard pile cycles as you play, letting you see your purchased cards come back around.',
    examples: ['Dominion', 'Aeon\'s End', 'Star Realms'],
  },
  'Network and Route Building': {
    description: 'Connect points on a map by building routes between them. Longer or more strategic networks score more.',
    examples: ['Ticket to Ride', 'Brass: Birmingham', 'Power Grid'],
  },
  'Once-Per-Game Abilities': {
    description: 'Powerful abilities you can only use once per game. Timing when to unleash them is a key decision.',
    examples: ['Scythe', 'Eclipse', 'Cosmic Encounter'],
  },
  'Pattern Building': {
    description: 'Arrange tiles, tokens, or cards to match specific patterns for points. Spatial puzzle-solving meets strategy.',
    examples: ['Azul', 'Sagrada', 'Calico'],
  },
  'Pick-up and Deliver': {
    description: 'Move goods from one location to another to fulfill orders. Route planning and efficiency are everything.',
    examples: ['Merchants & Marauders', 'Istanbul', 'Xia: Legends of a Drift System'],
  },
  'Player Elimination': {
    description: 'Players can be knocked out of the game before it ends. High stakes, but eliminated players have to watch.',
    examples: ['Risk', 'King of Tokyo', 'Bang!'],
  },
  'Point to Point Movement': {
    description: 'Move between connected locations on a network of points, like cities connected by roads.',
    examples: ['Pandemic', 'Fury of Dracula', 'Eldritch Horror'],
  },
  'Press Your Luck': {
    description: 'Keep pushing for bigger rewards, but risk losing everything. The thrill of "just one more" is addictive.',
    examples: ['The Quacks of Quedlinburg', 'Can\'t Stop', 'Celestia'],
  },
  'Programmed Movement': {
    description: 'Plan your moves in advance, then reveal and execute simultaneously. Hilarity ensues when plans collide.',
    examples: ['RoboRally', 'Colt Express', 'Mechs vs. Minions'],
  },
  'Push Your Luck': {
    description: 'Take risks for bigger payoffs, but one bad outcome could wipe out your gains. Know when to stop.',
    examples: ['The Quacks of Quedlinburg', 'Incan Gold', 'Zombie Dice'],
  },
  'Real-Time': {
    description: 'No turns -- everyone plays simultaneously, often racing against a timer. Fast, frantic, and loud.',
    examples: ['Galaxy Trucker', 'Captain Sonar', 'Space Alert'],
  },
  'Resource Management': {
    description: 'Carefully allocate limited resources (wood, stone, gold, food) to build, trade, and expand. Every choice has a cost.',
    examples: ['Agricola', 'Terraforming Mars', 'Scythe'],
  },
  'Rock-Paper-Scissors': {
    description: 'Simultaneous reveal of choices that interact in a cycle where each beats one and loses to another.',
    examples: ['Yomi', 'BattleCON', 'Exceed'],
  },
  'Role Playing': {
    description: 'Players take on character roles with unique abilities, often making narrative choices that shape the story.',
    examples: ['Gloomhaven', 'Mansions of Madness', 'Descent'],
  },
  'Roll / Spin and Move': {
    description: 'Roll dice (or spin a wheel) and move that many spaces. The classic "board game" mechanic.',
    examples: ['Monopoly', 'The Game of Life', 'Clue'],
  },
  'Rondel': {
    description: 'Actions are arranged in a circle, and your pawn moves around it. You can go further but it costs more.',
    examples: ['Navegador', 'Antike', 'Trajan'],
  },
  'Route Building': {
    description: 'Claim paths or routes on the board to connect destinations and complete objectives.',
    examples: ['Ticket to Ride', 'Thurn and Taxis', 'Trans Europa'],
  },
  'Semi-Cooperative Game': {
    description: 'Players mostly work together, but someone might be a traitor, or only one player can ultimately win.',
    examples: ['Dead of Winter', 'Nemesis', 'Battlestar Galactica'],
  },
  'Set Collection': {
    description: 'Gather matching sets of cards, tokens, or resources. Complete sets score bonus points.',
    examples: ['Ticket to Ride', 'Jaipur', 'Century: Spice Road'],
  },
  'Simultaneous Action Selection': {
    description: 'All players secretly choose their actions, then reveal at once. Anticipating opponents is everything.',
    examples: ['7 Wonders', 'Race for the Galaxy', 'Citadels'],
  },
  'Social Deduction': {
    description: "Figure out who is lying through discussion and observation. Trust, betrayal, and reading people are the whole game.",
    examples: ['Werewolf', 'Secret Hitler', 'The Resistance'],
  },
  'Solo / Solitaire Game': {
    description: 'Designed to be played alone, often with an AI opponent or puzzle-like challenge to beat.',
    examples: ['Spirit Island', 'Mage Knight', 'Friday'],
  },
  'Storytelling': {
    description: 'Players create or influence a narrative. The story that emerges is as important as winning.',
    examples: ['Dixit', 'Once Upon a Time', 'Mysterium'],
  },
  'Take That': {
    description: 'Direct attacks or sabotage against other players. Not for the faint-hearted or easily offended.',
    examples: ['Munchkin', 'Exploding Kittens', 'Bang!'],
  },
  'Tile Placement': {
    description: 'Place tiles to build a shared map, city, or landscape. Where you place matters for scoring and blocking opponents.',
    examples: ['Carcassonne', 'Azul', 'Cascadia'],
  },
  'Time Track': {
    description: 'Actions cost time, and the player furthest behind on the time track goes next. Take big actions, but you might not go again for a while.',
    examples: ['Patchwork', 'Tokaido', "Glen More"],
  },
  'Trading': {
    description: 'Exchange resources or goods with other players. Negotiation skills and knowing the value of what you have are key.',
    examples: ['Catan', 'Chinatown', 'Bohnanza'],
  },
  'Trick-taking': {
    description: 'Players each play one card per round; the highest card (or trump suit) wins the trick. A classic card game mechanic.',
    examples: ['The Crew', 'Fox in the Forest', 'Skull King'],
  },
  'Variable Phase Order': {
    description: 'Players choose which phase of the round to activate, and only chosen phases happen. Everyone benefits, but you control the timing.',
    examples: ['Puerto Rico', 'Race for the Galaxy', 'San Juan'],
  },
  'Variable Player Powers': {
    description: 'Each player has unique abilities or starting conditions, creating asymmetric gameplay where everyone plays differently.',
    examples: ['Root', 'Cosmic Encounter', 'Spirit Island'],
  },
  'Voting': {
    description: 'Players vote to make collective decisions. Alliances, persuasion, and politics come into play.',
    examples: ['Secret Hitler', 'Avalon', 'Blood on the Clocktower'],
  },
  'Worker Placement': {
    description: "Place your workers on action spaces to claim them. Once someone takes a spot, nobody else can use it that round.",
    examples: ['Agricola', 'Viticulture', 'Lords of Waterdeep'],
  },
};
