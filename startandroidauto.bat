@echo off
rem ============================================================================
rem  startandroidauto - shows Pluggo on a car screen (Android Auto) on this laptop.
rem
rem  Before running:
rem    1. Connect the phone by USB (USB debugging on).
rem    2. On the phone: Android Auto > three dots > "Start head unit server".
rem       (First time only: Android Auto settings > tap Version 10 times, then
rem        three dots > Developer settings > turn on "Unknown sources".)
rem    3. Open Pluggo on the phone.
rem
rem  In the black console window that opens with the car screen you can type:
rem    fuel 42      the car's battery is 42%
rem    range 180    the car has 180 km range
rem    fuel 80      e.g. reach the charge target, so charging stops
rem ============================================================================
setlocal
title startandroidauto

rem ---- Find adb (Android SDK, winget platform-tools, or PATH) ----
set "ADB="
if exist "D:\AndroidSdk\platform-tools\adb.exe" set "ADB=D:\AndroidSdk\platform-tools\adb.exe"
if not defined ADB for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Google.PlatformTools*") do if exist "%%D\platform-tools\adb.exe" set "ADB=%%D\platform-tools\adb.exe"
if not defined ADB for %%A in (adb.exe) do if not "%%~$PATH:A"=="" set "ADB=%%~$PATH:A"
if not defined ADB (
  echo Could not find adb. Install Android platform-tools first.
  pause & exit /b 1
)

rem ---- Find the Desktop Head Unit (Android Auto car-screen emulator) ----
set "DHU_DIR="
if exist "D:\AndroidSdk\extras\google\auto\desktop-head-unit.exe" set "DHU_DIR=D:\AndroidSdk\extras\google\auto"
if not defined DHU_DIR if exist "%LOCALAPPDATA%\Android\Sdk\extras\google\auto\desktop-head-unit.exe" set "DHU_DIR=%LOCALAPPDATA%\Android\Sdk\extras\google\auto"
if not defined DHU_DIR (
  echo Could not find desktop-head-unit.exe. Install it with:
  echo   sdkmanager "extras;google;auto"
  pause & exit /b 1
)

rem ---- Check the phone is connected ----
"%ADB%" start-server >nul 2>&1
set "PHONE="
for /f "skip=1 tokens=1,2" %%a in ('"%ADB%" devices') do if "%%b"=="device" set "PHONE=%%a"
if not defined PHONE (
  echo No phone found. Connect it by USB, allow USB debugging, and run this again.
  pause & exit /b 1
)
echo Phone connected: %PHONE%

rem ---- Car profile: an electric car with CCS2 and Type 2 ports, battery sensors on ----
set "CFG=%DHU_DIR%\config\pluggo_ev.ini"
if not exist "%CFG%" (
  > "%CFG%" (
    echo [general]
    echo touch = true
    echo touchpad = false
    echo controller = false
    echo instrumentcluster = false
    echo resolution = 800x480
    echo dpi = 160
    echo framerate = 30
    echo fueltypes = electric
    echo evconnectors = combo2,mennekes
    echo.
    echo [sensors]
    echo night_mode = true
    echo driving_status = true
    echo fuel = true
    echo odometer = true
    echo speed = true
    echo location = true
  )
)

rem ---- Connect to the phone's head unit server and start the car screen ----
"%ADB%" forward tcp:5277 tcp:5277 >nul
taskkill /im desktop-head-unit.exe /f >nul 2>&1
echo Starting the car screen. If it says "Waiting for phone", start the head unit server
echo on the phone (Android Auto ^> three dots ^> Start head unit server) and run this again.
echo.
echo Type in the car screen's console:  fuel 42   range 180   fuel 80
cd /d "%DHU_DIR%"
start "Android Auto console - type: fuel 42 / range 180" "%DHU_DIR%\desktop-head-unit.exe" -c "%CFG%"
endlocal
