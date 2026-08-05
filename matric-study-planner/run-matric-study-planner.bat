@echo off
setlocal

set "ROOT=%~dp0"
set "API_DIR=%ROOT%artifacts\api-server"
set "FRONTEND_DIR=%ROOT%artifacts\matric-study-planner"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install Node.js or open this from a terminal where node is available.
  pause
  exit /b 1
)

if not exist "%API_DIR%\.env" (
  echo Missing backend env file:
  echo %API_DIR%\.env
  echo.
  echo Create it from .env.example and add GROQ_API_KEY before running.
  pause
  exit /b 1
)

if not exist "%FRONTEND_DIR%\node_modules\vite\bin\vite.js" (
  echo Frontend dependencies are missing.
  echo Run pnpm install at the workspace root first.
  pause
  exit /b 1
)

echo Starting Matric Study Planner...
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:5000
echo.
echo Two terminal windows will open. Keep them open while using the app.
echo.

start "Matric API Server" cmd /k "cd /d "%API_DIR%" && echo Building API server... && node build.mjs && echo Starting API server on port 5000... && node --env-file-if-exists=./.env --enable-source-maps ./dist/index.mjs"

start "Matric Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && echo Starting frontend on http://localhost:5173 ... && node ./node_modules/vite/bin/vite.js --config vite.config.ts --host 0.0.0.0 --port 5173 --strictPort false"

echo Done. Open http://localhost:5173 in your browser.
pause
