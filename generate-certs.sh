#!/bin/bash
# generate-certs.sh — generates a self-signed TLS certificate valid for 5 years.
#
# Usage:
#   chmod +x generate-certs.sh
#   ./generate-certs.sh                        # uses defaults
#   ./generate-certs.sh mycompany.internal      # custom CN
#
# Output: certs/cert.pem  certs/key.pem
# Run once before "docker compose up -d". Re-run to renew.

set -e

CN="${1:-localhost}"
DAYS=1825   # 5 years
CERTS_DIR="$(dirname "$0")/certs"

mkdir -p "$CERTS_DIR"

echo "[certs] Generating RSA-4096 self-signed certificate for CN=$CN (valid $DAYS days) ..."

openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$CERTS_DIR/key.pem" \
  -out    "$CERTS_DIR/cert.pem" \
  -days   "$DAYS" \
  -nodes \
  -subj   "/CN=$CN/O=KB Portal/OU=IT" \
  -addext "subjectAltName=DNS:$CN,DNS:localhost,IP:127.0.0.1"

echo "[certs] Done."
echo "  cert: $CERTS_DIR/cert.pem"
echo "  key:  $CERTS_DIR/key.pem"
echo ""
echo "Run 'docker compose up -d' to start the portal."
