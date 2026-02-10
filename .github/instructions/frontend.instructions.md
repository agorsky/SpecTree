---
applyTo:
  - "packages/web/**"
---
# Frontend Review Rules

## Component Patterns

- Use functional components with hooks — no class components
- Prefer named exports over default exports
- React component files use PascalCase (e.g., `UserProfile.tsx`)
- Non-component files use kebab-case (e.g., `use-tasks.ts`)

## Styling

- Use Tailwind CSS for all styling — no inline styles or CSS modules
- Use the `cn()` utility for conditional/merged class names: `className={cn("bg-primary", className)}`
- UI components use CVA (class-variance-authority) for variant definitions
- Base UI components live in `src/components/ui/` (shadcn/Radix-based)

## State Management

- **Client state:** Zustand stores with persistence middleware (e.g., `auth-store.ts`)
- **Server state:** TanStack React Query for all data fetching
- Do NOT mix — Zustand is for UI/client state, React Query for server data

## Data Fetching

- Query hooks live in `src/hooks/queries/`
- Use query key factories for cache management:
  ```ts
  export const taskKeys = {
    all: ['tasks'] as const,
    lists: () => [...taskKeys.all, 'list'] as const,
    list: (filters) => [...taskKeys.lists(), filters] as const,
  }
  ```
- Mutations must invalidate related queries in `onSuccess`
- Do NOT call `fetch()` directly — use the API client layer

## TypeScript

- Strict mode enabled — avoid `any`
- Use type-only imports where possible: `import type { ... }`
- Props interfaces should be defined adjacent to the component
