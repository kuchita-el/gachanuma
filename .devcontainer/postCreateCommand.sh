#!/bin/bash

curl -fsSL https://claude.ai/install.sh | bash

npm install
npm run prepare

npx playwright install --with-deps chromium
npx -y @playwright/mcp@0.0.75 install-browser chrome-for-testing
