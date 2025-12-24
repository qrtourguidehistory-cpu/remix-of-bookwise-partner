import { supabase } from "./supabaseClient";

interface InviteClientEarlyParams {
  appointmentId: string;
  businessId: string;
  staffId: string | null; // staffId can be null
}

export async function inviteClientEarly({
  appointmentId,
  businessId,
  staffId,
}: InviteClientEarlyParams): Promise<{ success: boolean; error?: string }> {
  try {
    // First, call the PostgreSQL function to validate and update
    const { data: functionResult, error: functionError } = await supabase.rpc(
      "invite_client_early",
      {
        p_appointment_id: appointmentId,
        p_business_id: businessId,
        p_staff_id: staffId,
      }
    );

    if (functionError) {
      console.error("Error calling invite_client_early function:", functionError);
      return { success: false, error: functionError.message };
    }

    const result = functionResult as any;
    if (!result || !result.success) {
      const errorMsg = result?.error || "Unknown error";
      return { success: false, error: errorMsg };
    }

    // Then, call the Edge Function to send notification
    // Use supabase.functions.invoke instead of direct fetch
    const { data: edgeFunctionResult, error: edgeFunctionError } = await supabase.functions.invoke(
      "invite-client-early",
      {
        body: {
          appointmentId,
          businessId,
          staffId,
        },
      }
    );

    if (edgeFunctionError) {
      console.error("Error calling invite-client-early function:", edgeFunctionError);
      // Still return success since the database was updated
      return { success: true, error: edgeFunctionError.message };
    }

    if (edgeFunctionResult && !edgeFunctionResult.success) {
      console.error("Edge function returned error:", edgeFunctionResult.error);
      // Still return success since the database was updated
      return { success: true, error: edgeFunctionResult.error };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in inviteClientEarly:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

