<!-- BetWin Tkoin Wallet - FIXED VERSION v6 -->
<!-- Place in: resources/views/user/tkoin-wallet.blade.php -->
<!-- 
  FIXES:
  ✅ Standalone HTML (no @extends - matches your system)
  ✅ Inline Buffer polyfill (prevents CDN blocking)
  ✅ Solana web3.js included
  ✅ Disconnect wallet button
  ✅ Dark BetWin theme
  ✅ Proper deposit flow with blockchain transaction
  ✅ Withdrawal flow with on-chain transfer
-->

<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="icon" type="image/png" href="/images/favicon/favicon.png">
  <link rel="shortcut icon" type="image/png" href="/images/favicon/favicon.png">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <title>Tkoin Wallet - BetWin</title>
  
  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

  <style>
    body {
      background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
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

    .wallet-header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .wallet-status .badge {
      font-size: 12px;
      padding: 6px 12px;
    }

    /* Balance Card */
    .balance-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 16px;
      margin-bottom: 25px;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
    }

    .balance-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.8;
      margin-bottom: 10px;
    }

    .balance-amount {
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 10px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }

    .balance-subtext {
      font-size: 12px;
      opacity: 0.7;
    }

    /* Wallet Actions */
    .wallet-actions {
      display: flex;
      gap: 12px;
      margin-bottom: 25px;
      flex-wrap: wrap;
    }

    .wallet-actions .btn {
      flex: 1;
      min-width: 120px;
      padding: 12px 20px;
      font-weight: 600;
      border-radius: 8px;
    }

    .btn-phantom {
      background: linear-gradient(135deg, #ab9ff2 0%, #9945FF 100%);
      color: white;
      border: none;
    }

    .btn-phantom:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(153, 69, 255, 0.4);
      color: white;
    }

    /* Transaction History */
    .transaction-history {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
    }

    .transaction-history h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #fff;
    }

    .history-table-container {
      overflow-x: auto;
    }

    .table {
      color: #fff;
      margin: 0;
    }

    .table thead th {
      background: rgba(0,0,0,0.2);
      color: rgba(255,255,255,0.7);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 12px 15px;
      border: none;
    }

    .table td {
      vertical-align: middle;
      font-size: 13px;
      padding: 12px 15px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .type-deposit { color: #28a745; font-weight: 600; }
    .type-withdrawal { color: #dc3545; font-weight: 600; }

    .status-pending { background-color: #ffc107; color: #000; }
    .status-completed { background-color: #28a745; color: #fff; }
    .status-failed { background-color: #dc3545; color: #fff; }
    .status-processing { background-color: #17a2b8; color: #fff; }

    /* Modal Dark Theme */
    .modal-content.bg-dark {
      background: #1a1a2e !important;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .modal-header.border-secondary,
    .modal-footer.border-secondary {
      border-color: rgba(255,255,255,0.1) !important;
    }

    /* Responsive */
    @media (max-width: 576px) {
      .wallet-actions { flex-direction: column; }
      .wallet-actions .btn { width: 100%; }
      .balance-amount { font-size: 28px; }
      .wallet-header { flex-direction: column; gap: 15px; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="container py-4">
    <div id="tkoin-wallet" class="tkoin-wallet-container">
      
      <!-- Wallet Header -->
      <div class="wallet-header">
        <div>
          <h2><i class="fa fa-coins text-warning me-2"></i>Tkoin Wallet</h2>
          <small class="text-muted">Manage your TKOIN and Credits</small>
        </div>
        <div class="wallet-status" id="wallet-status">
          <span id="walletAddress" class="badge bg-secondary me-2" style="display: none;"></span>
          <span id="walletStatus" class="badge bg-secondary">Not Connected</span>
        </div>
      </div>

      <!-- Balance Display -->
      <div class="balance-card">
        <div class="balance-label">Available Balance</div>
        <div class="balance-amount" id="creditBalance" data-testid="text-credit-balance">
          {{ number_format($balance['credits'] ?? 0, 2) }} CREDIT
        </div>
        <div class="balance-subtext" id="accountId" data-testid="text-account-id">
          Account ID: {{ auth()->id() ?? '---' }}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="wallet-actions">
        <button type="button" class="btn btn-success" id="btn-deposit" data-bs-toggle="modal" data-bs-target="#depositModal" data-testid="button-deposit">
          <i class="fa fa-arrow-down"></i> Deposit
        </button>
        <button type="button" class="btn btn-danger" id="btn-withdrawal" data-bs-toggle="modal" data-bs-target="#withdrawalModal" data-testid="button-withdraw">
          <i class="fa fa-arrow-up"></i> Withdraw
        </button>
        <button type="button" class="btn btn-secondary" id="btn-refresh" data-testid="button-refresh">
          <i class="fa fa-sync"></i> Refresh
        </button>
        <button type="button" class="btn btn-phantom" id="connectWalletBtn" data-testid="button-connect-wallet">
          <i class="fa fa-wallet"></i> Connect Wallet
        </button>
        <button type="button" class="btn btn-outline-danger" id="disconnectWalletBtn" style="display: none;" data-testid="button-disconnect-wallet">
          <i class="fa fa-unlink"></i> Disconnect
        </button>
      </div>

      <!-- Transaction History -->
      <div class="transaction-history">
        <h3><i class="fa fa-history text-info me-2"></i>Recent Transactions</h3>
        <div class="history-table-container">
          <table class="table table-sm" id="transaction-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody id="transactionHistory">
              @forelse($transactions ?? [] as $tx)
              <tr>
                <td class="type-{{ strtolower($tx['type'] ?? 'deposit') }}">
                  {{ strtoupper($tx['type'] ?? 'N/A') }}
                </td>
                <td>{{ number_format($tx['amount'] ?? 0, 2) }} CREDIT</td>
                <td>
                  <span class="badge status-{{ strtolower($tx['status'] ?? 'pending') }}">
                    {{ strtoupper($tx['status'] ?? 'PENDING') }}
                  </span>
                </td>
                <td>{{ isset($tx['created_at']) ? \Carbon\Carbon::parse($tx['created_at'])->format('M d, Y H:i') : 'N/A' }}</td>
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

  <!-- Deposit Modal -->
  <div class="modal fade" id="depositModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content bg-dark text-white">
        <div class="modal-header border-secondary">
          <h5 class="modal-title"><i class="fa fa-arrow-down text-success me-2"></i>Deposit Tkoin</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <form id="depositForm">
          <div class="modal-body">
            <div class="mb-3">
              <label for="depositAmount" class="form-label">Amount (CREDIT)</label>
              <input type="number" class="form-control form-control-lg bg-secondary text-white border-0" 
                     id="depositAmount" name="amount" min="1" step="0.01" required placeholder="100"
                     data-testid="input-deposit-amount">
              <small class="text-muted">Minimum: 1 CREDIT &bull; <strong>100 CREDIT = 1 TKOIN</strong></small>
            </div>
            <div class="alert alert-info bg-info bg-opacity-25 border-info">
              <strong><i class="fa fa-info-circle"></i> How it works:</strong>
              <ol class="mb-0 mt-2 ps-3">
                <li>Enter the amount in CREDIT</li>
                <li>Click <strong>"Send TKOIN"</strong> to open Phantom</li>
                <li>Approve the TKOIN transfer in Phantom</li>
                <li>Credits are added automatically after confirmation</li>
              </ol>
            </div>
            <div class="alert alert-warning bg-warning bg-opacity-25 border-warning" id="walletRequiredNotice">
              <i class="fa fa-exclamation-triangle"></i>
              <strong>Phantom wallet required!</strong> Please connect your wallet before depositing.
            </div>
            <div id="depositError" class="alert alert-danger" role="alert" style="display: none;"></div>
          </div>
          <div class="modal-footer border-secondary">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-success btn-lg" id="depositSubmit" data-testid="button-submit-deposit">
              <span id="depositSpinner" class="spinner-border spinner-border-sm me-2" role="status" style="display: none;"></span>
              <span id="depositSubmitText"><i class="fa fa-paper-plane"></i> Send TKOIN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Withdrawal Modal -->
  <div class="modal fade" id="withdrawalModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content bg-dark text-white">
        <div class="modal-header border-secondary">
          <h5 class="modal-title"><i class="fa fa-arrow-up text-danger me-2"></i>Withdraw to TKOIN</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <form id="withdrawalForm">
          <div class="modal-body">
            <div class="mb-3">
              <label for="withdrawalAmount" class="form-label">Amount (CREDIT)</label>
              <input type="number" class="form-control form-control-lg bg-secondary text-white border-0" 
                     id="withdrawalAmount" name="amount" min="100" step="1" required placeholder="100"
                     data-testid="input-withdraw-amount">
              <small class="text-muted">Minimum: 100 CREDIT &bull; <strong>100 CREDIT = 1 TKOIN</strong></small>
            </div>
            <div class="mb-3">
              <label for="solanaAddress" class="form-label">Destination Wallet (Optional)</label>
              <input type="text" class="form-control bg-secondary text-white border-0" 
                     id="solanaAddress" name="solana_address" placeholder="Your Solana wallet address"
                     minlength="32" maxlength="64" data-testid="input-solana-address">
              <small class="text-muted">Leave blank to use your connected Phantom wallet</small>
            </div>
            <div class="alert alert-info bg-info bg-opacity-25 border-info">
              <strong><i class="fa fa-info-circle"></i> Processing:</strong>
              TKOIN will be sent directly to your wallet on the Solana blockchain. Processing typically takes 1-5 minutes.
            </div>
            <div id="withdrawalError" class="alert alert-danger" role="alert" style="display: none;"></div>
          </div>
          <div class="modal-footer border-secondary">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-danger btn-lg" id="withdrawalSubmit" data-testid="button-submit-withdraw">
              <span id="withdrawalSpinner" class="spinner-border spinner-border-sm me-2" role="status" style="display: none;"></span>
              <span id="withdrawalSubmitText"><i class="fa fa-arrow-up"></i> Withdraw</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Bootstrap JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

  <!-- CRITICAL: Inline Buffer polyfill - prevents CDN blocking by tracking prevention -->
  @verbatim
  <script>
    if (typeof window.Buffer === 'undefined') {
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
  @endverbatim

  <!-- Solana Web3.js - MUST be loaded AFTER Buffer polyfill -->
  <script src="https://unpkg.com/@solana/web3.js@1.95.3/lib/index.iife.min.js"></script>

  <!-- Tkoin Wallet JS -->
  <script src="{{ asset('js/tkoin-wallet.js') }}?v={{ time() }}"></script>

  @verbatim
  <script>
    // Hide wallet notice when wallet is connected
    document.addEventListener('DOMContentLoaded', function() {
      const observer = new MutationObserver(function(mutations) {
        const walletStatus = document.getElementById('walletStatus');
        const notice = document.getElementById('walletRequiredNotice');
        if (walletStatus && notice) {
          if (walletStatus.classList.contains('bg-success')) {
            notice.style.display = 'none';
          } else {
            notice.style.display = 'block';
          }
        }
      });
      
      const walletStatus = document.getElementById('walletStatus');
      if (walletStatus) {
        observer.observe(walletStatus, { attributes: true, attributeFilter: ['class'] });
      }
    });
  </script>
  @endverbatim
</body>
</html>
