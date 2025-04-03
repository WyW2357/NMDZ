@echo off
cd /d %~dp0
start yarn start
timeout /t 1
start http://localhost:3000/
start http://localhost:3000/
start http://localhost:3000/
pause 