@extends('layouts.app')

@section('title', 'TKOIN Wallet')

@section('content')
<div class="container mx-auto px-4 py-8">
    <div class="max-w-6xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">TKOIN Wallet</h1>
        
        <!-- Balance Card -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-gray-600 dark:text-gray-400 text-sm">Available Balance</p>
                    <p class="text-4xl font-bold text-purple-600 dark:text-purple-400" id="balance-display">
                        {{ number_format($balance['credits_balance'] ?? 0, 2) }} Credits
                    </p>
                    <p class="text-sm text-gray-500 mt-1">
                        ≈ {{ number_format(($balance['credits_balance'] ?? 0) / 100, 2) }} TKOIN
                    </p>
                </div>
                <div class="text-right">
                    <button onclick="refreshBalance()" class="text-purple-600 hover:text-purple-700 text-sm">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
        </div>

        <!-- Tabs -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div class="border-b border-gray-200 dark:border-gray-700">
                <nav class="flex -mb-px">
                    <button class="tab-btn active" data-tab="deposit">
                        <i class="fas fa-arrow-down mr-2"></i>Deposit
                    </button>
                    <button class="tab-btn" data-tab="withdraw">
                        <i class="fas fa-arrow-up mr-2"></i>Withdraw
                    </button>
                    <button class="tab-btn" data-tab="p2p">
                        <i class="fas fa-users mr-2"></i>P2P Marketplace
                    </button>
                    <button class="tab-btn" data-tab="history">
                        <i class="fas fa-history mr-2"></i>History
                    </button>
                </nav>
            </div>

            <!-- Deposit Tab -->
            <div class="tab-content active" id="deposit-tab">
                <div class="p-6">
                    <h2 class="text-2xl font-semibold mb-4">Deposit TKOIN</h2>
                    
                    <!-- Phantom Wallet Deposit -->
                    <div class="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 rounded-lg p-6 mb-6">
                        <div class="flex items-center mb-4">
                            <img src="https://phantom.app/img/phantom-logo.png" alt="Phantom" class="h-8 w-8 mr-3">
                            <h3 class="text-xl font-semibold">Direct Deposit from Phantom Wallet</h3>
                        </div>
                        
                        <p class="text-gray-700 dark:text-gray-300 mb-4">
                            Connect your Phantom wallet and send TKOIN directly to receive instant credits.
                            <strong>1 TKOIN = 100 Credits</strong> ({{ config('services.tkoin.burn_rate', 1) }}% burn applied)
                        </p>

                        <!-- Wallet Connection Status -->
                        <div id="wallet-connection-status" class="mb-4" style="display: none;">
                            <div class="flex items-center text-green-600 dark:text-green-400">
                                <i class="fas fa-check-circle mr-2"></i>
                                <span>Connected: <span id="wallet-address-display" class="font-mono"></span></span>
                            </div>
                        </div>

                        <!-- Amount Input -->
                        <div class="mb-4">
                            <label for="deposit-amount-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Amount (TKOIN)
                            </label>
                            <div class="relative">
                                <input 
                                    type="number" 
                                    id="deposit-amount-input"
                                    class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white" 
                                    placeholder="Enter amount (min: 10 TKOIN)"
                                    min="10"
                                    step="0.01"
                                    disabled
                                >
                                <div class="absolute right-3 top-3 text-gray-500">
                                    <span class="font-semibold">TKOIN</span>
                                </div>
                            </div>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                You'll receive approximately <span id="credits-preview" class="font-semibold text-purple-600">0</span> credits
                            </p>
                        </div>

                        <!-- Status Message -->
                        <div id="phantom-status-text" class="phantom-status info mb-4">
                            Checking for Phantom wallet...
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex gap-3">
                            <button 
                                id="connect-phantom-btn"
                                class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <i class="fas fa-wallet mr-2"></i>Connect Phantom Wallet
                            </button>
                            
                            <button 
                                id="deposit-phantom-btn"
                                class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style="display: none;"
                            >
                                <i class="fas fa-arrow-down mr-2"></i>Deposit Now
                            </button>
                        </div>
                    </div>

                    <!-- Info Box -->
                    <div class="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                        <h4 class="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                            <i class="fas fa-info-circle mr-2"></i>How it works:
                        </h4>
                        <ol class="list-decimal list-inside text-blue-700 dark:text-blue-300 space-y-1 text-sm">
                            <li>Connect your Phantom wallet (one-time setup)</li>
                            <li>Enter the amount of TKOIN you want to deposit</li>
                            <li>Approve the transaction in Phantom wallet</li>
                            <li>Credits are added to your BetWin account instantly!</li>
                        </ol>
                    </div>
                </div>
            </div>

            <!-- Withdraw Tab -->
            <div class="tab-content" id="withdraw-tab">
                <div class="p-6">
                    <h2 class="text-2xl font-semibold mb-4">Withdraw to TKOIN</h2>
                    
                    <div class="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
                        <p class="text-yellow-800 dark:text-yellow-200">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            <strong>Two-Step Process:</strong> First convert credits to TKOIN, then optionally sell TKOIN for fiat on the P2P marketplace.
                        </p>
                    </div>

                    <form id="withdraw-form" class="max-w-md">
                        <div class="mb-4">
                            <label for="withdraw-amount" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Credits to Withdraw
                            </label>
                            <input 
                                type="number" 
                                id="withdraw-amount"
                                class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white" 
                                placeholder="Enter amount (min: 100)"
                                min="100"
                                step="1"
                            >
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                ≈ <span id="tkoin-preview" class="font-semibold">0</span> TKOIN
                            </p>
                        </div>

                        <div class="mb-6">
                            <label for="destination-wallet" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Destination Wallet Address
                            </label>
                            <input 
                                type="text" 
                                id="destination-wallet"
                                class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white font-mono text-sm" 
                                placeholder="Your Solana wallet address"
                            >
                        </div>

                        <button 
                            type="submit"
                            class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <i class="fas fa-arrow-up mr-2"></i>Withdraw to TKOIN
                        </button>
                    </form>
                </div>
            </div>

            <!-- P2P Marketplace Tab -->
            <div class="tab-content" id="p2p-tab">
                <div class="p-6">
                    <h2 class="text-2xl font-semibold mb-4">P2P Marketplace</h2>
                    
                    <div class="text-center py-8">
                        <i class="fas fa-users text-6xl text-purple-500 mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Buy or Sell TKOIN</h3>
                        <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            Trade TKOIN with trusted agents using your preferred payment method 
                            (Bank Transfer, PayPal, M-Pesa, and more).
                        </p>
                        <a 
                            href="{{ config('services.tkoin.marketplace_url', $tkoinApiBase . '/marketplace') }}"
                            target="_blank"
                            class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
                        >
                            <i class="fas fa-external-link-alt mr-2"></i>Open P2P Marketplace
                        </a>
                    </div>
                </div>
            </div>

            <!-- History Tab -->
            <div class="tab-content" id="history-tab">
                <div class="p-6">
                    <h2 class="text-2xl font-semibold mb-4">Transaction History</h2>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                                @forelse($transactions ?? [] as $tx)
                                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td class="px-4 py-3 text-sm">{{ $tx->created_at->format('M d, Y H:i') }}</td>
                                    <td class="px-4 py-3 text-sm">
                                        <span class="capitalize">{{ $tx->type }}</span>
                                    </td>
                                    <td class="px-4 py-3 text-sm font-semibold">
                                        {{ number_format($tx->credits_amount, 2) }} Credits
                                    </td>
                                    <td class="px-4 py-3 text-sm">
                                        <span class="px-2 py-1 rounded-full text-xs font-semibold
                                            {{ $tx->status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800' }}">
                                            {{ ucfirst($tx->status) }}
                                        </span>
                                    </td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                                        No transactions yet
                                    </td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Hidden config for JavaScript -->
<script>
    window.TKOIN_API_BASE = '{{ config("services.tkoin.api_base") }}';
    window.TKOIN_TREASURY_WALLET = '{{ $treasuryWallet }}';
    window.TKOIN_MINT_ADDRESS = '{{ $tkoinMint }}';
    window.BETWIN_USER_ID = '{{ auth()->user()->id }}';
</script>

<!-- Solana Web3.js CDN -->
<script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>

<!-- Phantom Deposit Integration -->
<script src="{{ asset('js/phantom-deposit.js') }}"></script>

<!-- Tab Switching -->
<script>
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        
        // Remove active class from all tabs and buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        this.classList.add('active');
        document.getElementById(tabName + '-tab').classList.add('active');
    });
});

