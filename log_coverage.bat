@echo off
rem -------------------------------------------------
rem   Script: log_coverage.bat
rem   Genera la cobertura con Jest y actualiza el registro
rem   tdd-coverage-log.md con SHA, fecha ISO y % de líneas.
rem -------------------------------------------------

rem Cambiar al directorio del proyecto (en caso de ser llamado desde otro lugar)
cd /d "%~dp0"

rem 1) Ejecutar los tests con cobertura
npx jest --coverage --json --outputFile=coverage/coverage-summary.json
if errorlevel 1 (
    echo [ERROR] Jest falló. Abortando.
    exit /b 1
)

rem 2) Obtener datos
for /f %%i in ('git rev-parse --short HEAD') do set SHA=%%i
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-ddTHH:mm:ss"') do set ISO=%%d
for /f %%p in ('node -p "require('./coverage/coverage-summary.json').total.lines.pct"') do set LINES=%%p

rem 3) Mostrar cobertura en consola
echo Cobertura de líneas: %LINES%%% 

rem 4) Añadir registro al log (crea el archivo si no existe)
if not exist tdd-coverage-log.md (
    echo # Registro de Refactor + TDD + Coverage > tdd-coverage-log.md
    echo. >> tdd-coverage-log.md
    echo ## Historial >> tdd-coverage-log.md
)

rem 5) Append entry
(echo - %SHA% ^| %ISO% ^| %LINES%%% ) >> tdd-coverage-log.md

rem 6) Fin
exit /b 0
