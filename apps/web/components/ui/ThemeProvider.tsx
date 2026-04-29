import type { ThemeTokens } from '@audience/shared-types';
import type { ReactNode } from 'react';

import { buildThemeStyle } from '@/lib/themes/buildThemeStyle';

type Props = { tokens: ThemeTokens; children: ReactNode };

export function ThemeProvider({ tokens, children }: Props) {
  const style = buildThemeStyle(tokens) as React.CSSProperties;
  return (
    <div style={style} className="contents">
      {children}
    </div>
  );
}
