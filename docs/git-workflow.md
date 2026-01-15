# Git Workflow and Branching Strategy

## Overview

This document defines the Git workflow, branching strategy, and contribution guidelines for the Settleright.ai platform.

---

## Branching Model

We use a simplified Git Flow model with the following branches:

```
main (production)
  │
  └── develop (integration)
        │
        ├── feature/SR-123-add-kyc-flow
        ├── feature/SR-124-evidence-upload
        ├── fix/SR-125-login-error
        └── hotfix/SR-126-critical-payment-bug
```

### Branch Types

| Branch | Purpose | Base | Merges To |
|--------|---------|------|-----------|
| `main` | Production code | - | - |
| `develop` | Integration branch | `main` | `main` |
| `feature/*` | New features | `develop` | `develop` |
| `fix/*` | Bug fixes | `develop` | `develop` |
| `hotfix/*` | Critical production fixes | `main` | `main` + `develop` |
| `release/*` | Release preparation | `develop` | `main` + `develop` |

---

## Branch Naming Conventions

### Format

```
<type>/<ticket-id>-<short-description>
```

### Examples

```bash
# Features
feature/SR-123-add-kyc-verification
feature/SR-124-evidence-upload-component
feature/SR-125-ai-analysis-pipeline

# Bug fixes
fix/SR-126-login-redirect-loop
fix/SR-127-file-upload-validation

# Hotfixes (critical production issues)
hotfix/SR-128-payment-processing-error
hotfix/SR-129-security-vulnerability

# Releases
release/v1.0.0
release/v1.1.0
```

### Rules

- Use lowercase letters
- Use hyphens to separate words
- Include ticket ID (e.g., SR-123) when applicable
- Keep descriptions short but meaningful (3-5 words)

---

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons, etc. |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, tooling |
| `ci` | CI/CD configuration |
| `revert` | Reverting a previous commit |

### Scopes

| Scope | Description |
|-------|-------------|
| `api` | Backend API |
| `web` | Frontend application |
| `db` | Database schema/migrations |
| `auth` | Authentication |
| `case` | Case management |
| `evidence` | Evidence handling |
| `ai` | AI analysis |
| `arbitration` | Arbitrator workflow |
| `payment` | Payment processing |
| `infra` | Infrastructure |
| `deps` | Dependencies |

### Examples

```bash
# Feature
feat(case): add evidence upload functionality

# Bug fix
fix(auth): resolve token refresh race condition

# With body and footer
feat(ai): implement draft award generation

- Add Claude API integration
- Create prompt templates for legal analysis
- Generate structured findings of fact

Closes SR-234

# Breaking change
feat(api)!: change case status enum values

BREAKING CHANGE: CaseStatus enum values have been renamed.
Migration script included in /scripts/migrate-status.sql
```

### Rules

- Subject line: max 72 characters
- Use imperative mood ("add" not "added" or "adds")
- Don't end subject with a period
- Separate subject from body with blank line
- Body: wrap at 80 characters
- Reference issues/tickets in footer

---

## Workflow Procedures

### Starting a New Feature

```bash
# 1. Ensure develop is up to date
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/SR-123-new-feature

# 3. Work on your feature, committing regularly
git add .
git commit -m "feat(scope): implement initial functionality"

# 4. Push branch to remote
git push -u origin feature/SR-123-new-feature

# 5. Open Pull Request when ready
```

### Keeping Branch Up to Date

```bash
# Rebase onto latest develop (preferred for feature branches)
git checkout feature/SR-123-new-feature
git fetch origin
git rebase origin/develop

# If conflicts occur, resolve them, then:
git add .
git rebase --continue

# Force push after rebase (only for your own branches!)
git push --force-with-lease
```

### Creating a Pull Request

1. Push your branch to GitHub
2. Open a Pull Request against `develop`
3. Fill out the PR template
4. Request reviewers
5. Address review feedback
6. Squash and merge when approved

### Hotfix Procedure

```bash
# 1. Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/SR-999-critical-fix

# 2. Fix the issue
git add .
git commit -m "fix(scope): resolve critical issue"

# 3. Push and create PR to main
git push -u origin hotfix/SR-999-critical-fix

# 4. After merge to main, also merge to develop
git checkout develop
git pull origin develop
git merge main
git push origin develop
```

### Release Procedure

```bash
# 1. Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0

# 2. Bump version numbers
pnpm version 1.2.0 --no-git-tag-version
git add .
git commit -m "chore: bump version to 1.2.0"

# 3. Final testing and fixes (if needed)
git commit -m "fix: last-minute release fix"

# 4. Merge to main
git checkout main
git merge --no-ff release/v1.2.0
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main --tags

# 5. Merge back to develop
git checkout develop
git merge --no-ff release/v1.2.0
git push origin develop

# 6. Delete release branch
git branch -d release/v1.2.0
git push origin --delete release/v1.2.0
```

---

## Pull Request Guidelines

### PR Template

