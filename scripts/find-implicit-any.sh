#!/bin/bash
# Find potential implicit any issues in API routes and pages
# These patterns are commonly problematic when Next.js builds in isolation

echo "=== Searching for potential implicit 'any' type issues ==="
echo ""

# Find .map, .filter, .reduce, .find, .forEach callbacks without explicit types
# in src/app directory (routes and pages)

echo "--- Callbacks in array methods that may need explicit types ---"
echo ""

# Pattern: .map((x) => or .map((x, or .filter((x) => etc.
# These are likely to have implicit any when Prisma results lose type info

grep -rn --include="*.ts" --include="*.tsx" \
  -E '\.(map|filter|reduce|find|forEach|some|every)\(\([a-zA-Z_][a-zA-Z0-9_]*\)' \
  src/app/api src/app/\(dashboard\) 2>/dev/null | \
  grep -v "as [A-Z]" | \
  grep -v ": [A-Z]" | \
  head -50

echo ""
echo "--- Checking for Prisma results used in callbacks without casting ---"
echo ""

# Look for patterns like: results.map((item) => where results comes from prisma
grep -rn --include="*.ts" \
  -E '(await prisma\.[a-zA-Z]+\.(findMany|groupBy|findFirst))' \
  src/app/api 2>/dev/null | head -20

echo ""
echo "=== To fix: Add interface for the data shape and cast the array ==="
echo "Example:"
echo "  interface MyItem { id: string; name: string; }"
echo "  const typed = results as MyItem[];"
echo "  typed.map((item: MyItem) => ...)"
