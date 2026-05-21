$env:DEBUG='false'
$env:LABEL_STUDIO_BASE_DATA_DIR='d:\Data\VIT\4th sem\edi1\style_anti\.label-studio-data'
$env:SECRET_KEY='style-studio-local-label-studio'
Remove-Item Env:HOST -ErrorAction SilentlyContinue
& "$env:APPDATA\Python\Python313\Scripts\label-studio.exe" start --port 8080 --host 127.0.0.1 *> 'd:\Data\VIT\4th sem\edi1\style_anti\data\label_studio.combined.log'
