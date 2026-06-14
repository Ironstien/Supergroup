param(
  [Parameter(Mandatory = $true)]
  [string]$OutPath
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Write-PngPayload {
  param(
    [string]$Path,
    $Payload
  )

  if ($null -eq $Payload) { return $false }

  if ($Payload -is [byte[]]) {
    [System.IO.File]::WriteAllBytes($Path, $Payload)
    return $true
  }

  if ($Payload -is [System.IO.Stream]) {
    if ($Payload.CanSeek) { $Payload.Position = 0 }
    $fileStream = [System.IO.File]::Create($Path)
    try {
      $Payload.CopyTo($fileStream)
    }
    finally {
      $fileStream.Close()
      if ($Payload -is [System.IDisposable]) { $Payload.Dispose() }
    }
    return $true
  }

  return $false
}

function Save-BitmapAsPng {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  if ($null -eq $Bitmap) { return $false }

  $ownedClone = $false
  $toSave = $Bitmap

  try {
    if ($Bitmap.PixelFormat -ne [System.Drawing.Imaging.PixelFormat]::Format32bppArgb) {
      $toSave = New-Object System.Drawing.Bitmap $Bitmap.Width, $Bitmap.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $ownedClone = $true
      $graphics = [System.Drawing.Graphics]::FromImage($toSave)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.DrawImage($Bitmap, 0, 0, $Bitmap.Width, $Bitmap.Height)
      }
      finally {
        $graphics.Dispose()
      }
    }

    $toSave.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    return $true
  }
  finally {
    if ($ownedClone -and $null -ne $toSave) { $toSave.Dispose() }
    $Bitmap.Dispose()
  }
}

function Test-PngFormatName {
  param([string]$FormatName)
  if ([string]::IsNullOrWhiteSpace($FormatName)) { return $false }
  if ($FormatName -eq 'PNG') { return $true }
  return $FormatName -match '(?i)^image/png$'
}

try {
  if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) {
    exit 2
  }

  $dataObject = [System.Windows.Forms.Clipboard]::GetDataObject()
  if ($null -eq $dataObject) {
    exit 2
  }

  # Prefer raw PNG clipboard bytes — Chrome/Edge put alpha-preserving PNG here.
  # Clipboard.GetImage() drops transparency and fills alpha with black.
  foreach ($format in $dataObject.GetFormats($true)) {
    if (-not (Test-PngFormatName $format)) { continue }
    if (-not $dataObject.GetDataPresent($format)) { continue }

    $payload = $dataObject.GetData($format)
    if (Write-PngPayload -Path $OutPath -Payload $payload) {
      exit 0
    }

    if ($payload -is [System.IO.Stream]) {
      if ($payload.CanSeek) { $payload.Position = 0 }
      try {
        $bitmap = [System.Drawing.Bitmap]::FromStream($payload)
        if (Save-BitmapAsPng -Bitmap $bitmap -Path $OutPath) {
          exit 0
        }
      }
      catch {
        # Try the next available format.
      }
    }
  }

  $image = [System.Windows.Forms.Clipboard]::GetImage()
  if ($null -eq $image) {
    exit 2
  }

  $bitmap = [System.Drawing.Bitmap]$image
  if (Save-BitmapAsPng -Bitmap $bitmap -Path $OutPath) {
    exit 0
  }

  exit 1
}
catch {
  [Console.Error]::WriteLine($_.Exception.Message)
  exit 1
}
