$ErrorActionPreference = "Stop"
$siteRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8080
$prefix = "http://localhost:$port/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Nao foi possivel iniciar o GovFinance na porta $port." -ForegroundColor Red
    Write-Host "Feche outra janela do GovFinance e tente novamente."
    Read-Host "Pressione Enter para sair"
    exit 1
}

Start-Process $prefix
Write-Host "GovFinance iniciado em $prefix" -ForegroundColor Green
Write-Host "Mantenha esta janela aberta enquanto estiver usando o painel."
Write-Host "Para encerrar, feche esta janela ou pressione Ctrl+C."

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
        if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = "index.html" }

        $requestedPath = [IO.Path]::GetFullPath((Join-Path $siteRoot $relativePath))
        if (-not $requestedPath.StartsWith($siteRoot, [StringComparison]::OrdinalIgnoreCase)) {
            $context.Response.StatusCode = 403
            $context.Response.Close()
            continue
        }

        if (-not (Test-Path -LiteralPath $requestedPath -PathType Leaf)) {
            $requestedPath = Join-Path $siteRoot "index.html"
        }

        $bytes = [IO.File]::ReadAllBytes($requestedPath)
        $extension = [IO.Path]::GetExtension($requestedPath).ToLowerInvariant()
        $context.Response.ContentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $context.Response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
