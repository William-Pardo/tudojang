$ErrorActionPreference = "Stop"
$dir = "E:\Apps\Tudojang-Workspace\Tudojang"

function Set-WompiSecret($nombreSecreto, $etiqueta) {
    $val = Read-Host "Pega el valor de $etiqueta de Wompi y Enter"
    $archivoTemp = Join-Path $dir "_secret_tmp.txt"
    [System.IO.File]::WriteAllText($archivoTemp, $val.Trim())

    Write-Host "`nActualizando $nombreSecreto en Firebase..." -ForegroundColor Cyan
    firebase functions:secrets:set $nombreSecreto --data-file="$archivoTemp" --force

    Remove-Item $archivoTemp -Force
    Write-Host "Listo: $nombreSecreto actualizado y archivo temporal borrado.`n" -ForegroundColor Green
}

Set-Location $dir
Set-WompiSecret "WOMPI_EVENTS_SECRET" "EVENTOS"
Set-WompiSecret "WOMPI_INTEGRITY_SECRET" "INTEGRIDAD"

Write-Host "=== Redesplegando functions para que tomen los secretos nuevos ===" -ForegroundColor Yellow
firebase deploy --only functions:webhookWompi,functions:firmarCheckoutWompi

Write-Host "`n=== TERMINADO ===" -ForegroundColor Green
