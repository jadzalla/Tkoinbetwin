import crypto from 'crypto';
import { db } from './server/db/index.js';
import { platformApiTokens } from './shared/schema.js';

// Generate a new token
function generatePlatformApiToken(): {
  token: string;
  tokenHash: string;
  maskedToken: string;
} {
  const randomBytes = crypto.randomBytes(32);
  const token = `ptk_${randomBytes.toString('base64url')}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const maskedToken = `${token.slice(0, 8)}...${token.slice(-8)}`;
  
  return { token, tokenHash, maskedToken };
}

async function main() {
  const { token, tokenHash, maskedToken } = generatePlatformApiToken();
  
  // Insert into database
  await db.insert(platformApiTokens).values({
    platformId: 'platform_betwin',
    tokenHash,
    maskedToken,
    isActive: true,
    createdBy: 'system_test',
  });
  
  console.log('✅ New platform API token generated');
  console.log(`Token: ${token}`);
  console.log(`Masked: ${maskedToken}`);
  console.log(`\nAdd this to your test script:`);
  console.log(`const PLATFORM_TOKEN = '${token}';`);
  
  process.exit(0);
}

main().catch(console.error);
