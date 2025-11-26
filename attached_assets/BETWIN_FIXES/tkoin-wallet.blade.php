<!-- BetWin Tkoin Wallet Component - FIXED VERSION v7 -->
<!-- Place in: resources/views/user/tkoin-wallet.blade.php -->
<!-- Based on your working version with Buffer polyfill fix -->

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
</head>
<body>
  <div class="container py-4">
    <div id="tkoin-wallet" class="tkoin-wallet-container">
      <!-- Wallet Header -->
      <div class="wallet-header">
        <h2>Tkoin Wallet</h2>
        <div class="wallet-status" id="wallet-status">
          <span class="badge badge-info">Loading...</span>
        </div>
      </div>

      <!-- Balance Display -->
      <div class="balance-card">
        <div class="balance-label">Available Balance</div>
        <div class="balance-amount" id="balance-amount">--- CREDIT</div>
        <div class="balance-subtext" id="balance-account">Account ID: ---</div>
      </div>

      <!-- Action Buttons -->
      <div class="wallet-actions">
        <button type="button" class="btn btn-primary" id="btn-deposit" data-bs-toggle="modal" data-bs-target="#depositModal">
          <i class="fa fa-arrow-down"></i> Deposit
        </button>
        <button type="button" class="btn btn-primary" id="btn-withdrawal" data-bs-toggle="modal" data-bs-target="#withdrawModal">
          <i class="fa fa-arrow-up"></i> Withdraw
        </button>
        <button type="button" class="btn btn-secondary" id="btn-refresh">
          <i class="fa fa-sync"></i> Refresh
        </button>
        <button type="button" class="btn btn-info" id="connect-wallet-btn">
          <i class="fa fa-wallet"></i> Connect Wallet
        </button>
        <button type="button" class="btn btn-danger" id="disconnect-wallet-btn" style="display: none;">
          <i class="fa fa-unlink"></i> Disconnect
        </button>
      </div>

      <!-- Transaction History -->
      <div class="transaction-history">
        <h3>Recent Transactions</h3>
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
              <tr>
                <td colspan="4" class="text-center text-muted">Loading transactions...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Deposit Modal -->
  <div class="modal fade" id="depositModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Deposit Tkoin</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <form id="depositForm">
          <div class="modal-body">
            <div class="mb-3">
              <label for="depositAmount" class="form-label">Amount (CREDIT)</label>
              <input type="number" class="form-control" id="depositAmount" name="amount" 
                     min="1" step="0.01" required placeholder="Enter amount to deposit">
              <small class="text-muted">Minimum: 1 CREDIT (100 CREDIT = 1 TKOIN)</small>
            </div>
            <div class="alert alert-info" role="alert">
              <strong>How it works:</strong> Connect your Phantom wallet, enter the amount, and approve the TKOIN transfer. Credits are added automatically.
            </div>
            <div id="depositError" class="alert alert-danger" role="alert" style="display: none;"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="depositSubmit">
              <span id="depositSubmitText">Send TKOIN</span>
              <span id="depositSpinner" class="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true" style="display: none;"></span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Withdrawal Modal - FIXED IDs to match tkoin-wallet.js -->
  <div class="modal fade" id="withdrawModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Withdraw Tkoin</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <form id="withdrawForm">
          <div class="modal-body">
            <div class="mb-3">
              <label for="withdrawAmount" class="form-label">Amount (CREDIT)</label>
              <input type="number" class="form-control" id="withdrawAmount" name="amount" 
                     min="100" step="1" required placeholder="Enter amount to withdraw">
              <small class="text-muted">Minimum: 100 CREDIT (100 CREDIT = 1 TKOIN)</small>
            </div>
            <div class="mb-3">
              <label for="withdrawWallet" class="form-label">Solana Wallet Address (Optional)</label>
              <input type="text" class="form-control" id="withdrawWallet" name="wallet_address" 
                     placeholder="Your Solana wallet address">
              <small class="text-muted">Leave blank to use your connected Phantom wallet</small>
            </div>
            <div class="alert alert-info" role="alert">
              <strong>How it works:</strong> TKOIN will be sent directly to your Solana wallet. Processing typically takes 1-5 minutes.
            </div>
            <div id="withdrawError" class="alert alert-danger" role="alert" style="display: none;"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="withdrawSubmit">
              <span id="withdrawSubmitText">Withdraw</span>
              <span id="withdrawSpinner" class="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true" style="display: none;"></span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <style>
    .tkoin-wallet-container {
      max-width: 800px;
      margin: 20px auto;
    }

    .wallet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 15px;
    }

    .wallet-header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .balance-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 25px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }

    .balance-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .balance-amount {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .balance-subtext {
      font-size: 12px;
      opacity: 0.8;
    }

    .wallet-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 25px;
      flex-wrap: wrap;
    }

    .wallet-actions .btn {
      flex: 1;
      min-width: 120px;
    }

    .transaction-history {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
    }

    .transaction-history h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
    }

    .history-table-container {
      overflow-x: auto;
    }

    .table td {
      vertical-align: middle;
      font-size: 13px;
    }

    .table thead th {
      background-color: #f8f9fa;
      border-top: none;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge {
      font-size: 12px;
      padding: 4px 12px;
    }

    .status-pending {
      background-color: #ffc107;
      color: #000;
    }

    .status-completed {
      background-color: #28a745;
      color: #fff;
    }

    .status-failed {
      background-color: #dc3545;
      color: #fff;
    }

    .type-deposit {
      color: #28a745;
      font-weight: 500;
    }

    .type-withdrawal {
      color: #dc3545;
      font-weight: 500;
    }

    @media (max-width: 576px) {
      .wallet-actions {
        flex-direction: column;
      }

      .wallet-actions .btn {
        width: 100%;
      }

      .balance-amount {
        font-size: 28px;
      }
    }
  </style>

  <!-- Bootstrap JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  
  <!-- Buffer: Try CDN first, fallback to inline polyfill -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/buffer/6.0.3/buffer.min.js"></script>
  <script>
    if (typeof buffer !== 'undefined' && buffer.Buffer) {
      window.Buffer = buffer.Buffer;
    } else if (typeof window.Buffer === 'undefined') {
      // Inline fallback if CDN blocked
      window.Buffer = {
        from: function(d, e) {
          if (typeof d === 'string') {
            if (e === 'base64') {
              var b = atob(d);
              var a = new Uint8Array(b.length);
              for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
              return a;
            }
            return new TextEncoder().encode(d);
          }
          return new Uint8Array(d || 0);
        },
        alloc: function(s) { return new Uint8Array(s); },
        isBuffer: function(o) { return o instanceof Uint8Array; },
        concat: function(a) {
          var t = 0; for (var i = 0; i < a.length; i++) t += a[i].length;
          var r = new Uint8Array(t);
          var o = 0; for (var j = 0; j < a.length; j++) { r.set(a[j], o); o += a[j].length; }
          return r;
        }
      };
    }
  </script>
  
  <!-- Solana Web3.js -->
  <script src="https://unpkg.com/@solana/web3.js@1.95.3/lib/index.iife.min.js"></script>
  
  <!-- Tkoin Wallet JS -->
  <script src="{{ asset('js/tkoin-wallet.js') . '?v=' . time() }}"></script>
</body>
</html>
