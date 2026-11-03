import { promises as fs } from 'node:fs';
import path from 'node:path';
const [dir, output] = process.argv.slice(2);
if (!dir || !output) throw Error('Usage: summarize-evidence.mjs DIR OUTPUT');
const root = path.resolve(dir);
const files = [], spans = [], tokens = [];
let records = 0, badRecords = 0;
async function walk(folder) {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    if (files.length >= 200) return;
    if (entry.isSymbolicLink()) continue;
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) { await walk(file); continue; }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(file);
    files.push({ name: path.relative(root, file), size: stat.size });
    if (!/\.jsonl?$/.test(file) || stat.size > 12000000) continue;
    const source = await fs.readFile(file, 'utf8');
    const lines = file.endsWith('.jsonl') ? source.split('\n') : [source];
    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.length > 1000000) { badRecords++; continue; }
      let data;
      try { data = JSON.parse(line); } catch { badRecords++; continue; }
      records++;
      for (const res of data.resourceSpans || []) {
        for (const scope of res.scopeSpans || []) {
          for (const span of scope.spans || []) {
            if (spans.length >= 10000) break;
            const start = BigInt(span.startTimeUnixNano || 0);
            const end = BigInt(span.endTimeUnixNano || 0);
            const ms = Number(end - start) / 1e6;
            spans.push({ name: String(span.name || 'unknown').slice(0,120),
              durationMs: ms >= 0 && Number.isFinite(ms) ? Math.round(ms * 100) / 100 : null,
              status: String(span.status?.code ?? 'unset') });
          }
        }
      }
      for (const sample of [data, data.usage, data.token_usage, data.tokenUsage]) {
        if (!sample || typeof sample !== 'object' || tokens.length >= 100) continue;
        const item = {};
        for (const key of ['input_tokens','output_tokens','total_tokens','prompt_tokens','completion_tokens']) {
          if (Number.isSafeInteger(sample[key]) && sample[key] >= 0) item[key] = sample[key];
        }
        if (Object.keys(item).length) tokens.push(item);
      }
    }
  }
}
await walk(root);
spans.sort((a,b) => (b.durationMs || 0)-(a.durationMs || 0));
const result = { files, records, badRecords, spanCount:spans.length,
  slowestSpans:spans.slice(0,30), tokenSamples:tokens,
  caveat:'Token samples may overlap; do not sum blindly. Missing measurements are unknown.' };
await fs.mkdir(path.dirname(path.resolve(output)), {recursive:true});
await fs.writeFile(output, JSON.stringify(result,null,2)+'\n');
console.log('Wrote '+output);
