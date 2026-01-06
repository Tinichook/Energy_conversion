@echo off
chcp 65001 >nul
echo 正在构建网页...
cd /d "%~dp0energy-system"
npm run build
echo.
echo 构建完成！网页文件在 energy-system/dist 文件夹中
echo 可以将 dist 文件夹部署到任何Web服务器
pause
