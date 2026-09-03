@echo off
REM ============================================================================
REM   Pone la base del facturador al dia.
REM
REM   PARA QUE EXISTE
REM   La base local se refresca a veces con un respaldo o con una copia del
REM   servidor, y esa copia no trae las migraciones posteriores a la fecha en que
REM   se tomo. Cuando eso pasa el modulo falla por columnas que no existen, y el
REM   navegador muestra errores que no se parecen en nada a la causa
REM   ("Unexpected token '<'", pantallas en blanco).
REM
REM   Paso el 2026-08-31: la base volvio al estado del respaldo del 25 de agosto
REM   y se perdieron las migraciones 10, 11 y 12.
REM
REM   QUE CORRE Y QUE NO
REM   De la 03 a la 15. Todas esas comprueban si su columna ya existe antes de
REM   tocarla, asi que correr esto dos veces no hace dano. Se verificaron una por
REM   una: no es un supuesto.
REM
REM   La 01 y la 02 NO estan, porque revientan al repetirse:
REM       migra-01  suelta una llave foranea que en la segunda pasada ya no esta
REM       migra-02  agrega `tax_rate` sin comprobar si existe
REM   Si la copia que restauraste es anterior a esas dos, hay que aplicarlas a
REM   mano y revisando, que es como se hicieron la primera vez.
REM
REM   OJO con dejar migraciones fuera "por si acaso": este script empezo corriendo
REM   solo de la 10 en adelante y la 09 se quedo sin aplicar. Sus dos columnas las
REM   usa la consulta de Tickets, que fallaba en silencio y pintaba "Sin ventas
REM   cargadas" con el dia entero cargado en la base.
REM
REM   USO: doble clic, o desde la terminal:  aplica-migraciones.bat
REM ============================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

set MYSQL=C:\wamp64\bin\mysql\mysql8.0.31\bin\mysql.exe
set DUMP=C:\wamp64\bin\mysql\mysql8.0.31\bin\mysqldump.exe
set USUARIO=root
set BASE=fayxzvov_facturacion

if not exist "%MYSQL%" (
    echo.
    echo   No se encontro MySQL en:
    echo     %MYSQL%
    echo   Revisa que version de MySQL usa tu WAMP y corrige la ruta arriba.
    echo.
    pause
    exit /b 1
)

REM -- Respaldo antes de tocar nada. Una migracion cambia la forma de las tablas
REM -- y eso no se deshace solo.
if not exist "backup" mkdir "backup"

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set HOY=%%c%%b%%a
set HORA=%time:~0,2%%time:~3,2%
set HORA=%HORA: =0%
set RESPALDO=backup\%BASE%-%HOY%-%HORA%-antes-de-migrar.sql

echo.
echo   Respaldando en %RESPALDO% ...
"%DUMP%" -u %USUARIO% --routines --triggers --single-transaction %BASE% > "%RESPALDO%" 2>nul

if errorlevel 1 (
    echo   No se pudo respaldar. Se detiene: no se migra sin red.
    pause
    exit /b 1
)

echo   Listo.
echo.
echo   Aplicando migraciones...
echo.

set FALLARON=

for %%F in (
    migra-03-ticket-pos.sql
    migra-04-reparto-secuencial.sql
    migra-05-wansoft.sql
    migra-06-bitacora-carga.sql
    migra-07-tolerancia-ajuste.sql
    migra-08-corrida-generacion.sql
    migra-09-reasignacion-cargos.sql
    migra-10-wansoft-comandas.sql
    migra-11-catalogo-multi-pos.sql
    migra-12-parent-por-nombre.sql
    migra-13-logo-emisor.sql
    migra-14-lema-opcional.sql
    migra-15-identidad-ticket.sql
) do (
    "%MYSQL%" -u %USUARIO% < "%%F" 2>nul
    if errorlevel 1 (
        echo     FALLO   %%F
        set FALLARON=!FALLARON! %%F
    ) else (
        echo     ok      %%F
    )
)

echo.

if "!FALLARON!"=="" (
    echo   La base esta al dia.
) else (
    echo   Estas fallaron y hay que revisarlas a mano:
    echo    !FALLARON!
    echo.
    echo   El respaldo quedo en %RESPALDO%
)

echo.
pause
