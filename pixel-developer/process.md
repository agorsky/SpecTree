# Pixel Developer — Design-to-Code Pipeline Process

This document defines the 8-step pipeline process that converts a Figma design into a pixel-perfect code implementation, iteratively validates it, and locks the result into CI.

## Pipeline Overview

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│  1. RECEIVE  │───▶│  2. EXTRACT  │───▶│  3. SCOUT   │───▶│  4. CAPTURE  │
│  Figma Link  │    │  Design Spec │    │  Components │    │  Baseline    │
└─────────────┘    └──────────────┘    └─────────────┘    └──────┬───────┘
                                                                 │
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────▼───────┐
│  8. LOCK    │◀───│  7. REPORT   │◀───│  6. LOOP    │◀───│  5. COMPARE  │
│  CI Guard   │    │  Results     │    │  Fix/Valid.  │    │  Pixel Diff  │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

---

## Step 1: Receive Figma Input

**Agent:** `pd-orchestrator`

**Input:** User provides a Figma URL and target component path.

**Actions:**
1. Parse the Figma URL to extract file ID and node ID
2. Validate the target component path exists in the codebase
3. Load project configuration from `pd-config.json`
4. Load threshold and viewport configs
5. Verify the dev server is running and accessible

**Output:** Validated pipeline configuration

**Exit criteria:** All configuration loaded, dev server reachable, Figma URL valid

---

## Step 2: Extract Design Specifications

**Agent:** `pd-figma-extractor`

**Input:** Figma URL, node ID, viewport dimensions

**Actions:**
1. Connect to Figma via `figma-console/*` MCP tools
2. Navigate to the target node
3. Extract the full node tree with properties:
   - Colors (fills, strokes, text colors)
   - Typography (font family, size, weight, line-height, letter-spacing)
   - Spacing (padding, margins, gap from auto-layout)
   - Dimensions (width, height, constraints)
   - Borders (radius per corner, width, color)
   - Shadows (drop shadow, inner shadow, blur)
   - Layout (flex direction, alignment, wrapping, gap)
4. Map extracted values to existing design tokens where possible
5. Export the target node as a reference screenshot (2x scale PNG)

**Output:** Design Spec JSON + reference image

**Exit criteria:** All visual properties extracted, reference image captured, tokens mapped

---

## Step 3: Scout Codebase for Reuse

**Agent:** `pd-component-scout`

**Input:** Design Spec JSON, target component path, framework config

**Actions:**
1. Search for existing design tokens (CSS custom properties, SCSS variables)
2. Build a Token Registry mapping raw values → token names
3. Search for existing UI components that match design elements
4. Score component matches (0-100) based on property overlap
5. Identify layout patterns already in use
6. Flag new tokens needed (values with no existing match)
7. Determine which files need to be created or modified

**Output:** Component Map (token registry, component matches, layout recommendations)

**Exit criteria:** All design values mapped to tokens or flagged as new, file list prepared

---

## Step 4: Capture Baseline Implementation

**Agent:** `pd-screenshot-comparator` (capture-only mode)

**Input:** Dev server URL, viewport presets, target selector

**Actions:**
1. Launch Playwright headless browser
2. Configure viewport dimensions and device pixel ratio
3. Navigate to the implementation URL
4. Wait for full page load (network idle + fonts loaded)
5. Disable all CSS animations and transitions
6. Capture the component or page screenshot at configured viewport
7. Save as baseline implementation image

**Output:** Baseline implementation screenshot

**Exit criteria:** Screenshot captured at correct dimensions, no rendering artifacts

---

## Step 5: Compare Implementation vs Design

**Agent:** `pd-screenshot-comparator` (compare mode)

**Input:** Implementation screenshot, Figma reference image, threshold config

**Actions:**
1. Ensure both images have identical dimensions (resize if needed)
2. Run pixelmatch comparison with anti-aliasing tolerance
3. Generate diff image (red = mismatched pixels, transparent = matching)
4. Calculate overall diff percentage
5. Calculate per-region breakdown (4×4 grid)
6. Identify hotspot regions (highest diff areas)
7. Evaluate against threshold (viewport-specific or global)

**Output:** Comparison results (diff %, diff image, region breakdown, PASS/FAIL)

**Exit criteria:** Diff calculated, regions identified, threshold evaluated

**If PASS:** Skip to Step 7 (report results)

---

## Step 6: Iterative Fix-Validate Loop

**Agents:** `pd-diff-analyzer`, `pd-fixer`, `pd-standards-enforcer`, `pd-validator`

**Input:** Diff results, Design Spec JSON, Component Map, source files

**Loop (max 3 rounds):**

