@echo off
title SmartBus AI Launcher
echo ====================================================================
echo      Starting AI-Based School Bus Route Optimization System
echo ====================================================================
echo.

:: 1. Launch FastAPI Backend
echo [1/2] Starting Python FastAPI backend on http://127.0.0.1:8081...
start "SmartBus AI Backend" cmd /k "python -m uvicorn backend.app:app --host 127.0.0.1 --port 8081"

:: 2. Launch React Frontend
echo [2/2] Starting Vite React frontend on http://localhost:5174...
cd frountend
start "SmartBus AI Frontend" cmd /k "npm run dev"

echo.
echo ====================================================================
echo Servers are launching in separate command windows!
echo - Frontend Dashboard: http://localhost:5174/ (or port printed in logs)
echo - Backend API Docs:   http://127.0.0.1:8081/docs
echo ====================================================================
echo.
echo Press any key to exit this launcher (servers will keep running).
pause > nul
