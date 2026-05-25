const SKIP_TAGS = new Set(['script', 'style', 'link', 'meta', 'title', 'template']);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

export const RESUME_CUSTOM_CSS_CLASS_EXAMPLES = [
  '.resume-root',
  '.resume-header',
  '.resume-name',
  '.resume-section',
  '.resume-section-summary',
  '.resume-section-work_experience',
  '.resume-section-title',
  '.resume-section-content',
  '.resume-item',
  '.resume-list-item',
  '.resume-avatar',
  '.resume-qr-item',
] as const;

type ResumeClassMeta = {
  tagName: string;
  template?: string;
  isScopeRoot?: boolean;
  isTemplateRoot?: boolean;
  isSection?: boolean;
  sectionType?: string;
  sectionId?: string;
  isInsideSection?: boolean;
  isSectionTitle?: boolean;
  isSectionContent?: boolean;
  isHeaderDescendant?: boolean;
  parentClass?: string;
};

type HtmlStackNode = {
  tagName: string;
  className: string;
  sectionType: string;
  isSection: boolean;
};

function safeClassToken(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function splitClasses(value: unknown) {
  return String(value || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasUtilityClass(className: string, prefix: string) {
  return splitClasses(className).some((item) => item === prefix || item.startsWith(prefix));
}

function isLikelyItemTag(tagName: string) {
  return tagName === 'div' || tagName === 'p' || tagName === 'article' || tagName === 'li';
}

function buildResumeClassList(meta: ResumeClassMeta) {
  const tag = safeClassToken(meta.tagName);
  if (!tag || SKIP_TAGS.has(tag)) return [];

  const classes = new Set<string>();
  const template = safeClassToken(meta.template);
  const sectionType = safeClassToken(meta.sectionType);
  const sectionId = safeClassToken(meta.sectionId);

  classes.add('resume-el');
  classes.add(`resume-el-${tag}`);

  if (meta.isScopeRoot) classes.add('resume-preview-scope');

  if (meta.isTemplateRoot) {
    classes.add('resume-root');
    classes.add('resume-template');
    if (template) classes.add(`resume-template-${template}`);
  }

  if (meta.isSection) {
    classes.add('resume-section');
    if (sectionType) classes.add(`resume-section-${sectionType}`);
    if (sectionId) classes.add(`resume-section-id-${sectionId}`);
  } else if (meta.isInsideSection) {
    classes.add('resume-in-section');
    if (sectionType) classes.add(`resume-in-section-${sectionType}`);
  }

  if (meta.isSectionTitle) classes.add('resume-section-title');
  if (meta.isSectionContent) classes.add('resume-section-content');

  switch (tag) {
    case 'header':
      classes.add('resume-header');
      break;
    case 'main':
      classes.add('resume-main');
      break;
    case 'footer':
      classes.add('resume-footer');
      break;
    case 'h1':
      classes.add('resume-title');
      classes.add('resume-name');
      break;
    case 'h2':
      classes.add('resume-heading');
      break;
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      classes.add('resume-subheading');
      classes.add('resume-item-title');
      break;
    case 'p':
      classes.add('resume-text');
      classes.add('resume-paragraph');
      break;
    case 'span':
      classes.add('resume-inline');
      break;
    case 'div':
      classes.add('resume-block');
      break;
    case 'ul':
    case 'ol':
      classes.add('resume-list');
      break;
    case 'li':
      classes.add('resume-list-item');
      break;
    case 'a':
      classes.add('resume-link');
      break;
    case 'img':
      classes.add('resume-image');
      classes.add('resume-avatar');
      break;
    case 'svg':
      classes.add('resume-svg');
      classes.add('resume-icon');
      break;
    case 'table':
      classes.add('resume-table');
      break;
    case 'tr':
      classes.add('resume-table-row');
      break;
    case 'td':
    case 'th':
      classes.add('resume-table-cell');
      break;
  }

  if (meta.isHeaderDescendant) classes.add('resume-header-el');

  const parentClass = meta.parentClass || '';
  if (isLikelyItemTag(tag) && (hasUtilityClass(parentClass, 'space-y-') || hasUtilityClass(parentClass, 'resume-items'))) {
    classes.add('resume-item');
    if (sectionType) classes.add(`resume-item-${sectionType}`);
  }

  return [...classes];
}

function firstTemplateElement(scopeRoot: Element) {
  return Array.from(scopeRoot.children).find((child) => !SKIP_TAGS.has(child.tagName.toLowerCase())) || null;
}

function isDirectSectionContent(el: Element, sectionEl: Element | null) {
  if (!sectionEl || el.parentElement !== sectionEl || el === sectionEl) return false;
  const tag = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return false;
  return !el.querySelector(':scope > h2, :scope > .resume-section-title');
}

export function annotateResumeDom(scopeRoot: Element | null, template?: string) {
  if (!scopeRoot) return;

  const templateRoot = firstTemplateElement(scopeRoot);
  const elements = [scopeRoot, ...Array.from(scopeRoot.querySelectorAll('*'))];

  for (const el of elements) {
    const tagName = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tagName)) continue;

    const sectionEl = el.matches('[data-section]')
      ? el
      : el.closest('[data-section]');
    const sectionType = sectionEl?.getAttribute('data-section-type') || '';
    const isSection = el.matches('[data-section]');
    const classes = buildResumeClassList({
      tagName,
      template,
      isScopeRoot: el === scopeRoot,
      isTemplateRoot: el === templateRoot,
      isSection,
      sectionType,
      sectionId: isSection ? el.getAttribute('data-section-id') || '' : '',
      isInsideSection: !!sectionEl && !isSection,
      isSectionTitle: !!sectionEl && tagName === 'h2',
      isSectionContent: isDirectSectionContent(el, sectionEl),
      isHeaderDescendant: tagName !== 'header' && !!el.closest('header'),
      parentClass: el.parentElement?.getAttribute('class') || '',
    });

    if (classes.length) el.classList.add(...classes);
  }
}

function findTagEnd(html: string, start: number) {
  let quote: string | null = null;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    const prev = html[i - 1];
    if (quote) {
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

function getAttr(openTagContent: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = openTagContent.match(new RegExp(`\\s${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>` + '`' + `]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function hasAttr(openTagContent: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s*=|\\s|/|$)`, 'i').test(openTagContent);
}

function addClassesToOpenTag(openTagContent: string, classes: string[]) {
  if (!classes.length) return openTagContent;
  const selfClose = openTagContent.match(/\s*\/\s*$/)?.[0] || '';
  const body = selfClose ? openTagContent.slice(0, -selfClose.length) : openTagContent;
  const classMatch = body.match(/\sclass\s*=\s*("([^"]*)"|'([^']*)')/i);

  if (classMatch) {
    const quoteAndValue = classMatch[1];
    const quote = quoteAndValue[0];
    const existing = classMatch[2] ?? classMatch[3] ?? '';
    const merged = [...new Set([...splitClasses(existing), ...classes])].join(' ');
    const replacement = ` class=${quote}${merged}${quote}`;
    return `${body.slice(0, classMatch.index)}${replacement}${body.slice((classMatch.index || 0) + classMatch[0].length)}${selfClose}`;
  }

  return `${body} class="${classes.join(' ')}"${selfClose}`;
}

export function annotateResumeHtml(html: string, template?: string) {
  let output = '';
  let i = 0;
  let rootSeen = false;
  const stack: HtmlStackNode[] = [];

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      output += html.slice(i);
      break;
    }

    output += html.slice(i, lt);

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end === -1) {
        output += html.slice(lt);
        break;
      }
      output += html.slice(lt, end + 3);
      i = end + 3;
      continue;
    }

    const gt = findTagEnd(html, lt + 1);
    if (gt === -1) {
      output += html.slice(lt);
      break;
    }

    const rawContent = html.slice(lt + 1, gt);
    const trimmed = rawContent.trim();

    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('?')) {
      output += html.slice(lt, gt + 1);
      i = gt + 1;
      continue;
    }

    if (trimmed.startsWith('/')) {
      const closeTag = safeClassToken(trimmed.slice(1).match(/^([a-zA-Z][\w:-]*)/)?.[1]);
      if (closeTag) {
        while (stack.length) {
          const node = stack.pop();
          if (node?.tagName === closeTag) break;
        }
      }
      output += html.slice(lt, gt + 1);
      i = gt + 1;
      continue;
    }

    const tagName = safeClassToken(trimmed.match(/^([a-zA-Z][\w:-]*)/)?.[1]);
    if (!tagName || SKIP_TAGS.has(tagName)) {
      output += html.slice(lt, gt + 1);
      i = gt + 1;
      continue;
    }

    const selfClosing = /\/\s*$/.test(trimmed) || VOID_TAGS.has(tagName);
    const parent = stack[stack.length - 1];
    const ownClass = getAttr(rawContent, 'class');
    const ownSectionType = getAttr(rawContent, 'data-section-type');
    const isSection = hasAttr(rawContent, 'data-section');
    const sectionType = isSection ? ownSectionType : (parent?.sectionType || '');
    const isTemplateRoot = !rootSeen;

    const classes = buildResumeClassList({
      tagName,
      template,
      isTemplateRoot,
      isSection,
      sectionType,
      sectionId: isSection ? getAttr(rawContent, 'data-section-id') : '',
      isInsideSection: !!sectionType && !isSection,
      isSectionTitle: !!sectionType && tagName === 'h2',
      isSectionContent: !!sectionType && parent?.isSection === true && tagName !== 'h2',
      isHeaderDescendant: stack.some((node) => node.tagName === 'header'),
      parentClass: parent?.className || '',
    });

    const nextRawContent = addClassesToOpenTag(rawContent, classes);
    output += `<${nextRawContent}>`;

    if (!rootSeen) rootSeen = true;
    if (!selfClosing) {
      const mergedClass = [...new Set([...splitClasses(ownClass), ...classes])].join(' ');
      stack.push({ tagName, className: mergedClass, sectionType, isSection });
    }

    i = gt + 1;
  }

  return output;
}
