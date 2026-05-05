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

// Modo de transicao entre mensagens em rotacao automatica:
// - 'sequential': uma sai completamente, espera o intervalo, ai a proxima entra
// - 'overlap': a nova entra empurrando a anterior pra cima durante a saida
export type TelaoTransitionMode = 'sequential' | 'overlap';

export type TelaoConfig = {
  position: TelaoPosition;
  /** Custom X position (0–100, % of 1920 stage). When set together with
   *  posYPct, overrides `position` and anchors the card's center to (X,Y). */
  posXPct?: number | undefined;
  /** Custom Y position (0–100, % of 1080 stage). See `posXPct`. */
  posYPct?: number | undefined;
  widthPct: number;
  /** Min-height in px. 0 = auto (fits content). */
  heightPx: number;
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
  transitionMode: TelaoTransitionMode;
  showAvatar: boolean;
  showTimestamp: boolean;
  showEventName: boolean;
};

export const DEFAULT_TELAO_CONFIG: TelaoConfig = {
  position: 'bottom-center',
  widthPct: 90,
  heightPx: 0,
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
  transitionMode: 'sequential',
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

export function customPositionStyles(xPct: number, yPct: number): React.CSSProperties {
  return {
    position: 'fixed',
    left: `${xPct}%`,
    top: `${yPct}%`,
    transform: 'translate(-50%, -50%)',
  };
}

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

export function shadowStyle(shadow: TelaoShadow): string {
  switch (shadow) {
    case 'none': return 'none';
    case 'subtle': return '0 4px 12px -2px rgba(0,0,0,0.18), 0 2px 4px -1px rgba(0,0,0,0.10)';
    case 'medium': return '0 18px 38px -8px rgba(0,0,0,0.32), 0 8px 14px -6px rgba(0,0,0,0.18)';
    case 'dramatic': return '0 30px 60px -12px rgba(0,0,0,0.55), 0 18px 30px -10px rgba(0,0,0,0.30)';
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
