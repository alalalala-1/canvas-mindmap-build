/**
 * Large File Edit Strategy Validation Tests
 * 
 * These tests validate the LFRP (Large File Refactor Protocol) toolchain.
 * They are NOT about testing business logic, but about ensuring the
 * large file editing tools work correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

const FIXTURE_PATH = path.join(projectRoot, 'src/dev/large-file-edit-fixture.ts');
const TEMP_DIR = path.join(projectRoot, '.tmp-large-file-test');

describe('Large File Edit Strategy (LFRP)', () => {
  beforeAll(() => {
    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup temp directory
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe('Fixture Generation', () => {
    it('should generate a fixture file with expected size', () => {
      expect(fs.existsSync(FIXTURE_PATH)).toBe(true);

      const content = fs.readFileSync(FIXTURE_PATH, 'utf-8');
      const lineCount = content.split('\n').length;

      // Should be around 3000+ lines
      expect(lineCount).toBeGreaterThan(3000);
      expect(lineCount).toBeLessThan(10000); // Sanity upper bound
    });

    it('should contain block markers', () => {
      const content = fs.readFileSync(FIXTURE_PATH, 'utf-8');

      // Check for START markers
      const startMarkers = content.match(/\/\/\s*>>>\s*BLOCK:[^:]+:START/g);
      expect(startMarkers).toBeTruthy();
      expect(startMarkers!.length).toBeGreaterThan(10);

      // Check for END markers
      const endMarkers = content.match(/\/\/\s*<<<\s*BLOCK:[^:]+:END/g);
      expect(endMarkers).toBeTruthy();
      expect(endMarkers!.length).toBe(startMarkers!.length);
    });

    it('should have valid TypeScript syntax', () => {
      const content = fs.readFileSync(FIXTURE_PATH, 'utf-8');

      // Basic syntax checks
      expect(content).toContain('interface');
      expect(content).toContain('class');
      expect(content).toContain('export');

      // Should not have obvious syntax errors
      expect(content).not.toContain('<<<<<<< HEAD');
      expect(content).not.toContain('>>>>>>> ');
    });
  });

  describe('list-blocks.mjs', () => {
    it('should list all blocks in fixture', () => {
      const scriptPath = path.join(projectRoot, 'scripts/large-file/list-blocks.mjs');
      expect(fs.existsSync(scriptPath)).toBe(true);

      // Run the script
      const output = execSync(
        `node "${scriptPath}" --file "${FIXTURE_PATH}"`,
        { encoding: 'utf-8' }
      );

      // Should show block information
      expect(output).toContain('Found');
      expect(output).toContain('block');
      expect(output).toContain('imports');
      expect(output).toContain('exports');
      expect(output).toContain('section-001');
    });

    it('should detect invalid file paths', () => {
      const scriptPath = path.join(projectRoot, 'scripts/large-file/list-blocks.mjs');
      const invalidPath = path.join(projectRoot, 'non-existent-file.ts');

      try {
        execSync(
          `node "${scriptPath}" --file "${invalidPath}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
        expect.fail('Should have thrown error for non-existent file');
      } catch (error: any) {
        expect(error.status).toBe(1);
      }
    });
  });

  describe('replace-block.mjs', () => {
    it('should replace a block in dry-run mode', () => {
      const scriptPath = path.join(projectRoot, 'scripts/large-file/replace-block.mjs');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const newContent = '// TEST: Replaced content for imports block';

      // Run in dry-run mode
      const output = execSync(
        `node "${scriptPath}" --file "${FIXTURE_PATH}" --block imports --content "${newContent}" --dry-run`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('DRY RUN');
      expect(output).toContain('Block found');
      expect(output).toContain('imports');

      // Verify original file is unchanged
      const content = fs.readFileSync(FIXTURE_PATH, 'utf-8');
      expect(content).not.toContain('TEST: Replaced content');
    });

    it('should actually replace a block when not in dry-run mode', () => {
      // Create a temporary copy of fixture
      const tempFixture = path.join(TEMP_DIR, 'test-fixture.ts');
      fs.copyFileSync(FIXTURE_PATH, tempFixture);

      const scriptPath = path.join(projectRoot, 'scripts/large-file/replace-block.mjs');
      const newContent = '// REPLACED: Test replacement';

      // Verify original content
      const originalContent = fs.readFileSync(tempFixture, 'utf-8');
      expect(originalContent).toContain('interface HandlerContext');

      // Run replacement
      const output = execSync(
        `node "${scriptPath}" --file "${tempFixture}" --block imports --content "${newContent}" --no-backup`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('File updated successfully');

      // Verify new content
      const newFileContent = fs.readFileSync(tempFixture, 'utf-8');
      expect(newFileContent).toContain('REPLACED: Test replacement');
      expect(newFileContent).not.toContain('interface HandlerContext');

      // Verify markers are preserved
      expect(newFileContent).toContain('>>> BLOCK:imports:START');
      expect(newFileContent).toContain('<<< BLOCK:imports:END');
    });

    it('should create backup when replacing', () => {
      const tempFixture = path.join(TEMP_DIR, 'test-fixture-backup.ts');
      fs.copyFileSync(FIXTURE_PATH, tempFixture);

      const scriptPath = path.join(projectRoot, 'scripts/large-file/replace-block.mjs');
      const backupPath = `${tempFixture}.bak`;

      // Ensure no backup exists yet
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      // Run replacement with backup (default behavior)
      execSync(
        `node "${scriptPath}" --file "${tempFixture}" --block imports --content "// Backup test"`,
        { encoding: 'utf-8' }
      );

      // Verify backup was created
      expect(fs.existsSync(backupPath)).toBe(true);

      // Backup should contain original content
      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      expect(backupContent).toContain('interface HandlerContext');
      expect(backupContent).not.toContain('Backup test');
    });

    it('should handle non-existent block gracefully', () => {
      const scriptPath = path.join(projectRoot, 'scripts/large-file/replace-block.mjs');

      try {
        execSync(
          `node "${scriptPath}" --file "${FIXTURE_PATH}" --block non-existent-block --content "test" --dry-run`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
        expect.fail('Should have thrown error for non-existent block');
      } catch (error: any) {
        expect(error.status).toBe(1);
        expect(error.stderr.toString()).toContain('not found');
      }
    });
  });

  describe('Block Integrity', () => {
    it('should have matching START/END markers', () => {
      const content = fs.readFileSync(FIXTURE_PATH, 'utf-8');
      const lines = content.split('\n');

      const blockStack: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const lineNum = i + 1;

        const startMatch = line.match(/\/\/\s*>>>\s*BLOCK:([^:]+):START/);
        if (startMatch && startMatch[1]) {
          blockStack.push(startMatch[1]);
        }

        const endMatch = line.match(/\/\/\s*<<<\s*BLOCK:([^:]+):END/);
        if (endMatch && endMatch[1]) {
          const expectedBlock = blockStack.pop();
          if (!expectedBlock) {
            errors.push(`Line ${lineNum}: END marker for "${endMatch[1]}" without START`);
          } else if (expectedBlock !== endMatch[1]) {
            errors.push(`Line ${lineNum}: END marker "${endMatch[1]}" doesn't match START "${expectedBlock}"`);
          }
        }
      }

      if (blockStack.length > 0) {
        errors.push(`Unclosed blocks: ${blockStack.join(', ')}`);
      }

      expect(errors).toEqual([]);
    });

    it('should not have nested blocks', () => {
      const content = fs.readFileSync(FIXTURE_PATH, 'utf-8');
      const lines = content.split('\n');

      let depth = 0;
      const nestedBlocks: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const lineNum = i + 1;

        if (line.match(/\/\/\s*>>>\s*BLOCK:[^:]+:START/)) {
          depth++;
          if (depth > 1) {
            nestedBlocks.push(lineNum);
          }
        }

        if (line.match(/\/\/\s*<<<\s*BLOCK:[^:]+:END/)) {
          depth--;
        }
      }

      expect(nestedBlocks).toEqual([]);
    });
  });

  describe('Documentation Integration', () => {
    it('should have LFRP playbook documentation', () => {
      const playbookPath = path.join(projectRoot, 'docs/large-file-refactor-playbook.md');
      expect(fs.existsSync(playbookPath)).toBe(true);

      const content = fs.readFileSync(playbookPath, 'utf-8');
      expect(content).toContain('Large File Refactor Protocol');
      expect(content).toContain('LFRP');
      expect(content).toContain('replace-block.mjs');
    });

    it('should have LFRP section in AGENTS.md', () => {
      const agentsPath = path.join(projectRoot, 'AGENTS.md');
      expect(fs.existsSync(agentsPath)).toBe(true);

      const content = fs.readFileSync(agentsPath, 'utf-8');
      expect(content).toContain('Large file refactoring');
      expect(content).toContain('LFRP');
    });
  });
});
