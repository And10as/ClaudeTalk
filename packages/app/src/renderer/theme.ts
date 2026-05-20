export const palette = {
  light: {
    bg: '#FAF9F5',
    bgElevated: '#FFFFFF',
    bgSubtle: '#F2F0E8',
    text: '#2C2B29',
    textMuted: '#8B8985',
    border: '#E8E6DC',
    accent: '#D97757',
    accentHover: '#C56A4D',
    accentSubtle: '#FAEAE0',
    success: '#5A8F69',
    danger: '#B85450',
  },
  dark: {
    bg: '#1F1E1D',
    bgElevated: '#2A2927',
    bgSubtle: '#252321',
    text: '#F5F4EE',
    textMuted: '#9A9893',
    border: '#3A3937',
    accent: '#E08366',
    accentHover: '#D97757',
    accentSubtle: '#3D2A22',
    success: '#7AAD88',
    danger: '#D17570',
  },
} as const;

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  pill: '999px',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const;

export const shadow = {
  card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
  cardHover: '0 4px 12px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04)',
  focus: '0 0 0 3px rgba(217, 119, 87, 0.18)',
} as const;

export const font = {
  family:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
  familySerif:
    "'Tiempos Headline', 'Lora', Georgia, 'Times New Roman', serif",
  sizeBase: '14px',
  sizeSm: '12px',
  sizeLg: '16px',
  sizeXl: '20px',
  sizeDisplay: '28px',
  weightRegular: 400,
  weightMedium: 500,
  weightSemibold: 600,
} as const;
