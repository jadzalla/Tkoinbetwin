#!/usr/bin/env php
<?php
/**
 * BetWin - Tkoin Protocol Integration Test
 * 
 * This script tests the Platform API integration between BetWin and Tkoin Protocol
 * Run: php betwin-test-integration.php
 */

// ANSI color codes
const GREEN = "\033[32m";
const RED = "\033[31m";
const YELLOW = "\033[33m";
const BLUE = "\033[34m";
const RESET = "\033[0m";

echo BLUE . "🚀 BetWin - Tkoin Protocol Integration Test\n" . RESET;
echo "Testing from BetWin side (Laravel)\n\n";

// Configuration - Load from .env or hardcode for testing
$config = [
    'base_url' => 'https://1f1f76cb-d6d6-4e8e-b41b-5cb7e3d7fc0f-00-1icgdawm3o9xv.picard.replit.dev/api/platforms/platform_betwin',
    'api_token' => 'ptk_xNm2aoTy8AY1QcD-F9wTwMwdzyZjA97JS1h8wa1i_8A',
    'api_secret' => 'ab0d6715b594c415d4e354c03024ef6e',
    'platform_id' => 'platform_betwin',
];

// Test user ID
$testUserId = 'betwin_user_' . time();

echo YELLOW . "Test User ID: $testUserId\n\n" . RESET;

/**
 * Generate HMAC signature for Platform API
 */
function generateSignature(string $timestamp, string $body, string $secret): string
{
    $message = $timestamp . '.' . $body;
    return 'sha256=' . hash_hmac('sha256', $message, $secret);
}

/**
 * Make authenticated request to Tkoin Platform API
 */
function makeRequest(string $method, string $url, array $config, array $data = null): array
{
    $ch = curl_init();
    
    $timestamp = (string)time();
    $nonce = sprintf('%s-%d', uniqid(), rand(1000, 9999));
    $body = $data ? json_encode($data) : '';
    $signature = generateSignature($timestamp, $body, $config['api_secret']);
    
    $headers = [
        'Content-Type: application/json',
        'X-Platform-Token: ' . $config['api_token'],
        'X-Timestamp: ' . $timestamp,
        'X-Signature: ' . $signature,
        'X-Nonce: ' . $nonce,
    ];
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body,
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'status' => $httpCode,
        'body' => json_decode($response, true) ?? $response,
    ];
}

/**
 * Run a test
 */
function runTest(string $name, callable $test): void
{
    echo "\n" . str_repeat('=', 60) . "\n";
    echo "Test: $name\n";
    echo str_repeat('=', 60) . "\n";
    
    try {
        $test();
        echo GREEN . "✅ PASSED\n" . RESET;
    } catch (Exception $e) {
        echo RED . "❌ FAILED: {$e->getMessage()}\n" . RESET;
    }
}

// Start tests
$stats = ['passed' => 0, 'failed' => 0];

// Test 1: Check initial balance
runTest('Check initial balance', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/users/$testUserId/balance";
    $response = makeRequest('GET', $url, $config);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['status'] !== 200) {
        $stats['failed']++;
        throw new Exception("Expected 200, got {$response['status']}");
    }
    
    if ($response['body']['creditsBalance'] !== '0.00') {
        $stats['failed']++;
        throw new Exception("Expected 0.00 credits, got {$response['body']['creditsBalance']}");
    }
    
    $stats['passed']++;
});

// Test 2: Create deposit (100 credits = 1 TKOIN)
runTest('Create deposit: 1 TKOIN (100 credits)', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/deposits";
    $response = makeRequest('POST', $url, $config, [
        'userId' => $testUserId,
        'amount' => 1, // 1 TKOIN
        'method' => 'bank_transfer',
        'settlementId' => 'betwin_settle_' . time() . '_1',
    ]);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['status'] !== 200) {
        $stats['failed']++;
        throw new Exception("Expected 200, got {$response['status']}");
    }
    
    if ($response['body']['status'] !== 'completed') {
        $stats['failed']++;
        throw new Exception("Expected completed status, got {$response['body']['status']}");
    }
    
    $stats['passed']++;
});

// Test 3: Check balance after deposit
runTest('Check balance after deposit', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/users/$testUserId/balance";
    $response = makeRequest('GET', $url, $config);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['body']['creditsBalance'] !== '100.00') {
        $stats['failed']++;
        throw new Exception("Expected 100.00 credits, got {$response['body']['creditsBalance']}");
    }
    
    $stats['passed']++;
});

