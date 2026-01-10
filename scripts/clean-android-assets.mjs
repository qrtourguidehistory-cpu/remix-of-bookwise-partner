#!/usr/bin/env node

/**
 * Clean Android Assets Script
 * 
 * This script removes old web assets from the Android project
 * to ensure fresh builds always use the latest code.
 * 
 * Usage: node scripts/clean-android-assets.mjs
 */

import { rm, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const pathsToClean = [
  'android/app/src/main/assets/public',
  'android/app/build',
  'dist'
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function cleanPath(relativePath) {
  const fullPath = join(projectRoot, relativePath);
  
  if (await exists(fullPath)) {
    try {
      await rm(fullPath, { recursive: true, force: true });
      console.log(`✓ Cleaned: ${relativePath}`);
      return true;
    } catch (error) {
      console.error(`✗ Failed to clean ${relativePath}:`, error.message);
      return false;
    }
  } else {
    console.log(`○ Skipped (not found): ${relativePath}`);
    return true;
  }
}

async function main() {
  console.log('🧹 Cleaning Android assets and build artifacts...\n');
  
  const results = await Promise.all(pathsToClean.map(cleanPath));
  
  const allSuccess = results.every(r => r);
  
  console.log('\n' + (allSuccess ? '✅ Clean complete!' : '⚠️ Some paths failed to clean'));
  
  // Print instructions
  console.log('\n📋 Next steps:');
  console.log('   1. npm run build');
  console.log('   2. npx cap sync android');
  console.log('   3. Open Android Studio and rebuild\n');
  
  process.exit(allSuccess ? 0 : 1);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
