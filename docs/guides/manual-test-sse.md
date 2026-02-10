# Manual Test Plan: SSE Real-Time Updates (ENG-60-3)

This document provides step-by-step instructions for manually verifying that MCP tool updates trigger real-time UI refresh via Server-Sent Events (SSE).

## Test Overview

Validates the complete data flow:
```
MCP Tool → Service Layer → Event Emission → SSE Endpoint → Frontend EventSource → React Query Invalidation → UI Update
```

## Prerequisites

1. **API Server Running**
   ```bash
   cd /path/to/SpecTree
   pnpm dev --filter @spectree/api
   ```
   Server should be accessible at `http://localhost:3001`

2. **Web App Running**
   ```bash
   cd /path/to/SpecTree
   pnpm dev --filter @spectree/web
   ```
   Web app should be accessible at `http://localhost:5173`

3. **MCP Tools Accessible**
   - Option A: Use Claude Desktop with SpecTree MCP server configured
   - Option B: Use CLI tools (if available)
   - Option C: Use test script to call MCP endpoints directly

4. **Authentication**
   - Log in to the web app
   - Verify you have access to at least one epic with features/tasks

---

## Test Case 1: Feature Status Update

### Objective
Verify that changing a feature's status via MCP tool immediately updates the UI without page refresh.

### Steps

1. **Setup:**
   - Open web app in browser
   - Navigate to an epic's feature list (e.g., `/epics/[epic-id]`)
   - Note the current status of a feature (e.g., "Backlog")
   - Open browser DevTools → Network tab
   - Filter for "events" to see SSE connection

2. **Execute MCP Tool:**
   - Via MCP: Call `spectree__update_feature`
     ```javascript
     {
       "id": "ENG-XX", // Use actual feature identifier
       "status": "In Progress"
     }
     ```
   - Note the timestamp of the call

3. **Expected Results:**
   - ✅ Feature status badge updates on screen within 2 seconds
   - ✅ No manual page refresh needed
   - ✅ Browser DevTools shows SSE event received:
     ```
     event: message
     data: {"type":"entity.updated","data":{"entityType":"feature","entityId":"...",...}}
     ```
   - ✅ Console logs `[LiveUpdates] SSE connected` (if enabled)
   - ✅ Toast notification appears: "Feature updated"

4. **Verification:**
   - Check that the feature's status matches what you set via MCP
   - Refresh the page manually → status should remain the same (persisted)

---

## Test Case 2: Task Progress Update

### Objective
Verify that logging progress on a task via MCP tool updates the task detail page in real-time.

### Steps

1. **Setup:**
   - Open web app in browser
   - Navigate to a task detail page (e.g., `/features/[feature-id]/tasks/[task-id]`)
   - Note the current progress percentage (if any)
   - Keep browser DevTools → Network tab open

2. **Execute MCP Tool:**
   - Via MCP: Call `spectree__log_progress`
     ```javascript
     {
       "id": "ENG-XX-1", // Use actual task identifier
       "type": "task",
       "message": "Manual test progress update",
       "percentComplete": 75
     }
     ```

3. **Expected Results:**
   - ✅ Progress bar updates to 75% within 2 seconds
   - ✅ AI note "Manual test progress update" appears in timeline
   - ✅ No page refresh required
   - ✅ SSE event received in Network tab
   - ✅ Toast notification: "Progress logged" or similar

4. **Verification:**
   - Scroll down to AI notes section
   - Verify new note is present with correct message
   - Refresh page → progress should persist at 75%

---

## Test Case 3: New Feature Created

### Objective
Verify that creating a new feature via MCP tool causes it to appear in the feature list immediately.

### Steps

1. **Setup:**
   - Open web app in browser
   - Navigate to epic detail page showing feature list
   - Count the number of features currently displayed
   - Keep browser on this page (do NOT refresh)

2. **Execute MCP Tool:**
   - Via MCP: Call `spectree__create_feature`
     ```javascript
     {
       "title": "SSE Test Feature - Auto Refresh",
       "epic": "Epic Name", // Use actual epic name
       "status": "Backlog"
     }
     ```

3. **Expected Results:**
   - ✅ New feature appears in the list within 2 seconds
   - ✅ Feature count increases by 1
   - ✅ No page refresh needed
   - ✅ SSE event `entity.created` received
   - ✅ Toast notification: "Feature created"

4. **Verification:**
   - Click on the newly created feature
   - Verify title matches: "SSE Test Feature - Auto Refresh"
   - Verify status is "Backlog"

---

## Test Case 4: SSE Connection Recovery

### Objective
Verify that the UI recovers gracefully when API server is restarted.

### Steps

1. **Setup:**
   - Open web app in browser
   - Navigate to any page (dashboard, epic list, etc.)
   - Verify SSE connection indicator shows "connected" (green dot or similar)
   - Keep browser DevTools → Network tab open

2. **Simulate Disconnection:**
   - Stop the API server:
     ```bash
     # In the terminal running API server, press Ctrl+C
     ```
   - Observe browser UI

3. **Expected Results (Disconnected):**
   - ✅ Connection indicator turns red or shows "disconnected"
   - ✅ Console logs: `[LiveUpdates] SSE disconnected, falling back to polling`
   - ✅ UI continues to work (no crash)
   - ✅ Data may be stale but no errors displayed

