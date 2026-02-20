---
name: Blender Pipeline Process
description: "3-phase pipeline process from structured prompt to exported 3D assets
  with iterative quality refinement. Defines the complete workflow with decision
  points, quality gates, and handoff protocols between agents."
---

# Blender Pipeline Process

This document defines the end-to-end process for converting a structured prompt into production-grade 3D assets using the Blender pipeline skill pack. The process runs in three phases with a quality feedback loop.

## Process Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PHASE 1: INTERPRETATION               │
│                                                          │
│  User Prompt ──► Prompt Interpreter ──► Asset Spec       │
│                                          │               │
│  Asset Spec ──► Scene Planner ──► Scene Graph            │
│                                                          │
│  Gate 1: Spec Validation                                 │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                    PHASE 2: GENERATION                   │
│                                                          │
│  Scene Graph ──► Asset Generator ──► geometry.py         │
│  Scene Graph ──► Material Applicator ──► materials.py    │
│  Scene Graph ──► Lighting Rigger ──► lighting.py         │
│                                                          │
│  Combined Script ──► Blender (headless) ──► scene.blend  │
│                                                          │
│  Gate 2: Script Execution Success                        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                PHASE 3: QUALITY & EXPORT                 │
│                                                          │
│  scene.blend ──► Quality Inspector ──► Score + Feedback  │
│                                                          │
│  ┌──── PASS (score ≥ threshold) ────────────────────┐   │
│  │  scene.blend ──► Export Manager ──► Manifest      │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──── FAIL (score < threshold, round < max) ───────┐   │
│  │  Feedback ──► Re-run failing sub-agents (Phase 2) │   │
│  │  ──► Re-inspect (max 3 rounds)                    │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  Gate 3: Export Validation                               │
└─────────────────────────────────────────────────────────┘
```

## Phase 1: Interpretation

**Goal:** Transform the user's intent into a precise, machine-readable specification that all downstream agents can consume unambiguously.

### Step 1.1: Load Configuration

| Action | Details |
|--------|---------|
| Read `bp-config.json` | Load Blender path, render engine, resolution, thresholds |
| Validate config | Verify Blender exists at configured path |
| Set output directory | Create timestamped subdirectory in configured output path |
| **Output** | Validated configuration object |

### Step 1.2: Prompt Interpretation

| Action | Details |
|--------|---------|
| Input | User prompt (natural language or structured JSON) |
| Agent | `bp-prompt-interpreter` |
| Process | Extract objects, materials, lighting, camera from prompt |
| Fill defaults | Apply sensible defaults for any unspecified parameters |
| **Output** | Asset Specification JSON |

### Step 1.3: Scene Planning

| Action | Details |
|--------|---------|
| Input | Asset Specification |
| Agent | `bp-scene-planner` |
| Process | Build hierarchy, calculate transforms, bind materials, configure render |
| **Output** | Scene Graph JSON |

### Quality Gate 1: Spec Validation

The orchestrator validates before proceeding:

- [ ] Asset spec has at least one object with valid dimensions
- [ ] Every material slot references a defined material
- [ ] Camera target is within the scene bounds
- [ ] Polygon estimate is within budget
- [ ] Scene graph hierarchy depth ≤ 4
- [ ] All object names are unique
- [ ] Render config matches the chosen engine

**If validation fails:** Return to Step 1.2 with specific error messages. If the prompt itself is ambiguous, ask the user for clarification.

## Phase 2: Generation

**Goal:** Produce executable Blender Python scripts and run them to create the 3D scene.

### Step 2.1: Geometry Generation

| Action | Details |
|--------|---------|
| Input | Scene Graph |
| Agent | `bp-asset-generator` |
| Process | Generate bpy scripts for all meshes, curves, modifiers |
| Track | Estimated polygon count per object |
| **Output** | `geometry.py` script |

### Step 2.2: Material Creation

| Action | Details |
|--------|---------|
| Input | Scene Graph + geometry object names |
| Agent | `bp-material-applicator` |
| Process | Build PBR material node trees, set up UVs, assign to objects |
| **Output** | `materials.py` script |

### Step 2.3: Lighting & Camera Setup

| Action | Details |
|--------|---------|
| Input | Scene Graph |
| Agent | `bp-lighting-rigger` |
| Process | Create lighting rig, configure camera, set up world environment |
| **Output** | `lighting.py` script |

### Step 2.4: Script Assembly & Execution

Combine the three scripts into a single pipeline script:

```python
# combined_pipeline.py
# Section 1: Imports and utilities (shared)
# Section 2: Scene cleanup
# Section 3: Geometry creation (from geometry.py)
# Section 4: Material setup (from materials.py)
# Section 5: Lighting and camera (from lighting.py)
# Section 6: Save .blend file
```

Execute in Blender headless mode:
```bash
<blender_path> --background --python combined_pipeline.py -- --output <output_dir>/scene.blend
```

### Quality Gate 2: Script Execution

- [ ] Blender process exits with code 0
- [ ] Output .blend file exists and is non-empty
- [ ] No Python errors in stdout/stderr
- [ ] .blend file opens without corruption warnings

**If execution fails:** Parse the error output, identify the responsible script section, and re-run that sub-agent with the error context. Common failures:
- `NameError` → Object name mismatch between scripts
- `AttributeError` → Wrong bpy API call for the Blender version
- `RuntimeError` → Invalid modifier or constraint configuration

## Phase 3: Quality & Export

**Goal:** Verify the scene meets production standards and export to all configured formats.

### Step 3.1: Quality Inspection

| Action | Details |
|--------|---------|
| Input | `scene.blend` path, round number |
| Agent | `bp-quality-inspector` |
| Process | Render preview, evaluate geometry/materials/lighting/composition |
| **Output** | Quality Report with scores and feedback |

### Decision Point: Quality Loop

```
IF all category scores ≥ threshold AND overall ≥ 70:
    → Proceed to Step 3.2 (Export)

