@echo off
title GovFinance - Previdencia Sao Joao da Boa Vista
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0govfinance-server.ps1"
