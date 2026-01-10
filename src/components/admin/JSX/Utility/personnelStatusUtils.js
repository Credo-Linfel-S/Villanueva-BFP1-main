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

  // ONLY Retirement and Resignation should mark as inactive
  if (personnel.status === "Retired" || personnel.status === "Resigned") {
    return {
      isActive: false,
      status: personnel.status,
      reason: personnel.separation_reason || `Marked as ${personnel.status}`,
      shouldDisplay: false,
    };
  }

  // Equipment Completion should NOT affect active status - it's for promotions/clearances
  if (personnel.status === "Equipment Completed") {
    return {
      isActive: true, // STAYS ACTIVE
      status: "Active", // Display as Active
      reason: "Equipment clearance completed",
      shouldDisplay: true,
    };
  }

  // Check is_active field - but only if status is retired/resigned
  if (
    personnel.is_active === false &&
    (personnel.status === "Retired" || personnel.status === "Resigned")
  ) {
    return {
      isActive: false,
      status: personnel.status || "Inactive",
      reason: personnel.separation_reason || "Account deactivated",
      shouldDisplay: false,
    };
  }
  if (personnel.status === "Transferred") {
    return {
      isActive: false, // Transferred personnel are inactive
      status: "Transferred",
      reason: "Transferred to another station/unit",
      shouldDisplay: false, // Don't display in active personnel
    };
  }
  return defaultStatus;
};
/**
 * Filter active personnel from array
 * @param {Array} personnelList - Array of personnel records
 * @returns {Array} - Filtered array with only active personnel
 */
// In personnelStatusUtils.js
export const filterActivePersonnel = (personnelList) => {
  if (!Array.isArray(personnelList)) return [];

  return personnelList.filter((person) => {
    // Simplified: Only show personnel with status 'Active' or null/empty status
    // and is_active should be true
    const hasActiveStatus = !person.status || 
                           person.status === 'Active' || 
                           person.status === 'Equipment Completed';
    
    const isActiveFlag = person.is_active !== false;
    
    return hasActiveStatus && isActiveFlag;
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
    return {
      active: 0,
      inactive: 0,
      retired: 0,
      resigned: 0,
      transferred: 0,
      total: 0,
    };
  }

  let active = 0;
  let inactive = 0;
  let retired = 0;
  let resigned = 0;
  let transferred = 0;

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
      } else if (status.status === "Transferred") {
        transferred++; // Count transferred personnel
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
    transferred, // Add transferred count
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
 * Mark personnel as transferred
 * @param {string} personnelId - Personnel ID
 * @param {string} transferDate - Transfer date (YYYY-MM-DD)
 * @param {string} newStation - New station/unit
 * @param {string} reason - Transfer reason (optional)
 * @returns {Promise<Object>} - Result
 */
export const markPersonnelAsTransferred = async (
  personnelId,
  transferDate,
  newStation,
  reason = "Transfer"
) => {
  return updatePersonnelStatus(personnelId, {
    status: "Transferred",
    station: newStation, // Update to new station
    separation_type: "Transfer",
    separation_date: transferDate,
    separation_reason: reason,
    is_active: false,
  });
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
