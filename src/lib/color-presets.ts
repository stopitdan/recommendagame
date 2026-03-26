/**
 * Color Preset System
 *
 * Each preset defines the accent colors used throughout the app.
 * The theme factory in theme.ts reads the active preset and generates
 * the full MUI theme from it.
 *
 * To add a new theme:
 * 1. Add a new entry to COLOR_PRESETS
 * 2. That's it — it automatically appears in settings
 *
 * To change the default: update DEFAULT_PRESET_ID
 */

export interface ColorPreset {
  id: string;
  name: string;
  emoji: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  accent: string; // Info/teal color
  rating: string; // Amber/gold for ratings
  /** Light mode backgrounds */
  lightBg: string;
  lightPaper: string;
  lightText: string;
  lightTextSecondary: string;
  lightDivider: string;
  /** Dark mode backgrounds */
  darkBg: string;
  darkPaper: string;
  darkText: string;
  darkTextSecondary: string;
  darkDivider: string;
}

export const DEFAULT_PRESET_ID = 'game-night-glow';

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'game-night-glow',
    name: 'Game Night Glow',
    emoji: '🎲',
    primary: '#5B4FDB',
    primaryDark: '#4A3FC5',
    primaryLight: '#7B71E8',
    secondary: '#FF6D3F',
    secondaryDark: '#E85A2E',
    accent: '#0EC6C6',
    rating: '#FFB020',
    lightBg: '#FDFAF6', lightPaper: '#FFFFFF',
    lightText: '#1A1A2E', lightTextSecondary: '#64648C', lightDivider: '#EEEDF5',
    darkBg: '#0F0F1A', darkPaper: '#1A1A2E',
    darkText: '#EEEDF5', darkTextSecondary: '#A0A0C0', darkDivider: '#2D2B55',
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    emoji: '🌊',
    primary: '#0077B6',
    primaryDark: '#005F8A',
    primaryLight: '#48B8E8',
    secondary: '#FF9F1C',
    secondaryDark: '#E08A00',
    accent: '#06D6A0',
    rating: '#FFD166',
    lightBg: '#F0F8FF', lightPaper: '#FFFFFF',
    lightText: '#0A2540', lightTextSecondary: '#5A7184', lightDivider: '#D4E5F7',
    darkBg: '#0A1628', darkPaper: '#112240',
    darkText: '#CCD6E0', darkTextSecondary: '#8899A6', darkDivider: '#1E3A5F',
  },
  {
    id: 'neon-arcade',
    name: 'Neon Arcade',
    emoji: '👾',
    primary: '#E040FB',
    primaryDark: '#C020D8',
    primaryLight: '#EA80FC',
    secondary: '#00E5FF',
    secondaryDark: '#00B8D4',
    accent: '#76FF03',
    rating: '#FFEA00',
    lightBg: '#FAFAFA', lightPaper: '#FFFFFF',
    lightText: '#1A0033', lightTextSecondary: '#6B4D80', lightDivider: '#E8D5F5',
    darkBg: '#0A0014', darkPaper: '#1A0033',
    darkText: '#F0E0FF', darkTextSecondary: '#B088CC', darkDivider: '#2D1A4A',
  },
  {
    id: 'forest-grove',
    name: 'Forest Grove',
    emoji: '🌲',
    primary: '#2D6A4F',
    primaryDark: '#1B4332',
    primaryLight: '#52B788',
    secondary: '#E76F51',
    secondaryDark: '#C55A3C',
    accent: '#40916C',
    rating: '#F4A261',
    lightBg: '#F5FBF7', lightPaper: '#FFFFFF',
    lightText: '#1B2A1E', lightTextSecondary: '#5C7262', lightDivider: '#D4E8DC',
    darkBg: '#0A140D', darkPaper: '#152118',
    darkText: '#D4E8DC', darkTextSecondary: '#8AAB95', darkDivider: '#243D2C',
  },
  {
    id: 'sunset-mesa',
    name: 'Sunset Mesa',
    emoji: '🌅',
    primary: '#D4421E',
    primaryDark: '#B53516',
    primaryLight: '#EF6C40',
    secondary: '#F9A825',
    secondaryDark: '#D48E1A',
    accent: '#E65100',
    rating: '#FDD835',
    lightBg: '#FFF8F0', lightPaper: '#FFFFFF',
    lightText: '#3E2723', lightTextSecondary: '#795548', lightDivider: '#F0DDD0',
    darkBg: '#1A0E08', darkPaper: '#2C1810',
    darkText: '#F0DDD0', darkTextSecondary: '#B89888', darkDivider: '#3E2723',
  },
  {
    id: 'midnight-royal',
    name: 'Midnight Royal',
    emoji: '👑',
    primary: '#7C3AED',
    primaryDark: '#6025C0',
    primaryLight: '#A78BFA',
    secondary: '#F59E0B',
    secondaryDark: '#D68800',
    accent: '#8B5CF6',
    rating: '#FCD34D',
    lightBg: '#F8F5FF', lightPaper: '#FFFFFF',
    lightText: '#1E1040', lightTextSecondary: '#6B5B95', lightDivider: '#E5DCF5',
    darkBg: '#0C0620', darkPaper: '#1E1040',
    darkText: '#E5DCF5', darkTextSecondary: '#9B8BB5', darkDivider: '#2E2060',
  },
];

export const PRESET_MAP = new Map(COLOR_PRESETS.map((p) => [p.id, p]));

export function getPreset(id: string): ColorPreset {
  return PRESET_MAP.get(id) ?? COLOR_PRESETS[0];
}
