export type TelaoPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type TelaoAnimation = 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'fade' | 'scale' | 'bounce';

export type TelaoShadow = 'none' | 'subtle' | 'medium' | 'dramatic';

export type TelaoConfig = {
  position: TelaoPosition;
  widthPct: number;
  fontFamily: string;
  fontSizePx: number;
  cardBg: string;
  cardText: string;
  borderRadius: number;
  shadow: TelaoShadow;
  backdropBlur: number;
  animation: TelaoAnimation;
  displaySeconds: number;
  maxConcurrent: number;
  showAvatar: boolean;
  showTimestamp: boolean;
  showEventName: boolean;
};

export const DEFAULT_TELAO_CONFIG: TelaoConfig = {
  position: 'bottom-center',
  widthPct: 90,
  fontFamily: 'Inter',
  fontSizePx: 32,
  cardBg: 'rgba(10, 37, 64, 0.85)',
  cardText: '#FFFFFF',
  borderRadius: 16,
  shadow: 'medium',
  backdropBlur: 8,
  animation: 'slide-up',
  displaySeconds: 7,
  maxConcurrent: 1,
  showAvatar: false,
  showTimestamp: false,
  showEventName: false,
};

export type TelaoDisplayMode = 'h2r' | 'browser_source' | 'chrome_pip' | 'desktop_app';

export const DISPLAY_MODE_LABELS: Record<TelaoDisplayMode, string> = {
  h2r: 'H2R Graphics',
  browser_source: 'Browser Source (OBS, vMix, Streamlabs)',
  chrome_pip: 'Janela Flutuante Chrome',
  desktop_app: 'Audience Desktop',
};

export function positionStyles(position: TelaoPosition): React.CSSProperties {
  const base: React.CSSProperties = { position: 'fixed' };
  const padding = '5%';
  switch (position) {
    case 'top-left':
      return { ...base, top: padding, left: padding };
    case 'top-center':
      return { ...base, top: padding, left: '50%', transform: 'translateX(-50%)' };
    case 'top-right':
      return { ...base, top: padding, right: padding };
    case 'middle-left':
      return { ...base, top: '50%', left: padding, transform: 'translateY(-50%)' };
    case 'center':
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'middle-right':
      return { ...base, top: '50%', right: padding, transform: 'translateY(-50%)' };
    case 'bottom-left':
      return { ...base, bottom: padding, left: padding };
    case 'bottom-center':
      return { ...base, bottom: padding, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-right':
      return { ...base, bottom: padding, right: padding };
  }
}

export function shadowClass(shadow: TelaoShadow): string {
  switch (shadow) {
    case 'none': return '';
    case 'subtle': return 'shadow-md';
    case 'medium': return 'shadow-xl';
    case 'dramatic': return 'shadow-2xl';
  }
}

export function animationVariants(animation: TelaoAnimation) {
  switch (animation) {
    case 'slide-up':
      return { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 20 } };
    case 'slide-down':
      return { initial: { opacity: 0, y: -40 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } };
    case 'slide-left':
      return { initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 30 } };
    case 'slide-right':
      return { initial: { opacity: 0, x: -60 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 } };
    case 'fade':
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
    case 'scale':
      return { initial: { opacity: 0, scale: 0.85 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 } };
    case 'bounce':
      return {
        initial: { opacity: 0, y: 40, scale: 0.9 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 260, damping: 18 } },
        exit: { opacity: 0, y: 20, scale: 0.95 },
      };
  }
}
