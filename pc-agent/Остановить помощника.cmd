@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo stop> stop.flag
if exist agent.lock (
  for /f %%p in (agent.lock) do taskkill /PID %%p /F >nul 2>&1
  del /q agent.lock >nul 2>&1
)
cscript //nologo "%~dp0hidden.vbs" remove
echo Помощник остановлен, автозапуск выключен. Включить снова: «Запустить помощника.cmd».
pause