// Test 4: Create second deposit (50 credits = 0.5 TKOIN)
runTest('Create second deposit: 0.5 TKOIN (50 credits)', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/deposits";
    $response = makeRequest('POST', $url, $config, [
        'userId' => $testUserId,
        'amount' => 0.5, // 0.5 TKOIN
        'method' => 'credit_card',
        'settlementId' => 'betwin_settle_' . time() . '_2',
    ]);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['status'] !== 200) {
        $stats['failed']++;
        throw new Exception("Expected 200, got {$response['status']}");
    }
    
    $stats['passed']++;
});

// Test 5: Check balance after second deposit
runTest('Check balance after second deposit', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/users/$testUserId/balance";
    $response = makeRequest('GET', $url, $config);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['body']['creditsBalance'] !== '150.00') {
        $stats['failed']++;
        throw new Exception("Expected 150.00 credits, got {$response['body']['creditsBalance']}");
    }
    
    $stats['passed']++;
});

// Test 6: Create withdrawal (30 credits = 0.3 TKOIN)
runTest('Create withdrawal: 0.3 TKOIN (30 credits)', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/withdrawals";
    $response = makeRequest('POST', $url, $config, [
        'userId' => $testUserId,
        'amount' => 0.3, // 0.3 TKOIN
        'solanaWallet' => 'GJ8ZUGBD7UAtffi8eWjfqN63nCMhPgmDuH44YNRct3R6',
        'settlementId' => 'betwin_settle_' . time() . '_3',
    ]);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['status'] !== 200) {
        $stats['failed']++;
        throw new Exception("Expected 200, got {$response['status']}");
    }
    
    $stats['passed']++;
});

// Test 7: Check balance after withdrawal
runTest('Check balance after withdrawal', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/users/$testUserId/balance";
    $response = makeRequest('GET', $url, $config);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['body']['creditsBalance'] !== '120.00') {
        $stats['failed']++;
        throw new Exception("Expected 120.00 credits, got {$response['body']['creditsBalance']}");
    }
    
    $stats['passed']++;
});

// Test 8: Get transaction history
runTest('Get transaction history', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/users/$testUserId/transactions?limit=10";
    $response = makeRequest('GET', $url, $config);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['status'] !== 200) {
        $stats['failed']++;
        throw new Exception("Expected 200, got {$response['status']}");
    }
    
    $txCount = count($response['body']['transactions']);
    if ($txCount < 3) {
        $stats['failed']++;
        throw new Exception("Expected at least 3 transactions, got $txCount");
    }
    
    $stats['passed']++;
});

// Test 9: Test insufficient balance (should fail)
runTest('Test insufficient balance withdrawal', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/withdrawals";
    $response = makeRequest('POST', $url, $config, [
        'userId' => $testUserId,
        'amount' => 100, // 100 TKOIN (10,000 credits) - more than balance
        'solanaWallet' => 'GJ8ZUGBD7UAtffi8eWjfqN63nCMhPgmDuH44YNRct3R6',
        'settlementId' => 'betwin_settle_' . time() . '_4',
    ]);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['status'] === 200) {
        $stats['failed']++;
        throw new Exception("Expected error for insufficient balance, but got 200");
    }
    
    echo YELLOW . "Correctly rejected insufficient balance\n" . RESET;
    $stats['passed']++;
});

// Test 10: Withdrawal without Solana wallet (optional field)
runTest('Create withdrawal without Solana wallet', function() use ($config, $testUserId, &$stats) {
    $url = $config['base_url'] . "/withdrawals";
    $response = makeRequest('POST', $url, $config, [
        'userId' => $testUserId,
        'amount' => 0.1, // 0.1 TKOIN (10 credits)
        'settlementId' => 'betwin_settle_' . time() . '_5',
        // No solanaWallet - should default to p2p_marketplace
    ]);
    
    echo YELLOW . "Response: " . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n" . RESET;
    
    if ($response['status'] !== 200) {
        $stats['failed']++;
        throw new Exception("Expected 200, got {$response['status']}");
    }
    
    $stats['passed']++;
});

// Print summary
echo "\n" . str_repeat('=', 60) . "\n";
echo "TEST SUMMARY\n";
echo str_repeat('=', 60) . "\n";
echo "Total: " . ($stats['passed'] + $stats['failed']) . " | ";
echo GREEN . "Passed: {$stats['passed']}" . RESET . " | ";
echo RED . "Failed: {$stats['failed']}" . RESET . "\n\n";

if ($stats['failed'] === 0) {
    echo GREEN . "🎉 All tests passed! Integration is working perfectly!\n" . RESET;
    exit(0);
} else {
    echo RED . "⚠️  Some tests failed. Check the output above for details.\n" . RESET;
    exit(1);
}
