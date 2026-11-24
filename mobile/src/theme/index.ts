
export const lightTheme = {
  mode: 'light' as const,

  colors: {
    background: '#F2F7FC',
    surface: 'rgba(255, 255, 255, 0.9)',
    surfaceSecondary: 'rgba(234, 242, 249, 0.82)',
    primary: '#57A6E8',
    primaryDark: '#2169A2',
    primaryAction: 'rgba(7, 91, 197, 0.94)',
    onPrimaryAction: '#FFFFFF',
    primarySoft: 'rgba(220, 236, 249, 0.82)',
    secondary: '#79C5A5',
    secondaryDark: '#28784F',
    secondarySoft: 'rgba(224, 243, 234, 0.84)',
    text: '#172F47',
    textSecondary: '#647D95',
    border: '#D8E5F0',
    success: '#237A59',
    successAction: '#047857',
    onSuccessAction: '#FFFFFF',
    successSoft: '#E0F3EA',
    warning: '#965909',
    danger: '#C3424F',
    overlay: 'rgba(23, 47, 71, 0.1)',
  },
};

export const darkTheme = {
  mode: 'dark' as const,

  colors: {
    background: '#0B1725',
    surface: 'rgba(20, 36, 56, 0.92)',
    surfaceSecondary: 'rgba(28, 48, 70, 0.86)',
    primary: '#68B2EE',
    primaryDark: '#A9D9FF',
    primaryAction: 'rgba(36, 105, 168, 0.94)',
    onPrimaryAction: '#FFFFFF',
    primarySoft: 'rgba(37, 66, 93, 0.84)',
    secondary: '#83CDAA',
    secondaryDark: '#9DDBBD',
    secondarySoft: 'rgba(32, 69, 56, 0.88)',
    text: '#EEF5FC',
    textSecondary: '#A2B6CA',
    border: '#2A4259',
    success: '#6CC69A',
    successAction: '#24694E',
    onSuccessAction: '#FFFFFF',
    successSoft: '#204538',
    warning: '#E9B56B',
    danger: '#EE858C',
    overlay: 'rgba(0, 0, 0, 0.3)',
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
