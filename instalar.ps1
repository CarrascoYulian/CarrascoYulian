# Crea un acceso directo en el Escritorio que abre las ruletas como aplicación
# (ventana propia, sin barra de direcciones, icono propio en la barra de tareas).
# Funciona 100% sin internet: abre el archivo index.html local.
$dir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Join-Path $dir 'index.html'
$ico  = Join-Path $dir 'icons\ruletas.ico'
$url  = ([System.Uri]$html).AbsoluteUri

$candidatos = @(
  "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$nav = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $nav) { Write-Host 'No encontré Edge ni Chrome.' -ForegroundColor Red; exit 1 }

$escritorio = [Environment]::GetFolderPath('Desktop')
$perfil = Join-Path $env:LOCALAPPDATA 'RuletasDaniel'   # perfil propio => icono propio en la barra de tareas

function Nuevo-Acceso($nombre, $extra) {
  $ws = New-Object -ComObject WScript.Shell
  $lnk = $ws.CreateShortcut((Join-Path $escritorio "$nombre.lnk"))
  $lnk.TargetPath = $nav
  $lnk.Arguments  = "--user-data-dir=`"$perfil`" --app=`"$url`" --no-first-run --disable-features=Translate $extra"
  $lnk.IconLocation = $ico
  $lnk.WorkingDirectory = $dir
  $lnk.Save()
}
Nuevo-Acceso 'Ruletas Daniel' ''
Nuevo-Acceso 'Ruletas Daniel (Proyector)' '--start-fullscreen'

Write-Host ''
Write-Host 'Listo. En el Escritorio hay dos accesos:' -ForegroundColor Green
Write-Host '  - Ruletas Daniel               (ventana normal)'
Write-Host '  - Ruletas Daniel (Proyector)   (pantalla completa)'
Write-Host ''
Write-Host "La app se abrio. Ahora: clic derecho en su icono de la barra de tareas > Anclar a la barra de tareas." -ForegroundColor Yellow

# Abre la aplicación ahora para que su icono aparezca en la barra de tareas y puedas fijarlo.
Start-Process -FilePath $nav -ArgumentList "--user-data-dir=`"$perfil`" --app=`"$url`" --no-first-run"
