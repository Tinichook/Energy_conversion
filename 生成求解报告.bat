@echo off
chcp 65001 >nul
echo ============================================
echo 能源系统优化求解报告生成器
echo ============================================
echo.

cd /d "%~dp0energy-system"

echo 正在生成优化求解报告...
echo.

:: 参数说明:
:: --region 区域ID (默认53=测试区-1)
:: --student 学号 (可选，用于数据波动)
:: --output 输出目录 (默认 ../MD方案)
:: --max 最大方案数 (默认20)

:: 示例: 为测试区-1生成报告
npx ts-node generate-solution-report.ts --region 53 --max 20

echo.
echo 报告已生成到 MD方案 目录
pause
