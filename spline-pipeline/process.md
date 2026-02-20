# Spline Pipeline Process

A 3-phase pipeline that transforms structured prompts into production-ready interactive 3D scenes using Spline. Each phase has clear inputs, outputs, decision points, and quality gates.

---

## Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  PHASE 1: INTERPRETATION & PLANNING                              │
│                                                                  │
│  ┌─────────────────┐     ┌─────────────────┐                    │
│  │ Prompt           │────▶│ Scene            │──── Scene Spec ──▶│
│  │ Interpreter      │     │ Planner          │     + Scene Graph │
│  └─────────────────┘     └─────────────────┘                    │
│                                                                  │
│  Gate 1: Scene spec validates (all refs resolved, no orphans)    │
├──────────────────────────────────────────────────────────────────┤
│  PHASE 2: CONSTRUCTION                                           │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐                   │
│  │ Object   │─▶│ Material │─▶│ Interaction  │── Built Scene ──▶│
│  │ Builder  │  │ Stylist  │  │ Designer     │                   │
│  └──────────┘  └──────────┘  └──────────────┘                   │
│                                                                  │
│  Gate 2: All objects, materials, interactions created             │
├──────────────────────────────────────────────────────────────────┤
│  PHASE 3: QUALITY & EXPORT                                       │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐                           │
│  │ Quality      │────▶│ Export       │──── Artifacts ──▶ Done   │
│  │ Inspector    │     │ Manager      │                           │
│  └──────┬───────┘     └──────────────┘                           │
│         │ fail                                                    │
│         └───────── Refinement Loop (max 3) ──▶ Phase 2 agents   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Interpretation & Planning

### Purpose
Transform raw user input into a precise, validated blueprint that construction agents can execute without ambiguity.

### Step 1.1: Prompt Interpretation

**Agent:** sp-prompt-interpreter

**Input:** User prompt (natural language or structured JSON)

**Process:**
1. Parse and classify all mentioned objects, materials, and interactions
2. Resolve ambiguities using default rules (see interpreter agent docs)
3. Infer missing details: lighting preset, camera position, color palette
4. Map interaction keywords to state/event patterns
5. Validate export targets against supported formats

**Output:** Scene Specification JSON

**Decision Point — Prompt Completeness:**
- If the prompt is too vague (< 1 identifiable object): request clarification from user
- If the prompt has conflicting instructions: resolve with "latest wins" rule, flag in output
- If the prompt requests unsupported features: note as limitation, proceed with alternatives

### Step 1.2: Scene Planning

**Agent:** sp-scene-planner

**Input:** Scene Specification JSON

**Process:**
1. Build object hierarchy (parent-child relationships)
2. Compute transforms (position, rotation, scale) for all objects
3. Design state machine (states, transitions, default states)
4. Map events to states and actions
5. Plan lighting setup and camera placement
6. Validate transform collisions and hierarchy depth

**Output:** Scene Graph JSON (complete construction blueprint)

### Quality Gate 1: Planning Validation

| Check | Pass Criteria |
|-------|--------------|
| Object completeness | Every scene-spec object appears in the scene graph |
| Reference integrity | All material/interaction refs resolve to valid definitions |
| No orphan definitions | Every material and interaction is referenced by at least one object |
| Transform validity | No two non-grouped objects occupy the same position |
| Hierarchy depth | Object tree depth ≤ 4 levels |
| Lighting minimum | At least 2 lights defined |
| Camera exists | At least 1 camera with valid FOV (30-65°) |

**If gate fails:** Return to Step 1.1 with the specific validation failures. Do not proceed to Phase 2.

---

## Phase 2: Construction

### Purpose
Execute the scene graph in Spline by creating all objects, applying materials, and wiring interactions.

### Step 2.1: Object Building

**Agent:** sp-object-builder

**Input:** Scene Graph + sceneId

**Process:**
1. Audit existing scene objects (if modifying existing scene)
2. Create objects top-down (parents before children)
3. Apply transforms (position, rotation, scale)
4. Set up groups and hierarchy
5. Add lights and cameras
6. Add physics bodies if specified
7. Build object ID mapping (spec ID → Spline ID)

**Output:** Object ID Mapping

**Decision Point — Object Creation Failures:**
- Single object fails: Log, retry with simplified params, continue if retry fails
- Hero object fails: Critical error — retry with basic shape, escalate if still failing
- > 50% objects fail: Abort phase, report to orchestrator

### Step 2.2: Material Styling

**Agent:** sp-material-stylist

**Input:** Scene Graph materials + Object ID Mapping + sceneId

**Process:**
1. Create simple materials (solid color, basic PBR)
2. Create layered materials (glass, gradient, fresnel)
3. Configure each layer with specific parameters
4. Apply materials to objects using the ID mapping
5. Configure post-processing (bloom, DOF, fog)
6. Build material ID mapping

**Output:** Material ID Mapping

