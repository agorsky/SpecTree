# SpecTree MCP Authentication Fix - Summary

## Problem
SpecTree MCP tools were returning **HTTP 401 Unauthorized** errors after computer reboot.

## Root Cause
The MCP config contained an **old API token** that didn't match the newly created token in the database.

- Old token in config: `st_6voyoGHHhiFRqYqCSTwV81CdY9eYn167xjmeZO_Wlcc` (for "Copilot CLI" token)
- New token created: `st_PnJu3YW_2ehY7pXp8JgjdWKPj35qtAj72u8NC35DtrM` (for new token)

The API was working correctly - the token hash verification was failing because the wrong token was being sent.

## Fix Applied
Updated the new token in both locations:

1. **`~/.config/github-copilot/mcp.json`** - Copilot CLI MCP configuration (this is the correct path)
2. **`packages/mcp/.env`** - Local development environment

### MCP Config Location

The correct config path for Copilot CLI MCP servers is:
```
~/.config/github-copilot/mcp.json
```

**Note:** Do NOT confuse with `~/.config/.copilot/` (does not exist) or other similar paths.

## Verification Needed
After restarting Copilot CLI, run this to verify the fix:

```
# Test the SpecTree MCP connection by listing epics
```

Or simply ask: "List my SpecTree epics" - if it returns data without 401 errors, the fix worked.

## Notes
- API tokens are hashed (SHA-256) before storage - plaintext is never stored
- Token plaintext is only shown once at creation time
- The MCP server reads the token from environment variables set in mcp.json
- Copilot CLI must be restarted to pick up mcp.json changes
