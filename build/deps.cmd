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
