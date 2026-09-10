// Red Team probe: for every commit that touched api/tests/_all.runner.mts,
// does every test file the runner references actually exist IN THAT COMMIT?
// A commit that registers a test whose file is not in the same tree breaks
// `npm test` for anyone who checks it out — the 5df5069 class.
import { execFileSync } from 'node:child_process';

const REPO = 'C:/Users/Ardalan/Desktop/rezv/Rezv';
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const commits = git('log', '--since=2026-09-09 00:00', '--format=%h', 'main', '--', 'api/tests/_all.runner.mts')
  .split('\n').map(s => s.trim()).filter(Boolean);

console.log(`commits touching _all.runner.mts today: ${commits.length}\n`);

let broken = 0;
for (const c of commits) {
  let runner;
  try {
    runner = git('show', `${c}:api/tests/_all.runner.mts`);
  } catch {
    console.log(`${c}  <runner unreadable>`);
    continue;
  }
  // every relative import in the runner
  const refs = [...runner.matchAll(/import\s+['"]\.\/([^'"]+)['"]/g)].map(m => m[1]);
  const missing = [];
  for (const r of refs) {
    try {
      git('cat-file', '-e', `${c}:api/tests/${r}`);
    } catch {
      missing.push(r);
    }
  }
  const subject = git('log', '-1', '--format=%s', c).trim();
  if (missing.length) {
    broken++;
    console.log(`BROKEN  ${c}  refs=${refs.length}  MISSING=${missing.join(', ')}`);
    console.log(`        ${subject}`);
  } else {
    console.log(`ok      ${c}  refs=${refs.length}   ${subject.slice(0, 60)}`);
  }
}
console.log(`\ncommits registering a test file absent from their own tree: ${broken}`);
process.exit(broken > 0 ? 1 : 0);
