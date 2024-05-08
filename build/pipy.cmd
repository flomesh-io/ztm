@ECHO off

SET cur_dir=%CD%

CD %~dp0
CD ..
SET ztm_dir=%CD%

CD "%ztm_dir%\pipy"

IF NOT EXIST build (MD build)

CD build
SET codebases="ztm/ca:../ca,ztm/hub:../hub,ztm/agent:../agent"
CMD /c "cmake .. -DCMAKE_BUILD_TYPE=Release -DPIPY_GUI=OFF -DPIPY_CODEBASES=ON -DPIPY_CUSTOM_CODEBASES=%codebases%"
CMD /c "msbuild pipy.sln -t:pipy -p:Configuration=Release"

CD "%cur_dir%"
