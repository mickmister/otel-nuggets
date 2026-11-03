import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('HTML template includes expected heading and build marker', async () => {
  const html = await readFile(new URL('../site/index.template.html', import.meta.url), 'utf8');
  assert.match(html, /<h1>OTel Nugs demo<\/h1>/);
  assert.match(html, /{{BUILD_SHA}}/);
  assert.match(html, /<meta charset="utf-8">/);
});
