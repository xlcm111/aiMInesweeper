@echo off
chcp 65001 >nul
echo ================================
echo   扫雷多人对战服务器
echo ================================
echo.
echo 正在启动服务器...
echo.
cd /d "%~dp0"
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    echo.
)
echo 服务器地址: http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo ================================
echo.
node server.js
pause
