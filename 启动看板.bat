@echo off
rem 本文件必须保存为 GBK/ANSI 编码（cmd 默认代码页解析），勿转为 UTF-8
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装：https://nodejs.org
  pause
  exit /b 1
)

if not exist dist (
  echo 首次运行，正在构建生产版本，请稍候...
  call npm run build
  if errorlevel 1 (
    echo [错误] 构建失败，请确认已执行 npm install 后重试
    pause
    exit /b 1
  )
)

echo 正在启动看板服务，浏览器将自动打开（按 Ctrl+C 可停止服务）...
node server.js

echo.
echo 服务已退出。
pause
