# Platform API Integration Testing Guide

## Overview
This guide will walk you through testing all 4 Platform API endpoints step-by-step using curl commands.

## Prerequisites
- Server must be running on `http://localhost:5000`
- You need `openssl` and `curl` installed
- BetWin platform is registered with API enabled ✅

## Platform Credentials
```bash
PLATFORM_ID="platform_betwin"
API_SECRET="ab0d6715b594c415d4e354c03024ef6e"
PLATFORM_TOKEN="ptk_fDMaJYTAYqvdvCcwMlCtlW"  # Use your actual token
BASE_URL="http://localhost:5000"
```

## Helper Function: Generate HMAC Signature

Create this helper script first:

```bash
# Save as: generate-signature.sh
#!/bin/bash
TIMESTAMP=$1
METHOD=$2
PATH=$3
BODY=$4
SECRET="ab0d6715b594c415d4e354c03024ef6e"

MESSAGE="${TIMESTAMP}${METHOD}${PATH}${BODY}"
echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64
```

Make it executable:
```bash
chmod +x generate-signature.sh
```

---

## Test 1: Check Initial Balance (New User)

This will likely return an error since the user doesn't exist yet.

```bash
# 1. Set variables
TEST_USER="test_user_$(date +%s)"
echo "Test User ID: $TEST_USER"
TIMESTAMP=$(date +%s)
METHOD="GET"
PATH="/api/platforms/platform_betwin/users/${TEST_USER}/balance"
BODY=""

# 2. Generate signature
SIGNATURE=$(./generate-signature.sh "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

# 3. Make request
curl -v "http://localhost:5000${PATH}" \
  -H "X-Platform-Token: ptk_fDMaJYTAYqvdvCcwMlCtlW" \
  -H "X-Platform-Timestamp: $TIMESTAMP" \
  -H "X-Platform-Signature: $SIGNATURE"
```

**Expected Response:** Error message (user not found) or balance of 0

---

## Test 2: Create First Deposit (100 credits)

```bash
# 1. Set variables
SETTLEMENT_ID="settle_$(date +%s)_1"
TIMESTAMP=$(date +%s)
METHOD="POST"
PATH="/api/platforms/platform_betwin/deposits"
BODY="{\"platformUserId\":\"${TEST_USER}\",\"creditsAmount\":100,\"platformSettlementId\":\"${SETTLEMENT_ID}\"}"

# 2. Generate signature
SIGNATURE=$(./generate-signature.sh "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

# 3. Make request
curl -v -X POST "http://localhost:5000${PATH}" \
  -H "Content-Type: application/json" \
  -H "X-Platform-Token: ptk_fDMaJYTAYqvdvCcwMlCtlW" \
  -H "X-Platform-Timestamp: $TIMESTAMP" \
  -H "X-Platform-Signature: $SIGNATURE" \
  -d "$BODY"
```

**Expected Response:**
```json
{
  "id": "...",
  "platformId": "platform_betwin",
  "platformUserId": "test_user_...",
  "type": "deposit",
  "creditsAmount": "100.00",
  "tkoinAmount": "1.00000000",
  "status": "completed",
  "completedAt": "2025-11-22T..."
}
```

---

## Test 3: Check Balance After Deposit

```bash
# 1. Set variables
TIMESTAMP=$(date +%s)
METHOD="GET"
PATH="/api/platforms/platform_betwin/users/${TEST_USER}/balance"
BODY=""

# 2. Generate signature
SIGNATURE=$(./generate-signature.sh "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

# 3. Make request
curl -v "http://localhost:5000${PATH}" \
  -H "X-Platform-Token: ptk_fDMaJYTAYqvdvCcwMlCtlW" \
  -H "X-Platform-Timestamp: $TIMESTAMP" \
  -H "X-Platform-Signature: $SIGNATURE"
```

**Expected Response:**
```json
{
  "platformUserId": "test_user_...",
  "creditsBalance": "100.00",
  "tkoinAmount": "1.00000000",
  "lastTransactionAt": "2025-11-22T..."
}
```

---

## Test 4: Create Second Deposit (50 credits)

```bash
# 1. Set variables
SETTLEMENT_ID="settle_$(date +%s)_2"
TIMESTAMP=$(date +%s)
METHOD="POST"
PATH="/api/platforms/platform_betwin/deposits"
BODY="{\"platformUserId\":\"${TEST_USER}\",\"creditsAmount\":50,\"platformSettlementId\":\"${SETTLEMENT_ID}\"}"

# 2. Generate signature
SIGNATURE=$(./generate-signature.sh "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

# 3. Make request
curl -v -X POST "http://localhost:5000${PATH}" \
  -H "Content-Type: application/json" \
  -H "X-Platform-Token: ptk_fDMaJYTAYqvdvCcwMlCtlW" \
  -H "X-Platform-Timestamp: $TIMESTAMP" \
  -H "X-Platform-Signature: $SIGNATURE" \
  -d "$BODY"
```

