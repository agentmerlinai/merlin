import type { CSSProperties } from 'react';

/* React types do not accept custom properties in a plain object. The page owns
   its geometry through --n/--x/--s style variables, so keep the cast in one place. */
export const vars = (value: Record<string, string | number>): CSSProperties =>
  value as CSSProperties;
