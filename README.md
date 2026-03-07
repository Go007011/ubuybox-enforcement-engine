UBUYBOX Enforcement Engine

## Purpose
Durable/workflow-style Azure Functions workload for UBUYBOX enforcement and automation processing.

## Deployment
- Workflow file: `.github/workflows/deploy-enforcement.yml`
- Workflow name: `Deploy UBUYBOX Enforcement Engine`
- Branch trigger: `main`
- Azure Function App target: `ubuybox-enforcement-engine`

## Required GitHub Secrets
- `AZURE_CLIENT_ID_ENFORCEMENT`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
