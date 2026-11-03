import { readFile, mkdir, writeFile } from 'node:fs/promises';

const template = await readFile(new URL('../site/index.template.html', import.meta.url), 'utf8');
const sha = (process.env.GITHUB_SHA || 'local').replace(/[^a-f0-9]/gi, '').slice(0, 12) || 'local';
const html = template.replace('{{BUILD_SHA}}', sha);
if (html.includes('{{BUILD_SHA}}')) throw new Error('Unexpanded build placeholder');
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/index.html', import.meta.url), html);
console.log('Built dist/index.html for ' + sha);
