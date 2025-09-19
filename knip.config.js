/**
 * Knip configuration for AI Video SaaS project
 * Optimized for Vite + React + TypeScript + Supabase architecture
 */
export default {
  // Project entry points
  entry: [
    'src/main.tsx',
    'vite.config.ts',
    'postcss.config.js',
    'playwright.config.ts',
    'src/test/**/*.ts',
    'src/test/**/*.tsx',
    'src/tools/**/*.ts',
    'supabase/functions/**/*.ts'
  ],

  // Entry points for projects (includes scripts and tools)
  project: [
    'scripts/**/*.js',
    'scripts/**/*.ts',
    'src/tools/**/*.ts',
    '*.mjs'
  ],

  // Ignore patterns - files to exclude from analysis
  ignore: [
    // Build outputs
    'build/**',
    'dist/**',
    'node_modules/**',
    
    // Test files and mock data
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    
    // Configuration files (keep them all for now)
    'vite.config.ts.backup',
    
    // Temporary and backup files
    '**/*.backup',
    '**/backups/**',
    '**/thumbnails_backup/**',
    
    // Development and debug files
    'test-*.html',
    'test-*.js',
    'test-*.mjs',
    'debug-*.js',
    'diagnose-*.js',
    
    // Documentation
    '**/*.md',
    
    // Environment and config
    '.env*',
    '**/*.example'
  ],

  // Dependencies to ignore (these are used but may not be detected)
  ignoreDependencies: [
    // Runtime dependencies that are used dynamically
    'vconsole',
    'gtag', 
    'dotenv',
    
    // Vite/build dependencies
    'terser',
    'autoprefixer',
    
    // CSS/styling dependencies
    'tw-animate-css',
    '@tailwindcss/postcss',
    
    // Development tools
    '@playwright/test',
    
    // Type-only dependencies
    '@types/ioredis',
    '@types/react-router-dom',
    '@types/react-window'
  ],

  // Ignore specific exports patterns
  ignoreExportsUsedInFile: true
}