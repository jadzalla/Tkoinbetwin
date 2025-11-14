/**
 * Idempotent seed script to create platform_betwin
 * 
 * Usage: tsx server/scripts/seed-platform-betwin.ts
 * 
 * This script creates or updates the platform_betwin record in the database
 * using the TKOIN_WEBHOOK_SECRET environment variable. Safe to run multiple times.
 */

import { storage } from '../storage';

async function seedPlatformBetwin() {
  try {
    console.log('[Seed] Starting platform_betwin seed...');

    // Get webhook secret from environment
    const webhookSecret = process.env.TKOIN_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('[Seed] ERROR: TKOIN_WEBHOOK_SECRET environment variable not set');
      process.exit(1);
    }

    // Check if platform_betwin already exists
    const existing = await storage.getSovereignPlatform('platform_betwin');
    
    if (existing) {
      console.log('[Seed] platform_betwin already exists. Updating...');
      
      // Update existing platform
      const updated = await storage.updateSovereignPlatform('platform_betwin', {
        webhookSecret, // Update to current env var value
        isActive: true,
      });
      
      console.log('[Seed] ✓ platform_betwin updated successfully');
      console.log(`[Seed]   ID: ${updated.id}`);
      console.log(`[Seed]   Name: ${updated.name}`);
      console.log(`[Seed]   Active: ${updated.isActive}`);
      console.log(`[Seed]   Webhook URL: ${updated.webhookUrl || 'Not configured'}`);
      
      process.exit(0);
    }

    // Get webhook URL from system config (optional)
    const webhookUrlConfig = await storage.getSystemConfig('1stake_webhook_url');
    
    // Create platform_betwin
    const platform = await storage.createSovereignPlatform({
      id: 'platform_betwin',
      name: 'BetWin Casino',
      displayName: 'BetWin - Flagship Tkoin Platform',
      description: 'BetWin casino serves as the flagship application demonstrating Tkoin Protocol capabilities',
      webhookUrl: webhookUrlConfig?.value ? String(webhookUrlConfig.value) : null,
      webhookSecret,
      isActive: true,
      isPublic: true,
      contactEmail: 'support@betwin.casino',
      supportUrl: null,
      apiKey: null,
      rateLimit: 5000,
      metadata: { type: 'casino', flagship: true, legacy_id: '1stake' },
    });

    console.log('[Seed] ✓ platform_betwin created successfully');
    console.log(`[Seed]   ID: ${platform.id}`);
    console.log(`[Seed]   Name: ${platform.name}`);
    console.log(`[Seed]   Active: ${platform.isActive}`);
    console.log(`[Seed]   Webhook URL: ${platform.webhookUrl || 'Not configured'}`);
    console.log(`[Seed]   Public: ${platform.isPublic}`);
    
    process.exit(0);
  } catch (error) {
    console.error('[Seed] ERROR:', error);
    process.exit(1);
  }
}

// Run seed
seedPlatformBetwin();
