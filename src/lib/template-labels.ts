/**
 * Shared mapping from template ID to i18n key (under `dashboard.*`).
 * Used by create-resume-dialog, generate-resume-dialog, resume-card,
 * resume-list-item, templates page, and theme-editor.
 */
export const templateLabelsMap: Record<string, string> = {
  'touch-pure': 'dashboard.templateTouchPure',
  'touch-simple': 'dashboard.templateTouchSimple',
  'touch-flat': 'dashboard.templateTouchFlat',
  'touch-line': 'dashboard.templateTouchLine',
  'touch-compact': 'dashboard.templateTouchCompact',
  'touch-card': 'dashboard.templateTouchCard',
  'touch-grid': 'dashboard.templateTouchGrid',
  'touch-focus': 'dashboard.templateTouchFocus',
  classic: 'dashboard.templateClassic',
  modern: 'dashboard.templateModern',
  minimal: 'dashboard.templateMinimal',
  professional: 'dashboard.templateProfessional',
  'two-column': 'dashboard.templateTwoColumn',
  creative: 'dashboard.templateCreative',
  ats: 'dashboard.templateAts',
  academic: 'dashboard.templateAcademic',
  elegant: 'dashboard.templateElegant',
  executive: 'dashboard.templateExecutive',
  developer: 'dashboard.templateDeveloper',
  designer: 'dashboard.templateDesigner',
  startup: 'dashboard.templateStartup',
  formal: 'dashboard.templateFormal',
  infographic: 'dashboard.templateInfographic',
  compact: 'dashboard.templateCompact',
  euro: 'dashboard.templateEuro',
  clean: 'dashboard.templateClean',
  bold: 'dashboard.templateBold',
  timeline: 'dashboard.templateTimeline',
  // Batch 1
  nordic: 'dashboard.templateNordic',
  corporate: 'dashboard.templateCorporate',
  consultant: 'dashboard.templateConsultant',
  finance: 'dashboard.templateFinance',
  medical: 'dashboard.templateMedical',
  // Batch 2
  gradient: 'dashboard.templateGradient',
  metro: 'dashboard.templateMetro',
  material: 'dashboard.templateMaterial',
  coder: 'dashboard.templateCoder',
  blocks: 'dashboard.templateBlocks',
  // Batch 3
  magazine: 'dashboard.templateMagazine',
  artistic: 'dashboard.templateArtistic',
  retro: 'dashboard.templateRetro',
  neon: 'dashboard.templateNeon',
  watercolor: 'dashboard.templateWatercolor',
  // Batch 4
  swiss: 'dashboard.templateSwiss',
  japanese: 'dashboard.templateJapanese',
  berlin: 'dashboard.templateBerlin',
  luxe: 'dashboard.templateLuxe',
  rose: 'dashboard.templateRose',
  // Batch 5
  architect: 'dashboard.templateArchitect',
  legal: 'dashboard.templateLegal',
  teacher: 'dashboard.templateTeacher',
  scientist: 'dashboard.templateScientist',
  engineer: 'dashboard.templateEngineer',
  // Batch 6
  sidebar: 'dashboard.templateSidebar',
  card: 'dashboard.templateCard',
  zigzag: 'dashboard.templateZigzag',
  ribbon: 'dashboard.templateRibbon',
  mosaic: 'dashboard.templateMosaic',
};

const templateFallbackLabelsMap: Record<string, string> = {
  'touch-pure': 'TouchPure',
  'touch-simple': 'TouchSimple',
  'touch-flat': 'TouchFlat',
  'touch-line': 'TouchLine',
  'touch-compact': 'TouchCompact',
  'touch-card': 'TouchCard',
  'touch-grid': 'TouchGrid',
  'touch-focus': 'TouchFocus',
  classic: 'Classic',
  modern: 'Modern',
  minimal: 'Minimal',
  professional: 'Professional',
  'two-column': 'Two-Column',
  creative: 'Creative',
  ats: 'ATS',
  academic: 'Academic',
  elegant: 'Elegant',
  executive: 'Executive',
  developer: 'Developer',
  designer: 'Designer',
  startup: 'Startup',
  formal: 'Formal',
  infographic: 'Infographic',
  compact: 'Compact',
  euro: 'Euro CV',
  clean: 'Clean',
  bold: 'Bold',
  timeline: 'Timeline',
  nordic: 'Nordic',
  corporate: 'Corporate',
  consultant: 'Consultant',
  finance: 'Finance',
  medical: 'Medical',
  gradient: 'Gradient',
  metro: 'Metro',
  material: 'Material',
  coder: 'Coder',
  blocks: 'Blocks',
  magazine: 'Magazine',
  artistic: 'Artistic',
  retro: 'Retro',
  neon: 'Neon',
  watercolor: 'Watercolor',
  swiss: 'Swiss',
  japanese: 'Japanese',
  berlin: 'Berlin',
  luxe: 'Luxe',
  rose: 'Rose',
  architect: 'Architect',
  legal: 'Legal',
  teacher: 'Teacher',
  scientist: 'Scientist',
  engineer: 'Engineer',
  sidebar: 'Sidebar',
  card: 'Card',
  zigzag: 'Zigzag',
  ribbon: 'Ribbon',
  mosaic: 'Mosaic',
};

type TemplateTranslator = ((key: string) => string) & {
  has?: (key: string) => boolean;
};

function humanizeTemplateId(template: string): string {
  return template
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getTemplateFallbackLabel(template: string): string {
  return templateFallbackLabelsMap[template] || humanizeTemplateId(template);
}

export function getTemplateLabel(template: string, t: TemplateTranslator): string {
  const key = templateLabelsMap[template];
  if (key && (typeof t.has !== 'function' || t.has(key))) {
    return t(key);
  }
  return getTemplateFallbackLabel(template);
}
