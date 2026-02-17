#!/usr/bin/env tsx
/**
 * Audit script to scan all instruction files and identify overlaps/contradictions
 * 
 * This script:
 * - Scans CLAUDE.md, .github/copilot-instructions.md, .github/agents/, .github/instructions/, .github/skills/
 * - Extracts topics covered by each file
 * - Builds a topic map showing which files cover each topic
 * - Identifies overlaps (same topic in multiple files)
 * - Detects potential contradictions
 * - Generates a comprehensive report in docs/instruction-audit.md
 */

import fs from 'fs';
import path from 'path';

interface FileInfo {
  path: string;
  lines: number;
  topics: string[];
  content: string;
}

interface TopicCoverage {
  topic: string;
  files: Array<{
    file: string;
    lineRanges: string[];
    excerpts: string[];
  }>;
}

interface Contradiction {
  topic: string;
  file1: string;
  statement1: string;
  file2: string;
  statement2: string;
  severity: 'high' | 'medium' | 'low';
}

// Define topics to search for
const TOPICS = {
  'Database Safety': [
    'prisma migrate',
    'db push',
    'migrate reset',
    'database safety',
    'schema changes'
  ],
  'Workflow Guidance': [
    'workflow',
    'session lifecycle',
    'planning',
    'execution order',
    'task completion'
  ],
  'Tool Usage': [
    'spectree__',
    'MCP tool',
    'function call',
    'tool pattern'
  ],
  'Best Practices': [
    'best practice',
    'should always',
    'must always',
    'never do',
    'critical requirement'
  ],
  'Prohibited Actions': [
    'prohibited',
    'do not',
    'never',
    'forbidden',
    'security'
  ],
  'Session Management': [
    'start_session',
    'end_session',
    'handoff',
    'session context',
    'AI notes'
  ],
  'Progress Tracking': [
    'start_work',
    'complete_work',
    'log_progress',
    'progress tracking',
    'status update'
  ],
  'Code Context': [
    'link_code_file',
    'code context',
    'files involved',
    'git branch'
  ],
  'Validation': [
    'validation',
    'acceptance criteria',
    'run_all_validations',
    'testing strategy'
  ],
  'Epic Creation': [
    'create_epic',
    'epic template',
    'execution metadata',
    'feature planning'
  ],
  'Agent-Specific': [
    'planner',
    'orchestrator',
    'reviewer',
    'feature worker',
    'agent role'
  ],
  'Structured Descriptions': [
    'structured description',
    'aiInstructions',
    'summary',
    'acceptanceCriteria'
  ]
};

// Keywords that indicate prohibitions or requirements (for contradiction detection)
const PROHIBITION_KEYWORDS = ['never', 'do not', 'must not', 'forbidden', 'prohibited', 'avoid'];
const REQUIREMENT_KEYWORDS = ['must', 'always', 'required', 'mandatory', 'critical'];

/**
 * Scan a directory recursively for markdown files
 */
