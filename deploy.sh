#!/usr/bin/env bash
# Stigma — one-shot deploy script.
# Run this on YOUR machine (not in a chat sandbox).
# It uses the GitHub CLI's browser-based OAuth flow, so you never type a token.
set -e

REPO_NAME="${1:-stigma}"
VISIBILITY="${2:-public}"   # public or private

echo "==> Checking for gh CLI"
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI not found. Install it: https://cli.github.com  (or: brew install gh)"
  exit 1
fi

echo "==> Logging you in via browser (no token in this terminal)"
gh auth status >/dev/null 2>&1 || gh auth login --scopes repo --git-protocol https

echo "==> Creating repo '$REPO_NAME' ($VISIBILITY) and pushing"
gh repo create "$REPO_NAME" --"$VISIBILITY" --source=. --remote=origin --push \
  --description "Stigma — your account, your apps, your way."

echo
echo "Done. View it at: https://github.com/$(gh api user -q .login)/$REPO_NAME"
