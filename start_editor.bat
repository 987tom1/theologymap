@echo off
rem Double-click this to edit the theology map.
rem Starts the local render server, then opens the editor in your browser.
rem Close this window when you're done editing to stop the server.

cd /d "%~dp0"
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8420/engine/editor.html"
rem `py` (the Windows Python Launcher), not `python`: on this machine bare
rem `python` hits the Microsoft Store stub and the server never starts.
py engine\render_server.py
