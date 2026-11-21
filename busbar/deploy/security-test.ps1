$ErrorActionPreference = "Stop"

Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    foreach ($service in @('gateway', 'frontend', 'busbar-api')) {
        $containerId = docker compose ps -q $service
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
            throw "No running container found for $service"
        }
        $inspection = docker inspect $containerId
        if ($LASTEXITCODE -ne 0) { throw "Cannot inspect $service" }
        $container = ($inspection | ConvertFrom-Json)[0]
        $config = $container.HostConfig
        if (-not $container.State.Running -or $container.State.Health.Status -ne 'healthy') {
            throw "$service is not running and healthy"
        }
        if ($config.Privileged -or -not $config.ReadonlyRootfs -or
            $config.CapDrop -notcontains 'ALL' -or $config.CapAdd.Count -gt 0 -or
            $config.SecurityOpt -notcontains 'no-new-privileges:true') {
            throw "$service is missing required runtime restrictions"
        }
        if ($config.LogConfig.Type -ne 'local' -or
            $config.LogConfig.Config.'max-size' -ne '10m' -or
            $config.LogConfig.Config.'max-file' -ne '3') {
            throw "$service is missing bounded log rotation"
        }
        $temporaryStorage = $config.Tmpfs.'/tmp'
        if ([string]::IsNullOrWhiteSpace($temporaryStorage)) {
            throw "$service is missing bounded temporary storage"
        }
        foreach ($option in @('noexec', 'nosuid', 'size=64m')) {
            if ($temporaryStorage.Split(',') -notcontains $option) {
                throw "$service is missing temporary-storage restriction $option"
            }
        }
        $uid = docker compose exec -T $service id -u
        if ($LASTEXITCODE -ne 0 -or $uid -notmatch '^\d+$' -or [int]$uid -eq 0) {
            throw "$service is not running as a non-root user"
        }
        $processStatus = docker compose exec -T $service cat /proc/1/status
        if ($LASTEXITCODE -ne 0) { throw "Cannot read main-process privileges for $service" }
        $processStatus = $processStatus -join "`n"
        if ($processStatus -notmatch '(?m)^Uid:\s+[1-9]\d*\s+[1-9]\d*\s+[1-9]\d*\s+[1-9]\d*\s*$' -or
            $processStatus -notmatch '(?m)^CapEff:\s+0+\s*$' -or
            $processStatus -notmatch '(?m)^NoNewPrivs:\s+1\s*$') {
            throw "$service main process is not non-root with zero effective capabilities and no-new-privileges"
        }
        $bindings = @($config.PortBindings.PSObject.Properties)
        if ($service -eq 'gateway') {
            if ($bindings.Count -ne 1 -or $bindings[0].Name -ne '8080/tcp' -or
                @($bindings[0].Value).Count -ne 1 -or
                $bindings[0].Value[0].HostIp -ne '127.0.0.1') {
                throw 'Only gateway port 8080 may be published, on localhost'
            }
        }
        elseif ($bindings.Count -ne 0) {
            throw "$service must not publish host ports"
        }
        foreach ($mount in $container.Mounts) {
            if ($mount.Type -ne 'bind' -or $service -ne 'gateway' -or $mount.RW -or
                $mount.Destination -ne '/etc/nginx/conf.d/default.conf') {
                throw "$service has an unexpected persistent mount"
            }
        }
        Write-Host "PASS: runtime hardening for $service (UID $uid)"
    }
}
finally {
    Pop-Location
}
