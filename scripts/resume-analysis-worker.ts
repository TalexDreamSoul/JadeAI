import { runResumeAnalysisWorker } from '../src/lib/resume-analysis/worker';

const workerId = process.env.RESUME_ANALYSIS_WORKER_ID;
const pollIntervalMs = Number(process.env.RESUME_ANALYSIS_POLL_INTERVAL_MS || 3000);

runResumeAnalysisWorker({ workerId, pollIntervalMs }).catch((error) => {
  console.error('[resume-analysis-worker] crashed:', error);
  process.exit(1);
});
