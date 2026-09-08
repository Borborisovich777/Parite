import { execFileSync } from 'node:child_process';

// .gitignore does not protect files that were already tracked or force-added.
// Check the index, including staged changes, without reading any secret values.
const files = execFileSync('git', [
  'ls-files', '--cached', '--ignored', '--exclude-standard', '-z',
], { encoding: 'utf8' }).split('\0').filter(Boolean);

if (files.length) {
  console.error('Private/local files are tracked by Git:');
  for (const file of files) console.error(`  ${JSON.stringify(file)}`);
  console.error('Remove these from the index with git rm --cached before committing.');
  process.exitCode = 1;
} else {
  console.log('No ignored private/local files are tracked.');
}
