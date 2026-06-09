#!/bin/bash
# Add Node.js to PATH and start the server
export PATH="/usr/local/Cellar/node@22/22.22.3/bin:$PATH"
echo ""
echo "  ✦ Starting Kingdom Within..."
echo "  ✦ Open: http://localhost:3000"
echo ""
node server.js
