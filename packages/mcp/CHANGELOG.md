# Changelog

All notable changes to the SpecTree MCP server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-08

### Added - Composite Tools Consolidation

This release introduces **8 composite tools** that dramatically improve AI workflow efficiency by consolidating 29 individual tools into intuitive, action-based interfaces.

#### New Composite Tools

1. **`spectree__create_epic_complete`** - Atomically create an epic with all features, tasks, and structured descriptions in a single call (replaces 15-30 sequential calls)

2. **`spectree__complete_task_with_validation`** - Run all validations and mark task complete if they pass (replaces 2-3 sequential calls)

3. **`spectree__manage_code_context`** - Manage code artifacts with action parameter:
   - `link_file` - Link a file to feature/task
   - `unlink_file` - Unlink a file
   - `link_function` - Link a specific function
   - `link_branch` - Link git branch
   - `link_commit` - Link git commit
   - `link_pr` - Link pull request

4. **`spectree__manage_validations`** - Manage validation checks with action parameter:
   - `add` - Add a new validation check
   - `run` - Run a specific validation
   - `run_all` - Run all validations
   - `mark_validated` - Mark manual validation as complete
   - `remove` - Remove a validation check
   - `reset` - Reset all validations to pending
   - `list` - List all validation checks

5. **`spectree__manage_description`** - Manage structured descriptions with action parameter:
   - `get` - Get structured description
   - `set` - Set entire structured description
   - `update_section` - Update a specific section
   - `add_criterion` - Add an acceptance criterion
   - `link_file` - Link a file to filesInvolved
   - `add_link` - Add an external link

6. **`spectree__manage_progress`** - Track work progress with action parameter:
   - `start` - Start work on feature/task
   - `complete` - Complete work
   - `log` - Log progress update
   - `report_blocker` - Report blocker

7. **`spectree__manage_ai_context`** - Manage AI context with action parameter:
   - `get` - Get AI context
   - `set` - Set AI context
   - `append_note` - Append an AI note

8. **`spectree__reorder_item`** - Reorder items with itemType parameter:
   - `itemType: "epic"` - Reorder epic
   - `itemType: "feature"` - Reorder feature
   - `itemType: "task"` - Reorder task

#### Benefits

- **67-97% reduction in tool calls** for common workflows
- **Atomic operations** prevent partial state issues
- **Clearer intent** through action-based naming
- **Better AI guidance** with consolidated documentation
- **~18% tool count reduction** (92 tools → 75 tools)

#### Documentation

- Added [Composite Tools Migration Guide](docs/composite-tools-migration.md) with:
  - Complete before/after examples for all 8 composites
  - Action parameter mapping table for all 29 consolidated tools
  - Best practices and usage patterns
  - Backward compatibility notes

- Updated [README.md](README.md) to highlight composite tools
- Added [CONSOLIDATION-RESULTS.md](metrics/CONSOLIDATION-RESULTS.md) documenting the consolidation impact

#### Measurements

- **Total tools:** 75 (down from ~92)
- **Total tokens:** 25,923 (measurement baseline: see metrics/after-tokens.json)
- **Composite tools:** 8
- **Individual tools consolidated:** 29
- **Net reduction:** ~17 fewer tools for AI to choose from

### Changed

- Tool registration order updated to prioritize composite tools (appear first in MCP introspection)
- Tool registry now organized: Help → Composite → Domain tools (alphabetically)

### Deprecated (But Still Functional)

The following 29 individual tools are now deprecated but remain **100% functional** for backward compatibility:

#### Code Context (6 tools)
- `spectree__link_code_file` → use `manage_code_context` with `action: "link_file"`
- `spectree__unlink_code_file` → use `manage_code_context` with `action: "unlink_file"`
- `spectree__link_function` → use `manage_code_context` with `action: "link_function"`
- `spectree__link_branch` → use `manage_code_context` with `action: "link_branch"`
- `spectree__link_commit` → use `manage_code_context` with `action: "link_commit"`
- `spectree__link_pr` → use `manage_code_context` with `action: "link_pr"`

#### Validations (7 tools)
- `spectree__add_validation` → use `manage_validations` with `action: "add"`
- `spectree__run_validation` → use `manage_validations` with `action: "run"`
- `spectree__run_all_validations` → use `manage_validations` with `action: "run_all"`
- `spectree__mark_manual_validated` → use `manage_validations` with `action: "mark_validated"`
- `spectree__remove_validation` → use `manage_validations` with `action: "remove"`
- `spectree__reset_validations` → use `manage_validations` with `action: "reset"`
- `spectree__list_validations` → use `manage_validations` with `action: "list"`

#### Structured Descriptions (6 tools)
- `spectree__get_structured_description` → use `manage_description` with `action: "get"`
- `spectree__set_structured_description` → use `manage_description` with `action: "set"`
- `spectree__update_section` → use `manage_description` with `action: "update_section"`
- `spectree__add_acceptance_criterion` → use `manage_description` with `action: "add_criterion"`
- `spectree__link_file` → use `manage_description` with `action: "link_file"`
- `spectree__add_external_link` → use `manage_description` with `action: "add_link"`

#### Progress Tracking (4 tools)
- `spectree__start_work` → use `manage_progress` with `action: "start"`
- `spectree__complete_work` → use `manage_progress` with `action: "complete"`
- `spectree__log_progress` → use `manage_progress` with `action: "log"`
- `spectree__report_blocker` → use `manage_progress` with `action: "report_blocker"`

#### AI Context (3 tools)
- `spectree__get_ai_context` → use `manage_ai_context` with `action: "get"`
- `spectree__set_ai_context` → use `manage_ai_context` with `action: "set"`
- `spectree__append_ai_note` → use `manage_ai_context` with `action: "append_note"`

#### Reordering (3 tools)
- `spectree__reorder_epic` → use `reorder_item` with `itemType: "epic"`
- `spectree__reorder_feature` → use `reorder_item` with `itemType: "feature"`
- `spectree__reorder_task` → use `reorder_item` with `itemType: "task"`

### Migration Notes

- **No breaking changes** - All individual tools continue to work
- **Migration is optional** - Adopt composite tools at your own pace
- **Recommended for new code** - Use composite tools for better workflow efficiency
- **See migration guide** - [docs/composite-tools-migration.md](docs/composite-tools-migration.md) for detailed examples

---

## [0.1.0] - 2026-01-15

### Added

- Initial release of SpecTree MCP server
- Epic, feature, and task management tools
- Status management and workflow tools
- Search functionality
- Personal scope support
- Ordering/reordering tools
- Execution planning tools
- AI context management
- Progress tracking tools
- Template system
- Structured descriptions
- Code context tracking
- Validation checks
- Decision logging
- Summary and reporting tools

### Security

- Token-based authentication with SpecTree API
- No direct database access
- Revocable API tokens
- Audit trail for all requests

---

## Version History

- **0.2.0** (2026-02-08) - Composite Tools Consolidation
- **0.1.0** (2026-01-15) - Initial Release
