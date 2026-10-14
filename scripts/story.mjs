// Runs Vite for one story from stories/:
//
//   npm run dev poker        local server, also reachable from a phone
//   npm run build poker      type check, then dist/poker for the CDN
//   npm run preview poker    serves dist/poker
//
// Without a name it takes the only story there is, or lists them. Anything
// after the name goes to Vite: npm run preview -- poker --host --port 4310
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITE = path.join(ROOT, 'node_modules/vite/bin/vite.js');
const VUE_TSC = path.join(ROOT, 'node_modules/vue-tsc/bin/vue-tsc.js');

const COMMANDS = {
  dev: [VITE, '--host'],
  build: [VITE, 'build'],
  preview: [VITE, 'preview'],
};

const [command, ...rest] = process.argv.slice(2);
if (!COMMANDS[command]) {
  console.error('usage: node scripts/story.mjs <dev|build|preview> [story]');
  process.exit(1);
}
const story = rest[0] && !rest[0].startsWith('-') ? rest.shift() : undefined;
const env = story ? { ...process.env, STORY: story } : process.env;

// Node runs the tools' own entry files, so this works the same on Windows.
const run = (args) =>
  new Promise((resolve) => {
    spawn(process.execPath, args, { cwd: ROOT, env, stdio: 'inherit' }).on(
      'exit',
      (code) => resolve(code ?? 1)
    );
  });

let code = 0;
if (command === 'build') code = await run([VUE_TSC, '--noEmit']);
if (code === 0) code = await run([...COMMANDS[command], ...rest]);
process.exitCode = code;
