import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';
export type GradientTheme = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'default';

interface ThemeState {
  mode: ThemeMode;
  gradient: GradientTheme;
  setMode: (mode: ThemeMode) => void;
  setGradient: (gradient: GradientTheme) => void;
  loadTheme: () => Promise<void>;
}

export const gradientColors = {
  blue: ['#4A90E2', '#5BA3F5'],
  purple: ['#8B5CF6', '#A78BFA'],
  green: ['#10B981', '#34D399'],
  orange: ['#F59E0B', '#FBBF24'],
  pink: ['#EC4899', '#F472B6'],
  default: ['#4A90E2', '#5BA3F5'],
};

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  gradient: 'default',
  setMode: async (mode) => {
    set({ mode });
    await AsyncStorage.setItem('themeMode', mode);
  },
  setGradient: async (gradient) => {
    set({ gradient });
    await AsyncStorage.setItem('themeGradient', gradient);
  },
  loadTheme: async () => {
    try {
      const savedMode = await AsyncStorage.getItem('themeMode');
      const savedGradient = await AsyncStorage.getItem('themeGradient');
      
      if (savedMode) set({ mode: savedMode as ThemeMode });
      if (savedGradient) set({ gradient: savedGradient as GradientTheme });
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  },
}));

export const getThemeColors = (mode: ThemeMode) => {
  if (mode === 'light') {
    return {
      background: '#FFFFFF',
      surface: '#F3F4F6',
      text: '#111827',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      cardBackground: '#FFFFFF',
    };
  }
  return {
    background: '#0A0A0A',
    surface: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#999999',
    border: '#333333',
    cardBackground: '#1A1A1A',
  };
};
