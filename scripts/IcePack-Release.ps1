# Read the release label declared by the current source. This does not inspect installed components.
function Get-IcePackReleaseLabel([string]$ManifestPath) {
    try {
        $manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        if ([string]$manifest.version -cmatch '^(\d+\.\d+)-alpha$') {
            return "v$($Matches[1]) Alpha"
        }
    } catch {
        # Manual overlays and older snapshots can lack release metadata.
    }
    return 'Release unknown'
}
