# Push to Production Deployment Script

This script automates the deployment process to production by committing changes locally, connecting to the GCloud VM, pulling updates, and rebuilding the Docker containers.

## Prerequisites

- Ensure you have gcloud CLI installed and configured
- Make sure you're authenticated with the correct GCloud project
- Have the instance name `irisvirtualmachine` available in your project

## Deployment Steps

### 1. Local Git Operations
```bash
# Add all changes and commit with a descriptive message
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S') - Production deployment"

# Push changes to remote repository
git push origin main
```

### 2. Connect to GCloud VM and Deploy
```bash
# Connect to the GCloud VM instance and run deployment commands
gcloud compute ssh irisvirtualmachine --command="cd irissecond && git pull origin main && docker system prune -f && docker compose build --no-cache && docker compose up -d"
```

## Alternative: Step-by-Step Manual Execution

If you prefer to run commands individually:

### Step 1: Commit and Push Locally
```bash
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S') - Production deployment"
git push origin main
```

### Step 2: Connect to VM
```bash
gcloud compute ssh irisvirtualmachine
```

### Step 3: Run on VM
```bash
cd irissecond
git pull origin main
docker system prune -f
docker compose build --no-cache
docker compose up -d
```

## Notes

- The `docker system prune -f` command removes unused Docker objects to free up space
- The `--no-cache` flag ensures a fresh build without using cached layers
- The `-d` flag runs containers in detached mode (background)
- Make sure to replace `irisvirtualmachine` with your actual VM instance name if different

## Troubleshooting

If you encounter issues:
1. Check that your GCloud authentication is valid: `gcloud auth list`
2. Verify the instance name: `gcloud compute instances list`
3. Ensure the instance is running: `gcloud compute instances describe irisvirtualmachine`
4. Check Docker daemon status on the VM: `docker info`
