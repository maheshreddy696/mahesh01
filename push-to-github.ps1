# PowerShell helper script to connect this repository to your GitHub account and push it
param(
    [Parameter(Mandatory=$true, HelpMessage="Enter your GitHub repository URL (e.g. https://github.com/USERNAME/fsd-project.git)")]
    [string]$RepoUrl
)

$env:PATH = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$env:PATH"

Write-Host "Configuring remote origin: $RepoUrl" -ForegroundColor Cyan
git remote remove origin 2>$null
git remote add origin $RepoUrl

Write-Host "Renaming branch to main..." -ForegroundColor Cyan
git branch -M main

Write-Host "Pushing to GitHub..." -ForegroundColor Green
git push -u origin main

Write-Host "`nSuccessfully pushed to $RepoUrl!" -ForegroundColor Green
