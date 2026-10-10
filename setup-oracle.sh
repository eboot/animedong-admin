#!/usr/bin/env bash
# Setup lengkap di Oracle VM (Ubuntu): nginx + animedong-admin + animeapi.
# Jalankan sebagai root:  sudo bash setup-oracle.sh
#
# Hasil (akses via IP publik):
#   animedong-admin : http://<IP>/            (frontend + /api/* -> :3001)
#   animeapi        : http://<IP>/kura/api/*   (-> :3002)
#
# Aman dijalankan ulang: git pull, npm install, rebuild, restart service.

# Kalau dijalankan via sh/dash, re-exec pakai bash (butuh pipefail).
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

ADMIN_DIR="/opt/animedong-admin"
KURA_DIR="/home/ubuntu/app/animeapi"
KURA_USER="ubuntu"

echo "== 0. Node.js 22 LTS =="
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs
fi
node -v

echo "== 1. nginx + git + curl =="
apt-get install -y -qq nginx git curl

echo "== 2. animedong-admin: git pull + install + build =="
if [ -d "$ADMIN_DIR/.git" ]; then
  git -C "$ADMIN_DIR" fetch origin
  git -C "$ADMIN_DIR" reset --hard origin/main
else
  rm -rf "$ADMIN_DIR"
  git clone --depth 1 https://github.com/eboot/animedong-admin.git "$ADMIN_DIR"
fi
cd "$ADMIN_DIR"
npm run install:all
npm run build

echo "== 3. animeapi (branch supabase): git pull + install =="
if [ -d "$KURA_DIR/.git" ]; then
  git -C "$KURA_DIR" fetch origin
  git -C "$KURA_DIR" reset --hard origin/supabase
else
  sudo -u "$KURA_USER" mkdir -p "$(dirname "$KURA_DIR")"
  sudo -u "$KURA_USER" git clone --depth 1 -b supabase https://github.com/eboot/animeapi.git "$KURA_DIR"
fi
chown -R "$KURA_USER:$KURA_USER" "$KURA_DIR"
cd "$KURA_DIR"
sudo -u "$KURA_USER" npm install

echo "== 4. systemd services =="
cat > /etc/systemd/system/animedong-admin.service <<'EOF'
[Unit]
Description=AnimeDong Admin (Express + SQLite)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/animedong-admin
ExecStart=/usr/bin/node /opt/animedong-admin/backend/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
# animeapi satu mesin (sumber kurama):
Environment=KURAMA_API_URL=http://127.0.0.1:3002
# R2 CDN image (isi lalu uncomment kalau sudah punya):
#Environment=R2_ACCOUNT_ID=
#Environment=R2_ACCESS_KEY_ID=
#Environment=R2_SECRET_ACCESS_KEY=
#Environment=R2_BUCKET=
#Environment=R2_PUBLIC_URL=

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/animeapi.service <<'EOF'
[Unit]
Description=AnimeAPI Kurama Scraper (Supabase)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/app/animeapi
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3002
# Kredensial Supabase (WAJIB): taruh di /etc/animeapi.env, format:
#   SUPABASE_URL=https://xyz.supabase.co
#   SUPABASE_SECRET_KEY=...
# File ini tidak ikut git (repo publik), dibuat manual sekali.
EnvironmentFile=-/etc/animeapi.env
# R2 CDN image (isi lalu uncomment kalau sudah punya):
#Environment=R2_ACCOUNT_ID=
#Environment=R2_ACCESS_KEY_ID=
#Environment=R2_SECRET_ACCESS_KEY=
#Environment=R2_BUCKET=
#Environment=R2_PUBLIC_URL=

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now animedong-admin
systemctl enable --now animeapi

echo "== 5. nginx =="
cat > /etc/nginx/sites-available/animedong <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    client_max_body_size 50m;

    # animeapi: /kura/api/stats -> 127.0.0.1:3002/api/stats
    location /kura/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # animedong-admin: frontend + /api/* -> :3001
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/animedong /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx
systemctl reload nginx || systemctl restart nginx

echo "== 6. Buka port 80 di firewall VM =="
iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 443 -j ACCEPT
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
if command -v netfilter-persistent >/dev/null 2>&1; then netfilter-persistent save; fi

echo "== 7. Verifikasi =="
sleep 3
for s in animedong-admin animeapi nginx; do
  if systemctl is-active --quiet "$s"; then echo "OK: $s jalan"; else echo "GAGAL: $s"; journalctl -u "$s" -n 15 --no-pager || true; fi
done
curl -s -o /dev/null -w "admin /api/stats (:3001)      -> HTTP %{http_code}\n" http://127.0.0.1:3001/api/stats || true
curl -s -o /dev/null -w "animeapi /api/stats (:3002)   -> HTTP %{http_code}\n" http://127.0.0.1:3002/api/stats || true
curl -s -o /dev/null -w "nginx /kura/api/stats (:80)   -> HTTP %{http_code}\n" http://127.0.0.1/kura/api/stats || true
curl -s -o /dev/null -w "nginx / (:80)                 -> HTTP %{http_code}\n" http://127.0.0.1/ || true

PUBIP=$(curl -s --max-time 5 https://api.ipify.org || echo "<IP-PUBLIK-VM>")
echo ""
echo "SELESAI."
echo "  animedong-admin : http://$PUBIP/"
echo "  animeapi        : http://$PUBIP/kura/api/stats"
echo ""
echo "PENTING: OCI Console -> Networking -> Security List VCN -> tambah Ingress 0.0.0.0/0 TCP 80."
echo ""
echo "SUPABASE (wajib untuk animeapi):"
echo "  1. Jalankan supabase-schema.sql (branch supabase repo animeapi) di Supabase SQL Editor."
echo "  2. Buat /etc/animeapi.env berisi:"
echo "       SUPABASE_URL=https://xyz.supabase.co"
echo "       SUPABASE_SECRET_KEY=..."
echo "     lalu: sudo systemctl restart animeapi"
echo "  Tanpa ini, /kura/api/* jawab 502 (env belum di-set)."
