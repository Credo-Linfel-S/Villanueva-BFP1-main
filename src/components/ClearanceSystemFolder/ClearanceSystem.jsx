import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar.jsx";
import Hamburger from "../Hamburger.jsx";
import styles from "./Styles/ClearanceSystem.module.css";
import { useSidebar } from "../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../lib/supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BFPPreloader from "../BFPPreloader.jsx";
import OfficerInputModal from "./Modal/OfficerInputModal.jsx";
// Import utilities
import {
  fillClearanceFormEnhanced,
  fillClearanceFormSimple,
} from "./Utility/pdfClearanceFormFiller.js";
import {
  uploadClearanceDocumentToStorage,
  createClearancePersonnelFolderName,
  createClearancePdfFileName,
  saveClearanceDocumentMetadata,
  loadClearancePdfTemplate,
} from "./Utility/clearanceDocumentUpload.js";
import {
  checkExistingClearance,
  loadPersonnelEquipment,
  updateClearanceStatus,
  checkClearanceApprovalEligibility,
  formatCurrency,
  downloadPdf,
} from "./Utility/clearanceUtils.js";
// Import lost equipment utilities
import {
  checkLostEquipment,
  getDetailedLostEquipment,
  linkLostEquipmentToClearance,
} from "./Utility/clearanceLostEquipmentUtils.js";
import {
  filterActivePersonnel,
  isPersonnelActive,
} from "../filterActivePersonnel.js";

import { useUserId } from "../hooks/useUserId.js";

const ClearanceSystem = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [clearanceRequests, setClearanceRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [personnelList, setPersonnelList] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfDownloadProgress, setPdfDownloadProgress] = useState(0);
  const [pdfDownloadForRequest, setPdfDownloadForRequest] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequestForAction, setSelectedRequestForAction] =
    useState(null);
  const [showNoEquipmentModal, setShowNoEquipmentModal] = useState({
    show: false,
    personnelName: "",
    clearanceType: "",
  });
  const { userId, isAuthenticated, userRole } = useUserId();
  const [showOfficerModal, setShowOfficerModal] = useState(false);
  const [selectedRequestForPdf, setSelectedRequestForPdf] = useState(null);
  const [officerNames, setOfficerNames] = useState({});
  const [approveRemarks, setApproveRemarks] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [existingPdfs, setExistingPdfs] = useState({});
  const [selectedEquipment, setSelectedEquipment] = useState([]);
  const [lostEquipment, setLostEquipment] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [filters, setFilters] = useState({
    status: "All",
    search: "",
    type: "All",
  });
  const [newClearance, setNewClearance] = useState({
    personnel_id: "",
    employee_name: "",
    type: "",
    equipment_ids: [],
  });
  const [loading, setLoading] = useState(false);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const [preloaderProgress, setPreloaderProgress] = useState(0);

  const rowsPerPage = 5;

  // Helper function with mapping
  const getInspectionStatusClass = (status) => {
    const statusMap = {
      "In Progress": "inprogress",
      "No Equipment": "noequipment",
      "Not Applicable": "notapplicable",
      Pending: "pending",
      PASS: "pass",
      FAIL: "fail",
      "PASS (Settled)": "passsettled",
      "FAIL (Accountability Pending)": "failaccountability",
    };

    return (
      statusMap[status] ||
      status?.toLowerCase().replace(/[^a-z]/g, "") ||
      "pending"
    );
  };

  // Helper function to create organized folder names
  const createPersonnelFolderName = (personnel) => {
    const fullName =
      personnel?.employee
        ?.replace(/[^a-zA-Z0-9\s]/g, "")
        ?.replace(/\s+/g, "_") || "Unknown";
    const rank =
      personnel?.rank?.replace(/[^a-zA-Z0-9\s]/g, "")?.replace(/\s+/g, "_") ||
      "N/A";
    const badgeNumber =
      personnel?.badge_number?.replace(/[^a-zA-Z0-9]/g, "") || "N/A";

    return `${fullName}_${rank}_${badgeNumber}`;
  };

  const formatPHP = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  };

  // Load data from Supabase
  useEffect(() => {
    const initializeData = async () => {
      setShowPreloader(true);
      setPreloaderProgress(10);

      try {
        setPreloaderProgress(30);
        await loadClearanceRequests();

        setPreloaderProgress(60);
        await loadPersonnel();

        setPreloaderProgress(90);
        await new Promise((resolve) => setTimeout(resolve, 500));

        setPreloaderProgress(100);

        setTimeout(() => {
          setShowPreloader(false);
        }, 800);
      } catch (error) {
        console.error("Initialization error:", error);
        toast.error("Failed to initialize system", {
          position: "top-right",
          autoClose: 3000,
        });
        setShowPreloader(false);
      }
    };

    initializeData();
  }, []);

  // Load existing PDFs
  useEffect(() => {
    const loadExistingPdfs = async () => {
      try {
        const { data, error } = await supabase
          .from("clearance_documents")
          .select(
            "id, clearance_request_id, document_name, file_url, file_path, document_type"
          )
          .eq("document_type", "CLEARANCE_FORM")
          .in(
            "clearance_request_id",
            clearanceRequests.map((req) => req.id)
          );

        if (!error && data) {
          const pdfsMap = {};
          data.forEach((doc) => {
            if (!pdfsMap[doc.clearance_request_id]) {
              pdfsMap[doc.clearance_request_id] = [];
            }
            pdfsMap[doc.clearance_request_id].push(doc);
          });
          setExistingPdfs(pdfsMap);
        }
      } catch (err) {
        console.error("Error loading existing PDFs:", err);
      }
    };

    if (clearanceRequests.length > 0) {
      loadExistingPdfs();
    }
  }, [clearanceRequests]);

  // Filter data when filters change
  useEffect(() => {
    filterData();
  }, [clearanceRequests, filters]);

  const handleRetryPreloader = () => {
    setShowPreloader(true);
    setPreloaderProgress(0);
    loadClearanceRequests();
    loadPersonnel();
  };

