#!/usr/bin/env node
/**
 * Replace a specific block in a file with BLOCK markers
 * 
 * This is the fallback tool when Cline's replace_in_file fails on large files.
 * It precisely replaces content between BLOCK markers without touching other parts.
 * 
 * Usage:
 *   node scripts/large-file/replace-block.mjs --file <path> --block <name> --content <newContent>
 *   node scripts/large-file/replace-block.mjs --file <path> --block <name> --content-file <path>
 * 
 * Examples:
 *   # Replace from inline content
 *   node scripts/large-file/replace-block.mjs \
 *     --file src/dev/large-file-edit-fixture.ts \
 *     --block section-001 \
 *     --content "// New implementation"
 * 
 *   # Replace from content file
 *   node scripts/large-file/replace-block.mjs \
 *     --file src/canvas/canvas-event-manager.ts \
 *     --block native-insert-core \
 *     --content-file ./temp/new-implementation.ts
 * 
 *   # Dry run (preview only)
 *   node scripts/large-file/replace-block.mjs \
 *     --file <path> --block <name> --content <content> --dry-run
 */

import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);

function getArgValue(argName) {
  const index = args.indexOf(argName);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

function hasFlag(flagName) {
  return args.includes(flagName);
}

const filePath = getArgValue('--file');
const blockName = getArgValue('--block');
const contentInline = getArgValue('--content');
const contentFilePath = getArgValue('--content-file');
const isDryRun = hasFlag('--dry-run');
const createBackup = !hasFlag('--no-backup');

// Validate arguments
if (!filePath || !blockName || (!contentInline && !contentFilePath)) {
  console.error(`❌ Usage: node replace-block.mjs --file <path> --block <name> --content <newContent>
   or: node replace-block.mjs --file <path> --block <name> --content-file <path>

Options:
  --file <path>         Target file to modify
  --block <name>        Block name to replace (without BLOCK: prefix)
  --content <text>      New content (inline)
  --content-file <path> New content (from file)
  --dry-run             Preview changes without writing
  --no-backup           Skip backup creation (default: create .bak file)`);
  process.exit(1);
}

// Get new content
let newContent;
if (contentFilePath) {
  if (!fs.existsSync(contentFilePath)) {
    console.error(`❌ Content file not found: ${contentFilePath}`);
    process.exit(1);
  }
  newContent = fs.readFileSync(contentFilePath, 'utf-8');
} else {
  newContent = contentInline;
}

// Block marker patterns
const START_PATTERN = new RegExp(`^(\\/\\/\\s*>>>\\s*BLOCK:${blockName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:START\\s*)$`, 'm');
const END_PATTERN = new RegExp(`^(\\/\\/\\s*<<<\\s*BLOCK:${blockName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:END\\s*)$`, 'm');

/**
 * Replace block content
 */
function replaceBlock(filePath, blockName, newContent) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const originalContent = fs.readFileSync(filePath, 'utf-8');
  const lines = originalContent.split('\n');

  // Find block boundaries
  let startLine = -1;
  let endLine = -1;
  let startMarker = '';
  let endMarker = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (startLine === -1) {
      const startMatch = line.match(START_PATTERN);
      if (startMatch) {
        startLine = i;
        startMarker = startMatch[0];
      }
    } else {
      const endMatch = line.match(END_PATTERN);
      if (endMatch) {
        endLine = i;
        endMarker = endMatch[0];
        break;
      }
    }
  }

  // Validate block was found
  if (startLine === -1) {
    throw new Error(`Block START marker not found: BLOCK:${blockName}:START`);
  }
  if (endLine === -1) {
    throw new Error(`Block END marker not found: BLOCK:${blockName}:END (START was at line ${startLine + 1})`);
  }

  // Extract old content (excluding markers)
  const oldBlockContent = lines.slice(startLine + 1, endLine).join('\n');
  const oldLineCount = endLine - startLine - 1;

  // Build new file content
  const beforeBlock = lines.slice(0, startLine + 1);
  const afterBlock = lines.slice(endLine);
  
  // Ensure newContent doesn't include the markers themselves
  const cleanedNewContent = newContent
    .replace(START_PATTERN, '')
    .replace(END_PATTERN, '')
    .trim();

  // Assemble the new content
  const newFileLines = [
    ...beforeBlock,
    cleanedNewContent,
    ...afterBlock
  ];

  const newFileContent = newFileLines.join('\n');
  const newLineCount = cleanedNewContent.split('\n').length;

  return {
    originalContent,
    newFileContent,
    startLine: startLine + 1, // Convert to 1-based
    endLine: endLine + 1,     // Convert to 1-based
    oldLineCount,
    newLineCount,
    oldBlockContent,
    newBlockContent: cleanedNewContent,
  };
}

// Main execution
try {
  console.log(`\n🔧 Block Replacement Tool`);
  console.log(`   File: ${filePath}`);
  console.log(`   Block: ${blockName}`);
  console.log(`   Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'LIVE'}\n`);

  const result = replaceBlock(filePath, blockName, newContent);

  console.log(`✅ Block found:`);
  console.log(`   Lines ${result.startLine}-${result.endLine} (${result.oldLineCount} lines)`);
  console.log(`   Old content: ${result.oldLineCount} lines`);
  console.log(`   New content: ${result.newLineCount} lines`);
  console.log(`   Diff: ${result.newLineCount > result.oldLineCount ? '+' : ''}${result.newLineCount - result.oldLineCount} lines\n`);

  if (isDryRun) {
    console.log(`📋 Preview of changes:`);
    console.log(`   (showing first 10 lines of old and new content)\n`);
    
    const oldPreview = result.oldBlockContent.split('\n').slice(0, 10).join('\n');
    const newPreview = result.newBlockContent.split('\n').slice(0, 10).join('\n');
    
    console.log(`   OLD:`);
    console.log(`   ${'-'.repeat(60)}`);
    oldPreview.split('\n').forEach(line => console.log(`   ${line}`));
    if (result.oldLineCount > 10) console.log(`   ... (${result.oldLineCount - 10} more lines)`);
    
    console.log(`\n   NEW:`);
    console.log(`   ${'-'.repeat(60)}`);
    newPreview.split('\n').forEach(line => console.log(`   ${line}`));
    if (result.newLineCount > 10) console.log(`   ... (${result.newLineCount - 10} more lines)`);
    
    console.log(`\n⚠️  This was a DRY RUN. No files were modified.`);
    console.log(`   Remove --dry-run flag to apply changes.`);
  } else {
    // Create backup
    if (createBackup) {
      const backupPath = `${filePath}.bak`;
      fs.writeFileSync(backupPath, result.originalContent, 'utf-8');
      console.log(`💾 Backup created: ${backupPath}`);
    }

    // Write the new content
    fs.writeFileSync(filePath, result.newFileContent, 'utf-8');
    console.log(`✅ File updated successfully!`);
    
    const totalLines = result.newFileContent.split('\n').length;
    console.log(`   Total file lines: ${totalLines}`);
  }

  process.exit(0);
} catch (error) {
  console.error(`\n❌ Error replacing block: ${error.message}`);
  process.exit(1);
}
