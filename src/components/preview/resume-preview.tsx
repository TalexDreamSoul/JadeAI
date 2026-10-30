'use client';

import { useEffect, useId, useRef } from 'react';
import type { Resume, ThemeConfig } from '@/types/resume';
import { BACKGROUND_TEMPLATES, type Template } from '@/lib/constants';
import { buildTemplateCustomizationCSS } from '@/lib/template-customization';
import { annotateResumeDom } from '@/lib/resume-dom-classes';
import { useEditorStore } from '@/stores/editor-store';
import { RESUME_TEMPLATE_COMPONENTS } from './template-registry';

interface ResumePreviewProps {
  resume: Resume;
}

const FONT_SIZE_SCALE: Record<string, { body: string; h1: string; h2: string; h3: string }> = {
  small:  { body: '12px', h1: '22px', h2: '15px', h3: '13px' },
  medium: { body: '14px', h1: '26px', h2: '17px', h3: '15px' },
  large:  { body: '16px', h1: '30px', h2: '19px', h3: '17px' },
};

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#1a1a1a',
  accentColor: '#3b82f6',
  fontFamily: 'Inter',
  fontSize: 'medium',
  lineSpacing: 1.5,
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  sectionSpacing: 16,
  avatarStyle: 'oneInch',
};

/** Returns true if a hex colour is dark (luminance < 0.4) */
function isDark(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 0.4;
}

function buildThemeCSS(scopeId: string, theme: ThemeConfig, template: string): string {
  const s = `[data-theme-scope="${scopeId}"]`;
  const fs = FONT_SIZE_SCALE[theme.fontSize] || FONT_SIZE_SCALE.medium;
  const m = theme.margin;
  const needsPadding = !BACKGROUND_TEMPLATES.has(template);
  const primaryIsDark = isDark(theme.primaryColor);

  return `
    ${s} > div {
      font-family: ${theme.fontFamily}, 'Noto Sans SC', sans-serif !important;
      line-height: ${theme.lineSpacing} !important;
      ${needsPadding ? `padding-top: ${m.top}px !important; padding-right: ${m.right}px !important; padding-bottom: ${m.bottom}px !important; padding-left: ${m.left}px !important;` : ''}
      --base-body-size: ${fs.body};
      --base-h1-size: ${fs.h1};
      --base-h2-size: ${fs.h2};
      --base-h3-size: ${fs.h3};
      --base-line-spacing: ${theme.lineSpacing};
      --base-section-spacing: ${theme.sectionSpacing}px;
      --base-margin-top: ${m.top}px;
      --base-margin-right: ${m.right}px;
      --base-margin-bottom: ${m.bottom}px;
      --base-margin-left: ${m.left}px;
    }
    ${s} p, ${s} li, ${s} span, ${s} td, ${s} a {
      font-size: ${fs.body} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${s} h1:not([style*="color"]) {
      color: ${theme.primaryColor} !important;
      font-size: ${fs.h1} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${s} h1[style*="color"] {
      font-size: ${fs.h1} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${s} h2:not([style*="color"]) {
      color: ${theme.accentColor} !important;
      font-size: ${fs.h2} !important;
      line-height: ${theme.lineSpacing} !important;
      border-color: ${theme.accentColor} !important;
    }
    ${s} h2[style*="color"] {
      font-size: ${fs.h2} !important;
      line-height: ${theme.lineSpacing} !important;
      border-color: ${theme.accentColor} !important;
    }
    ${s} h3:not([style*="color"]) {
      color: ${theme.primaryColor} !important;
      font-size: ${fs.h3} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${s} h3[style*="color"] {
      font-size: ${fs.h3} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${s} [class*="border-b-2"],
    ${s} [class*="border-b-"] {
      border-color: ${theme.accentColor} !important;
    }
    ${s} [class*="bg-blue-"], ${s} [class*="bg-indigo-"],
    ${s} [class*="bg-slate-800"], ${s} [class*="bg-zinc-800"],
    ${s} [class*="bg-teal-"], ${s} [class*="bg-emerald-"] {
      background-color: ${theme.accentColor} !important;
    }
    ${s} [data-section] {
      ${needsPadding ? `margin-bottom: ${theme.sectionSpacing}px !important;` : `padding-bottom: ${theme.sectionSpacing}px !important;`}
    }
    ${primaryIsDark ? `
    ${s} [style*="background"][style*="#"] h1:not([style*="color"]),
    ${s} [style*="background"][style*="#"] h2:not([style*="color"]),
    ${s} [style*="background"][style*="#"] h3:not([style*="color"]),
    ${s} [style*="background"][style*="rgb"] h1:not([style*="color"]),
    ${s} [style*="background"][style*="rgb"] h2:not([style*="color"]),
    ${s} [style*="background"][style*="rgb"] h3:not([style*="color"]),
    ${s} [style*="background"][style*="linear-gradient"] h1:not([style*="color"]),
    ${s} [style*="background"][style*="linear-gradient"] h2:not([style*="color"]),
    ${s} [style*="background"][style*="linear-gradient"] h3:not([style*="color"]),
    ${s} .bg-black h1:not([style*="color"]),
    ${s} .bg-black h2:not([style*="color"]),
    ${s} .bg-black h3:not([style*="color"]) {
      color: #ffffff !important;
    }` : ''}
  `;
}

export function ResumePreview({ resume }: ResumePreviewProps) {
  const TemplateComponent = RESUME_TEMPLATE_COMPONENTS[resume.template as Template]
    || RESUME_TEMPLATE_COMPONENTS.classic;
  const scopeId = useId();
  const scopeRef = useRef<HTMLDivElement>(null);
  const highlightedSectionType = useEditorStore((state) => state.highlightedSectionType);
  const theme: ThemeConfig = { ...DEFAULT_THEME, ...(resume.themeConfig || {}) };
  const scopeSelector = `[data-theme-scope="${scopeId}"]`;
  const customCss = buildTemplateCustomizationCSS(scopeSelector, theme);
  const safeHighlightedSectionType = highlightedSectionType?.replace(/[^a-zA-Z0-9_-]/g, '');
  const highlightCss = safeHighlightedSectionType ? `
    ${scopeSelector} [data-section][data-section-type="${safeHighlightedSectionType}"] {
      outline: 2px solid var(--brand, #8b5cf6) !important;
      outline-offset: 4px !important;
      border-radius: 8px !important;
      background-color: color-mix(in srgb, var(--brand, #8b5cf6) 8%, transparent) !important;
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--brand, #8b5cf6) 10%, transparent) !important;
      transition: outline-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease !important;
    }
  ` : '';

  // Defensive: ensure resume.sections is always an array and only visible sections render.
  const safeResume = {
    ...resume,
    sections: (Array.isArray(resume.sections) ? resume.sections : []).filter(
      (section) => section.visible !== false
    ),
  };

  useEffect(() => {
    const root = scopeRef.current;
    if (!root) return;

    annotateResumeDom(root, safeResume.template);
    const observer = new MutationObserver(() => annotateResumeDom(root, safeResume.template));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  });

  return (
    <>
      {/* Load the same Google Fonts used in PDF/HTML export so preview renders
          with identical font metrics (Inter for Latin, Noto Sans SC for CJK). */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div ref={scopeRef} data-theme-scope={scopeId} className="resume-preview-scope min-h-[297mm] bg-white">
        <style dangerouslySetInnerHTML={{ __html: `${buildThemeCSS(scopeId, theme, safeResume.template)}\n${customCss}\n${highlightCss}` }} />
        <TemplateComponent resume={safeResume} />
      </div>
    </>
  );
}
