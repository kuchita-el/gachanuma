#!/bin/bash

curl -fsSL https://claude.ai/install.sh | bash

npm install
npm run prepare

npx playwright install --with-deps chromium
