{{-- BetWin Tkoin Wallet - FIXED VERSION v4 --}}
{{-- Place in: resources/views/frontend/user/tkoin-wallet.blade.php --}}
{{-- 
  FIXES:
  ✅ Solana web3.js library included
  ✅ Disconnect wallet button
  ✅ Correct element IDs for JavaScript
  ✅ Dark BetWin theme
  ✅ Proper deposit flow with blockchain transaction
--}}

@extends('frontend.layouts.user')

@section('content')
<div class="tkoin-wallet-page">
    <div class="container py-4">
        <div id="tkoin-wallet" class="tkoin-wallet-container">
            
            {{-- Wallet Header --}}
            <div class="wallet-header">
                <div class="wallet-title">
                    <i class="fa fa-coins text-warning"></i>
                    <h2>Tkoin Wallet</h2>
                    <span class="subtitle">Manage your TKOIN and Credits</span>
                </div>
                <div class="wallet-connection">
                    <span id="walletAddress" class="wallet-address" style="display: none;"></span>
                    <span id="walletStatus" class="badge bg-secondary">Not Connected</span>
                </div>
            </div>

            {{-- Balance Cards Row --}}
            <div class="balance-row">
                {{-- Credit Balance Card --}}
                <div class="balance-card credit-card">
                    <div class="balance-header">
                        <span class="balance-label">BALANCE</span>
                        <span class="account-info" id="accountId">Account ID: {{ auth()->id() }}</span>
                    </div>
                    <div class="balance-amount" id="creditBalance">
                        {{ number_format($balance['credits'] ?? 0, 2) }} CREDIT
                    </div>
                    <div class="balance-actions">
                        <button type="button" class="btn btn-success btn-deposit" data-bs-toggle="modal" data-bs-target="#depositModal">
                            <i class="fa fa-arrow-down"></i> DEPOSIT
                        </button>
                        <button type="button" class="btn btn-danger btn-withdraw" data-bs-toggle="modal" data-bs-target="#withdrawModal">
                            <i class="fa fa-arrow-up"></i> WITHDRAW
                        </button>
                        <button type="button" class="btn btn-secondary btn-refresh" id="refreshBtn">
                            <i class="fa fa-sync-alt"></i> REFRESH
                        </button>
                    </div>
                </div>
            </div>

            {{-- Wallet Connection Section --}}
            <div class="wallet-connect-section">
                <button type="button" class="btn btn-phantom" id="connectWalletBtn">
                    <i class="fa fa-wallet"></i> CONNECT PHANTOM WALLET
                </button>
                <button type="button" class="btn btn-outline-danger" id="disconnectWalletBtn" style="display: none;">
                    <i class="fa fa-unlink"></i> Disconnect Wallet
                </button>
            </div>

            {{-- Transaction History --}}
            <div class="transaction-section">
                <h3 class="section-title">
                    <i class="fa fa-history"></i> Transaction History
                </h3>
                <div class="transaction-table-wrapper">
                    <table class="table transaction-table">
                        <thead>
                            <tr>
                                <th>TYPE</th>
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                                <th>DATE</th>
                            </tr>
                        </thead>
                        <tbody id="transactionHistory">
                            @forelse($transactions ?? [] as $tx)
                            <tr>
                                <td class="tx-type {{ strtolower($tx['type'] ?? '') }}">
                                    {{ strtoupper($tx['type'] ?? 'N/A') }}
                                </td>
                                <td class="tx-amount">
                                    {{ number_format($tx['amount'] ?? 0, 2) }} CREDIT
                                </td>
                                <td>
                                    <span class="badge status-{{ strtolower($tx['status'] ?? 'pending') }}">
                                        {{ strtoupper($tx['status'] ?? 'PENDING') }}
                                    </span>
                                </td>
                                <td class="tx-date">
                                    {{ isset($tx['created_at']) ? \Carbon\Carbon::parse($tx['created_at'])->format('M d, Y') : 'N/A' }}
                                </td>
                            </tr>
                            @empty
                            <tr>
                                <td colspan="4" class="text-center text-muted py-4">
                                    <i class="fa fa-inbox fa-2x mb-2 d-block"></i>
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

