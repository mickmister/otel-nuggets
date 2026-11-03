'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const outputDir = process.env.STATE_otel_dir;
const containerName = process.env.STATE_collector_name;

async function main() {
  if (!outputDir || !containerName) {
    console.warn('Collector was not initialized; no artifact to upload');
    return;
  }

  // Thoth's post hook runs first because this action was registered first.
  try {
    fs.writeFileSync(path.join(outputDir, 'collector.log'),
      execFileSync('docker', ['logs', containerName], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
      }));
  } catch (error) {
    fs.writeFileSync(path.join(outputDir, 'collector.log'),
      String(error.stderr || error.message));
  }

  try {
    execFileSync('docker', ['stop', '--time', '15', containerName], {
      stdio: 'inherit', timeout: 30000
    });
  } catch (error) {
    console.warn('Collector stop failed:', error.message);
  }
  try {
    execFileSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
  } catch {}

  fs.writeFileSync(path.join(outputDir, 'metadata.json'), JSON.stringify({
    repository: process.env.GITHUB_REPOSITORY,
    workflow: process.env.GITHUB_WORKFLOW,
    run_id: process.env.GITHUB_RUN_ID,
    run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    job: process.env.GITHUB_JOB,
    sha: process.env.GITHUB_SHA,
    ref: process.env.GITHUB_REF,
    generated_at: new Date().toISOString()
  }, null, 2));

  const files = ['traces.json', 'metrics.json', 'logs.json', 'collector.log', 'metadata.json']
    .map(name => path.join(outputDir, name))
    .filter(file => fs.existsSync(file) && fs.statSync(file).isFile());
  const { DefaultArtifactClient } = require(
    path.join(outputDir, 'deps', 'node_modules', '@actions', 'artifact')
  );
  const artifact = new DefaultArtifactClient();
  const name = 'otel-' + (process.env.GITHUB_JOB || 'job') + '-' +
    (process.env.GITHUB_RUN_ATTEMPT || '1');
  const result = await artifact.uploadArtifact(name, files, outputDir, {
    retentionDays: 7
  });
  console.log('Uploaded ' + name + ' (' + result.size + ' bytes)');
}

main().catch(error => {
  // Telemetry failures must not replace the original build result.
  console.warn('Unable to upload OTel artifact:', error);
  process.exitCode = 0;
});