function scanDirectory(dirPath: string, baseDir: string = dirPath): FileInfo[] {
  const files: FileInfo[] = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...scanDirectory(fullPath, baseDir));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        const topics = extractTopics(content);
        const relativePath = path.relative(process.cwd(), fullPath);
        
        files.push({
          path: relativePath,
          lines,
          topics,
          content
        });
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dirPath}:`, error);
  }
  
  return files;
}

/**
 * Extract topics covered in a file based on keyword matching
 */
function extractTopics(content: string): string[] {
  const foundTopics: string[] = [];
  const contentLower = content.toLowerCase();
  
  for (const [topic, keywords] of Object.entries(TOPICS)) {
    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        foundTopics.push(topic);
        break;
      }
    }
  }
  
  return foundTopics;
}

/**
 * Build a topic map showing which files cover each topic
 */
function buildTopicMap(files: FileInfo[]): TopicCoverage[] {
  const topicMap = new Map<string, TopicCoverage>();
  
  for (const file of files) {
    for (const topic of file.topics) {
      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          topic,
          files: []
        });
      }
      
      const coverage = topicMap.get(topic)!;
      const lineRanges = findTopicLineRanges(file.content, topic);
      const excerpts = extractExcerpts(file.content, topic);
      
      coverage.files.push({
        file: file.path,
        lineRanges,
        excerpts
      });
    }
  }
  
  return Array.from(topicMap.values()).sort((a, b) => b.files.length - a.files.length);
}

/**
 * Find line ranges where a topic is mentioned
 */
function findTopicLineRanges(content: string, topic: string): string[] {
  const lines = content.split('\n');
  const ranges: string[] = [];
  const keywords = TOPICS[topic as keyof typeof TOPICS] || [];
  
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    for (const keyword of keywords) {
      if (lineLower.includes(keyword.toLowerCase())) {
        ranges.push(`L${i + 1}`);
        break;
      }
    }
  }
  
  // Group consecutive lines into ranges
  const grouped: string[] = [];
  let start = -1;
  let end = -1;
  
  for (const range of ranges) {
    const lineNum = parseInt(range.substring(1));
    if (start === -1) {
      start = lineNum;
      end = lineNum;
    } else if (lineNum === end + 1) {
      end = lineNum;
    } else {
      grouped.push(start === end ? `L${start}` : `L${start}-${end}`);
      start = lineNum;
      end = lineNum;
    }
  }
  
  if (start !== -1) {
    grouped.push(start === end ? `L${start}` : `L${start}-${end}`);
  }
  
  return grouped.slice(0, 5); // Return max 5 ranges per file
}

/**
 * Extract short excerpts showing how a topic is covered
 */
function extractExcerpts(content: string, topic: string): string[] {
  const lines = content.split('\n');
  const excerpts: string[] = [];
  const keywords = TOPICS[topic as keyof typeof TOPICS] || [];
  
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    for (const keyword of keywords) {
      if (lineLower.includes(keyword.toLowerCase())) {
        const excerpt = lines[i].trim();
        if (excerpt.length > 10) {
          excerpts.push(excerpt.substring(0, 100) + (excerpt.length > 100 ? '...' : ''));
        }
        break;
      }
    }
    
    if (excerpts.length >= 3) break; // Max 3 excerpts per topic
  }
  
  return excerpts;
}

/**
 * Detect potential contradictions between files
 */
function detectContradictions(files: FileInfo[]): Contradiction[] {
  const contradictions: Contradiction[] = [];
  
  // Check for database safety contradictions
  const dbSafetyFiles = files.filter(f => f.topics.includes('Database Safety'));
  for (let i = 0; i < dbSafetyFiles.length; i++) {
    for (let j = i + 1; j < dbSafetyFiles.length; j++) {
      const file1 = dbSafetyFiles[i];
      const file2 = dbSafetyFiles[j];
      
      // Check if one allows and another prohibits
      const file1HasProhibition = /never.*prisma migrate dev|do not.*migrate dev/i.test(file1.content);
      const file2HasProhibition = /never.*prisma migrate dev|do not.*migrate dev/i.test(file2.content);
      
      if (file1HasProhibition !== file2HasProhibition) {
        contradictions.push({
          topic: 'Database Safety',
          file1: file1.path,
          statement1: file1HasProhibition ? 'Prohibits prisma migrate dev' : 'Does not prohibit prisma migrate dev',
          file2: file2.path,
          statement2: file2HasProhibition ? 'Prohibits prisma migrate dev' : 'Does not prohibit prisma migrate dev',
          severity: 'high'
        });
      }
    }
  }
  
  // Check for workflow contradictions
  const workflowFiles = files.filter(f => f.topics.includes('Workflow Guidance'));
  for (let i = 0; i < workflowFiles.length; i++) {
    for (let j = i + 1; j < workflowFiles.length; j++) {
      const file1 = workflowFiles[i];
      const file2 = workflowFiles[j];
      
      // Check for conflicting instructions about start_work
      const file1RequiresStart = /must.*start_work|always.*start_work|required.*start_work/i.test(file1.content);
      const file2RequiresStart = /must.*start_work|always.*start_work|required.*start_work/i.test(file2.content);
      const file1OptionalStart = /optional.*start_work|may.*start_work/i.test(file1.content);
      const file2OptionalStart = /optional.*start_work|may.*start_work/i.test(file2.content);
      
      if (file1RequiresStart && file2OptionalStart) {
        contradictions.push({
          topic: 'Workflow Guidance',
          file1: file1.path,
          statement1: 'Requires start_work',
          file2: file2.path,
          statement2: 'Makes start_work optional',
          severity: 'medium'
        });
      }
    }
  }
  
  return contradictions;
}

/**
 * Generate the audit report
 */
function generateReport(files: FileInfo[], topicMap: TopicCoverage[], contradictions: Contradiction[]): string {
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  
  let report = `# Instruction Files Audit Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `---\n\n`;
  
  // Summary
  report += `## Summary\n\n`;
  report += `- **Total Files Scanned:** ${files.length}\n`;
  report += `- **Total Lines:** ${totalLines.toLocaleString()}\n`;
  report += `- **Topics Identified:** ${topicMap.length}\n`;
  report += `- **Overlaps Found:** ${topicMap.filter(t => t.files.length > 1).length}\n`;
  report += `- **Potential Contradictions:** ${contradictions.length}\n\n`;
  
  // File breakdown
  report += `## File Breakdown\n\n`;
  report += `| File | Lines | Topics Covered |\n`;
  report += `|------|-------|----------------|\n`;
  for (const file of files.sort((a, b) => b.lines - a.lines)) {
    report += `| \`${file.path}\` | ${file.lines} | ${file.topics.length} |\n`;
  }
  report += `\n`;
  
  // Topic coverage
  report += `## Topic Coverage\n\n`;
  for (const topic of topicMap) {
    report += `### ${topic.topic}\n\n`;
    report += `**Covered in ${topic.files.length} file(s)**\n\n`;
    
    for (const file of topic.files) {
      report += `- **\`${file.file}\`**\n`;
      if (file.lineRanges.length > 0) {
        report += `  - Lines: ${file.lineRanges.join(', ')}\n`;
      }
      if (file.excerpts.length > 0) {
        report += `  - Excerpts:\n`;
        for (const excerpt of file.excerpts) {
          report += `    - "${excerpt}"\n`;
        }
      }
    }
    report += `\n`;
  }
  
  // Overlaps
  report += `## Overlaps (Topics in Multiple Files)\n\n`;
  const overlaps = topicMap.filter(t => t.files.length > 1);
  if (overlaps.length === 0) {
    report += `No overlaps detected.\n\n`;
  } else {
    for (const overlap of overlaps) {
      report += `### ${overlap.topic}\n\n`;
      report += `Appears in **${overlap.files.length}** files:\n\n`;
      for (const file of overlap.files) {
        report += `- \`${file.file}\` (${file.lineRanges.join(', ')})\n`;
      }
      report += `\n`;
    }
  }
  
  // Contradictions
  report += `## Contradictions\n\n`;
  if (contradictions.length === 0) {
    report += `No contradictions detected.\n\n`;
  } else {
    for (const contradiction of contradictions) {
      const emoji = contradiction.severity === 'high' ? '🔴' : contradiction.severity === 'medium' ? '🟡' : '🟢';
      report += `### ${emoji} ${contradiction.topic} (${contradiction.severity} severity)\n\n`;
      report += `**File 1:** \`${contradiction.file1}\`\n`;
      report += `- ${contradiction.statement1}\n\n`;
      report += `**File 2:** \`${contradiction.file2}\`\n`;
      report += `- ${contradiction.statement2}\n\n`;
    }
  }
  
  // Recommendations
  report += `## Recommendations\n\n`;
  report += `1. **Consolidation Priority:**\n`;
  report += `   - Focus on topics with highest overlap (${overlaps[0]?.topic || 'N/A'})\n`;
  report += `   - Address high-severity contradictions first\n\n`;
  report += `2. **Line Count Target:**\n`;
  report += `   - Current total: ${totalLines.toLocaleString()} lines\n`;
  report += `   - Target: < 2000 lines in copilot-instructions.md\n`;
  report += `   - Reduction needed: ${Math.max(0, totalLines - 2000).toLocaleString()} lines\n\n`;
  report += `3. **Deduplication Opportunities:**\n`;
  for (const overlap of overlaps.slice(0, 5)) {
    report += `   - ${overlap.topic}: consolidate from ${overlap.files.length} files into 1\n`;
  }
  report += `\n`;
  report += `4. **Agent-Specific Instructions:**\n`;
  report += `   - Move agent-specific content to .github/agents/\n`;
  report += `   - Keep core patterns in copilot-instructions.md\n`;
  report += `   - Use references instead of duplication\n\n`;
  
  return report;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Scanning instruction files...\n');
  
  const files: FileInfo[] = [];
  
  // Scan CLAUDE.md
  if (fs.existsSync('CLAUDE.md')) {
    const content = fs.readFileSync('CLAUDE.md', 'utf-8');
    files.push({
      path: 'CLAUDE.md',
      lines: content.split('\n').length,
      topics: extractTopics(content),
      content
    });
  }
  
  // Scan copilot-instructions.md
  if (fs.existsSync('.github/copilot-instructions.md')) {
    const content = fs.readFileSync('.github/copilot-instructions.md', 'utf-8');
    files.push({
      path: '.github/copilot-instructions.md',
      lines: content.split('\n').length,
      topics: extractTopics(content),
      content
    });
  }
  
  // Scan .github/agents/
  files.push(...scanDirectory('.github/agents'));
  
  // Scan .github/instructions/
  files.push(...scanDirectory('.github/instructions'));
  
  // Scan .github/skills/
  files.push(...scanDirectory('.github/skills'));
  
  console.log(`✅ Scanned ${files.length} files (${files.reduce((sum, f) => sum + f.lines, 0).toLocaleString()} lines)\n`);
  
  // Build topic map
  console.log('🗺️  Building topic map...\n');
  const topicMap = buildTopicMap(files);
  console.log(`✅ Identified ${topicMap.length} topics\n`);
  
  // Detect contradictions
  console.log('🔍 Detecting contradictions...\n');
  const contradictions = detectContradictions(files);
  console.log(`✅ Found ${contradictions.length} potential contradictions\n`);
  
  // Generate report
  console.log('📝 Generating report...\n');
  const report = generateReport(files, topicMap, contradictions);
  
  // Ensure docs directory exists
  if (!fs.existsSync('docs')) {
    fs.mkdirSync('docs');
  }
  
  // Write report
  fs.writeFileSync('docs/instruction-audit.md', report);
  console.log('✅ Report saved to docs/instruction-audit.md\n');
  
  // Print summary
  console.log('📊 Summary:');
  console.log(`   Files: ${files.length}`);
  console.log(`   Lines: ${files.reduce((sum, f) => sum + f.lines, 0).toLocaleString()}`);
  console.log(`   Topics: ${topicMap.length}`);
  console.log(`   Overlaps: ${topicMap.filter(t => t.files.length > 1).length}`);
  console.log(`   Contradictions: ${contradictions.length}`);
}

main();
