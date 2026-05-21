@echo off
cd /d "%~dp0.."
set PYTHONIOENCODING=utf-8
python scripts\clip_search_server.py > data\clip_search_server.bat.log 2> data\clip_search_server.bat.err.log
