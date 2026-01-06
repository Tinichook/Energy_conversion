@echo off
chcp 65001 >nul
echo ============================================
echo 能源系统优化求解器
echo ============================================
echo.

cd /d "%~dp0energy-system"

echo 正在编译并运行优化求解...
echo.

:: 默认求解测试区-1 (区域53)
:: 可以通过参数修改: --region 区域ID --student 学号 --format markdown/json/console --max 方案数

:: 方法1: 使用 npm exec (推荐)
call npm exec -- ts-node run-optimization.ts --region 53 --format markdown --max 20

:: 如果上面的命令失败，可以尝试以下方法:
:: 方法2: 直接使用 node 运行编译后的文件
:: call npx tsc run-optimization.ts --outDir dist
:: node dist/run-optimization.js --region 53 --format markdown --max 20

echo.
pause