{{-- ============== DEPOSIT MODAL ============== --}}
<div class="modal fade" id="depositModal" tabindex="-1" aria-labelledby="depositModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark text-white">
            <div class="modal-header border-secondary">
                <h5 class="modal-title" id="depositModalLabel">
                    <i class="fa fa-arrow-down text-success"></i> Deposit Tkoin
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form id="depositForm">
                <div class="modal-body">
                    {{-- Amount Input --}}
                    <div class="mb-3">
                        <label for="depositAmount" class="form-label">Amount (CREDIT)</label>
                        <input type="number" 
                               class="form-control form-control-lg bg-secondary text-white border-0" 
                               id="depositAmount" 
                               name="amount" 
                               min="1" 
                               step="0.01" 
                               required 
                               placeholder="100">
                        <div class="form-text text-muted">
                            Minimum: 1 CREDIT &bull; <strong>100 CREDIT = 1 TKOIN</strong>
                        </div>
                    </div>

                    {{-- How It Works --}}
                    <div class="alert alert-info bg-info bg-opacity-25 border-info">
                        <strong><i class="fa fa-info-circle"></i> How it works:</strong>
                        <ol class="mb-0 mt-2 ps-3">
                            <li>Enter the amount in CREDIT</li>
                            <li>Click <strong>"Send TKOIN"</strong> to open Phantom</li>
                            <li>Approve the TKOIN transfer in Phantom</li>
                            <li>Credits are added automatically after confirmation</li>
                        </ol>
                    </div>

                    {{-- Wallet Required Notice --}}
                    <div class="alert alert-warning bg-warning bg-opacity-25 border-warning" id="walletRequiredNotice">
                        <i class="fa fa-exclamation-triangle"></i>
                        <strong>Phantom wallet required!</strong> 
                        Please connect your wallet before depositing.
                    </div>

                    {{-- Error Display --}}
                    <div id="depositError" class="alert alert-danger" role="alert" style="display: none;"></div>
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-success btn-lg" id="depositSubmit">
                        <span id="depositSpinner" class="spinner-border spinner-border-sm me-2" role="status" style="display: none;"></span>
                        <span id="depositSubmitText"><i class="fa fa-paper-plane"></i> Send TKOIN</span>
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

{{-- ============== WITHDRAW MODAL ============== --}}
<div class="modal fade" id="withdrawModal" tabindex="-1" aria-labelledby="withdrawModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark text-white">
            <div class="modal-header border-secondary">
                <h5 class="modal-title" id="withdrawModalLabel">
                    <i class="fa fa-arrow-up text-danger"></i> Withdraw to TKOIN
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form id="withdrawForm">
                <div class="modal-body">
                    {{-- Amount Input --}}
                    <div class="mb-3">
                        <label for="withdrawAmount" class="form-label">Amount (CREDIT)</label>
                        <input type="number" 
                               class="form-control form-control-lg bg-secondary text-white border-0" 
                               id="withdrawAmount" 
                               name="credits_amount" 
                               min="100" 
                               step="1" 
                               required 
                               placeholder="100">
                        <div class="form-text text-muted">
                            Minimum: 100 CREDIT &bull; <strong>100 CREDIT = 1 TKOIN</strong>
                        </div>
                    </div>

                    {{-- Wallet Address --}}
                    <div class="mb-3">
                        <label for="withdrawWallet" class="form-label">Destination Wallet</label>
                        <input type="text" 
                               class="form-control bg-secondary text-white border-0" 
                               id="withdrawWallet" 
                               name="destination_wallet" 
                               placeholder="Your Solana wallet address"
                               minlength="32"
                               maxlength="64">
                        <div class="form-text text-muted">
                            Leave blank to use your connected Phantom wallet
                        </div>
                    </div>

                    {{-- Info --}}
                    <div class="alert alert-info bg-info bg-opacity-25 border-info">
                        <strong><i class="fa fa-info-circle"></i> Processing Time:</strong>
                        Withdrawals are typically processed within 5-30 minutes.
                    </div>

                    {{-- Error Display --}}
                    <div id="withdrawError" class="alert alert-danger" role="alert" style="display: none;"></div>
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-danger btn-lg" id="withdrawSubmit">
                        <span id="withdrawSpinner" class="spinner-border spinner-border-sm me-2" role="status" style="display: none;"></span>
                        <span id="withdrawSubmitText"><i class="fa fa-arrow-up"></i> Withdraw</span>
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

{{-- ============== STYLES ============== --}}
<style>
.tkoin-wallet-page {
    background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
    min-height: 100vh;
    padding: 20px 0;
}

.tkoin-wallet-container {
    max-width: 900px;
    margin: 0 auto;
}

/* Header */
.wallet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding: 20px;
    background: rgba(255,255,255,0.05);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
}

.wallet-title {
    display: flex;
    align-items: center;
    gap: 15px;
}

.wallet-title h2 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #fff;
}

.wallet-title .subtitle {
    color: rgba(255,255,255,0.6);
    font-size: 14px;
}

.wallet-title i {
    font-size: 32px;
}

.wallet-connection {
    display: flex;
    align-items: center;
    gap: 10px;
}

.wallet-address {
    font-family: monospace;
    background: rgba(102, 126, 234, 0.2);
    padding: 6px 12px;
    border-radius: 6px;
    color: #667eea;
    font-size: 13px;
}

/* Balance Card */
.balance-row {
    margin-bottom: 25px;
}

.balance-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    padding: 30px;
    color: white;
    box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
}

.balance-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.balance-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    opacity: 0.8;
}

.account-info {
    font-size: 12px;
    opacity: 0.7;
}

