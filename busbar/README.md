# Busbar services

The frontend and busbar API build and deploy independently. Nginx provides one
browser-facing origin; no API hostname is embedded in the frontend bundle.

```text
Browser -> localhost:8080 -> gateway
                             |-- /api and /api/* -> busbar-api:8000
                             |-- /health        -> gateway health
                             `-- everything else -> frontend:8080
```

The API owns `calc.py` and the existing `POST /api/calculate` contract. The
frontend contains only UI code. The services share no filesystem or database.
Only the gateway publishes a host port, bound to localhost. Service names on
the Compose network provide internal DNS. The gateway refreshes those DNS
records so backend/frontend container replacement does not require rebuilding
or restarting it. Brief errors during replacement are possible; this is not
a zero-downtime orchestrator.

## Version control

The Git repository root is `F:\phase\phase-allocation`; `busbar` is a project
directory inside it. Keep application code, Dockerfiles, Compose configuration,
tests, dependency lockfiles, and deployment documentation in Git.

The repository-root `.gitignore` excludes local environment files, secret
directories, common private-key files, credential JSON files, and service-account
JSON files at any depth. `.env.example` remains trackable and must contain only
non-secret defaults or placeholders. The project `.gitignore` additionally
excludes installed dependencies, build output, Python caches, and Playwright
artifacts/authentication state.

Review and stage only intended files, then inspect the staged diff before
committing. Run these commands from the repository root:

```powershell
git status --short
git diff
git add -- .gitignore busbar/README.md
git diff --cached
git commit -m "Document version control and exclude local secrets" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push origin main
```

That example stages only the version-control setup. Stage reviewed application
changes explicitly by path in a separate commit; do not blindly add every file.
If Git is not on PowerShell's PATH, restart the terminal after configuring Git,
or invoke `C:\Program Files\Git\cmd\git.exe` with PowerShell's `&` operator.

Ignore rules do not remove already tracked files or detect secrets embedded in
source code. Before each commit, review the staged content for credentials.
If a secret was committed, revoke/rotate it immediately and coordinate history
cleanup; deleting it in a later commit does not remove it from earlier commits.

## Run with Docker

Prerequisites: Docker Desktop with Linux containers and Docker Compose v2.
Run the following from this directory (`F:\phase\phase-allocation\busbar`):

```powershell
docker compose config
docker compose up --build -d --wait
docker compose ps
.\deploy\smoke-test.ps1
```

Open http://localhost:8080. Docker is not required on the browser machine,
but it must be installed and running on the deployment machine.

Override the port using an environment variable or an untracked `.env` file;
`.env.example` lists the supported setting. For example:

```powershell
$env:HTTP_PORT = '8081'
docker compose up -d --wait
.\deploy\smoke-test.ps1 -BaseUrl http://localhost:8081
```

```powershell
docker compose logs -f gateway busbar-api
docker compose down
```

The gateway health endpoint checks Nginx itself. Each application container
has its own `/health` probe, and initial gateway startup waits for both.
Use the smoke test to check end-to-end availability, including JSON errors,
calculation output, JavaScript delivery, and SPA fallback.

## Playwright UI and API testing

The framework tests this application, not the Playwright example website.
Use Node.js 22.13 or newer within the Node.js 22 release line (the CI runtime),
Docker Desktop with Linux containers, and Compose v2. The default target is
http://localhost:8080. Start the application before running the tests:

```powershell
cd F:\phase\phase-allocation\busbar
npm.cmd ci
npx.cmd playwright install chromium firefox webkit
npm.cmd run validate
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 120
npm.cmd run test:smoke
npm.cmd run test:regression
```

The `.cmd` commands avoid Windows PowerShell script-execution-policy issues.
On Linux/macOS, use `npm` and `npx`. Playwright does not automatically start or
stop the local application; local tests use the already running deployment.
For another local port, set both the deployment port and test origin:

```powershell
$env:HTTP_PORT = '8081'
$env:BASE_URL = 'http://localhost:8081'
docker compose up -d --wait
npm.cmd run test:smoke
```

`BASE_URL` must be an HTTP(S) origin without credentials, a path, query, or
fragment. Tests use synthetic data and may intentionally submit invalid
requests; target a test environment, not a production system.

| Command | Coverage |
| --- | --- |
| `npm run validate` | ESLint, strict TypeScript checking, configuration validation and test discovery |
| `npm run test:smoke` | Five checks: health, known calculation/JSON contract, validation errors, default UI, balanced UI example |
| `npm run test:regression` | 26 API checks once, plus eight UI scenarios on each of Chromium, Firefox, and WebKit (50 executions) |
| `npm run test:api` | API tests only, without browser launches |
| `npm run test:ui` | UI scenarios across all three browsers |
| `npm run report` | Open the latest local HTML report |

API regression covers all seven connection types, reactive leading/lagging
behavior, cancellation, input limits, malformed JSON, unknown API routes, and
missing frontend assets. UI regression covers real API-backed calculations,
editing, adding/removing loads, invalid-input recovery, empty-load recovery,
visible API failures, and SPA deep links. Only the failure/recovery scenario
mocks an API response; normal calculation scenarios exercise the real backend.
Accessible field names and named regions provide stable UI selectors.

Tests run with two parallel workers. Failures retain browser screenshots and
videos, traces, and attached browser console/page-error/request-failure logs.
API-only tests retain request traces, but have no browser screenshots or video.
HTML reports are written to `playwright-report`; attachments and JUnit XML are
written to `test-results`. Those generated directories are ignored by Git.
To inspect a failure, open the HTML report or use `npx playwright show-trace`
with the failed test's `trace.zip`.

### GitHub Actions quality gate

The workflow lives at the repository root in
[`../.github/workflows/playwright.yml`](../.github/workflows/playwright.yml).
GitHub does not discover workflows under `busbar/.github`.

- Pull requests targeting `main`, `develop`, or `release/**` run smoke tests.
- Pushes to those branches run the full regression suite.
- Nightly runs at 02:00 UTC run full regression on the default branch.
- Manual runs let you choose smoke or regression.

The workflow checks out the repository, sets up Node.js/Python, restores
dependencies with `npm ci`, installs the suite's browsers, validates lint/types/
test discovery and Compose configuration, and runs backend pytest tests.
It builds and starts the Docker application, verifies runtime container
hardening, and runs Playwright. It captures Docker logs, uploads HTML/JUnit
reports and available failure evidence even after failures, and stops the
application. Artifacts are retained for 14 days. Setup failures can have no
test artifacts; their diagnosis is in the Actions step logs. Treat reports,
traces, and recordings as potentially sensitive and do not use real credentials.

CI retries a failed test once for diagnostic evidence, but
`failOnFlakyTests` makes the job fail even if that retry passes. Validation
failures and test failures return nonzero exit codes; they are not ignored.

Commit and push the workflow, framework, lockfile, and application changes to
activate CI. Then configure a GitHub branch ruleset/branch protection for the
protected branches, requiring the `UI and API quality gate` status check
(select its actual name after the first Actions run). Disable bypasses where
appropriate. A workflow failure alone does not prevent merging unless GitHub
requires that check. Nightly schedules only become active after the workflow
is present on the repository's default branch.

## Independent updates

```powershell
docker compose up -d --build --no-deps --wait busbar-api
docker compose up -d --build --no-deps --wait frontend
.\deploy\smoke-test.ps1
```

After changing gateway configuration, validate and reload it:

```powershell
docker compose exec gateway nginx -t
docker compose exec gateway nginx -s reload
```

For container replacement verification, force-recreate each application,
allow Docker DNS's configured 10-second cache to expire, then rerun the
smoke test. The gateway should recover without recreation:

```powershell
docker compose up -d --force-recreate --no-deps --wait busbar-api frontend
.\deploy\smoke-test.ps1
```

If the test hits the DNS cache transition, rerun it after the cache expires.

## Local development and tests

Keep the existing non-Docker development workflow. In a backend terminal:

```powershell
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m uvicorn main:app --reload --port 8000
```

In a second terminal starting from this directory:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to localhost:8000. Production
uses the gateway instead, with no change to `src/api.js`. For a frontend build
check run `npm run build` in `frontend`. For direct API smoke checks:

```powershell
.\deploy\smoke-test.ps1 -BaseUrl http://localhost:8000 -ApiOnly
```

The smoke script targets Windows PowerShell 5.1. Backend runtime images
install only `requirements.txt`; pytest and HTTPX belong to
`requirements-dev.txt`. Direct Python dependencies are pinned to tested
versions; transitive dependencies and base-image digests are not locked.
Python 3.13 is used for the container, matching the implementation test runtime.

## Add a service

1. Add a directory for a distinct business capability, with its own API,
   dependency manifest, Dockerfile, tests, and `/health` endpoint. Do not
   extract individual calculation functions into network services.
2. Add a Compose service on the `application` network, with a health check,
   restart policy, and no host port. Use the service name for internal DNS.
3. Give the API a prefix such as `/api/reports/`, including its root route.
   Add a DNS-aware upstream in `deploy/nginx.conf`, using a unique shared
   memory zone, then add specific gateway locations:

```nginx
upstream reports_api {
    zone reports_api 64k;
    server reports-api:8000 resolve;
}

# Inside the existing server block:
location = /api/reports {
    proxy_pass http://reports_api;
}
location /api/reports/ {
    proxy_pass http://reports_api;
}
```

4. Preserve the prefix in the new service: these `proxy_pass` directives have
   no trailing slash and do not strip it. Nginx chooses the longer prefix
   over the legacy `/api/` route. Keep `/api/calculate` backward-compatible.
5. Add contract/smoke tests and validate `docker compose config` and `nginx -t`
   before reloading the gateway. Route-only changes do not rebuild the UI;
   a UI that uses a new capability will need its own update.
6. If persistence becomes necessary, let each service own its data. Exchange
   data through explicit API contracts rather than shared database tables.

## Deployment limits

### Local container hardening

All runtime containers run as non-root users. The gateway and frontend use
`nginxinc/nginx-unprivileged` and listen on container port 8080; the browser
URL remains http://localhost:8080. Each container has a read-only root
filesystem, all Linux capabilities dropped, and `no-new-privileges` enabled.
Only `/tmp` is writable through a bounded 64 MiB temporary filesystem mounted
with `noexec` and `nosuid`; its contents are disposable. Nginx uses it for its
PID and temporary request files. Do not add privileged mode or mount the
Docker socket to these services.

Docker's local log driver rotates logs at 10 MiB per file and retains three
files per container. Health checks and `deploy/smoke-test.ps1` check local
availability; they are not continuous external monitoring or alerting.
Run `deploy/security-test.ps1` to verify runtime isolation and published ports.

Dockerfiles copy only explicitly required application files. Both build
contexts exclude `.env*`; this is an additional safeguard, not a substitute
for secret management. Never put credentials in source, image layers, build
arguments, or frontend JavaScript. If a future service needs a secret, mount
it as a read-only secret file and make that service explicitly read it.

Refresh base images regularly, rebuild, and verify before accepting updates:

```powershell
docker compose pull gateway
docker compose build --pull
docker compose up -d --wait
.\deploy\smoke-test.ps1
.\deploy\security-test.ps1
```

These commands refresh the configured image tags, not newer version tags or
application dependency pins. Review supported upstream versions and security
advisories, update image tags and dependency manifests/lockfiles deliberately,
and run the backend tests and frontend build before deployment. No claim of
being vulnerability-free is made by these runtime restrictions.

The current calculator has no persistent server-side user data or database.
Keep source/configuration in backed-up version control without secrets. Add
data backups and test restoration if persistent storage is introduced;
container images and temporary files are not data backups.

This is a local/single-server deployment foundation, not a fully secured
public platform. Before public deployment, explicitly configure the listening
interface, TLS, authentication/authorization, resource limits, monitoring,
dependency/image patching, and secret management. Do not expose the backend
directly or broaden CORS as a substitute for gateway routing. Kubernetes,
message brokers, and databases are intentionally not introduced yet.