#!/usr/bin/env node

/**
 * Verify Build Script
 * 
 * This script verifies that the build contains the expected content
 * by searching for key strings in the dist and android assets folders.
 * 
 * Usage: node scripts/verify-build.mjs
 */

import { readdir, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Key strings that should exist in a valid build
const VERIFICATION_STRINGS = [
  '© 2026 Mí Turnow',
  'Eliminar Cuenta',
  'Mí Turnow'
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function searchInDirectory(dir, searchStrings) {
  const results = {};
  searchStrings.forEach(s => results[s] = false);
  
  async function searchRecursive(currentDir) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await searchRecursive(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
          try {
            const content = await readFile(fullPath, 'utf-8');
            for (const searchStr of searchStrings) {
              if (content.includes(searchStr)) {
                results[searchStr] = true;
              }
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }
  
  await searchRecursive(dir);
  return results;
}

async function main() {
  console.log('🔍 Verifying build content...\n');
  
  const distPath = join(projectRoot, 'dist');
  const androidAssetsPath = join(projectRoot, 'android/app/src/main/assets/public');
  
  // Check dist folder
  console.log('📁 Checking dist/ folder:');
  if (await exists(distPath)) {
    const distResults = await searchInDirectory(distPath, VERIFICATION_STRINGS);
    for (const [str, found] of Object.entries(distResults)) {
      console.log(`   ${found ? '✓' : '✗'} "${str}"`);
    }
  } else {
    console.log('   ⚠️ dist/ folder not found - run npm run build first');
  }
  
  console.log('\n📱 Checking android assets:');
  if (await exists(androidAssetsPath)) {
    const androidResults = await searchInDirectory(androidAssetsPath, VERIFICATION_STRINGS);
    for (const [str, found] of Object.entries(androidResults)) {
      console.log(`   ${found ? '✓' : '✗'} "${str}"`);
    }
  } else {
    console.log('   ⚠️ Android assets not found - run npx cap sync android first');
  }
  
  console.log('\n📋 If any checks failed:');
  console.log('   1. Ensure you have the latest code (git pull)');
  console.log('   2. Run: node scripts/clean-android-assets.mjs');
  console.log('   3. Run: npm run build');
  console.log('   4. Run: npx cap sync android');
  console.log('   5. Rebuild in Android Studio\n');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