4. **Simulate Reconnection:**
   - Restart the API server:
     ```bash
     pnpm dev --filter @spectree/api
     ```
   - Wait for server to be ready (watch console logs)

5. **Expected Results (Reconnected):**
   - ✅ Connection indicator turns green or shows "connected"
   - ✅ Console logs: `[LiveUpdates] SSE connected, stopping polling`
   - ✅ UI data refreshes automatically
   - ✅ Any changes made while disconnected are now visible

6. **Verification:**
   - Make an update via MCP tool
   - Verify UI updates in real-time (connection is restored)

---

## Test Case 5: Epic ID Filtering

### Objective
Verify that SSE events are filtered correctly when viewing a specific epic.

### Steps

1. **Setup:**
   - Ensure you have at least 2 epics (Epic A and Epic B)
   - Open web app → navigate to Epic A's detail page
   - Open browser DevTools → Network tab
   - Find the SSE connection request
   - Verify URL contains `?epicId=[Epic A's UUID]`

2. **Execute MCP Tool (Epic A):**
   - Via MCP: Update a feature in Epic A
     ```javascript
     {
       "id": "EPIC-A-FEATURE-ID",
       "status": "In Progress"
     }
     ```

3. **Expected Results:**
   - ✅ Epic A's feature updates immediately
   - ✅ SSE event received in Network tab

4. **Execute MCP Tool (Epic B):**
   - Via MCP: Update a feature in Epic B
     ```javascript
     {
       "id": "EPIC-B-FEATURE-ID",
       "status": "Done"
     }
     ```

5. **Expected Results:**
   - ✅ Epic A's page does NOT update (filter working)
   - ✅ No SSE event received for Epic B's feature
   - ✅ Console logs confirm filtering (if debug enabled)

6. **Verification:**
   - Navigate to Epic B's page
   - Verify Epic B's feature shows status "Done" (update was persisted)
   - This confirms filtering is client-side (server still emitted event)

---

## Troubleshooting

### Issue: No SSE connection established

**Symptoms:**
- Network tab shows no "/api/v1/events" request
- Console logs: `[LiveUpdates] SSE disconnected, falling back to polling`

**Possible Causes:**
1. Not logged in → Check auth token in localStorage
2. API server not running → Start API server
3. CORS issue → Verify API allows `http://localhost:5173`

**Solution:**
```bash
# Check if API server is running
curl http://localhost:3001/health

# Check if SSE endpoint is accessible (should hang, not error)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/v1/events
```

---

### Issue: Events received but UI doesn't update

**Symptoms:**
- Network tab shows SSE events
- Console logs show events received
- UI remains stale

**Possible Causes:**
1. React Query not invalidating cache
2. Event payload format incorrect
3. JavaScript error in event handler

**Solution:**
1. Check browser console for errors
2. Verify event payload structure:
   ```json
   {
     "type": "entity.updated",
     "data": {
       "entityType": "feature",
       "entityId": "uuid",
       "changedFields": ["status"],
       ...
     }
   }
   ```
3. Check `useLiveUpdates` hook is active on the page

---

### Issue: UI updates but with delay (>5 seconds)

**Symptoms:**
- Updates eventually appear
- Delay is consistent and long

**Possible Causes:**
1. Polling fallback active (SSE disconnected)
2. Debouncing too aggressive
3. Network latency

**Solution:**
1. Verify SSE connection is active (green indicator)
2. Check `useLiveUpdates` debounce settings (should be ~100ms)
3. Measure network latency:
   ```bash
   ping localhost
   ```

---

## Success Criteria

All test cases must pass with the following criteria:

- ✅ Real-time updates appear within 2 seconds of MCP tool execution
- ✅ No manual page refresh required for any test case
- ✅ SSE connection indicator reflects actual connection state
- ✅ Connection recovery works automatically (no user intervention)
- ✅ Epic ID filtering prevents unnecessary UI updates
- ✅ Toast notifications provide user feedback for changes
- ✅ No JavaScript errors in browser console during tests

---

## Test Environment

**Test Date:** ___________  
**Tested By:** ___________  
**Browser:** ___________  
**API Version:** ___________  
**Web Version:** ___________  

### Test Results Summary

| Test Case | Pass/Fail | Notes |
|-----------|-----------|-------|
| 1. Feature Status Update | ⬜ | |
| 2. Task Progress Update | ⬜ | |
| 3. New Feature Created | ⬜ | |
| 4. SSE Connection Recovery | ⬜ | |
| 5. Epic ID Filtering | ⬜ | |

**Overall Result:** ⬜ Pass / ⬜ Fail  
**Comments:** ___________

---

## Notes for Future Testers

- This test should be run before each major release
- Test with multiple browsers (Chrome, Firefox, Safari)
- Test with slow network conditions (DevTools → Network → Slow 3G)
- Consider automating with Playwright/Cypress for regression testing
- Update this document if SSE behavior changes

---

## Related Documentation

- [SSE Implementation (ENG-56)](../../packages/api/src/routes/events.ts)
- [useEventSource Hook](../../packages/web/src/hooks/useEventSource.ts)
- [useLiveUpdates Hook](../../packages/web/src/hooks/useLiveUpdates.ts)
- [Event Emitter](../../packages/api/src/events/emitter.ts)
