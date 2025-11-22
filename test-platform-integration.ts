#!/usr/bin/env tsx
/**
 * Tkoin Protocol - Platform API Integration Test
 * This script tests the platform API endpoints from Tkoin's side
 */

import crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const PLATFORM_ID = 'platform_betwin';
const API_SECRET = 'ab0d6715b594c415d4e354c03024ef6e';
const PLATFORM_TOKEN = 'ptk_xNm2aoTy8AY1QcD-F9wTwMwdzyZjA97JS1h8wa1i_8A';

// Colors
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

interface TestResult {
  name: string;
  passed: boolean;
  response?: any;
  error?: string;
}

const results: TestResult[] = [];

function log(message: string, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function generateNonce(): string {
  return crypto.randomUUID();
}

function generateSignature(timestamp: number, body: string): string {
  const payload = `${timestamp}.${body}`;
  const hmac = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
  return `sha256=${hmac}`;
}

async function apiRequest(
  method: string,
  endpoint: string,
  body?: Record<string, any>
): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = `/api/platforms/${PLATFORM_ID}${endpoint}`;
  const bodyStr = body ? JSON.stringify(body) : '{}';
  const signature = generateSignature(timestamp, bodyStr);
  const nonce = generateNonce();

  const headers: Record<string, string> = {
    'X-Platform-Token': PLATFORM_TOKEN,
    'X-Timestamp': timestamp.toString(),
    'X-Signature': signature,
    'X-Nonce': nonce,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = bodyStr;
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  log(`\n${'='.repeat(60)}`, BLUE);
  log(`Test: ${name}`, BLUE);
  log('='.repeat(60), BLUE);

  try {
    await testFn();
    results.push({ name, passed: true });
    log(`✅ PASSED`, GREEN);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message });
    log(`❌ FAILED: ${error.message}`, RED);
  }
}

