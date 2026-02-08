#!/usr/bin/env node
/**
 * Token Measurement Script for MCP Tool Definitions
 *
 * Measures token counts in tool definitions using tiktoken (cl100k_base encoding for GPT-4).
 * Helps quantify token savings from tool consolidation.
 *
 * Usage:
 *   npm run measure-tokens                           # Count current tokens
 *   npm run measure-tokens -- --output report.json   # Save to file
 *   npm run measure-tokens -- --compare baseline.json after.json  # Compare two reports
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { get_encoding } from "tiktoken";

// Initialize tiktoken with cl100k_base (used by GPT-4, GPT-3.5-turbo)
const encoding = get_encoding("cl100k_base");

/**
 * Count tokens in a string
 */
function countTokens(text: string): number {
  const tokens = encoding.encode(text);
  return tokens.length;
}

/**
 * Tool definition (simplified from MCP schema)
 */
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

/**
 * Token breakdown for a single tool
 */
interface ToolTokenBreakdown {
  name: string;
  nameTokens: number;
  descriptionTokens: number;
  schemaTokens: number;
  totalTokens: number;
}

/**
 * Complete token measurement report
 */
interface TokenReport {
  timestamp: string;
  totalTools: number;
  totalTokens: number;
  avgTokensPerTool: number;
  tools: ToolTokenBreakdown[];
}

/**
 * Extract tool definitions from the MCP server code
 * Intercepts tool registrations to capture definitions
 */
async function extractToolDefinitions(): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = [];
  
  // Create a mock server that captures tool registrations
  const mockServer = {
    registerTool: (name: string, config: any, handler?: any) => {
      // Handle both old and new SDK styles
      let description = "";
      let inputSchema: Record<string, any> = {};
      
      if (typeof config === "object") {
        description = config.description || "";
        
        // Extract input schema - it might be a Zod object or plain JSON schema
        if (config.inputSchema) {
          // Convert Zod schema to JSON
          inputSchema = zodSchemaToJson(config.inputSchema);
        }
      }
      
      tools.push({
        name,
        description,
        inputSchema,
      });
    },
    setRequestHandler: () => {
      // Ignore request handlers
    },
  };
  
  // Import and run all tool registrations
  const { registerAllTools } = await import("../dist/tools/index.js");
  registerAllTools(mockServer as any);
  
  return tools;
}

/**
 * Convert a Zod schema object to a plain JSON schema
 * This is a simplified converter that handles the common cases
 */
function zodSchemaToJson(schema: any): Record<string, any> {
  if (!schema || typeof schema !== "object") {
    return {};
  }
  
  // If it's already a plain object, return it
  if (!schema._def) {
    return schema;
  }
  
  // Build a simplified representation
  const result: Record<string, any> = {};
  
  // Try to extract shape for objects
  if (schema._def.typeName === "ZodObject" && schema._def.shape) {
    const shape = typeof schema._def.shape === "function" ? schema._def.shape() : schema._def.shape;
    
    for (const [key, value] of Object.entries(shape)) {
      result[key] = zodSchemaToJson(value);
    }
  }
  
  return result;
}

/**
 * Measure tokens for all tool definitions
 */
function measureTools(tools: ToolDefinition[]): TokenReport {
  const toolBreakdowns: ToolTokenBreakdown[] = tools.map((tool) => {
    const nameTokens = countTokens(tool.name);
    const descriptionTokens = countTokens(tool.description);
    const schemaTokens = countTokens(JSON.stringify(tool.inputSchema));
    
    return {
      name: tool.name,
      nameTokens,
      descriptionTokens,
      schemaTokens,
      totalTokens: nameTokens + descriptionTokens + schemaTokens,
    };
  });

  const totalTokens = toolBreakdowns.reduce((sum, t) => sum + t.totalTokens, 0);
  const avgTokensPerTool = tools.length > 0 ? totalTokens / tools.length : 0;

  return {
    timestamp: new Date().toISOString(),
    totalTools: tools.length,
    totalTokens,
    avgTokensPerTool: Math.round(avgTokensPerTool),
    tools: toolBreakdowns.sort((a, b) => b.totalTokens - a.totalTokens),
  };
}

/**
 * Compare two token reports and show the difference
 */
