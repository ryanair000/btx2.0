@echo off
REM Quick data refresh for Windows
REM Run this when you hit API rate limits

echo ============================================================
echo BTX 2.0 - Quick Data Refresh
echo ============================================================
echo.
echo This will update your local data files using web scraping.
echo No API keys required!
echo.
pause

echo.
echo [1/3] Fetching team stats from FBRef...
python scripts\scrape_fbref.py
if %ERRORLEVEL% EQU 0 (
    echo [OK] FBRef data updated
) else (
    echo [WARN] FBRef scraper had issues
)

echo.
echo [2/3] Fetching xG data from Understat...
python scripts\scrape_understat.py
if %ERRORLEVEL% EQU 0 (
    echo [OK] Understat data updated
) else (
    echo [WARN] Understat scraper had issues
)

echo.
echo [3/3] Fetching player stats from FPL...
python scripts\scrape_fpl.py
if %ERRORLEVEL% EQU 0 (
    echo [OK] FPL data updated
) else (
    echo [WARN] FPL scraper had issues
)

echo.
echo ============================================================
echo REFRESH COMPLETE
echo ============================================================
echo.
echo Your local data has been updated!
echo The app will now use this data instead of the API.
echo.
echo Next steps:
echo   1. Restart dev server: npm run dev
echo   2. App will automatically use local data
echo.
pause
