@echo off
cd /d "%~dp0"
echo Presentation: http://localhost:8765  (close this window to stop)
start "" "http://localhost:8765"
python -m http.server 8765
