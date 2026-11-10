
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';

import { lightTheme, darkTheme } from '../theme';

type AppTheme = typeof lightTheme | typeof darkTheme;

interface ThemeContextValue {
  isDark: boolean;
  theme: AppTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined
);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(false);

  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setIsDark((current) => !current);
  };

  const value = useMemo(
    () => ({
      isDark,
      theme,
      toggleTheme,
    }),
    [isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useTheme must be used inside a ThemeProvider'
    );
  }

  return context;
}
