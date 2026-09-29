#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

HERMES_HOME="${HERMES_HOME:-/home/chaowei/hermes-accounts/cancer}"
CACHE="${HERMES_HOME}/cache/mcp_schema_cache.json"

if [[ -n "${HERMES_SERVICE:-}" ]]; then
  SERVICE="${HERMES_SERVICE}"
else
  mapfile -t SERVICES < <(
    systemctl list-units --type=service --state=running --no-legend \
      | awk '{print $1}' \
      | grep -Ei 'hermes.*gateway|gateway.*hermes' \
      | sort -u || true
  )

  if [[ ${#SERVICES[@]} -ne 1 ]]; then
    echo "Could not find exactly one Hermes Gateway service. Candidates:"
    printf '  %s\n' "${SERVICES[@]:-(none)}"
    echo
    echo "List services: systemctl list-units --type=service | grep -Ei 'hermes|gateway'"
    echo "Then run: sudo HERMES_SERVICE=SERVICE_NAME $0"
    exit 2
  fi
  SERVICE="${SERVICES[0]}"
fi

if [[ -f "$CACHE" ]]; then
  BACKUP="${CACHE}.bak-$(date +%Y%m%d-%H%M%S)"
  cp -a -- "$CACHE" "$BACKUP"
  rm -f -- "$CACHE"
  echo "Backed up and cleared MCP cache: $BACKUP"
else
  echo "No old MCP cache found: $CACHE"
fi

echo "Restarting Gateway: $SERVICE"
systemctl restart "$SERVICE"
systemctl is-active --quiet "$SERVICE"
echo "Gateway is healthy: $(systemctl is-active "$SERVICE")"
echo "Return to Hermes, create a new chat, and test windows-local-files."
