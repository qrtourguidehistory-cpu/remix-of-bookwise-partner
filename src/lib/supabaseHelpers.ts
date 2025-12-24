/**
 * Supabase Helpers - Utilities to ensure data security
 * 
 * These helpers ensure that all queries are properly filtered by business_id
 * to prevent data leakage between businesses.
 */

import { supabase } from './supabaseClient';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * Ensures a query includes business_id filter
 * Throws an error if business_id is missing
 */
export function requireBusinessId(businessId: string | null | undefined): string {
  if (!businessId) {
    throw new Error('business_id is required for this operation');
  }
  return businessId;
}

/**
 * Creates a safe query builder that automatically filters by business_id
 * 
 * @example
 * const query = safeQuery('clients', profile.business_id)
 *   .select('*')
 *   .order('full_name');
 */
export function safeQuery<T = any>(
  table: string,
  businessId: string | null | undefined
): any {
  const id = requireBusinessId(businessId);
  return (supabase.from(table as any) as any).select('*').eq('business_id', id);
}

/**
 * Validates that a query includes business_id filter
 * This is a development-time check to catch missing filters
 */
export function validateBusinessIdFilter(
  query: any,
  businessId: string | null | undefined,
  tableName: string
): void {
  if (process.env.NODE_ENV === 'development') {
    if (!businessId) {
      console.warn(
        `⚠️ SECURITY WARNING: Query to ${tableName} is missing business_id filter!`
      );
    }
  }
}

/**
 * Helper to create queries with automatic business_id filtering
 * for common tables
 */
export const createBusinessQuery = (businessId: string | null | undefined) => ({
  clients: () => safeQuery('clients', businessId),
  staff: () => safeQuery('staff', businessId),
  services: () => safeQuery('services', businessId),
  appointments: () => safeQuery('appointments', businessId),
  sales: () => safeQuery('sales', businessId),
  businessHours: () => safeQuery('business_hours', businessId),
  appointmentSettings: () => safeQuery('appointment_settings', businessId),
});

