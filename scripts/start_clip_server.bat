@echo off
echo Starting StyleStudio CLIP Search Server on port 5001...
cd /d "%~dp0.."
python scripts/clip_search_server.py
pause
