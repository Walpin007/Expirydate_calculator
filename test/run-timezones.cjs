'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
let failed = false;
for (const TZ of ['Asia/Seoul', 'UTC', 'America/New_York']) {
  console.log(`\n=== Host timezone: ${TZ} ===`);
  const result = spawnSync(process.execPath, ['--test', 'test/calculator.test.cjs', 'test/pwa.test.cjs'], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, TZ }, stdio: 'inherit'
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