```markdown
## Description
<!-- What does this PR do? -->

## Type of Change
- [ ] Feature (new functionality)
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test update

## Related Issues
<!-- Link to related issues: Closes #123 -->

## How Has This Been Tested?
<!-- Describe the tests you ran -->
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have added tests that prove my fix/feature works
- [ ] All new and existing tests pass
- [ ] I have updated documentation as needed
- [ ] I have added audit logging for sensitive operations
- [ ] I have considered security implications

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->
```

### Review Requirements

| Change Type | Reviewers Required | Approvals Needed |
|-------------|-------------------|------------------|
| Documentation only | 1 | 1 |
| Minor bug fix | 1 | 1 |
| Feature | 2 | 1 |
| API changes | 2 | 2 |
| Database changes | 2 | 2 |
| Security-related | 2 + Security lead | 2 |
| Infrastructure | 2 + DevOps | 2 |

### Merge Strategy

- **Feature branches → develop**: Squash and merge
- **Release branches → main**: Merge commit (no squash)
- **Hotfix branches → main**: Merge commit (no squash)
- **Develop → main**: Merge commit (no squash)

---

## Protected Branches

### `main` Branch

- **Protected**: Yes
- **Require PR**: Yes
- **Required reviews**: 2
- **Dismiss stale reviews**: Yes
- **Require status checks**: Yes
  - CI/CD pipeline must pass
  - All tests must pass
  - Security scan must pass
- **Require branches up to date**: Yes
- **Include administrators**: Yes
- **Allow force push**: No
- **Allow deletion**: No

### `develop` Branch

- **Protected**: Yes
- **Require PR**: Yes
- **Required reviews**: 1
- **Dismiss stale reviews**: Yes
- **Require status checks**: Yes
  - CI/CD pipeline must pass
  - All tests must pass
- **Require branches up to date**: Yes
- **Include administrators**: No
- **Allow force push**: No
- **Allow deletion**: No

---

## CI/CD Integration

### Status Checks

Every PR triggers:

1. **Lint** - ESLint checks
2. **Type Check** - TypeScript compilation
3. **Unit Tests** - Jest test suite
4. **Integration Tests** - API tests
5. **Security Scan** - Dependency audit
6. **Build** - Verify build succeeds

### Auto-merge

PRs can be set to auto-merge after:
- All status checks pass
- Required reviews obtained
- Branch is up to date

---

## Git Configuration

### Recommended Global Config

```bash
# Set your identity
git config --global user.name "Your Name"
git config --global user.email "your.email@settleright.ai"

# Use rebase for pull
git config --global pull.rebase true

# Prune stale branches on fetch
git config --global fetch.prune true

# Set default branch name
git config --global init.defaultBranch main

# Better diff algorithm
git config --global diff.algorithm histogram

# Sign commits (recommended)
git config --global commit.gpgsign true
git config --global user.signingkey YOUR_GPG_KEY_ID
```

### .gitignore

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build output
.next/
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/
.nyc_output/

# Prisma
prisma/*.db

# Misc
*.tsbuildinfo
```

---

## Git Hooks (Husky)

### Pre-commit

```bash
#!/bin/sh
# .husky/pre-commit

# Run lint-staged
pnpm lint-staged

# Type check
pnpm type-check
```

### Commit-msg

```bash
#!/bin/sh
# .husky/commit-msg

# Validate commit message format
pnpm commitlint --edit $1
```

### Pre-push

```bash
#!/bin/sh
# .husky/pre-push

# Run tests before pushing
pnpm test
```

---

## Tips and Best Practices

### Do

- Commit early and often
- Write meaningful commit messages
- Keep PRs focused and small (< 400 lines)
- Rebase feature branches regularly
- Delete merged branches
- Use `git stash` for work-in-progress
- Review your own PR before requesting reviews

### Don't

- Don't commit directly to `main` or `develop`
- Don't force push to shared branches
- Don't commit secrets or sensitive data
- Don't create PRs with merge conflicts
- Don't ignore failing tests
- Don't leave PRs open for more than a few days

### Useful Commands

```bash
# View branch history graph
git log --oneline --graph --all

# Find which commit introduced a bug
git bisect start
git bisect bad HEAD
git bisect good v1.0.0

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Amend last commit message
git commit --amend

# Cherry-pick a commit to current branch
git cherry-pick <commit-hash>

# Clean up local branches
git fetch -p && git branch -vv | grep ': gone]' | awk '{print $1}' | xargs git branch -D
```

---

## Troubleshooting

### Merge Conflicts

```bash
# During rebase
git status  # See conflicting files
# Edit files to resolve conflicts
git add <resolved-files>
git rebase --continue

# To abort
git rebase --abort
```

### Accidental Commit to Wrong Branch

```bash
# Move last commit to correct branch
git checkout correct-branch
git cherry-pick wrong-branch
git checkout wrong-branch
git reset --hard HEAD~1
```

### Recover Deleted Branch

```bash
# Find the commit hash
git reflog

# Recreate branch
git checkout -b recovered-branch <commit-hash>
```