// Credits preview calculation
document.getElementById('deposit-amount-input')?.addEventListener('input', function() {
    const amount = parseFloat(this.value) || 0;
    const burnRate = {{ config('services.tkoin.burn_rate', 1) }} / 100;
    const netAmount = amount * (1 - burnRate);
    const credits = netAmount * 100; // 1 TKOIN = 100 Credits
    document.getElementById('credits-preview').textContent = credits.toFixed(2);
});

// TKOIN preview calculation
document.getElementById('withdraw-amount')?.addEventListener('input', function() {
    const credits = parseFloat(this.value) || 0;
    const tkoin = credits / 100; // 100 Credits = 1 TKOIN
    document.getElementById('tkoin-preview').textContent = tkoin.toFixed(2);
});

// Refresh balance
function refreshBalance() {
    location.reload();
}

// Withdraw form submission
document.getElementById('withdraw-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const creditsAmount = document.getElementById('withdraw-amount').value;
    const destinationWallet = document.getElementById('destination-wallet').value;
    
    if (!creditsAmount || !destinationWallet) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/tkoin/withdraw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                credits_amount: creditsAmount,
                destination_wallet: destinationWallet
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            location.reload();
        } else {
            alert('Withdrawal failed: ' + data.error);
        }
    } catch (error) {
        alert('An error occurred. Please try again.');
        console.error(error);
    }
});
</script>

<style>
.tab-btn {
    padding: 1rem 1.5rem;
    border-bottom: 2px solid transparent;
    font-weight: 500;
    color: #6B7280;
    transition: all 0.2s;
}

.tab-btn:hover {
    color: #9333EA;
}

.tab-btn.active {
    color: #9333EA;
    border-bottom-color: #9333EA;
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}

.phantom-status {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
}

.phantom-status.info {
    background-color: #DBEAFE;
    color: #1E40AF;
}

.phantom-status.success {
    background-color: #D1FAE5;
    color: #065F46;
}

.phantom-status.error {
    background-color: #FEE2E2;
    color: #991B1B;
}

.phantom-status.loading {
    background-color: #FEF3C7;
    color: #92400E;
}
</style>
@endsection
