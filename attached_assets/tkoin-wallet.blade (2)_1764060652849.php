<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Tkoin Wallet - BetWin</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #e2e8f0;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
            padding: 30px;
            border-radius: 16px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(139, 92, 246, 0.3);
        }
        
        .header h1 {
            font-size: 2em;
            font-weight: 700;
            color: white;
            margin-bottom: 10px;
        }
        
        .balance-section {
            background: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(139, 92, 246, 0.2);
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 20px;
        }
        
        .balance-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }
        
        .balance-item {
            text-align: center;
        }
        
        .balance-label {
            font-size: 0.9em;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        
        .balance-value {
            font-size: 2em;
            font-weight: 700;
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .actions {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-top: 20px;
        }
        
        .btn-custom {
            padding: 14px 28px;
            border: none;
            border-radius: 8px;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .btn-custom-primary {
            background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        }
        
        .btn-custom-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6);
        }
        
        .btn-custom-secondary {
            background: rgba(100, 116, 139, 0.3);
            color: #e2e8f0;
            border: 1px solid rgba(139, 92, 246, 0.3);
        }
        
        .btn-custom-secondary:hover:not(:disabled) {
            background: rgba(139, 92, 246, 0.2);
            border-color: rgba(139, 92, 246, 0.5);
        }
        
        .btn-custom:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .transactions-section {
            background: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(139, 92, 246, 0.2);
            padding: 25px;
            border-radius: 12px;
            margin-top: 30px;
        }
        
        .transactions-section h2 {
            font-size: 1.5em;
            margin-bottom: 20px;
            color: #e2e8f0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        thead {
            background: rgba(139, 92, 246, 0.1);
        }
        
        th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
            color: #cbd5e1;
            text-transform: uppercase;
            font-size: 0.85em;
            letter-spacing: 0.5px;
        }
        
        tbody tr {
            border-bottom: 1px solid rgba(71, 85, 105, 0.3);
        }
        
        tbody tr:hover {
            background: rgba(139, 92, 246, 0.05);
        }
        
        td {
            padding: 12px 15px;
            color: #e2e8f0;
        }
        
        .wallet-section {
            margin-top: 30px;
        }
        
        #wallet-status {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.85em;
        }
        
        .badge-success {
            background: #10b981;
            color: white;
        }
        
        .badge-info {
            background: #3b82f6;
            color: white;
        }
        
        .type-deposit {
            color: #10b981;
            font-weight: 500;
        }
        
        .type-withdrawal {
            color: #ef4444;
            font-weight: 500;
        }
        
        .status-pending {
            background-color: #f59e0b;
            color: #000;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
        }
        
        .status-completed {
            background-color: #10b981;
            color: #fff;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
        }
        
        .status-failed {
            background-color: #ef4444;
            color: #fff;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
        }
        
        .modal-content {
            background: #1e293b;
            color: #e2e8f0;
            border: 1px solid rgba(139, 92, 246, 0.3);
        }
        
        .modal-header {
            border-bottom: 1px solid rgba(139, 92, 246, 0.2);
        }
        
        .modal-footer {
            border-top: 1px solid rgba(139, 92, 246, 0.2);
        }
        
        .form-control {
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(139, 92, 246, 0.3);
            color: #e2e8f0;
        }
        
        .form-control:focus {
            background: rgba(30, 41, 59, 0.9);
            border-color: #8b5cf6;
            color: #e2e8f0;
            box-shadow: 0 0 0 0.2rem rgba(139, 92, 246, 0.25);
        }
        
        .form-label {
            color: #cbd5e1;
            font-weight: 500;
        }
        
        .text-muted {
            color: #94a3b8 !important;
        }
        
        .alert {
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1>💰 Tkoin Wallet</h1>
                    <p style="color: rgba(255,255,255,0.9); font-size: 1.1em;">Manage your TKOIN and Credits</p>
                </div>
                <div id="wallet-status">
                    <span class="badge badge-info">Loading...</span>
                </div>
            </div>
        </div>
        
        <div id="tkoin-wallet">
            <div class="balance-section">
                <h2 style="margin-bottom: 10px;">Available Balance</h2>
                <div class="balance-grid">
                    <div class="balance-item">
                        <div class="balance-label">Balance</div>
                        <div class="balance-value" id="balance-amount">--- CREDIT</div>
                    </div>
                    <div class="balance-item">
                        <div class="balance-label">Account Info</div>
                        <div class="balance-value" style="font-size: 1.2em;" id="balance-account">Account ID: ---</div>
                    </div>
                </div>
                
                <div class="actions">
                    <button class="btn-custom btn-custom-primary" id="btn-deposit" data-bs-toggle="modal" data-bs-target="#depositModal">
                        <i class="fa fa-arrow-down"></i> Deposit
                    </button>
                    <button class="btn-custom btn-custom-primary" id="btn-withdrawal" data-bs-toggle="modal" data-bs-target="#withdrawalModal">
                        <i class="fa fa-arrow-up"></i> Withdraw
                    </button>
                    <button class="btn-custom btn-custom-secondary" id="btn-refresh">
                        <i class="fa fa-sync"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="wallet-section">
                <button class="btn-custom btn-custom-primary" id="connect-wallet-btn">
                    <i class="fa fa-wallet"></i> Connect Solana Wallet
                </button>
            </div>
            
            <div class="transactions-section">
                <h2>Transaction History</h2>
                <table id="transaction-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody id="transaction-body">
                        <tr>
                            <td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">Loading transactions...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    
    <!-- Deposit Modal -->
    <div class="modal fade" id="depositModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Deposit Tkoin</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <form id="depositForm">
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="depositAmount" class="form-label">Amount (CREDIT)</label>
                            <input type="number" class="form-control" id="depositAmount" name="amount" 
                                   min="0.01" step="0.01" required placeholder="Enter amount to deposit">
                            <small class="text-muted">Minimum: 0.01 CREDIT</small>
                        </div>
                        <div class="alert alert-info" role="alert">
                            <strong>How it works:</strong> Your deposit will be initiated through Tkoin. You'll receive a confirmation once processed.
                        </div>
                        <div id="depositError" class="alert alert-danger" role="alert" style="display: none;"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="depositSubmit">
                            <span id="depositSubmitText">Initiate Deposit</span>
                            <span id="depositSpinner" class="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true" style="display: none;"></span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Withdrawal Modal -->
    <div class="modal fade" id="withdrawalModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Withdraw Tkoin</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <form id="withdrawalForm">
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="withdrawalAmount" class="form-label">Amount (CREDIT)</label>
                            <input type="number" class="form-control" id="withdrawalAmount" name="amount" 
                                   min="0.01" step="0.01" required placeholder="Enter amount to withdraw">
                            <small class="text-muted">Minimum: 0.01 CREDIT</small>
                        </div>
                        <div class="mb-3">
                            <label for="solanaAddress" class="form-label">Solana Wallet Address (Optional)</label>
                            <input type="text" class="form-control" id="solanaAddress" name="solana_address" 
                                   placeholder="Your Solana wallet address">
                            <small class="text-muted">Leave blank to withdraw to your default wallet</small>
                        </div>
                        <div class="alert alert-info" role="alert">
                            <strong>How it works:</strong> Your withdrawal will be processed to your Solana wallet. Processing typically takes 5-30 minutes.
                        </div>
                        <div id="withdrawalError" class="alert alert-danger" role="alert" style="display: none;"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="withdrawalSubmit">
                            <span id="withdrawalSubmitText">Initiate Withdrawal</span>
                            <span id="withdrawalSpinner" class="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true" style="display: none;"></span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="{{ asset('js/tkoin-wallet-COMPLETE-FIXED.v4.js') . '?v=' . time() }}"></script>
</body>
</html>
