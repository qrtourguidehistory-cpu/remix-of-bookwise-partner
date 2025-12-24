import { supabase } from "./supabaseClient";

interface CreateEarlyArrivalRequestParams {
  appointmentId: string;
  businessId: string;
  staffId: string | null;
}

interface RespondToRequestParams {
  requestId: string;
  response: "accepted" | "rejected";
}

/**
 * Create an early arrival request for an appointment
 * This does NOT change the appointment status, only creates a request
 */
export async function createEarlyArrivalRequest({
  appointmentId,
  businessId,
  staffId,
}: CreateEarlyArrivalRequestParams): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    // Call the PostgreSQL function to create the request
    const { data: functionResult, error: functionError } = await supabase.rpc(
      "create_early_arrival_request",
      {
        p_appointment_id: appointmentId,
        p_business_id: businessId,
        p_staff_id: staffId,
      }
    );

    if (functionError) {
      console.error("Error calling create_early_arrival_request function:", functionError);
      return { success: false, error: functionError.message };
    }

    // The function returns an array with one object
    const result = Array.isArray(functionResult) ? functionResult[0] : functionResult;
    
    if (!result || !result.success) {
      const errorMsg = result?.error || "Unknown error";
      return { success: false, error: errorMsg };
    }

    const requestId = result.request_id;

    // Call the Edge Function to send notification
    try {
      const { data: edgeFunctionResult, error: edgeFunctionError } = await supabase.functions.invoke(
        "send-early-arrival-request",
        {
          body: {
            requestId,
            appointmentId,
            businessId,
          },
        }
      );

      if (edgeFunctionError) {
        console.error("❌ Error calling send-early-arrival-request function:", edgeFunctionError);
        console.error("Edge function error details:", JSON.stringify(edgeFunctionError, null, 2));
        // Still return success since the request was created, but log the error
        return { success: true, requestId, error: `Request created but notification failed: ${edgeFunctionError.message}` };
      }

      if (edgeFunctionResult && !edgeFunctionResult.success) {
        console.error("❌ Edge function returned error:", edgeFunctionResult.error);
        // Still return success since the request was created, but log the error
        return { success: true, requestId, error: `Request created but notification failed: ${edgeFunctionResult.error}` };
      }

      console.log("✅ Early arrival request created and notification sent:", { 
        requestId, 
        notified: edgeFunctionResult?.notified,
        edgeFunctionResult 
      });
      
      // If notification failed, show warning
      if (edgeFunctionResult && !edgeFunctionResult.notified) {
        console.warn("⚠️ Request created but notification may not have been sent. Check Edge Function logs.");
      }
      
      return { success: true, requestId };
    } catch (invokeError: any) {
      console.error("Exception calling send-early-arrival-request function:", invokeError);
      // Still return success since the request was created
      return { success: true, requestId, error: `Request created but notification failed: ${invokeError.message}` };
    }
  } catch (error: any) {
    console.error("Error in createEarlyArrivalRequest:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

/**
 * Respond to an early arrival request (accept or reject)
 * Only when accepted, the appointment times are moved
 */
export async function respondToEarlyArrivalRequest({
  requestId,
  response,
}: RespondToRequestParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: functionResult, error: functionError } = await supabase.rpc(
      "respond_to_early_arrival_request",
      {
        p_request_id: requestId,
        p_response: response,
      }
    );

    if (functionError) {
      console.error("Error calling respond_to_early_arrival_request function:", functionError);
      return { success: false, error: functionError.message };
    }

    // The function returns an array with one object
    const result = Array.isArray(functionResult) ? functionResult[0] : functionResult;
    
    if (!result || !result.success) {
      const errorMsg = result?.error || "Unknown error";
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in respondToEarlyArrivalRequest:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

