#!/bin/bash

curl -fsSL https://claude.ai/install.sh | bash

npm install
node node_modules/lefthook/bin/index.js install --reset-hooks-path || echo "[warn] lefthook install failed"
