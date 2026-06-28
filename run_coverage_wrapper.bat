@echo off
rem ------------------------------------------------------------------
rem Wrapper for Gemini to run coverage without PowerShell
rem ------------------------------------------------------------------
cd /d "%~dp0"

rem Run npm (in cmd, not PowerShell) and capture output
call npm run test:coverage > test_output.txt

rem Process coverage and failures
node simple_log.js

rem Show the coverage log file
type vertical-coverage-log.md
