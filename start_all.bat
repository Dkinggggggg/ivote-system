@echo off
title iVote Launcher
echo ====================================================
echo Starting iVote System Services...
echo ====================================================

echo [1/3] Starting Laravel API Backend (Port 8000)...
start "iVote - Backend (Port 8000)" cmd /k "cd /d C:\ivote_upgraded\ivote-backend && php artisan serve --port=8000"

echo [2/3] Starting Python Recognition Service (Port 8001)...
start "iVote - Recognition Service (Port 8001)" cmd /k "cd /d C:\ivote_upgraded\recognition_service && call .venv\Scripts\activate.bat && python -m uvicorn main:app --host 127.0.0.1 --port 8001"

echo [3/3] Starting Vite Web Frontend (Port 5173)...
start "iVote - Web Frontend" cmd /k "cd /d C:\ivote_upgraded\web && npm.cmd run dev"

echo.
echo ====================================================
echo All services have been launched in separate windows!
echo - Web Dashboard: https://localhost:5173/
echo - Backend API:   http://127.0.0.1:8000/api
echo - Recognition:   http://127.0.0.1:8001
echo.
echo Default Logins:
echo - Admin:   admin@ivote.com / password123
echo - Officer: officer@ivote.com / password123
echo ====================================================
pause
