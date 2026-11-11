#!/usr/bin/env bash
# Dijalankan DI SERVER (lewat deploy.sh atau ssh) sebagai root: memasang gateway MiB.
# Berkas server.mjs, store.mjs, cli.mjs harus sudah ada di direktori yang sama dengan skrip ini.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "[gateway] memasang Node 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi

id mibgw >/dev/null 2>&1 || useradd --system --home /var/lib/mib-gateway --shell /usr/sbin/nologin mibgw
install -d -o mibgw -g mibgw -m 700 /var/lib/mib-gateway
install -d -m 755 /opt/mib-gateway
install -m 644 "$SRC/server.mjs" "$SRC/store.mjs" "$SRC/cli.mjs" /opt/mib-gateway/

if [ ! -f /etc/mib-gateway.env ]; then
  umask 077
  printf 'ANTHROPIC_API_KEY=\nPORT=4100\nALLOWED_MODELS=claude-opus-5-5,claude-sonnet-5-5\n' > /etc/mib-gateway.env
  echo "[gateway] /etc/mib-gateway.env dibuat; ISI ANTHROPIC_API_KEY di sana"
fi

cat > /etc/systemd/system/mib-gateway.service <<'UNIT'
[Unit]
Description=Gateway MiB (kode lisensi -> layanan AI)
After=network-online.target
Wants=network-online.target

[Service]
User=mibgw
Group=mibgw
EnvironmentFile=/etc/mib-gateway.env
Environment=DATA_DIR=/var/lib/mib-gateway
ExecStart=/usr/bin/node /opt/mib-gateway/server.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/mib-gateway

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable mib-gateway >/dev/null 2>&1

cat > /usr/local/bin/mib-license <<'WRAP'
#!/bin/sh
exec sudo -u mibgw env DATA_DIR=/var/lib/mib-gateway /usr/bin/node /opt/mib-gateway/cli.mjs "$@"
WRAP
chmod 755 /usr/local/bin/mib-license

# nginx: pembatas laju + /ai/ diteruskan ke gateway (tanpa buffer agar aliran SSE langsung sampai)
cat > /etc/nginx/conf.d/mib-gateway-limit.conf <<'LIM'
limit_req_zone $binary_remote_addr zone=mibai:10m rate=30r/s;
LIM
CONF=/etc/nginx/sites-available/mib
if ! grep -q 'location /ai/' "$CONF"; then
  python3 - "$CONF" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
block = """    # Gateway MiB (kode lisensi -> layanan AI)
    location /ai/ {
        limit_req zone=mibai burst=60 nodelay;
        client_max_body_size 25m;
        proxy_pass http://127.0.0.1:4100/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 900s;
        proxy_send_timeout 900s;
    }

"""
marker = "    location / {"
assert s.count(marker) == 1, "penanda location / tidak unik"
open(p, "w").write(s.replace(marker, block + marker))
PY
fi
nginx -t
systemctl reload nginx

if grep -q '^ANTHROPIC_API_KEY=.\+' /etc/mib-gateway.env; then
  systemctl restart mib-gateway
  sleep 1
  systemctl is-active mib-gateway
else
  echo "[gateway] belum dijalankan: ANTHROPIC_API_KEY di /etc/mib-gateway.env masih kosong"
fi

# Pembantu: memasukkan kunci layanan AI tanpa menampilkannya di layar atau riwayat perintah.
cat > /usr/local/bin/mib-set-key <<'SETKEY'
#!/bin/bash
set -e
[ "$(id -u)" -eq 0 ] || exec sudo "$0" "$@"
read -r -s -p "Tempel kunci API (tidak akan tampil), lalu Enter: " K; echo
case "$K" in sk-ant-*) ;; *) echo "Format kunci tidak dikenali; dibatalkan."; exit 1;; esac
umask 077
grep -v '^ANTHROPIC_API_KEY=' /etc/mib-gateway.env > /etc/mib-gateway.env.new || true
printf 'ANTHROPIC_API_KEY=%s\n' "$K" >> /etc/mib-gateway.env.new
mv /etc/mib-gateway.env.new /etc/mib-gateway.env
systemctl restart mib-gateway
sleep 1
systemctl is-active mib-gateway && echo "Gateway aktif."
SETKEY
chmod 755 /usr/local/bin/mib-set-key
