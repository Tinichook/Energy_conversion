@echo off
chcp 65001 >nul
echo 正在安装项目依赖，请稍候...
cd /d "%~dp0energy-system"
npm install
echo.
echo 安装完成！现在可以双击"启动项目.bat"运行了。
pause
