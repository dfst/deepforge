#!/usr/bin/env bash
# Please run this from repository root or provide the path arugment to the script
# ./utils/generate_token_keys.sh


PARENT_DIR=..

if [[ $# -gt 0 ]];
  then
    PARENT_DIR=$1;
fi

KEYS_DIR=$PARENT_DIR/token_keys

mkdir -p "$KEYS_DIR"

echo "Generating Keys"
openssl genrsa -out "$KEYS_DIR"/private_key

openssl rsa -in "$KEYS_DIR"/private_key -pubout > "$KEYS_DIR"/public_key
echo "Keys are now in $KEYS_DIR"