**Decision Point — Material Failures:**
- Material creation fails: Fall back to direct object color
- Layer configuration fails: Skip layer, material still usable
- Post-processing fails: Note as warning, not blocking

### Step 2.3: Interaction Design

**Agent:** sp-interaction-designer

**Input:** Scene Graph states/events + Object ID Mapping + Material ID Mapping + sceneId

**Process:**
1. Create all states with properties referencing Spline object IDs
2. Create events bound to specific objects
3. Add and configure actions (transitions, animations, variables, conditionals)
4. Initialize variables with default values
5. Configure event parameters (key codes, distances)
6. Validate state machine completeness

**Output:** State and Event ID Mappings

**Decision Point — Interaction Failures:**
- State creation fails: Skip dependent events, note in report
- Event creation fails: Retry with simplified action list
- Variable initialization fails: Log warning, interactions may not work correctly

### Quality Gate 2: Construction Validation

| Check | Pass Criteria |
|-------|--------------|
| Objects created | Object ID mapping covers all scene graph objects |
| Materials applied | Every visible object has a material (not default gray) |
| Interactions wired | State count matches plan, event count matches plan |
| Lights placed | All planned lights exist in scene |
| Camera ready | Camera exists and frames the scene |

**If gate fails:** Identify missing elements and determine which Step 2.x agent needs to re-run with targeted fix instructions. Do not proceed to Phase 3.

---

## Phase 3: Quality & Export

### Purpose
Verify the scene meets quality standards, then export in all requested formats.

### Step 3.1: Quality Inspection

**Agent:** sp-quality-inspector

**Input:** sceneId + Scene Spec + Scene Graph + all ID mappings

**Process:**
1. Gather full scene data from Spline API
2. Score composition (25%): objects, spatial arrangement, lighting, camera
3. Score materials (25%): coverage, style consistency, post-processing
4. Score interactions (25%): completeness, state validity, event pairing
5. Score performance (25%): object count, material count, light budget
6. Compute overall score and identify issues

**Output:** Quality Report (score, pass/fail, issues with severity and fix routing)

### Refinement Loop

```
Round 1 → Inspect → Score
    │
    ├── Pass (≥ 70, no critical) → Proceed to Export
    │
    └── Fail → Collect issues → Route to sub-agents → Fix → Round 2
                                                              │
                                                              ├── Pass → Export
                                                              └── Fail → Round 3
                                                                          │
                                                                          ├── Pass → Export
                                                                          └── Fail → Export with warnings
```

**Refinement Rules:**
1. Maximum 3 inspection rounds — after 3 rounds, export regardless (with warnings)
2. Each round should fix issues from the previous round — do not re-introduce old issues
3. Only re-run the specific sub-agents needed for the identified issues
4. Track score progression — if score decreases between rounds, revert changes
5. Critical issues (missing hero object, no camera) must be fixed before export

### Step 3.2: Export

**Agent:** sp-export-manager

**Input:** sceneId + export targets from scene spec + sp-config.json settings

**Process:**
1. Verify scene readiness for each format
2. Generate React component (if requested) — with Suspense, error boundary, TypeScript
3. Generate iframe embed (if requested) — with responsive wrapper, lazy loading
4. Generate vanilla JS (if requested) — with ES modules, error handling
5. Generate Next.js component (if requested) — with dynamic import, SSR disabled
6. Generate comprehensive runtime example for complex interaction scenes
7. Compile export manifest with usage instructions

**Output:** Export Manifest (code, URLs, dependencies, usage docs per format)

### Quality Gate 3: Export Validation

| Check | Pass Criteria |
|-------|--------------|
| Format coverage | All requested formats have exports (or documented failures) |
| Code completeness | Each export is runnable (not just a snippet) |
| Dependencies listed | npm packages and versions specified for JS exports |
| Usage documented | Each export has integration instructions |
| No secrets | No API keys or credentials in export code |

---

## Pipeline Configuration

All thresholds, defaults, and settings are defined in `sp-config.json`. Key settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `quality.passThreshold` | 70 | Minimum quality score to pass |
| `quality.maxRefinementRounds` | 3 | Maximum quality loop iterations |
| `scene.maxObjects` | 50 | Performance budget for objects |
| `scene.maxMaterials` | 15 | Performance budget for materials |
| `export.defaultFormats` | `["react", "iframe"]` | Formats when none specified |
| `video.fps` | 30 | Video export frame rate |
| `video.duration` | 10 | Video export duration (seconds) |
| `image.scale` | 2 | Image export scale factor |

## Error Recovery Strategy

| Failure | Recovery |
|---------|----------|
| Spline MCP disconnected | Stop pipeline, notify user |
| Sub-agent timeout | Retry once with 2× timeout |
| Sub-agent crash | Skip phase, report partial results |
| Quality loop exhausted | Export with quality warnings |
| Export format unsupported | Skip format, note in manifest |
| Scene too complex | Simplify (reduce segments, merge objects) and retry |
