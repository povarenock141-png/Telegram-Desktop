@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Блатной блокнот — обновление моста
echo.
echo  Обновляю «Мост». Ничего нажимать не нужно, подожди до слова «Готово».
echo.
node setup.js
if errorlevel 1 goto :fail
call npx --yes wrangler deploy > deploy.log 2>&1
if errorlevel 1 ( type deploy.log & goto :fail )
echo.
echo  Готово. Напиши в чат «мост обновлён».
echo.
pause
exit /b 0
:fail
echo.
echo [!] Что-то пошло не так. Сфотографируй это окно и пришли в чат.
pause
exit /b 1
