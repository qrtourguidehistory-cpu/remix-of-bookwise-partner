/**
 * Business change limits utilities
 * Note: business_name_changes and business_category_changes tables don't exist yet
 * These functions are stubs that always allow changes until the tables are created
 */

/**
 * Check if a business can change its name (1 time per year limit)
 * TODO: Implement when business_name_changes table is created
 */
export async function canChangeBusinessName(businessId: string): Promise<{
  canChange: boolean;
  changesThisYear: number;
  nextChangeDate?: Date;
  message?: string;
}> {
  // Always allow for now - table doesn't exist yet
  return {
    canChange: true,
    changesThisYear: 0,
  };
}

/**
 * Check if a business can change its categories (2 times per year limit)
 * TODO: Implement when business_category_changes table is created
 */
export async function canChangeBusinessCategories(businessId: string): Promise<{
  canChange: boolean;
  changesThisYear: number;
  nextChangeDate?: Date;
  message?: string;
}> {
  // Always allow for now - table doesn't exist yet
  return {
    canChange: true,
    changesThisYear: 0,
  };
}

/**
 * Record a business name change
 * TODO: Implement when business_name_changes table is created
 */
export async function recordBusinessNameChange(
  businessId: string,
  oldName: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  // No-op for now - table doesn't exist yet
  console.log("recordBusinessNameChange: table not implemented yet", { businessId, oldName, newName });
  return { success: true };
}

/**
 * Record a business category change
 * TODO: Implement when business_category_changes table is created
 */
export async function recordBusinessCategoryChange(
  businessId: string,
  oldPrimary: string | null,
  newPrimary: string | null,
  oldSecondary: string[] | null,
  newSecondary: string[] | null
): Promise<{ success: boolean; error?: string }> {
  // No-op for now - table doesn't exist yet
  console.log("recordBusinessCategoryChange: table not implemented yet", { businessId, oldPrimary, newPrimary });
  return { success: true };
}
