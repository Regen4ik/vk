@echo off
title Bot
echo Starting bot...
echo.

if not exist node_modules (
    echo install node modules...
    npm install
)

echo bot started...
node bot.js

pause