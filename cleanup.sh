#!/bin/bash
# ============================================================
# ELOS - Demo Cleanup Script
# Run from the project root (elos-main/)
# ============================================================

echo "=== ELOS Demo Cleanup ==="
echo ""

# 1. Remove debug/fix scripts from root
echo "Removing debug fix scripts..."
git rm -f fix_closing_brace.js 2>/dev/null
git rm -f fix_dropdown_empty_values.py 2>/dev/null
git rm -f fix_mainlayout_syntax.js 2>/dev/null

# 2. Remove session/debug markdown files from root
echo "Removing session notes and debug docs..."
git rm -f FIX_CATEGORIES_INSTRUCTIONS.md 2>/dev/null
git rm -f FRONTEND_CACHE_ISSUE.md 2>/dev/null
git rm -f NAVIGATION_FIX_STATUS.md 2>/dev/null
git rm -f RAILWAY_DEPLOY.md 2>/dev/null
git rm -f RAILWAY_MANUAL_DEPLOY_STEPS.md 2>/dev/null
git rm -f SESSION_RESUME_PHASE1.md 2>/dev/null
git rm -f SESSION_SUMMARY.md 2>/dev/null

# 3. Keep FUTURE_ENHANCEMENTS.md (useful reference) - move to docs/
echo "Moving FUTURE_ENHANCEMENTS.md to docs/..."
git mv FUTURE_ENHANCEMENTS.md docs/FUTURE_ENHANCEMENTS.md 2>/dev/null

# 4. Remove empty backend/Dish file
echo "Removing empty backend/Dish file..."
git rm -f backend/Dish 2>/dev/null

# 5. Remove committed log files (should be gitignored)
echo "Removing committed log files..."
git rm -rf logs/ 2>/dev/null

# 6. Make sure logs are gitignored
if ! grep -q "^logs/" .gitignore 2>/dev/null; then
  echo "" >> .gitignore
  echo "# Log files" >> .gitignore
  echo "logs/" >> .gitignore
  git add .gitignore
  echo "Added logs/ to .gitignore"
fi

echo ""
echo "=== Cleanup complete ==="
echo ""
echo "Now run:"
echo "  git status                    # Review changes"
echo "  git commit -m 'Cleanup: remove debug scripts and session files for demo'"
echo "  git push"
