# Linear Ordering Behavior - Research for COM-137

This document captures research on Linear's ordering and drag-drop behavior to inform SpecTree's implementation.

## Overview

Linear uses **fractional indexing** for manual ordering of issues and projects. This technique enables efficient drag-and-drop reordering without needing to update every item's position when one item moves.

## Sort Order Field Type and Range

### Linear's `sortOrder` Field

- **Type**: `Float` (double-precision floating-point number)
- **Range**: No explicit bounds; values can be positive or negative
- **Storage**: Standard IEEE 754 double-precision float (~15-17 significant decimal digits)

### Limitations of Float-Based Approach

Linear uses floating-point numbers for `sortOrder`, which has known limitations:
- After approximately 52 divisions between the same two values, floating-point precision becomes insufficient
- This can lead to values collapsing to identical numbers in edge cases
- Linear appears to handle this by periodically re-normalizing sort orders (observed behavior: "not only that value changes, but it seems the entire list is somehow re-ordered")

## Fractional Indexing Algorithm

### Core Concept

Fractional indexing works by:
1. Assigning numeric indices to items that maintain lexicographic/numeric order
2. When inserting between two items, calculating a midpoint value
3. Only updating the moved item(s), not the entire list

### Algorithm for Inserting Between Two Items

When inserting item C between items A and B:

```typescript
function getIndexBetween(indexA: number | null, indexB: number | null): number {
  // Case 1: Inserting between two existing items
  if (indexA !== null && indexB !== null) {
    return (indexA + indexB) / 2;
  }

  // Case 2: Inserting at the beginning (before first item)
  if (indexA === null && indexB !== null) {
    return indexB - 1;  // Or: indexB / 2 if you want positive-only
  }

  // Case 3: Inserting at the end (after last item)
  if (indexA !== null && indexB === null) {
    return indexA + 1;
  }

  // Case 4: First item in empty list
  return 0;  // Or any starting value like 1.0
}
```

### Inserting Multiple Items

When inserting N items between two indices:

```typescript
function getIndicesBetween(
  indexBelow: number | null,
  indexAbove: number | null,
  count: number
): number[] {
  const indices: number[] = [];

  const below = indexBelow ?? 0;
  const above = indexAbove ?? (below + count + 1);

  const step = (above - below) / (count + 1);

  for (let i = 0; i < count; i++) {
    indices.push(below + step * (i + 1));
  }

  return indices;
}
```

## Default Sort Order for New Items

Based on Linear's behavior:

1. **New issues added to a list**: Typically get a sort order that places them at the end
   - `newSortOrder = maxExistingSortOrder + 1` (or similar increment)

2. **New issues via API without explicit sortOrder**: Linear assigns a default position
   - Usually at the end of the current view/group
   - The exact value depends on the view context (project, status, etc.)

3. **Copied/moved issues**: Retain relative ordering where possible

## Behavior When Sort Orders Collide

### Detection

Two items have colliding sort orders when their values are equal or within floating-point epsilon of each other.

### Resolution Strategies

