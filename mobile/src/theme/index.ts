
export const lightTheme = {
  mode: 'light' as const,

  colors: {
    background: '#F5F9FD',
    surface: '#FFFFFF',
    surfaceSecondary: '#EDF5FC',
    primary: '#63A9E8',
    primaryDark: '#347FBE',
    primarySoft: '#DCEEFF',
    secondary: '#8BCFB5',
    secondaryDark: '#4DAB88',
    secondarySoft: '#E0F5EB',
    text: '#18334B',
    textSecondary: '#6F8498',
    border: '#DFEAF3',
    success: '#36A879',
    warning: '#E8AA55',
    danger: '#E36F75',
    overlay: 'rgba(24, 51, 75, 0.08)',
  },
};

export const darkTheme = {
  mode: 'dark' as const,

  colors: {
    background: '#101D2B',
    surface: '#192B3D',
    surfaceSecondary: '#21384C',
    primary: '#79B9ED',
    primaryDark: '#A4D2F5',
    primarySoft: '#294967',
    secondary: '#83C8A9',
    secondaryDark: '#A0DEC1',
    secondarySoft: '#24483D',
    text: '#EDF5FC',
    textSecondary: '#A1B5C8',
    border: '#30475B',
    success: '#71CBA3',
    warning: '#F0BE75',
    danger: '#F08B91',
    overlay: 'rgba(0, 0, 0, 0.24)',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
};

export const typography = {
  small: 12,
  body: 14,
  regular: 16,
  subtitle: 18,
  heading: 24,
  title: 30,
  display: 36,
};

export type AppTheme = typeof lightTheme;