const loadClearanceRequests = async () => {
  try {
    setLoading(true);

    if (showPreloader) {
      setPreloaderProgress(40);
    }

    const { data, error } = await supabase
      .from("clearance_requests")
      .select(
        `
        *,
        personnel:personnel_id (
          first_name,
          middle_name,
          last_name,
          username,
          rank,
          rank_image,
          badge_number,
          station
        )
        `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Format the data
    const formattedData = await Promise.all(
      (data || []).map(async (request, index) => {
        const personnel = request.personnel || {};
        const employeeName = `${personnel.first_name || ""} ${
          personnel.middle_name || ""
        } ${personnel.last_name || ""}`
          .replace(/\s+/g, " ")
          .trim();

        let rankImageUrl = "";
        if (personnel.rank_image) {
          try {
            if (personnel.rank_image.startsWith("http")) {
              rankImageUrl = personnel.rank_image;
            } else {
              const { data: imageData } = supabase.storage
                .from("rank_images")
                .getPublicUrl(personnel.rank_image);
              rankImageUrl = imageData?.publicUrl || "";
            }
          } catch (imgError) {
            console.warn("Error loading rank image:", imgError);
            rankImageUrl = "";
          }
        }

        const folderName = createPersonnelFolderName({
          employee: employeeName,
          rank: personnel.rank,
          badge_number: personnel.badge_number,
        });

        let equipmentCount = 0;
        let equipmentDisplay = "Not Applicable";
        let inspectionStatus = "Not Applicable";
        let lostEquipmentCount = 0;
        let lostEquipmentStatus = "None";
        let newStatus = request.status; // Start with current status
        let isAccountabilitySettled = false; // DECLARE IT HERE FIRST

        // Check if request type qualifies for inspection
        const requiresInspection =
          request.type === "Retirement" ||
          request.type === "Resignation" ||
          request.type === "Equipment Completion";

        if (requiresInspection) {
          inspectionStatus = "Pending";
          equipmentDisplay = "No Equipment";

          const equipmentItems = await loadPersonnelEquipment(
            request.personnel_id
          );
          equipmentCount = equipmentItems.length || 0;

          // Check for lost equipment SPECIFIC to this clearance request
          const { data: lostRecords, error: lostError } = await supabase
            .from("accountability_records")
            .select("id, is_settled, equipment_returned")
            .eq("personnel_id", request.personnel_id)
            .eq("record_type", "LOST")
            .eq("clearance_request_id", request.id); // SPECIFIC to this request

          if (!lostError && lostRecords) {
            lostEquipmentCount = lostRecords.length;
            const unsettledLostEquipment = lostRecords.filter(
              (record) => !record.is_settled
            );

            if (unsettledLostEquipment.length > 0) {
              lostEquipmentStatus = `⚠️ ${unsettledLostEquipment.length} Unsettled`;
              inspectionStatus = "FAIL (Unsettled Lost Equipment)";
              newStatus = "In Progress";
            } else {
              lostEquipmentStatus = `✅ ${lostRecords.length} Settled`;
            }
          }

          if (equipmentCount > 0) {
            equipmentDisplay = `${equipmentCount} item(s)`;

            const { data: clearanceItems, error: countError } = await supabase
              .from("clearance_inventory")
              .select("status, inspection_id, inventory_id")
              .eq("clearance_request_id", request.id);

            if (!countError && clearanceItems && clearanceItems.length > 0) {
              const totalItems = clearanceItems.length;
              const clearedItems = clearanceItems.filter(
                (item) => item.status === "Cleared"
              ).length;
              const pendingItems = clearanceItems.filter(
                (item) => item.status === "Pending"
              ).length;
              const damagedItems = clearanceItems.filter(
                (item) => item.status === "Damaged"
              ).length;
              const lostItems = clearanceItems.filter(
                (item) => item.status === "Lost"
              ).length;

              // FIXED: Check accountability status for THIS SPECIFIC clearance request
              const { data: accountabilityData, error: accountabilityError } =
                await supabase
                  .from("personnel_equipment_accountability_table")
                  .select("accountability_status")
                  .eq("personnel_id", request.personnel_id)
                  .eq("clearance_request_id", request.id) // SPECIFIC to this request
                  .maybeSingle();

              // DEFINE isAccountabilitySettled HERE
              isAccountabilitySettled =
                !accountabilityError &&
                accountabilityData?.accountability_status === "SETTLED";

              console.log(`Clearance ${request.id} accountability check:`, {
                personnelId: request.personnel_id,
                requestId: request.id,
                isAccountabilitySettled,
                damagedItems,
                lostItems,
              });

              // DETERMINE INSPECTION STATUS
              if (damagedItems > 0 || lostItems > 0) {
                // Check if accountability has been created for THIS request
                const { data: accountabilityRecord, error: accError } =
                  await supabase
                    .from("accountability_records")
                    .select("id, is_settled")
                    .eq("personnel_id", request.personnel_id)
                    .eq("clearance_request_id", request.id) // SPECIFIC to this request
                    .in("record_type", ["DAMAGED", "LOST"])
                    .limit(1);

                if (
                  !accError &&
                  accountabilityRecord &&
                  accountabilityRecord.length > 0
                ) {
                  // Accountability record exists for THIS request
                  const recordIsSettled =
                    accountabilityRecord[0].is_settled === true;

                  if (recordIsSettled) {
                    inspectionStatus = "PASS (Settled)";
                  } else {
                    inspectionStatus = "FAIL (Accountability Pending)";
                  }
                } else {
                  // No accountability record yet for damaged/lost equipment for THIS request
                  inspectionStatus = "FAIL (Needs Accountability)";
                }
              } else if (clearedItems === totalItems) {
                // All items cleared - no damaged/lost
                inspectionStatus = "PASS";
              } else if (pendingItems > 0) {
                // Check if inspections are scheduled
                const inventoryIds = clearanceItems
                  .filter((item) => item.status === "Pending")
                  .map((item) => item.inventory_id);

                const { data: scheduledInspections, error: scheduleError } =
                  await supabase
                    .from("inspections")
                    .select("id")
                    .in("equipment_id", inventoryIds)
                    .in("status", ["PENDING", "IN_PROGRESS"]);

                const hasScheduledInspections =
                  !scheduleError &&
                  scheduledInspections &&
                  scheduledInspections.length > 0;

                inspectionStatus = hasScheduledInspections
                  ? "In Progress"
                  : "Pending";
              } else {
                inspectionStatus = "In Progress";
              }

              // DETERMINE CLEARANCE REQUEST STATUS
              if (pendingItems === 0 && damagedItems === 0 && lostItems === 0) {
                // All items cleared
                newStatus = "Pending for Approval";
                console.log(
                  `✅ Request ${request.id}: All items cleared, status = Pending for Approval`
                );
              } else if (damagedItems > 0 || lostItems > 0) {
                // Has damaged/lost equipment
                if (isAccountabilitySettled) {
                  newStatus = "Pending for Approval";
                  console.log(
                    `✅ Request ${request.id}: Accountability settled, status = Pending for Approval`
                  );
                } else {
                  newStatus = "In Progress";
                  console.log(
                    `⏳ Request ${request.id}: Needs accountability, status = In Progress`
                  );
                }
              } else if (pendingItems > 0) {
                // Still pending items
                newStatus = "In Progress";
                console.log(
                  `⏳ Request ${request.id}: Has pending items, status = In Progress`
                );
              }

              // TRIPLE-CHECK: If FAIL status but accountability exists and is settled
              // FIXED: Now isAccountabilitySettled is defined and accessible here
              if (
                inspectionStatus.startsWith("FAIL") &&
                isAccountabilitySettled
              ) {
                inspectionStatus = "PASS (Settled)";
                newStatus = "Pending for Approval";
                console.log(
                  `🔄 Request ${request.id}: Override FAIL to PASS (Settled)`
                );
              }
            } else {
              // No clearance items added yet
              inspectionStatus = "Not Yet Added";
              newStatus = "Pending";
              console.log(
                `ℹ️ Request ${request.id}: No clearance items added yet`
              );
            }
          } else {
            // No equipment assigned to this personnel
            equipmentDisplay = "No Equipment";
            inspectionStatus = "No Equipment";
            // No equipment means it can be approved
            newStatus = "Pending for Approval";
            console.log(
              `✅ Request ${request.id}: No equipment, status = Pending for Approval`
            );
          }
        } else {
          // For non-inspection clearance types (Transfer, Promotion, Administrative, etc.)
          const { data: clearanceItems, error: countError } = await supabase
            .from("clearance_inventory")
            .select("id")
            .eq("clearance_request_id", request.id);

          if (!countError && clearanceItems) {
            equipmentCount = clearanceItems.length || 0;
            if (equipmentCount > 0) {
              equipmentDisplay = `${equipmentCount} item(s)`;
            }
          }
          inspectionStatus = "Not Applicable";

          // For non-equipment clearances, they can be approved if pending
          if (request.status === "Pending") {
            newStatus = "Pending for Approval";
            console.log(
              `✅ Request ${request.id}: Non-equipment clearance, status = Pending for Approval`
            );
          }
        }

        // Override status if there's unsettled lost equipment SPECIFIC to this request
        if (
          lostEquipmentCount > 0 &&
          lostEquipmentStatus.includes("Unsettled")
        ) {
          newStatus = "In Progress";
          console.log(
            `⚠️ Request ${request.id}: Has unsettled lost equipment, status = In Progress`
          );
        }

        // IMPORTANT: Update database if status changed
        if (
          newStatus !== request.status &&
          request.status !== "Completed" &&
          request.status !== "Rejected" &&
          newStatus !== "Completed" &&
          newStatus !== "Rejected"
        ) {
          console.log(
            `🔄 Updating clearance ${request.id} from ${request.status} to ${newStatus}`
          );

          const { error: updateError } = await supabase
            .from("clearance_requests")
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", request.id);

          if (updateError) {
            console.error("Error updating clearance status:", updateError);
          } else {
            console.log(
              `✅ Successfully updated clearance ${request.id} to ${newStatus}`
            );
          }
        }

        // Return the formatted request with UPDATED status
        return {
          id: request.id,
          personnel_id: request.personnel_id,
          employee: employeeName || "Unknown",
          username: personnel.username || "",
          rank: personnel.rank || "",
          rank_image: rankImageUrl,
          badge_number: personnel.badge_number || "",
          type: request.type,
          status: newStatus, // Use the UPDATED status here
          calculated_status: newStatus, // Same as status
          inspection_status: inspectionStatus,
          equipment_display: equipmentDisplay,
          equipment_count: equipmentCount,
          lost_equipment_count: lostEquipmentCount,
          lost_equipment_status: lostEquipmentStatus,
          date: request.created_at
            ? new Date(request.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "",
          effective_date: request.effective_date,
          expected_completion_date: request.expected_completion_date,
          actual_completion_date: request.actual_completion_date,
          remarks: request.remarks,
          approved_by: request.approved_by,
          approved_at: request.approved_at,
          rejection_reason: request.rejection_reason,
          missing_amount: request.missing_amount,
          created_at: request.created_at,
          updated_at: request.updated_at,
          folder_name: folderName,
          accountability_settled: isAccountabilitySettled || false,
          accountability_status: isAccountabilitySettled
            ? "SETTLED"
            : "UNSETTLED",
        };
      })
    );

    // Log the results for debugging
    console.log(
      "Loaded clearance requests:",
      formattedData.map((req) => ({
        id: req.id,
        type: req.type,
        status: req.status,
        inspection_status: req.inspection_status,
        accountability_settled: req.accountability_settled,
        accountability_status: req.accountability_status,
      }))
    );

    setClearanceRequests(formattedData);
  } catch (err) {
    console.error("Error loading clearance requests:", err);
    toast.error("Failed to load clearance requests", {
      position: "top-right",
      autoClose: 3000,
    });
  } finally {
    setLoading(false);
  }
};

  // FIXED: CORRECTED shouldShowApproveRejectButtons function
  const shouldShowApproveRejectButtons = (request) => {
    // Debug log
    console.log("🔍 Approve/Reject Check - FIXED:", {
      id: request.id,
      employee: request.employee,
      status: request.status,
      inspection_status: request.inspection_status,
      type: request.type,
      equipment_count: request.equipment_count,
      lost_equipment_status: request.lost_equipment_status,
    });

    // 1. NEVER show for Completed/Rejected status
    const normalizedStatus = (request.status || "").toLowerCase().trim();
    if (normalizedStatus === "completed" || normalizedStatus === "rejected") {
      console.log("❌ Not showing: Already completed or rejected");
      return false;
    }

    // 2. Check if status is "Pending for Approval" or "Pending"
    const isPendingForApproval =
      normalizedStatus === "pending for approval" ||
      normalizedStatus === "pendingforapproval" ||
      normalizedStatus === "pending";

    if (!isPendingForApproval) {
      console.log("❌ Not showing: Status is not pending for approval");
      return false;
    }

    // 3. Check for equipment-related clearances
    const isEquipmentClearance =
      request.type === "Retirement" ||
      request.type === "Resignation" ||
      request.type === "Equipment Completion";

    if (isEquipmentClearance) {
      const inspectionStatus = (request.inspection_status || "").toLowerCase();
      const hasUnsettledLostEquipment =
        request.lost_equipment_status?.includes("Unsettled") || false;

      // BLOCK if there's unsettled lost equipment
      if (hasUnsettledLostEquipment) {
        console.log("❌ Not showing: Has unsettled lost equipment");
        return false;
      }

      // BLOCK if inspection is not explicitly PASSED
      const hasPassedInspection =
        inspectionStatus.includes("pass") ||
        inspectionStatus === "no equipment" ||
        inspectionStatus === "completed";

      if (!hasPassedInspection) {
        console.log(
          `❌ Not showing: Inspection not passed (${request.inspection_status})`
        );
        return false;
      }

      // ALLOW if no equipment OR inspection passed
      if (request.equipment_count === 0 || hasPassedInspection) {
        console.log("✅ Showing: Equipment clearance ready for approval");
        return true;
      }

      console.log("❌ Not showing: Equipment clearance not ready");
      return false;
    }

    // 4. Non-equipment clearances can be approved if status is pending
    console.log("✅ Showing: Non-equipment clearance ready for approval");
    return true;
  };

  const openApproveModal = async (request) => {
    console.log("📝 Opening approve modal for:", {
      id: request.id,
      employee: request.employee,
      status: request.status,
      inspection_status: request.inspection_status,
    });

    // Check if buttons should be shown
    const canShowButtons = shouldShowApproveRejectButtons(request);
    if (!canShowButtons) {
      // Provide specific feedback
      if (request.lost_equipment_status?.includes("Unsettled")) {
        toast.warning(
          `Cannot approve clearance: ${request.lost_equipment_count} unsettled lost equipment item(s).`,
          {
            position: "top-right",
            autoClose: 5000,
          }
        );
      } else if (
        request.inspection_status?.includes("FAIL") &&
        !request.inspection_status?.includes("Settled")
      ) {
        toast.warning(
          `Cannot approve clearance: Equipment inspection ${request.inspection_status}.`,
          {
            position: "top-right",
            autoClose: 5000,
          }
        );
      } else if (
        request.inspection_status === "Pending" ||
        request.inspection_status === "In Progress"
      ) {
        toast.warning(
          "Cannot approve clearance: Equipment inspection is still in progress.",
          {
            position: "top-right",
            autoClose: 4000,
          }
        );
      } else {
        toast.warning(
          "Clearance is not ready for approval. Check inspection status.",
          {
            position: "top-right",
            autoClose: 4000,
          }
        );
      }
      return;
    }

    // Check database eligibility
    const canApprove = await checkClearanceApprovalEligibility(
      request.id,
      request.personnel_id
    );

    if (!canApprove) {
      toast.warning(
        "Database check: Clearance is not eligible for approval yet.",
        {
          position: "top-right",
          autoClose: 4000,
        }
      );
      return;
    }

    setSelectedRequestForAction(request);
    setApproveRemarks("");
    setShowApproveModal(true);
  };

  const handleClearanceSubmit = async (e) => {
    e.preventDefault();
    const { personnel_id, type } = newClearance;

    if (!personnel_id || !type) {
      toast.warning("Please select both Employee and Clearance Type.", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    // Check for existing clearance
    const { exists, message } = await checkExistingClearance(
      personnel_id,
      type
    );
    if (exists) {
      toast.warning(message, {
        position: "top-right",
        autoClose: 4000,
      });
      return;
    }

    // Check if personnel has equipment for specific clearance types
    if (
      type === "Resignation" ||
      type === "Retirement" ||
      type === "Equipment Completion"
    ) {
      const equipmentItems = await loadPersonnelEquipment(personnel_id);

      // Check if personnel has no equipment
      if (!equipmentItems || equipmentItems.length === 0) {
        const selectedPersonnel = personnelList.find(
          (p) => p.id === personnel_id
        );
        const employeeName = selectedPersonnel
          ? `${selectedPersonnel.first_name || ""} ${
              selectedPersonnel.middle_name || ""
            } ${selectedPersonnel.last_name || ""}`
              .replace(/\s+/g, " ")
              .trim()
          : "Unknown";

        setShowNoEquipmentModal({
          show: true,
          personnelName: employeeName,
          clearanceType: type,
          personnelId: personnel_id,
          equipmentType: type,
        });
        return;
      }

      // Check for lost equipment
      const { hasLostEquipment, lostItems, count } = await checkLostEquipment(
        personnel_id,
        type
      );

      if (hasLostEquipment) {
        const confirmProceed = window.confirm(
          `⚠️ WARNING: ${count} lost equipment item(s) found for this personnel.\n\n` +
            `Lost items must be settled before clearance can be processed.\n` +
            `These items will be automatically linked to this clearance request.\n\n` +
            `Lost Items:\n${lostItems
              .map(
                (item) =>
                  `• ${item.inventory?.item_name || "Unknown"} (${
                    item.inventory?.item_code || "N/A"
                  })`
              )
              .join("\n")}\n\n` +
            `Do you still want to proceed with creating the clearance request?`
        );

        if (!confirmProceed) {
          return;
        }
      }
    }

    // Continue with normal submission flow
    setShowPreloader(true);
    setPreloaderProgress(10);

    try {
      setLoading(true);
      setPreloaderProgress(30);

      const selectedPersonnel = personnelList.find(
        (p) => p.id === personnel_id
      );
      const employeeName = selectedPersonnel
        ? `${selectedPersonnel.first_name || ""} ${
            selectedPersonnel.middle_name || ""
          } ${selectedPersonnel.last_name || ""}`
            .replace(/\s+/g, " ")
            .trim()
        : "Unknown";

      const confirmationInfo = {
        personnel_id,
        employeeName,
        type,
        equipmentCount: inventoryItems.length,
        totalValue: inventoryItems.reduce(
          (sum, item) => sum + (item.price || 0),
          0
        ),
        equipmentList: inventoryItems,
      };

      setConfirmationData(confirmationInfo);
      setShowSubmitConfirmation(true);

      setPreloaderProgress(60);
    } catch (err) {
      console.error("Error in form submission:", err);
      toast.error("Failed to process form submission", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
      setShowPreloader(false);
    }
  };

  const continueClearanceSubmission = async () => {
    const { personnelId, equipmentType, personnelName } = showNoEquipmentModal;

    setShowNoEquipmentModal({
      show: false,
      personnelName: "",
      clearanceType: "",
    });

    try {
      setLoading(true);

      const confirmationInfo = {
        personnel_id: personnelId,
        employeeName: personnelName,
        type: equipmentType,
        equipmentCount: 0,
        totalValue: 0,
        equipmentList: [],
      };

      setConfirmationData(confirmationInfo);
      setShowSubmitConfirmation(true);
    } catch (err) {
      console.error("Error continuing clearance submission:", err);
      toast.error("Failed to process clearance submission", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmClearanceSubmission = async () => {
    if (!confirmationData) return;

    const {
      personnel_id,
      type,
      employeeName,
      equipmentCount,
      totalValue,
      equipmentList,
    } = confirmationData;

    try {
      setSubmissionLoading(true);
      setShowPreloader(true);
      setPreloaderProgress(10);

      setPreloaderProgress(20);
      const { exists, message } = await checkExistingClearance(
        personnel_id,
        type
      );
      if (exists) {
        toast.warning(message, {
          position: "top-right",
          autoClose: 4000,
        });
        setShowPreloader(false);
        setSubmissionLoading(false);
        setShowSubmitConfirmation(false);
        setConfirmationData(null);
        return;
      }

      // Generate UUID for the request
      const requestId = crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();

      const newRequest = {
        id: requestId,
        personnel_id: personnel_id,
        type: type,
        status: "Pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setPreloaderProgress(30);

      // Create clearance request
      const { error: insertError } = await supabase
        .from("clearance_requests")
        .insert([newRequest]);

      if (insertError) {
        console.error("Error creating clearance request:", insertError);
        if (insertError.code === "23505") {
          toast.error(
            `Duplicate clearance request found for ${employeeName}.`,
            {
              position: "top-right",
              autoClose: 4000,
            }
          );
        } else {
          throw insertError;
        }
        setShowPreloader(false);
        setSubmissionLoading(false);
        return;
      }

      console.log("Clearance request created with ID:", requestId);

      // Link lost equipment to this clearance request
      if (
        type === "Resignation" ||
        type === "Retirement" ||
        type === "Equipment Completion"
      ) {
        setPreloaderProgress(35);
        try {
          const linkResult = await linkLostEquipmentToClearance(
            requestId,
            personnel_id
          );

          if (linkResult.success && linkResult.linkedCount > 0) {
            toast.info(
              `Linked ${linkResult.linkedCount} lost equipment record(s) to this clearance`,
              {
                position: "top-right",
                autoClose: 4000,
              }
            );
          }
        } catch (linkError) {
          console.warn("Warning: Could not link lost equipment:", linkError);
        }
      }

      setPreloaderProgress(50);
      let clearanceItems = [];

      if (
        type === "Resignation" ||
        type === "Retirement" ||
        type === "Equipment Completion"
      ) {
        const equipmentItems = await loadPersonnelEquipment(personnel_id);

        if (equipmentItems && equipmentItems.length > 0) {
          clearanceItems = equipmentItems.map((equipment) => ({
            clearance_request_id: requestId,
            inventory_id: equipment.id,
            personnel_id: personnel_id,
            status: "Pending",
            price: equipment.price || 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          setPreloaderProgress(70);
          if (clearanceItems.length > 0) {
            const { error: itemsError } = await supabase
              .from("clearance_inventory")
              .insert(clearanceItems);

            if (itemsError) {
              console.error(
                "Error inserting into clearance_inventory:",
                itemsError
              );
              toast.warning(
                "Clearance created but equipment linking failed. Please add equipment manually.",
                {
                  position: "top-right",
                  autoClose: 4000,
                }
              );
            }
          }
        }
      } else if (
        newClearance.equipment_ids &&
        newClearance.equipment_ids.length > 0
      ) {
        clearanceItems = newClearance.equipment_ids.map((equipmentId) => ({
          clearance_request_id: requestId,
          inventory_id: equipmentId,
          personnel_id: personnel_id,
          status: "Pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        setPreloaderProgress(70);
        if (clearanceItems.length > 0) {
          const { error: itemsError } = await supabase
            .from("clearance_inventory")
            .insert(clearanceItems);

          if (itemsError) {
            console.error("Error inserting equipment:", itemsError);
          }
        }
      }

      // Reset form
      setNewClearance({
        personnel_id: "",
        employee_name: "",
        type: "",
        equipment_ids: [],
      });
      setInventoryItems([]);
      setShowForm(false);
      setShowSubmitConfirmation(false);
      setConfirmationData(null);

      setPreloaderProgress(85);
      await loadClearanceRequests();

      setPreloaderProgress(100);

      toast.success("Clearance request created successfully!", {
        position: "top-right",
        autoClose: 3000,
      });

      setTimeout(() => {
        setShowPreloader(false);
      }, 500);
    } catch (err) {
      console.error("Error submitting clearance:", err);
      setShowPreloader(false);

      let errorMessage = "Failed to submit clearance request";
      if (err.message) {
        errorMessage += `: ${err.message}`;
      }
      if (err.code) {
        errorMessage += ` (Code: ${err.code})`;
      }

      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 4000,
      });
    } finally {
      setSubmissionLoading(false);
      setLoading(false);
    }
  };

  // Helper function to generate UUID if crypto.randomUUID is not available
  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  const openRejectModal = (request) => {
    setSelectedRequestForAction(request);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const loadPersonnel = async () => {
    try {
      if (showPreloader) {
        setPreloaderProgress(40);
      }

      const { data, error } = await supabase
        .from("personnel")
        .select(
          "id, first_name, middle_name, last_name, username, rank, rank_image, badge_number, is_active, status, separation_type, separation_date, retirement_date"
        )
        .order("last_name", { ascending: true });

      if (error) throw error;

      // Filter out retired/resigned personnel
      const activePersonnel = filterActivePersonnel(data || []);

      // Transform rank_image URLs
      const personnelWithRankImages = activePersonnel.map((person) => {
        let rankImageUrl = person.rank_image;

        if (rankImageUrl && !rankImageUrl.startsWith("http")) {
          const { data: imageData } = supabase.storage
            .from("rank_images")
            .getPublicUrl(rankImageUrl);
          rankImageUrl = imageData?.publicUrl || "";
        }

        return {
          ...person,
          rank_image: rankImageUrl,
        };
      });

      setPersonnelList(personnelWithRankImages || []);
    } catch (err) {
      console.error("Error loading personnel:", err);
      toast.error("Failed to load personnel data", {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

  const loadPersonnelEquipment = async (personnelId) => {
    try {
      const { data: dataById, error: errorById } = await supabase
        .from("inventory")
        .select(
          "id, item_name, item_code, category, status, assigned_to, price, is_active, assigned_personnel_id"
        )
        .eq("assigned_personnel_id", personnelId)
        .eq("is_active", true);

      if (errorById) {
        console.error("Error loading by ID:", errorById);
        return [];
      }

      return dataById || [];
    } catch (err) {
      console.error("Error loading personnel equipment:", err);
      return [];
    }
  };

  const filterData = () => {
    let filtered = clearanceRequests.filter((req) => {
      const statusMatch =
        filters.status === "All" || req.status === filters.status;
      const typeMatch = filters.type === "All" || req.type === filters.type;
      const searchMatch =
        (req.employee || "")
          .toLowerCase()
          .includes(filters.search.toLowerCase()) ||
        (req.type || "").toLowerCase().includes(filters.search.toLowerCase()) ||
        (req.username || "")
          .toLowerCase()
          .includes(filters.search.toLowerCase()) ||
        (req.badge_number || "")
          .toLowerCase()
          .includes(filters.search.toLowerCase());
      return statusMatch && typeMatch && searchMatch;
    });
    setFilteredRequests(filtered);
    setCurrentPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const viewEquipment = async (requestId) => {
    try {
      setEquipmentLoading(true);

      const { data: requestData, error: requestError } = await supabase
        .from("clearance_requests")
        .select("type, personnel_id, status")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      let equipmentList = [];
      let equipmentSource = "";
      let isAccountabilitySettled = false;
      let lostEquipmentList = [];

      // Check accountability status
      if (
        requestData.type === "Retirement" ||
        requestData.type === "Resignation" ||
        requestData.type === "Equipment Completion"
      ) {
        const { data: accountabilityData, error: accountabilityError } =
          await supabase
            .from("personnel_equipment_accountability_table")
            .select("accountability_status")
            .eq("personnel_id", requestData.personnel_id)
            .eq("clearance_request_id", requestId)
            .maybeSingle();

        if (!accountabilityError && accountabilityData) {
          isAccountabilitySettled =
            accountabilityData.accountability_status === "SETTLED";
        }

        // Get lost equipment records
        const { data: lostRecords, error: lostError } =
          await getDetailedLostEquipment(requestData.personnel_id, requestId);

        if (!lostError && lostRecords) {
          lostEquipmentList = lostRecords.map((record) => ({
            id: record.id,
            inventory_id: record.inventory_id,
            item_name: record.inventory?.item_name || "Unknown",
            item_code: record.inventory?.item_code || "N/A",
            category: record.inventory?.category || "N/A",
            record_type: record.record_type,
            amount_due: record.amount_due,
            is_settled: record.is_settled,
            equipment_returned: record.equipment_returned,
            return_date: record.return_date,
            settlement_date: record.settlement_date,
            settlement_method: record.settlement_method,
            record_date: record.record_date,
            price: record.inventory?.price || 0,
            status: record.is_settled ? "Settled" : "Pending Settlement",
          }));
        }
      }

      // Fetch from clearance_equipment_with_accountability view
      try {
        const { data: clearanceItems, error: clearanceError } = await supabase
          .from("clearance_equipment_with_accountability")
          .select(
            `
            *,
            inventory:inventory_id (
              item_name,
              item_code,
              category,
              status,
              assigned_to,
              price,
              current_value,
              purchase_date,
              specifications
            ),
            personnel:personnel_id (
              first_name,
              middle_name,
              last_name,
              username,
              badge_number
            )
            `
          )
          .eq("clearance_request_id", requestId);

        if (!clearanceError && clearanceItems && clearanceItems.length > 0) {
          equipmentList = clearanceItems.map((item) => ({
            id: item.id,
            inventory_id: item.inventory_id,
            personnel_id: item.personnel_id,
            personnel_name: item.personnel
              ? `${item.personnel.first_name || ""} ${
                  item.personnel.middle_name || ""
                } ${item.personnel.last_name || ""}`.trim()
              : "Unknown",
            name: item.inventory?.item_name,
            code: item.inventory?.item_code,
            category: item.inventory?.category,
            status: item.inventory?.status,
            assigned_to: item.inventory?.assigned_to,
            price: item.inventory?.price,
            current_value: item.inventory?.current_value,
            purchase_date: item.inventory?.purchase_date,
            specifications: item.inventory?.specifications,
            clearance_status:
              item.effective_status || item.clearance_status || "Pending",
            original_clearance_status: item.clearance_status || "Pending",
            accountability_info: item.accountability_info || [],
            remarks: item.remarks,
            returned: item.returned,
            return_date: item.return_date,
            inspection_date: item.inspection_date,
            inspector_name: item.inspector_name,
            findings: item.findings,
          }));
          equipmentSource = "clearance_inventory (view)";
        } else {
          throw new Error("View not available, falling back to table");
        }
      } catch (viewError) {
        // Fallback to original clearance_inventory query
        const { data: clearanceItems, error: clearanceError } = await supabase
          .from("clearance_inventory")
          .select(
            `
            *,
            inventory:inventory_id (
              item_name,
              item_code,
              category,
              status,
              assigned_to,
              price,
              current_value,
              purchase_date,
              specifications
            ),
            personnel:personnel_id (
              first_name,
              middle_name,
              last_name,
              username,
              badge_number
            )
            `
          )
          .eq("clearance_request_id", requestId);

        if (!clearanceError && clearanceItems && clearanceItems.length > 0) {
          const effectiveStatus = isAccountabilitySettled
            ? "Cleared"
            : "Pending";

          equipmentList = clearanceItems.map((item) => ({
            id: item.id,
            inventory_id: item.inventory_id,
            personnel_id: item.personnel_id,
            personnel_name: item.personnel
              ? `${item.personnel.first_name || ""} ${
                  item.personnel.middle_name || ""
                } ${item.personnel.last_name || ""}`.trim()
              : "Unknown",
            name: item.inventory?.item_name,
            code: item.inventory?.item_code,
            category: item.inventory?.category,
            status: item.inventory?.status,
            assigned_to: item.inventory?.assigned_to,
            price: item.inventory?.price,
            current_value: item.inventory?.current_value,
            purchase_date: item.inventory?.purchase_date,
            specifications: item.inventory?.specifications,
            clearance_status: isAccountabilitySettled
              ? "Cleared"
              : item.status || "Pending",
            original_clearance_status: item.status || "Pending",
            accountability_info: isAccountabilitySettled
              ? [{ is_settled: true }]
              : [],
            remarks: item.remarks,
            returned: item.returned,
            return_date: item.return_date,
            inspection_date: item.inspection_date,
            inspector_name: item.inspector_name,
            findings: item.findings,
          }));
          equipmentSource = "clearance_inventory";
        }
      }

      // If no clearance items found, check inventory
      if (equipmentList.length === 0) {
        const equipmentItems = await loadPersonnelEquipment(
          requestData.personnel_id
        );

        if (equipmentItems && equipmentItems.length > 0) {
          const { data: personnelData } = await supabase
            .from("personnel")
            .select("first_name, middle_name, last_name")
            .eq("id", requestData.personnel_id)
            .single();

          const personnelName = personnelData
            ? `${personnelData.first_name || ""} ${
                personnelData.middle_name || ""
              } ${personnelData.last_name || ""}`.trim()
            : "Unknown";

          equipmentList = equipmentItems.map((item) => ({
            id: item.id,
            inventory_id: item.id,
            personnel_id: requestData.personnel_id,
            personnel_name: personnelName,
            name: item.item_name,
            code: item.item_code,
            category: item.category,
            status: item.status,
            assigned_to: item.assigned_to,
            price: item.price,
            current_value: item.current_value,
            purchase_date: item.purchase_date,
            specifications: item.specifications,
            clearance_status: "Not Yet Added",
            original_clearance_status: "Not Yet Added",
            accountability_info: [],
            remarks: "",
            returned: false,
            return_date: null,
            inspection_date: null,
            inspector_name: null,
            findings: null,
          }));
          equipmentSource = "inventory";
        }
      }

      setSelectedEquipment(equipmentList);
      setLostEquipment(lostEquipmentList);

      const request = clearanceRequests.find((r) => r.id === requestId);
      setSelectedRequest({
        ...request,
        equipment_source: equipmentSource,
        accountability_settled: isAccountabilitySettled,
        lost_equipment: lostEquipmentList,
        lost_equipment_count: lostEquipmentList.length,
      });

      setShowEquipmentModal(true);
    } catch (err) {
      console.error("Error loading equipment:", err);
      toast.error("Failed to load equipment details", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setEquipmentLoading(false);
    }
  };

  const handleEmployeeChange = async (e) => {
    const personnel_id = e.target.value;
    const selectedPersonnel = personnelList.find((p) => p.id === personnel_id);

    const employeeName = selectedPersonnel
      ? `${selectedPersonnel.first_name || ""} ${
          selectedPersonnel.middle_name || ""
        } ${selectedPersonnel.last_name || ""}`
          .replace(/\s+/g, " ")
          .trim()
      : "";

    setNewClearance({
      ...newClearance,
      personnel_id: personnel_id,
      employee_name: employeeName,
    });

    if (personnel_id) {
      const equipment = await loadPersonnelEquipment(personnel_id);
      setInventoryItems(equipment);
    }
  };

  const cancelClearanceSubmission = () => {
    setShowSubmitConfirmation(false);
    setConfirmationData(null);
  };

  const handleApproveSubmit = async () => {
    if (!selectedRequestForAction) return;

    setShowPreloader(true);
    setPreloaderProgress(10);

    const toastId = toast.loading("Approving clearance request...", {
      position: "top-right",
      autoClose: 3000,
    });

    try {
      setPreloaderProgress(50);

      // Update status to Completed
      const updateData = {
        status: "Completed",
        updated_at: new Date().toISOString(),
        approved_by: "Administrator",
        approved_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        remarks: approveRemarks,
      };

      const { error } = await supabase
        .from("clearance_requests")
        .update(updateData)
        .eq("id", selectedRequestForAction.id);

      if (error) throw error;

      setPreloaderProgress(80);
      await loadClearanceRequests();

      setPreloaderProgress(100);
      toast.update(toastId, {
        render: "Clearance approved successfully!",
        type: "success",
        isLoading: false,
        autoClose: 3000,
        closeButton: true,
      });

      setShowApproveModal(false);
      setSelectedRequestForAction(null);
      setApproveRemarks("");

      setTimeout(() => {
        setShowPreloader(false);
      }, 500);
    } catch (error) {
      setShowPreloader(false);
      toast.update(toastId, {
        render: `Failed to approve: ${error.message}`,
        type: "error",
        isLoading: false,
        autoClose: 4000,
        closeButton: true,
      });
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedRequestForAction || !rejectReason.trim()) {
      toast.warning("Please enter a rejection reason.", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    setShowPreloader(true);
    setPreloaderProgress(10);

    const toastId = toast.loading("Rejecting clearance request...", {
      position: "top-right",
    });

    try {
      setPreloaderProgress(50);

      const updateData = {
        status: "Rejected",
        updated_at: new Date().toISOString(),
        rejection_reason: rejectReason,
      };

      const { error } = await supabase
        .from("clearance_requests")
        .update(updateData)
        .eq("id", selectedRequestForAction.id);

      if (error) throw error;

      setPreloaderProgress(80);
      await loadClearanceRequests();

      setPreloaderProgress(100);
      toast.update(toastId, {
        render: "Clearance rejected.",
        type: "warning",
        isLoading: false,
        autoClose: 3000,
        closeButton: true,
      });

      setShowRejectModal(false);
      setSelectedRequestForAction(null);
      setRejectReason("");

      setTimeout(() => {
        setShowPreloader(false);
      }, 500);
    } catch (error) {
      setShowPreloader(false);
      toast.update(toastId, {
        render: `Failed to reject: ${error.message}`,
        type: "error",
        isLoading: false,
        autoClose: 4000,
        closeButton: true,
      });
    }
  };

  const statusToClass = (status) => {
    return (status || "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace("pending-for-approval", "pendingforapproval");
  };

  const downloadPdfLocal = (pdfBytes, fileName) => {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadPdfTemplate = async () => {
    try {
      const templatePaths = [
        "/forms/blank-No-Money-and-Property-Accountability-Clearance.pdf",
        "./forms/blank-No-Money-and-Property-Accountability-Clearance.pdf",
        `${window.location.origin}/forms/blank-No-Money-and-Property-Accountability-Clearance.pdf`,
      ];

      let response = null;
      let lastError = null;

      for (const path of templatePaths) {
        try {
          console.log("Trying to load clearance template from:", path);
          response = await fetch(path);
          if (response.ok) {
            console.log("Clearance template loaded successfully from:", path);
            break;
          }
        } catch (error) {
          lastError = error;
          console.warn(`Failed to load from ${path}:`, error.message);
        }
      }

      if (!response || !response.ok) {
        throw new Error(
          `Failed to load PDF template from any path. Last error: ${
            lastError?.message || "Unknown error"
          }`
        );
      }

      const pdfBytes = await response.arrayBuffer();
      return pdfBytes;
    } catch (error) {
      console.error("Error loading PDF template:", error);
      throw error;
    }
  };

  const fillClearanceForm = async (pdfBytes, clearanceData) => {
    try {
      const pdfLib = await import("pdf-lib");
      const { PDFDocument, rgb, StandardFonts } = pdfLib;

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const textColor = rgb(0, 0, 0);

      const drawText = (text, x, y, size = 12) => {
        if (text && typeof text === "string" && text.trim() !== "") {
          firstPage.drawText(text.trim(), {
            x,
            y,
            size: size,
            font: font,
            color: textColor,
          });
        }
      };

      const formatDate = (dateString) => {
        if (!dateString) return new Date().toLocaleDateString("en-PH");
        try {
          const date = new Date(dateString);
          return date.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        } catch (error) {
          return dateString;
        }
      };

      // Fill the form data
      drawText(formatDate(new Date()), 580, 713, 12);

      const personnel = clearanceData.personnel || {};
      const fullName = `${personnel.first_name || ""} ${
        personnel.middle_name || ""
      } ${personnel.last_name || ""}`
        .replace(/\s+/g, " ")
        .trim();

      drawText(`${personnel.rank || ""} ${fullName}`, 188, 603, 12);
      drawText(
        clearanceData.designation || personnel.designation || "N/A",
        190,
        580,
        12
      );
      drawText(
        clearanceData.station || personnel.station || "N/A",
        210,
        560,
        12
      );
      drawText(clearanceData.type || "Clearance", 169, 545, 12);

      const pdfBytesFilled = await pdfDoc.save();
      return pdfBytesFilled;
    } catch (error) {
      console.error("Error filling clearance PDF form:", error);
      throw error;
    }
  };

  const generateClearancePDF = async (clearanceData, isYearly = false) => {
    try {
      const pdfBytes = await loadClearancePdfTemplate();
      const filledPdf = await fillClearanceFormEnhanced(
        pdfBytes,
        clearanceData,
        {
          isYearly,
          generationDate: new Date().toISOString(),
          adminUsername: clearanceData.approvedBy || "System",
        }
      );

      return filledPdf;
    } catch (error) {
      console.error("Error generating clearance PDF:", error);
      throw error;
    }
  };

  const downloadExistingPdf = async (pdfUrl, clearanceRequest) => {
    if (!pdfUrl) {
      toast.warning("PDF URL not found", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    try {
      const response = await fetch(pdfUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      const employeeName = clearanceRequest.employee
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "_");
      const clearanceType = clearanceRequest.type.replace(/\s+/g, "_");
      const completionDate =
        clearanceRequest.completed_at || new Date().toISOString().split("T")[0];
      const fileName = `${employeeName}_${clearanceType}_Clearance_${completionDate}.pdf`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("PDF downloaded successfully!", {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.info("Opening PDF in new tab...", {
        position: "top-right",
        autoClose: 3000,
      });
      window.open(pdfUrl, "_blank");
    }
  };

  const generateAndUploadClearanceForm = async (
    clearanceRequest,
    customOfficerNames = {}
  ) => {
    setGeneratingPdf(true);
    setPdfDownloadForRequest(clearanceRequest.id);
    setPdfDownloadProgress(10);

    try {
      setPdfDownloadProgress(40);

      // Get complete personnel data for PDF generation
      let personnelData = {};
      if (clearanceRequest.personnel_id) {
        const { data, error } = await supabase
          .from("personnel")
          .select("*")
          .eq("id", clearanceRequest.personnel_id)
          .single();

        if (!error) {
          personnelData = data;
        }
      }

      // Combine data for PDF
      const pdfData = {
        ...clearanceRequest,
        personnel: personnelData,
        approvedBy: "Administrator",
        date: new Date().toISOString(),
        officerNames: customOfficerNames,
      };

      // Generate PDF
      const filledPdfBytes = await generateClearancePDF(pdfData);

      // Convert ArrayBuffer to Uint8Array
      let pdfBytesForUpload;
      if (filledPdfBytes instanceof ArrayBuffer) {
        pdfBytesForUpload = new Uint8Array(filledPdfBytes);
      } else if (filledPdfBytes instanceof Uint8Array) {
        pdfBytesForUpload = filledPdfBytes;
      } else {
        pdfBytesForUpload = new Uint8Array(filledPdfBytes);
      }

      // Create filename
      const fileName = createClearancePdfFileName(
        clearanceRequest,
        personnelData
      );

      setPdfDownloadProgress(80);

      // Download locally first
      downloadPdf(filledPdfBytes, fileName);

      setPdfDownloadProgress(85);

      try {
        // Upload to storage
        const uploadResult = await uploadClearanceDocumentToStorage({
          record: {
            ...clearanceRequest,
            fullName: clearanceRequest.employee,
            badgeNumber: clearanceRequest.badge_number,
            rank: clearanceRequest.rank,
          },
          pdfBytes: pdfBytesForUpload,
          fileName,
          isYearly: false,
          generatedBy: "Administrator",
        });

        // Save metadata
        await saveClearanceDocumentMetadata({
          clearanceRequestId: clearanceRequest.id,
          documentName: fileName,
          fileUrl: uploadResult.fileUrl,
          filePath: uploadResult.filePath,
          fileSize: pdfBytesForUpload.byteLength,
          uploadedBy: "Administrator",
        });

        toast.success("PDF generated and uploaded successfully!", {
          position: "top-right",
          autoClose: 3000,
        });

        setPdfDownloadProgress(100);
      } catch (uploadError) {
        console.warn("Upload process error:", uploadError);
        toast.warn("PDF downloaded locally. Cloud upload failed.", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error generating clearance form:", error);
      toast.error(`Failed to generate PDF: ${error.message}`, {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setTimeout(() => {
        setGeneratingPdf(false);
        setPdfDownloadForRequest(null);
        setPdfDownloadProgress(0);
      }, 1000);
    }
  };

  const saveClearanceDocument = async (documentData) => {
    try {
      const { data, error } = await supabase
        .from("clearance_documents")
        .insert([
          {
            clearance_request_id: documentData.clearanceRequestId,
            document_type: "CLEARANCE_FORM",
            document_category: "Clearance Form",
            document_name: documentData.documentName,
            file_url: documentData.fileUrl,
            file_path: documentData.filePath,
            file_type: "application/pdf",
            file_size: documentData.fileSize,
            description: "Automatically generated clearance certificate",
            uploaded_by: documentData.uploadedBy || "System",
            uploaded_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error saving clearance document metadata:", error);
        throw error;
      }

      // Update existing PDFs state
      setExistingPdfs((prev) => ({
        ...prev,
        [documentData.clearanceRequestId]: [
          ...(prev[documentData.clearanceRequestId] || []),
          data,
        ],
      }));

      return data;
    } catch (error) {
      console.error("Error in saveClearanceDocument:", error);
      throw error;
    }
  };

  const showDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const totalPages = Math.ceil(filteredRequests.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredRequests.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredRequests.length / rowsPerPage)
    );
    const hasNoData = filteredRequests.length === 0;

    const buttons = [];

    buttons.push(
      <button
        key="prev"
        className={`${styles.clearancePaginationBtn} ${
          hasNoData ? styles.clearanceDisabled : ""
        }`}
        disabled={currentPage === 1 || hasNoData}
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
      >
        Previous
      </button>
    );

    buttons.push(
      <button
        key={1}
        className={`${styles.clearancePaginationBtn} ${
          1 === currentPage ? styles.clearanceActive : ""
        } ${hasNoData ? styles.clearanceDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.clearancePaginationEllipsis}>
          ...
        </span>
      );
    }

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(pageCount - 1, currentPage + 1);

    if (currentPage <= 3) {
      endPage = Math.min(pageCount - 1, 4);
    }

    if (currentPage >= pageCount - 2) {
      startPage = Math.max(2, pageCount - 3);
    }

    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < pageCount) {
        buttons.push(
          <button
            key={i}
            className={`${styles.clearancePaginationBtn} ${
              i === currentPage ? styles.clearanceActive : ""
            } ${hasNoData ? styles.clearanceDisabled : ""}`}
            onClick={() => setCurrentPage(i)}
            disabled={hasNoData}
          >
            {i}
          </button>
        );
      }
    }

    if (currentPage < pageCount - 2) {
      buttons.push(
        <span key="ellipsis2" className={styles.clearancePaginationEllipsis}>
          ...
        </span>
      );
    }

    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.clearancePaginationBtn} ${
            pageCount === currentPage ? styles.clearanceActive : ""
          } ${hasNoData ? styles.clearanceDisabled : ""}`}
          onClick={() => setCurrentPage(pageCount)}
          disabled={hasNoData}
        >
          {pageCount}
        </button>
      );
    }

    buttons.push(
      <button
        key="next"
        className={`${styles.clearancePaginationBtn} ${
          hasNoData ? styles.clearanceDisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  const renderBottomPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredRequests.length / rowsPerPage)
    );
    const hasNoData = filteredRequests.length === 0;

    const buttons = [];

    buttons.push(
      <button
        key="prev-bottom"
        className={`${styles.clearancePaginationBtn} ${
          hasNoData ? styles.clearanceDisabled : ""
        }`}
        disabled={currentPage === 1 || hasNoData}
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
      >
        Previous
      </button>
    );

    buttons.push(
      <button
        key={`1-bottom`}
        className={`${styles.clearancePaginationBtn} ${
          1 === currentPage ? styles.clearanceActive : ""
        } ${hasNoData ? styles.clearanceDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    if (currentPage > 3) {
      buttons.push(
        <span
          key="ellipsis1-bottom"
          className={styles.clearancePaginationEllipsis}
        >
          ...
        </span>
      );
    }

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(pageCount - 1, currentPage + 1);

    if (currentPage <= 3) {
      endPage = Math.min(pageCount - 1, 4);
    }

    if (currentPage >= pageCount - 2) {
      startPage = Math.max(2, pageCount - 3);
    }

    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < pageCount) {
        buttons.push(
          <button
            key={`${i}-bottom`}
            className={`${styles.clearancePaginationBtn} ${
              i === currentPage ? styles.clearanceActive : ""
            } ${hasNoData ? styles.clearanceDisabled : ""}`}
            onClick={() => setCurrentPage(i)}
            disabled={hasNoData}
          >
            {i}
          </button>
        );
      }
    }

    if (currentPage < pageCount - 2) {
      buttons.push(
        <span
          key="ellipsis2-bottom"
          className={styles.clearancePaginationEllipsis}
        >
          ...
        </span>
      );
    }

    if (pageCount > 1) {
      buttons.push(
        <button
          key={`${pageCount}-bottom`}
          className={`${styles.clearancePaginationBtn} ${
            pageCount === currentPage ? styles.clearanceActive : ""
          } ${hasNoData ? styles.clearanceDisabled : ""}`}
          onClick={() => setCurrentPage(pageCount)}
          disabled={hasNoData}
        >
          {pageCount}
        </button>
      );
    }

    buttons.push(
      <button
        key="next-bottom"
        className={`${styles.clearancePaginationBtn} ${
          hasNoData ? styles.clearanceDisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  const handleGeneratePdfWithOfficerNames = (clearanceRequest) => {
    setSelectedRequestForPdf(clearanceRequest);
    setShowOfficerModal(true);
  };

  const handleConfirmOfficerNames = async (names) => {
    setShowOfficerModal(false);
    if (selectedRequestForPdf) {
      await generateAndUploadClearanceForm(selectedRequestForPdf, names);
    }
    setOfficerNames(names);
    setSelectedRequestForPdf(null);
  };

  const renderDownloadColumn = (req) => {
    if (req.status === "Completed") {
      return (
        <div className={styles.downloadActions}>
          {existingPdfs[req.id] && existingPdfs[req.id].length > 0 ? (
            <>
              <button
                className={styles.downloadExistingBtn}
                onClick={() =>
                  downloadExistingPdf(existingPdfs[req.id][0].file_url, req)
                }
                title="Download existing clearance PDF"
              >
                📥 Download
              </button>
              <button
                className={styles.generateWithOfficersBtn}
                onClick={() => handleGeneratePdfWithOfficerNames(req)}
                disabled={pdfDownloadForRequest === req.id || generatingPdf}
                title="Generate PDF with custom officer names"
              >
                ✏️ Customize
              </button>
            </>
          ) : (
            <button
              className={styles.generatePdfBtn}
              onClick={() => handleGeneratePdfWithOfficerNames(req)}
              disabled={pdfDownloadForRequest === req.id || generatingPdf}
              title="Generate clearance certificate PDF"
            >
              {pdfDownloadForRequest === req.id ? (
                <>
                  <span className={styles.spinner}></span>
                  Generating...
                </>
              ) : (
                "📄 Generate"
              )}
            </button>
          )}
        </div>
      );
    } else {
      return (
        <span className={styles.notAvailable}>
          {req.status === "Pending"
            ? "Pending Completion"
            : req.status === "In Progress"
            ? "In Progress"
            : "Not Available"}
        </span>
      );
    }
  };

  // FIXED: Add this helper function that was missing
  const checkClearanceApprovalEligibility = async (requestId, personnelId) => {
    try {
      const request = clearanceRequests.find((r) => r.id === requestId);
      if (!request) return false;

      const isEquipmentRelated =
        request.type === "Retirement" ||
        request.type === "Resignation" ||
        request.type === "Equipment Completion";

      if (!isEquipmentRelated) {
        return true;
      }

      // Check for lost equipment
      const { data: lostRecords, error: lostError } = await supabase
        .from("accountability_records")
        .select("id, is_settled")
        .eq("personnel_id", personnelId)
        .eq("clearance_request_id", requestId)
        .eq("record_type", "LOST")
        .eq("is_settled", false);

      if (!lostError && lostRecords && lostRecords.length > 0) {
        return false;
      }

      // Check if there's any accountability record
      const { data: accountabilityData, error } = await supabase
        .from("personnel_equipment_accountability_table")
        .select("accountability_status")
        .eq("personnel_id", personnelId)
        .eq("clearance_request_id", requestId)
        .maybeSingle();

      if (error) {
        console.error("Error checking accountability:", error);
        return false;
      }

      // If there's an accountability record, check if it's settled
      if (accountabilityData) {
        return accountabilityData.accountability_status === "SETTLED";
      }

      // No accountability record means no lost/damaged equipment
      return true;
    } catch (err) {
      console.error("Error in checkClearanceApprovalEligibility:", err);
      return false;
    }
  };

  // FIXED: Add subscription effects
  useEffect(() => {
    // Subscribe to clearance_requests changes
    const clearanceSubscription = supabase
      .channel("clearance-requests-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clearance_requests",
        },
        (payload) => {
          console.log("Clearance request changed:", payload);
          loadClearanceRequests();
        }
      )
      .subscribe();

    // Subscribe to clearance_inventory changes
    const inventorySubscription = supabase
      .channel("clearance-inventory-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clearance_inventory",
        },
        (payload) => {
          console.log("Clearance inventory changed:", payload);
          loadClearanceRequests();
        }
      )
      .subscribe();

    // Subscribe to inspections changes
    const inspectionsSubscription = supabase
      .channel("inspections-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inspections",
        },
        (payload) => {
          console.log("Inspection changed:", payload);
          loadClearanceRequests();
        }
      )
      .subscribe();

    // Subscribe to accountability changes
    const accountabilitySubscription = supabase
      .channel("accountability-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "personnel_equipment_accountability_table",
        },
        (payload) => {
          console.log("Accountability changed:", payload);
          loadClearanceRequests();
        }
      )
      .subscribe();

    // Subscribe to accountability_records changes for lost equipment
    const accountabilityRecordsSubscription = supabase
      .channel("accountability-records-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accountability_records",
        },
        (payload) => {
          console.log("Accountability record changed:", payload);
          loadClearanceRequests();
        }
      )
      .subscribe();

    return () => {
      clearanceSubscription.unsubscribe();
      inventorySubscription.unsubscribe();
      inspectionsSubscription.unsubscribe();
      accountabilitySubscription.unsubscribe();
      accountabilityRecordsSubscription.unsubscribe();
    };
  }, []);

  // Add force refresh function
  const forceRefreshRequests = async () => {
    console.log("🔄 Force refreshing clearance requests...");
    await loadClearanceRequests();
    setRefreshKey((prev) => prev + 1);
  };

  if (showPreloader) {
    return (
      <div className={styles.clearanceSystem}>
        <Title>Clearance System | BFP Villanueva</Title>
        <Meta name="robots" content="noindex, nofollow" />
        <ToastContainer />
        <BFPPreloader
          loading={showPreloader}
          progress={preloaderProgress}
          moduleTitle="CLEARANCE SYSTEM • Loading Clearance Requests..."
          onRetry={handleRetryPreloader}
        />
      </div>
    );
  }

  return (
    <div className={styles.clearanceSystem}>
      <Title>Clearance System | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />



      <Hamburger />
      <Sidebar />
      <OfficerInputModal
        isOpen={showOfficerModal}
        onClose={() => setShowOfficerModal(false)}
        onConfirm={handleConfirmOfficerNames}
        initialData={officerNames}
        isGenerating={
          generatingPdf && pdfDownloadForRequest === selectedRequestForPdf?.id
        }
      />
      {showNoEquipmentModal.show && (
        <div className={styles.noEquipmentModalOverlay}>
          <div className={styles.noEquipmentModal}>
            <div className={styles.noEquipmentModalHeader}>
              <h3>No Equipment Found</h3>
              <button
                onClick={() =>
                  setShowNoEquipmentModal({
                    show: false,
                    personnelName: "",
                    clearanceType: "",
                  })
                }
                className={styles.closeButton}
              >
                &times;
              </button>
            </div>
            <div className={styles.noEquipmentModalBody}>
              <div className={styles.warningIcon}>🚫</div>
              <p>
                <strong>{showNoEquipmentModal.personnelName}</strong> has no
                assigned equipment.
              </p>
              <p>
                {showNoEquipmentModal.clearanceType} clearance requires
                equipment accountability check.
              </p>
              <p className={styles.warningText}>
                Please ensure all equipment is properly assigned to this
                personnel before submitting a clearance request.
              </p>
              <div className={styles.helpText}>
                <p>
                  <strong>Possible reasons:</strong>
                </p>
                <ul>
                  <li>Equipment hasn't been assigned to this personnel yet</li>
                  <li>Equipment records might be missing or inactive</li>
                  <li>Personnel might not require equipment for their role</li>
                </ul>
              </div>
            </div>
            <div className={styles.noEquipmentModalFooter}>
              <button
                className={styles.cancelButton}
                onClick={() =>
                  setShowNoEquipmentModal({
                    show: false,
                    personnelName: "",
                    clearanceType: "",
                  })
                }
              >
                Cancel
              </button>
              <button
                className={styles.continueButton}
                onClick={continueClearanceSubmission}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1>Clearance System</h1>

        <div className={styles.clearanceCard}>
          <h2>Initiate Clearance</h2>
          <button
            className={`${styles.clearanceShowFormBtn} ${
              showForm ? styles.showing : ""
            }`}
            onClick={() => setShowForm(!showForm)}
            disabled={loading}
            type="button"
          >
            {showForm ? "Hide Form" : "Initiate Clearance"}
          </button>

          <form
            className={`${styles.clearanceForm} ${showForm ? styles.show : ""}`}
            onSubmit={handleClearanceSubmit}
          >
            <div className={styles.clearanceFormSection}>
              <h3>Employee Information</h3>

              <div className={styles.clearanceInputGroup}>
                <select
                  id={styles.clearanceEmployeeSelect}
                  required
                  value={newClearance.personnel_id}
                  onChange={handleEmployeeChange}
                  disabled={loading}
                >
                  <option value="">Select Employee</option>
                  {personnelList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {`${emp.first_name || ""} ${emp.middle_name || ""} ${
                        emp.last_name || ""
                      }`.trim()}
                      {emp.username ? ` (@${emp.username})` : ""}
                      {emp.badge_number ? ` (${emp.badge_number})` : ""}
                    </option>
                  ))}
                </select>
                <h4>Select Employee</h4>
                {newClearance.employee_name && (
                  <div className={styles.selectedEmployee}>
                    Selected: {newClearance.employee_name}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.clearanceFormSection}>
              <h3>Clearance Details</h3>

              <div className={styles.clearanceInputGroup}>
                <select
                  id={styles.clearanceTypeSelect}
                  required
                  value={newClearance.type}
                  onChange={(e) =>
                    setNewClearance((prev) => ({
                      ...prev,
                      type: e.target.value,
                      equipment_ids: [],
                    }))
                  }
                  disabled={loading}
                >
                  <option value="">Select Clearance Type</option>
                  <option value="Resignation">Resignation</option>
                  <option value="Retirement">Retirement</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Administrative">Administrative</option>
                  <option value="Equipment Completion">
                    Equipment Completion
                  </option>
                  <option value="Promotion">Promotion</option>
                  <option value="Others">Others</option>
                </select>
                <h4>Select Clearance Type</h4>
                {newClearance.type === "Equipment Completion" && (
                  <div className={styles.equipmentNotice}>
                    <p>
                      ✓ All assigned equipment will be automatically added for
                      clearance
                    </p>
                  </div>
                )}
                {(newClearance.type === "Resignation" ||
                  newClearance.type === "Retirement" ||
                  newClearance.type === "Equipment Completion") &&
                  newClearance.personnel_id && (
                    <div className={styles.lostEquipmentWarning}>
                      <p>
                        ⚠️ System will check for lost equipment in
                        accountability records
                      </p>
                    </div>
                  )}
              </div>
            </div>

            {newClearance.type &&
              (newClearance.type === "Resignation" ||
                newClearance.type === "Retirement") &&
              inventoryItems.length > 0 && (
                <div className={styles.clearanceFormSection}>
                  <div className={styles.equipmentNotice}>
                    <h4>Assigned Equipment (will be automatically added)</h4>
                    <div className={styles.equipmentListPreview}>
                      <div className={styles.equipmentTableContainer}>
                        <table className={styles.equipmentPreviewTable}>
                          <thead>
                            <tr>
                              <th>Item Name</th>
                              <th>Code</th>
                              <th>Status</th>
                              <th>Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inventoryItems.map((item) => (
                              <tr key={item.id}>
                                <td>{item.item_name}</td>
                                <td>{item.item_code}</td>
                                <td>
                                  <span
                                    className={`${
                                      styles.equipmentStatusBadge
                                    } ${
                                      styles[
                                        item.status
                                          ?.toLowerCase()
                                          .replace(/\s+/g, "")
                                      ] || styles.available
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </td>
                                <td>
                                  {item.price ? formatPHP(item.price) : "₱0.00"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.equipmentSummary}>
                        <p>
                          <strong>Total Items:</strong>
                          <span className={styles.totalItems}>
                            {inventoryItems.length} item
                            {inventoryItems.length !== 1 ? "s" : ""}
                          </span>
                        </p>
                        <p>
                          <strong>Total Value:</strong>
                          <span className={styles.totalValue}>
                            {formatPHP(
                              inventoryItems.reduce(
                                (sum, item) => sum + (item.price || 0),
                                0
                              )
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            <div className={styles.clearanceFormActions}>
              <button
                type="button"
                onClick={() => {
                  setNewClearance({
                    personnel_id: "",
                    employee_name: "",
                    type: "",
                    equipment_ids: [],
                  });
                  setInventoryItems([]);
                }}
                className={styles.clearanceCancelBtn}
                disabled={loading}
              >
                Clear Form
              </button>
              <button
                type="submit"
                className={styles.clearanceSubmitBtn}
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Clearance"}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.clearanceFilterSearchWrapper}>
          <div className={styles.clearanceFilterGroup}>
            <label htmlFor="clearanceStatusFilter">Status:</label>
            <select
              id={styles.clearanceStatusFilter}
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className={styles.clearanceFilterGroup}>
            <label htmlFor="clearanceTypeFilter">Type:</label>
            <select
              id={styles.clearanceTypeFilter}
              value={filters.type}
              onChange={(e) => handleFilterChange("type", e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Resignation">Resignation</option>
              <option value="Retirement">Retirement</option>
              <option value="Equipment Completion">Equipment Completion</option>
              <option value="Promotion">Promotion</option>
              <option value="Others">Others</option>
            </select>
          </div>

          <div className={styles.clearanceSearchGroup}>
            <label htmlFor="clearanceSearchInput">Search:</label>
            <input
              type="text"
              id={styles.clearanceSearchInput}
              placeholder="Search by name, type, badge..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
            />
          </div>
        </div>

        <div
          className={`${styles.clearancePaginationContainer} ${styles.clearanceTopPagination}`}
        >
          {renderPaginationButtons()}
        </div>

        <div className={styles.clearanceTableContainer}>
          <table className={styles.clearanceTable}>
            <thead>
              <tr>
                <th>Request Date</th>
                <th className={styles.rankHeader}>Personnel</th>
                <th>Badge No.</th>
                <th>Clearance Type</th>
                <th>Equipment</th>
                <th>Status</th>
                <th>Inspection</th>
                <th>Lost Equipment</th>
                <th>Actions</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((req) => (
                  <tr key={req.id}>
                    <td>{req.date || ""}</td>
                    <td className={styles.rankCellColumn}>
                      <div className={styles.rankCell}>
                        {req.rank_image ? (
                          <>
                            <img
                              src={req.rank_image}
                              alt={req.rank || "Rank"}
                              className={styles.rankImage}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = "none";
                                const placeholder = e.target
                                  .closest(`.${styles.rankCell}`)
                                  ?.querySelector(`.${styles.rankPlaceholder}`);
                                if (placeholder) {
                                  placeholder.classList.remove(styles.hidden);
                                }
                              }}
                            />
                            <div
                              className={`${styles.rankPlaceholder} ${
                                req.rank_image ? styles.hidden : ""
                              }`}
                            >
                              <span className={styles.rankPlaceholderText}>
                                {req.rank?.charAt(0) || "R"}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className={`${styles.rankPlaceholder} ${styles.show}`}
                            >
                              <span className={styles.rankPlaceholderText}>
                                {req.employee?.charAt(0) || "U"}
                              </span>
                            </div>
                            <img
                              src=""
                              alt=""
                              className={`${styles.rankImage} ${styles.hidden}`}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = "none";
                              }}
                            />
                          </>
                        )}
                        <span className={styles.rankText}>{req.employee}</span>
                      </div>
                    </td>
                    <td>{req.badge_number || ""}</td>
                    <td>{req.type || ""}</td>
                    <td>
                      {req.equipment_count > 0 ? (
                        <div className={styles.equipmentBadge}>
                          <span className={styles.equipmentCount}>
                            {req.equipment_display}
                          </span>
                          <button
                            className={styles.viewEquipmentBtn}
                            onClick={() => viewEquipment(req.id)}
                          >
                            Show
                          </button>
                        </div>
                      ) : (
                        <span className={styles.equipmentDisplay}>
                          {req.equipment_display}
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.clearanceStatus} ${
                          styles[statusToClass(req.status)]
                        }`}
                      >
                        {req.status || ""}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.inspectionStatus} ${
                          styles[
                            (req.inspection_status || "")
                              .toLowerCase()
                              .replace(/\s+/g, "-")
                              .replace("not-applicable", "notapplicable")
                              .replace("not-yet-added", "notyetadded")
                              .replace("in-progress", "inprogress")
                              .replace("pass-(settled)", "passsettled")
                              .replace(
                                "fail-(unsettled-lost-equipment)",
                                "failunsettled"
                              )
                              .replace(
                                "fail-(accountability-pending)",
                                "failaccountability"
                              )
                              .replace(
                                "fail-(needs-accountability)",
                                "failaccountability"
                              ) || "pending"
                          ]
                        }`}
                      >
                        {req.inspection_status === "In Progress"
                          ? "🔍 Inspection Scheduled"
                          : req.inspection_status === "PASS (Settled)"
                          ? "✅ PASS (Accountability Settled)"
                          : req.inspection_status ===
                            "FAIL (Unsettled Lost Equipment)"
                          ? "❌ FAIL - Unsettled Lost Equipment"
                          : req.inspection_status ===
                            "FAIL (Accountability Pending)"
                          ? "❌ FAIL - Accountability Pending"
                          : req.inspection_status ===
                            "FAIL (Needs Accountability)"
                          ? "❌ FAIL - Needs Accountability"
                          : req.inspection_status}

                        {req.inspection_status === "Pending" &&
                          req.equipment_count > 0 && (
                            <span
                              style={{
                                fontSize: "10px",
                                display: "block",
                                color: "#666",
                              }}
                            >
                              (Awaiting schedule)
                            </span>
                          )}
                      </span>
                    </td>
                    <td>
                      {req.lost_equipment_count > 0 ? (
                        <div className={styles.lostEquipmentStatus}>
                          <span
                            className={`${styles.lostEquipmentBadge} ${
                              req.lost_equipment_status.includes("Unsettled")
                                ? styles.lostEquipmentUnsettled
                                : styles.lostEquipmentSettled
                            }`}
                          >
                            {req.lost_equipment_count}
                            {req.lost_equipment_status.includes("Unsettled")
                              ? " ⚠️Equipment Needs Settlement"
                              : "✅"}
                          </span>
       
                        </div>
                      ) : (
                        <span className={styles.noLostEquipment}>None</span>
                      )}
                    </td>
                    <td className={styles.clearanceActions}>
                      {req.status === "Pending" ||
                      req.status === "Pending for Approval" ? (
                        <>
                          {/* Debug info (hidden) */}
                          <div style={{ display: "none" }}>
                            ID: {req.id} | Status: {req.status} | Inspection:{" "}
                            {req.inspection_status} | Type: {req.type}
                          </div>

                          {shouldShowApproveRejectButtons(req) ? (
                            <>
                              <button
                                id={styles.clearanceApprove}
                                onClick={() => openApproveModal(req)}
                                disabled={loading}
                              >
                                Approve
                              </button>
                              <button
                                className={styles.clearanceRejects}
                                onClick={() => openRejectModal(req)}
                                disabled={loading}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className={styles.pendingInspectionNote}>
                              {req.inspection_status === "Pending"
                                ? "Awaiting inspection schedule"
                                : req.inspection_status === "In Progress"
                                ? "Inspection in progress"
                                : `Awaiting: ${
                                    req.inspection_status || "inspection"
                                  }`}
                            </span>
                          )}
                          <button
                            className={styles.clearanceView}
                            onClick={() => showDetails(req)}
                          >
                            Details
                          </button>
                        </>
                      ) : (
                        <button
                          className={styles.clearanceView}
                          onClick={() => showDetails(req)}
                        >
                          View
                        </button>
                      )}
                    </td>
                    <td className={styles.downloadColumn}>
                      {renderDownloadColumn(req)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="11"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>📜</span>
                    </div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#2b2b2b",
                        marginBottom: "8px",
                      }}
                    >
                      No clearance documents available
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#999",
                      }}
                    >
                      No clearance applications found in the system
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className={`${styles.clearancePaginationContainer} ${styles.clearanceBottomPagination}`}
        >
          {renderBottomPaginationButtons()}
        </div>

        {/* Equipment Modal */}
        {showEquipmentModal && selectedRequest && (
          <div
            className={`${styles.equipmentModalOverlay} ${
              isSidebarCollapsed ? styles.collapsed : ""
            }`}
            style={{
              left: isSidebarCollapsed ? "80px" : "250px",
              width: isSidebarCollapsed
                ? "calc(100vw - 80px)"
                : "calc(100vw - 250px)",
              transition: "left 0.3s ease, width 0.3s ease",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowEquipmentModal(false);
              }
            }}
          >
            <div
              className={styles.equipmentModal}
              style={{
                marginLeft: isSidebarCollapsed ? "0" : "0",
                left: isSidebarCollapsed ? "0" : "0",
                transform: "none",
              }}
            >
              <div className={styles.equipmentModalHeader}>
                <h3>
                  Equipment for Clearance - {selectedRequest.employee}
                  {selectedRequest.equipment_source === "inventory" && (
                    <span className={styles.sourceBadge}>
                      {" "}
                      (From Inventory)
                    </span>
                  )}
                  {selectedRequest.lost_equipment_count > 0 && (
                    <span className={styles.lostEquipmentBadge}>
                      ⚠️ {selectedRequest.lost_equipment_count} Lost Item(s)
                      {selectedRequest.lost_equipment.filter(
                        (item) =>
                          item.clearance_request_id === selectedRequest.id
                      ).length > 0 && " • Linked to this clearance"}
                    </span>
                  )}
                </h3>
                <button
                  className={styles.clearanceCloseBtn}
                  onClick={() => setShowEquipmentModal(false)}
                >
                  &times;
                </button>
              </div>

              <div className={styles.equipmentModalContent}>
                {/* Lost Equipment Section */}
                {selectedRequest.lost_equipment_count > 0 && (
                  <div className={styles.lostEquipmentSection}>
                    <div className={styles.lostEquipmentHeader}>
                      <h4 className={styles.lostEquipmentTitle}>
                        ⚠️ Lost Equipment Status
                        <span className={styles.clearanceLinkInfo}>
                          {
                            lostEquipment.filter(
                              (item) =>
                                item.clearance_request_id === selectedRequest.id
                            ).length
                          }
                          of {lostEquipment.length} linked to this clearance
                        </span>
                      </h4>
                      <button
                        className={styles.linkAllBtn}
                        onClick={async () => {
                          try {
                            const { success, linkedCount } =
                              await linkLostEquipmentToClearance(
                                selectedRequest.id,
                                selectedRequest.personnel_id
                              );
                            if (success && linkedCount > 0) {
                              toast.success(
                                `Linked ${linkedCount} lost equipment records to this clearance`
                              );
                              viewEquipment(selectedRequest.id);
                            }
                          } catch (error) {
                            toast.error("Failed to link lost equipment");
                          }
                        }}
                      >
                        Link All to Clearance
                      </button>
                    </div>
                    <div className={styles.equipmentTableContainer}>
                      <table className={styles.lostEquipmentTable}>
                        <thead>
                          <tr>
                            <th>Item Name</th>
                            <th>Item Code</th>
                            <th>Lost Date</th>
                            <th>Status</th>
                            <th>Amount Due</th>
                            <th>Linked to Clearance</th>
                            <th>Settlement Date</th>
                            <th>Return Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lostEquipment.map((item) => (
                            <tr
                              key={item.id}
                              className={styles.lostEquipmentRow}
                            >
                              <td>{item.item_name}</td>
                              <td>{item.item_code}</td>
                              <td>
                                {item.record_date
                                  ? new Date(
                                      item.record_date
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </td>
                              <td>
                                <span
                                  className={`${styles.statusBadge} ${
                                    item.is_settled
                                      ? styles.settled
                                      : styles.pending
                                  }`}
                                >
                                  {item.is_settled ? "Settled" : "Pending"}
                                </span>
                              </td>
                              <td>{formatPHP(item.amount_due)}</td>
                              <td>
                                <span
                                  className={`${styles.clearanceLinkStatus} ${
                                    item.clearance_request_id ===
                                    selectedRequest.id
                                      ? styles.linked
                                      : styles.notLinked
                                  }`}
                                >
                                  {item.clearance_request_id ===
                                  selectedRequest.id
                                    ? "✅ Linked"
                                    : "❌ Not Linked"}
                                </span>
                              </td>
                              <td>
                                {item.settlement_date
                                  ? new Date(
                                      item.settlement_date
                                    ).toLocaleDateString()
                                  : item.is_settled
                                  ? "Settled"
                                  : "Not Settled"}
                              </td>
                              <td>
                                <span
                                  className={`${styles.returnStatus} ${
                                    item.equipment_returned
                                      ? styles.returned
                                      : styles.notReturned
                                  }`}
                                >
                                  {item.equipment_returned
                                    ? "Returned"
                                    : "Not Returned"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.lostEquipmentSummary}>
                      <p>
                        <strong>Total Lost Items:</strong>
                        <span>{selectedRequest.lost_equipment_count}</span>
                      </p>
                      <p>
                        <strong>Linked to Clearance:</strong>
                        <span>
                          {
                            lostEquipment.filter(
                              (item) =>
                                item.clearance_request_id === selectedRequest.id
                            ).length
                          }
                        </span>
                      </p>
                      <p>
                        <strong>Total Amount Due:</strong>
                        <span>
                          {formatPHP(
                            lostEquipment.reduce(
                              (sum, item) => sum + (item.amount_due || 0),
                              0
                            )
                          )}
                        </span>
                      </p>
                      <p>
                        <strong>Cleared for Approval:</strong>
                        <span
                          className={
                            lostEquipment.every((item) => item.is_settled)
                              ? styles.clearedYes
                              : styles.clearedNo
                          }
                        >
                          {lostEquipment.every((item) => item.is_settled)
                            ? "YES"
                            : "NO"}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Regular Equipment Section */}
                <div className={styles.equipmentSection}>
                  <h4>Assigned Equipment ({selectedEquipment.length} items)</h4>
                  {equipmentLoading ? (
                    <p>Loading equipment...</p>
                  ) : (
                    <div className={styles.equipmentTableContainer}>
                      <table className={styles.equipmentTable}>
                        <thead>
                          <tr>
                            <th>Item Name</th>
                            <th>Item Code</th>
                            <th>Category</th>
                            <th>Assigned To</th>
                            <th>Value</th>
                            <th>Clearance Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEquipment.map((item) => {
                            const statusClass =
                              item.clearance_status?.toLowerCase() || "pending";
                            const hasAccountability =
                              item.accountability_info &&
                              item.accountability_info.length > 0;

                            return (
                              <tr key={item.id}>
                                <td>{item.name}</td>
                                <td>{item.code}</td>
                                <td>{item.category}</td>
                                <td>{item.personnel_name}</td>
                                <td>
                                  {formatPHP(item.price || item.current_value)}
                                </td>
                                <td>
                                  <span
                                    className={`${styles.statusBadge} ${styles[statusClass]}`}
                                  >
                                    {item.clearance_status}
                                  </span>
                                  {hasAccountability && (
                                    <div
                                      className={styles.accountabilityIndicator}
                                    >
                                      ⚖️ Accountability
                                      {item.accountability_info[0]?.is_settled
                                        ? " Settled"
                                        : " Pending"}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Equipment Summary */}
                  {selectedEquipment.length > 0 && (
                    <div className={styles.equipmentSummary}>
                      <p>
                        <strong>Total Items:</strong>
                        <span className={styles.totalItems}>
                          {selectedEquipment.length} item
                          {selectedEquipment.length !== 1 ? "s" : ""}
                        </span>
                      </p>
                      <p>
                        <strong>Total Value:</strong>
                        <span className={styles.totalValue}>
                          {formatPHP(
                            selectedEquipment.reduce(
                              (sum, item) =>
                                sum + (item.price || item.current_value || 0),
                              0
                            )
                          )}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedRequest && (
          <div
            className={`${styles.clearanceModalOverlay} ${
              isSidebarCollapsed ? styles.collapsed : ""
            } ${styles.compactModal}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDetailsModal(false);
              }
            }}
          >
            <div className={`${styles.clearanceModal} ${styles.compactView}`}>
              <div className={styles.clearanceModalContentDetails}>
                <div className={styles.clearanceModalHeaderDetails}>
                  <div className={styles.modalHeaderCompact}>
                    <div className={styles.headerLeftCompact}>
                      <h2>Clearance Details</h2>
                      <div className={styles.headerInfoCompact}>
                        <span
                          className={`${styles.requestStatusCompact} ${
                            styles[statusToClass(selectedRequest.status)]
                          }`}
                        >
                          {selectedRequest.status}
                        </span>
                        <span
                          className={`${styles.requestTypeCompact} ${
                            styles[
                              selectedRequest.type
                                ?.replace(/\s+/g, "-")
                                .toLowerCase()
                            ]
                          }`}
                        >
                          {selectedRequest.type}
                        </span>
                      </div>
                    </div>
                    <div className={styles.headerRightCompact}>
                      <span className={styles.dateCompact}>
                        {selectedRequest.date}
                      </span>
                      <button
                        className={styles.clearanceCloseBtnCompact}
                        onClick={() => setShowDetailsModal(false)}
                        type="button"
                        aria-label="Close modal"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                </div>
                <div className={styles.clearanceModalBodyDetails}>
                  <div className={styles.compactLayout}>
                    <div className={styles.leftColumnCompact}>
                      <div className={styles.infoSectionCompact}>
                        <h3 className={styles.sectionTitleCompact}>
                          <span className={styles.sectionIconCompact}>👤</span>
                          Personnel
                        </h3>
                        <div className={styles.personnelInfo}>
                          <div className={styles.personnelNameCompact}>
                            {selectedRequest.employee}
                          </div>
                          <div className={styles.personnelDetails}>
                            <div className={styles.detailItemCompact}>
                              <span className={styles.detailLabelCompact}>
                                Badge:
                              </span>
                              <span className={styles.detailValueCompact}>
                                {selectedRequest.badge_number || "N/A"}
                              </span>
                            </div>
                            <div className={styles.detailItemCompact}>
                              <span className={styles.detailLabelCompact}>
                                Rank:
                              </span>
                              <span className={styles.detailValueCompact}>
                                {selectedRequest.rank || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.infoSectionCompact}>
                        <h3 className={styles.sectionTitleCompact}>
                          <span className={styles.sectionIconCompact}>⏱️</span>
                          Timeline
                        </h3>
                        <div className={styles.timelineCompact}>
                          <div className={styles.timelineItemCompact}>
                            <span className={styles.timelineLabelCompact}>
                              Created:
                            </span>
                            <span className={styles.timelineValueCompact}>
                              {selectedRequest.created_at
                                ? new Date(
                                    selectedRequest.created_at
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "N/A"}
                            </span>
                          </div>
                          {selectedRequest.approved_at && (
                            <div className={styles.timelineItemCompact}>
                              <span className={styles.timelineLabelCompact}>
                                Approved:
                              </span>
                              <span className={styles.timelineValueCompact}>
                                {new Date(
                                  selectedRequest.approved_at
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={styles.rightColumnCompact}>
                      <div className={styles.infoSectionCompact}>
                        <h3 className={styles.sectionTitleCompact}>
                          <span className={styles.sectionIconCompact}>🛠️</span>
                          Equipment Status
                        </h3>
                        <div className={styles.equipmentStatusCompact}>
                          <div className={styles.equipmentStatsRow}>
                            <div className={styles.statBoxCompact}>
                              <div className={styles.statNumberCompact}>
                                {selectedRequest.equipment_count || 0}
                              </div>
                              <div className={styles.statLabelCompact}>
                                Items
                              </div>
                            </div>
                            <div className={styles.statBoxCompact}>
                              <div
                                className={`${styles.inspectionStatusCompact} ${
                                  styles[
                                    selectedRequest.inspection_status
                                      ?.toLowerCase()
                                      .replace(/\s+/g, "-")
                                  ] || "pending"
                                }`}
                              >
                                {selectedRequest.inspection_status || "N/A"}
                              </div>
                              <div className={styles.statLabelCompact}>
                                Inspection
                              </div>
                            </div>
                          </div>

                          {selectedRequest.lost_equipment_count > 0 && (
                            <div className={styles.lostEquipmentAlert}>
                              <span className={styles.lostIcon}>⚠️</span>
                              <span className={styles.lostText}>
                                {selectedRequest.lost_equipment_count} lost
                                item(s)
                                {selectedRequest.lost_equipment_status?.includes(
                                  "Unsettled"
                                )
                                  ? " • Needs settlement"
                                  : " • Settled"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.infoSectionCompact}>
                        <h3 className={styles.sectionTitleCompact}>
                          <span className={styles.sectionIconCompact}>⚡</span>
                          Actions
                        </h3>
                        <div className={styles.actionsContainer}>
                          {selectedRequest.status === "Completed" && (
                            <div className={styles.documentActionsContainer}>
                              {existingPdfs[selectedRequest.id] &&
                              existingPdfs[selectedRequest.id].length > 0 ? (
                                <button
                                  className={styles.actionBtnPrimary}
                                  onClick={() =>
                                    downloadExistingPdf(
                                      existingPdfs[selectedRequest.id][0]
                                        .file_url,
                                      selectedRequest
                                    )
                                  }
                                >
                                  <span className={styles.btnIcon}>📥</span>
                                  Download PDF
                                </button>
                              ) : (
                                <button
                                  className={styles.actionBtnPrimary}
                                  onClick={() => {
                                    setShowDetailsModal(false);
                                    generateAndUploadClearanceForm(
                                      selectedRequest
                                    );
                                  }}
                                  disabled={generatingPdf}
                                >
                                  {generatingPdf ? (
                                    <>
                                      <span
                                        className={styles.spinnerSmall}
                                      ></span>
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <span className={styles.btnIcon}>📄</span>
                                      Generate PDF
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}

                          <button
                            className={styles.actionBtnSecondary}
                            onClick={() => {
                              setShowDetailsModal(false);
                              viewEquipment(selectedRequest.id);
                            }}
                          >
                            <span className={styles.btnIcon}>🔍</span>
                            View Equipment
                          </button>

                          {selectedRequest.status === "Pending" &&
                            shouldShowApproveRejectButtons(selectedRequest) && (
                              <div className={styles.approveRejectButtons}>
                                <button
                                  className={styles.approveBtnCompact}
                                  onClick={() =>
                                    openApproveModal(selectedRequest)
                                  }
                                  disabled={loading}
                                >
                                  Approve
                                </button>
                                <button
                                  className={styles.rejectBtnCompact}
                                  onClick={() =>
                                    openRejectModal(selectedRequest)
                                  }
                                  disabled={loading}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedRequest.remarks && (
                    <div className={styles.remarksSectionCompact}>
                      <h3 className={styles.sectionTitleCompact}>
                        <span className={styles.sectionIconCompact}>📝</span>
                        Remarks
                      </h3>
                      <p className={styles.remarksTextCompact}>
                        {selectedRequest.remarks}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PDF Progress Overlay */}
        {generatingPdf && (
          <div
            className={`${styles.pdfProgressOverlay} ${
              isSidebarCollapsed ? styles.collapsed : ""
            }`}
          >
            <div className={styles.pdfProgressModal}>
              <h3>Generating Clearance Form PDF</h3>
              <div className={styles.pdfProgressBar}>
                <div
                  className={styles.pdfProgressFill}
                  style={{ width: `${pdfDownloadProgress}%` }}
                ></div>
              </div>
              <p>{pdfDownloadProgress}% Complete</p>
              <p className={styles.pdfProgressNote}>
                Please wait while we generate your clearance form...
              </p>
            </div>
          </div>
        )}

        {/* Clearance Submission Confirmation Modal */}
        {showSubmitConfirmation && confirmationData && (
          <div
            className={`${styles.clearanceConfirmationModalOverlay} ${
              isSidebarCollapsed ? styles.collapsed : ""
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cancelClearanceSubmission();
              }
            }}
          >
            <div className={styles.clearanceConfirmationModal}>
              <div className={styles.clearanceConfirmationHeader}>
                <h2>Confirm Clearance Request</h2>
                <button
                  className={styles.clearanceConfirmationCloseBtn}
                  onClick={cancelClearanceSubmission}
                  disabled={submissionLoading}
                >
                  &times;
                </button>
              </div>

              <div className={styles.clearanceConfirmationBody}>
                <div className={styles.clearanceConfirmationIcon}>📝</div>
                <p className={styles.clearanceConfirmationText}>
                  Are you sure you want to initiate a clearance request for
                </p>
                <p className={styles.clearanceEmployeeNameHighlight}>
                  "{confirmationData.employeeName}"?
                </p>

                <div className={styles.clearanceConfirmationDetails}>
                  <p>
                    <strong>Clearance Type:</strong> {confirmationData.type}
                  </p>
                  <p>
                    <strong>Equipment Count:</strong>{" "}
                    {confirmationData.equipmentCount} item(s)
                  </p>
                  <p>
                    <strong>Total Equipment Value:</strong>{" "}
                    {formatPHP(confirmationData.totalValue)}
                  </p>

                  {confirmationData.equipmentCount > 0 && (
                    <div className={styles.clearanceEquipmentSummary}>
                      <h4>Equipment Details:</h4>
                      <div className={styles.clearanceEquipmentList}>
                        <p>
                          <strong>Total Equipment Value:</strong>{" "}
                          {formatPHP(confirmationData.totalValue)}
                        </p>

                        {confirmationData.equipmentList
                          .slice(0, 5)
                          .map((item, index) => (
                            <div
                              key={index}
                              className={styles.clearanceEquipmentItem}
                            >
                              <span>
                                {item.item_name} ({item.item_code})
                              </span>
                              <span>{formatPHP(item.price || 0)}</span>
                            </div>
                          ))}
                        {confirmationData.equipmentCount > 5 && (
                          <div className={styles.clearanceEquipmentItem}>
                            <span>
                              ...and {confirmationData.equipmentCount - 5} more
                              items
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <p className={styles.clearanceConfirmationNote}>
                  {confirmationData.equipmentCount > 0
                    ? "This equipment will be automatically added to the clearance process."
                    : "No equipment found for this personnel."}
                </p>
              </div>

              <div className={styles.clearanceConfirmationActions}>
                <button
                  className={styles.clearanceConfirmationCancelBtn}
                  onClick={cancelClearanceSubmission}
                  disabled={submissionLoading}
                >
                  Cancel
                </button>
                <button
                  className={styles.clearanceConfirmationSubmitBtn}
                  onClick={confirmClearanceSubmission}
                  disabled={submissionLoading}
                >
                  {submissionLoading ? (
                    <>
                      <span className={styles.submissionSpinner}></span>
                      Submitting...
                    </>
                  ) : (
                    "Submit Clearance"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approve Modal */}
        {showApproveModal && (
          <div
            className={`${styles.approveRejectModalOverlay} ${
              isSidebarCollapsed ? styles.collapsed : ""
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowApproveModal(false);
              }
            }}
          >
            <div className={styles.approveRejectModal}>
              <div className={styles.approveRejectModalHeader}>
                <h3>Approve Clearance Request</h3>
                <button onClick={() => setShowApproveModal(false)}>
                  &times;
                </button>
              </div>
              <div className={styles.approveRejectModalBody}>
                <p>Are you sure you want to approve this clearance request?</p>
                <p>
                  <strong>Employee:</strong>{" "}
                  {selectedRequestForAction?.employee}
                </p>
                <p>
                  <strong>Type:</strong> {selectedRequestForAction?.type}
                </p>
                <p>
                  <strong>Status:</strong> {selectedRequestForAction?.status}
                </p>

                <div className={styles.approveRejectInputGroup}>
                  <label htmlFor="approveRemarks">
                    Approval Remarks (Optional):
                  </label>
                  <textarea
                    id="approveRemarks"
                    value={approveRemarks}
                    onChange={(e) => setApproveRemarks(e.target.value)}
                    placeholder="Enter any remarks or comments..."
                    rows={3}
                  />
                </div>
              </div>
              <div className={styles.approveRejectModalFooter}>
                <button
                  className={styles.approveRejectCancelBtn}
                  onClick={() => setShowApproveModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.approveRejectConfirmBtn}
                  onClick={handleApproveSubmit}
                  disabled={loading}
                >
                  {loading ? "Approving..." : "Confirm Approval"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div
            className={`${styles.approveRejectModalOverlay}
           ${isSidebarCollapsed ? styles.collapsed : ""}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRejectModal(false);
              }
            }}
          >
            <div className={styles.approveRejectModal}>
              <div className={styles.approveRejectModalHeader}>
                <h3>Reject Clearance Request</h3>
                <button onClick={() => setShowRejectModal(false)}>
                  &times;
                </button>
              </div>
              <div className={styles.approveRejectModalBody}>
                <p>Are you sure you want to reject this clearance request?</p>
                <p>
                  <strong>Employee:</strong>{" "}
                  {selectedRequestForAction?.employee}
                </p>
                <p>
                  <strong>Type:</strong> {selectedRequestForAction?.type}
                </p>
                <p>
                  <strong>Status:</strong> {selectedRequestForAction?.status}
                </p>

                <div className={styles.approveRejectInputGroup}>
                  <label htmlFor="rejectReason">Rejection Reason *</label>
                  <textarea
                    id="rejectReason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    rows={3}
                    required
                  />
                </div>
              </div>
              <div className={styles.approveRejectModalFooter}>
                <button
                  className={styles.approveRejectCancelBtn}
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.approveRejectConfirmBtn}
                  onClick={handleRejectSubmit}
                  disabled={loading || !rejectReason.trim()}
                  style={{
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  }}
                >
                  {loading ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClearanceSystem;
