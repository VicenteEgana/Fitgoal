param([int]$Port = 3000, [switch]$RebuildMobile)
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$nodeExecutable = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExecutable) {
    # Node.js portable (sin instalar): el zip de nodejs.org descomprimido dentro de la carpeta del proyecto.
    $portableNode = Get-ChildItem -LiteralPath $projectDirectory -Directory -Filter 'node*' -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName 'node.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($portableNode) { $nodeExecutable = $portableNode }
}
if (-not $nodeExecutable) {
    $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $nodeExecutable = $bundledNode }
}
if (-not $nodeExecutable) { throw 'Necesitas Node.js 24 o superior: instalalo, o descarga el .zip de Windows desde nodejs.org y descomprimelo dentro de esta carpeta (no requiere instalar).' }
Set-Location -LiteralPath (Join-Path $projectDirectory 'backend')
if (-not (Test-Path -LiteralPath 'node_modules\express')) {
    $npmEntry = Join-Path (Split-Path $nodeExecutable -Parent) 'node_modules\npm\bin\npm-cli.js'
    if (-not (Test-Path -LiteralPath $npmEntry)) { $npmEntry = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' }
    if (-not (Test-Path -LiteralPath $npmEntry)) { throw 'Ejecuta npm ci dentro de backend para instalar las dependencias.' }
    & $nodeExecutable $npmEntry ci --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
}
$compiledMobile = Join-Path $projectDirectory 'mobile\build\web\index.html'
if ($RebuildMobile -or $Port -ne 3000 -or -not (Test-Path -LiteralPath $compiledMobile)) {
    $flutterExecutable = (Get-Command flutter.bat -ErrorAction SilentlyContinue).Source
    if (-not $flutterExecutable) {
        $editorSettingsPath = Join-Path $env:APPDATA 'Code\User\settings.json'
        if (Test-Path -LiteralPath $editorSettingsPath) {
            try {
                $editorSettings = Get-Content -LiteralPath $editorSettingsPath -Raw | ConvertFrom-Json
                if ($editorSettings.'dart.flutterSdkPath') { $flutterExecutable = Join-Path $editorSettings.'dart.flutterSdkPath' 'bin\flutter.bat' }
            } catch { $flutterExecutable = $null }
        }
    }
    if (-not $flutterExecutable -or -not (Test-Path -LiteralPath $flutterExecutable)) {
        $flutterCandidate = Join-Path $env:USERPROFILE 'Documents\flutter\bin\flutter.bat'
        if (Test-Path -LiteralPath $flutterCandidate) { $flutterExecutable = $flutterCandidate }
    }
    if ($flutterExecutable -and (Test-Path -LiteralPath $flutterExecutable)) {
        Push-Location -LiteralPath (Join-Path $projectDirectory 'mobile')
        try {
            & $flutterExecutable pub get
            if ($LASTEXITCODE -ne 0) { throw 'No se pudieron obtener las dependencias Flutter.' }
            & $flutterExecutable build web --base-href /app/ --no-web-resources-cdn "--dart-define=API_BASE_URL=http://127.0.0.1:$Port" "--dart-define=DEMO_MODE=true"
            if ($LASTEXITCODE -ne 0) { throw 'La compilacion Flutter fallo.' }
        } finally { Pop-Location }
    } else { Write-Host 'SDK Flutter pendiente: no se pudo compilar la app. Instala Flutter o usa flutter run.' }
}
$env:PORT = [string]$Port
if (Test-Path -LiteralPath $compiledMobile) { Write-Host ('App Flutter: http://127.0.0.1:' + $Port + '/app/') -ForegroundColor Cyan }
Write-Host ('API y comprobacion de salud: http://127.0.0.1:' + $Port + '/health') -ForegroundColor Cyan
Write-Host 'Cuentas de demostracion (datos ficticios): participante@fitgoal.demo, preparador@fitgoal.demo, nutricionista@fitgoal.demo y admin@fitgoal.demo. La contrasena esta en backend/src/seed/demo.js.'
Write-Host 'Abre la app en tu navegador. Ctrl+C detiene el servidor.'
& $nodeExecutable 'src\server.js'

