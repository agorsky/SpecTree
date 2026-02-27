---
applyTo:
  - "packages/mcp/**"
---
# MCP Server Review Rules

## Tool Registration Pattern

Tools are registered in a central registry (`src/tools/index.ts`) using an ordered `toolRegistrars` array. Each domain exports a `register<Domain>Tools(server: McpServer): void` function.

Tool definitions must follow this pattern:
```ts
server.registerTool("dispatcher__<action_name>", {
  description: "...",
  inputSchema: { /* Zod schema */ }
}, handler)
```

- Tool names MUST use `dispatcher__` prefix with double underscore
- Input schemas use Zod with `.describe()` on every parameter for documentation
- Responses use `createResponse(data)` and `createErrorResponse(error)` wrappers from `src/tools/utils.ts`

## API Client Usage

- Tools call the backend API via HTTP client from `src/api-client.ts` (`getApiClient()`)
- Tools must NOT import Prisma or access the database directly
- All data access goes through the REST API layer

## Pagination

- Tools supporting lists must include `limit` and `cursor` parameters
- Default limit should be 20, max 100
- Return pagination metadata in response

## Error Handling

- Catch API errors and return user-friendly messages via `createErrorResponse()`
- Include the original error context for debugging
- Never expose internal server details or stack traces
