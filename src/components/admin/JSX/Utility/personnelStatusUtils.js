import { supabase } from "../../../../lib/supabaseClient";

/**
 * Check if personnel is inactive (retired/resigned)
 * @param {Object} personnel - Personnel record
 * @returns {Object} - { isActive: boolean, status: string, reason: string }
 */
/**
 * Check if personnel is inactive (retired/resigned ONLY)
 */
export const checkPersonnelStatus = (personnel) => {
  const defaultStatus = {
    isActive: true,
    status: "Active",
    reason: "",
    shouldDisplay: true,
  };

  if (!personnel) return defaultStatus;

  // Check status field - ONLY Retirement and Resignation should be considered inactive
  if (personnel.status === 'Retired' || personnel.status === 'Resigned') {
    return {
      isActive: false,
      status: personnel.status,
      reason: personnel.separation_reason || `Marked as ${personnel.status}`,
      shouldDisplay: false,
    };
  }

  // Equipment Completion should NOT affect active status
  if (personnel.status === 'Equipment Completed') {
    return {
      isActive: true, // STAYS ACTIVE
      status: 'Active',
      reason: 'Equipment clearance completed',
      shouldDisplay: true,
    };
  }

  // Check is_active field
  if (personnel.is_active === false && 
      personnel.status !== 'Active' &&
      (personnel.status === 'Retired' || personnel.status === 'Resigned')) {
    return {
      isActive: false,
      status: personnel.status || 'Inactive',
      reason: personnel.separation_reason || 'Account deactivated',
      shouldDisplay: false,
    };
  }

  return defaultStatus;
};
/**
 * Filter active personnel from array
 * @param {Array} personnelList - Array of personnel records
 * @returns {Array} - Filtered array with only active personnel
 */
export const filterActivePersonnel = (personnelList) => {
  if (!Array.isArray(personnelList)) return [];

  return personnelList.filter((person) => {
    const status = checkPersonnelStatus(person);
    return status.shouldDisplay;
  });
};

/**
 * Filter inactive personnel from array
 * @param {Array} personnelList - Array of personnel records
 * @returns {Array} - Filtered array with only inactive personnel
 */
export const filterInactivePersonnel = (personnelList) => {
  if (!Array.isArray(personnelList)) return [];

  return personnelList.filter((person) => {
    const status = checkPersonnelStatus(person);
    return !status.shouldDisplay;
  });
};

/**
 * Get personnel status summary
 * @param {Array} personnelList - Array of personnel records
 * @returns {Object} - Summary counts
 */
export const getPersonnelStatusSummary = (personnelList) => {
  if (!Array.isArray(personnelList)) {
    return { active: 0, inactive: 0, retired: 0, resigned: 0, total: 0 };
  }

  let active = 0;
  let inactive = 0;
  let retired = 0;
  let resigned = 0;

  personnelList.forEach((person) => {
    const status = checkPersonnelStatus(person);

    if (!status.shouldDisplay) {
      inactive++;

      if (status.status === "Retired") {
        retired++;
      } else if (
        status.status === "Resigned" ||
        status.status === "Separated"
      ) {
        resigned++;
      }
    } else {
      active++;
    }
  });

  return {
    active,
    inactive,
    retired,
    resigned,
    total: personnelList.length,
  };
};

/**
 * Update personnel status in database
 * @param {string} personnelId - Personnel ID
 * @param {Object} statusData - Status update data
 * @returns {Promise<Object>} - Result of update
 */
export const updatePersonnelStatus = async (personnelId, statusData) => {
  try {
    const updateData = {
      updated_at: new Date().toISOString(),
      ...statusData,
    };

    // If setting to inactive, also update is_active
    if (statusData.status && statusData.status !== "Active") {
      updateData.is_active = false;
    }

    // If setting to active, ensure is_active is true
    if (statusData.status === "Active") {
      updateData.is_active = true;
      updateData.separation_type = null;
      updateData.separation_date = null;
      updateData.separation_reason = null;
      updateData.retirement_date = null;
    }

    const { data, error } = await supabase
      .from("personnel")
      .update(updateData)
      .eq("id", personnelId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      message: "Personnel status updated successfully",
    };
  } catch (error) {
    console.error("Error updating personnel status:", error);
    return {
      success: false,
      error: error.message,
      message: "Failed to update personnel status",
    };
  }
};

/**
 * Mark personnel as retired
 * @param {string} personnelId - Personnel ID
 * @param {string} retirementDate - Retirement date (YYYY-MM-DD)
 * @param {string} reason - Retirement reason (optional)
 * @returns {Promise<Object>} - Result
 */
export const markPersonnelAsRetired = async (
  personnelId,
  retirementDate,
  reason = "Retirement"
) => {
  return updatePersonnelStatus(personnelId, {
    status: "Retired",
    retirement_date: retirementDate,
    separation_type: "Retirement",
    separation_date: retirementDate,
    separation_reason: reason,
    is_active: false,
  });
};

/**
 * Mark personnel as resigned
 * @param {string} personnelId - Personnel ID
 * @param {string} separationDate - Separation date (YYYY-MM-DD)
 * @param {string} reason - Resignation reason (optional)
 * @returns {Promise<Object>} - Result
 */
export const markPersonnelAsResigned = async (
  personnelId,
  separationDate,
  reason = "Resignation"
) => {
  return updatePersonnelStatus(personnelId, {
    status: "Resigned",
    separation_type: "Resignation",
    separation_date: separationDate,
    separation_reason: reason,
    is_active: false,
  });
};

/**
 * Reactivate personnel
 * @param {string} personnelId - Personnel ID
 * @returns {Promise<Object>} - Result
 */
export const reactivatePersonnel = async (personnelId) => {
  return updatePersonnelStatus(personnelId, {
    status: "Active",
    is_active: true,
    separation_type: null,
    separation_date: null,
    separation_reason: null,
    retirement_date: null,
  });
};
