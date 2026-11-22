#!/bin/sh
# One-time setup on a fresh Ubuntu 22.04/24.04 VM (x86-64 or ARM, e.g. Oracle Cloud Always Free).
# Run as a sudo-capable user:
#   curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/deployment/vm/setup.sh -o setup.sh
#   sh setup.sh https://github.com/<owner>/<repo>.git
set -eu
REPO=${1:?Usage: sh setup.sh <git repository URL>}
DIR=${PLUGGO_DIR:-$HOME/pluggo}

echo "1/4 Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "2/4 Opening ports 80 and 443 in the VM firewall"
# Oracle's Ubuntu images ship iptables rules that block everything but SSH. Also open
# 80/443 in the cloud console (VCN → Security List → Ingress rules).
if sudo iptables -L INPUT -n 2>/dev/null | grep -q "REJECT"; then
  for port in 80 443; do
    sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp --dport "$port" -j ACCEPT
  done
  if command -v netfilter-persistent >/dev/null 2>&1; then sudo netfilter-persistent save; fi
fi

echo "3/4 Fetching Pluggo"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
cd "$DIR/deployment/vm"
if [ ! -f .env ]; then
  cp .env.example .env
  key=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  sed -i "s/^PLUGGO_GATEWAY_KEY=$/PLUGGO_GATEWAY_KEY=$key/" .env
  chmod 600 .env
  echo "Created $DIR/deployment/vm/.env. Fill in PLUGGO_DOMAIN and the keys, then run: sh deploy.sh"
  exit 0
fi

echo "4/4 Starting"
sh deploy.sh
