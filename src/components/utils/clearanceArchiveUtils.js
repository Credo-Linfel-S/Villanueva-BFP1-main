import { supabase } from "../../lib/supabaseClient.js";

// ================================
// ENHANCED ARCHIVE FUNCTIONS
// ================================


// ================================
// ARCHIVE FUNCTIONS
// ================================

/**
 * SIMPLE ARCHIVE - For personnel without equipment
 * Transfers basic clearance data to clearance_records
 */
export const simpleArchive = async (clearanceId, clearanceData) => {
  try {
    console.log("📦 Simple archive for clearance:", clearanceId);

    // Get the clearance request details
    const { data: clearance, error: clearanceError } = await supabase
      .from("clearance_requests")
      .select("*")
      .eq("id", clearanceId)
      .single();

    if (clearanceError) throw clearanceError;

    // ONLY archive Completed or Rejected clearances
    if (!["Completed", "Rejected"].includes(clearance.status)) {
      throw new Error(
        `Cannot archive clearance with status: ${clearance.status}. Only Completed or Rejected clearances can be archived.`
      );
    }

    // Check if already archived
    const { data: existingArchive } = await supabase
      .from("clearance_records")
      .select("id")
      .eq("clearance_request_id", clearanceId)
      .single();

    if (existingArchive) {
      return {
        success: true,
        message: "Already archived",
        archiveId: existingArchive.id,
      };
    }

    // Get personnel data
    const { data: personnel, error: personnelError } = await supabase
      .from("personnel")
      .select("first_name, last_name, rank, badge_number, station")
      .eq("id", clearance.personnel_id)
      .single();

    if (personnelError) throw personnelError;

    // Determine year for archiving
    const year = clearance.completed_at
      ? new Date(clearance.completed_at).getFullYear()
      : new Date(clearance.created_at).getFullYear();

    // Determine clearance status for archive
    let clearanceStatus;
    switch (clearance.status.toUpperCase()) {
      case "COMPLETED":
        clearanceStatus = "CLEARED";
        break;
      case "REJECTED":
        clearanceStatus = "REJECTED";
        break;
      case "CANCELLED":
        clearanceStatus = "CANCELLED";
        break;
      default:
        clearanceStatus = "PENDING";
    }

    // Create simple archive record
    const archiveRecord = {
      year: year,
      personnel_id: clearance.personnel_id,
      personnel_name: `${personnel.first_name} ${personnel.last_name}`,
      rank: personnel.rank,
      badge_number: personnel.badge_number,
      station: personnel.station,
      clearance_status: clearanceStatus,
      clearance_type: clearance.type,
      clearance_request_id: clearance.id,
      departments_cleared: clearance.departments_cleared || [],
      departments_pending: clearance.pending_departments || [],
      clearance_initiated_date: clearance.created_at,
      clearance_completed_date: clearance.completed_at,
      record_generated_date: new Date().toISOString().split("T")[0],
      generated_by: "System Archive",
      generated_by_id: clearance.initiated_by_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert into clearance_records
    const { data: archivedRecord, error: insertError } = await supabase
      .from("clearance_records")
      .insert([archiveRecord])
      .select()
      .single();

    if (insertError) throw insertError;

    // Mark as archived in clearance_requests
    try {
      const updateData = {
        updated_at: new Date().toISOString(),
      };
      
      updateData.archived_at = new Date().toISOString();
      updateData.archive_status = "archived";
      
      await supabase
        .from("clearance_requests")
        .update(updateData)
        .eq("id", clearanceId);
    } catch (updateError) {
      console.warn("Could not update archive status:", updateError);
    }

    console.log("✅ Successfully archived clearance:", clearanceId);
    return {
      success: true,
      message: "Archived successfully",
      archiveId: archivedRecord.id,
    };
  } catch (error) {
    console.error("❌ Simple archive error:", error);
    throw error;
  }
};

/**
 * ARCHIVE WITH EQUIPMENT DATA - For personnel with equipment accountability
 * Transfers clearance data including equipment and financial information
 */
export const archiveWithEquipmentData = async (clearanceId, clearanceData) => {
  try {
    console.log("📦 Archive with equipment data for clearance:", clearanceId);

    // Get the clearance request details
    const { data: clearance, error: clearanceError } = await supabase
      .from("clearance_requests")
      .select("*")
      .eq("id", clearanceId)
      .single();

    if (clearanceError) throw clearanceError;

    // ONLY archive Completed or Rejected clearances
    if (!["Completed", "Rejected"].includes(clearance.status)) {
      throw new Error(
        `Cannot archive clearance with status: ${clearance.status}. Only Completed or Rejected clearances can be archived.`
      );
    }

    // Check if already archived
    const { data: existingArchive } = await supabase
      .from("clearance_records")
      .select("id")
      .eq("clearance_request_id", clearanceId)
      .single();

    if (existingArchive) {
      return {
        success: true,
        message: "Already archived",
        archiveId: existingArchive.id,
      };
    }

    // Get personnel data
    const { data: personnel, error: personnelError } = await supabase
      .from("personnel")
      .select("first_name, last_name, rank, badge_number, station")
      .eq("id", clearance.personnel_id)
      .single();

    if (personnelError) throw personnelError;

    // ===== EQUIPMENT DATA SECTION =====
    let equipmentSummary = {
      total_equipment_count: 0,
      cleared_equipment_count: 0,
      pending_equipment_count: 0,
      lost_equipment_count: 0,
      damaged_equipment_count: 0,
      total_equipment_value: 0,
    };

    try {
      // Get equipment summary for the clearance
      const { data: equipmentData, error: equipmentError } = await supabase
        .from("personnel_equipment_accountability_table")
        .select(
          `
          equipment_id,
          equipment_status,
          equipment:equipment_id (
            estimated_value,
            category,
            item_name
          )
        `
        )
        .eq("clearance_request_id", clearanceId);

      if (!equipmentError && equipmentData) {
        equipmentSummary = {
          total_equipment_count: equipmentData?.length || 0,
          cleared_equipment_count:
            equipmentData?.filter((e) =>
              ["RETURNED", "CLEARED", "SETTLED"].includes(e.equipment_status)
            ).length || 0,
          pending_equipment_count:
            equipmentData?.filter((e) =>
              ["PENDING", "ISSUED", "ON_HAND"].includes(e.equipment_status)
            ).length || 0,
          lost_equipment_count:
            equipmentData?.filter((e) => e.equipment_status === "LOST").length || 0,
          damaged_equipment_count:
            equipmentData?.filter((e) => e.equipment_status === "DAMAGED").length ||
            0,
          total_equipment_value:
            equipmentData?.reduce(
              (sum, item) =>
                sum + (parseFloat(item.equipment?.estimated_value) || 0),
              0
            ) || 0,
        };
      }
    } catch (equipmentError) {
      console.warn("Could not fetch equipment data:", equipmentError);
      // Continue without equipment data
    }

    // ===== ACCOUNTABILITY DATA SECTION =====
    let accountabilitySummary = {
      outstanding_amount: 0,
      settled_amount: 0,
    };

    try {
      // Get accountability summary
      const { data: accountabilityData, error: accountabilityError } =
        await supabase
          .from("accountability_records")
          .select("amount, is_settled, description")
          .eq("clearance_request_id", clearanceId);

      if (!accountabilityError && accountabilityData) {
        const settledRecords =
          accountabilityData?.filter((a) => a.is_settled) || [];
        const unsettledRecords =
          accountabilityData?.filter((a) => !a.is_settled) || [];

        accountabilitySummary = {
          outstanding_amount: unsettledRecords.reduce(
            (sum, item) => sum + (parseFloat(item.amount) || 0),
            0
          ),
          settled_amount: settledRecords.reduce(
            (sum, item) => sum + (parseFloat(item.amount) || 0),
            0
          ),
        };
      }
    } catch (accountabilityError) {
      console.warn("Could not fetch accountability data:", accountabilityError);
      // Continue without accountability data
    }

    // Determine year for archiving
    const year = clearance.completed_at
      ? new Date(clearance.completed_at).getFullYear()
      : new Date(clearance.created_at).getFullYear();

    // Determine clearance status for archive
    let clearanceStatus;
    switch (clearance.status.toUpperCase()) {
      case "COMPLETED":
        clearanceStatus = "CLEARED";
        break;
      case "REJECTED":
        clearanceStatus = "REJECTED";
        break;
      case "CANCELLED":
        clearanceStatus = "CANCELLED";
        break;
      default:
        clearanceStatus = "PENDING";
    }

    // Create the archive record with equipment data
    const archiveRecord = {
      year: year,
      personnel_id: clearance.personnel_id,
      personnel_name: `${personnel.first_name} ${personnel.last_name}`,
      rank: personnel.rank,
      badge_number: personnel.badge_number,
      station: personnel.station,
      clearance_status: clearanceStatus,
      clearance_type: clearance.type,
      clearance_request_id: clearance.id,
      departments_cleared: clearance.departments_cleared || [],
      departments_pending: clearance.pending_departments || [],
      total_equipment_count: equipmentSummary.total_equipment_count,
      cleared_equipment_count: equipmentSummary.cleared_equipment_count,
      pending_equipment_count: equipmentSummary.pending_equipment_count,
      lost_equipment_count: equipmentSummary.lost_equipment_count,
      damaged_equipment_count: equipmentSummary.damaged_equipment_count,
      total_equipment_value: equipmentSummary.total_equipment_value,
      outstanding_amount: accountabilitySummary.outstanding_amount,
      settled_amount: accountabilitySummary.settled_amount,
      clearance_initiated_date: clearance.created_at,
      clearance_completed_date: clearance.completed_at,
      record_generated_date: new Date().toISOString().split("T")[0],
      generated_by: "System Archive",
      generated_by_id: clearance.initiated_by_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert into clearance_records
    const { data: archivedRecord, error: insertError } = await supabase
      .from("clearance_records")
      .insert([archiveRecord])
      .select()
      .single();

    if (insertError) throw insertError;

    // Mark as archived in clearance_requests
    try {
      const updateData = {
        updated_at: new Date().toISOString(),
      };
      
      updateData.archived_at = new Date().toISOString();
      updateData.archive_status = "archived";
      
      await supabase
        .from("clearance_requests")
        .update(updateData)
        .eq("id", clearanceId);
    } catch (updateError) {
      console.warn("Could not update archive status:", updateError);
    }

    console.log("✅ Successfully archived with equipment data:", clearanceId);
    return {
      success: true,
      message: "Archived with equipment and accountability data",
      archiveId: archivedRecord.id,
    };
  } catch (error) {
    console.error("❌ Archive with equipment error:", error);
    throw error;
  }
};

/**
 * SMART ARCHIVE - Automatically chooses the right archive method
 * Use this as your main archive function
 */
export const smartArchive = async (clearanceId, clearanceData) => {
  try {
    console.log("🤖 Smart archive for clearance:", clearanceId);
    
    // Check clearance type to determine which archive method to use
    const clearanceType = clearanceData?.clearanceType?.toLowerCase() || "";
    
    // Clearance types that typically have equipment
    const equipmentTypes = [
      "equipment completion",
      "retirement",
      "resignation",
      "transfer"
    ];
    
    // Clearance types that typically DON'T have equipment
    const nonEquipmentTypes = [
      "promotion",
      "administrative",
      "others",
      "general"
    ];
    
    // Check if it's an equipment-related clearance
    const hasEquipmentType = equipmentTypes.some(type => 
      clearanceType.includes(type)
    );
    
    // For equipment types, try with equipment data first
    if (hasEquipmentType) {
      try {
        return await archiveWithEquipmentData(clearanceId, clearanceData);
      } catch (equipmentError) {
        console.warn("Equipment archive failed, trying simple archive:", equipmentError);
        // Fall back to simple archive
        return await simpleArchive(clearanceId, clearanceData);
      }
    }
    
    // For non-equipment types, use simple archive
    return await simpleArchive(clearanceId, clearanceData);
    
  } catch (error) {
    console.error("❌ Smart archive error:", error);
    throw error;
  }
};
/**
 * Delete from clearance_requests after archiving
 */
export const deleteAfterArchive = async (clearanceId, clearFromRequests = true) => {
  try {
    console.log("🔍 Checking archive status for deletion:", clearanceId);

    // Check if archived successfully
    const { data: archivedRecord, error: archiveCheckError } = await supabase
      .from("clearance_records")
      .select("id, clearance_status")
      .eq("clearance_request_id", clearanceId)
      .single();

    if (archiveCheckError) {
      return {
        success: false,
        message: "Not archived yet. Archive first before deleting.",
      };
    }

    // Delete from clearance_requests if requested
    if (clearFromRequests) {
      const { error: deleteError } = await supabase
        .from("clearance_requests")
        .delete()
        .eq("id", clearanceId);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return {
          success: false,
          message: "Failed to delete from clearance_requests",
        };
      }

      return {
        success: true,
        message: "Deleted from clearance_requests after archiving",
        archiveId: archivedRecord.id,
        deletedFromRequests: true
      };
    }

    return {
      success: true,
      message: "Successfully archived (kept in clearance_requests)",
      archiveId: archivedRecord.id,
      deletedFromRequests: false
    };
  } catch (error) {
    console.error("❌ Delete after archive error:", error);
    throw error;
  }
};

export const archiveAndDelete = async (clearanceId, record) => {
  try {
    console.log("🔄 Archive and delete for clearance:", clearanceId);

    // First, check if it's already archived
    const { data: existingArchive, error: checkError } = await supabase
      .from("clearance_records")
      .select("id")
      .eq("clearance_request_id", clearanceId)
      .single();

    let archiveResult;
    if (checkError || !existingArchive) {
      // Not archived yet, archive it first
      console.log("Archiving clearance first...");
      archiveResult = await smartArchive(clearanceId, record);
      
      if (!archiveResult.success) {
        throw new Error("Archive failed: " + archiveResult.message);
      }
    } else {
      // Already archived
      console.log("Already archived, using existing archive ID:", existingArchive.id);
      archiveResult = {
        success: true,
        archiveId: existingArchive.id,
        message: "Already archived"
      };
    }

    // CRITICAL FIX: First, disconnect the foreign key relationship
    console.log("Disconnecting foreign key relationship...");
    const { error: disconnectError } = await supabase
      .from("clearance_records")
      .update({ 
        clearance_request_id: null, // Break the relationship
        notes: COALESCE(record.notes, '') + ' Original request deleted',
        updated_at: new Date().toISOString()
      })
      .eq("id", archiveResult.archiveId);

    if (disconnectError) {
      console.error("Failed to disconnect foreign key:", disconnectError);
      throw new Error("Cannot disconnect archive record before deletion");
    }

    // Now safely delete from clearance_requests
    console.log("Deleting from clearance_requests...");
    const { error: deleteError } = await supabase
      .from("clearance_requests")
      .delete()
      .eq("id", clearanceId);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      
      // If deletion fails, reconnect the foreign key
      try {
        await supabase
          .from("clearance_records")
          .update({ 
            clearance_request_id: clearanceId,
            notes: COALESCE(record.notes, '') + ' (Deletion failed, reconnected)',
            updated_at: new Date().toISOString()
          })
          .eq("id", archiveResult.archiveId);
      } catch (restoreError) {
        console.error("Failed to restore foreign key:", restoreError);
      }
      
      throw new Error(`Failed to delete from clearance_requests: ${deleteError.message}`);
    }

    console.log("✅ Successfully archived and deleted clearance:", clearanceId);
    
    return {
      success: true,
      message: "Successfully archived and deleted from clearance_requests",
      archiveId: archiveResult.archiveId,
      deletedFromRequests: true
    };
  } catch (error) {
    console.error("❌ Archive and delete error:", error);
    
    throw error;
  }
};

