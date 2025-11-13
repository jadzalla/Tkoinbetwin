/**
 * Initialize webhook configuration in system_config table
 * 
 * Run this script to set up default webhook settings:
 * - 1stake_webhook_url: The webhook URL for the 1Stake casino platform
 * - webhook_enabled: Whether webhook delivery is enabled (0 = disabled, 1 = enabled)
 * - tkoin_credit_ratio: Conversion rate from Tkoin to gaming credits (default: 100, meaning 1 TKOIN = 100 Credits)
 * - max_retry_attempts: Maximum number of webhook delivery retry attempts (default: 3)
 * 
 * Usage:
 *   tsx server/scripts/init-webhook-config.ts
 */

import { storage } from '../storage';

async function initializeWebhookConfig() {
  try {
    console.log('🔧 Initializing webhook configuration...\n');

    // 1. Webhook URL (default empty, must be configured by admin)
    await storage.setSystemConfig(
      '1stake_webhook_url',
      '', // Default empty - admin must configure
      'Webhook URL for the 1Stake casino platform to receive credit notifications',
      'system' // System initialization
    );
    console.log('✅ Set 1stake_webhook_url (empty - requires configuration)');

    // 2. Webhook Enabled (default disabled for safety)
    await storage.setSystemConfig(
      'webhook_enabled',
      0, // Default disabled
      'Enable/disable webhook delivery (0 = disabled, 1 = enabled)',
      'system'
    );
    console.log('✅ Set webhook_enabled to 0 (disabled by default)');

    // 3. Tkoin to Credits Conversion Ratio
    await storage.setSystemConfig(
      'tkoin_credit_ratio',
      100, // Default: 1 TKOIN = 100 Credits
      'Conversion rate from Tkoin to gaming credits (default: 100, meaning 1 TKOIN = 100 Credits)',
      'system'
    );
    console.log('✅ Set tkoin_credit_ratio to 100 (1 TKOIN = 100 Credits)');

    // 4. Max Retry Attempts
    await storage.setSystemConfig(
      'max_retry_attempts',
      3, // Default: 3 retries
      'Maximum number of webhook delivery retry attempts before failing',
      'system'
    );
    console.log('✅ Set max_retry_attempts to 3');

    console.log('\n🎉 Webhook configuration initialized successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Configure 1stake_webhook_url in the admin panel');
    console.log('   2. Set TKOIN_WEBHOOK_SECRET environment variable');
    console.log('   3. Enable webhooks by setting webhook_enabled to 1');
    console.log('   4. Configure Solana environment variables to enable deposit monitoring:');
    console.log('      - SOLANA_RPC_URL');
    console.log('      - SOLANA_TREASURY_WALLET');
    console.log('      - SOLANA_TREASURY_PRIVATE_KEY');
    console.log('      - SOLANA_MINT_ADDRESS');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize webhook configuration:', error);
    process.exit(1);
  }
}

initializeWebhookConfig();
