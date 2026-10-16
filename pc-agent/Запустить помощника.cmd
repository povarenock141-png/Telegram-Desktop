@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Блатной блокнот — помощник
where node >nul 2>&1
if errorlevel 1 goto :nonode
if exist "config.json" goto :start
echo.
echo  Подключение ноутбука к Блатному блокноту
echo  ----------------------------------------
echo  1. В блокноте внизу нажми «Синхронизировано ... · ссылка», потом «Копировать».
echo  2. Вставь ссылку сюда правой кнопкой мыши и нажми Enter.
echo.
set /p LINK=Ссылка: 
node -e "const l=(process.argv[1]||'').trim();if(!/#sync=dela-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{40,}/.test(l)){console.log('[!] Это не ссылка синхронизации. Запусти файл ещё раз.');process.exit(1)}require('fs').writeFileSync('config.json',JSON.stringify({link:l}))" "%LINK%"
if errorlevel 1 goto :fail
:start
cscript //nologo "%~dp0hidden.vbs" install
wscript "%~dp0hidden.vbs"
echo.
echo  Готово. Помощник работает в фоне и сам запускается при входе в Windows.
echo  Заметки и дела: Рабочий стол\Блатной блокнот
echo  Выключить: «Остановить помощника.cmd»
echo.
pause
exit /b 0
:nonode
echo [!] Не найден Node.js. Установи его с nodejs.org и запусти этот файл ещё раз.
:fail
pause
exit /b 1
