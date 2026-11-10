#!/usr/bin/env bash
# Mengunggah situs promosi MiB + installer ke server Ubuntu (nginx).
# Prasyarat: `node deploy/build-site.cjs <origin>` sudah dijalankan; nginx terpasang di server.
# Pemakaian: deploy/deploy.sh <user@host> <file-kunci.pem> <server_name atau _>
set -euo pipefail

TARGET=${1:?user@host}
KEY=${2:?file kunci .pem}
SERVER_NAME=${3:-_}
HERE="$(cd "$(dirname "$0")" && pwd)"
DIST="$HERE/dist"
[ -d "$DIST/site" ] || { echo "Jalankan node deploy/build-site.cjs dulu" >&2; exit 1; }

SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
SCP=(scp -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes)

echo "[deploy] situs"
tar -C "$DIST/site" -czf - . | "${SSH[@]}" "$TARGET" 'rm -rf /var/www/mib/site.new && mkdir -p /var/www/mib/site.new && tar -xzf - -C /var/www/mib/site.new && rm -rf /var/www/mib/site.old && { [ -d /var/www/mib/site ] && mv /var/www/mib/site /var/www/mib/site.old || true; } && mv /var/www/mib/site.new /var/www/mib/site && rm -rf /var/www/mib/site.old'

echo "[deploy] info unduhan + skrip pemasang"
"${SCP[@]}" -q "$DIST/downloads/info.json" "$DIST/downloads/install.ps1" "$TARGET:/var/www/mib/downloads/"

echo "[deploy] installer"
"${SCP[@]}" -q "$DIST/downloads/MiB-Setup.exe" "$TARGET:/var/www/mib/downloads/MiB-Setup.exe.part"
"${SSH[@]}" "$TARGET" 'mv /var/www/mib/downloads/MiB-Setup.exe.part /var/www/mib/downloads/MiB-Setup.exe'

if [ "${FORCE_NGINX:-0}" = "1" ] || ! "${SSH[@]}" "$TARGET" 'test -f /etc/nginx/sites-available/mib'; then
  echo "[deploy] nginx (server_name=$SERVER_NAME)"
  sed -e "s/__SERVER_NAME__/$SERVER_NAME/g" "$HERE/nginx-mib.conf"     | "${SSH[@]}" "$TARGET" 'sudo tee /etc/nginx/sites-available/mib >/dev/null && sudo ln -sf /etc/nginx/sites-available/mib /etc/nginx/sites-enabled/mib && sudo rm -f /etc/nginx/sites-enabled/default'
else
  echo "[deploy] konfigurasi nginx sudah ada, tidak ditimpa (FORCE_NGINX=1 untuk memaksa)"
fi
"${SSH[@]}" "$TARGET" 'sudo nginx -t && sudo systemctl reload nginx'
echo "[deploy] selesai"
