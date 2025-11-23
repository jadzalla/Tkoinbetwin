#!/usr/bin/env php
<?php
/**
 * BetWin - Tkoin Quick Test
 * 
 * Quick test for deposit and withdrawal
 * Run: php betwin-quick-test.php [deposit|withdrawal]
 */

// Configuration
$config = [
    'base_url' => 'https://1f1f76cb-d6d6-4e8e-b41b-5cb7e3d7fc0f-00-1icgdawm3o9xv.picard.replit.dev/api/platforms/platform_betwin',
    'api_token' => 'ptk_xNm2aoTy8AY1QcD-F9wTwMwdzyZjA97JS1h8wa1i_8A',
    'api_secret' => 'ab0d6715b594c415d4e354c03024ef6e',
];

$testUserId = 'betwin_quicktest_' . time();

function generateSignature($timestamp, $body, $secret) {
    return 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $body, $secret);
}

function makeRequest($method, $url, $config, $data = null) {
    $ch = curl_init();
    $timestamp = (string)time();
    $nonce = uniqid() . '-' . rand(1000, 9999);
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

$action = $argv[1] ?? 'deposit';

echo "🚀 BetWin Quick Test - $action\n";
echo "Test User: $testUserId\n\n";

if ($action === 'deposit') {
    echo "Testing Deposit: 1 TKOIN (100 credits)\n";
    echo str_repeat('-', 50) . "\n";
    
    $url = $config['base_url'] . "/deposits";
    $response = makeRequest('POST', $url, $config, [
        'userId' => $testUserId,
        'amount' => 1,
        'method' => 'bank_transfer',
        'settlementId' => 'betwin_' . time(),
    ]);
    
    echo "Status: {$response['status']}\n";
    echo "Response:\n" . json_encode($response['body'], JSON_PRETTY_PRINT) . "\n";
    
    if ($response['status'] === 200) {
        echo "\n✅ Deposit successful!\n";
        
        // Check balance
        echo "\nChecking balance...\n";
        $balUrl = $config['base_url'] . "/users/$testUserId/balance";
        $balResponse = makeRequest('GET', $balUrl, $config);
        echo "Balance: {$balResponse['body']['creditsBalance']} credits\n";
    } else {
        echo "\n❌ Deposit failed!\n";
    }
    
} elseif ($action === 'withdrawal') {
    echo "Testing Withdrawal: 0.5 TKOIN (50 credits)\n";
    echo str_repeat('-', 50) . "\n";
    
    // First deposit 1 TKOIN
    echo "Step 1: Depositing 1 TKOIN first...\n";
    $depositUrl = $config['base_url'] . "/deposits";
    $depositResponse = makeRequest('POST', $depositUrl, $config, [
        'userId' => $testUserId,
        'amount' => 1,
        'method' => 'bank_transfer',
        'settlementId' => 'betwin_' . time() . '_deposit',
    ]);
    
    if ($depositResponse['status'] !== 200) {
        echo "❌ Deposit failed, cannot test withdrawal\n";
        exit(1);
    }
    echo "✅ Deposited 1 TKOIN (100 credits)\n\n";
    
    // Now withdraw
    echo "Step 2: Withdrawing 0.5 TKOIN (50 credits)...\n";
    $withdrawUrl = $config['base_url'] . "/withdrawals";
    $withdrawResponse = makeRequest('POST', $withdrawUrl, $config, [
        'userId' => $testUserId,
        'amount' => 0.5,
        'solanaWallet' => 'GJ8ZUGBD7UAtffi8eWjfqN63nCMhPgmDuH44YNRct3R6',
        'settlementId' => 'betwin_' . time() . '_withdrawal',
    ]);
    
    echo "Status: {$withdrawResponse['status']}\n";
    echo "Response:\n" . json_encode($withdrawResponse['body'], JSON_PRETTY_PRINT) . "\n";
    
    if ($withdrawResponse['status'] === 200) {
        echo "\n✅ Withdrawal successful!\n";
        
        // Check balance
        echo "\nChecking balance...\n";
        $balUrl = $config['base_url'] . "/users/$testUserId/balance";
        $balResponse = makeRequest('GET', $balUrl, $config);
        echo "Balance: {$balResponse['body']['creditsBalance']} credits\n";
    } else {
        echo "\n❌ Withdrawal failed!\n";
    }
    
} else {
    echo "Usage: php betwin-quick-test.php [deposit|withdrawal]\n";
    exit(1);
}
