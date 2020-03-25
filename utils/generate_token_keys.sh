#!/usr/bin/env bash
# Please run this from repository root or provide the path arugment to the script
# ./utils/generate_token_keys.sh


SCRIPT_DIR=$(dirname "$0")
PROJECT_ROOT=$(realpath "$SCRIPT_DIR/..")
KEYS_DIR=$PROJECT_ROOT/token_keys

mkdir -p "$KEYS_DIR"

echo "Generating Keys"
openssl genrsa -out "$KEYS_DIR"/private_key
openssl rsa -in "$KEYS_DIR"/private_key -pubout > "$KEYS_DIR"/public_key
echo "Generated keys can be found in $KEYS_DIR. Please move the keys outside the project root before deployment."
