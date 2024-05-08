@ECHO off

SET cur_dir=%CD%

CD %~dp0
CD ..
SET ztm_dir=%CD%

CD "%ztm_dir%\gui"
CMD /c "npm run build"

CD "%cur_dir%"
