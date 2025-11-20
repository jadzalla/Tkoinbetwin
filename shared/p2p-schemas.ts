import { z } from 'zod';

/**
 * P2P Marketplace Validation Schemas
 * 
 * Defines request validation schemas for P2P marketplace API endpoints
 */

// Payment Method Schemas
export const createPaymentMethodSchema = z.object({
  methodType: z.string().min(1, "Payment method type is required"),
  methodName: z.string().min(1, "Payment method name is required"),
  displayName: z.string().min(1, "Display name is required").max(100),
  accountDetails: z.record(z.string()).optional().default({}),
  instructions: z.string().max(500).optional().nullable(),
  minAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount format").optional().default("10"),
  maxAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount format").optional().default("5000"),
});

export const updatePaymentMethodSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  accountDetails: z.record(z.string()).optional(),
  instructions: z.string().max(500).optional().nullable(),
  minAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount format").optional(),
  maxAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount format").optional(),
  isActive: z.boolean().optional(),
});

// P2P Order Schemas
export const createP2pOrderSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID"),
  orderType: z.enum(['buy', 'sell'], { 
    errorMap: () => ({ message: "Order type must be 'buy' or 'sell'" }) 
  }),
  tkoinAmount: z.string()
    .regex(/^\d+(\.\d+)?$/, "Invalid TKOIN amount format")
    .refine((val) => parseFloat(val) > 0, "TKOIN amount must be positive"),
  fiatAmount: z.string()
    .regex(/^\d+(\.\d+)?$/, "Invalid fiat amount format")
    .refine((val) => parseFloat(val) > 0, "Fiat amount must be positive"),
  fiatCurrency: z.string()
    .length(3, "Currency code must be 3 characters")
    .regex(/^[A-Z]{3}$/, "Invalid currency code format"),
  paymentMethodId: z.string().uuid("Invalid payment method ID").optional(),
});

export const markPaymentSentSchema = z.object({
  // No additional fields needed - just the order ID from params
});

export const releaseOrderSchema = z.object({
  // No additional fields needed - just the order ID from params
});

export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

// Chat Message Schemas
export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content is required").max(1000, "Message too long"),
  messageType: z.enum(['text', 'image', 'system']).optional().default('text'),
});

// Payment Proof Schemas
export const uploadPaymentProofSchema = z.object({
  fileUrl: z.string().url("Invalid file URL"),
  fileName: z.string().max(255).optional(),
});

// Public types for use in API
export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
export type CreateP2pOrderInput = z.infer<typeof createP2pOrderSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UploadPaymentProofInput = z.infer<typeof uploadPaymentProofSchema>;