1. **Lazy Re-normalization** (Linear's observed approach):
   - When a collision is detected during reorder, normalize the affected range
   - Reassign evenly-spaced values to items in that range

2. **Proactive Prevention**:
   - Use string-based fractional indexing (see recommendation below)
   - Provides effectively unlimited precision

### Example Re-normalization Algorithm

```typescript
function normalizeRange(items: Item[], startIndex: number, endIndex: number): void {
  const start = items[startIndex].sortOrder;
  const end = items[endIndex].sortOrder;
  const count = endIndex - startIndex + 1;
  const step = (end - start) / (count - 1);

  for (let i = startIndex; i <= endIndex; i++) {
    items[i].sortOrder = start + step * (i - startIndex);
  }
}
```

## Ordering Scope: Per-View vs Global

### Linear's Approach

- **Manual ordering is global** within a context (project, parent issue, etc.)
- When you reorder issues manually, "it will update the manual order for everyone in the workspace"
- Different views (board, list, table) respect the same underlying sort order
- Grouping by status/priority/etc. creates sub-contexts with independent ordering within each group

### Implications for SpecTree

- Store a single `sortOrder` per item (not per-view)
- Views should filter/group items but respect the stored sort order within groups
- Consider separate sort orders for different contexts:
  - `sortOrder`: Order within parent issue
  - `projectSortOrder`: Order within project (if different from parent)

## Recommended Approach for SpecTree

### Option 1: String-Based Fractional Indexing (Recommended)

Use the string-based approach from the [rocicorp/fractional-indexing](https://github.com/rocicorp/fractional-indexing) library:

```typescript
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

// Generate first key
generateKeyBetween(null, null);        // "a0"

// Insert after "a0"
generateKeyBetween("a0", null);        // "a1"

// Insert between "a0" and "a1"
generateKeyBetween("a0", "a1");        // "a0V"

// Insert before "a0"
generateKeyBetween(null, "a0");        // "Zz"

// Bulk insert 3 items between "a1" and "a2"
generateNKeysBetween("a1", "a2", 3);   // ['a1G', 'a1V', 'a1l']
```

**Advantages**:
- Effectively unlimited precision (no floating-point issues)
- No need for periodic re-normalization
- Simple lexicographic comparison for sorting
- Well-tested library with multiple language implementations

**Database Column**: `VARCHAR(255)` or similar string type

### Option 2: Float with Re-normalization

Use floating-point numbers with collision detection and periodic re-normalization:

```typescript
interface Item {
  id: string;
  sortOrder: number;  // Float
}

// Detect collision
const EPSILON = 1e-10;
function hasCollision(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

// Re-normalize when needed
function maybeNormalize(items: Item[]): void {
  // Check for any adjacent items that are too close
  for (let i = 0; i < items.length - 1; i++) {
    if (hasCollision(items[i].sortOrder, items[i + 1].sortOrder)) {
      normalizeAll(items);
      break;
    }
  }
}
```

**Advantages**:
- Simpler to understand
- Native SQL sorting
- Familiar numeric operations

**Disadvantages**:
- Requires collision detection and handling
- Periodic re-normalization updates multiple rows

**Database Column**: `FLOAT` or `DECIMAL(18,10)`

## API Design Considerations

### Update Issue Endpoint

When updating an issue's position:

```typescript
interface UpdateIssuePositionRequest {
  issueId: string;
  // Option A: Explicit sort order
  sortOrder?: string;  // For string-based indexing

  // Option B: Relative positioning (let server calculate)
  insertAfter?: string;  // Issue ID to insert after
  insertBefore?: string; // Issue ID to insert before
}
```

### Response Should Include New Sort Order

```typescript
interface UpdateIssueResponse {
  issue: {
    id: string;
    sortOrder: string;
    // ... other fields
  };
}
```

### Batch Operations

Support moving multiple items at once:

```typescript
interface BatchUpdatePositionRequest {
  moves: Array<{
    issueId: string;
    insertAfter?: string;
    insertBefore?: string;
  }>;
}
```

## References

- [Linear GitHub Issue #170: What's the correct way to change sortOrder?](https://github.com/linear/linear/issues/170)
- [Implementing Fractional Indexing - David Greenspan](https://observablehq.com/@dgreensp/implementing-fractional-indexing)
- [Reordering Part 2: Tables and Fractional Indexing - Steve Ruiz](https://www.steveruiz.me/posts/reordering-fractional-indices)
- [rocicorp/fractional-indexing - JavaScript Library](https://github.com/rocicorp/fractional-indexing)
- [Figma Blog: Realtime Editing of Ordered Sequences](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/)
- [Fractional Indexing Explained](https://hollos.dev/blog/fractional-indexing-a-solution-to-sorting/)
- [Linear Board Ordering Changelog](https://linear.app/changelog/2022-08-18-board-ordering)

## Summary Table

| Aspect | Linear Behavior | SpecTree Recommendation |
|--------|-----------------|------------------------|
| **Data Type** | Float | String (fractional-indexing library) |
| **Algorithm** | Midpoint calculation | `generateKeyBetween()` |
| **Collision Handling** | Server-side re-normalization | N/A (strings don't collide) |
| **Default Position** | End of list | `generateKeyBetween(lastItem, null)` |
| **Scope** | Global within context | Per-parent-issue |
| **Multiple Views** | Same order, different grouping | Same approach |
