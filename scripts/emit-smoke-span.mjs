import { randomBytes } from 'node:crypto';
const now = BigInt(Date.now()) * 1000000n;
const span = {
  traceId: randomBytes(16).toString('hex'),
  spanId: randomBytes(8).toString('hex'),
  name: 'collector.smoke',
  kind: 1,
  startTimeUnixNano: String(now),
  endTimeUnixNano: String(now + 1000000n)
};
const body = { resourceSpans: [{
  resource: { attributes: [{ key: 'service.name', value: { stringValue: 'otel-nugs-smoke' } }] },
  scopeSpans: [{ scope: { name: 'otel-nugs-smoke' }, spans: [span] }]
}] };
const response = await fetch('http://127.0.0.1:4318/v1/traces', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});
if (!response.ok) throw new Error('OTLP export failed: HTTP ' + response.status + ' ' + await response.text());
console.log('Exported collector.smoke span');
