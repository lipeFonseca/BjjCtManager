$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$rect = New-Object System.Drawing.RectangleF(4, 4, 248, 248)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$radius = 42.0
$diameter = $radius * 2
$path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
$path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
$path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
$path.CloseFigure()

$backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  ([System.Drawing.PointF]::new(0, 0)),
  ([System.Drawing.PointF]::new(0, $size)),
  ([System.Drawing.Color]::FromArgb(255, 18, 18, 22)),
  ([System.Drawing.Color]::FromArgb(255, 8, 8, 10))
)
$graphics.FillPath($backgroundBrush, $path)

$borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(140, 255, 255, 255)), 2.2
$graphics.DrawPath($borderPen, $path)

$glowEllipse = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowEllipse.AddEllipse(48, 176, 160, 48)
$glowFill = New-Object System.Drawing.Drawing2D.PathGradientBrush $glowEllipse
$glowFill.CenterColor = [System.Drawing.Color]::FromArgb(230, 255, 24, 24)
$glowFill.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 24, 24))
$graphics.FillEllipse($glowFill, 48, 176, 160, 48)

$topGlow = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  ([System.Drawing.PointF]::new(122, 34)),
  ([System.Drawing.PointF]::new(190, 102)),
  ([System.Drawing.Color]::FromArgb(220, 255, 40, 40)),
  ([System.Drawing.Color]::FromArgb(0, 255, 40, 40))
)
$graphics.FillRectangle($topGlow, 118, 24, 82, 76)

$leftPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(240, 230, 230, 232)), 12
$rightPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(250, 255, 45, 45)), 12
$leftPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$rightPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

$leftPoints = @(
  [System.Drawing.PointF]::new(68, 68),
  [System.Drawing.PointF]::new(122, 42),
  [System.Drawing.PointF]::new(122, 202),
  [System.Drawing.PointF]::new(68, 176)
)
$rightPoints = @(
  [System.Drawing.PointF]::new(136, 42),
  [System.Drawing.PointF]::new(188, 68),
  [System.Drawing.PointF]::new(188, 176),
  [System.Drawing.PointF]::new(136, 202)
)

$graphics.DrawLines($leftPen, $leftPoints)
$graphics.DrawLines($rightPen, $rightPoints)

$innerLeftPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)), 7
$innerRightPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)), 7
$innerLeftPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$innerRightPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawLines($innerLeftPen, @(
  [System.Drawing.PointF]::new(83, 79),
  [System.Drawing.PointF]::new(108, 66),
  [System.Drawing.PointF]::new(108, 186),
  [System.Drawing.PointF]::new(83, 173)
))
$graphics.DrawLines($innerRightPen, @(
  [System.Drawing.PointF]::new(149, 66),
  [System.Drawing.PointF]::new(173, 79),
  [System.Drawing.PointF]::new(173, 173),
  [System.Drawing.PointF]::new(149, 186)
))

$fontFamily = New-Object System.Drawing.FontFamily("Arial")
$font = New-Object System.Drawing.Font($fontFamily, 54, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

$graphics.DrawString("B", $font, ([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 245, 245, 245))), 97, 128, $stringFormat)
$graphics.DrawString("J", $font, ([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 255, 255))), 149, 128, $stringFormat)

$pngStream = New-Object System.IO.MemoryStream
$bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $pngStream.ToArray()

$iconDir = New-Object byte[] 6
$iconDir[0] = 0
$iconDir[1] = 0
$iconDir[2] = 1
$iconDir[3] = 0
$iconDir[4] = 1
$iconDir[5] = 0

$entry = New-Object byte[] 16
$entry[0] = 0
$entry[1] = 0
$entry[2] = 0
$entry[3] = 0
$entry[4] = 1
$entry[5] = 0
$entry[6] = 32
$entry[7] = 0
[System.BitConverter]::GetBytes([int]$pngBytes.Length).CopyTo($entry, 8)
[System.BitConverter]::GetBytes(22).CopyTo($entry, 12)

$icoBytes = New-Object System.Collections.Generic.List[byte]
$icoBytes.AddRange($iconDir)
$icoBytes.AddRange($entry)
$icoBytes.AddRange($pngBytes)

[System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot "..\\public\\favicon.ico"), $icoBytes.ToArray())

$graphics.Dispose()
$bitmap.Dispose()
$backgroundBrush.Dispose()
$borderPen.Dispose()
$leftPen.Dispose()
$rightPen.Dispose()
$innerLeftPen.Dispose()
$innerRightPen.Dispose()
$font.Dispose()
$fontFamily.Dispose()
$path.Dispose()
$glowEllipse.Dispose()
$glowFill.Dispose()
$topGlow.Dispose()
