/**
 * Service for handling early arrival requests in the client app
 * This file should be copied to the BookWise Client app
 */

import { supabase } from './supabaseClient';

interface RespondToRequestParams {
  requestId: string;
  response: 'accepted' | 'rejected';
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
      'respond_to_early_arrival_request',
      {
        p_request_id: requestId,
        p_response: response,
      }
    );

    if (functionError) {
      console.error('Error calling respond_to_early_arrival_request function:', functionError);
      return { success: false, error: functionError.message };
    }

    // The function returns an array with one object
    const result = Array.isArray(functionResult) ? functionResult[0] : functionResult;
    
    if (!result || !result.success) {
      const errorMsg = result?.error || 'Unknown error';
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in respondToEarlyArrivalRequest:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

