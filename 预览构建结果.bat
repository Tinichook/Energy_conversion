@echo off
chcp 65001 >nul
echo 正在启动预览服务器...
cd /d "%~dp0energy-system"
npx serve dist
pause
