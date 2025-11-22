#!/bin/bash

# Tkoin Protocol - Platform API Integration Test Script
# This script tests all 4 platform API endpoints step-by-step

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:5000"
PLATFORM_ID="platform_betwin"
PLATFORM_TOKEN="ptk_fDMaJYTAYqvdvCcwMlCtlW"
PLATFORM_SECRET="psk_JTNmZ2NkOGI2Zi03ODRiLTQ5YjEtOTI4ZC1kNjMzZmJlN2U2OWIi"
TEST_USER_ID="test_user_$(date +%s)"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Tkoin Protocol - Platform API Integration Test${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to generate HMAC signature
generate_signature() {
    local timestamp=$1
    local method=$2
    local path=$3
    local body=$4
    
    local message="${timestamp}${method}${path}${body}"
    echo -n "$message" | openssl dgst -sha256 -hmac "$PLATFORM_SECRET" -binary | base64
}

# Function to make authenticated API request
api_request() {
    local method=$1
    local endpoint=$2
    local body=${3:-""}
    
    local timestamp=$(date +%s)
    local path="/api/platforms/${PLATFORM_ID}${endpoint}"
    local signature=$(generate_signature "$timestamp" "$method" "$path" "$body")
    
    echo -e "${YELLOW}➜ ${method} ${path}${NC}"
    if [ -n "$body" ]; then
        echo -e "${YELLOW}  Body: ${body}${NC}"
    fi
    
    if [ "$method" = "GET" ]; then
        curl -s -w "\n" \
            -H "X-Platform-Token: ${PLATFORM_TOKEN}" \
            -H "X-Platform-Timestamp: ${timestamp}" \
            -H "X-Platform-Signature: ${signature}" \
            "${BASE_URL}${path}"
    else
        curl -s -w "\n" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -H "X-Platform-Token: ${PLATFORM_TOKEN}" \
            -H "X-Platform-Timestamp: ${timestamp}" \
            -H "X-Platform-Signature: ${signature}" \
            -d "$body" \
            "${BASE_URL}${path}"
    fi
    
    echo ""
}

# Test 1: Check initial balance (should be 0 or error if user doesn't exist)
echo -e "${GREEN}Test 1: Check Initial Balance${NC}"
echo -e "User ID: ${TEST_USER_ID}"
echo ""
response=$(api_request "GET" "/users/${TEST_USER_ID}/balance")
echo -e "Response: ${response}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 2: Create first deposit (100 credits)
echo -e "${GREEN}Test 2: Create Deposit (100 credits)${NC}"
echo ""
settlement_id="settle_$(date +%s)_1"
body="{\"platformUserId\":\"${TEST_USER_ID}\",\"creditsAmount\":100,\"platformSettlementId\":\"${settlement_id}\"}"
response=$(api_request "POST" "/deposits" "$body")
echo -e "Response: ${response}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 3: Check balance after deposit (should be 100 credits)
echo -e "${GREEN}Test 3: Check Balance After Deposit${NC}"
echo ""
response=$(api_request "GET" "/users/${TEST_USER_ID}/balance")
echo -e "Response: ${response}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 4: Create another deposit (50 credits)
echo -e "${GREEN}Test 4: Create Second Deposit (50 credits)${NC}"
echo ""
settlement_id="settle_$(date +%s)_2"
body="{\"platformUserId\":\"${TEST_USER_ID}\",\"creditsAmount\":50,\"platformSettlementId\":\"${settlement_id}\"}"
response=$(api_request "POST" "/deposits" "$body")
echo -e "Response: ${response}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 5: Check balance after second deposit (should be 150 credits)
echo -e "${GREEN}Test 5: Check Balance After Second Deposit${NC}"
echo ""
response=$(api_request "GET" "/users/${TEST_USER_ID}/balance")
echo -e "Response: ${response}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 6: Create withdrawal (30 credits)
echo -e "${GREEN}Test 6: Create Withdrawal (30 credits)${NC}"
echo ""
settlement_id="settle_$(date +%s)_3"
solana_addr="GJ8ZUGBD7UAtffi8eWjfqN63nCMhPgmDuH44YNRct3R6"
body="{\"platformUserId\":\"${TEST_USER_ID}\",\"creditsAmount\":30,\"solanaAddress\":\"${solana_addr}\",\"platformSettlementId\":\"${settlement_id}\"}"
response=$(api_request "POST" "/withdrawals" "$body")
echo -e "Response: ${response}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 7: Check balance after withdrawal (should be 120 credits)
echo -e "${GREEN}Test 7: Check Balance After Withdrawal${NC}"
echo ""
response=$(api_request "GET" "/users/${TEST_USER_ID}/balance")
echo -e "Response: ${response}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 8: Get transaction history (should show all 3 transactions)
echo -e "${GREEN}Test 8: Get Transaction History${NC}"
echo ""
response=$(api_request "GET" "/users/${TEST_USER_ID}/transactions")
echo -e "Response: ${response}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 9: Try to withdraw more than balance (should fail)
echo -e "${GREEN}Test 9: Test Insufficient Balance (should fail)${NC}"
echo ""
settlement_id="settle_$(date +%s)_4"
body="{\"platformUserId\":\"${TEST_USER_ID}\",\"creditsAmount\":500,\"solanaAddress\":\"${solana_addr}\",\"platformSettlementId\":\"${settlement_id}\"}"
response=$(api_request "POST" "/withdrawals" "$body")
echo -e "Response: ${response}"
echo ""

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ All tests completed!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "Test User ID: ${TEST_USER_ID}"
echo -e "Expected Final Balance: 120 credits (1.20 TKOIN)"
echo ""
