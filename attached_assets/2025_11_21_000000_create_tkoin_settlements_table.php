<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   2025_11_21_000000_create_tkoin_settlements_table.php
 * 
 *   @copyright  Copyright (c) BetWin, All rights reserved
 *   @author     BetWin <dev@betwin.tkoin.finance>
 *   @see        https://betwin.tkoin.finance
*/

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tkoin_settlements', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('account_id');
            $table->enum('type', ['deposit', 'withdrawal']);
            $table->enum('status', ['pending', 'processing', 'completed', 'failed', 'cancelled'])->default('pending');
            $table->decimal('amount', 20, 2);
            $table->string('solana_signature')->nullable();
            $table->json('metadata')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->timestamps();

            // Foreign key constraints
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            $table->foreign('account_id')
                ->references('id')
                ->on('accounts')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            // Indexes for performance
            $table->index('user_id');
            $table->index('account_id');
            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'type']);
            $table->index('status');
            $table->index('type');
            $table->index('created_at');
            $table->index('solana_signature');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tkoin_settlements');
    }
};
