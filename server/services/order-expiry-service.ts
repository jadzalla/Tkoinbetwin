import type { IStorage } from '../storage';

/**
 * Order Expiry Service
 * 
 * Automatically expires P2P orders that exceed their time limit.
 * Runs every 60 seconds to check for expired orders.
 */
export class OrderExpiryService {
  private storage: IStorage;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Start the auto-expiry service
   */
  start() {
    if (this.intervalId) {
      console.log('[OrderExpiry] Service already running');
      return;
    }

    console.log('[OrderExpiry] Starting auto-expiry service...');
    
    // Run immediately on start
    this.checkExpiredOrders();
    
    // Then run every minute
    this.intervalId = setInterval(() => {
      this.checkExpiredOrders();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the auto-expiry service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[OrderExpiry] Service stopped');
    }
  }

  /**
   * Check for expired orders and update their status
   * Uses atomic approach: expireP2pOrders() returns the exact orders that were expired,
   * guaranteeing that TKOIN is unlocked for all expired orders
   */
  private async checkExpiredOrders() {
    try {
      // Expire orders atomically - this returns the exact orders that were just expired
      const { count, expiredOrders } = await this.storage.expireP2pOrders();
      
      if (count === 0) {
        return;
      }
      
      // Unlock TKOIN for each expired order (using the returned orders)
      // This guarantees no TKOIN leaks - if an order was expired, it will be unlocked
      const { EscrowService } = await import('./escrow-service');
      const escrowService = new EscrowService(this.storage);
      
      for (const order of expiredOrders) {
        if (order.tkoinLocked) {
          const unlockResult = await escrowService.unlockTkoin(order.agentId, order.tkoinAmount);
          if (!unlockResult.success) {
            console.error(`[OrderExpiry] Failed to unlock TKOIN for order ${order.id}: ${unlockResult.error}`);
          }
        }
      }
      
      console.log(`[OrderExpiry] Expired ${count} order(s) and unlocked TKOIN`);
    } catch (error) {
      console.error('[OrderExpiry] Error checking expired orders:', error);
    }
  }
}

// Export a singleton instance
let orderExpiryServiceInstance: OrderExpiryService | null = null;

export function initializeOrderExpiryService(storage: IStorage): OrderExpiryService {
  if (!orderExpiryServiceInstance) {
    orderExpiryServiceInstance = new OrderExpiryService(storage);
  }
  return orderExpiryServiceInstance;
}

export function getOrderExpiryService(): OrderExpiryService | null {
  return orderExpiryServiceInstance;
}
