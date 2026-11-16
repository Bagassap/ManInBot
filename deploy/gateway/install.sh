#!/usr/bin/env bash
# Dijalankan DI SERVER sebagai root: memasang/memperbarui gateway MiB (akun, kuota harian, pembayaran, perantara AI).
# Berkas server.mjs db.mjs mail.mjs main.mjs cli.mjs admin.mjs package.json harus ada di direktori yang sama dengan skrip ini.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
NODE_VER="${NODE_VER:-v22.23.4}"
NODE_DIR=/opt/node22

# Node 22 (butuh node:sqlite). Dipasang terpisah dari Node sistem agar tidak mengganggu apa pun.
if [ ! -x "$NODE_DIR/bin/node" ] || ! "$NODE_DIR/bin/node" -e 'require("node:sqlite")' 2>/dev/null; then
  echo "[gateway] memasang Node $NODE_VER"
  mkdir -p "$NODE_DIR"
  curl -fsSL "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz" | tar -xJ -C "$NODE_DIR" --strip-components=1
fi
export PATH="$NODE_DIR/bin:$PATH"

id mibgw >/dev/null 2>&1 || useradd --system --home /var/lib/mib-gateway --shell /usr/sbin/nologin mibgw
install -d -o mibgw -g mibgw -m 700 /var/lib/mib-gateway
install -d -m 755 /opt/mib-gateway
for f in server.mjs db.mjs mail.mjs main.mjs cli.mjs admin.mjs package.json; do install -m 644 "$SRC/$f" /opt/mib-gateway/; done
rm -f /opt/mib-gateway/store.mjs
(cd /opt/mib-gateway && npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1)

# Berkas lingkungan (rahasia). Hanya menambah kunci yang belum ada; nilai yang sudah diisi tidak disentuh.
umask 077
touch /etc/mib-gateway.env
add() { grep -q "^$1=" /etc/mib-gateway.env || printf '%s=%s\n' "$1" "$2" >> /etc/mib-gateway.env; }
add ANTHROPIC_API_KEY ""
add PORT 4100
add ALLOWED_MODELS "claude-opus-5-5,claude-sonnet-5-5"
add FORCE_MODEL "claude-sonnet-5-5"
add FREE_PER_DAY 3
add PAID_PER_DAY 30
add PLAN_DAYS 30
add PLAN_PRICE_IDR 0
add MIDTRANS_SERVER_KEY ""
add MIDTRANS_PRODUCTION 0
add SMTP_HOST ""
add SMTP_PORT 587
add SMTP_SECURE 0
add SMTP_USER ""
add SMTP_PASS ""
add MAIL_FROM ""
add ADMIN_PATH ""
add REQUIRE_EMAIL_VERIFY 0
add ADMIN_PASS_HASH ""
add ADMIN_IPS ""
chmod 600 /etc/mib-gateway.env

cat > /etc/systemd/system/mib-gateway.service <<UNIT
[Unit]
Description=Gateway MiB (akun, kuota, pembayaran, perantara layanan AI)
After=network-online.target
Wants=network-online.target

[Service]
User=mibgw
Group=mibgw
EnvironmentFile=/etc/mib-gateway.env
Environment=DATA_DIR=/var/lib/mib-gateway
ExecStart=$NODE_DIR/bin/node --disable-warning=ExperimentalWarning /opt/mib-gateway/main.mjs
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

# Perintah admin
cat > /usr/local/bin/mib-admin <<WRAP
#!/bin/sh
exec sudo -u mibgw env DATA_DIR=/var/lib/mib-gateway $NODE_DIR/bin/node --disable-warning=ExperimentalWarning /opt/mib-gateway/cli.mjs "\$@"
WRAP
chmod 755 /usr/local/bin/mib-admin
rm -f /usr/local/bin/mib-license

# Mengisi satu nilai rahasia tanpa menampilkannya di layar atau riwayat perintah.
#   mib-set ANTHROPIC_API_KEY | MIDTRANS_SERVER_KEY | SMTP_PASS
cat > /usr/local/bin/mib-set <<'SET'
#!/bin/bash
set -e
[ "$(id -u)" -eq 0 ] || exec sudo "$0" "$@"
N="${1:-}"
case "$N" in ANTHROPIC_API_KEY|MIDTRANS_SERVER_KEY|SMTP_PASS) ;; *) echo "Pakai: mib-set ANTHROPIC_API_KEY | MIDTRANS_SERVER_KEY | SMTP_PASS"; exit 1;; esac
read -r -s -p "Tempel nilai $N (tidak akan tampil), lalu Enter: " V; echo
[ -n "$V" ] || { echo "Kosong; dibatalkan."; exit 1; }
if [ "$N" = ANTHROPIC_API_KEY ]; then case "$V" in sk-ant-*) ;; *) echo "Format kunci tidak dikenali; dibatalkan."; exit 1;; esac; fi
umask 077
grep -v "^$N=" /etc/mib-gateway.env > /etc/mib-gateway.env.new || true
printf '%s=%s\n' "$N" "$V" >> /etc/mib-gateway.env.new
mv /etc/mib-gateway.env.new /etc/mib-gateway.env
systemctl restart mib-gateway
sleep 1
systemctl is-active mib-gateway && echo "Tersimpan; gateway dimulai ulang."
SET
chmod 755 /usr/local/bin/mib-set
printf '#!/bin/sh\nexec /usr/local/bin/mib-set ANTHROPIC_API_KEY\n' > /usr/local/bin/mib-set-key
chmod 755 /usr/local/bin/mib-set-key

