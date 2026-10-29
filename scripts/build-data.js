// Converts data/*.yaml into src/generated/commands.json, validating every entry.
// Usage: npm run build-data

import { buildData, writeGenerated } from './commands-lib.js';

const result = await buildData();

if (result.errors.length) {
  console.error(`build-data: ${result.errors.length} error(s)\n`);
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}

await writeGenerated(result);

console.log(`build-data: ${result.commands.length} commands from ${result.tools.length} files`);
for (const t of result.tools) console.log(`  ${t.id.padEnd(12)} ${t.count}`);
