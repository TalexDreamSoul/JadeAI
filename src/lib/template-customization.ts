import type { ThemeConfig } from '@/types/resume';

const SAFE_KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'currentColor', 'transparent']);

function hasOwnValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function clampNumber(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function sanitizeCssToken(value: unknown, fallback = ''): string {
  if (!hasOwnValue(value)) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;

  // Keep custom values from breaking out of the current declaration.
  if (
    /[{}<>;]/.test(raw)
    || /javascript:/i.test(raw)
    || /expression\s*\(/i.test(raw)
    || /behavior\s*:/i.test(raw)
    || /@import/i.test(raw)
  ) {
    return fallback;
  }

  return raw;
}

export function sanitizeColor(value: unknown, fallback = ''): string {
  const raw = sanitizeCssToken(value, fallback);
  if (!raw) return fallback;
  if (SAFE_KEYWORDS.has(raw)) return raw;
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
  if (/^(rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)$/.test(raw)) return raw;
  if (/^[a-zA-Z]+$/.test(raw)) return raw;
  return fallback;
}

export function sanitizeAlign(value: unknown): 'left' | 'center' | 'right' | '' {
  return value === 'left' || value === 'center' || value === 'right' ? value : '';
}

export function sanitizeDividerStyle(value: unknown): 'solid' | 'dashed' | 'dotted' | 'double' {
  return value === 'dashed' || value === 'dotted' || value === 'double' ? value : 'solid';
}

export function sanitizeFontWeight(value: unknown): string {
  const n = clampNumber(value, 100, 950);
  if (n == null) return '';
  return String(Math.round(n / 50) * 50);
}

function sanitizeTextTransform(value: unknown): 'none' | 'uppercase' | 'capitalize' | 'lowercase' | '' {
  return value === 'none' || value === 'uppercase' || value === 'capitalize' || value === 'lowercase' ? value : '';
}

function cssVariableDeclarations(vars?: Record<string, string>): string {
  if (!vars || typeof vars !== 'object') return '';
  return Object.entries(vars as Record<string, unknown>)
    .map(([key, value]) => {
      if (!/^--[a-zA-Z0-9-_]+$/.test(key)) return '';
      const safeValue = sanitizeCssToken(value);
      return safeValue ? `${key}: ${safeValue};` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    const prev = selector[i - 1];

    if (quote) {
      current += ch;
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === '(' || ch === '[') depth++;
    if ((ch === ')' || ch === ']') && depth > 0) depth--;

    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function findMatchingBrace(css: string, openIndex: number): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = openIndex; i < css.length; i++) {
    const ch = css[i];
    const prev = css[i - 1];

    if (quote) {
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function prefixSelector(selector: string, scopeSelector: string): string {
  return splitSelectorList(selector)
    .map((part) => {
      if (!part) return '';
      if (part.startsWith(scopeSelector)) return part;
      if (part === ':root' || part === 'html' || part === 'body') return scopeSelector;
      if (part.startsWith('@')) return part;
      return `${scopeSelector} ${part}`;
    })
    .filter(Boolean)
    .join(', ');
}

export function sanitizeCustomCss(css: unknown): string {
  if (!css) return '';
  return String(css)
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/<\/?script[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/expression\s*\(/gi, 'expression_removed(')
    .replace(/behavior\s*:/gi, 'behavior_removed:')
    .replace(/@import[^;]+;?/gi, '')
    .replace(/url\(\s*(['"]?)\s*javascript:[^)]+\)/gi, 'none');
}

export function scopeCustomCss(css: unknown, scopeSelector: string): string {
  const input = sanitizeCustomCss(css).trim();
  if (!input) return '';

  let output = '';
  let i = 0;

  while (i < input.length) {
    const nextOpen = input.indexOf('{', i);
    if (nextOpen === -1) {
      output += input.slice(i);
      break;
    }

    const prelude = input.slice(i, nextOpen).trim();
    const close = findMatchingBrace(input, nextOpen);
    if (close === -1) break;

    const body = input.slice(nextOpen + 1, close);

    if (prelude.startsWith('@')) {
      const atName = prelude.split(/\s+/)[0].toLowerCase();
      if (atName === '@media' || atName === '@supports' || atName === '@container' || atName === '@layer') {
        output += `${prelude} {\n${scopeCustomCss(body, scopeSelector)}\n}\n`;
      } else if (atName === '@keyframes') {
        output += `${prelude} {${body}}\n`;
      }
    } else {
      output += `${prefixSelector(prelude, scopeSelector)} {${body}}\n`;
    }

    i = close + 1;
  }

  return output.trim();
}

export function buildTemplateCustomizationCSS(scopeSelector: string, theme: ThemeConfig): string {
  const root = `${scopeSelector} > div`;
  const rules: string[] = [];

  const vars = cssVariableDeclarations(theme.advanced?.cssVars);
  const layout = theme.layout;
  const rootDecls: string[] = [];

  if (vars) rootDecls.push(vars);
  if (layout) {
    const backgroundColor = sanitizeColor(layout.backgroundColor);
    const contentMaxWidth = clampNumber(layout.contentMaxWidth, 480, 1200);
    const borderRadius = clampNumber(layout.borderRadius, 0, 48);

    if (backgroundColor) rootDecls.push(`background-color: ${backgroundColor} !important;`);
    if (contentMaxWidth != null) rootDecls.push(`max-width: ${contentMaxWidth}px !important;`);
    if (borderRadius != null) rootDecls.push(`border-radius: ${borderRadius}px !important; overflow: hidden;`);
    if (layout.pageShadow === false) rootDecls.push('box-shadow: none !important;');
    if (layout.pageShadow === true) rootDecls.push('box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12) !important;');
  }

  if (rootDecls.length) {
    rules.push(`${root} {\n${rootDecls.join('\n')}\n}`);
  }

  const title = theme.titleStyle;
  if (title && Object.values(title).some(hasOwnValue)) {
    const titleDecls: string[] = [];
    const fontWeight = sanitizeFontWeight(title.fontWeight);
    const fontSize = clampNumber(title.fontSize, 14, 72);
    const color = sanitizeColor(title.color);
    const align = sanitizeAlign(title.align);
    const letterSpacing = sanitizeCssToken(title.letterSpacing);
    const marginBottom = clampNumber(title.marginBottom, 0, 64);

    if (fontWeight) titleDecls.push(`font-weight: ${fontWeight} !important;`);
    if (fontSize != null) titleDecls.push(`font-size: ${fontSize}px !important;`);
    if (color) titleDecls.push(`color: ${color} !important;`);
    if (align) titleDecls.push(`text-align: ${align} !important;`);
    if (letterSpacing) titleDecls.push(`letter-spacing: ${letterSpacing} !important;`);
    if (marginBottom != null) titleDecls.push(`margin-bottom: ${marginBottom}px !important;`);

    if (titleDecls.length) {
      rules.push(`${root} h1 {\n${titleDecls.join('\n')}\n}`);
    }

    if (align) {
      rules.push(`${root} h1 + p, ${root} header, ${root} > div:first-child { text-align: ${align} !important; }`);
    }
  }

  const sectionTitle = theme.sectionTitleStyle;
  if (sectionTitle && Object.values(sectionTitle).some(hasOwnValue)) {
    const decls: string[] = [];
    const fontWeight = sanitizeFontWeight(sectionTitle.fontWeight);
    const fontSize = clampNumber(sectionTitle.fontSize, 8, 36);
    const color = sanitizeColor(sectionTitle.color);
    const align = sanitizeAlign(sectionTitle.align);
    const letterSpacing = sanitizeCssToken(sectionTitle.letterSpacing);
    const transform = sanitizeTextTransform(sectionTitle.textTransform ?? (sectionTitle.uppercase === true ? 'uppercase' : sectionTitle.uppercase === false ? 'none' : undefined));
    const marginBottom = clampNumber(sectionTitle.marginBottom, 0, 48);

    if (fontWeight) decls.push(`font-weight: ${fontWeight} !important;`);
    if (fontSize != null) decls.push(`font-size: ${fontSize}px !important;`);
    if (color) decls.push(`color: ${color} !important;`);
    if (align) decls.push(`text-align: ${align} !important;`);
    if (letterSpacing) decls.push(`letter-spacing: ${letterSpacing} !important;`);
    if (transform) decls.push(`text-transform: ${transform} !important;`);
    if (marginBottom != null) decls.push(`margin-bottom: ${marginBottom}px !important;`);

    if (decls.length) {
      rules.push(`${root} [data-section] h2 {\n${decls.join('\n')}\n}`);
    }
  }

  const divider = theme.sectionDivider;
  if (divider && Object.values(divider).some(hasOwnValue)) {
    if (divider.enabled === false) {
      rules.push(`
        ${root} [data-section] h2 {
          border-bottom-width: 0 !important;
          border-bottom-color: transparent !important;
        }
        ${root} [data-section] div:has(> h2) > div[class*="h-px"],
        ${root} [data-section] div:has(> h2) > div[class*="h-[1px]"],
        ${root} [data-section] div:has(> h2) > div[class*="h-0.5"],
        ${root} [data-section] div:has(> h2) > div[style*="border-top"] {
          display: none !important;
        }
      `);
    } else {
      const style = sanitizeDividerStyle(divider.style);
      const thickness = clampNumber(divider.thickness, 0, 12) ?? 1;
      const color = sanitizeColor(divider.color, 'currentColor');
      const marginTop = clampNumber(divider.marginTop, 0, 48);
      const marginBottom = clampNumber(divider.marginBottom, 0, 48);

      rules.push(`
        ${root} [data-section] h2 {
          border-bottom-style: ${style} !important;
          border-bottom-width: ${thickness}px !important;
          border-bottom-color: ${color} !important;
          padding-bottom: max(2px, ${Math.max(2, thickness * 2)}px) !important;
          ${marginTop != null ? `margin-top: ${marginTop}px !important;` : ''}
          ${marginBottom != null ? `margin-bottom: ${marginBottom}px !important;` : ''}
        }
        ${root} [data-section] div:has(> h2) > div[class*="h-px"],
        ${root} [data-section] div:has(> h2) > div[class*="h-[1px]"],
        ${root} [data-section] div:has(> h2) > div[class*="h-0.5"],
        ${root} [data-section] div:has(> h2) > div[style*="border-top"] {
          display: block !important;
          height: 0 !important;
          border-top: ${thickness}px ${style} ${color} !important;
          background: transparent !important;
        }
      `);
    }
  }

  const customCss = scopeCustomCss(theme.advanced?.customCss, scopeSelector);
  if (customCss) rules.push(customCss);

  return rules.join('\n');
}
