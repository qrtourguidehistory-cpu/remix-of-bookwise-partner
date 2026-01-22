import { supabase } from "@/integrations/supabase/client";

export interface PublicVisibilityRequirements {
  isValid: boolean;
  missingRequirements: string[];
  requirements: {
    logo: boolean;
    coverImage: boolean;
    phone: boolean;
    address: boolean;
  };
}

/**
 * Validates if a business meets all requirements to enable public visibility
 */
export async function validatePublicVisibilityRequirements(
  businessId: string
): Promise<PublicVisibilityRequirements> {
  const missingRequirements: string[] = [];
  const requirements = {
    logo: false,
    coverImage: false,
    phone: false,
    address: false,
  };

  try {
    // Fetch business data
    const { data: business, error: businessError } = await (supabase
      .from("businesses")
      .select(
        "logo_url, cover_image_url, phone, address, location_details"
      )
      .eq("id", businessId)
      .single() as any);

    if (businessError) throw businessError;

    const biz = business as any;

    // Check logo
    if (biz.logo_url && biz.logo_url.trim().length > 0) {
      requirements.logo = true;
    } else {
      missingRequirements.push("Logo del establecimiento");
    }

    // Check cover image
    if (biz.cover_image_url && biz.cover_image_url.trim().length > 0) {
      requirements.coverImage = true;
    } else {
      missingRequirements.push("Imagen de portada del establecimiento");
    }

    // Check phone
    if (biz.phone && biz.phone.trim().length > 0) {
      requirements.phone = true;
    } else {
      missingRequirements.push("Contacto (teléfono)");
    }

    // Check address
    if (biz.address && biz.address.trim().length > 0) {
      requirements.address = true;
    } else {
      missingRequirements.push("Dirección del establecimiento");
    }

    const isValid = missingRequirements.length === 0;

    return {
      isValid,
      missingRequirements,
      requirements,
    };
  } catch (error) {
    console.error("Error validating public visibility requirements:", error);
    return {
      isValid: false,
      missingRequirements: ["Error al validar requisitos"],
      requirements,
    };
  }
}

