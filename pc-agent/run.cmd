@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist stop.flag del /q stop.flag
:loop
node agent.mjs
set CODE=%errorlevel%
if exist stop.flag ( del /q stop.flag & goto :eof )
if "%CODE%"=="2" goto :eof
if "%CODE%"=="3" goto :eof
ping -n 16 127.0.0.1 >nul
goto :loop
