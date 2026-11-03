# Three-workflow experiment

1. **OTel Nginx demo** (`.github/workflows/otel-nginx.yml`): pushes to every branch; builds HTML, runs tests, serves it via Nginx and curl, uploads a Thoth/Collector `otel-*` artifact.
2. **Analyze CI with Copilot** (`otel-review.md`): manually supply a completed workflow 1 run ID. gh-aw downloads the OTel artifact, creates a bounded evidence summary, and asks Copilot to review CI performance. The built-in gh-aw agent artifact captures output, telemetry and usage.
3. **Analyze Copilot Agent with Copilot** (`analyze-agent.md`): manually supply a completed workflow 2 run ID. gh-aw downloads its `agent` and optional `usage` artifacts, then Copilot evaluates the previous agent's latency, tokens, tool behavior and evidence quality.

The two AI workflows are read-only, limited to **20 turns / 500 AI credits** each. The third is the end of the chain and does not trigger another agent.

## Setup

- Configure `COPILOT_GITHUB_TOKEN` as a repository secret containing a **fine-grained personal GitHub token with Copilot Requests permission**, owned by a Copilot-entitled account. In this personal repository, do not rely on organization-billed `copilot-requests: write`.
- gh-aw Markdown files are not executable workflows until compiled. `compile-agentic.yml` installs gh-aw, compiles both source files into `*.lock.yml`, and commits those generated files back to the same branch. The compile job triggers on changes to the Markdown source, or manually through workflow_dispatch. **Review the lock-file diff before running Copilot.**
- GitHub may require Actions approval. After the compile job passes, launch Workflow 2 using a workflow 1 run ID. After Workflow 2 completes, launch Workflow 3 using its run ID.
- Both agent workflows start the same job-local OTel Collector before agent execution and use gh-aw **native OTLP export** to `host.docker.internal:4318` (the Docker sandbox's host gateway). gh-aw also includes native trace and usage artifacts. Validate container-to-host OTLP connectivity in the first live run; agent-native artifacts are a fallback.
- Source compilation and Copilot access must be validated on real GitHub runners. The bootstrap compiler uses a moving gh-aw CLI version for the experiment; pin it for long-term usage.

Security: upstream artifacts are untrusted input. The summarizer limits files/record sizes and avoids copying arbitrary telemetry attributes into the AI context. Raw artifacts can still contain secrets; inspect before sharing. Forced runner termination can prevent artifact collection.