ELIF round < max_refinement_rounds (default: 3):
    → Route feedback to responsible sub-agents
    → Re-run ONLY the failing sub-agents with feedback
    → Re-execute combined script
    → Return to Step 3.1 with round + 1

ELSE (max rounds reached, still below threshold):
    → Log warning with final scores
    → Ask user: "Export with current quality? (scores: ...)"
    → If user approves: proceed to Step 3.2
    → If user declines: abort pipeline
```

### Refinement Routing

Feedback from the quality inspector is routed to specific agents:

| Failing Category | Target Agent | Feedback Includes |
|-----------------|-------------|------------------|
| Geometry | `bp-asset-generator` | Missing objects, degenerate faces, scale issues |
| Materials | `bp-material-applicator` | Flat shading, wrong PBR values, missing UVs |
| Lighting | `bp-lighting-rigger` | Dark scene, harsh shadows, wrong mood |
| Composition | `bp-lighting-rigger` | Camera position, focal length, framing |

When re-running a sub-agent:
1. Include the original scene graph
2. Include the specific feedback items for that agent
3. Include the previous round's score for tracking improvement
4. The agent produces an updated script that patches the existing scene

### Step 3.2: Export

| Action | Details |
|--------|---------|
| Input | Quality-approved `scene.blend` |
| Agent | `bp-export-manager` |
| Process | Clean scene, render final image, export all formats, validate, write manifest |
| **Output** | Export manifest JSON + all output files |

### Quality Gate 3: Export Validation

- [ ] All configured formats exported successfully
- [ ] Each export file is non-empty and above minimum size
- [ ] SHA-256 checksums computed and recorded
- [ ] Final render image exists at configured resolution
- [ ] Export manifest is valid JSON with all required fields
- [ ] Scene graph JSON sidecar is saved alongside exports

**If export fails:** Retry the failing format with default settings. If it still fails, exclude that format from the manifest and note the failure.

## Timing Expectations

| Phase | Expected Duration | Notes |
|-------|:-----------------:|-------|
| Phase 1 (Interpretation) | 5–15 seconds | Pure computation, no rendering |
| Phase 2 (Generation) | 10–30 seconds | Script generation + Blender execution |
| Phase 3 (Quality Check) | 15–45 seconds per round | Preview render at half resolution |
| Phase 3 (Export) | 30–120 seconds | Full render + multi-format export |
| **Total (1 round)** | **1–3 minutes** | |
| **Total (3 rounds)** | **2–5 minutes** | |

## Error Recovery

| Failure | Recovery Strategy |
|---------|------------------|
| Blender crash during script execution | Isolate failing script section, simplify geometry, retry |
| Out of memory | Reduce subdivision levels, switch to EEVEE, reduce texture sizes |
| Render timeout (> 5 min) | Halve sample count, use denoising to compensate |
| Export format not supported | Skip format, note in manifest, continue with remaining formats |
| Quality never reaches threshold | After max rounds, present best result to user with scores |
| Config file missing | Use built-in defaults, warn user |

## Output Artifacts

At the end of a successful pipeline run, the output directory contains:

```
output/
├── scene.blend              # Source Blender file
├── scene_graph.json         # Scene graph for reproducibility
├── render_final.png         # Publication-quality render
├── preview_round1.png       # Quality check preview (round 1)
├── preview_round2.png       # Quality check preview (round 2, if needed)
├── scene.glb                # glTF binary export
├── scene.fbx                # FBX export
├── scene.usdc               # USD export
├── scene.obj                # OBJ export
├── scene.mtl                # OBJ material library
├── textures/                # Exported textures
│   ├── weathered_wood_basecolor.png
│   └── ...
├── manifest.json            # Export manifest with checksums
└── pipeline_log.json        # Timing and decision log
```

## Reproducibility

The pipeline is designed to be reproducible. Given the same:
- User prompt
- `bp-config.json` settings
- Blender version

The output should be identical. This is ensured by:
1. Deterministic random seeds in procedural textures (seed from prompt hash)
2. Scene graph JSON preserved as a sidecar file
3. Exact bpy API calls recorded in the combined script
4. Config settings embedded in the manifest
