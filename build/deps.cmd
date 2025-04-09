@ECHO off

SET cur_dir=%CD%

CD %~dp0
CD ..
SET ztm_dir=%CD%

CD "%ztm_dir%"
CMD /c "git submodule update --init"

CD "%ztm_dir%\pipy"
CMD /c "npm install --no-audit"

CD "%ztm_dir%\gui"
CMD /c "npm install --no-audit"

CD "%cur_dir%"

if exist "hub\cluster.js" (
    set EDITION=Enterprise
) else (
    set EDITION=Community
)

if defined ZTM_VERSION (
    set VERSION=%ZTM_VERSION%
) else (
    FOR /f %%i IN ('git describe --abbrev^=0 --tags') DO SET VERSION=%%i
)

FOR /f %%i IN ('git log -1 --format^=%%H') DO SET COMMIT=%%i
FOR /f "eol= tokens=* delims=" %%i IN ('"git log -1 --format=%%cD"') DO SET COMMIT_DATE=%%i

ECHO {"edition":"%EDITION%","tag":"%VERSION%","commit":"%COMMIT%","date":"%COMMIT_DATE%"} > cli\version.json
COPY cli\version.json hub\version.json
COPY cli\version.json agent\version.json
