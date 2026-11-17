param(
    [string]$BaseUrl = "http://localhost:8080",
    [switch]$ApiOnly
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')

function Send-Request {
    param([string]$Path, [string]$Method = "GET", [string]$Body)

    $parameters = @{
        Uri             = "$BaseUrl$Path"
        Method          = $Method
        UseBasicParsing = $true
        TimeoutSec      = 15
        ErrorAction     = "Stop"
    }
    if ($Body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = $Body
    }
    try {
        $response = Invoke-WebRequest @parameters
        return @{
            Status      = [int]$response.StatusCode
            ContentType = [string]$response.Headers['Content-Type']
            Content     = $response.Content
        }
    }
    catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        try {
            $content = $_.ErrorDetails.Message
            if ([string]::IsNullOrWhiteSpace($content)) {
                $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                try { $content = $reader.ReadToEnd() }
                finally { $reader.Dispose() }
            }
            return @{
                Status      = [int]$response.StatusCode
                ContentType = $response.ContentType
                Content     = $content
            }
        }
        finally {
            $response.Dispose()
        }
    }
}

function Assert-JsonStatus {
    param($Response, [int]$ExpectedStatus)
    if ($Response.Status -ne $ExpectedStatus -or $Response.ContentType -notmatch '^application/json') {
        throw "Expected JSON HTTP $ExpectedStatus, received $($Response.Status) $($Response.ContentType)"
    }
    return ($Response.Content | ConvertFrom-Json)
}

$health = Assert-JsonStatus (Send-Request '/health') 200
if ($health.status -ne 'ok') { throw 'Health check did not report ok' }

if (-not $ApiOnly) {
    $page = Send-Request '/'
    if ($page.Status -ne 200 -or $page.ContentType -notmatch '^text/html') {
        throw 'Frontend HTML is unavailable'
    }
    $assetMatch = [regex]::Match($page.Content, 'src="([^"\s]+\.js)"')
    if (-not $assetMatch.Success) { throw 'Frontend JavaScript asset not found in HTML' }
    $assetPath = $assetMatch.Groups[1].Value
    if (-not $assetPath.StartsWith('/assets/')) { throw 'Unexpected frontend asset path' }
    $asset = Send-Request $assetPath
    if ($asset.Status -ne 200 -or $asset.ContentType -notmatch '(javascript|ecmascript)' -or -not $asset.Content) {
        throw 'Frontend JavaScript asset is unavailable'
    }
    $deepLink = Send-Request '/smoke-test/deep-link'
    if ($deepLink.Status -ne 200 -or $deepLink.Content -ne $page.Content) {
        throw 'Frontend SPA fallback failed'
    }
    if ((Send-Request '/assets/nonexistent.js').Status -ne 404) {
        throw 'Missing assets must return HTTP 404'
    }
}

$body = '{"loads":[{"current":139,"cos":0.8,"connection":"L1"},{"current":130,"cos":1,"connection":"L2"},{"current":200,"cos":1,"connection":"L1-L2"}]}'
$result = Assert-JsonStatus (Send-Request '/api/calculate' 'POST' $body) 200
foreach ($field in @('phases', 'neutral_row', 'ib', 'neutral', 'most_loaded', 'unbalance', 'arithmetic_sum')) {
    if ($result.PSObject.Properties.Name -notcontains $field) { throw "Missing calculation field: $field" }
}
if ($result.phases.Count -ne 3 -or [math]::Abs($result.ib - 319.3) -gt 0.1) {
    throw 'Unexpected calculation result'
}
$invalidBody = '{"loads":[{"current":10,"cos":0,"connection":"L1"}]}'
$invalid = Assert-JsonStatus (Send-Request '/api/calculate' 'POST' $invalidBody) 422
if (-not $invalid.detail) { throw 'Validation response is missing details' }
foreach ($path in @('/api/nonexistent', '/api')) {
    $missing = Assert-JsonStatus (Send-Request $path) 404
    if ($missing.detail -ne 'Not Found') { throw "Unexpected API error at $path" }
}

Write-Host "PASS: smoke checks at $BaseUrl (API-only: $ApiOnly)"