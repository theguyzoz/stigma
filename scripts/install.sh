#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
echo "Installing Stigma dependencies..."
npm install
echo "Done. Run 'npm start' to launch."