.balance-amount {
    font-size: 48px;
    font-weight: 800;
    margin-bottom: 25px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

.balance-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.balance-actions .btn {
    flex: 1;
    min-width: 120px;
    padding: 12px 20px;
    font-weight: 600;
    border-radius: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.btn-deposit {
    background: #28a745 !important;
    border: none !important;
}

.btn-withdraw {
    background: #dc3545 !important;
    border: none !important;
}

.btn-refresh {
    background: rgba(255,255,255,0.2) !important;
    border: 1px solid rgba(255,255,255,0.3) !important;
}

/* Wallet Connect Section */
.wallet-connect-section {
    display: flex;
    gap: 12px;
    margin-bottom: 30px;
    flex-wrap: wrap;
}

.btn-phantom {
    background: linear-gradient(135deg, #ab9ff2 0%, #9945FF 100%);
    color: white;
    border: none;
    padding: 15px 30px;
    font-weight: 600;
    border-radius: 10px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all 0.3s ease;
}

.btn-phantom:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(153, 69, 255, 0.4);
    color: white;
}

#disconnectWalletBtn {
    padding: 15px 25px;
    font-weight: 600;
    border-radius: 10px;
}

/* Transaction Section */
.transaction-section {
    background: rgba(255,255,255,0.05);
    border-radius: 12px;
    padding: 25px;
    border: 1px solid rgba(255,255,255,0.1);
}

.section-title {
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.section-title i {
    color: #667eea;
}

.transaction-table-wrapper {
    overflow-x: auto;
}

.transaction-table {
    color: #fff;
    margin: 0;
}

.transaction-table thead th {
    background: rgba(0,0,0,0.2);
    color: rgba(255,255,255,0.7);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 12px 15px;
    border: none;
}

.transaction-table tbody td {
    padding: 15px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    vertical-align: middle;
}

.tx-type {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 12px;
}

.tx-type.deposit {
    color: #28a745;
}

.tx-type.withdrawal {
    color: #dc3545;
}

.tx-amount {
    font-weight: 600;
    font-size: 14px;
}

.tx-date {
    color: rgba(255,255,255,0.6);
    font-size: 13px;
}

/* Status Badges */
.status-completed {
    background: #28a745;
    color: white;
}

.status-processing, .status-pending {
    background: #ffc107;
    color: #000;
}

.status-failed, .status-cancelled {
    background: #dc3545;
    color: white;
}

/* Modal Styling */
.modal-content.bg-dark {
    background: #1a1a2e !important;
    border: 1px solid rgba(255,255,255,0.1);
}

.modal-header.border-secondary {
    border-color: rgba(255,255,255,0.1) !important;
}

.modal-footer.border-secondary {
    border-color: rgba(255,255,255,0.1) !important;
}

/* Wallet Required Notice - Hidden when connected */
.wallet-connected #walletRequiredNotice {
    display: none;
}

/* Responsive */
@media (max-width: 768px) {
    .wallet-header {
        flex-direction: column;
        gap: 15px;
        text-align: center;
    }
    
    .wallet-title {
        flex-direction: column;
    }
    
    .balance-amount {
        font-size: 36px;
    }
    
    .balance-actions {
        flex-direction: column;
    }
    
    .balance-actions .btn {
        width: 100%;
    }
    
    .wallet-connect-section {
        flex-direction: column;
    }
    
    .wallet-connect-section .btn {
        width: 100%;
    }
}
</style>
@endsection

@push('scripts')
{{-- CRITICAL: Buffer polyfill - required for Solana transactions --}}
<script>
// Inline Buffer polyfill to avoid CDN blocking by tracking prevention
if (typeof window.Buffer === 'undefined') {
    // Minimal Buffer implementation for Solana web3.js
    window.Buffer = {
        from: function(data, encoding) {
            if (typeof data === 'string') {
                if (encoding === 'base64') {
                    const binary = atob(data);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    return bytes;
                }
                return new TextEncoder().encode(data);
            }
            if (Array.isArray(data) || data instanceof Uint8Array) {
                return new Uint8Array(data);
            }
            return new Uint8Array(0);
        },
        alloc: function(size) {
            return new Uint8Array(size);
        },
        isBuffer: function(obj) {
            return obj instanceof Uint8Array;
        },
        concat: function(arrays) {
            const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const arr of arrays) {
                result.set(arr, offset);
                offset += arr.length;
            }
            return result;
        }
    };
    console.log('[Tkoin] Buffer polyfill initialized');
}
</script>

{{-- IMPORTANT: Solana Web3.js - MUST be loaded AFTER Buffer polyfill --}}
<script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>

{{-- Tkoin Wallet JavaScript - FIXED VERSION --}}
<script src="{{ asset('js/tkoin-wallet.js') }}?v={{ time() }}"></script>

<script>
// Update wallet required notice based on connection status
document.addEventListener('DOMContentLoaded', function() {
    // Hide wallet notice when wallet is connected
    const observer = new MutationObserver(function(mutations) {
        const walletStatus = document.getElementById('walletStatus');
        const notice = document.getElementById('walletRequiredNotice');
        if (walletStatus && notice) {
            if (walletStatus.classList.contains('bg-success')) {
                notice.style.display = 'none';
                document.body.classList.add('wallet-connected');
            } else {
                notice.style.display = 'block';
                document.body.classList.remove('wallet-connected');
            }
        }
    });
    
    const walletStatus = document.getElementById('walletStatus');
    if (walletStatus) {
        observer.observe(walletStatus, { attributes: true, attributeFilter: ['class'] });
    }
});
</script>
@endpush
