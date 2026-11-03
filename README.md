# OTel Nugs

A small GitHub Actions experiment for **artifact-first CI observability**.

On every branch push, the workflow:

1. Checks out the repository and starts a local OpenTelemetry Collector.
2. Enables [Thoth](https://github.com/plengauer/Thoth) automatic job instrumentation.
3. Runs Node's built-in unit tests and builds a static HTML file (no npm dependencies).
4. Runs Nginx in Docker, curls the page, compares its bytes with the built file, checks a 404, and collects request timings.
5. Executes Thoth's post hook, then stops the Collector and uploads an `otel-<job>-<attempt>` artifact from our earlier-registered post hook.

The artifact contains newline-delimited OTLP JSON (traces, metrics and logs when produced), Collector diagnostics, and run metadata. Download it under **Actions → workflow run → Artifacts**. Inspect spans by parsing each line of `traces.json`; not every OTLP signal is guaranteed to be populated.

The collector receives OTLP/HTTP at `127.0.0.1:4318` and OTLP/gRPC at `127.0.0.1:4317`. The setup action exports standard `OTEL_*` environment variables through `GITHUB_ENV`. This is job-local, not a workflow-wide collector. The collector uses Docker host networking on the Ubuntu runner.

## Important limitations

- **Experiment, not production-hardened:** the action installs `@actions/artifact` during setup, adding setup time and external dependency. The Collector image and client package are version-pinned, not digest-pinned.
- The artifact upload occurs during normal post-job cleanup after ordinary build failures. Runner loss, hard cancellation, or timeout can prevent it.
- Trace data can contain sensitive attributes, command arguments, and environment-derived values. Thoth is configured to redact GitHub secrets; inspect generated artifacts before sharing or enabling on sensitive repositories.
- This exercises instrumentation and teardown behavior, but actual performance overhead, data volume, and Thoth compatibility must be measured in GitHub-hosted runs.
- The artifact upload is best-effort to preserve the CI result if diagnostics fail; the collector **setup** must succeed for this experiment to proceed.

The action code under `.github/actions/otel-artifact` is intentionally local to make it easy to later extract into a reusable standalone action.
