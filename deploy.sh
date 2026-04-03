#!/bin/bash
# Org-Diagnosis Backend Deploy Script
# Usage: ./deploy.sh [branch]
# Deploys backend to HK Docker node

set -e

BRANCH=${1:-main}
LOCAL_BACKEND="$(dirname "$0")/backend"
REMOTE="root@103.59.103.85"
REMOTE_DIR="/opt/org-diagnosis/backend"

echo "=== Org-Diagnosis Deploy ==="
echo "Branch: $BRANCH"
echo "Remote: $REMOTE:$REMOTE_DIR"
echo ""

# Ensure latest code
echo ">>> Pulling latest code..."
git pull origin "$BRANCH" 2>/dev/null || echo "(Not on a git branch, using local files)"

# Sync backend code (exclude local artifacts)
echo ">>> Syncing code to HK..."
rsync -avz --delete \
  --exclude '__pycache__' \
  --exclude '.venv' \
  --exclude 'data/' \
  --exclude '.env' \
  --exclude 'checkpoints/' \
  --exclude 'scripts/competency/input/' \
  -e "ssh -J hk-jump" \
  "$LOCAL_BACKEND/" \
  "${REMOTE}:${REMOTE_DIR}/"

# Rebuild Docker image
echo ">>> Building Docker image..."
ssh hk-jump "cd ${REMOTE_DIR} && docker build -t org-diagnosis-api:latest ."

# Restart container (recreate to pick up new image)
echo ">>> Restarting container..."
ssh hk-jump "
  docker stop org-diagnosis-api 2>/dev/null || true
  docker rm org-diagnosis-api 2>/dev/null || true
  docker run -d \
    --name org-diagnosis-api \
    --restart unless-stopped \
    --network cb-network \
    -p 127.0.0.1:8000:8000 \
    -v /opt/org-diagnosis/backend/.env:/app/.env \
    -v /opt/org-diagnosis/data:/app/data \
    org-diagnosis-api:latest
  docker network connect docker_internal org-diagnosis-api
"

# Health check
echo ">>> Health check..."
sleep 5
HEALTH=$(ssh hk-jump "curl -sf http://localhost:8000/api/health" 2>&1)
echo "API: $HEALTH"

echo ""
echo "=== Deploy Complete ==="
echo "API: https://org-diagnosis.3strategy.cc"
echo "Logs: ssh hk-jump 'docker logs org-diagnosis-api --tail 50 -f'"
