#!/usr/bin/env pwsh
<#
  Generate PWA Icons from SVG
  Requires: ImageMagick (convert command)
  Usage: powershell -ExecutionPolicy Bypass -File scripts/generate-pwa-icons.ps1
#>

$ErrorActionPreference = "Stop"

$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)
$outputDir = "public/icons"

if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Create a simple SVG icon if none exists
$svgPath = "public/icon.svg"
if (!(Test-Path $svgPath)) {
    $svg = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2563eb" rx="64"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="280" font-weight="bold" fill="white" text-anchor="middle">C</text>
</svg>
'@
    Set-Content -Path $svgPath -Value $svg -Encoding UTF8
    Write-Host "Created SVG icon at $svgPath" -ForegroundColor Green
}

foreach ($size in $sizes) {
    $outputPath = "$outputDir/icon-${size}x${size}.png"
    
    # Try ImageMagick first
    $convert = Get-Command "convert" -ErrorAction SilentlyContinue
    if ($convert) {
        & convert -background none -resize "${size}x${size}" $svgPath $outputPath
        Write-Host "Generated $outputPath (ImageMagick)" -ForegroundColor Green
    } else {
        # Fallback: create a placeholder using .NET
        Add-Type -AssemblyName System.Drawing
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
        
        # Background
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(37, 99, 235))
        $graphics.FillRectangle($brush, 0, 0, $size, $size)
        
        # Text
        $fontSize = [int]($size * 0.55)
        $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $stringFormat = New-Object System.Drawing.StringFormat
        $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
        $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
        $graphics.DrawString("C", $font, $textBrush, $size / 2, $size / 2, $stringFormat)
        
        $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()
        
        Write-Host "Generated $outputPath (.NET fallback)" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! Icons generated in $outputDir" -ForegroundColor Green
Write-Host "Add these to your manifest.json and HTML head." -ForegroundColor Cyan
