/**
 * GET /api/blog/generate — Generate a blog post draft and email for approval
 *
 * Called by Vercel Cron Job daily. Protected by CRON_SECRET.
 * Uses OpenAI GPT-4o to generate SEO-optimized game articles.
 * Posts are saved as drafts and emailed to contact@boredgame.lol
 * with approve/reject links. See /api/blog/approve for the approval flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';

const CRON_SECRET = process.env.CRON_SECRET;

// 365 article topic templates, one for every day of the year
const TOPIC_TEMPLATES = [
  // ── Player count focused (1-20) ──
  { template: 'Best Solo Board Games to Play Alone', category: null },
  { template: 'Best {category} Games for 2 Players', category: 'Strategy' },
  { template: 'Top 3-Player Games That Actually Work Well', category: null },
  { template: 'Best Board Games for 4 Players', category: null },
  { template: 'Best Party Games for 5+ Players', category: 'Party' },
  { template: 'Games That Work Great at Every Player Count', category: null },
  { template: 'Best Games for Large Groups of 6-8 Players', category: null },
  { template: 'Two-Player Games That Are Better Than You Think', category: null },
  { template: 'Games That Scale Perfectly from 2 to 6 Players', category: null },
  { template: 'Best Games for Exactly 3 Players', category: null },
  { template: 'Solo Board Games That Feel Like Multiplayer', category: null },
  { template: 'Best 2-Player Competitive Games', category: 'Strategy' },
  { template: 'Cooperative Games That Work at 2 Players', category: 'Cooperative' },
  { template: 'Best Games for Big Game Night Groups', category: null },
  { template: 'Games for 7+ Players That Aren\'t Just Party Games', category: null },
  { template: 'Best Head-to-Head Dueling Games', category: null },
  { template: 'Solo Games You Can Play in Under an Hour', category: null },
  { template: 'Best 4-Player Strategy Games', category: 'Strategy' },
  { template: 'Two-Player Games for Couples', category: null },
  { template: 'Best Games When You Only Have 2 People', category: null },

  // ── Time focused (21-40) ──
  { template: 'Top 10 Quick Games Under 30 Minutes', category: null },
  { template: 'Games You Can Finish in Under 15 Minutes', category: null },
  { template: 'Best Games for a 1-Hour Game Session', category: null },
  { template: 'Epic Games Worth the 3+ Hour Investment', category: null },
  { template: 'Best Filler Games Between Longer Sessions', category: null },
  { template: 'Quick Card Games for Lunch Breaks', category: 'Card Game' },
  { template: 'Games That Play in Exactly 20 Minutes', category: null },
  { template: 'Best Long Strategy Games for a Full Afternoon', category: 'Strategy' },
  { template: 'Speed Games That Get Your Heart Racing', category: null },
  { template: 'Best 45-Minute Board Games', category: null },
  { template: 'Games You Can Teach in Under 5 Minutes', category: null },
  { template: 'Board Games for When You Have All Day', category: null },
  { template: 'Quick 2-Player Games for Weeknights', category: null },
  { template: 'Best Real-Time Board Games', category: null },
  { template: 'Games That End Before They Overstay Their Welcome', category: null },
  { template: 'Short Games with Deep Strategy', category: null },
  { template: 'Best 90-Minute Strategy Games', category: 'Strategy' },
  { template: 'Games for a Quick 10-Minute Break', category: null },
  { template: 'Marathon Games That Are Worth Every Minute', category: null },
  { template: 'Fastest Board Games to Set Up and Play', category: null },

  // ── Complexity focused (41-60) ──
  { template: 'Best {category} Games for Beginners', category: 'Gateway' },
  { template: 'Complex Strategy Games Worth the Learning Curve', category: 'Heavy Strategy' },
  { template: 'Best Games to Play with Non-Gamers', category: 'Light' },
  { template: 'Gateway Games That Convert Non-Gamers', category: 'Gateway' },
  { template: 'Heavy Euro Games for Serious Strategists', category: 'Euro' },
  { template: 'Light Games with Surprising Depth', category: null },
  { template: 'Best Medium-Weight Strategy Games', category: 'Strategy' },
  { template: 'Board Games Anyone Can Learn in 2 Minutes', category: null },
  { template: 'Games That Look Complex But Are Actually Simple', category: null },
  { template: 'Best Heavy Games for Experienced Players', category: null },
  { template: 'Simple Rules, Deep Gameplay: The Best of Both Worlds', category: null },
  { template: 'Games to Graduate To After Catan', category: null },
  { template: 'Best Entry-Level Strategy Games', category: 'Strategy' },
  { template: 'Games Your Parents Would Actually Enjoy', category: null },
  { template: 'Brain-Burning Games for Puzzle Lovers', category: null },
  { template: 'Best Games for People Who Think They Don\'t Like Board Games', category: null },
  { template: 'Lightweight Games That Are Never Boring', category: null },
  { template: 'Most Beginner-Friendly Strategy Games', category: null },
  { template: 'Games for Hardcore Gamers Only', category: null },
  { template: 'The Perfect First Game for New Board Gamers', category: null },

  // ── Mechanic focused (61-100) ──
  { template: 'Worker Placement Games Ranked', category: 'Worker Placement' },
  { template: 'Best Deck-Building Games for Every Budget', category: 'Deck Building' },
  { template: 'Best Area Control Games for Competitive Players', category: 'Area Control' },
  { template: 'Top Deduction Games That Test Your Brain', category: 'Deduction' },
  { template: 'Best Engine Building Games of All Time', category: 'Engine Building' },
  { template: 'Best Abstract Strategy Games', category: 'Abstract' },
  { template: 'Top Tile-Laying Games', category: 'Tile Placement' },
  { template: 'Best Draft Games Where Picks Matter', category: 'Drafting' },
  { template: 'Hidden Role Games That Create Epic Moments', category: 'Hidden Identity' },
  { template: 'Best Auction and Bidding Games', category: 'Auction' },
  { template: 'Roll-and-Write Games Worth Playing', category: 'Roll and Write' },
  { template: 'Best Push-Your-Luck Games', category: 'Push Your Luck' },
  { template: 'Route Building Games Beyond Ticket to Ride', category: 'Route Building' },
  { template: 'Best Hand Management Games', category: 'Hand Management' },
  { template: 'Pattern Building Games That Look Beautiful', category: 'Pattern Building' },
  { template: 'Best Pick-Up-and-Deliver Games', category: 'Pick Up and Deliver' },
  { template: 'Negotiation Games That Ruin Friendships (in a Good Way)', category: 'Negotiation' },
  { template: 'Best Resource Management Games', category: 'Resource Management' },
  { template: 'Trick-Taking Card Games Ranked', category: 'Trick Taking' },
  { template: 'Best Set Collection Games', category: 'Set Collection' },
  { template: 'Asymmetric Games Where Everyone Plays Differently', category: 'Asymmetric' },
  { template: 'Best Campaign and Legacy Games', category: 'Legacy' },
  { template: 'Bluffing Games That Reward a Good Poker Face', category: 'Bluffing' },
  { template: 'Best Tableau Building Games', category: 'Tableau Building' },
  { template: 'Dice Games That Aren\'t Just About Luck', category: 'Dice Rolling' },
  { template: 'Best Dexterity Games for Physical Fun', category: 'Dexterity' },
  { template: 'Network Building Games for Strategic Minds', category: 'Network Building' },
  { template: 'Best Action Point Games', category: 'Action Points' },
  { template: 'Simultaneous Action Games for No Downtime', category: 'Simultaneous Action' },
  { template: 'Best Variable Player Power Games', category: 'Variable Player Powers' },
  { template: 'Memory Games That Are Actually Fun for Adults', category: 'Memory' },
  { template: 'Best Trading Games', category: 'Trading' },
  { template: 'Modular Board Games That Are Different Every Time', category: 'Modular Board' },
  { template: 'Programming Games Where You Plan Your Moves', category: 'Programmed Movement' },
  { template: 'Best Games with Bag Building Mechanics', category: 'Bag Building' },
  { template: 'Rondel Games Explained and Ranked', category: 'Rondel' },
  { template: 'Best Combat-Focused Board Games', category: 'Combat' },
  { template: 'Exploration Games for Adventurous Players', category: 'Exploration' },
  { template: 'Tech Tree Games for Builder Types', category: 'Tech Tree' },
  { template: 'Best Grid Movement Games', category: 'Grid Movement' },

  // ── Theme focused (101-140) ──
  { template: 'Best Fantasy Board Games', category: 'Fantasy' },
  { template: 'Top Sci-Fi Board Games', category: 'Science Fiction' },
  { template: 'Best Horror Board Games for Halloween', category: 'Horror' },
  { template: 'Historical Board Games That Teach You Something', category: 'Historical' },
  { template: 'Best Pirate-Themed Games', category: 'Pirates' },
  { template: 'Space Exploration Board Games', category: 'Space' },
  { template: 'Best Medieval Board Games', category: 'Medieval' },
  { template: 'Zombie Board Games Ranked', category: 'Zombies' },
  { template: 'Best Nature and Wildlife Board Games', category: 'Nature' },
  { template: 'Civilization Building Games for Empire Lovers', category: 'Civilization' },
  { template: 'Best Mystery and Crime Board Games', category: 'Mystery' },
  { template: 'Mythology Board Games from Around the World', category: 'Mythology' },
  { template: 'Best Farming and Agriculture Games', category: 'Farming' },
  { template: 'War Games for Armchair Generals', category: 'Wargame' },
  { template: 'Best Animal-Themed Board Games', category: 'Animals' },
  { template: 'Superhero Board Games That Actually Work', category: 'Superheroes' },
  { template: 'Best Train and Railroad Board Games', category: 'Trains' },
  { template: 'Post-Apocalyptic Board Games', category: 'Post-Apocalyptic' },
  { template: 'Best City Building Board Games', category: 'City Building' },
  { template: 'Ocean and Maritime Board Games', category: 'Nautical' },
  { template: 'Best Political and Intrigue Board Games', category: 'Political' },
  { template: 'Racing Board Games That Feel Fast', category: 'Racing' },
  { template: 'Best Dinosaur Board Games', category: 'Dinosaurs' },
  { template: 'Egyptian-Themed Board Games', category: 'Ancient Egypt' },
  { template: 'Best Steampunk Board Games', category: 'Steampunk' },
  { template: 'Viking and Norse Board Games', category: 'Vikings' },
  { template: 'Best Games Set in Asia', category: 'Asia' },
  { template: 'Board Games About Food and Cooking', category: 'Food' },
  { template: 'Best Games with a Space Theme', category: 'Space' },
  { template: 'Games Set in the Wild West', category: 'Western' },
  { template: 'Best Board Games About Trading and Economics', category: 'Economic' },
  { template: 'Lovecraft and Cthulhu Board Games', category: 'Lovecraftian' },
  { template: 'Best Board Games Set in Japan', category: 'Japan' },
  { template: 'Games About Building Kingdoms and Empires', category: 'Kingdom Building' },
  { template: 'Best Detective and Investigation Games', category: 'Detective' },
  { template: 'Board Games with a World War 2 Setting', category: 'World War 2' },
  { template: 'Best Dragon-Themed Board Games', category: 'Dragons' },
  { template: 'Board Games About Exploration and Discovery', category: 'Exploration' },
  { template: 'Espionage and Spy Board Games', category: 'Spies' },
  { template: 'Best Board Games About Magic and Sorcery', category: 'Magic' },

  // ── Occasion focused (141-180) ──
  { template: 'Best {category} Games for Date Night', category: 'Romance' },
  { template: 'Best Games for a Rainy Day Indoors', category: null },
  { template: 'Games for Holiday Gatherings', category: null },
  { template: 'Best Board Games for Road Trips', category: null },
  { template: 'Games for Camping Without Electricity', category: null },
  { template: 'Best Games for a Cozy Winter Night', category: null },
  { template: 'Games to Play at the Beach or Park', category: null },
  { template: 'Best Board Games for Thanksgiving', category: null },
  { template: 'Games for New Year\'s Eve Parties', category: null },
  { template: 'Best Board Games for Christmas Gifts', category: null },
  { template: 'Games to Play While Waiting at the Airport', category: null },
  { template: 'Best Games for Summer Vacation', category: null },
  { template: 'Games for a Lazy Sunday Afternoon', category: null },
  { template: 'Best Board Games for Bachelor and Bachelorette Parties', category: null },
  { template: 'Games for Team Building at Work', category: null },
  { template: 'Best Games for a Sleepover', category: null },
  { template: 'Games That Make Dinner Parties More Fun', category: null },
  { template: 'Best Board Games for a First Date', category: null },
  { template: 'Games for Long Car Rides', category: null },
  { template: 'Best Games for Tailgating', category: null },
  { template: 'Board Games for Sick Days at Home', category: null },
  { template: 'Best Games for a Cabin Weekend', category: null },
  { template: 'Games to Play at a Coffee Shop', category: null },
  { template: 'Best Board Games for Retirement', category: null },
  { template: 'Games for Killing Time During Travel Delays', category: null },
  { template: 'Best Board Games for Halloween Night', category: null },
  { template: 'Games for a Friendsgiving', category: null },
  { template: 'Best Games for Spring Break', category: null },
  { template: 'Board Games for After Dinner', category: null },
  { template: 'Games for a Power Outage', category: null },
  { template: 'Best Games for a Pool Party', category: null },
  { template: 'Board Games for Camping Trips', category: null },
  { template: 'Games for a Game Night Marathon', category: null },
  { template: 'Best Board Games for Brunch', category: null },
  { template: 'Games for a Housewarming Party', category: null },
  { template: 'Best Games for Valentine\'s Day', category: null },
  { template: 'Games for a Birthday Party', category: null },
  { template: 'Best Board Games for Mother\'s Day', category: null },
  { template: 'Games for Father\'s Day', category: null },
  { template: 'Best Board Games for a Game Cafe', category: null },

  // ── Audience focused (181-220) ──
  { template: 'Best {category} Board Games for Families', category: 'Family' },
  { template: 'Board Games for Teenagers', category: null },
  { template: 'Best Board Games for College Students', category: null },
  { template: 'Games for Kids Ages 5-8', category: 'Children' },
  { template: 'Best Board Games for Seniors', category: null },
  { template: 'Games for Couples Who Love Competition', category: null },
  { template: 'Best Board Games for Introverts', category: null },
  { template: 'Games for People Who Love Puzzles', category: 'Puzzle' },
  { template: 'Best Board Games for Math Lovers', category: null },
  { template: 'Games for History Buffs', category: 'Historical' },
  { template: 'Best Board Games for Book Lovers', category: null },
  { template: 'Games for Creative People', category: null },
  { template: 'Best Board Games for Competitive Players', category: null },
  { template: 'Games for People Who Hate Conflict', category: 'Cooperative' },
  { template: 'Best Board Games for Planners and Organizers', category: null },
  { template: 'Games for People Who Love Storytelling', category: 'Narrative' },
  { template: 'Best Board Games for Engineers', category: null },
  { template: 'Games for Teachers and Educators', category: 'Educational' },
  { template: 'Best Board Games for Artists', category: null },
  { template: 'Games for D&D Fans', category: 'RPG' },
  { template: 'Best Board Games for Video Gamers', category: null },
  { template: 'Games for People New to the Hobby', category: null },
  { template: 'Best Board Games for Kids Under 5', category: null },
  { template: 'Games for Mixed Age Groups', category: null },
  { template: 'Best Board Games for Tweens', category: null },
  { template: 'Games for Strategy Game Veterans', category: null },
  { template: 'Best Games for Roommates', category: null },
  { template: 'Board Games for Long-Distance Relationships', category: null },
  { template: 'Best Games for Newlyweds', category: null },
  { template: 'Games for Multi-Generational Families', category: null },
  { template: 'Best Board Games for Nerds', category: null },
  { template: 'Games for People Who Love Trivia', category: 'Trivia' },
  { template: 'Best Board Games for Sports Fans', category: 'Sports' },
  { template: 'Games for Anime and Manga Fans', category: null },
  { template: 'Best Board Games for Music Lovers', category: null },
  { template: 'Games for Science Fiction Fans', category: 'Science Fiction' },
  { template: 'Best Board Games for Horror Fans', category: 'Horror' },
  { template: 'Games for Wine and Board Game Night', category: null },
  { template: 'Best Board Games for Beer Lovers', category: null },
  { template: 'Games That Make Great Birthday Gifts', category: null },

  // ── Comparison and vs posts (221-260) ──
  { template: 'Euro Games vs Ameritrash: What to Play', category: null },
  { template: 'Board Games That Replaced Video Games for Us', category: null },
  { template: 'Cooperative vs Competitive: Which Style Is for You', category: null },
  { template: 'Kickstarter Games vs Retail Games: Worth the Hype?', category: null },
  { template: 'Digital Board Games vs Physical: Pros and Cons', category: null },
  { template: 'Catan vs Ticket to Ride: The Classic Showdown', category: null },
  { template: 'Wingspan vs Everdell: Which Nature Game Wins?', category: null },
  { template: 'Card Games vs Board Games: What\'s the Difference?', category: null },
  { template: 'Legacy Games vs One-Shot Games', category: null },
  { template: 'Thematic vs Abstract Games: A Breakdown', category: null },
  { template: 'Solo Gaming vs Multiplayer: Both Are Valid', category: null },
  { template: 'Cheap Board Games vs Premium: Where to Spend', category: null },
  { template: 'Old Classics vs Modern Board Games', category: null },
  { template: 'Light Games vs Heavy Games: Finding Your Weight', category: null },
  { template: 'Board Games vs Escape Rooms', category: null },
  { template: 'Deck Builders vs Bag Builders: What Sets Them Apart', category: null },
  { template: 'Miniatures Games vs Card Games', category: null },
  { template: 'Strategy Games vs Party Games: When to Play Each', category: null },
  { template: 'Indie Board Games vs Big Publisher Games', category: null },
  { template: 'Print and Play Games vs Retail Board Games', category: null },
  { template: 'Board Game Cafes vs Hosting Game Night at Home', category: null },
  { template: 'Asymmetric Games vs Symmetric Games', category: null },
  { template: 'Real-Time Games vs Turn-Based Games', category: null },
  { template: 'Worker Placement vs Engine Building: What\'s Better?', category: null },
  { template: 'Dungeon Crawlers vs RPG Board Games', category: null },
  { template: 'Narrative Games vs Sandbox Games', category: null },
  { template: 'Board Games vs Tabletop RPGs', category: null },
  { template: 'Co-op Dungeon Crawlers vs Competitive Ones', category: null },
  { template: 'Gateway Games vs Midweight Games: The Next Step', category: null },
  { template: 'Hidden Traitor Games vs Hidden Role Games', category: null },
  { template: 'Board Games vs Puzzles for Solo Entertainment', category: null },
  { template: 'Roll-and-Write vs Flip-and-Write Games', category: null },
  { template: 'Area Control vs Area Majority: Know the Difference', category: null },
  { template: 'Board Games with Apps vs Pure Analog Games', category: null },
  { template: 'Mass Market vs Hobby Board Games', category: null },
  { template: 'Tile Placement vs Tile Laying: A Comparison', category: null },
  { template: 'Economic Games vs Resource Management Games', category: null },
  { template: 'Team Games vs Free-for-All Games', category: null },
  { template: 'Short Campaign Games vs Full Legacy Games', category: null },
  { template: 'Board Games vs Card Games for Travel', category: null },

  // ── Guide and how-to posts (261-300) ──
  { template: 'How to Start a Board Game Collection', category: null },
  { template: 'How to Teach Board Games Without Putting People to Sleep', category: null },
  { template: 'How to Host the Perfect Game Night', category: null },
  { template: 'How to Choose a Board Game for Someone Else', category: null },
  { template: 'How to Store and Organize Your Board Games', category: null },
  { template: 'How to Find Hidden Gem Board Games', category: null },
  { template: 'How to Play Board Games Online with Friends', category: null },
  { template: 'How to Get Into Board Games as an Adult', category: null },
  { template: 'Board Game Etiquette: Unwritten Rules Everyone Should Know', category: null },
  { template: 'How to Budget for Board Games Without Going Broke', category: null },
  { template: 'How to Convince Your Friends to Try Board Games', category: null },
  { template: 'How to Choose Between Two Board Games', category: null },
  { template: 'How to Find a Board Game Group Near You', category: null },
  { template: 'How to Read Board Game Reviews Critically', category: null },
  { template: 'Board Game Accessories That Are Actually Worth Buying', category: null },
  { template: 'How to Protect and Sleeve Your Board Game Cards', category: null },
  { template: 'How to Paint Board Game Miniatures for Beginners', category: null },
  { template: 'Best Board Game Tables and Surfaces', category: null },
  { template: 'How to Deal with Sore Losers at Game Night', category: null },
  { template: 'How to Downsize Your Board Game Collection', category: null },
  { template: 'Board Game Subscription Boxes: Are They Worth It?', category: null },
  { template: 'How to Play Board Games with Kids Without Dumbing It Down', category: null },
  { template: 'How to Find Board Games at Thrift Stores', category: null },
  { template: 'Best Board Game Podcasts and YouTube Channels', category: null },
  { template: 'How to Start a Board Game Club', category: null },
  { template: 'Best Websites for Board Game Deals', category: null },
  { template: 'How to Keep Track of Games You Want to Play', category: null },
  { template: 'Tips for Playing Board Games Competitively', category: null },
  { template: 'How to Introduce Heavy Games to Casual Players', category: null },
  { template: 'Best Board Game Apps for Learning Rules', category: null },
  { template: 'How to Run a Board Game Tournament', category: null },
  { template: 'How to Fix Damaged Board Game Components', category: null },
  { template: 'Best 3D Printed Board Game Accessories', category: null },
  { template: 'How to Build Custom Inserts for Board Games', category: null },
  { template: 'Board Game Shelving Ideas for Small Spaces', category: null },
  { template: 'How to Track Your Board Game Plays', category: null },
  { template: 'Best Apps for Scoring Board Games', category: null },
  { template: 'How to Find Replacement Parts for Board Games', category: null },
  { template: 'Board Game Travel Cases and Portable Solutions', category: null },
  { template: 'How to Rate Board Games: What Makes a 10/10?', category: null },

  // ── Lists and rankings (301-340) ──
  { template: 'Top {category} Games for Game Night', category: 'Strategy' },
  { template: 'Underrated Board Games with Amazing Mechanics', category: null },
  { template: 'Best Video Games for Board Game Lovers', category: null },
  { template: 'Top Card Games That Fit in Your Pocket', category: 'Card Game' },
  { template: 'Games That Are Better Than Their Ratings Suggest', category: null },
  { template: 'Top Games with Amazing Artwork', category: null },
  { template: 'Best Dungeon Crawl and RPG Board Games', category: 'RPG' },
  { template: 'Hidden Gem {category} Games You Missed', category: 'Adventure' },
  { template: 'Best {category} Games Released Recently', category: 'Thematic' },
  { template: 'Cooperative Games Everyone Should Try', category: 'Cooperative' },
  { template: 'Most Beautiful Board Games on Your Shelf', category: null },
  { template: 'Best Board Games Under $20', category: null },
  { template: 'Best Board Games Under $50', category: null },
  { template: 'Board Games Worth the Splurge Over $100', category: null },
  { template: 'Most Replayable Board Games of All Time', category: null },
  { template: 'Board Games with the Best Components', category: null },
  { template: 'Games with the Most Satisfying Combos', category: null },
  { template: 'Board Games with the Best Themes', category: null },
  { template: 'Most Innovative Board Games Released This Year', category: null },
  { template: 'Best Board Games You\'ve Never Heard Of', category: null },
  { template: 'Games That Deserve More Attention', category: null },
  { template: 'Board Games That Went Viral on Social Media', category: null },
  { template: 'Best Board Games of the Last Decade', category: null },
  { template: 'Classic Board Games That Still Hold Up', category: null },
  { template: 'Board Games That Are Better with Expansions', category: null },
  { template: 'Best Board Game Expansions Ever Made', category: null },
  { template: 'Most Overrated Board Games', category: null },
  { template: 'Board Games That Are Impossible to Find', category: null },
  { template: 'Best Free Print-and-Play Board Games', category: null },
  { template: 'Board Games with the Funniest Moments', category: null },
  { template: 'Games with the Most Stressful Decisions', category: null },
  { template: 'Board Games That Make You Think Differently', category: null },
  { template: 'Best Board Games for Learning New Skills', category: null },
  { template: 'Games with the Cleverest Mechanics', category: null },
  { template: 'Board Games with the Best Rulebooks', category: null },
  { template: 'Shortest Board Games with the Most Depth', category: null },
  { template: 'Board Games with the Most Dramatic Endings', category: null },
  { template: 'Games That Get Better Every Time You Play', category: null },
  { template: 'Best Board Games Based on Video Games', category: null },
  { template: 'Board Games Based on Movies and TV Shows', category: null },

  // ── Video game crossover (341-365) ──
  { template: 'Best Video Games for Board Game Lovers', category: null },
  { template: 'Board Games That Feel Like Video Games', category: null },
  { template: 'Best Digital Versions of Board Games', category: null },
  { template: 'Video Games with Board Game Mechanics', category: null },
  { template: 'Best Roguelike Board Games', category: null },
  { template: 'Board Games for Minecraft Fans', category: null },
  { template: 'Strategy Video Games That Started as Board Games', category: null },
  { template: 'Best Board Games on Tabletop Simulator', category: null },
  { template: 'Mobile Board Game Apps Worth Downloading', category: null },
  { template: 'Board Games for Stardew Valley Fans', category: null },
  { template: 'Best Board Games for Zelda Fans', category: null },
  { template: 'Games for Fans of Civilization and 4X Games', category: '4X' },
  { template: 'Best Party Video Games vs Party Board Games', category: null },
  { template: 'Board Games for Dark Souls Fans', category: null },
  { template: 'Games for Fans of XCOM and Tactical Combat', category: null },
  { template: 'Board Games That Inspired Video Games', category: null },
  { template: 'Best Board Games on Board Game Arena', category: null },
  { template: 'Games for Fans of Pokemon and Monster Collecting', category: null },
  { template: 'Board Games for Animal Crossing Fans', category: null },
  { template: 'Best Board Games for Final Fantasy Fans', category: null },
  { template: 'Games for Fans of Puzzle Video Games', category: null },
  { template: 'Board Games for Survival Horror Fans', category: null },
  { template: 'Best Board Games for MMO Fans', category: null },
  { template: 'Card Games for Magic: The Gathering Fans', category: null },
  { template: 'Board Games for Fans of Grand Strategy Games', category: null },
];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Vercel Cron sends GET requests
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  // Pick today's topic based on day of year
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const topicIndex = dayOfYear % TOPIC_TEMPLATES.length;
  const topic = TOPIC_TEMPLATES[topicIndex];

  const titleHint = topic.template.replace('{category}', topic.category ?? 'Board');

  // Determine if this topic is board-game-specific or video-game-crossover
  const isVideoGameCrossover = topicIndex >= 341; // indices 341-365 are video game crossover topics
  const isBoardGameTopic = titleHint.toLowerCase().includes('board game');

  // Fetch topic-relevant games from the DB
  let gameContext = '';
  const gameFields = 'id, name, rating, rating_count, categories, mechanics, min_players, max_players, avg_play_time, complexity, year_published, source, enriched_metadata';

  type BlogGameRow = {
    id: string; name: string; rating: number; rating_count: number;
    categories: string[] | null; mechanics: string[] | null;
    min_players: number; max_players: number; avg_play_time: number;
    complexity: number; year_published: number; source: string;
    enriched_metadata: Record<string, unknown> | null;
  };
  let games: BlogGameRow[] = [];

  // Pass 1: Filter by topic category/mechanic (exact match)
  if (topic.category) {
    // Try matching category first
    const catQuery = supabase
      .from('games')
      .select(gameFields)
      .gte('rating', 6.5)
      .gte('rating_count', 50)
      .eq('is_expansion', false)
      .contains('categories', [topic.category])
      .order('rating', { ascending: false })
      .limit(30);

    if (!isVideoGameCrossover) {
      catQuery.eq('source', 'bgg');
    }

    const { data: catGames } = await catQuery;

    if (catGames && catGames.length >= 6) {
      games = catGames;
    } else {
      // Try mechanics as fallback
      const mechQuery = supabase
        .from('games')
        .select(gameFields)
        .gte('rating', 6.5)
        .gte('rating_count', 50)
        .eq('is_expansion', false)
        .contains('mechanics', [topic.category])
        .order('rating', { ascending: false })
        .limit(30);

      if (!isVideoGameCrossover) {
        mechQuery.eq('source', 'bgg');
      }

      const { data: mechGames } = await mechQuery;

      if (mechGames && mechGames.length >= 6) {
        games = mechGames;
      } else {
        // Combine whatever we found from both
        const combined = [...(catGames ?? []), ...(mechGames ?? [])];
        const seen = new Set<string>();
        games = combined.filter((g) => {
          if (seen.has(g.id)) return false;
          seen.add(g.id);
          return true;
        });
      }
    }
  }

  // Pass 2: If we still don't have enough, broaden the search
  if (games.length < 6) {
    const broadQuery = supabase
      .from('games')
      .select(gameFields)
      .gte('rating', 7.0)
      .gte('rating_count', 100)
      .eq('is_expansion', false)
      .order('rating', { ascending: false })
      .limit(50);

    // Still respect board-game vs video-game boundaries
    if (isBoardGameTopic && !isVideoGameCrossover) {
      broadQuery.eq('source', 'bgg');
    }

    const { data: broadGames } = await broadQuery;
    if (broadGames) {
      const existingIds = new Set(games.map((g) => g.id));
      const extras = broadGames.filter((g) => !existingIds.has(g.id));
      games = [...games, ...extras];
    }
  }

  if (games.length > 0) {
    // Pick 8 random games, preferring topic-matched ones
    const shuffled = games.sort(() => Math.random() - 0.5).slice(0, 8);
    gameContext = shuffled.map((g) => {
      const moods = (g.enriched_metadata as Record<string, unknown>)?.moods;
      const moodStr = Array.isArray(moods) ? `, moods: ${moods.join(', ')}` : '';
      return `- ${g.name} (${g.rating}/10, ${g.rating_count} ratings, ${g.min_players}-${g.max_players} players, ~${g.avg_play_time}min, complexity ${g.complexity}/5, categories: ${(g.categories ?? []).join(', ')}, mechanics: ${(g.mechanics ?? []).join(', ')}${moodStr}, source: ${g.source}, id: ${g.id})`;
    }).join('\n');
  }

  const year = new Date().getFullYear();

  const prompt = `You are a blog writer for boredgame.lol, a game recommendation website with 100,000+ board games and video games.

Write an authoritative, well-researched blog post that would rank well on Google.

## Topic
"${titleHint} (${year})"

## Real Games From Our Database
Here are candidate games. CRITICAL: ONLY feature games that genuinely fit the topic.
If a game doesn't match (wrong genre, mechanic, player count, theme, etc.), DO NOT include it.
It is far better to feature 3 truly relevant games than 6 irrelevant ones.
A "modular board game" must actually have modular/variable setup. A "solo game" must support 1 player. Etc.
Use their exact names and IDs for internal links:
${gameContext}

## SEO & Structure Requirements
- Title: compelling, includes the primary keyword naturally. 50-65 characters ideal.
- Meta description: under 155 characters, includes primary keyword, has a call to action.
- Structure the article with clear H2 headings (## in markdown). At least 3-4 sections.
- Open with a hook that addresses the reader's problem or question directly. No fluff intro.
- Write 1000-1500 words. Longer content ranks better, but every sentence must earn its place.
- Include the primary keyword in the first 100 words naturally.
- Use related keywords throughout (LSI terms). If the topic is "strategy games", also use "tactical", "planning", "competitive", etc.

## Game References & Links
- Feature 4-6 games from the list above. For each one, write 2-3 sentences about what makes it special and who it's for.
- Internal links: [Game Name](/games/GAME_ID_HERE) for each featured game.
- Affiliate links: [Check price on Amazon](https://www.amazon.com/s?k=GAME+NAME+board+game&tag=boredgame-20) for each game.
- Link to our recommendation tool naturally: "If you want personalized picks, [try our game finder](/find-a-game)."
- Link to our browse page where relevant: "[Browse all strategy games](/browse?category=Strategy)"

## Tone & Style
- Write like an experienced gamer talking to a friend. Casual but knowledgeable.
- Have opinions. Say "this is one of the best" not "this is considered good by many."
- Share specific details that show expertise: mention player count sweet spots, common complaints, who a game is NOT for.
- Short paragraphs (2-3 sentences max). Web readers skim.
- Use bullet lists for comparisons or quick info.
- NO emdashes. Use commas, periods, or parentheses.
- NO generic AI phrases: "dive into", "elevate your", "game-changer", "whether you're a seasoned veteran or a newcomer", "in the world of", "look no further", "without further ado"
- NO starting paragraphs with "So," or "Now,"
- End with a brief conclusion and CTA to /find-a-game

## Output Format
Respond in this exact JSON format:
{
  "title": "The blog post title",
  "description": "Meta description under 155 chars with keyword and CTA",
  "content": "Full markdown content with ## headings, links, and formatting",
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 4000,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 500 });
    }

    const article = JSON.parse(raw);
    const slug = slugify(article.title) + `-${Date.now().toString(36)}`;

    // Extract game IDs mentioned in the content
    const gameIdMatches = article.content.matchAll(/\/games\/([a-zA-Z0-9-]+)/g);
    const featuredGameIds = [...new Set([...gameIdMatches].map((m: RegExpMatchArray) => m[1]))];

    // Store as draft (not published) pending approval
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        slug,
        title: article.title,
        description: article.description,
        content: article.content,
        tags: article.tags ?? [],
        featured_game_ids: featuredGameIds,
        published_at: null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('[Blog Generate] DB error:', error);
      return NextResponse.json({ error: 'Failed to save post' }, { status: 500 });
    }

    // Email draft for approval
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && post.approval_token) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://boredgame.lol';
      const approveUrl = `${baseUrl}/api/blog/approve?token=${post.approval_token}`;
      const rejectUrl = `${baseUrl}/api/blog/approve?token=${post.approval_token}&action=reject`;
      const previewUrl = `${baseUrl}/api/blog/preview?token=${post.approval_token}`;

      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: 'boredgame.lol Blog <blog@boredgame.lol>',
        to: 'contact@boredgame.lol',
        subject: `Blog Draft: ${article.title}`,
        html: `
          <h2>New Blog Draft Ready for Review</h2>
          <h3>${article.title}</h3>
          <p><em>${article.description}</em></p>
          <p><strong>Tags:</strong> ${(article.tags ?? []).join(', ')}</p>
          <p><strong>Featured games:</strong> ${featuredGameIds.length} games referenced</p>
          <hr />
          <p><a href="${previewUrl}" style="color:#2196f3;font-size:16px;">Preview full post</a></p>
          <br />
          <p>
            <a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#4caf50;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Approve and Publish</a>
            &nbsp;&nbsp;
            <a href="${rejectUrl}" style="display:inline-block;padding:12px 24px;background:#f44336;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Reject</a>
          </p>
          <hr />
          <details>
            <summary>Full content preview</summary>
            <div style="padding:16px;background:#f5f5f5;border-radius:8px;margin-top:8px;white-space:pre-wrap;font-family:sans-serif;font-size:14px;">${article.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </details>
        `,
      });
    }

    return NextResponse.json({ success: true, slug: post.slug, title: post.title, status: 'draft' });
  } catch (err) {
    console.error('[Blog Generate] Error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
