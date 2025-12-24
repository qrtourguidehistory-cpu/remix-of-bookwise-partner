import { supabase } from "./supabaseClient";

/**
 * Check if a business can change its name (1 time per year limit)
 */
export async function canChangeBusinessName(businessId: string): Promise<{
  canChange: boolean;
  changesThisYear: number;
  nextChangeDate?: Date;
  message?: string;
}> {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    // Count changes in the current year
    const { data: changes, error } = await supabase
      .from("business_name_changes")
      .select("changed_at")
      .eq("business_id", businessId)
      .gte("changed_at", startOfYear.toISOString())
      .order("changed_at", { ascending: false });

    if (error) throw error;

    const changesThisYear = changes?.length || 0;
    const canChange = changesThisYear < 1;

    if (!canChange && changes && changes.length > 0) {
      // Calculate next available date (1 year from last change)
      const lastChange = new Date(changes[0].changed_at);
      const nextChangeDate = new Date(lastChange);
      nextChangeDate.setFullYear(nextChangeDate.getFullYear() + 1);
      
      return {
        canChange: false,
        changesThisYear,
        nextChangeDate,
        message: `Ya has cambiado el nombre 1 vez este año. Podrás cambiarlo nuevamente después del ${nextChangeDate.toLocaleDateString('es-ES')}`,
      };
    }

    return {
      canChange: true,
      changesThisYear,
    };
  } catch (error) {
    console.error("Error checking business name change limit:", error);
    return {
      canChange: false,
      changesThisYear: 0,
      message: "Error al verificar límite de cambios",
    };
  }
}

/**
 * Check if a business can change its categories (2 times per year limit)
 */
export async function canChangeBusinessCategories(businessId: string): Promise<{
  canChange: boolean;
  changesThisYear: number;
  nextChangeDate?: Date;
  message?: string;
}> {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    // Count changes in the current year
    const { data: changes, error } = await supabase
      .from("business_category_changes")
      .select("changed_at")
      .eq("business_id", businessId)
      .gte("changed_at", startOfYear.toISOString())
      .order("changed_at", { ascending: false });

    if (error) throw error;

    const changesThisYear = changes?.length || 0;
    const canChange = changesThisYear < 2;

    if (!canChange && changes && changes.length > 0) {
      // Calculate next available date (1 year from second-to-last change, or from last if only 1 change)
      const relevantChange = changes.length >= 2 ? changes[1] : changes[0];
      const lastChange = new Date(relevantChange.changed_at);
      const nextChangeDate = new Date(lastChange);
      nextChangeDate.setFullYear(nextChangeDate.getFullYear() + 1);
      
      return {
        canChange: false,
        changesThisYear,
        nextChangeDate,
        message: `Ya has cambiado las categorías 2 veces este año. Podrás cambiarlas nuevamente después del ${nextChangeDate.toLocaleDateString('es-ES')}`,
      };
    }

    return {
      canChange: true,
      changesThisYear,
    };
  } catch (error) {
    console.error("Error checking business category change limit:", error);
    return {
      canChange: false,
      changesThisYear: 0,
      message: "Error al verificar límite de cambios",
    };
  }
}

/**
 * Record a business name change
 */
export async function recordBusinessNameChange(
  businessId: string,
  oldName: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("business_name_changes")
      .insert({
        business_id: businessId,
        old_name: oldName,
        new_name: newName,
      });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Error recording business name change:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Record a business category change
 */
export async function recordBusinessCategoryChange(
  businessId: string,
  oldPrimary: string | null,
  newPrimary: string | null,
  oldSecondary: string[] | null,
  newSecondary: string[] | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("business_category_changes")
      .insert({
        business_id: businessId,
        old_primary_category: oldPrimary,
        new_primary_category: newPrimary,
        old_secondary_categories: oldSecondary || [],
        new_secondary_categories: newSecondary || [],
      });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Error recording business category change:", error);
    return { success: false, error: error.message };
  }
}

