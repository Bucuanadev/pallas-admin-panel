@echo off
REM Execute este script dentro do diretório C:\Users\User\pallas-admin-panel
REM Ele inicializa o git, adiciona todos os ficheiros, faz commit e envia para o GitHub.

git init
git add .
git commit -m "Initial Pallas.shop admin panel MVP"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/Bucuanadev/pallas-admin-panel.git
git push -u origin main

echo.
echo Se o Git pedir credenciais, use seu nome de usuário do GitHub e o token de acesso pessoal como password.
echo Script concluído.
pause
