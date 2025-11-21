<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   SolanaSigner.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Services\Crypto;

use Illuminate\Support\Facades\Log;
use SodiumException;
use StephenHill\Base58;

class SolanaSigner implements Signer
{
    protected $base58;

    public function __construct()
    {
        $this->base58 = new Base58();
    }

    public function sign(string $privateKey, string $message): string
    {
        return $this->base58->encode(sodium_crypto_sign_detached($message, $this->base58->decode($privateKey)));
    }

    public function verify(string $message, string $signature, string $address): bool
    {
        try {
            return sodium_crypto_sign_verify_detached($this->base58->decode($signature), $message, $this->base58->decode(($address)));
        } catch (SodiumException $e) {
            Log::error(sprintf('Error when verifying Solana signature: %s', $e->getMessage()));
            return FALSE;
        }
    }
}
