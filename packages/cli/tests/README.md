# SpecTree CLI Tests

This directory contains tests for the SpecTree CLI tool.

## Test Structure

```
tests/
├── e2e/                    # End-to-end tests
│   ├── setup.ts           # Test environment helpers
│   ├── install.test.ts    # Install command tests
│   ├── update.test.ts     # Update command tests
│   └── list.test.ts       # List command tests
└── README.md              # This file
```

## E2E Tests

End-to-end tests verify the complete CLI workflow in isolated test environments:

- **install.test.ts**: Tests installing skill packs, file extraction, manifest creation
- **update.test.ts**: Tests updating packs, handling version changes, file additions/removals
- **list.test.ts**: Tests listing installed packs from manifest

### Test Environment

E2E tests use `TestEnvironment` helper class to:
- Create isolated temporary repositories
- Simulate .github/ and .spectree/ directory structures
- Clean up after tests

### Running E2E Tests

```bash
# Run all E2E tests
pnpm --filter @spectree/cli test

# Run specific E2E test file
pnpm --filter @spectree/cli test e2e/install

# Run in watch mode
pnpm --filter @spectree/cli test:watch
```

## Test Coverage

### Install Command
- ✅ Basic pack installation
- ✅ File extraction from tarball
- ✅ Manifest creation
- ✅ Handling file conflicts
- ✅ Empty pack handling
- ✅ Nested directory structures

### Update Command
- ✅ Updating to new version
- ✅ Adding new files
- ✅ Removing old files
- ✅ Version tracking

### List Command
- ✅ Listing installed packs
- ✅ Empty manifest handling
- ✅ Installation timestamps
- ✅ Multiple pack handling

## CI Integration

E2E tests run in CI pipeline via `.github/workflows/`:
- Tests run on push to main/develop
- Tests run on pull requests
- Tests must pass before merge

## Adding New Tests

1. Create test file in appropriate directory
2. Use `describe` and `it` blocks from vitest
3. Use `TestEnvironment` for isolation
4. Clean up resources in `afterEach`
5. Add to this README

## Notes

- E2E tests create temporary directories in OS temp folder
- Tests are isolated - each test gets fresh environment
- Mock tarballs are created programmatically for testing
- Tests verify both success and error cases