async function main() {
  log('\n🚀 Tkoin Protocol - Platform API Integration Tests', BLUE);
  log('Testing from Tkoin side\n', BLUE);

  const TEST_USER = `test_user_${Date.now()}`;
  log(`Test User ID: ${TEST_USER}\n`, YELLOW);

  // Test 1: Check initial balance (user doesn't exist)
  await runTest('Check initial balance (should create with 0)', async () => {
    const response = await apiRequest('GET', `/users/${TEST_USER}/balance`);
    log(`Response: ${JSON.stringify(response, null, 2)}`, YELLOW);
    
    if (response.creditsBalance !== '0.00') {
      throw new Error(`Expected 0.00, got ${response.creditsBalance}`);
    }
  });

  // Test 2: Create first deposit (1 TKOIN = 100 credits)
  await runTest('Create deposit: 1 TKOIN (100 credits)', async () => {
    const response = await apiRequest('POST', '/deposits', {
      userId: TEST_USER,
      amount: 1, // 1 TKOIN
      method: 'bank_transfer',
      settlementId: `settle_${Date.now()}_1`,
    });
    log(`Response: ${JSON.stringify(response, null, 2)}`, YELLOW);

    if (response.creditsAmount !== '100.00') {
      throw new Error(`Expected 100.00, got ${response.creditsAmount}`);
    }
    if (response.tkoinAmount !== '1.00000000') {
      throw new Error(`Expected 1.00000000 TKOIN, got ${response.tkoinAmount}`);
    }
    if (response.status !== 'completed') {
      throw new Error(`Expected completed, got ${response.status}`);
    }
  });

  // Test 3: Check balance after deposit
  await runTest('Check balance after deposit', async () => {
    const response = await apiRequest('GET', `/users/${TEST_USER}/balance`);
    log(`Response: ${JSON.stringify(response, null, 2)}`, YELLOW);

    if (response.creditsBalance !== '100.00') {
      throw new Error(`Expected 100.00, got ${response.creditsBalance}`);
    }
  });

  // Test 4: Create second deposit (0.5 TKOIN = 50 credits)
  await runTest('Create second deposit: 0.5 TKOIN (50 credits)', async () => {
    const response = await apiRequest('POST', '/deposits', {
      userId: TEST_USER,
      amount: 0.5, // 0.5 TKOIN
      method: 'credit_card',
      settlementId: `settle_${Date.now()}_2`,
    });
    log(`Response: ${JSON.stringify(response, null, 2)}`, YELLOW);

    if (response.creditsAmount !== '50.00') {
      throw new Error(`Expected 50.00, got ${response.creditsAmount}`);
    }
  });

  // Test 5: Check balance (should be 150)
  await runTest('Check balance after second deposit', async () => {
    const response = await apiRequest('GET', `/users/${TEST_USER}/balance`);
    log(`Response: ${JSON.stringify(response, null, 2)}`, YELLOW);

    if (response.creditsBalance !== '150.00') {
      throw new Error(`Expected 150.00, got ${response.creditsBalance}`);
    }
  });

  // Test 6: Create withdrawal (0.3 TKOIN = 30 credits)
  await runTest('Create withdrawal: 0.3 TKOIN (30 credits)', async () => {
    const response = await apiRequest('POST', '/withdrawals', {
      userId: TEST_USER,
      amount: 0.3, // 0.3 TKOIN
      solanaWallet: 'GJ8ZUGBD7UAtffi8eWjfqN63nCMhPgmDuH44YNRct3R6',
      settlementId: `settle_${Date.now()}_3`,
    });
    log(`Response: ${JSON.stringify(response, null, 2)}`, YELLOW);

    if (response.creditsAmount !== '30.00') {
      throw new Error(`Expected 30.00, got ${response.creditsAmount}`);
    }
    if (response.status !== 'completed') {
      throw new Error(`Expected completed, got ${response.status}`);
    }
  });

  // Test 7: Check balance (should be 120)
  await runTest('Check balance after withdrawal', async () => {
    const response = await apiRequest('GET', `/users/${TEST_USER}/balance`);
    log(`Response: ${JSON.stringify(response, null, 2)}`, YELLOW);

    if (response.creditsBalance !== '120.00') {
      throw new Error(`Expected 120.00, got ${response.creditsBalance}`);
    }
  });

  // Test 8: Get transaction history
  await runTest('Get transaction history', async () => {
    const response = await apiRequest('GET', `/users/${TEST_USER}/transactions`);
    log(`Response: ${JSON.stringify(response, null, 2)}`, YELLOW);

    if (!Array.isArray(response)) {
      throw new Error('Expected array response');
    }
    if (response.length !== 4) {
      throw new Error(`Expected 4 transactions, got ${response.length}`);
    }
  });

  // Test 9: Test insufficient balance
  await runTest('Test insufficient balance (should fail)', async () => {
    try {
      await apiRequest('POST', '/withdrawals', {
        userId: TEST_USER,
        amount: 5, // 5 TKOIN (500 credits) - more than balance
        solanaWallet: 'GJ8ZUGBD7UAtffi8eWjfqN63nCMhPgmDuH44YNRct3R6',
        settlementId: `settle_${Date.now()}_4`,
      });
      throw new Error('Should have failed with insufficient balance');
    } catch (error: any) {
      if (!error.message.includes('Insufficient balance')) {
        throw error;
      }
      log('Correctly rejected insufficient balance', YELLOW);
    }
  });

  // Test 10: Test withdrawal without optional solanaWallet (edge case)
  await runTest('Create withdrawal without optional solanaWallet', async () => {
    const response = await apiRequest('POST', '/withdrawals', {
      userId: TEST_USER,
      amount: 0.1, // 0.1 TKOIN (10 credits)
      settlementId: `settle_${Date.now()}_5`,
      // No solanaWallet - testing edge case
    });
    log(`Response: ${JSON.stringify(response, null, 2)}`, YELLOW);

    if (response.creditsAmount !== '10.00') {
      throw new Error(`Expected 10.00, got ${response.creditsAmount}`);
    }
  });

  // Summary
  log('\n' + '='.repeat(60), BLUE);
  log('TEST SUMMARY', BLUE);
  log('='.repeat(60), BLUE);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? GREEN : RED;
    log(`${icon} ${result.name}`, color);
    if (result.error) {
      log(`   Error: ${result.error}`, RED);
    }
  });

  log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`, BLUE);
  
  if (failed === 0) {
    log('\n🎉 All tests passed!', GREEN);
    log(`Final balance for ${TEST_USER}: 110.00 credits (1.10 TKOIN)`, YELLOW);
  } else {
    log('\n⚠️  Some tests failed', RED);
    process.exit(1);
  }
}

main().catch(console.error);
