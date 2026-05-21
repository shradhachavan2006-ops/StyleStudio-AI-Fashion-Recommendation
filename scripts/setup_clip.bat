@echo off
echo ============================================================
echo  StyleStudio CLIP Server Setup
echo ============================================================

cd /d "%~dp0.."

echo.
echo [1/2] Installing Python dependencies...
pip install -r scripts/requirements_clip.txt
if errorlevel 1 (
    echo ERROR: pip install failed. Make sure Python 3.10+ is installed.
    pause
    exit /b 1
)

echo.
echo [2/2] Building CLIP embeddings from dataset...
echo       This runs ONCE and takes 20-40 minutes on CPU.
echo       Embeddings are saved to data/image_embeddings.npy
echo.
python scripts/build_clip_embeddings.py
if errorlevel 1 (
    echo ERROR: Embedding build failed. Check data/images/ and data/styles.csv exist.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Setup complete! Now run: start_clip_server.bat
echo ============================================================
pause