# Dashboard admin: membuat alamat rahasia acak (sekali) dan mengatur kata sandi admin.
#   mib-admin-setup            atur/ganti kata sandi (alamat tetap)
#   mib-admin-setup --new-url  buat alamat rahasia baru (alamat lama langsung mati)
cat > /usr/local/bin/mib-admin-setup <<SETUP
#!/bin/bash
set -e
[ "\$(id -u)" -eq 0 ] || exec sudo "\$0" "\$@"
ENVF=/etc/mib-gateway.env
umask 077
setv() { grep -v "^\$1=" \$ENVF > \$ENVF.new || true; printf '%s=%s\n' "\$1" "\$2" >> \$ENVF.new; mv \$ENVF.new \$ENVF; }
P=\$(grep '^ADMIN_PATH=' \$ENVF | cut -d= -f2- || true)
if [ -z "\$P" ] || [ "\${1:-}" = "--new-url" ]; then
  P="ops-\$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  setv ADMIN_PATH "\$P"
fi
read -r -s -p "Kata sandi admin baru (min. 12 karakter): " A; echo
read -r -s -p "Ulangi kata sandi: " B; echo
[ "\$A" = "\$B" ] || { echo "Tidak sama; dibatalkan."; exit 1; }
H=\$(printf '%s' "\$A" | $NODE_DIR/bin/node --disable-warning=ExperimentalWarning /opt/mib-gateway/cli.mjs hash-stdin)
setv ADMIN_PASS_HASH "\$H"
systemctl restart mib-gateway
sleep 1
systemctl is-active mib-gateway >/dev/null && echo "Dashboard admin aktif. Simpan alamat ini baik-baik (jangan dibagikan):"
echo "  https://maninbot.id/ai/\$P/"
SETUP
chmod 755 /usr/local/bin/mib-admin-setup

# Email kode verifikasi lewat Gmail (App Password). Menanyakan alamat + sandi aplikasi, mematikan mode uji,
# lalu mengirim email percobaan ke alamat itu sendiri.
cat > /usr/local/bin/mib-email-gmail <<GMAIL
#!/bin/bash
set -e
[ "\$(id -u)" -eq 0 ] || exec sudo "\$0" "\$@"
ENVF=/etc/mib-gateway.env
umask 077
setv() { grep -v "^\$1=" \$ENVF > \$ENVF.new || true; printf '%s=%s\n' "\$1" "\$2" >> \$ENVF.new; mv \$ENVF.new \$ENVF; }
read -r -p "Alamat Gmail pengirim: " G
case "\$G" in *@gmail.com|*@googlemail.com) ;; *) echo "Harus alamat Gmail; dibatalkan."; exit 1;; esac
read -r -s -p "App Password Gmail (16 huruf, tidak tampil): " P; echo
P=\$(printf '%s' "\$P" | tr -d ' ')
[ \${#P} -eq 16 ] || { echo "App Password harus 16 huruf; dibatalkan."; exit 1; }
setv SMTP_HOST smtp.gmail.com
setv SMTP_PORT 587
setv SMTP_SECURE 0
setv SMTP_USER "\$G"
setv SMTP_PASS "\$P"
setv MAIL_FROM "MiB <\$G>"
setv DEV_LOG_CODES 0
echo "Mengirim email percobaan ke \$G ..."
if env SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_SECURE=0 SMTP_USER="\$G" SMTP_PASS="\$P" MAIL_FROM="MiB <\$G>" DATA_DIR=/tmp \\
     $NODE_DIR/bin/node --disable-warning=ExperimentalWarning /opt/mib-gateway/cli.mjs test-mail "\$G"; then
  systemctl restart mib-gateway; sleep 1
  systemctl is-active mib-gateway >/dev/null && echo "Selesai. Kode verifikasi MiB kini dikirim lewat email."
else
  echo "Pengaturan tersimpan tetapi email gagal terkirim. Periksa alamat dan App Password, lalu jalankan lagi."
  exit 1
fi
GMAIL
chmod 755 /usr/local/bin/mib-email-gmail

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
block = """    # Gateway MiB (akun, kuota, pembayaran, perantara layanan AI)
    location /ai/ {
        limit_req zone=mibai burst=60 nodelay;
        client_max_body_size 25m;
        proxy_pass http://127.0.0.1:4100/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
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
elif ! grep -q 'X-Real-IP' "$CONF"; then
  sed -i 's#^\(\s*\)proxy_set_header Host \$host;#&\n\1proxy_set_header X-Real-IP $remote_addr;#' "$CONF"
fi
nginx -t
systemctl reload nginx

systemctl restart mib-gateway
sleep 1
systemctl is-active mib-gateway
journalctl -u mib-gateway -n 3 --no-pager | tail -2