**Expected Balance:** 150 credits (1.50 TKOIN)

---

## Test 5: Create Withdrawal (30 credits)

```bash
# 1. Set variables
SETTLEMENT_ID="settle_$(date +%s)_3"
SOLANA_ADDR="GJ8ZUGBD7UAtffi8eWjfqN63nCMhPgmDuH44YNRct3R6"
TIMESTAMP=$(date +%s)
METHOD="POST"
PATH="/api/platforms/platform_betwin/withdrawals"
BODY="{\"platformUserId\":\"${TEST_USER}\",\"creditsAmount\":30,\"solanaAddress\":\"${SOLANA_ADDR}\",\"platformSettlementId\":\"${SETTLEMENT_ID}\"}"

# 2. Generate signature
SIGNATURE=$(./generate-signature.sh "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

# 3. Make request
curl -v -X POST "http://localhost:5000${PATH}" \
  -H "Content-Type: application/json" \
  -H "X-Platform-Token: ptk_fDMaJYTAYqvdvCcwMlCtlW" \
  -H "X-Platform-Timestamp: $TIMESTAMP" \
  -H "X-Platform-Signature: $SIGNATURE" \
  -d "$BODY"
```

**Expected Balance After:** 120 credits (1.20 TKOIN)

---

## Test 6: Get Transaction History

```bash
# 1. Set variables
TIMESTAMP=$(date +%s)
METHOD="GET"
PATH="/api/platforms/platform_betwin/users/${TEST_USER}/transactions"
BODY=""

# 2. Generate signature
SIGNATURE=$(./generate-signature.sh "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

# 3. Make request
curl -v "http://localhost:5000${PATH}" \
  -H "X-Platform-Token: ptk_fDMaJYTAYqvdvCcwMlCtlW" \
  -H "X-Platform-Timestamp: $TIMESTAMP" \
  -H "X-Platform-Signature: $SIGNATURE"
```

**Expected Response:** Array of 3 transactions (2 deposits, 1 withdrawal)

---

## Test 7: Test Insufficient Balance (Should Fail)

```bash
# 1. Set variables
SETTLEMENT_ID="settle_$(date +%s)_4"
SOLANA_ADDR="GJ8ZUGBD7UAtffi8eWjfqN63nCMhPgmDuH44YNRct3R6"
TIMESTAMP=$(date +%s)
METHOD="POST"
PATH="/api/platforms/platform_betwin/withdrawals"
BODY="{\"platformUserId\":\"${TEST_USER}\",\"creditsAmount\":500,\"solanaAddress\":\"${SOLANA_ADDR}\",\"platformSettlementId\":\"${SETTLEMENT_ID}\"}"

# 2. Generate signature
SIGNATURE=$(./generate-signature.sh "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

# 3. Make request
curl -v -X POST "http://localhost:5000${PATH}" \
  -H "Content-Type: application/json" \
  -H "X-Platform-Token: ptk_fDMaJYTAYqvdvCcwMlCtlW" \
  -H "X-Platform-Timestamp: $TIMESTAMP" \
  -H "X-Platform-Signature: $SIGNATURE" \
  -d "$BODY"
```

**Expected Response:** Error (insufficient balance)

---

## What to Check

After running all tests, verify:

1. ✅ **Atomic Transactions** - If a test crashes mid-way, partial updates should roll back
2. ✅ **Decimal Precision** - All amounts should show correct decimals (no rounding errors)
3. ✅ **Balance Accuracy** - Balance = deposits - withdrawals
4. ✅ **Transaction History** - All transactions recorded correctly
5. ✅ **Error Handling** - Insufficient balance errors work
6. ✅ **HMAC Authentication** - Invalid signatures rejected

## Common Issues

**401 Unauthorized:** Check your signature generation
**400 Bad Request:** Check JSON body format
**500 Server Error:** Check server logs for detailed error message

## Server Logs

To watch server logs in real-time:
```bash
# In Replit console
# Watch the workflow output
```

## Database Verification

Check the database directly:
```sql
-- Check user balance
SELECT * FROM platform_user_balances WHERE platform_user_id = 'test_user_...';

-- Check transactions
SELECT * FROM platform_transactions WHERE platform_user_id = 'test_user_...' ORDER BY created_at DESC;
```
