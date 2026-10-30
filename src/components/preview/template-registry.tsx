'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { Resume } from '@/types/resume';
import type { Template } from '@/lib/constants';

export type ResumeTemplateComponent = ComponentType<{ resume: Resume }>;

function ResumeTemplateLoading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white shadow-lg"
    >
      <div aria-hidden="true" className="animate-pulse space-y-7 p-8">
        <div className="space-y-3 border-b border-zinc-100 pb-6">
          <div className="h-7 w-2/5 rounded bg-zinc-200" />
          <div className="h-4 w-1/4 rounded bg-zinc-100" />
          <div className="h-3 w-3/5 rounded bg-zinc-100" />
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3">
            <div className="h-4 w-1/3 rounded bg-zinc-200" />
            <div className="h-3 w-full rounded bg-zinc-100" />
            <div className="h-3 w-5/6 rounded bg-zinc-100" />
            <div className="h-3 w-2/3 rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export const RESUME_TEMPLATE_COMPONENTS: Record<Template, ResumeTemplateComponent> = {
  'touch-pure': dynamic(
    () => import('./templates/touch-pure').then((module) => module.TouchPureTemplate),
    { loading: ResumeTemplateLoading },
  ),
  'touch-simple': dynamic(
    () => import('./templates/touch-simple').then((module) => module.TouchSimpleTemplate),
    { loading: ResumeTemplateLoading },
  ),
  'touch-flat': dynamic(
    () => import('./templates/touch-flat').then((module) => module.TouchFlatTemplate),
    { loading: ResumeTemplateLoading },
  ),
  'touch-line': dynamic(
    () => import('./templates/touch-line').then((module) => module.TouchLineTemplate),
    { loading: ResumeTemplateLoading },
  ),
  'touch-compact': dynamic(
    () => import('./templates/touch-compact').then((module) => module.TouchCompactTemplate),
    { loading: ResumeTemplateLoading },
  ),
  'touch-card': dynamic(
    () => import('./templates/touch-card').then((module) => module.TouchCardTemplate),
    { loading: ResumeTemplateLoading },
  ),
  'touch-grid': dynamic(
    () => import('./templates/touch-grid').then((module) => module.TouchGridTemplate),
    { loading: ResumeTemplateLoading },
  ),
  'touch-focus': dynamic(
    () => import('./templates/touch-focus').then((module) => module.TouchFocusTemplate),
    { loading: ResumeTemplateLoading },
  ),
  classic: dynamic(
    () => import('./templates/classic').then((module) => module.ClassicTemplate),
    { loading: ResumeTemplateLoading },
  ),
  modern: dynamic(
    () => import('./templates/modern').then((module) => module.ModernTemplate),
    { loading: ResumeTemplateLoading },
  ),
  minimal: dynamic(
    () => import('./templates/minimal').then((module) => module.MinimalTemplate),
    { loading: ResumeTemplateLoading },
  ),
  professional: dynamic(
    () => import('./templates/professional').then((module) => module.ProfessionalTemplate),
    { loading: ResumeTemplateLoading },
  ),
  'two-column': dynamic(
    () => import('./templates/two-column').then((module) => module.TwoColumnTemplate),
    { loading: ResumeTemplateLoading },
  ),
  creative: dynamic(
    () => import('./templates/creative').then((module) => module.CreativeTemplate),
    { loading: ResumeTemplateLoading },
  ),
  ats: dynamic(
    () => import('./templates/ats').then((module) => module.AtsTemplate),
    { loading: ResumeTemplateLoading },
  ),
  academic: dynamic(
    () => import('./templates/academic').then((module) => module.AcademicTemplate),
    { loading: ResumeTemplateLoading },
  ),
  elegant: dynamic(
    () => import('./templates/elegant').then((module) => module.ElegantTemplate),
    { loading: ResumeTemplateLoading },
  ),
  executive: dynamic(
    () => import('./templates/executive').then((module) => module.ExecutiveTemplate),
    { loading: ResumeTemplateLoading },
  ),
  developer: dynamic(
    () => import('./templates/developer').then((module) => module.DeveloperTemplate),
    { loading: ResumeTemplateLoading },
  ),
  designer: dynamic(
    () => import('./templates/designer').then((module) => module.DesignerTemplate),
    { loading: ResumeTemplateLoading },
  ),
  startup: dynamic(
    () => import('./templates/startup').then((module) => module.StartupTemplate),
    { loading: ResumeTemplateLoading },
  ),
  formal: dynamic(
    () => import('./templates/formal').then((module) => module.FormalTemplate),
    { loading: ResumeTemplateLoading },
  ),
  infographic: dynamic(
    () => import('./templates/infographic').then((module) => module.InfographicTemplate),
    { loading: ResumeTemplateLoading },
  ),
  compact: dynamic(
    () => import('./templates/compact').then((module) => module.CompactTemplate),
    { loading: ResumeTemplateLoading },
  ),
  euro: dynamic(
    () => import('./templates/euro').then((module) => module.EuroTemplate),
    { loading: ResumeTemplateLoading },
  ),
  clean: dynamic(
    () => import('./templates/clean').then((module) => module.CleanTemplate),
    { loading: ResumeTemplateLoading },
  ),
  bold: dynamic(
    () => import('./templates/bold').then((module) => module.BoldTemplate),
    { loading: ResumeTemplateLoading },
  ),
  timeline: dynamic(
    () => import('./templates/timeline').then((module) => module.TimelineTemplate),
    { loading: ResumeTemplateLoading },
  ),
  nordic: dynamic(
    () => import('./templates/nordic').then((module) => module.NordicTemplate),
    { loading: ResumeTemplateLoading },
  ),
  corporate: dynamic(
    () => import('./templates/corporate').then((module) => module.CorporateTemplate),
    { loading: ResumeTemplateLoading },
  ),
  consultant: dynamic(
    () => import('./templates/consultant').then((module) => module.ConsultantTemplate),
    { loading: ResumeTemplateLoading },
  ),
  finance: dynamic(
    () => import('./templates/finance').then((module) => module.FinanceTemplate),
    { loading: ResumeTemplateLoading },
  ),
  medical: dynamic(
    () => import('./templates/medical').then((module) => module.MedicalTemplate),
    { loading: ResumeTemplateLoading },
  ),
  gradient: dynamic(
    () => import('./templates/gradient').then((module) => module.GradientTemplate),
    { loading: ResumeTemplateLoading },
  ),
  metro: dynamic(
    () => import('./templates/metro').then((module) => module.MetroTemplate),
    { loading: ResumeTemplateLoading },
  ),
  material: dynamic(
    () => import('./templates/material').then((module) => module.MaterialTemplate),
    { loading: ResumeTemplateLoading },
  ),
  coder: dynamic(
    () => import('./templates/coder').then((module) => module.CoderTemplate),
    { loading: ResumeTemplateLoading },
  ),
  blocks: dynamic(
    () => import('./templates/blocks').then((module) => module.BlocksTemplate),
    { loading: ResumeTemplateLoading },
  ),
  magazine: dynamic(
    () => import('./templates/magazine').then((module) => module.MagazineTemplate),
    { loading: ResumeTemplateLoading },
  ),
  artistic: dynamic(
    () => import('./templates/artistic').then((module) => module.ArtisticTemplate),
    { loading: ResumeTemplateLoading },
  ),
  retro: dynamic(
    () => import('./templates/retro').then((module) => module.RetroTemplate),
    { loading: ResumeTemplateLoading },
  ),
  neon: dynamic(
    () => import('./templates/neon').then((module) => module.NeonTemplate),
    { loading: ResumeTemplateLoading },
  ),
  watercolor: dynamic(
    () => import('./templates/watercolor').then((module) => module.WatercolorTemplate),
    { loading: ResumeTemplateLoading },
  ),
  swiss: dynamic(
    () => import('./templates/swiss').then((module) => module.SwissTemplate),
    { loading: ResumeTemplateLoading },
  ),
  japanese: dynamic(
    () => import('./templates/japanese').then((module) => module.JapaneseTemplate),
    { loading: ResumeTemplateLoading },
  ),
  berlin: dynamic(
    () => import('./templates/berlin').then((module) => module.BerlinTemplate),
    { loading: ResumeTemplateLoading },
  ),
  luxe: dynamic(
    () => import('./templates/luxe').then((module) => module.LuxeTemplate),
    { loading: ResumeTemplateLoading },
  ),
  rose: dynamic(
    () => import('./templates/rose').then((module) => module.RoseTemplate),
    { loading: ResumeTemplateLoading },
  ),
  architect: dynamic(
    () => import('./templates/architect').then((module) => module.ArchitectTemplate),
    { loading: ResumeTemplateLoading },
  ),
  legal: dynamic(
    () => import('./templates/legal').then((module) => module.LegalTemplate),
    { loading: ResumeTemplateLoading },
  ),
  teacher: dynamic(
    () => import('./templates/teacher').then((module) => module.TeacherTemplate),
    { loading: ResumeTemplateLoading },
  ),
  scientist: dynamic(
    () => import('./templates/scientist').then((module) => module.ScientistTemplate),
    { loading: ResumeTemplateLoading },
  ),
  engineer: dynamic(
    () => import('./templates/engineer').then((module) => module.EngineerTemplate),
    { loading: ResumeTemplateLoading },
  ),
  sidebar: dynamic(
    () => import('./templates/sidebar').then((module) => module.SidebarTemplate),
    { loading: ResumeTemplateLoading },
  ),
  card: dynamic(
    () => import('./templates/card').then((module) => module.CardTemplate),
    { loading: ResumeTemplateLoading },
  ),
  zigzag: dynamic(
    () => import('./templates/zigzag').then((module) => module.ZigzagTemplate),
    { loading: ResumeTemplateLoading },
  ),
  ribbon: dynamic(
    () => import('./templates/ribbon').then((module) => module.RibbonTemplate),
    { loading: ResumeTemplateLoading },
  ),
  mosaic: dynamic(
    () => import('./templates/mosaic').then((module) => module.MosaicTemplate),
    { loading: ResumeTemplateLoading },
  ),
};
