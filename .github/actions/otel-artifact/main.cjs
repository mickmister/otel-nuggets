'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const actionDir = __dirname;
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'otel-nugs-'));
const dependenciesDir = path.join(outputDir, 'deps');
const containerName = 'otel-nugs-collector-' + process.pid;
const image = 'otel/opentelemetry-collector-contrib:0.136.0';

function append(file, key, value) {
  fs.appendFileSync(file, key + '=' + value + '\n');
}

function command(binary, args) {
  execFileSync(binary, args, { stdio: 'inherit', timeout: 180000 });
}

try {
  // Install the official artifact client for use in the post-job hook.
  // The package is intentionally scoped to the runner's temp directory.
  command('npm', [
    'install', '--silent', '--no-audit', '--no-fund',
    '--prefix', dependenciesDir, '--save=false', '@actions/artifact@2.3.2'
  ]);

  command('docker', [
    'run', '--detach', '--name', containerName, '--network', 'host',
    '--volume', actionDir + '/collector.yaml:/etc/otelcol-contrib/config.yaml:ro',
    '--volume', outputDir + ':/otel',
    image, '--config=/etc/otelcol-contrib/config.yaml'
  ]);

  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      // A valid empty OTLP/HTTP export confirms the receiver is listening.
      execFileSync('curl', [
        '--fail', '--silent', '--show-error', '--max-time', '2',
        '-H', 'Content-Type: application/json',
        '-d', '{"resourceSpans":[]}',
        'http://127.0.0.1:4318/v1/traces'
      ], { stdio: 'ignore' });
      ready = true;
      break;
    } catch {
      execFileSync('sleep', ['1']);
    }
  }
  if (!ready) throw new Error('OTLP receiver did not become ready');

  append(process.env.GITHUB_STATE, 'otel_dir', outputDir);
  append(process.env.GITHUB_STATE, 'collector_name', containerName);

  for (const [key, value] of Object.entries({
    OTEL_SERVICE_NAME: 'otel-nugs-ci',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318',
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
    OTEL_TRACES_EXPORTER: 'otlp',
    OTEL_METRICS_EXPORTER: 'otlp',
    OTEL_LOGS_EXPORTER: 'otlp'
  })) append(process.env.GITHUB_ENV, key, value);

  console.log('Local OTLP receiver ready on 127.0.0.1:4318');
} catch (error) {
  console.error(error);
  try { command('docker', ['rm', '--force', containerName]); } catch {}
  process.exitCode = 1;
}
