#!/bin/bash
set -e

# QuikDB Leaderboard API Deployment Script
# Builds Docker image, pushes to ECR, and deploys to EKS

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="047218031589"
ECR_REPOSITORY="quikdb-ecr"
IMAGE_TAG="leaderboard-api-latest"
NAMESPACE="default"
DEPLOYMENT_FILE=".github/deployment.yaml"

# Environment (default to dev)
ENVIRONMENT="${1:-dev}"

# Set AWS profile only if not in CI (GitHub Actions sets CI=true)
if [ "${CI}" = "true" ]; then
  unset AWS_PROFILE  # Don't use profiles in CI
else
  AWS_PROFILE="quikdb-${ENVIRONMENT}"
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}QuikDB Leaderboard API Deployment${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Build Docker image
echo -e "\n${GREEN}[1/5] Building Docker image...${NC}"
docker build --platform linux/amd64 -t ${IMAGE_TAG} .

# Step 2: Tag for ECR
echo -e "\n${GREEN}[2/5] Tagging image for ECR...${NC}"
ECR_IMAGE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"
docker tag ${IMAGE_TAG} ${ECR_IMAGE}

# Step 3: Login to ECR
echo -e "\n${GREEN}[3/5] Logging in to ECR...${NC}"
# Use profile if set, otherwise use default credentials (for CI/CD)
if [ -n "${AWS_PROFILE}" ] && [ "${AWS_PROFILE}" != "default" ]; then
  aws ecr get-login-password --region ${AWS_REGION} --profile ${AWS_PROFILE} | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
else
  aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
fi

# Step 4: Push to ECR
echo -e "\n${GREEN}[4/5] Pushing image to ECR...${NC}"
docker push ${ECR_IMAGE}

# Step 5: Deploy to EKS
echo -e "\n${GREEN}[5/5] Deploying to EKS...${NC}"
kubectl apply -f ${DEPLOYMENT_FILE} --namespace=${NAMESPACE}

# Trigger rollout restart to pick up new image
echo -e "\n${BLUE}Triggering rollout restart...${NC}"
kubectl delete pods -l app=leaderboard-api --ignore-not-found=true --namespace=${NAMESPACE}

# Show deployment status (without waiting)
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Status${NC}"
echo -e "${GREEN}========================================${NC}"
kubectl get deployments -n ${NAMESPACE} -l app=leaderboard-api
kubectl get pods -n ${NAMESPACE} -l app=leaderboard-api
kubectl get svc -n ${NAMESPACE} leaderboard-api

# Get Ingress info
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Ingress Information${NC}"
echo -e "${GREEN}========================================${NC}"
kubectl get ingress -n ${NAMESPACE} quikdb-api-ingress

# Show ALB DNS
ALB_DNS=$(kubectl get ingress quikdb-api-ingress -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Ingress not yet ready")
echo -e "\n${BLUE}ALB DNS Name:${NC} ${ALB_DNS}"
echo -e "${BLUE}Leaderboard Host:${NC} leaderboard.prod.quikdb.net"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Cloudflare DNS Configuration${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Add the following CNAME record in Cloudflare:"
echo -e "${BLUE}Type:${NC}    CNAME"
echo -e "${BLUE}Name:${NC}    leaderboard.prod"
echo -e "${BLUE}Target:${NC}  ${ALB_DNS}"
echo -e "${BLUE}Proxy:${NC}   Enabled (orange cloud)"
echo -e "${BLUE}TTL:${NC}     Auto"

echo -e "\n${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "\n${BLUE}Test the API:${NC}"
echo -e "  kubectl port-forward -n ${NAMESPACE} svc/leaderboard-api 3001:3001"
echo -e "  curl http://localhost:3001/health"
echo -e "\n${BLUE}View logs:${NC}"
echo -e "  kubectl logs -n ${NAMESPACE} -l app=leaderboard-api -f"
