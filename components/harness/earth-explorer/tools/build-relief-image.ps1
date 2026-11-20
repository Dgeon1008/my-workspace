param(
  [Parameter(Mandatory = $true)]
  [string]$InputTiff
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$resolvedInput = (Resolve-Path -LiteralPath $InputTiff).Path
$appDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'app'
$outputPath = Join-Path $appDirectory 'terrain-relief.jpg'
$source = [System.Drawing.Bitmap]::FromFile($resolvedInput)
$target = [System.Drawing.Bitmap]::new(4096, 2048, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$graphics = [System.Drawing.Graphics]::FromImage($target)

try {
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.DrawImage($source, 0, 0, 4096, 2048)

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
  $parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
  $parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
    [System.Drawing.Imaging.Encoder]::Quality,
    [long] 88
  )
  $target.Save($outputPath, $codec, $parameters)
  Write-Output "Wrote $outputPath ($($target.Width)×$($target.Height))"
}
finally {
  $graphics.Dispose()
  $target.Dispose()
  $source.Dispose()
}
