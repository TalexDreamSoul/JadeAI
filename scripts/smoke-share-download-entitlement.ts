import { NextRequest } from 'next/server';
import { GET } from '@/app/api/share/[token]/download/route';
import { dbReady, db } from '@/lib/db';
import { resumes, resumeShares, users } from '@/lib/db/schema';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  await dbReady;

  const userId = `smoke-share-owner-${crypto.randomUUID()}`;
  const resumeId = `smoke-share-resume-${crypto.randomUUID()}`;
  const token = `smoke-share-${crypto.randomUUID()}`;

  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'Smoke Share Owner',
  });
  await db.insert(resumes).values({
    id: resumeId,
    userId,
    title: 'Smoke Share Resume',
    template: 'touch-pure',
    language: 'zh',
  });
  await db.insert(resumeShares).values({
    id: crypto.randomUUID(),
    resumeId,
    token,
    downloadEnabled: true,
    isActive: true,
  });

  const response = await GET(
    new NextRequest(`http://localhost/api/share/${token}/download?format=docx`),
    { params: Promise.resolve({ token }) },
  );
  assert(response.status === 402, `expected free owner docx share download to be locked, got ${response.status}`);
  const payload = await response.json();
  assert(payload.code === 'resume_export_locked', `expected resume_export_locked, got ${payload.code}`);
  assert(payload.entitlement === 'resume.export.docx', `expected resume.export.docx entitlement, got ${payload.entitlement}`);

  console.log('[smoke] share download entitlement passed');
}

main().catch((error) => {
  console.error('[smoke] share download entitlement failed');
  console.error(error);
  process.exit(1);
});
