# @spectree/cli

Command-line interface for installing, managing, and publishing SpecTree Skill Packs.

## Installation

```bash
npm install -g @spectree/cli
```

## Commands

### Install

Install a Skill Pack from the SpecTree registry:

```bash
spectree install <pack-name>
spectree install <pack-name> --version 1.2.3
spectree install <pack-name> --registry https://custom-registry.com
```

**Options:**
- `-v, --version <version>` - Install a specific version (default: latest)
- `--registry <url>` - Use a custom registry URL

**What it does:**
1. Fetches the pack manifest from the registry
2. Downloads pack files (agents, skills, instructions)
3. Copies files to `.github/` directories
4. Merges MCP configuration into `.github/mcp.json`
5. Creates/updates `.spectree/manifest.json`

### Update

Update installed packs to the latest versions:

```bash
spectree update                  # Check all packs for updates
spectree update <pack-name>      # Update specific pack
spectree update --yes            # Auto-confirm updates
```

**Options:**
- `-y, --yes` - Auto-confirm updates without prompting
- `--registry <url>` - Use a custom registry URL

**What it does:**
1. Reads `.spectree/manifest.json` to find installed packs
2. Fetches latest versions from registry
3. Compares versions using semver
4. Shows available updates and optionally applies them

### List

List installed and available Skill Packs:

```bash
spectree list                    # Show combined view
spectree list --installed        # Show only installed packs
spectree list --available        # Show only available packs
```

**Options:**
- `--installed` - Show only installed packs
- `--available` - Show only available packs from registry
- `--registry <url>` - Use a custom registry URL

**What it does:**
- Displays formatted tables with pack information
- Shows update status with color coding
- Provides summary statistics

### Publish

Publish a Skill Pack to the registry:

```bash
spectree publish
spectree publish --dry-run
spectree publish --token <api-token>
```

**Options:**
- `--dry-run` - Validate pack without publishing
- `--token <token>` - Authentication token (or set `SPECTREE_API_TOKEN` env var)
- `--registry <url>` - Use a custom registry URL

**What it does:**
1. Reads `.spectree/pack.json` manifest
2. Validates manifest and file references
3. Bundles all referenced files
4. Authenticates with registry
5. Uploads pack to registry

## Pack Manifest Format

Create a `.spectree/pack.json` file to publish your pack:

```json
{
  "name": "@myorg/pack-example",
  "version": "1.0.0",
  "description": "Example Skill Pack",
  "author": "Your Name",
  "files": {
    "agents": ["my-agent.md"],
    "skills": ["my-skill.md"],
    "instructions": ["my-instructions.md"],
    "mcpConfig": "mcp.json"
  }
}
```

## Environment Variables

- `SPECTREE_REGISTRY_URL` - Default registry URL (default: `http://localhost:3001`)
- `SPECTREE_API_TOKEN` - Authentication token for publishing

## Project Structure

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── install.ts      # Install command
│   │   ├── update.ts       # Update command
│   │   ├── list.ts         # List command
│   │   └── publish.ts      # Publish command
│   ├── utils/
│   │   ├── api-client.ts       # Registry API client
│   │   ├── file-manager.ts     # File operations
│   │   ├── version-resolver.ts # Version comparison
│   │   ├── table-formatter.ts  # CLI output formatting
│   │   └── pack-bundler.ts     # Pack bundling for publish
│   └── index.ts            # CLI entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Development

Build the CLI:

```bash
pnpm build
```

Test locally:

```bash
node dist/index.js --help
```

## Technologies

- **Commander.js** - CLI framework
- **Axios** - HTTP client for API calls
- **Chalk** - Terminal colors
- **Ora** - Loading spinners
- **cli-table3** - Formatted tables
- **semver** - Version comparison
- **form-data** - Multipart uploads

## Error Handling

All commands include comprehensive error handling with helpful hints:

- Network failures suggest checking connectivity
- 404 errors suggest verifying pack names
- Authentication errors suggest checking tokens
- File permission errors suggest checking directory access

## License

MIT
