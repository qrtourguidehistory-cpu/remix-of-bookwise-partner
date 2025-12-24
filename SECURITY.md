# Security Guidelines - BookWise Partner

## Data Isolation Between Businesses

This document outlines security practices to ensure data isolation between different businesses in the BookWise Partner application.

## Critical Rules

### 1. Always Filter by `business_id`

**NEVER** query tables without filtering by `business_id`:

```typescript
// ❌ WRONG - Exposes data from all businesses
const { data } = await supabase
  .from("clients")
  .select("*");

// ✅ CORRECT - Only shows data from current business
const { data } = await supabase
  .from("clients")
  .select("*")
  .eq("business_id", profile.business_id);
```

### 2. Tables Requiring `business_id` Filter

These tables **MUST** always be filtered by `business_id`:

- `clients`
- `staff`
- `services`
- `appointments`
- `sales`
- `business_hours`
- `appointment_settings`
- `staff_schedules`
- `staff_time_off`
- `staff_early_departures`
- `commission_configs`
- `commission_payments`

### 3. Using Helper Functions

Use the helper functions from `src/lib/supabaseHelpers.ts`:

```typescript
import { safeQuery, createBusinessQuery } from '@/lib/supabaseHelpers';

// Option 1: Using safeQuery
const { data } = await safeQuery('clients', profile.business_id)
  .select('*')
  .order('full_name');

// Option 2: Using createBusinessQuery
const queries = createBusinessQuery(profile.business_id);
const { data } = await queries.clients()
  .select('*')
  .order('full_name');
```

### 4. Always Validate `business_id` Exists

Before making queries, always check that `business_id` exists:

```typescript
if (!profile?.business_id) {
  console.error('business_id is required');
  return;
}

const { data } = await supabase
  .from("clients")
  .select("*")
  .eq("business_id", profile.business_id);
```

### 5. Row Level Security (RLS)

The database has RLS policies that provide a **secondary layer** of protection, but you should **never rely solely on RLS**. Always filter in your application code as well.

## Code Review Checklist

When reviewing code, check:

- [ ] All queries to business-scoped tables include `.eq("business_id", profile.business_id)`
- [ ] `business_id` is validated before queries
- [ ] No queries use `.select("*")` without filtering by `business_id`
- [ ] Helper functions from `supabaseHelpers.ts` are used when possible
- [ ] New tables added to the system are included in RLS policies

## Testing

When testing:

1. Create multiple test businesses
2. Verify that each business only sees its own data
3. Verify that switching between businesses shows different data
4. Test with accounts that have no `business_id` (should show no data)

## Reporting Security Issues

If you find a security issue:

1. **DO NOT** commit the fix directly to main branch
2. Create a private security issue
3. Fix the issue in a separate branch
4. Test thoroughly before merging

## Database Policies

The database has RLS policies that enforce:

- Users can only view data from their own business
- Users can only create data in their own business
- Users can only update/delete data from their own business

These policies are a **safety net**, but application-level filtering is still required.

