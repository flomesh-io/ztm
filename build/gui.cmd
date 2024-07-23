@ECHO off

SET cur_dir=%CD%

CD %~dp0
CD ..
SET ztm_dir=%CD%

CD "%ztm_dir%\gui"
CMD /c "npm run build"
CMD /c "npm run build:tunnel"
CMD /c "npm run build:proxy"
CMD /c "npm run build:script"

CD "%ztm_dir%\pipy"
IF EXIST build\deps\codebases.tar.gz.h (DEL build\deps\codebases.tar.gz.h)

CD "%cur_dir%"