### 6a. Analyze Differences
- Map high-diff regions to specific DOM elements
- Compare CSS properties against Design Spec values
- Score each difference by visual impact (0-100)
- Produce a prioritized fix list ordered by impact
- Deduplicate against previous round's fixes (if round > 1)

### 6b. Apply Fixes
- Process fixes in priority order (highest impact first)
- Use design tokens from the Component Map — never hardcode
- Create new tokens if needed (in the token definition file)
- Make surgical, minimal changes — one property at a time
- Verify build passes after changes

### 6c. Enforce Standards
- Audit all modified files for BEM naming compliance
- Check for hardcoded color, spacing, sizing values
- Verify no `@use` or `@forward` imports
- Check selector specificity and nesting depth
- Report PASS/FAIL with violations list
- **If critical violations:** fixer must remediate before validation

### 6d. Validate
- Re-capture implementation screenshot (same viewport, same settings)
- Run pixelmatch comparison against the same reference image
- Calculate new diff percentage
- Analyze trend: improving, stagnant, or regressing
- Determine CONTINUE, PASS, or ABORT

### Loop Exit Conditions
| Condition | Result |
|-----------|--------|
| Diff ≤ threshold | ✅ PASS — exit loop |
| Round > max (3) | ❌ ABORT — max iterations |
| Regressing 2 consecutive rounds | ❌ ABORT — diverging |
| Stagnant 2 consecutive rounds | ❌ ABORT — no progress |
| Diff increased > 5% in one round | ❌ ABORT — catastrophic |

**Output:** Final diff percentage, PASS/FAIL status, complete diff history

---

## Step 7: Generate Report

**Agent:** `pd-orchestrator`

**Input:** All pipeline data (spec, map, diff history, changes, violations)

**Actions:**
1. Compile the final pixel-fidelity report
2. Include diff history table with trend analysis
3. List all files created or modified
4. List all CSS properties changed with before/after values
5. Include all screenshots (baseline, each round, final diff)
6. Include standards compliance summary
7. Note any unresolved issues or known limitations

**Report structure:**
```
## Result: PASS / FAIL
## Diff Summary: {initial}% → {final}% in {rounds} rounds
## Changes: {file count} files, {property count} CSS changes, {token count} new tokens
## Standards: {pass/fail} — {violation count} violations
## Viewport Coverage: desktop ✅, tablet ✅, mobile ⚠️
## Diff History Table
## Files Modified List
## Screenshots (baseline, rounds, final diff)
```

**Exit criteria:** Report generated with all data points

---

## Step 8: CI Lock (Optional)

**Agent:** `pd-orchestrator`

**Input:** Final passing screenshot, threshold config, viewport presets

**Actions:**
1. Save the passing screenshot as the new reference baseline
2. Configure visual regression test in the CI pipeline:
   - Store reference image in the repository (e.g., `__screenshots__/`)
   - Add or update Playwright visual comparison test
   - Set threshold from config (1% max diff)
3. The test will run on every PR that modifies the component:
   - Captures a fresh screenshot
   - Compares against stored reference
   - Fails the build if diff exceeds threshold

**Playwright visual test example:**
```javascript
test('component matches design', async ({ page }) => {
  await page.goto('/components/dashboard');
  await page.waitForLoadState('networkidle');
  
  const element = await page.locator('.dashboard');
  await expect(element).toHaveScreenshot('dashboard-desktop.png', {
    maxDiffPixelRatio: 0.01,  // 1% threshold
    animations: 'disabled',
  });
});
```

**Exit criteria:** Reference screenshot saved, visual regression test configured and passing

---

## Pipeline Timing Expectations

| Step | Typical Duration | Notes |
|------|-----------------|-------|
| 1. Receive | Instant | Configuration loading |
| 2. Extract | 10-30s | Figma API calls |
| 3. Scout | 5-15s | Codebase search |
| 4. Capture | 5-10s | Browser launch + screenshot |
| 5. Compare | 2-5s | Pixelmatch computation |
| 6. Loop (per round) | 30-60s | Analyze + Fix + Enforce + Validate |
| 7. Report | Instant | Compilation |
| 8. CI Lock | 5-10s | File save + test config |
| **Total (3 rounds)** | **~3-5 minutes** | Excluding dev server startup |

## Error Recovery

| Failure Point | Recovery |
|---------------|----------|
| Figma connection | Retry once with `figma_reconnect()` |
| Dev server down | Abort with error — user must start server |
| Screenshot capture | Retry with longer timeout (30s) |
| Build failure after fix | Revert last fix, re-analyze |
| Standards enforcement blocks | Fixer remediates, re-validate |
| Loop fails to converge | Abort with report of remaining issues |
