@echo off
chcp 65001 >nul
echo 正在启动能源系统...
cd /d "%~dp0energy-system"
npm run dev
pause
 http://localhost:5173/