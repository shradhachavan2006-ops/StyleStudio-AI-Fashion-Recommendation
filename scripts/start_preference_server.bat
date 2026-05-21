@echo off
cd /d "%~dp0.."
set PYTHONIOENCODING=utf-8
python scripts\preference_score_server.py > data\preference_score_server.bat.log 2> data\preference_score_server.bat.err.log
