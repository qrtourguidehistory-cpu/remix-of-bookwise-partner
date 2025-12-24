#!/usr/bin/env node

/**
 * Security Check Script
 * 
 * This script checks for potential security issues in the codebase,
 * specifically missing business_id filters in Supabase queries.
 * 
 * Run with: node scripts/check-security.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TABLES_REQUIRING_BUSINESS_ID = [
  'clients',
  'staff',
  'services',
  'appointments',
  'sales',
  'business_hours',
  'appointment_settings',
];

const IGNORE_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  'scripts',
  'SECURITY.md',
  'database.types.ts',
];

// Files that use user_id instead of business_id (correct for client-facing views)
const CLIENT_PORTAL_FILES = [
  'ClientPortal.tsx',
];

// Files that create data during onboarding (business_id is set in the data object)
const ONBOARDING_FILES = [
  'OnboardingFlow.tsx',
];

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!IGNORE_PATTERNS.some(pattern => filePath.includes(pattern))) {
        findFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  TABLES_REQUIRING_BUSINESS_ID.forEach(table => {
    // Look for queries to this table
    const tableRegex = new RegExp(`\\.from\\(["']${table}["']\\)`, 'g');
    const matches = content.matchAll(tableRegex);

    for (const match of matches) {
      const matchIndex = match.index;
      const lineNumber = content.substring(0, matchIndex).split('\n').length;
      
      // Check if business_id filter exists in the next 20 lines
      const afterMatch = content.substring(matchIndex);
      const nextLines = afterMatch.split('\n').slice(0, 20).join('\n');
      
      // Look for business_id filter
      const hasBusinessIdFilter = 
        nextLines.includes('business_id') &&
        (nextLines.includes('.eq("business_id"') || 
         nextLines.includes(".eq('business_id'") ||
         nextLines.includes('.eq(`business_id`'));
      
      // Also check if it's using safeQuery helper
      const usesHelper = 
        content.substring(Math.max(0, matchIndex - 100), matchIndex).includes('safeQuery') ||
        content.substring(Math.max(0, matchIndex - 100), matchIndex).includes('createBusinessQuery');

      if (!hasBusinessIdFilter && !usesHelper) {
        // Check if it's in a context where business_id might not be needed
        // Look further back to find data object definitions
        const contextBefore = content.substring(Math.max(0, matchIndex - 1000), matchIndex);
        const contextAfter = content.substring(matchIndex, Math.min(content.length, matchIndex + 200));
        const fullContext = contextBefore + contextAfter;
        
        // Check if file is ClientPortal (uses user_id, not business_id)
        const isClientPortalFile = filePath.includes('ClientPortal.tsx');
        const isClientPortal = isClientPortalFile || 
                               fullContext.includes('.eq("user_id"') ||
                               fullContext.includes(".eq('user_id'");
        
        // Check if file is OnboardingFlow (creates data during onboarding)
        const isOnboardingFile = filePath.includes('OnboardingFlow.tsx');
        const isOnboarding = isOnboardingFile && 
                            (fullContext.includes('.insert') || fullContext.includes('business_id:'));
        
        // Check if business_id is set in the insert/update data object
        // Look for patterns in the data object definition (up to 50 lines before)
        const hasBusinessIdInData = 
          // Direct assignment patterns (anywhere in context)
          fullContext.includes('business_id:') || 
          fullContext.includes('business_id =') ||
          // Object property assignment patterns
          fullContext.includes('appointmentData.business_id') ||
          fullContext.includes('saleData.business_id') ||
          fullContext.includes('staffData.business_id') ||
          fullContext.includes('settingsData.business_id') ||
          fullContext.includes('newHours.business_id') ||
          fullContext.includes('clientData.business_id') ||
          // Check if there's a data object definition with business_id nearby
          // Look for patterns like: const xxxData = { ... business_id: ... }
          contextBefore.match(/const\s+\w+Data\s*=\s*\{[^}]*business_id[^}]*\}/s) ||
          contextBefore.match(/\w+Data\s*=\s*\{[^}]*business_id[^}]*\}/s) ||
          // Check if business_id is in the object being inserted (look for object literal before .insert)
          (contextBefore.includes('business_id') && contextAfter.includes('.insert'));
        
        if (!isClientPortal && !isOnboarding && !hasBusinessIdInData) {
          issues.push({
            line: lineNumber,
            table,
            severity: 'high',
            message: `Query to "${table}" table may be missing business_id filter`
          });
        }
      }
    }
  });

  return issues;
}

function main() {
  console.log('🔍 Checking for security issues...\n');

  const srcDir = path.join(__dirname, '..', 'src');
  const files = findFiles(srcDir);
  
  let totalIssues = 0;
  const filesWithIssues = [];

  files.forEach(file => {
    const issues = checkFile(file);
    if (issues.length > 0) {
      filesWithIssues.push({ file, issues });
      totalIssues += issues.length;
    }
  });

  if (totalIssues === 0) {
    console.log('✅ No security issues found!\n');
    process.exit(0);
  }

  console.log(`⚠️  Found ${totalIssues} potential security issue(s):\n`);

  filesWithIssues.forEach(({ file, issues }) => {
    const relativePath = path.relative(process.cwd(), file);
    console.log(`📄 ${relativePath}`);
    issues.forEach(issue => {
      console.log(`   Line ${issue.line}: ${issue.message} (${issue.severity})`);
    });
    console.log('');
  });

  console.log('💡 Tips:');
  console.log('   - Always use .eq("business_id", profile.business_id) in queries');
  console.log('   - Consider using safeQuery() helper from src/lib/supabaseHelpers.ts');
  console.log('   - See SECURITY.md for more guidelines\n');

  process.exit(1);
}

main();

