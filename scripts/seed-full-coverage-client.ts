// @ts-nocheck
import { QA_SCENARIOS, check, seedScenario, summarize, waitForHealthyApp, writeArtifact } from './qa-v2-lib';

async function main() {
  const selected = String(process.argv[2] || process.env.SEED_SCENARIO || 'realistic').trim().toLowerCase();
  const scenario = QA_SCENARIOS.find((item) => item.key.toLowerCase() === selected) || QA_SCENARIOS[0];
  const results: any[] = [];
  let seeded: any = null;

  results.push(await check('preflight:health', async () => {
    const ready = await waitForHealthyApp();
    return { ok: true, status: ready.status, detail: `Health ready in ${ready.waitedMs}ms`, data: ready.data };
  }));

  if (results[0]?.ok) {
    results.push(await check(`seed:${scenario.key}`, async () => {
      seeded = await seedScenario(scenario, { generateOutputs: true });
      return {
        ok: true,
        detail: `Seeded full coverage client ${seeded.clientId} with assessment ${seeded.assessmentId}.`,
        data: seeded,
      };
    }));
  }

  const payload = {
    startedAt: new Date().toISOString(),
    selectedScenario: scenario.key,
    seeded,
    summary: summarize(results),
    results,
  };

  writeArtifact('qa-full-coverage-client-latest.json', payload);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeArtifact(`qa-full-coverage-client-${stamp}.json`, payload);
  console.log(JSON.stringify(payload, null, 2));
  if (payload.summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
