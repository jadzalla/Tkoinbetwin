#!/bin/bash
# HMAC Signature Generator for Platform API Testing
# Usage: ./generate-signature.sh TIMESTAMP METHOD PATH BODY

TIMESTAMP=$1
METHOD=$2
PATH=$3
BODY=$4
SECRET="ab0d6715b594c415d4e354c03024ef6e"

MESSAGE="${TIMESTAMP}${METHOD}${PATH}${BODY}"
echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64
