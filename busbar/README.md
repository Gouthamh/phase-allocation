# Busbar services

The frontend and busbar API build and deploy independently. Nginx provides one
browser-facing origin; no API hostname is embedded in the frontend bundle.

```text
Browser -> localhost:8080 -> gateway
                             |-- /api and /api/* -> busbar-api:8000
                             |-- /health        -> gateway health
                             `-- everything else -> frontend:80
```

The API owns `calc.py` and the existing `POST /api/calculate` contract. The
frontend contains only UI code. The services share no filesystem or database.
Only the gateway publishes a host port, bound to localhost. Service names on
the Compose network provide internal DNS. The gateway refreshes those DNS
records so backend/frontend container replacement does not require rebuilding
or restarting it. Brief errors during replacement are possible; this is not
a zero-downtime orchestrator.

## Run with Docker

Prerequisites: Docker Desktop with Linux containers and Docker Compose v2.
Run the following from this directory (`qa-ai-agent/busbar`):

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

This is a local/single-server deployment foundation, not a fully secured
public platform. Before public deployment, explicitly configure the listening
interface, TLS, authentication/authorization, resource limits, monitoring,
dependency/image patching, and secret management. Do not expose the backend
directly or broaden CORS as a substitute for gateway routing. Kubernetes,
message brokers, and databases are intentionally not introduced yet.