#!/usr/bin/env node
// Mandatory batch entry point (Section 9):
//   npm run evaluate -- --input <cases.json> --output <kits.json>
// Uses the exact same generateKit() pipeline as the HTTP API - no parallel
// implementation. Continues after a case fails instead of aborting the run,
// and does not require MongoDB (batch mode is stateless, per "needs no
// setup beyond your documented install step").
import fs from 'node:fs/promises';
import { generateKit } from '../src/services/generation/pipeline.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') out.input = argv[++i];
    if (argv[i] === '--output') out.output = argv[++i];
  }
  return out;
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  if (!input || !output) {
    console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
    process.exit(1);
  }

  const raw = await fs.readFile(input, 'utf-8');
  const cases = JSON.parse(raw);
  const kits = [];

  for (const c of cases) {
    try {
      // Company sites used by this command may be served from a local
      // address (Section 9) - allowLoopback lets the crawler follow them.
      const { kit, validation, skipped } = await generateKit(
        { jd: c.jd, companyUrl: c.company_url, days: c.days },
        { allowLoopback: true }
      );
      if (!validation.valid) {
        kits.push({
          id: c.id,
          status: 'failed',
          kit: null,
          error: { code: 'INVALID_KIT_STRUCTURE', message: validation.errors.join('; ') },
        });
        continue;
      }
      kits.push({ id: c.id, status: 'ok', kit, error: null, skipped });
    } catch (err) {
      kits.push({
        id: c.id,
        status: 'failed',
        kit: null,
        error: { code: err.code || 'UNKNOWN_ERROR', message: err.message },
      });
    }
  }

  const result = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits,
  };

  await fs.writeFile(output, JSON.stringify(result, null, 2));
  console.log(`Wrote ${kits.length} kit(s) to ${output}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
