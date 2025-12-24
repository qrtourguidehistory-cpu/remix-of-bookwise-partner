/**
 * Query Validator - Development tool to catch missing business_id filters
 * 
 * This validator helps catch security issues during development.
 * It should be used in development mode only.
 */

const TABLES_REQUIRING_BUSINESS_ID = [
  'clients',
  'staff',
  'services',
  'appointments',
  'sales',
  'business_hours',
  'appointment_settings',
  'staff_schedules',
  'staff_time_off',
  'staff_early_departures',
  'commission_configs',
  'commission_payments',
];

/**
 * Validates that a Supabase query includes business_id filter
 * Only runs in development mode
 */
export function validateQuery(
  tableName: string,
  queryString: string,
  hasBusinessIdFilter: boolean
): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  if (!TABLES_REQUIRING_BUSINESS_ID.includes(tableName)) {
    return;
  }

  if (!hasBusinessIdFilter) {
    console.error(
      `🚨 SECURITY WARNING: Query to "${tableName}" is missing business_id filter!\n` +
      `Query: ${queryString}\n` +
      `Please add .eq("business_id", profile.business_id) to your query.`
    );
    
    // In development, you might want to throw an error to catch this early
    // Uncomment the line below if you want strict validation:
    // throw new Error(`Missing business_id filter in query to ${tableName}`);
  }
}

/**
 * Creates a wrapper around Supabase that validates queries
 */
export function createValidatedSupabaseClient(originalSupabase: any) {
  if (process.env.NODE_ENV !== 'development') {
    return originalSupabase;
  }

  return new Proxy(originalSupabase, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const queryBuilder = target.from(table);
          
          // Wrap the query builder methods to validate
          return new Proxy(queryBuilder, {
            get(queryTarget, queryProp) {
              const originalMethod = queryTarget[queryProp as keyof typeof queryTarget];
              
              if (typeof originalMethod === 'function') {
                return function(...args: any[]) {
                  const result = originalMethod.apply(queryTarget, args);
                  
                  // Check if business_id filter is present
                  // This is a simplified check - in production you'd need more sophisticated validation
                  const queryString = JSON.stringify(args);
                  const hasBusinessIdFilter = 
                    queryString.includes('business_id') ||
                    queryString.includes('eq("business_id"') ||
                    queryString.includes("eq('business_id'");
                  
                  validateQuery(table, queryString, hasBusinessIdFilter);
                  
                  return result;
                };
              }
              
              return originalMethod;
            }
          });
        };
      }
      
      return target[prop as keyof typeof target];
    }
  });
}

