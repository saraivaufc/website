#!/bin/bash
cd "$(dirname "$0")"
find . -type f -name "*.Zone.Identifier" -exec rm -f {} \;