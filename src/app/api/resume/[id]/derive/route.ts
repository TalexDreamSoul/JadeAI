import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { mergeTailoredSections, resumeTailoringSchema } from '@/lib/ai/resume-tailoring';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { extractJson } from '@/lib/ai/extract-json';
import { AIConfigError, extractAIConfig, getModel, getProviderOptions } from '@/lib/ai/provider';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { AIUsageInsufficientCreditsError, withMeteredAIUsage } from '@/lib/commercial/ai-route-metering';
import {
  assertCanCreateResume,
  commercialFeatureLockedResponse,
  CommercialFeatureLockedError,
} from '@/lib/commercial/feature-gate-service';

type ResumeRecord = NonNullable<Awaited<ReturnType<typeof resumeRepository.findById>>>;

async function tailorResumeSections(
  aiConfig: Awaited<ReturnType<typeof extractAIConfig>>,
  resume: ResumeRecord,
  jobDescription: string
) {
  const result = await generateText({
    model: getModel(aiConfig),
    system: `You tailor a source resume for a target JD.
Return JSON only. Improve relevance and wording in summary, skills, work experience, and projects.
Preserve the resume language, section structure, item IDs, dates, employers, titles, links, and all factual claims.
Never invent skills, metrics, responsibilities, projects, or experience that are not supported by the source resume.
For workExperience and projects, return only existing items using their exact IDs.`,
    prompt: JSON.stringify({
      jobDescription,
      sections: resume.sections,
    }),
    maxOutputTokens: 6144,
    providerOptions: getProviderOptions(aiConfig),
    output: Output.json(),
  });

  const tailored = extractJson(result.text, resumeTailoringSchema);
  return {
    sections: mergeTailoredSections(resume.sections, tailored),
    usage: result.usage,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resume = await resumeRepository.findById(id);
    if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const targetCompany = String(body.targetCompany || '').trim();
    const targetJobTitle = String(body.targetJobTitle || '').trim();
    const jobDescription = String(body.jobDescription || '').trim();
    const requestedDerivedResumeId = String(body.derivedResumeId || '').trim();
    const baseResumeId = resume.baseResumeId || (resume.isBase ? resume.id : resume.sourceResumeId) || resume.id;
    let existingDerived: ResumeRecord | null = null;

    if (requestedDerivedResumeId) {
      existingDerived = await resumeRepository.findById(requestedDerivedResumeId);
      if (!existingDerived) return NextResponse.json({ error: 'Derived resume not found' }, { status: 404 });
      if (existingDerived.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const belongsToSource = existingDerived.id !== resume.id && (
        existingDerived.sourceResumeId === resume.id ||
        existingDerived.baseResumeId === baseResumeId
      );
      if (!belongsToSource) {
        return NextResponse.json({ error: 'Derived resume does not belong to this source resume' }, { status: 400 });
      }
    } else {
      await assertCanCreateResume(user.id, Number(user.aiCredits || 0));
    }

    const requestedTitle = String(body.title || '').trim();
    const title = requestedTitle
      || existingDerived?.title
      || `${resume.title} - ${targetCompany || targetJobTitle || 'JD'}`;

    const upsertDerivedResume = async (aiConfig?: Awaited<ReturnType<typeof extractAIConfig>>) => {
      const tailored = jobDescription && aiConfig
        ? await tailorResumeSections(aiConfig, resume, jobDescription)
        : null;
      const sections = tailored?.sections || resume.sections;
      let derived: ResumeRecord | null;

      if (existingDerived) {
        await resumeRepository.update(existingDerived.id, {
          title,
          template: resume.template,
          themeConfig: resume.themeConfig,
          language: resume.language,
          sourceResumeId: resume.id,
          baseResumeId,
          targetCompany: targetCompany || null,
          targetJobTitle: targetJobTitle || null,
          jobDescription: jobDescription || null,
          versionLabel: 'jd-v1',
        });
        derived = await resumeRepository.replaceSections(existingDerived.id, sections);
      } else {
        derived = await resumeRepository.createFromSnapshot(
          { ...resume, sections },
          user.id,
          title,
          {
            sourceResumeId: resume.id,
            baseResumeId,
            targetCompany: targetCompany || null,
            targetJobTitle: targetJobTitle || null,
            jobDescription: jobDescription || null,
            versionLabel: 'jd-v1',
          }
        );
      }

      if (!derived) throw new Error('Failed to save derived resume');
      const refreshed = !!existingDerived;
      await resumeRepository.createEvent({
        resumeId: derived.id,
        userId: user.id,
        type: refreshed ? 'resume.derived_refreshed' : 'resume.derived',
        title: refreshed ? 'Derived resume refreshed' : 'Derived resume created',
        description: targetCompany || targetJobTitle || '',
        metadata: { sourceResumeId: resume.id, targetCompany, targetJobTitle, tailored: !!jobDescription },
      });
      await resumeRepository.createVersion(derived.id, 'jd-v1', derived, 'jd');

      return {
        resume: derived,
        usage: tailored?.usage,
        metadata: {
          sourceResumeId: resume.id,
          derivedResumeId: derived.id,
          targetCompany,
          targetJobTitle,
          refreshed,
        },
      };
    };

    if (!jobDescription) {
      const result = await upsertDerivedResume();
      return NextResponse.json(result.resume, { status: existingDerived ? 200 : 201 });
    }

    const aiConfig = await extractAIConfig(request);
    const result = await withMeteredAIUsage({
      userId: user.id,
      aiConfig,
      feature: 'resume.derive',
      metadata: { sourceResumeId: resume.id, targetCompany, targetJobTitle, derivedResumeId: existingDerived?.id },
      run: async () => {
        const derivedResult = await upsertDerivedResume(aiConfig);
        return {
          value: derivedResult,
          usage: derivedResult.usage,
          metadata: derivedResult.metadata,
        };
      },
    });

    return NextResponse.json(result.resume, { status: existingDerived ? 200 : 201 });
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AIUsageInsufficientCreditsError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    if (error instanceof CommercialFeatureLockedError) {
      return commercialFeatureLockedResponse(error);
    }
    console.error('POST /api/resume/[id]/derive error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
