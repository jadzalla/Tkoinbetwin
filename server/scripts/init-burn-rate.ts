#!/usr/bin/env tsx
/**
 * Initialize burn_rate in system_config
 * 
 * This script sets the default burn rate to 1% (100 basis points)
 * Range: 0-2% (0-200 basis points)
 */

import { storage } from '../storage';

async function main() {
  console.log('🔥 Initializing burn_rate configuration...\n');

  try {
    // Set burn_rate to 1% (100 basis points)
    const config = await storage.setSystemConfig(
      'burn_rate',
      100, // 1% = 100 basis points
      'Burn rate applied to treasury deposits (0-200 basis points, representing 0-2%)',
      'system' // System initialization
    );

    console.log('✅ Burn rate configured successfully!');
    console.log('   Key:', config.key);
    console.log('   Value:', config.value, 'basis points (1%)');
    console.log('   Description:', config.description);
    console.log('');
    
    console.log('📋 Usage:');
    console.log('   - Agents purchasing inventory: 1% burned');
    console.log('   - Users depositing to play: 1% burned');
    console.log('   - Admins can adjust via /api/admin/config/burn_rate (0-200)');
    console.log('');
  } catch (error) {
    console.error('❌ Error initializing burn rate:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