export const handleBatchArchive = async (selectedIds, clearanceData) => {
  try {
    const results = await Promise.allSettled(
      selectedIds.map(async (id) => {
        try {
          const record = clearanceData.find(
            (r) => r.dbId === id || r.id === id
          );
          if (!record) {
            return { id, status: "rejected", error: "Record not found" };
          }

          const result = await archiveWithEquipmentData(id, record);
          return { id, status: "fulfilled", result };
        } catch (error) {
          return { id, status: "rejected", error: error.message };
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return { successful, failed, total: selectedIds.length };
  } catch (error) {
    console.error("❌ Batch archive error:", error);
    throw error;
  }
};

/**
 * Batch archive and delete multiple clearances
/**
 * Batch archive and delete multiple clearances
 */
export const handleBatchArchiveAndDelete = async (selectedIds, clearanceData) => {
  try {
    console.log("📦 Batch archive and delete for", selectedIds.length, "records");

    const results = await Promise.allSettled(
      selectedIds.map(async (id) => {
        try {
          const record = clearanceData.find(
            (r) => r.dbId === id || r.id === id
          );
          if (!record) {
            return { id, status: "rejected", error: "Record not found" };
          }

          const result = await archiveAndDelete(id, record);
          return { 
            id, 
            status: "fulfilled", 
            result,
            deletedFromRequests: true
          };
        } catch (error) {
          return { id, status: "rejected", error: error.message };
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    const deletedCount = results.filter(
      (r) => r.status === "fulfilled" && r.result?.deletedFromRequests
    ).length;

    return { 
      successful, 
      failed, 
      total: selectedIds.length,
      deletedFromRequests: deletedCount
    };
  } catch (error) {
    console.error("❌ Batch archive and delete error:", error);
    throw error;
  }
};
/**
 * Manual archive that transfers to clearance_records and deletes from clearance_requests
 */
export const manualArchiveAndTransfer = async (clearanceId, clearanceData, year = null) => {
  try {
    console.log("📋 Manual archive and transfer for:", clearanceId);

    // Get clearance request
    const { data: clearance, error: clearanceError } = await supabase
      .from("clearance_requests")
      .select("*")
      .eq("id", clearanceId)
      .single();

    if (clearanceError) throw clearanceError;

    // Check if already archived
    const { data: existingArchive } = await supabase
      .from("clearance_records")
      .select("id")
      .eq("clearance_request_id", clearanceId)
      .single();

    if (existingArchive) {
      // If already archived, just delete from clearance_requests
      const { error: deleteError } = await supabase
        .from("clearance_requests")
        .delete()
        .eq("id", clearanceId);

      if (deleteError) throw deleteError;

      // IMPORTANT: After successful archive, check if we should delete from clearance_requests
      // This is handled separately by the archiveAndDelete function
      console.log("✅ Successfully archived clearance:", clearanceId);
      return {
        success: true,
        message: "Archived successfully",
        archiveId: archivedRecord.id,
        // IMPORTANT: Don't delete from clearance_requests here
        // That's handled by archiveAndDelete separately
      };
    }

    // Use the existing archive function
    const archiveResult = await archiveWithEquipmentData(clearanceId, clearanceData);

    if (!archiveResult.success) {
      throw new Error("Archive failed");
    }

    // Delete from clearance_requests
    const { error: deleteError } = await supabase
      .from("clearance_requests")
      .delete()
      .eq("id", clearanceId);

    if (deleteError) {
      // If delete fails, you might want to keep the archive or rollback
      console.warn("Failed to delete from clearance_requests:", deleteError);
      
      // Option 1: Keep the archive record but mark it
      await supabase
        .from("clearance_records")
        .update({
          notes: "Failed to delete original request",
          updated_at: new Date().toISOString(),
        })
        .eq("id", archiveResult.archiveId);

      return {
        success: true,
        warning: "Archived but could not delete from clearance_requests",
        archiveId: archiveResult.archiveId,
        deletedFromRequests: false
      };
    }

    return {
      success: true,
      message: "Manually archived and transferred successfully",
      archiveId: archiveResult.archiveId,
      deletedFromRequests: true
    };
  } catch (error) {
    console.error("❌ Manual archive and transfer error:", error);
    throw error;
  }
};
/**
 * Manually archive single clearance with deletion option
 */
export const manuallyArchiveSingleClearance = async (clearanceId, clearanceData, deleteFromRequests = true) => {
  try {
    console.log("📋 Manual single archive for:", clearanceId);

    // Check if already archived
    const { data: existingArchive } = await supabase
      .from("clearance_records")
      .select("id")
      .eq("clearance_request_id", clearanceId)
      .single();

    if (existingArchive) {
      if (deleteFromRequests) {
        // Delete from clearance_requests
        const { error: deleteError } = await supabase
          .from("clearance_requests")
          .delete()
          .eq("id", clearanceId);

        if (deleteError) throw deleteError;

        return {
          success: true,
          message: "Already archived. Deleted from clearance_requests.",
          archiveId: existingArchive.id,
          deletedFromRequests: true
        };
      }
      
      return {
        success: true,
        message: "Already archived.",
        archiveId: existingArchive.id,
        deletedFromRequests: false
      };
    }

    // Archive first
    const archiveResult = await archiveWithEquipmentData(clearanceId, clearanceData);

    if (!archiveResult.success) {
      throw new Error("Archive failed");
    }

    // Delete from clearance_requests if requested
    if (deleteFromRequests) {
      const { error: deleteError } = await supabase
        .from("clearance_requests")
        .delete()
        .eq("id", clearanceId);

      if (deleteError) {
        console.warn("Failed to delete from clearance_requests:", deleteError);
        return {
          success: true,
          warning: "Archived but could not delete from clearance_requests",
          archiveId: archiveResult.archiveId,
          deletedFromRequests: false
        };
      }
    }

    return {
      success: true,
      message: deleteFromRequests 
        ? "Manually archived and deleted from clearance_requests" 
        : "Manually archived (kept in clearance_requests)",
      archiveId: archiveResult.archiveId,
      deletedFromRequests: deleteFromRequests
    };
  } catch (error) {
    console.error("❌ Manual single archive error:", error);
    throw error;
  }
};

/**
 * Check if clearance can be archived
 */
export const canArchiveClearance = (clearance) => {
  if (!clearance) return false;

  // Only certain statuses can be archived
  const archivableStatuses = ["Completed", "Rejected", "Cancelled"];

  // Must be a current request (not yearly record)
  if (clearance.recordType !== "current") return false;

  // Must be in archivable status
  if (!archivableStatuses.includes(clearance.status)) return false;

  // Should not already be archived
  if (clearance.isArchived) return false;

  return true;
};

/**
 * Get archive eligibility message
 */
export const getArchiveEligibilityMessage = (clearance) => {
  if (!clearance) return "Invalid clearance record";

  if (clearance.recordType !== "current") {
    return "Yearly records are already archived";
  }

  if (clearance.isArchived) {
    return "Already archived";
  }

  const archivableStatuses = ["Completed", "Rejected", "Cancelled"];
  if (!archivableStatuses.includes(clearance.status)) {
    return `Cannot archive clearance with status: ${clearance.status}. Only Completed, Rejected, or Cancelled clearances can be archived.`;
  }

  return "Ready for archiving";
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};
/**
 * Check if personnel has equipment for this clearance
 */
export const checkIfHasEquipment = async (clearanceId) => {
  try {
    const { data, error } = await supabase
      .from("personnel_equipment_accountability_table")
      .select("id")
      .eq("clearance_request_id", clearanceId)
      .limit(1);

    if (error) {
      console.warn("Error checking equipment:", error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error("Error in checkIfHasEquipment:", error);
    return false;
  }
};

/**
 * Check clearance type to determine archive method
 */
export const getArchiveMethodForClearance = (clearance) => {
  const clearanceType = clearance?.clearanceType?.toLowerCase() || "";
  
  // Equipment-related clearances
  const equipmentTypes = [
    "equipment completion",
    "retirement",
    "resignation",
    "transfer"
  ];
  
  // Simple clearances (no equipment)
  const simpleTypes = [
    "promotion",
    "administrative",
    "others",
    "general"
  ];
  
  if (equipmentTypes.some(type => clearanceType.includes(type))) {
    return "equipment";
  } else if (simpleTypes.some(type => clearanceType.includes(type))) {
    return "simple";
  } else {
    return "smart"; // Let smart archive decide
  }
};
/**
 * Get status class for CSS styling
 */
export const getStatusClass = (status) => {
  const statusMap = {
    pending: "pending",
    completed: "approved",
    rejected: "rejected",
    cancelled: "rejected",
    "in progress": "pending",
    cleared: "approved",
    with_accountability: "pending",
    partial: "pending",
  };
  return statusMap[status.toLowerCase()] || "pending";
};

export default {
  archiveWithEquipmentData,
  deleteAfterArchive,
  archiveAndDelete,
  handleBatchArchive,
  handleBatchArchiveAndDelete,
  canArchiveClearance,
  getArchiveEligibilityMessage,
  formatCurrency,
  getStatusClass,
};