function compareReports(beforePath: string, afterPath: string): void {
  if (!existsSync(beforePath)) {
    console.error(`Error: File not found: ${beforePath}`);
    process.exit(1);
  }
  if (!existsSync(afterPath)) {
    console.error(`Error: File not found: ${afterPath}`);
    process.exit(1);
  }

  const before: TokenReport = JSON.parse(readFileSync(beforePath, "utf-8"));
  const after: TokenReport = JSON.parse(readFileSync(afterPath, "utf-8"));

  console.log("📊 Token Comparison Report");
  console.log("=" .repeat(60));
  console.log("");
  
  console.log("Before:");
  console.log(`  Total Tools: ${before.totalTools}`);
  console.log(`  Total Tokens: ${before.totalTokens.toLocaleString()}`);
  console.log(`  Avg Tokens/Tool: ${before.avgTokensPerTool}`);
  console.log("");
  
  console.log("After:");
  console.log(`  Total Tools: ${after.totalTools}`);
  console.log(`  Total Tokens: ${after.totalTokens.toLocaleString()}`);
  console.log(`  Avg Tokens/Tool: ${after.avgTokensPerTool}`);
  console.log("");
  
  const toolsDiff = after.totalTools - before.totalTools;
  const tokensDiff = after.totalTokens - before.totalTokens;
  const percentChange = before.totalTokens > 0 
    ? ((tokensDiff / before.totalTokens) * 100).toFixed(1)
    : "N/A";
  
  console.log("Changes:");
  console.log(`  Tool Count: ${toolsDiff > 0 ? "+" : ""}${toolsDiff}`);
  console.log(`  Token Count: ${tokensDiff > 0 ? "+" : ""}${tokensDiff} (${percentChange}%)`);
  console.log("");
  
  if (tokensDiff < 0) {
    console.log(`✅ Token savings: ${Math.abs(tokensDiff).toLocaleString()} tokens (${Math.abs(parseFloat(percentChange))}% reduction)`);
  } else if (tokensDiff > 0) {
    console.log(`⚠️ Token increase: ${tokensDiff.toLocaleString()} tokens (+${percentChange}%)`);
  } else {
    console.log("ℹ️ No token change");
  }
  
  console.log("");
  
  // Show which tools were removed/added
  const beforeNames = new Set(before.tools.map(t => t.name));
  const afterNames = new Set(after.tools.map(t => t.name));
  
  const removed = before.tools.filter(t => !afterNames.has(t.name));
  const added = after.tools.filter(t => !beforeNames.has(t.name));
  
  if (removed.length > 0) {
    console.log(`Removed Tools (${removed.length}):`);
    removed.forEach(t => {
      console.log(`  - ${t.name} (${t.totalTokens} tokens)`);
    });
    console.log("");
  }
  
  if (added.length > 0) {
    console.log(`Added Tools (${added.length}):`);
    added.forEach(t => {
      console.log(`  + ${t.name} (${t.totalTokens} tokens)`);
    });
    console.log("");
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse command-line arguments
  if (args.includes("--compare")) {
    const compareIndex = args.indexOf("--compare");
    const beforePath = args[compareIndex + 1];
    const afterPath = args[compareIndex + 2];
    
    if (!beforePath || !afterPath) {
      console.error("Error: --compare requires two file paths");
      console.error("Usage: npm run measure-tokens -- --compare baseline.json after.json");
      process.exit(1);
    }
    
    compareReports(resolve(beforePath), resolve(afterPath));
    encoding.free();
    return;
  }
  
  // Extract and measure tools
  console.log("🔍 Extracting tool definitions...");
  const tools = await extractToolDefinitions();
  
  console.log(`📏 Measuring tokens for ${tools.length} tools...\n`);
  const report = measureTools(tools);
  
  // Display summary
  console.log("📊 Token Measurement Report");
  console.log("=" .repeat(60));
  console.log("");
  console.log(`Total Tools: ${report.totalTools}`);
  console.log(`Total Tokens: ${report.totalTokens.toLocaleString()}`);
  console.log(`Average Tokens per Tool: ${report.avgTokensPerTool}`);
  console.log("");
  
  if (report.tools.length > 0) {
    console.log("Top 10 Tools by Token Count:");
    report.tools.slice(0, 10).forEach((tool, i) => {
      console.log(`  ${i + 1}. ${tool.name}: ${tool.totalTokens} tokens`);
      console.log(`     (name: ${tool.nameTokens}, desc: ${tool.descriptionTokens}, schema: ${tool.schemaTokens})`);
    });
    console.log("");
  }
  
  // Save to file if requested
  const outputIndex = args.indexOf("--output");
  if (outputIndex !== -1) {
    const outputPath = args[outputIndex + 1];
    if (!outputPath) {
      console.error("Error: --output requires a file path");
      process.exit(1);
    }
    
    const fullPath = resolve(outputPath);
    writeFileSync(fullPath, JSON.stringify(report, null, 2));
    console.log(`✅ Report saved to: ${fullPath}`);
  }
  
  // Cleanup
  encoding.free();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
