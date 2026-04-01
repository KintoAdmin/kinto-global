// @ts-nocheck
import {
  APP_BASE_URL,
  QA_SCENARIOS,
  check,
  requestJson,
  seedScenario,
  summarize,
  verifyAssessment,
  waitForHealthyApp,
  writeArtifact,
} from './qa-v2-lib';

async function main() {
  const startedAt = new Date().toISOString();
  const seeded = [] as any[];
  const results = [] as any[];

  results.push(await check('health', async () => {
    const ready = await waitForHealthyApp();
    return {
      ok: true,
      status: ready.status,
      detail: `Health route responded after ${ready.waitedMs}ms.`,
      data: ready.data,
    };
  }));

  results.push(await check('clients:list-before', async () => {
    const { res, data, text } = await requestJson('/api/clients', { timeoutMs: 20000, logLabel: 'clients:list-before' });
    return {
      ok: res.ok && Array.isArray(data),
      status: res.status,
      detail: res.ok ? `Returned ${Array.isArray(data) ? data.length : 0} clients.` : text,
      data: { count: Array.isArray(data) ? data.length : 0 },
    };
  }));

  for (const scenario of QA_SCENARIOS) {
    const seedResult = await check(`scenario:${scenario.key}:seed`, async () => {
      const seededScenario = await seedScenario(scenario);
      seeded.push(seededScenario);
      writeArtifact(`qa-full-system-v2-seeded-${scenario.key}.json`, seededScenario);
      return {
        ok: true,
        detail: `Seeded ${scenario.label} with full module coverage.`,
        data: seededScenario,
      };
    });
    results.push(seedResult);

    if (seedResult.ok) {
      const seededScenario = seeded[seeded.length - 1];
      const verificationResults = await verifyAssessment(seededScenario);
      results.push(...verificationResults);
    }
  }

  const payload = {
    appBaseUrl: APP_BASE_URL,
    startedAt,
    runAt: new Date().toISOString(),
    summary: summarize(results),
    seeded,
    results,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeArtifact(`qa-full-system-v2-${stamp}.json`, payload);
  writeArtifact('qa-full-system-v2-latest.json', payload);

  console.log(`\nFULL SYSTEM QA V2 SUMMARY: ${payload.summary.passed}/${payload.summary.total} passed, ${payload.summary.failed} failed.\n`);
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.status ? ` [${result.status}]` : ''}`);
    if (result.detail) console.log(`      ${result.detail}`);
  }

  if (payload.summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
