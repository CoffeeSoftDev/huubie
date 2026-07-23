@echo off
setlocal
set "PHP_EXE="

where php >nul 2>&1
if %errorlevel% equ 0 set "PHP_EXE=php"

if not defined PHP_EXE (
    for /d %%D in ("C:\wamp64\bin\php\php*") do (
        if exist "%%~fD\php.exe" set "PHP_EXE=%%~fD\php.exe"
    )
)

if not defined PHP_EXE (
    echo [ERROR] No se encontro php.exe en PATH ni en C:\wamp64\bin\php.
    pause
    exit /b 1
)

"%PHP_EXE%" "%~dp0update-profile-identity.php"
set "RESULT=%errorlevel%"
echo.
if not "%RESULT%"=="0" echo La actualizacion termino con errores.
pause
exit /b %RESULT%