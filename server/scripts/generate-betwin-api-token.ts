/**
 * Generate Platform API Token for BetWin
 * 
 * This script creates a new API token for the platform_betwin platform.
 * Run with: tsx server/scripts/generate-betwin-api-token.ts
 */

import { storage } from '../storage';
import { generatePlatformApiToken } from '../utils/platform-auth';

async function main() {
  const platformId = 'platform_betwin';
  
  // Check if platform exists
  const platform = await storage.getSovereignPlatform(platformId);
  if (!platform) {
    console.error(`❌ Platform '${platformId}' not found`);
    console.log('\nRun: npm run db:seed to create the platform first');
    process.exit(1);
  }
  
  console.log(`\n🔐 Generating API Token for: ${platform.name}`);
  console.log(`Platform ID: ${platformId}`);
  
  // Generate new token
  const { token, tokenHash, maskedToken } = generatePlatformApiToken();
  
  // Store token in database
  const apiToken = await storage.createPlatformApiToken({
    platformId,
    tokenHash,
    maskedToken,
    isActive: true,
    expiresAt: null, // No expiration
    createdBy: 'system',
  });
  
  console.log('\n✅ API Token Generated Successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  SAVE THIS TOKEN - IT WILL NOT BE SHOWN AGAIN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Platform Token: ${token}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 Token Details:');
  console.log(`   Token ID: ${apiToken.id}`);
  console.log(`   Masked Token: ${maskedToken}`);
  console.log(`   Created: ${apiToken.createdAt.toISOString()}`);
  console.log(`   Status: ${apiToken.isActive ? 'Active' : 'Inactive'}`);
  console.log(`   Expires: ${apiToken.expiresAt || 'Never'}`);
  
  console.log('\n📝 Add to BetWin .env file:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`TKOIN_API_TOKEN=${token}`);
  console.log(`TKOIN_WEBHOOK_SECRET=${platform.webhookSecret}`);
  console.log(`TKOIN_API_BASE_URL=https://[your-replit-deployment].repl.co/api/platforms`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error generating API token:', error);
  process.exit(1);
});
