/**
 * OpenAI function calling tool definitions for the chat sommelier.
 * These let the AI search our game database during conversation.
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const CHAT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_games',
      description: 'Search the game database for games matching criteria. Returns up to 10 results with name, rating, player count, play time, complexity, and categories.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free text search query (e.g., "cooperative dungeon crawler", "quick party game")',
          },
          type: {
            type: 'string',
            enum: ['board', 'video', 'word', 'party'],
            description: 'Filter by game type. Omit for all types.',
          },
          minPlayers: {
            type: 'number',
            description: 'Minimum player count',
          },
          maxPlayers: {
            type: 'number',
            description: 'Maximum player count',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_game_details',
      description: 'Get full details about a specific game by name. Use this when the user mentions a specific game.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The game name to look up',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_similar',
      description: 'Find games similar to a given game. Use when user says "something like X" or "games similar to X".',
      parameters: {
        type: 'object',
        properties: {
          gameName: {
            type: 'string',
            description: 'The game to find similar titles for',
          },
        },
        required: ['gameName'],
      },
    },
  },
];
