@echo off
rem Double-click this to stop the theology map render server (engine\render_server.py, port 8420).
rem Only touches whatever process is listening on that port.

powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 8420 -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; Write-Host 'Stopped process(es) listening on port 8420.' } else { Write-Host 'Nothing listening on port 8420.' }"

pause
