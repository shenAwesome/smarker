set msbuild="C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\msbuild.exe"
set devenv= "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\IDE\devenv.exe"

cd /D "%~dp0" 

call ./core/build.bat

cd /D "%~dp0" 

rem %msbuild% smarker.sln

%devenv% "./Setup/Setup.vdproj" /Rebuild