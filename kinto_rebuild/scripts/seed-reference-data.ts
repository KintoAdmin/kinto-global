// @ts-nocheck
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadDotEnvFile(fileName: string) {
  const filePath = join(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile('.env.local');
loadDotEnvFile('.env');

async function main() {
  const [{ getAdminClient }, { buildReferenceSeedRows }, { MODULE_REGISTRY }] = await Promise.all([
    import('@/lib/supabase/admin'),
    import('@/lib/reference/seed'),
    import('@/lib/constants/modules')
  ]);

  const supabase = getAdminClient();

  const modules = MODULE_REGISTRY.map((row) => ({ ...row, updated_at: new Date().toISOString() }));
  const moduleRes = await supabase.from('modules').upsert(modules);
  if (moduleRes.error) throw moduleRes.error;

  const rows = buildReferenceSeedRows().map((item) => ({
    module_code: item.module_code,
    record_type: item.record_type,
    record_key: item.record_key,
    parent_key: item.parent_key,
    order_index: item.order_index,
    payload: item.payload,
    updated_at: new Date().toISOString()
  }));

  const batchSize = 500;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const res = await supabase.from('reference_records').upsert(batch, { onConflict: 'module_code,record_type,record_key' });
    if (res.error) throw res.error;
  }

  console.log(`Seeded ${rows.length} reference records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
