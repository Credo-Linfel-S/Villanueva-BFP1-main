  import React, { useState, useEffect, useRef } from "react";
  import {
    FaEye,
    FaEyeSlash,
    FaCopy,
    FaCheck,
    FaDownload,
    FaFilter,
    FaUserCheck, // ← ADD THIS
    FaUserSlash, // ← ADD THIS
    FaArchive, // ← ADD THIS
    FaRedo, // ← ADD THIS
  } from "react-icons/fa";
  import Flatpickr from "react-flatpickr";
  import "flatpickr/dist/flatpickr.css";
  import Sidebar from "../../Sidebar.jsx";
  import Hamburger from "../../Hamburger.jsx";
  import { ToastContainer, toast } from "react-toastify";
  import "react-toastify/dist/ReactToastify.css";
  import { useSidebar } from "../../SidebarContext.jsx";
import AdminGearIcon from "./AdminGearIcon";
  import { Title, Meta } from "react-head";
  import { supabase } from "../../../lib/supabaseClient.js";
  import styles from "../styles/PersonnelRegister.module.css";
  import BFPPreloader from "../../BFPPreloader.jsx";
import {
  checkPersonnelStatus,
  filterActivePersonnel,
  filterInactivePersonnel,
  getPersonnelStatusSummary,
  markPersonnelAsRetired,
  markPersonnelAsResigned,
  reactivatePersonnel,
} from "./Utility/personnelStatusUtils.js";
  const PersonnelRegister = () => {
    const { isSidebarCollapsed } = useSidebar();
    const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
    const [personnel, setPersonnel] = useState([]);
    const [filteredPersonnel, setFilteredPersonnel] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showRankModal, setShowRankModal] = useState(false);
    const [showEditRankModal, setShowEditRankModal] = useState(false);
    const [editingPerson, setEditingPerson] = useState(null);
    const [selectedRank, setSelectedRank] = useState("");
    const [selectedRankImage, setSelectedRankImage] = useState("");
    const [editSelectedRank, setEditSelectedRank] = useState("");
    const [editSelectedRankImage, setEditSelectedRankImage] = useState("");
    const [photoPreview, setPhotoPreview] = useState(null);
    const [editPhotoPreview, setEditPhotoPreview] = useState(null);
    const [fileChosen, setFileChosen] = useState("No Photo selected");
    const [EditFileChosen, setEditFileChosen] = useState(
      "No new Photo selected"
    );
    const [allPersonnel, setAllPersonnel] = useState([]); // Store all personnel including inactive
    const [emergencyMaxReached, setEmergencyMaxReached] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const formRef = useRef(null);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showSetLeaveCreditsModal, setShowSetLeaveCreditsModal] =
      useState(false);
    const [showEditLeaveModal, setShowEditLeaveModal] = useState(false);
    const [editingLeavePersonnel, setEditingLeavePersonnel] = useState(null);

    // ========== FILTER STATES (ADDED) ==========
    const [search, setSearch] = useState("");
    const [filterRank, setFilterRank] = useState("");
    const [filterStation, setFilterStation] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState("active"); // NEW: "active", "inactive", "all"
    const [statusModalPersonnel, setStatusModalPersonnel] = useState(null);
    const [statusAction, setStatusAction] = useState(""); // "retire", "resign", "reactivate"
    const [statusData, setStatusData] = useState({
      date: new Date().toISOString().split("T")[0],
      reason: "",
    });
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [lockedPersonnel, setLockedPersonnel] = useState({}); // { personnelId: { isLocked: boolean, lockReason: string } }
    const [loadingLocks, setLoadingLocks] = useState(false);
    const photoInputRef = useRef(null);
    const editPhotoInputRef = useRef(null);
    const rankImageInputRef = useRef(null);
    const [deleteName, setDeleteName] = useState("");
    const [generatedUsername, setGeneratedUsername] = useState("");
    const [generatedPassword, setGeneratedPassword] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 5;
    const [isRegistering, setIsRegistering] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // ========== LEAVE CREDITS STATES ==========
    const [leaveCredits, setLeaveCredits] = useState({
      sick_balance: 0,
      emergency_balance: 0,
      vacation_balance: 0,
      year: new Date().getFullYear(),
    });

    const rankOptions = [
      {
        rank: "FO1",
        name: "Fire Officer 1",
        image: `${
          import.meta.env.VITE_SUPABASE_URL
        }/storage/v1/object/public/rank_images/FO1.png`,
      },
      {
        rank: "FO2",
        name: "Fire Officer 2",
        image: `${
          import.meta.env.VITE_SUPABASE_URL
        }/storage/v1/object/public/rank_images/FO2.png`,
      },
      {
        rank: "FO3",
        name: "Fire Officer 3",
        image: `${
          import.meta.env.VITE_SUPABASE_URL
        }/storage/v1/object/public/rank_images/FO3.png`,
      },
      {
        rank: "SFO1",
        name: "Senior Fire Officer 1",
        image: `${
          import.meta.env.VITE_SUPABASE_URL
        }/storage/v1/object/public/rank_images/SFO1.png`,
      },
      {
        rank: "SFO2",
        name: "Senior Fire Officer 2",
        image: `${
          import.meta.env.VITE_SUPABASE_URL
        }/storage/v1/object/public/rank_images/SFO2.png`,
      },
      {
        rank: "SFO3",
        name: "Senior Fire Officer 3",
        image: `${
          import.meta.env.VITE_SUPABASE_URL
        }/storage/v1/object/public/rank_images/SFO3.png`,
      },
      {
        rank: "SFO4",
        name: "Senior Fire Officer 4",
        image: `${
          import.meta.env.VITE_SUPABASE_URL
        }/storage/v1/object/public/rank_images/SFO4.png`,
      },
    ];
    useEffect(() => {
      // Reload lock status whenever personnel data changes
      if (personnel.length > 0) {
        console.log("🔄 Refreshing lock status after data change...");
        loadAllPersonnelLockStatus();
      }
    }, [personnel]);
    useEffect(() => {
      console.log("Locked personnel state:", lockedPersonnel);
      console.log("Total personnel:", personnel.length);
      console.log(
        "Locked count:",
        Object.values(lockedPersonnel).filter((l) => l.isLocked).length
      );
    }, [lockedPersonnel, personnel]);
    // Suffix options - ADDED
    const suffixOptions = ["", "Jr.", "Sr.", "II", "III", "IV", "V"];

    // Form state - ADDED suffix field
  const [formData, setFormData] = useState({
    badge_number: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    designation: "",
    station: "",
    birth_date: "",
    date_hired: "",
    hired_time: "",
    vacation_balance: 0,
    sick_balance: 0,
    emergency_balance: 0,
  });

    const parseDateTimeString = (datetimeStr) => {
      if (!datetimeStr) return null;

      // Try different formats
      const formats = [
        // ISO format: "2024-01-15T13:56:00"
        (str) => new Date(str),
        // Flatpickr format: "2024-01-15 13:56"
        (str) => {
          const match = str.match(
            /^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2})$/
          );
          if (match) {
            const [_, year, month, day, hour, minute] = match;
            return new Date(year, month - 1, day, hour, minute);
          }
          return null;
        },
        // Just date format: "2024-01-15"
        (str) => {
          const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (match) {
            const [_, year, month, day] = match;
            return new Date(year, month - 1, day, 8, 0);
          }
          return null;
        },
      ];

      for (const format of formats) {
        try {
          const result = format(datetimeStr);
          if (result && !isNaN(result.getTime())) {
            console.log(`Parsed "${datetimeStr}" as ${result}`);
            return result;
          }
        } catch (e) {
          // Try next format
        }
      }

      console.error(`Could not parse datetime: ${datetimeStr}`);
      return null;
    };
    // Add this helper function to format dates for database
    const formatDateForDatabase = (dateString) => {
      if (!dateString) return null;

      try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
      } catch (error) {
        console.error("Error formatting date for database:", error);
        return null;
      }
    };

  const applyFilters = (items) => {
    if (!items || !Array.isArray(items)) {
      return [];
    }

    let filtered = [...items];

    // First filter by status
    if (filterStatus === "active") {
      filtered = filterActivePersonnel(filtered);
    } else if (filterStatus === "inactive") {
      filtered = filterInactivePersonnel(filtered);
    }
    // "all" shows everyone

    // Search filter
    const searchTerm = search.trim().toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter((person) => {
        if (!person) return false;

        const searchText = `
          ${person.first_name || ""} 
          ${person.middle_name || ""} 
          ${person.last_name || ""}
          ${person.rank || ""}
          ${person.station || ""}
          ${person.badge_number || ""}
          ${person.status || ""}
        `.toLowerCase();

        return searchText.includes(searchTerm);
      });
    }

    // Rank filter
    if (filterRank) {
      filtered = filtered.filter(
        (person) => person && person.rank === filterRank
      );
    }

    // Station filter
    if (filterStation) {
      filtered = filtered.filter(
        (person) =>
          person &&
          person.station &&
          person.station.toLowerCase().includes(filterStation.toLowerCase())
      );
    }

    return filtered;
  };

  const clearFilters = () => {
    setSearch("");
    setFilterRank("");
    setFilterStation("");
    setFilterStatus("active"); // Reset to active only
    setCurrentPage(1);
  };


    const getUniqueStations = () => {
      const stations = new Set();

      if (!allPersonnel || !Array.isArray(allPersonnel)) {
        return [];
      }

      allPersonnel.forEach((person) => {
        if (person && person.station) {
          stations.add(person.station);
        }
      });

      return Array.from(stations).sort();
    };

    const getPersonnelStatusBadge = (person) => {
      const status = checkPersonnelStatus(person);

      if (status.shouldDisplay) {
        return (
          <span className={styles.statusBadgeActive}>
            <FaUserCheck /> Active
          </span>
        );
      }

      let badgeClass = styles.statusBadgeInactive;
      let icon = <FaUserSlash />;
      let text = status.status;

      if (status.status === "Retired") {
        badgeClass = styles.statusBadgeRetired;
        icon = <FaArchive />;
      } else if (
        status.status === "Resigned" ||
        status.status === "Separated"
      ) {
        badgeClass = styles.statusBadgeResigned;
        icon = <FaUserSlash />;
      }

      return (
        <span className={badgeClass} title={status.reason}>
          {icon} {text}
        </span>
      );
    };

    // ===
    // Add this component before your main component return statement
    const HighlightMatch = ({ text, searchTerm }) => {
      if (!searchTerm || !text) return text || "-";

      const lowerText = text.toLowerCase();
      const lowerSearchTerm = searchTerm.toLowerCase();
      const index = lowerText.indexOf(lowerSearchTerm);

      if (index === -1) return text;

      const before = text.substring(0, index);
      const match = text.substring(index, index + searchTerm.length);
      const after = text.substring(index + searchTerm.length);

      return (
        <>
          {before}
          <span
            style={{
              backgroundColor: "#FFEB3B",
              padding: "0 2px",
              borderRadius: "2px",
            }}
          >
            {match}
          </span>
          {after}
        </>
      );
    };
    // Add this helper function

    const formatDateTimeDisplay = (datetimeStr) => {
      if (!datetimeStr) return "Not set";

      try {
        // Handle both ISO strings and Date objects
        const date =
          datetimeStr instanceof Date ? datetimeStr : new Date(datetimeStr);

        if (isNaN(date.getTime())) {
          return "Invalid date";
        }

        return date.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      } catch (error) {
        console.error("Error formatting datetime:", error);
        return "Error";
      }
    };
    // Format date for display
    // Format date for display
    const formatDate = (dateString) => {
      if (!dateString) return "-";
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "-";

        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch (error) {
        console.error("Error formatting date:", error);
        return "-";
      }
    };

    // Format date for input
    const formatDateForInput = (dateString) => {
      if (!dateString) return "";
      try {
        const date = new Date(dateString);
        return date.toISOString().split("T")[0];
      } catch (error) {
        console.error("Error formatting date for input:", error);
        return "";
      }
    };
    // Edit form state - ADDED suffix field
  const [editFormData, setEditFormData] = useState({
    badge_number: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    designation: "",
    station: "",
    birth_date: "",
    date_hired: "",
    hired_time: "",
    vacation_balance: 0,
    sick_balance: 0,
    emergency_balance: 0,
  });
  const [statusSummary, setStatusSummary] = useState({
    active: 0,
    inactive: 0,
    retired: 0,
    resigned: 0,
    total: 0,
  });
 const openStatusModal = (personnel, action) => {
   setStatusModalPersonnel(personnel);
   setStatusAction(action);
   setStatusData({
     date: new Date().toISOString().split("T")[0],
     reason: "",
   });
   setShowStatusModal(true);
 };

 const closeStatusModal = () => {
   setShowStatusModal(false);
   setStatusModalPersonnel(null);
   setStatusAction("");
   setStatusData({
     date: new Date().toISOString().split("T")[0],
     reason: "",
   });
   setIsUpdatingStatus(false);
 };

 const handleUpdateStatus = async () => {
   if (!statusModalPersonnel || !statusAction) return;

   try {
     setIsUpdatingStatus(true);

     let result;
     const personName = `${statusModalPersonnel.first_name} ${statusModalPersonnel.last_name}`;

     switch (statusAction) {
       case "retire":
         result = await markPersonnelAsRetired(
           statusModalPersonnel.id,
           statusData.date,
           statusData.reason
         );
         break;
       case "resign":
         result = await markPersonnelAsResigned(
           statusModalPersonnel.id,
           statusData.date,
           statusData.reason
         );
         break;
       case "reactivate":
         result = await reactivatePersonnel(statusModalPersonnel.id);
         break;
       default:
         throw new Error("Invalid action");
     }

     if (result.success) {
       toast.success(
         `${personName} ${
           statusAction === "reactivate" ? "reactivated" : statusAction + "d"
         } successfully`
       );

       // Refresh personnel data
       await loadPersonnel();
       closeStatusModal();
     } else {
       toast.error(result.message || "Failed to update status");
     }
   } catch (error) {
     console.error("Error updating personnel status:", error);
     toast.error(`Failed to update status: ${error.message}`);
   } finally {
     setIsUpdatingStatus(false);
   }
 };
    const loadAllPersonnelLockStatus = async () => {
      try {
        console.log("🔐 ULTIMATE LOCK CHECK STARTING");

        // Get current personnel data directly from state
        const currentPersonnel = personnel; // Use the state directly

        if (
          !currentPersonnel ||
          !Array.isArray(currentPersonnel) ||
          currentPersonnel.length === 0
        ) {
          console.log("No personnel data available yet - waiting...");
          setLockedPersonnel({});
          return;
        }

        const personnelIds = currentPersonnel.map((p) => p.id);
        console.log("Checking IDs for lock status:", personnelIds);

        if (personnelIds.length === 0) {
          console.log("No personnel IDs to check");
          setLockedPersonnel({});
          return;
        }

        // METHOD A: Direct clearance check (most reliable)
        console.log("🔄 Method A: Checking clearances directly...");
        const { data: directClearances, error: directError } = await supabase
          .from("clearance_requests")
          .select("personnel_id, type, status")
          .in("personnel_id", personnelIds)
          .in("type", ["Resignation", "Retirement", "Equipment Completion"])
          .in("status", ["Pending", "In Progress", "Pending for Approval"]);

        if (directError) {
          console.error("Error checking direct clearances:", directError);
        }

        console.log("Direct clearance results:", directClearances);

        // METHOD B: View check
        console.log("🔄 Method B: Checking view...");
        const { data: viewData, error: viewError } = await supabase
          .from("personnel_restrictions")
          .select("*")
          .in("personnel_id", personnelIds);

        if (viewError) {
          console.error("Error checking view data:", viewError);
        }

        console.log("View data results:", viewData);

        // Build lock map from BOTH methods
        const lockStatusMap = {};

        // Initialize all personnel as not locked first
        currentPersonnel.forEach((person) => {
          lockStatusMap[person.id] = {
            isLocked: false,
            lockReason: "",
            source: "none",
          };
        });

        // 1. Add from direct clearances
        if (directClearances && directClearances.length > 0) {
          directClearances.forEach((clearance) => {
            console.log(
              `🔒 Found clearance for ${clearance.personnel_id}: ${clearance.type} (${clearance.status})`
            );
            lockStatusMap[clearance.personnel_id] = {
              isLocked: true,
              lockReason: `${clearance.type} clearance (${clearance.status})`,
              source: "direct",
            };
          });
        }

        // 2. Add from view (if not already added)
        if (viewData && viewData.length > 0) {
          viewData.forEach((person) => {
            // Check if this personnel is in our current list
            if (!lockStatusMap[person.personnel_id]) {
              lockStatusMap[person.personnel_id] = {
                isLocked: false,
                lockReason: "",
                source: "none",
              };
            }

            // Check ALL lock conditions
            const shouldLock =
              person.active_clearance === true ||
              person.inspection_in_progress === true ||
              person.pending_accountability === true;

            if (shouldLock && !lockStatusMap[person.personnel_id].isLocked) {
              console.log(`🔒 View indicates lock for ${person.personnel_id}`);

              let reason = "";
              if (person.active_clearance) reason = "Active clearance request";
              if (person.inspection_in_progress)
                reason = "Inspection in progress";
              if (person.pending_accountability)
                reason = `Pending accountability (₱${
                  person.pending_amount || 0
                })`;

              lockStatusMap[person.personnel_id] = {
                isLocked: true,
                lockReason: reason,
                source: "view",
              };
            }
          });
        }

        console.log("✅ FINAL LOCK MAP:", lockStatusMap);

        // Log each personnel's status
        currentPersonnel.forEach((p) => {
          const lock = lockStatusMap[p.id];
          console.log(
            lock?.isLocked
              ? `   🔐 ${p.first_name} ${p.last_name}: ${lock.lockReason}`
              : `   ✅ ${p.first_name} ${p.last_name}: Not locked`
          );
        });

        setLockedPersonnel(lockStatusMap);
      } catch (error) {
        console.error("❌ Lock check error:", error);
      }
    };
    const loadPersonnel = async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoading(true);
        }
        setError("");

        // Load ALL personnel including inactive
        const { data, error } = await supabase
          .from("personnel")
          .select(
            `
          id,
          badge_number,
          first_name,
          middle_name,
          last_name,
          suffix,
          username,
          password,
          designation,
          station,
          rank,
          rank_image,
          birth_date,
          date_hired,
          hired_time,       
          hired_at_display,  
          photo_path,
          created_at,
          updated_at,
          is_active,
          status,
          retirement_date,
          separation_type,
          separation_date,
          separation_reason
        `
          )
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Database error:", error);
          throw error;
        }

        const personnelData = Array.isArray(data) ? data : [];
        console.log(
          `📊 Loaded ${personnelData.length} total personnel records`
        );

        // Store all personnel
        setAllPersonnel(personnelData);

        // Apply current filter status
        let filteredData;
        if (filterStatus === "active") {
          filteredData = filterActivePersonnel(personnelData);
        } else if (filterStatus === "inactive") {
          filteredData = filterInactivePersonnel(personnelData);
        } else {
          filteredData = personnelData;
        }

        setPersonnel(filteredData);

        // Update status summary
        const summary = getPersonnelStatusSummary(personnelData);
        setStatusSummary(summary);
        console.log("📊 Personnel Status Summary:", summary);

        // Apply other filters
        const finalFiltered = applyFilters(filteredData);
        setFilteredPersonnel(finalFiltered);

        // Load lock status for active personnel
        if (filteredData.length > 0) {
          loadAllPersonnelLockStatus();
        }
      } catch (error) {
        console.error("Error loading personnel:", error);
        setError("Failed to load personnel data");
        toast.error("Failed to load personnel data");
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    };
    useEffect(() => {
      loadPersonnel();
    }, []);
    useEffect(() => {
      if (allPersonnel.length > 0) {
        let filteredData;
        if (filterStatus === "active") {
          filteredData = filterActivePersonnel(allPersonnel);
        } else if (filterStatus === "inactive") {
          filteredData = filterInactivePersonnel(allPersonnel);
        } else {
          filteredData = allPersonnel;
        }

        setPersonnel(filteredData);
        const finalFiltered = applyFilters(filteredData);
        setFilteredPersonnel(finalFiltered);
        setCurrentPage(1);
      }
    }, [filterStatus, allPersonnel]);

    // Apply other filters when they change
    useEffect(() => {
      if (personnel.length > 0) {
        const filtered = applyFilters(personnel);
        setFilteredPersonnel(filtered);
        setCurrentPage(1);
      }
    }, [search, filterRank, filterStation, personnel]);

    // ========== UPDATED HELPER FUNCTIONS ==========

    useEffect(() => {
      // Subscribe to clearance_requests changes
      const clearanceSubscription = supabase
        .channel("clearance-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "clearance_requests",
          },
          () => {
            console.log("Clearance request changed - refreshing locks");
            loadAllPersonnelLockStatus();
          }
        )
        .subscribe();

      // Subscribe to inspections changes
      const inspectionSubscription = supabase
        .channel("inspection-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "inspections",
          },
          () => {
            console.log("Inspection changed - refreshing locks");
            loadAllPersonnelLockStatus();
          }
        )
        .subscribe();

      return () => {
        clearanceSubscription.unsubscribe();
        inspectionSubscription.unsubscribe();
      };
    }, []);
    // ========== APPLY FILTERS WHEN FILTERS CHANGE ==========
    useEffect(() => {
      if (personnel.length > 0) {
        const filtered = applyFilters(personnel);
        setFilteredPersonnel(filtered);
        setCurrentPage(1); // Reset to first page when filters change
      }
    }, [search, filterRank, filterStation, personnel]);

    // ==================== LOCK STATUS ICON COMPONENT ====================
    // Add this function
    const debugLockSystem = async () => {
      console.log("=== DEBUGGING LOCK SYSTEM ===");

      // Check specific personnel
      const testPersonnelId = "154a27b1-ea03-4e61-9b85-77c203ad097c";

      // Check clearance requests directly
      const { data: clearances, error } = await supabase
        .from("clearance_requests")
        .select("id, status, type, personnel_id")
        .eq("personnel_id", testPersonnelId);

      console.log("Clearance requests:", clearances);

      // Check view data
      const { data: viewData } = await supabase
        .from("personnel_restrictions")
        .select("*")
        .eq("personnel_id", testPersonnelId);

      console.log("View data:", viewData);

      // Reload lock status
      await loadAllPersonnelLockStatus();
    };

    // Add this button somewhere in your UI
    const LockStatusIcon = ({ personnelId }) => {
      const lockStatus = lockedPersonnel[personnelId];

      console.log(`🎯 LockStatusIcon for ${personnelId}:`, lockStatus);

      if (!lockStatus || !lockStatus.isLocked) {
        console.log(`✅ No lock for ${personnelId}`);
        return null;
      }

      return (
        <div
          className={styles.lockIconContainer}
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginRight: "8px",
            padding: "2px 6px",
            background: "#ffebee",
            borderRadius: "4px",
            border: "1px solid #f44336",
          }}
        >
          <span
            style={{ color: "#f44336", fontSize: "14px", marginRight: "4px" }}
          >
            🔒
          </span>
          <span
            style={{ fontSize: "11px", color: "#d32f2f", fontWeight: "bold" }}
          >
            LOCKED
          </span>
          {lockStatus.lockReason && (
            <span
              style={{
                fontSize: "10px",
                color: "#666",
                marginLeft: "4px",
                fontStyle: "italic",
              }}
              title={lockStatus.lockReason}
            >
              (
              {lockStatus.lockReason.length > 20
                ? lockStatus.lockReason.substring(0, 20) + "..."
                : lockStatus.lockReason}
              )
            </span>
          )}
        </div>
      );
    };
    // Function to open leave credits modal
    const openSetLeaveCreditsModal = (personnel) => {
      setEditingLeavePersonnel(personnel);

      // Load existing leave credits if any
      loadPersonnelLeaveCredits(personnel.id).then((credits) => {
        if (credits) {
          setLeaveCredits({
            vacation_balance: credits.vacation_balance || 0,
            sick_balance: credits.sick_balance || 0,
            emergency_balance: credits.emergency_balance || 0,
            year: credits.year || new Date().getFullYear(),
          });
        } else {
          setLeaveCredits({
            vacation_balance: 0,
            sick_balance: 0,
            emergency_balance: 0,
            year: new Date().getFullYear(),
          });
        }
      });

      setShowSetLeaveCreditsModal(true);
    };
    const saveLeaveCreditsDirectly = async () => {
      try {
        if (!editingLeavePersonnel) {
          toast.error("No personnel selected");
          return;
        }

        // Validate inputs
        const vacation = parseFloat(leaveCredits.vacation_balance) || 0;
        const sick = parseFloat(leaveCredits.sick_balance) || 0;
        const emergency = parseFloat(leaveCredits.emergency_balance) || 0;
        const year = leaveCredits.year || new Date().getFullYear();

        // Prepare leave data - NO calculations, just store what's provided
        const leaveData = {
          personnel_id: editingLeavePersonnel.id,
          year: year,
          vacation_balance: vacation,
          sick_balance: sick,
          emergency_balance: emergency,
          // Store initial credits as what was provided
          initial_vacation_credits: vacation,
          initial_sick_credits: sick,
          initial_emergency_credits: emergency,
          // Set used fields to 0 (can be updated later when leaves are taken)
          vacation_used: 0,
          sick_used: 0,
          emergency_used: 0,
        };

        console.log("Saving leave credits directly:", leaveData);

        // Use upsert to create or update
        const { data, error } = await supabase
          .from("leave_balances")
          .upsert([leaveData], {
            onConflict: "personnel_id,year",
            onConflictUpdateColumns: [
              "vacation_balance",
              "sick_balance",
              "emergency_balance",
              "initial_vacation_credits",
              "initial_sick_credits",
              "initial_emergency_credits",
            ],
          })
          .select();

        if (error) {
          console.error("Error saving leave credits:", error);
          toast.error(`Failed to save leave credits: ${error.message}`);
          return;
        }

        toast.success(
          `Leave credits saved for ${editingLeavePersonnel.first_name} ${editingLeavePersonnel.last_name}!`,
          { autoClose: 3000 }
        );

        // Close modal
        setShowSetLeaveCreditsModal(false);
        setEditingLeavePersonnel(null);
        setLeaveCredits({
          vacation_balance: 0,
          sick_balance: 0,
          emergency_balance: 0,
          year: new Date().getFullYear(),
        });
      } catch (error) {
        console.error("Error in saveLeaveCreditsDirectly:", error);
        toast.error("Failed to save leave credits");
      }
    };
    // ==================== OTHER FUNCTIONS ====================
    // Add this debug function to check what's blocking updates
    const debugPersonnelRestrictions = async (personnelId) => {
      try {
        console.log("=== DEBUGGING PERSONNEL RESTRICTIONS ===");

        // 1. Check clearance_requests
        const { data: clearances } = await supabase
          .from("clearance_requests")
          .select("*")
          .eq("personnel_id", personnelId);
        console.log("Clearances:", clearances);

        // 2. Check personnel_restrictions view
        const { data: restrictions } = await supabase
          .from("personnel_restrictions")
          .select("*")
          .eq("personnel_id", personnelId)
          .single();
        console.log("Restrictions view:", restrictions);

        // 3. Check inspections
        const { data: inspections } = await supabase
          .from("inspections")
          .select("*")
          .eq("personnel_id", personnelId);
        console.log("Inspections:", inspections);

        // 4. Check for any accountability issues
        const { data: accountability } = await supabase
          .from("accountability")
          .select("*")
          .eq("personnel_id", personnelId)
          .eq("status", "Pending");
        console.log("Pending accountability:", accountability);

        return {
          clearances,
          restrictions,
          inspections,
          accountability,
        };
      } catch (error) {
        console.error("Debug error:", error);
      }
    };

    // Call this in your edit modal open function or when you need to debug
    // debugPersonnelRestrictions(editingPerson.id);
    const validateAndProcessImage = (file) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
          img.onload = () => {
            console.log("✅ Image validated:", {
              width: img.width,
              height: img.height,
              size: (file.size / 1024).toFixed(2) + "KB",
            });

            // Convert to blob to ensure clean binary
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("Failed to process image"));
                  return;
                }

                // Create a clean file with correct MIME type
                const cleanFile = new File(
                  [blob],
                  file.name.replace(/\.[^/.]+$/, "") + ".jpg",
                  {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  }
                );

                console.log("🔄 Converted to clean file:", {
                  originalType: file.type,
                  newType: cleanFile.type,
                  size: (cleanFile.size / 1024).toFixed(2) + "KB",
                });

                resolve(cleanFile);
              },
              "image/jpeg",
              0.9
            );
          };

          img.onerror = () => {
            reject(new Error("Invalid image file - cannot be loaded"));
          };

          img.src = e.target.result;
        };

        reader.onerror = () => {
          reject(new Error("Failed to read file"));
        };

        reader.readAsDataURL(file);
      });
    };

    const handlePhotoChange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          // Check file size
          if (file.size > 5 * 1024 * 1024) {
            toast.warning(
              "Image is too large. Please select an image under 5MB."
            );
            return;
          }

          // Create preview URL using createObjectURL
          const previewUrl = URL.createObjectURL(file);
          setPhotoPreview(previewUrl);

          // Store file for upload
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          photoInputRef.current.files = dataTransfer.files;

          setFileChosen(file.name);
        } catch (error) {
          console.error("❌ Image processing error:", error);
          toast.error("Invalid image file");
          clearPhoto();
        }
      } else {
        setFileChosen("No Photo selected");
      }
    };
    const uploadImage = async (file, personnelData) => {
      try {
        console.log("📤 Uploading photo to personnel-documents bucket...", {
          name: file.name,
          type: file.type,
          size: (file.size / 1024).toFixed(2) + "KB",
          personnel: `${personnelData.first_name} ${personnelData.last_name}`,
        });

        // Validate personnel data
        if (!personnelData || !personnelData.id) {
          console.error("❌ No personnel data provided for photo upload");
          toast.error("Cannot upload photo: Personnel information is missing");
          return null;
        }

        // Create safe folder name using personnel name and rank
        const safeFirstName = personnelData.first_name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
        const safeLastName = personnelData.last_name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
        const safeRank = (personnelData.rank || "unknown")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");

        // Folder name format: {lastname}_{firstname}_{rank}
        const folderName = `${safeLastName}_${safeFirstName}_${safeRank}`;

        const fileExt = file.name.split(".").pop().toLowerCase();
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileName = `profile_${timestamp}_${randomStr}.${fileExt}`;
        const filePath = `personnel-images/${folderName}/${fileName}`;

        console.log("📁 Uploading to:", filePath);
        console.log("👤 For:", {
          name: `${personnelData.first_name} ${personnelData.last_name}`,
          rank: personnelData.rank,
          folder: folderName,
        });

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from("personnel-documents")
          .upload(filePath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });

        if (error) {
          console.error("❌ Upload error:", error.message);

          // If file exists, try with another random string
          if (error.message.includes("already exists")) {
            const newRandomStr = Math.random().toString(36).substring(2, 10);
            const newFileName = `profile_${timestamp}_${newRandomStr}.${fileExt}`;
            const newFilePath = `personnel-images/${folderName}/${newFileName}`;

            console.log("🔄 Retrying with new filename:", newFilePath);

            const { data: retryData, error: retryError } =
              await supabase.storage
                .from("personnel-documents")
                .upload(newFilePath, file, {
                  cacheControl: "3600",
                  contentType: file.type,
                });

            if (retryError) {
              toast.error(`Upload failed: ${retryError.message}`);
              return null;
            }

            console.log(
              "✅ Upload successful (with unique name):",
              retryData.path
            );

            // Get public URL
            const { data: urlData } = supabase.storage
              .from("personnel-documents")
              .getPublicUrl(retryData.path);

            return {
              url: urlData.publicUrl,
              path: retryData.path,
              fileName: newFileName,
              folderName: folderName,
            };
          }

          toast.error(`Upload failed: ${error.message}`);
          return null;
        }

        console.log("✅ Upload successful:", data.path);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("personnel-documents")
          .getPublicUrl(data.path);

        return {
          url: urlData.publicUrl,
          path: data.path,
          fileName: fileName,
          folderName: folderName,
        };
      } catch (error) {
        console.error("❌ Unexpected error:", error);
        toast.error("Photo upload failed");
        return null;
      }
    };
    // Pagination
    const paginate = (data, page, rows) => {
      const start = (page - 1) * rows;
      return data.slice(start, start + rows);
    };

    const renderPaginationButtons = () => {
      const pageCount = Math.max(
        1,
        Math.ceil(filteredPersonnel.length / rowsPerPage)
      );
      const hasNoData = filteredPersonnel.length === 0;

      const buttons = [];

      // Previous button
      buttons.push(
        <button
          key="prev"
          className={`${styles.paginationBtn} ${
            hasNoData ? styles.disabled : ""
          }`}
          disabled={currentPage === 1 || hasNoData}
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
        >
          Previous
        </button>
      );

      // Always show first page
      buttons.push(
        <button
          key={1}
          className={`${styles.paginationBtn} ${
            1 === currentPage ? styles.active : ""
          } ${hasNoData ? styles.disabled : ""}`}
          onClick={() => setCurrentPage(1)}
          disabled={hasNoData}
        >
          1
        </button>
      );

      // Show ellipsis after first page if needed
      if (currentPage > 3) {
        buttons.push(
          <span key="ellipsis1" className={styles.paginationEllipsis}>
            ...
          </span>
        );
      }

      // Show pages around current page
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(pageCount - 1, currentPage + 1);

      if (currentPage <= 3) {
        endPage = Math.min(pageCount - 1, 4);
      }

      if (currentPage >= pageCount - 2) {
        startPage = Math.max(2, pageCount - 3);
      }

      // Generate middle page buttons
      for (let i = startPage; i <= endPage; i++) {
        if (i > 1 && i < pageCount) {
          buttons.push(
            <button
              key={i}
              className={`${styles.paginationBtn} ${
                i === currentPage ? styles.active : ""
              } ${hasNoData ? styles.disabled : ""}`}
              onClick={() => setCurrentPage(i)}
              disabled={hasNoData}
            >
              {i}
            </button>
          );
        }
      }

      // Show ellipsis before last page if needed
      if (currentPage < pageCount - 2) {
        buttons.push(
          <span key="ellipsis2" className={styles.paginationEllipsis}>
            ...
          </span>
        );
      }

      // Always show last page if there is more than 1 page
      if (pageCount > 1) {
        buttons.push(
          <button
            key={pageCount}
            className={`${styles.paginationBtn} ${
              pageCount === currentPage ? styles.active : ""
            } ${hasNoData ? styles.disabled : ""}`}
            onClick={() => setCurrentPage(pageCount)}
            disabled={hasNoData}
          >
            {pageCount}
          </button>
        );
      }

      // Next button
      buttons.push(
        <button
          key="next"
          className={`${styles.paginationBtn} ${
            hasNoData ? styles.disabled : ""
          }`}
          disabled={currentPage === pageCount || hasNoData}
          onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
        >
          Next
        </button>
      );

      return (
        <div
          className={`${styles.paginationContainer} ${styles.topPagination}`}
        >
          {buttons}
        </div>
      );
    };

    const generatePassword = (length = 8) => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$";
      return Array.from(
        { length },
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join("");
    };

    // UPDATED generateUsername function to include suffix
    const generateUsername = (first, middle, last, suffix) => {
      const baseUsername = `${first}${middle ? middle[0] : ""}${last}${
        suffix ? suffix[0] : ""
      }`
        .toLowerCase()
        .replaceAll(/\s+/g, "");
      return `${baseUsername}${Date.now().toString().slice(-4)}`;
    };

    // UPDATED useEffect for username generation
    useEffect(() => {
      if (formData.first_name || formData.last_name) {
        const username = generateUsername(
          formData.first_name,
          formData.middle_name,
          formData.last_name,
          formData.suffix
        );
        setGeneratedUsername(username);
      } else {
        setGeneratedUsername("");
      }
    }, [
      formData.first_name,
      formData.middle_name,
      formData.last_name,
      formData.suffix,
    ]);

    // Generate password
    useEffect(() => {
      if (showForm) {
        setGeneratedPassword(generatePassword());
      }
    }, [showForm]);
    const cleanupBase64FromDatabase = async (personnelId) => {
      try {
        // Check if this personnel has Base64 in their photo_url
        const { data: person, error } = await supabase
          .from("personnel")
          .select("photo_url")
          .eq("id", personnelId)
          .single();

        if (error || !person) return;

        if (
          person.photo_url &&
          (person.photo_url.includes("base64") ||
            person.photo_url.startsWith("data:image/"))
        ) {
          console.log(`🧹 Cleaning Base64 from database for ${personnelId}`);

          // Set photo_url to null since it's Base64
          const { error: updateError } = await supabase
            .from("personnel")
            .update({
              photo_url: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", personnelId);

          if (updateError) {
            console.error("Error cleaning Base64:", updateError);
          }
        }
      } catch (error) {
        console.error("Error in cleanupBase64FromDatabase:", error);
      }
    };
    const handleEditPhotoChange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          // Check file size
          if (file.size > 2 * 1024 * 1024) {
            toast.warning(
              "Image is too large. Please select an image under 2MB."
            );
            return;
          }

          // Create a preview URL using createObjectURL instead of Base64
          const previewUrl = URL.createObjectURL(file);
          setEditPhotoPreview(previewUrl);
          setEditFileChosen(file.name);

          // Store original file
          if (editPhotoInputRef.current) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            editPhotoInputRef.current.files = dataTransfer.files;
          }

          console.log("✅ Photo selected:", {
            name: file.name,
            size: (file.size / 1024).toFixed(0) + "KB",
            type: file.type,
          });
        } catch (error) {
          console.error("Error processing photo:", error);
          toast.error("Failed to process photo");
          setEditPhotoPreview(null);
          setEditFileChosen("No new Photo selected");
        }
      } else {
        setEditPhotoPreview(null);
        setEditFileChosen("No new Photo selected");
      }
    };
    // Add this compression function:
    const compressImageToBase64 = (file, maxWidth = 800, quality = 0.7) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
          img.onload = () => {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }

            // Create canvas
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to Base64 with compression
            canvas.toBlob(
              (blob) => {
                const compressedReader = new FileReader();
                compressedReader.onload = () =>
                  resolve(compressedReader.result);
                compressedReader.onerror = reject;
                compressedReader.readAsDataURL(blob);
              },
              "image/jpeg",
              quality
            );
          };

          img.onerror = reject;
          img.src = e.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };
    const clearPhoto = () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
      setPhotoPreview(null);
      setFileChosen("No Photo selected");
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    };

    const loadPersonnelLeaveCredits = async (personnelId, year = null) => {
      try {
        let query = supabase
          .from("leave_balances")
          .select("*")
          .eq("personnel_id", personnelId);

        if (year) {
          query = query.eq("year", year);
        } else {
          // Get current year's balance by default
          query = query.eq("year", new Date().getFullYear());
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error loading leave credits:", error);

          // If no record found, return empty object
          if (error.code === "PGRST116") {
            // No rows returned
            return {
              vacation_balance: 0,
              sick_balance: 0,
              emergency_balance: 0,
            };
          }

          return null;
        }

        return (
          data?.[0] || {
            vacation_balance: 0,
            sick_balance: 0,
            emergency_balance: 0,
          }
        );
      } catch (error) {
        console.error("Error in loadPersonnelLeaveCredits:", error);
        return {
          vacation_balance: 0,
          sick_balance: 0,
          emergency_balance: 0,
        };
      }
    };
    const handleSubmit = async (e) => {
      e.preventDefault();

      // Create loading toast ID immediately
      const loadingToastId = toast.loading("Registering personnel...");

      try {
        setIsRegistering(true);
        setError("");

        // Use the generated username and password from state
        const username = generatedUsername;
        const password = generatedPassword;

        // Validation code...
        if (!formData.first_name?.trim() || !formData.last_name?.trim()) {
          toast.update(loadingToastId, {
            render: "First name and last name are required!",
            type: "error",
            isLoading: false,
            autoClose: 3000,
          });
          setIsRegistering(false);
          return;
        }

        if (!selectedRank) {
          toast.update(loadingToastId, {
            render: "Please select a rank!",
            type: "error",
            isLoading: false,
            autoClose: 3000,
          });
          setIsRegistering(false);
          return;
        }

        // Prepare time values
        let hiredTimeValue = null;
        let hiredAtDisplayValue = "8:00 AM";

        if (formData.hired_time) {
          const [hours, minutes] = formData.hired_time.split(":");
          const hourNum = parseInt(hours);

          hiredTimeValue = `${hours.padStart(2, "0")}:${minutes}:00`;

          const displayHour = hourNum % 12 || 12;
          const ampm = hourNum >= 12 ? "PM" : "AM";
          hiredAtDisplayValue = `${displayHour}:${minutes} ${ampm}`;
        }

        // Prepare personnel data
        const personnelDataToInsert = {
          badge_number: formData.badge_number || null,
          first_name: formData.first_name.trim(),
          middle_name: formData.middle_name?.trim() || null,
          last_name: formData.last_name.trim(),
          suffix: formData.suffix?.trim() || null,
          username,
          password,
          designation: formData.designation?.trim() || null,
          station: formData.station?.trim() || null,
          rank: selectedRank,
          rank_image: selectedRankImage,
          birth_date: formData.birth_date || null,
          date_hired: formData.date_hired || null,
          hired_time: hiredTimeValue,
          hired_at_display: hiredAtDisplayValue,
        };

        toast.update(loadingToastId, {
          render: "Creating personnel record...",
          type: "info",
          isLoading: true,
        });

        // First, create personnel record to get ID
        const { data: personnelData, error: insertError } = await supabase
          .from("personnel")
          .insert([personnelDataToInsert])
          .select()
          .single();

        if (insertError) {
          let errorMessage = insertError.message;
          if (insertError.message.includes("valid_dates")) {
            errorMessage =
              "Date validation failed. Please ensure birth date is before or equal to date hired.";
          }

          toast.update(loadingToastId, {
            render: `Failed to create personnel record: ${errorMessage}`,
            type: "error",
            isLoading: false,
            autoClose: 5000,
          });
          setIsRegistering(false);
          return;
        }

        // Save leave credits if any
        if (
          formData.vacation_balance > 0 ||
          formData.sick_balance > 0 ||
          formData.emergency_balance > 0
        ) {
          toast.update(loadingToastId, {
            render: "Saving leave credits...",
            type: "info",
            isLoading: true,
          });

          const leaveData = {
            personnel_id: personnelData.id,
            year: new Date().getFullYear(),
            vacation_balance: formData.vacation_balance || 0,
            sick_balance: formData.sick_balance || 0,
            emergency_balance: formData.emergency_balance || 0,
            initial_vacation_credits: formData.vacation_balance || 0,
            initial_sick_credits: formData.sick_balance || 0,
            initial_emergency_credits: formData.emergency_balance || 0,
            vacation_used: 0,
            sick_used: 0,
            emergency_used: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { error: leaveError } = await supabase
            .from("leave_balances")
            .upsert([leaveData], {
              onConflict: "personnel_id,year",
            });

          if (leaveError) {
            console.error("❌ Error saving leave credits:", leaveError);
            // Continue anyway - personnel was created
          }
        }

        // Handle photo upload if exists
        // Handle photo upload if exists
        if (photoInputRef.current?.files?.[0]) {
          toast.update(loadingToastId, {
            render: "Uploading photo...",
            type: "info",
            isLoading: true,
          });

          const file = photoInputRef.current.files[0];

          // Create personnel data object with name and rank
          const personnelDataForUpload = {
            id: personnelData.id, // ← FIX: Use personnelData.id (newly created)
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            rank: selectedRank,
          };

          const uploadResult = await uploadImage(file, personnelDataForUpload);

          if (uploadResult) {
            // Update personnel record with photo URL
            const { error: updateError } = await supabase
              .from("personnel")
              .update({
                photo_url: uploadResult.url,
                photo_path: uploadResult.path,
                updated_at: new Date().toISOString(),
              })
              .eq("id", personnelData.id);

            if (updateError) {
              console.error(
                "Error updating personnel with photo:",
                updateError
              );
              toast.warning("Personnel registered but photo update failed");
            } else {
              console.log("✅ Photo URL saved to database:", uploadResult.url);
              console.log("📁 Saved in folder:", uploadResult.folderName);
            }
          }
        }

        // Success!
        await loadPersonnel(false);
        resetForm();
        setShowForm(false);

        toast.update(loadingToastId, {
          render: `✅ ${formData.first_name} ${formData.last_name} registered successfully!`,
          type: "success",
          isLoading: false,
          autoClose: 4000,
        });
      } catch (error) {
        console.error("❌ Error in handleSubmit:", error);

        // Update the toast if it exists, otherwise create a new error toast
        if (loadingToastId) {
          toast.update(loadingToastId, {
            render: `An unexpected error occurred: ${error.message}`,
            type: "error",
            isLoading: false,
            autoClose: 5000,
          });
        } else {
          toast.error(`An unexpected error occurred: ${error.message}`);
        }
      } finally {
        setIsRegistering(false);
      }
    };
    const handleEditSubmit = async (e) => {
      e.preventDefault();
      try {
        setIsSavingEdit(true);
        setError("");

        // Validate required fields
        if (
          !editFormData.first_name?.trim() ||
          !editFormData.last_name?.trim()
        ) {
          toast.error("First name and last name are required!");
          setIsSavingEdit(false);
          return;
        }

        if (!editSelectedRank) {
          toast.error("Please select a rank!");
          setIsSavingEdit(false);
          return;
        }

        // Validate dates
        if (editFormData.birth_date && editFormData.date_hired) {
          const birthDate = new Date(editFormData.birth_date);
          const hiredDate = new Date(editFormData.date_hired);

          if (birthDate > hiredDate) {
            toast.error("Birth date cannot be after date hired!");
            setIsSavingEdit(false);
            return;
          }
        }
        let hiredTimeValue = null;
        let hiredAtDisplayValue = "8:00 AM";
        // Add this validation in handleEditSubmit before saving
        const emergencyBalance =
          parseFloat(editFormData.emergency_balance) || 0;
        if (emergencyBalance > 5) {
          toast.error("Emergency leave cannot exceed 5 days");
          setIsSavingEdit(false);
          return;
        }
        if (editFormData.hired_time) {
          const [hours, minutes] = editFormData.hired_time.split(":");
          const hourNum = parseInt(hours);

          // 24-hour format
          hiredTimeValue = `${hours.padStart(2, "0")}:${minutes}:00`;

          // AM/PM display format
          const displayHour = hourNum % 12 || 12;
          const ampm = hourNum >= 12 ? "PM" : "AM";
          hiredAtDisplayValue = `${displayHour}:${minutes} ${ampm}`;
        }
        // Prepare hired_at timestamp
        let hiredAtValue = null;

        if (editFormData.date_hired && editFormData.hired_time) {
          // Combine date and time into a timestamp
          hiredAtValue = `${editFormData.date_hired}T${editFormData.hired_time}:00`;
        } else if (editFormData.date_hired) {
          // If only date is provided, use default time (8:00 AM)
          hiredAtValue = `${editFormData.date_hired}T08:00:00`;
        }
        // Prepare update data
        const updateData = {
          badge_number: editFormData.badge_number || null,
          first_name: editFormData.first_name.trim(),
          middle_name: editFormData.middle_name?.trim() || null,
          last_name: editFormData.last_name.trim(),
          suffix: editFormData.suffix?.trim() || null,
          designation: editFormData.designation?.trim() || null,
          station: editFormData.station?.trim() || null,
          rank: editSelectedRank,
          rank_image: editSelectedRankImage,
          birth_date: editFormData.birth_date || null,
          date_hired: editFormData.date_hired || null,
          hired_time: hiredTimeValue, // 24-hour format
          hired_at_display: hiredAtDisplayValue, // AM/PM format
          updated_at: new Date().toISOString(),
        };

        console.log("Updating personnel:", updateData);

        // Update personnel record
        const { data, error: updateError } = await supabase
          .from("personnel")
          .update(updateData)
          .eq("id", editingPerson.id)
          .select();

        if (updateError) {
          console.error("Error updating personnel:", updateError);
          toast.error(`Failed to update: ${updateError.message}`);
          setIsSavingEdit(false);
          return;
        }

        // Handle photo update if a new photo was selected
        // Handle photo update if a new photo was selected
        if (editPhotoInputRef.current?.files?.[0]) {
          try {
            const file = editPhotoInputRef.current.files[0];

            // Create personnel data object with current info
            const personnelDataForUpload = {
              id: editingPerson.id,
              first_name: editFormData.first_name.trim(),
              last_name: editFormData.last_name.trim(),
              rank: editSelectedRank,
            };

            const uploadResult = await uploadImage(
              file,
              personnelDataForUpload
            );

            if (uploadResult) {
              await supabase
                .from("personnel")
                .update({
                  photo_url: uploadResult.url,
                  photo_path: uploadResult.path,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", editingPerson.id);
            }
          } catch (photoError) {
            console.error("Error uploading photo:", photoError);
            toast.warning("Personnel updated but photo upload failed");
          }
        } else if (isPhotoRemoved) {
          // Clear photo if removed
          await supabase
            .from("personnel")
            .update({
              photo_url: null,
              photo_path: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingPerson.id);
        }
        // Update leave credits if changed
        const currentYear = new Date().getFullYear();
        const existingCredits = await loadPersonnelLeaveCredits(
          editingPerson.id,
          currentYear
        );

        if (
          editFormData.vacation_balance !== existingCredits?.vacation_balance ||
          editFormData.sick_balance !== existingCredits?.sick_balance ||
          editFormData.emergency_balance !== existingCredits?.emergency_balance
        ) {
          const leaveData = {
            personnel_id: editingPerson.id,
            year: currentYear,
            vacation_balance: editFormData.vacation_balance || 0,
            sick_balance: editFormData.sick_balance || 0,
            emergency_balance: editFormData.emergency_balance || 0,
            updated_at: new Date().toISOString(),
          };

          await supabase.from("leave_balances").upsert([leaveData], {
            onConflict: "personnel_id,year",
            onConflictUpdateColumns: [
              "vacation_balance",
              "sick_balance",
              "emergency_balance",
              "updated_at",
            ],
          });
        }

        // Refresh data
        await loadPersonnel(false);

        toast.success(
          `${editFormData.first_name} ${editFormData.last_name} updated successfully!`
        );

        // Close modal
        resetEditModal();
        setShowEditModal(false);
      } catch (error) {
        console.error("Error in edit submission:", error);
        toast.error("An unexpected error occurred");
      } finally {
        setIsSavingEdit(false);
      }
    };
    // Add this function to clear edit photo
    const clearEditPhoto = () => {
      if (editPhotoPreview && editPhotoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(editPhotoPreview);
      }
      setEditPhotoPreview(null);
      setEditFileChosen("No new Photo selected");
      setIsPhotoRemoved(true);
      if (editPhotoInputRef.current) {
        editPhotoInputRef.current.value = "";
      }
    };
    // Add this helper function to reset edit modal
    const resetEditModal = () => {
      setEditingPerson(null);
      setEditPhotoPreview(null);
      setEditFileChosen("No new Photo selected");
      setIsPhotoRemoved(false);
      setShowEditLeaveModal(false);
      if (editPhotoInputRef.current) {
        editPhotoInputRef.current.value = "";
      }
      setIsSavingEdit(false);
    };
    const handleCloseEditModal = () => {
      if (editingPerson) {
        toast.info("No changes made. Modal closed.");
      }
      setShowEditModal(false);
      setEditingPerson(null);
      setEditPhotoPreview(null);
      setEditFileChosen("No new Photo selected");
      setIsPhotoRemoved(false);
      setIsSavingEdit(false);
    };
    const openEdit = async (person) => {
      try {
        setError("");
        if (!person || !person.id) {
          toast.error("Invalid personnel record selected.");
          return;
        }

        console.log("📝 Opening edit for:", person);

        // Load leave credits
        const currentYear = new Date().getFullYear();
        const existingCredits = await loadPersonnelLeaveCredits(
          person.id,
          currentYear
        );

        // Check if emergency balance is already 5
        const emergencyBalance = existingCredits?.emergency_balance || 0;
        const isEmergencyMax = emergencyBalance >= 5;

        // Format dates
        const birthDateValue = person.birth_date
          ? new Date(person.birth_date).toISOString().split("T")[0]
          : "";

        const hiredDateValue = person.date_hired
          ? new Date(person.date_hired).toISOString().split("T")[0]
          : "";

        // Get time from hired_time (24-hour format)
        let timeValue = "08:00"; // Default

        if (person.hired_time) {
          const timeStr = String(person.hired_time);
          const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
          if (match) {
            const hours = match[1].padStart(2, "0");
            const minutes = match[2] || "00";
            timeValue = `${hours}:${minutes}`;
          }
        }

        // Set all form data
        setEditFormData({
          badge_number: person.badge_number || "",
          first_name: person.first_name || "",
          middle_name: person.middle_name || "",
          last_name: person.last_name || "",
          suffix: person.suffix || "",
          designation: person.designation || "",
          station: person.station || "",
          birth_date: birthDateValue,
          date_hired: hiredDateValue,
          hired_time: timeValue,
          vacation_balance: existingCredits?.vacation_balance || 0,
          sick_balance: existingCredits?.sick_balance || 0,
          emergency_balance: emergencyBalance,
        });

        // Set rank
        setEditSelectedRank(person.rank || "");
        setEditSelectedRankImage(person.rank_image || "");

        // Set photo
        if (person.photo_url) {
          setEditPhotoPreview(person.photo_url);
          setEditFileChosen("Current photo");
        } else {
          setEditPhotoPreview(null);
          setEditFileChosen("No photo");
        }

        // Store emergency max status for reference
        setEmergencyMaxReached(isEmergencyMax);

        setEditingPerson(person);
        setIsPhotoRemoved(false);
        setShowEditModal(true);

        console.log("✅ Edit form loaded:", {
          firstName: person.first_name,
          lastName: person.last_name,
          rank: person.rank,
          emergencyBalance: emergencyBalance,
          isEmergencyMax: isEmergencyMax,
        });
      } catch (error) {
        console.error("❌ Error opening edit:", error);
        toast.error("Failed to load personnel data");
      }
    };
    const resetForm = () => {
      setFormData({
        badge_number: "",
        first_name: "",
        middle_name: "",
        last_name: "",
        suffix: "",
        designation: "",
        station: "",
        birth_date: "",
        date_hired: "",
        hired_time: "",
        vacation_balance: 0,
        sick_balance: 0,
        emergency_balance: 0,
      });
      setSelectedRank("");
      setSelectedRankImage("");
      setPhotoPreview(null);
      setFileChosen("No Photo selected");
      setGeneratedUsername("");
      setGeneratedPassword(generatePassword());
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    };

    const handleDeleteClick = (id, name) => {
      if (!id) {
        toast.error("Invalid ID — cannot delete.");
        return;
      }

      // Check if personnel is locked
      if (lockedPersonnel[id]?.isLocked) {
        toast.warning(`Cannot delete: ${lockedPersonnel[id]?.lockReason}`);
        return;
      }

      setDeleteId(id);
      setDeleteName(name);
      setShowDeleteConfirm(true);
    };

    const confirmDeletePersonnel = async () => {
      try {
        setIsDeleting(true);
        if (!deleteId) {
          toast.error("No personnel selected for deletion.");
          setIsDeleting(false);
          return;
        }

        // Double-check lock status before deleting
        if (lockedPersonnel[deleteId]?.isLocked) {
          toast.error(
            `Cannot delete: ${lockedPersonnel[deleteId]?.lockReason}`
          );
          setIsDeleting(false);
          return;
        }

        const { error } = await supabase
          .from("personnel")
          .delete()
          .eq("id", deleteId);

        if (error) {
          console.error("Supabase delete error:", error);
          if (error.code === "42501") {
            toast.error(
              "Permission denied. Please check Row Level Security policies."
            );
          } else {
            toast.error("Failed to delete personnel.");
          }
          throw error;
        }

        // IMPORTANT: Reload all personnel data after deletion
        await loadPersonnel(false);

        toast.warn("Personnel deleted successfully!");
        setShowDeleteConfirm(false);
        setDeleteId(null);
        setDeleteName("");
      } catch (error) {
        console.error("Error deleting personnel:", error);
        if (!error.message?.includes("Permission denied")) {
          toast.error("Failed to delete personnel.");
        }
      } finally {
        setIsDeleting(false);
      }
    };

    const cancelDelete = () => {
      setShowDeleteConfirm(false);
      setDeleteId(null);
      setDeleteName("");
      setIsDeleting(false);
    };

    const selectRank = (rank, image) => {
      setSelectedRank(rank);
      setSelectedRankImage(image);
      setShowRankModal(false);
    };

    const selectEditRank = (rank, image) => {
      setEditSelectedRank(rank);
      setEditSelectedRankImage(image);
      setShowEditRankModal(false);
    };
    // Add this function to test database updates directly
    const testDirectUpdate = async () => {
      if (!editingPerson) {
        toast.error("No personnel selected");
        return;
      }

      try {
        console.log("🧪 Testing direct update for:", editingPerson.id);

        const testData = {
          first_name: "TEST_DIRECT_" + Date.now(),
          updated_at: new Date().toISOString(),
        };

        console.log("Sending to Supabase:", testData);

        // Direct update with more debugging
        const { data, error, count } = await supabase
          .from("personnel")
          .update(testData)
          .eq("id", editingPerson.id)
          .select("*");

        console.log("Supabase response:", { data, error, count });

        if (error) {
          console.error("Direct update failed:", error);
          toast.error(`Direct update failed: ${error.message}`);
        } else {
          console.log("Direct update succeeded. Data returned:", data);

          // Check what's actually in the database now
          const { data: checkData } = await supabase
            .from("personnel")
            .select("first_name, updated_at")
            .eq("id", editingPerson.id)
            .single();

          console.log("Database check after update:", checkData);

          toast.success(
            `Direct update succeeded! First name: ${checkData?.first_name}`
          );
          await loadPersonnel(false);
        }
      } catch (error) {
        console.error("Direct test error:", error);
        toast.error("Direct test failed");
      }
    };

    // Add a test button in your edit modal (temporarily)
    // <button type="button" onClick={testDirectUpdate} style={{margin: '10px', padding: '5px'}}>
    //   Test Direct Update
    // </button>
    const getRankDisplay = (person) => {
      if (!person) return "-";

      // Check if we have rank_image from Supabase
      if (person.rank_image) {
        return (
          <div className={styles.prRankDisplay}>
            <div className={`${styles.rankIcon} ${person.rank || ""}`}>
              <img
                src={person.rank_image}
                alt={person.rank || "Rank"}
                onError={(e) => {
                  e.target.onerror = null;
                  // Fallback to local image if Supabase image fails
                  e.target.src = `/ranks/${person.rank}.png`;
                }}
              />
            </div>
            <span>{person.rank || "-"}</span>
          </div>
        );
      }

      // Check if we have rank from database
      if (person.rank) {
        return person.rank;
      }

      return "-";
    };

    const PhotoCell = ({ person }) => {
      const [isLoading, setIsLoading] = useState(true);
      const [imageSrc, setImageSrc] = useState("/bfp.jpg");

      useEffect(() => {
        const loadPhoto = async () => {
          setIsLoading(true);

          try {
            let url = "/bfp.jpg"; // Default fallback

            // Check in order of priority
            if (person.photo_url && person.photo_url.startsWith("http")) {
              // Test if the photo_url is accessible
              const isValid = await testImage(person.photo_url);
              if (isValid) {
                url = person.photo_url;
              } else {
                // Try photo_path as fallback
                if (person.photo_path) {
                  const { data: urlData } = supabase.storage
                    .from("personnel-documents")
                    .getPublicUrl(person.photo_path);
                  url = urlData?.publicUrl || "/bfp.jpg";
                }
              }
            } else if (person.photo_path) {
              // Use photo_path if photo_url is not available
              const { data: urlData } = supabase.storage
                .from("personnel-documents")
                .getPublicUrl(person.photo_path);
              url = urlData?.publicUrl || "/bfp.jpg";
            }

            setImageSrc(url);
          } catch (error) {
            console.error("Error loading photo:", error);
            setImageSrc("/bfp.jpg");
          } finally {
            // Small delay to prevent flash
            setTimeout(() => setIsLoading(false), 100);
          }
        };

        loadPhoto();
      }, [person]);

      // Test if image URL is accessible
      const testImage = (url) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });
      };

      return (
        <td className={styles.prPhotoCell}>
          <div className={styles.prPhotoContainer}>
            {isLoading ? (
              <div className={styles.prPhotoLoading}>
                <div className={styles.prPhotoSpinner}></div>
                <small>Loading...</small>
              </div>
            ) : (
              <img
                src={imageSrc}
                alt={`${person.first_name || ""} ${person.last_name || ""}`}
                className={styles.prPhotoThumb}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/bfp.jpg";
                }}
                loading="lazy"
              />
            )}
          </div>
        </td>
      );
    };
    const getPhotoUrl = (person) => {
      if (!person) return "/bfp.jpg";

      // If we have a photo_url, use it
      if (person.photo_url) {
        return person.photo_url;
      }

      // If we have a photo_path, construct URL
      if (person.photo_path) {
        const { data: urlData } = supabase.storage
          .from("personnel-documents")
          .getPublicUrl(person.photo_path);
        return urlData?.publicUrl || "/bfp.jpg";
      }

      // Fallback to default image
      return "/bfp.jpg";
    };
    const findPhotoByName = async (person) => {
      if (!person.first_name || !person.last_name || !person.rank) {
        return null;
      }

      try {
        const safeFirstName = person.first_name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
        const safeLastName = person.last_name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
        const safeRank = person.rank.toLowerCase().replace(/[^a-z0-9]/g, "_");

        const folderName = `${safeLastName}_${safeFirstName}_${safeRank}`;

        // Try to find any profile image in the folder
        const { data: files, error } = await supabase.storage
          .from("personnel-documents")
          .list(`personnel-images/${folderName}`, {
            limit: 1,
            offset: 0,
            sortBy: { column: "created_at", order: "desc" },
          });

        if (error) {
          console.error("Error listing files:", error);
          return null;
        }

        if (files && files.length > 0) {
          const filePath = `personnel-images/${folderName}/${files[0].name}`;
          const { data: urlData } = supabase.storage
            .from("personnel-documents")
            .getPublicUrl(filePath);

          return {
            url: urlData?.publicUrl || null,
            path: filePath,
          };
        }

        return null;
      } catch (error) {
        console.error("Error finding photo by name:", error);
        return null;
      }
    };

    const PasswordCell = ({ password }) => {
      const [showPassword, setShowPassword] = useState(false);
      const [copied, setCopied] = useState(false);

      const togglePassword = () => {
        setShowPassword(!showPassword);
      };

      const copyPassword = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      };

      return (
        <td className={styles.prPasswordCell}>
          <div className={styles.prPasswordContainer}>
            <span className={styles.prPasswordMask}>
              {showPassword ? password : "••••••••"}
            </span>
            <div className={styles.prPasswordActions}>
              <button
                className={styles.prPasswordToggle}
                onClick={togglePassword}
                type="button"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <FaEyeSlash className={styles.prPasswordIcon} />
                ) : (
                  <FaEye className={styles.prPasswordIcon} />
                )}
              </button>
              <button
                className={styles.prCopyBtn}
                onClick={copyPassword}
                type="button"
                title="Copy password"
              >
                {copied ? (
                  <FaCheck className={styles.prCopyIcon} />
                ) : (
                  <FaCopy className={styles.prCopyIcon} />
                )}
              </button>
            </div>
            {copied && <span className={styles.prCopiedText}>Copied!</span>}
          </div>
        </td>
      );
    };

    // Handle click outside modals
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (showEditModal && event.target.classList.contains(styles.modal)) {
          setShowEditModal(false);
        }
        if (
          showRankModal &&
          event.target.classList.contains(styles.rankModal)
        ) {
          setShowRankModal(false);
        }
        if (
          showEditRankModal &&
          event.target.classList.contains(styles.rankModal)
        ) {
          setShowEditRankModal(false);
        }
      };

      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }, [showEditModal, showRankModal, showEditRankModal]);
    const debugClearanceStatus = async () => {
      const personnelId = "154a27b1-ea03-4e61-9b85-77c203ad097c";

      console.log("=== DEEP DEBUG ===");

      // 1. Check clearance_requests
      const { data: clearances } = await supabase
        .from("clearance_requests")
        .select("*")
        .eq("personnel_id", personnelId);
      console.log("1. Clearance requests:", clearances);

      // 2. Check inspections
      const { data: inspections } = await supabase
        .from("inspections")
        .select(
          `
          *,
          clearance_inventory!inner(
            personnel_id
          )
        `
        )
        .eq("clearance_inventory.personnel_id", personnelId);
      console.log("2. Inspections:", inspections);

      // 3. Check personnel_restrictions view
      const { data: viewData } = await supabase
        .from("personnel_restrictions")
        .select("*")
        .eq("personnel_id", personnelId);
      console.log("3. View data:", viewData);

      // 4. Run the view query manually
      const { data: manualQuery } = await supabase
        .from("clearance_requests")
        .select("id, personnel_id, status, type")
        .eq("personnel_id", personnelId)
        .in("status", ["Pending", "In Progress", "Pending for Approval"])
        .in("type", ["Resignation", "Retirement", "Equipment Completion"]);
      console.log("4. Manual query:", manualQuery);
    };
    // Add this helper function

    // In PersonnelRegister.jsx, update the BFPPreloader usage:
    if (loading) {
      return (
        <div className={styles.prContainer}>
          <Title>Personnel Register | BFP Villanueva</Title>
          <Meta name="robots" content="noindex, nofollow" />

          <Hamburger />
          <Sidebar />
          <BFPPreloader
            loading={loading}
            dataReady={personnel.length > 0 || !loading}
            moduleTitle="PERSONNEL REGISTER • Loading Personnel Data..."
            onRetry={loadPersonnel}
          />
        </div>
      );
    }
    const validateLeaveCredits = () => {
      const vacation = parseFloat(formData.vacation_balance) || 0;
      const sick = parseFloat(formData.sick_balance) || 0;
      const emergency = parseFloat(formData.emergency_balance) || 0;

      if (vacation < 0 || sick < 0 || emergency < 0) {
        toast.error("Leave credits cannot be negative");
        return false;
      }

      if (vacation > 999.99 || sick > 999.99 || emergency > 999.99) {
        toast.error("Maximum leave credit is 999.99 days per type");
        return false;
      }

      return true;
    };
    // Get current personnel for display
    const currentPersonnel = paginate(
      filteredPersonnel,
      currentPage,
      rowsPerPage
    );

    const renderPersonnelRow = (person) => {
      if (!person) return null;

      const status = checkPersonnelStatus(person);
      const isInactive = !status.shouldDisplay;

      return (
        <tr key={person.id} className={isInactive ? styles.inactiveRow : ""}>
          <PhotoCell person={person} />
          <td>{getRankDisplay(person)}</td>
          <td>
            {person.badge_number ? (
              <HighlightMatch text={person.badge_number} searchTerm={search} />
            ) : (
              "-"
            )}
          </td>
          <td>
            <HighlightMatch text={person.first_name} searchTerm={search} />
          </td>
          <td>
            {person.middle_name ? (
              <HighlightMatch text={person.middle_name} searchTerm={search} />
            ) : (
              "-"
            )}
          </td>
          <td>
            <HighlightMatch text={person.last_name} searchTerm={search} />
          </td>
          <td>{person.suffix || "-"}</td>
          <td>{person.designation || "-"}</td>
          <td>
            {person.station ? (
              <HighlightMatch text={person.station} searchTerm={search} />
            ) : (
              "-"
            )}
          </td>
          <td>{formatDate(person.birth_date)}</td>
          <td>{formatDateTimeHired(person)}</td>
          <td>
            <div className={styles.statusCell}>
              {getPersonnelStatusBadge(person)}
            </div>
          </td>
          <td>{person.username}</td>
          <PasswordCell password={person.password} />

          <td className={styles.prActionsCell}>
            <div className={styles.prActionsContainer}>
              {/* Show lock status prominently */}
              {lockedPersonnel[person.id]?.isLocked ? (
                <div className={styles.lockStatusBadge}>
                  <span className={styles.lockIcon}>🔒</span>
                  <span className={styles.lockReason}>
                    {lockedPersonnel[person.id].lockReason}
                  </span>
                </div>
              ) : (
                <LockStatusIcon personnelId={person.id} />
              )}

              {/* Status management buttons */}
              {isInactive ? (
                <button
                  className={styles.prReactivateBtn}
                  onClick={() => openStatusModal(person, "reactivate")}
                  title="Reactivate personnel"
                >
                  <FaRedo /> Reactivate
                </button>
              ) : (
                <>
                  {/* Edit button - disabled for locked personnel */}
                  <button
                    className={`${styles.prEditBtn} ${
                      lockedPersonnel[person.id]?.isLocked
                        ? styles.disabled
                        : ""
                    }`}
                    onClick={() => {
                      if (lockedPersonnel[person.id]?.isLocked) {
                        toast.warning(
                          `Cannot edit: ${
                            lockedPersonnel[person.id]?.lockReason
                          }`
                        );
                      } else {
                        openEdit(person);
                      }
                    }}
                    disabled={lockedPersonnel[person.id]?.isLocked}
                  >
                    Edit
                  </button>

                  {/* Retire button */}
                  <button
                    className={styles.prRetireBtn}
                    onClick={() => openStatusModal(person, "retire")}
                    disabled={lockedPersonnel[person.id]?.isLocked}
                    title={
                      lockedPersonnel[person.id]?.isLocked
                        ? "Cannot retire locked personnel"
                        : "Mark as retired"
                    }
                  >
                    <FaArchive /> Retire
                  </button>

                  {/* Resign button */}
                  <button
                    className={styles.prResignBtn}
                    onClick={() => openStatusModal(person, "resign")}
                    disabled={lockedPersonnel[person.id]?.isLocked}
                    title={
                      lockedPersonnel[person.id]?.isLocked
                        ? "Cannot resign locked personnel"
                        : "Mark as resigned"
                    }
                  >
                    <FaUserSlash /> Resign
                  </button>
                </>
              )}

              {/* Delete button - only for active, unlocked personnel */}
              {!isInactive && (
                <button
                  className={`${styles.prDeleteBtn} ${
                    lockedPersonnel[person.id]?.isLocked ? styles.disabled : ""
                  }`}
                  onClick={() => {
                    if (lockedPersonnel[person.id]?.isLocked) {
                      toast.warning(
                        `Cannot delete: ${
                          lockedPersonnel[person.id]?.lockReason
                        }`
                      );
                    } else {
                      handleDeleteClick(
                        person.id,
                        `${person.first_name} ${person.last_name}`
                      );
                    }
                  }}
                  disabled={lockedPersonnel[person.id]?.isLocked}
                >
                  Delete
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    };
    const StatusManagementModal = () => {
      if (!showStatusModal || !statusModalPersonnel) return null;

      const personName = `${statusModalPersonnel.first_name} ${statusModalPersonnel.last_name}`;
      const actionText =
        statusAction === "retire"
          ? "Retirement"
          : statusAction === "resign"
          ? "Resignation"
          : "Reactivation";

      return (
        <div className={styles.statusModalOverlay}>
          <div className={styles.statusModalContent}>
            <div className={styles.statusModalHeader}>
              <h3 className={styles.statusModalTitle}>
                {actionText} - {personName}
              </h3>
              <button
                className={styles.statusModalClose}
                onClick={closeStatusModal}
                disabled={isUpdatingStatus}
              >
                &times;
              </button>
            </div>

            <div className={styles.statusModalBody}>
              {statusAction === "reactivate" ? (
                <div className={styles.reactivateConfirmation}>
                  <p>Are you sure you want to reactivate {personName}?</p>
                  <p className={styles.reactivateNote}>
                    This will restore their account and make them active again.
                  </p>
                </div>
              ) : (
                <div className={styles.statusForm}>
                  <div className={styles.statusFormGroup}>
                    <label htmlFor="statusDate">
                      {statusAction === "retire"
                        ? "Retirement Date"
                        : "Separation Date"}{" "}
                      *
                    </label>
                    <input
                      type="date"
                      id="statusDate"
                      value={statusData.date}
                      onChange={(e) =>
                        setStatusData((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                      max={new Date().toISOString().split("T")[0]}
                      required
                    />
                  </div>

                  <div className={styles.statusFormGroup}>
                    <label htmlFor="statusReason">
                      Reason {statusAction === "retire" ? "(Optional)" : "*"}
                    </label>
                    <textarea
                      id="statusReason"
                      value={statusData.reason}
                      onChange={(e) =>
                        setStatusData((prev) => ({
                          ...prev,
                          reason: e.target.value,
                        }))
                      }
                      placeholder={`Enter ${
                        statusAction === "retire" ? "retirement" : "resignation"
                      } reason...`}
                      required={statusAction === "resign"}
                    />
                  </div>

                  <div className={styles.statusNotice}>
                    <p>
                      <strong>Note:</strong>{" "}
                      {statusAction === "retire" ? "Retiring" : "Resigning"}{" "}
                      this personnel will:
                    </p>
                    <ul>
                      <li>Mark their account as inactive</li>
                      <li>
                        Prevent them from appearing in active personnel lists
                      </li>
                      <li>Preserve all their records and data</li>
                      <li>Allow reactivation if needed</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.statusModalFooter}>
              <button
                className={styles.statusCancelBtn}
                onClick={closeStatusModal}
                disabled={isUpdatingStatus}
              >
                Cancel
              </button>
              <button
                className={styles.statusConfirmBtn}
                onClick={handleUpdateStatus}
                disabled={
                  isUpdatingStatus ||
                  (statusAction === "resign" && !statusData.reason.trim())
                }
              >
                {isUpdatingStatus ? (
                  <>
                    <span className={styles.statusSpinner}></span>
                    Processing...
                  </>
                ) : (
                  `Confirm ${actionText}`
                )}
              </button>
            </div>
          </div>
        </div>
      );
    };
    const renderFilterPanel = () => {
      return (
        <div className={styles.prFilterPanel}>
          {/* Status Summary */}
          <div className={styles.statusSummary}>
            <div
              className={`${styles.statusSummaryItem} ${styles.statusSummaryActive}`}
            >
              <div className={styles.statusSummaryValue}>
                {statusSummary.active}
              </div>
              <div className={styles.statusSummaryLabel}>Active</div>
            </div>
            <div
              className={`${styles.statusSummaryItem} ${styles.statusSummaryInactive}`}
            >
              <div className={styles.statusSummaryValue}>
                {statusSummary.inactive}
              </div>
              <div className={styles.statusSummaryLabel}>Inactive</div>
            </div>
            <div
              className={`${styles.statusSummaryItem} ${styles.statusSummaryRetired}`}
            >
              <div className={styles.statusSummaryValue}>
                {statusSummary.retired}
              </div>
              <div className={styles.statusSummaryLabel}>Retired</div>
            </div>
            <div
              className={`${styles.statusSummaryItem} ${styles.statusSummaryResigned}`}
            >
              <div className={styles.statusSummaryValue}>
                {statusSummary.resigned}
              </div>
              <div className={styles.statusSummaryLabel}>Resigned</div>
            </div>
            <div className={styles.statusSummaryItem}>
              <div className={styles.statusSummaryValue}>
                {statusSummary.total}
              </div>
              <div className={styles.statusSummaryLabel}>Total</div>
            </div>
          </div>

          <div className={styles.prFilterRow}>
            <div className={styles.prFilterGroup}>
              <input
                type="text"
                className={styles.prSearchBar}
                placeholder="🔍 Search name, rank, station, badge, status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.prFilterGroup}>
              <select
                className={styles.prFilterSelect}
                value={filterRank}
                onChange={(e) => setFilterRank(e.target.value)}
              >
                <option value="">All Ranks</option>
                {rankOptions.map((rank) => (
                  <option key={rank.rank} value={rank.rank}>
                    {rank.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.prFilterGroup}>
              <select
                className={styles.prFilterSelect}
                value={filterStation}
                onChange={(e) => setFilterStation(e.target.value)}
              >
                <option value="">All Stations</option>
                {getUniqueStations().map((station) => (
                  <option key={station} value={station}>
                    {station}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.prFilterGroup}>
              <select
                className={styles.prFilterSelect}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="all">Show All</option>
              </select>
            </div>
            <div className={styles.prFilterGroup}>
              <button
                className={styles.prClearFiltersBtn}
                onClick={clearFilters}
                type="button"
              >
                Clear Filters
              </button>
            </div>
          </div>
          <div className={styles.prFilterInfo}>
            Showing {filteredPersonnel.length} of {personnel?.length || 0}{" "}
            personnel (
            {filterStatus === "active"
              ? "active only"
              : filterStatus === "inactive"
              ? "inactive only"
              : "all"}
            ){search || filterRank || filterStation ? " (filtered)" : ""}
          </div>
        </div>
      );
    };
    const renderTableHeader = () => {
      return (
        <div className={styles.prTableHeaderSection}>
          <h2>Personnel Register</h2>
          <div className={styles.prTopControls}>
            <button
              className={styles.prShowFiltersBtn}
              onClick={() => setShowFilters(!showFilters)}
              type="button"
            >
              <FaFilter /> {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
            {renderPaginationButtons()}
          </div>
        </div>
      );
    };

    const formatDateTimeHired = (person) => {
      if (!person.date_hired) return "-";

      try {
        const date = new Date(person.date_hired);
        const formattedDate = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        // Use hired_at_display for AM/PM format
        let timeDisplay =
          person.hired_at_display ||
          (person.hired_time ? formatTimeToAMPM(person.hired_time) : "");

        if (timeDisplay) {
          return (
            <span>
              {formattedDate}
              <br />
              <small
                style={{
                  color: "#ff9500",
                  fontSize: "0.9em",
                  fontWeight: "700",
                }}
              >
                at {timeDisplay}
              </small>
            </span>
          );
        }

        return formattedDate;
      } catch (error) {
        console.error("Error formatting date/time:", error);
        return "-";
      }
    };
      const renderTable = () => {
        return (
          <div className={styles.prTableBorder}>
            <table className={styles.prTable}>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Rank</th>
                  <th>Badge No.</th>
                  <th>First</th>
                  <th>Middle</th>
                  <th>Last</th>
                  <th>Suffix</th>
                  <th>Designation</th>
                  <th>Station</th>
                  <th>Birth Date</th>
                  <th>Date & Time Hired</th>
                  <th>Status</th>
                  <th>Username</th>
                  <th>Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentPersonnel.length === 0 ? (
                  <tr>
                    <td
                      colSpan="15"
                      style={{ textAlign: "center", padding: "40px" }}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                        <span className={styles.animatedEmoji}>📇</span>
                      </div>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#2b2b2b",
                          marginBottom: "8px",
                        }}
                      >
                        {search ||
                        filterRank ||
                        filterStation ||
                        filterStatus !== "active"
                          ? "No Personnel Found Matching Filters"
                          : "No Active Personnel Registered"}
                      </h3>
                      <p style={{ fontSize: "14px", color: "#999" }}>
                        {search ||
                        filterRank ||
                        filterStation ||
                        filterStatus !== "active"
                          ? "Try adjusting your search or filter criteria"
                          : "Register your first team member to get started"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  currentPersonnel.map(renderPersonnelRow)
                )}
              </tbody>
            </table>
          </div>
        );
      };
    // Format 24-hour time to AM/PM
    const formatTimeToAMPM = (timeString) => {
      if (!timeString) return "";

      try {
        const [hours, minutes] = timeString.split(":");
        const hour = parseInt(hours, 10);

        if (isNaN(hour)) return timeString;

        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 || 12;

        return `${displayHour}:${minutes} ${ampm}`;
      } catch (error) {
        console.error("Error formatting time:", error);
        return timeString;
      }
    };
    return (
      <div className={styles.prContainer}>
        <Title>Personnel Register | BFP Villanueva</Title>
        <Meta name="robots" content="noindex, nofollow" />
        <AdminGearIcon />
        <Hamburger />
        <ToastContainer
          position="top-right"
          autoClose={2500}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
        <Sidebar />
        <StatusManagementModal />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <h1>Personnel Registration</h1>

          {error && <div className={styles.prErrorMessage}>{error}</div>}
          <div className={styles.prCard}>
            <h2>Register New Personnel</h2>
            <button
              className={`${styles.prShowFormBtn} ${styles.prSubmit}${
                showForm ? styles.showing : ""
              }`}
              onClick={() => setShowForm(!showForm)}
              type="button"
            >
              {showForm ? "Hide Form" : "Add New Personnel"}
            </button>
            <form
              className={`${styles.prForm} ${styles.prLayout} ${
                showForm ? styles.show : ""
              }`}
              onSubmit={handleSubmit}
              ref={formRef}
            >
              {/* Photo Section - ENABLED */}
              <div className={styles.prPhotoSection}>
                <div className={styles.prPhotoPreview}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Photo Preview" />
                  ) : (
                    <div className={styles.prNoPhotoPreview}>
                      <span className={styles.prNoPhotoIcon}>📷</span>
                      <span>Photo Preview</span>
                    </div>
                  )}
                </div>
                <div className={styles.prFileUpload}>
                  <label className={styles.prFileUploadLabel} htmlFor="photo">
                    <input
                      type="file"
                      id="photo"
                      ref={photoInputRef}
                      accept="image/*"
                      onChange={handlePhotoChange}
                      style={{ display: "none" }}
                    />
                    {photoPreview ? "Change Photo" : "Upload Photo"}
                  </label>
                  <span className={styles.prFileInfo}>{fileChosen}</span>
                  {photoPreview && (
                    <button
                      type="button"
                      className={styles.prClearPhotoBtn}
                      onClick={clearPhoto}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className={styles.prPhotoInstructions}>
                  <small>Max size: 5MB • JPG, PNG, GIF, WebP</small>
                </div>
              </div>
              <div className={styles.prInfoSection}>
                {/* Form fields remain the same as before */}
                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="badge-number"
                        className={styles.floatingInput}
                        placeholder=" "
                        value={formData.badge_number}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            badge_number: e.target.value,
                          }))
                        }
                      />
                      <label
                        htmlFor="badge-number"
                        className={styles.floatingLabel}
                      >
                        Badge Number (Optional)
                      </label>
                    </div>
                  </div>
                  <div className={styles.prFormGroup}>
                    <div
                      className={styles.floatingGroup}
                      id="rank-floating-group"
                    >
                      <button
                        type="button"
                        id="rank-trigger"
                        className={styles.rankTrigger}
                        onClick={() => setShowRankModal(true)}
                      >
                        <div className={styles.selectedRank}>
                          {selectedRank ? (
                            <>
                              <div
                                className={`${styles.rankIcon} ${selectedRank}`}
                              >
                                <img
                                  src={selectedRankImage}
                                  alt={selectedRank}
                                />
                              </div>
                              <span>
                                {
                                  rankOptions.find(
                                    (r) => r.rank === selectedRank
                                  )?.name
                                }
                              </span>
                            </>
                          ) : (
                            <span className={styles.placeholder}>
                              Select Rank *
                            </span>
                          )}
                        </div>
                      </button>
                      <input
                        type="hidden"
                        id="rank"
                        value={selectedRank}
                        ref={rankImageInputRef}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="first-name"
                        className={styles.floatingInput}
                        placeholder=" "
                        value={formData.first_name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            first_name: e.target.value,
                          }))
                        }
                        required
                      />
                      <label
                        htmlFor="first-name"
                        className={styles.floatingLabel}
                      >
                        First Name *
                      </label>
                    </div>
                  </div>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="middle-name"
                        className={styles.floatingInput}
                        placeholder=" "
                        value={formData.middle_name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            middle_name: e.target.value,
                          }))
                        }
                      />
                      <label
                        htmlFor="middle-name"
                        className={styles.floatingLabel}
                      >
                        Middle Name
                      </label>
                    </div>
                  </div>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="last-name"
                        className={styles.floatingInput}
                        placeholder=" "
                        value={formData.last_name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            last_name: e.target.value,
                          }))
                        }
                        required
                      />
                      <label
                        htmlFor="last-name"
                        className={styles.floatingLabel}
                      >
                        Last Name *
                      </label>
                    </div>
                  </div>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <select
                        id="suffix"
                        className={styles.floatingSelect}
                        value={formData.suffix}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            suffix: e.target.value,
                          }))
                        }
                      >
                        {suffixOptions.map((suffix) => (
                          <option key={suffix} value={suffix}>
                            {suffix || "Suffix (Optional)"}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="suffix" className={styles.floatingLabel}>
                        Suffix
                      </label>
                    </div>
                  </div>
                </div>

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="designation"
                        className={styles.floatingInput}
                        placeholder=" "
                        value={formData.designation}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            designation: e.target.value,
                          }))
                        }
                      />
                      <label
                        htmlFor="designation"
                        className={styles.floatingLabel}
                      >
                        Designation
                      </label>
                    </div>
                  </div>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="station"
                        className={styles.floatingInput}
                        placeholder=" "
                        value={formData.station}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            station: e.target.value,
                          }))
                        }
                      />
                      <label htmlFor="station" className={styles.floatingLabel}>
                        Station Assignment
                      </label>
                    </div>
                  </div>
                </div>

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="username-preview"
                        className={`${styles.floatingInput} ${styles.readOnlyField}`}
                        placeholder=" "
                        value={generatedUsername}
                        readOnly
                        disabled
                      />
                      <label
                        htmlFor="username-preview"
                        className={styles.floatingLabel}
                      >
                        Username (Auto-generated)
                      </label>
                    </div>
                  </div>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="password-preview"
                        className={`${styles.floatingInput} ${styles.readOnlyField}`}
                        placeholder=" "
                        value={generatedPassword}
                        readOnly
                        disabled
                      />
                      <label
                        htmlFor="password-preview"
                        className={styles.floatingLabel}
                      >
                        Password (Auto-generated)
                      </label>
                    </div>
                    <button
                      type="button"
                      className={styles.regeneratePasswordBtn}
                      onClick={() => setGeneratedPassword(generatePassword())}
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
                {/* In your registration form */}
                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="date"
                        id="birth-date"
                        className={styles.floatingInput}
                        value={formData.birth_date}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            birth_date: e.target.value,
                          }))
                        }
                        max={
                          formData.date_hired ||
                          new Date().toISOString().split("T")[0]
                        }
                        required
                      />
                      <label
                        htmlFor="birth-date"
                        className={styles.floatingLabel}
                      >
                        Birth Date *
                      </label>
                    </div>
                  </div>

                  {/* In your registration form */}
                  <div className={styles.prFormRow}>
                    <div className={styles.prFormGroup}>
                      <div className={styles.floatingGroup}>
                        <input
                          type="date"
                          id="date-hired"
                          className={styles.floatingInput}
                          value={formData.date_hired}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              date_hired: e.target.value,
                            }))
                          }
                          min={formData.birth_date || undefined}
                          required
                        />
                        <label
                          htmlFor="date-hired"
                          className={styles.floatingLabel}
                        >
                          Date Hired *
                        </label>
                      </div>
                    </div>

                    <div className={styles.prFormGroup}>
                      <div className={styles.floatingGroup}>
                        <input
                          type="time"
                          id="hired-time"
                          className={styles.floatingInput}
                          value={formData.hired_time || "08:00"}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              hired_time: e.target.value,
                            }))
                          }
                          step="300" // 5-minute increments
                          required
                        />
                        <label
                          htmlFor="hired-time"
                          className={styles.floatingLabel}
                        >
                          Time Hired *
                        </label>
                        {formData.hired_time && (
                          <div className={styles.timeDisplay}>
                            <small>
                              {formatTimeToAMPM(formData.hired_time)}
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.prFormActions}>
                  <button
                    type="button"
                    className={styles.prCancel}
                    onClick={resetForm}
                    disabled={isRegistering}
                  >
                    Clear Information
                  </button>
                  <button
                    type="submit"
                    className={`${styles.prSubmit} ${
                      isRegistering ? styles.prSubmitLoading : ""
                    }`}
                    disabled={isRegistering}
                  >
                    {isRegistering ? (
                      <>
                        <span className={styles.prSubmitSpinner}></span>
                        Registering...
                      </>
                    ) : (
                      "Register Personnel"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
          {/* ========== FILTER CONTROLS (ADDED) - Matching Inventory Control Style ========== */}
          <div className={styles.prTableHeaderSection}>
            <h2>All Registered Personnel</h2>
            <div className={styles.prTopControls}>
              <button
                className={styles.prShowFiltersBtn}
                onClick={() => setShowFilters(!showFilters)}
                type="button"
              >
                <FaFilter /> {showFilters ? "Hide Filters" : "Show Filters"}
              </button>
              {renderPaginationButtons()}
            </div>
          </div>
          {/* ========== FILTER PANEL (ADDED) - Matching Inventory Control Style ========== */}
          {showFilters && (
            <div className={styles.prFilterPanel}>
              <div className={styles.prFilterRow}>
                <div className={styles.prFilterGroup}>
                  <input
                    type="text"
                    className={styles.prSearchBar}
                    placeholder="🔍 Search name, rank, station, badge..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className={styles.prFilterGroup}>
                  <select
                    className={styles.prFilterSelect}
                    value={filterRank}
                    onChange={(e) => setFilterRank(e.target.value)}
                  >
                    <option value="">All Ranks</option>
                    {rankOptions.map((rank) => (
                      <option key={rank.rank} value={rank.rank}>
                        {rank.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.prFilterGroup}>
                  <select
                    className={styles.prFilterSelect}
                    value={filterStation}
                    onChange={(e) => setFilterStation(e.target.value)}
                  >
                    <option value="">All Stations</option>
                    {getUniqueStations().map((station) => (
                      <option key={station} value={station}>
                        {station}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.prFilterGroup}>
                  <button
                    className={styles.prClearFiltersBtn}
                    onClick={clearFilters}
                    type="button"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
              <div className={styles.prFilterInfo}>
                Showing {filteredPersonnel.length} of {personnel?.length || 0}{" "}
                personnel
                {search || filterRank || filterStation ? " (filtered)" : ""}
              </div>
            </div>
          )}
          <div className={styles.prTableBorder}>
            <table className={styles.prTable}>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Rank</th>
                  <th>Badge No.</th>
                  <th>First</th>
                  <th>Middle</th>
                  <th>Last</th>
                  <th>Suffix</th>
                  <th>Designation</th>
                  <th>Station</th>
                  <th>Birth Date</th>

                  <th>Date & Time Hired</th>
                  <th>Status</th>
                  <th>Username</th>
                  <th>Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentPersonnel.length === 0 ? (
                  <tr>
                    <td
                      colSpan="15"
                      style={{ textAlign: "center", padding: "40px" }}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                        <span className={styles.animatedEmoji}>📇</span>
                      </div>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#2b2b2b",
                          marginBottom: "8px",
                        }}
                      >
                        {search ||
                        filterRank ||
                        filterStation ||
                        filterStatus !== "active"
                          ? "No Personnel Found Matching Filters"
                          : "No Active Personnel Registered"}
                      </h3>
                      <p style={{ fontSize: "14px", color: "#999" }}>
                        {search ||
                        filterRank ||
                        filterStation ||
                        filterStatus !== "active"
                          ? "Try adjusting your search or filter criteria"
                          : "Register your first team member to get started"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  currentPersonnel.map((person) => {
                    if (!person) return null;
                    return (
                      <tr key={person.id}>
                        <PhotoCell person={person} />
                        <td>{getRankDisplay(person)}</td>
                        <td>
                          {person.badge_number ? (
                            <HighlightMatch
                              text={person.badge_number}
                              searchTerm={search}
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <HighlightMatch
                            text={person.first_name}
                            searchTerm={search}
                          />
                        </td>
                        <td>
                          {person.middle_name ? (
                            <HighlightMatch
                              text={person.middle_name}
                              searchTerm={search}
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <HighlightMatch
                            text={person.last_name}
                            searchTerm={search}
                          />
                        </td>
                        <td>{person.suffix || "-"}</td>
                        <td>{person.designation || "-"}</td>
                        <td>
                          {person.station ? (
                            <HighlightMatch
                              text={person.station}
                              searchTerm={search}
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{formatDate(person.birth_date)}</td>
                        <td>{formatDateTimeHired(person)}</td>
                        <td className={styles.statusCell}>
                          {getPersonnelStatusBadge(person)}
                        </td>
                        <td>{person.username}</td>
                        <PasswordCell password={person.password} />

                        <td className={styles.prActionsCell}>
                          <div className={styles.prActionsContainer}>
                            {/* Show lock status prominently */}
                            {lockedPersonnel[person.id]?.isLocked ? (
                              <div
                                style={{
                                  background: "#ffebee",
                                  padding: "5px 10px",
                                  borderRadius: "4px",
                                  border: "1px solid #f44336",
                                  marginRight: "10px",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <span
                                  style={{
                                    color: "#f44336",
                                    marginRight: "5px",
                                  }}
                                >
                                  🔒
                                </span>
                                <span
                                  style={{ fontSize: "12px", color: "#d32f2f" }}
                                >
                                  {lockedPersonnel[person.id].lockReason}
                                </span>
                              </div>
                            ) : (
                              <LockStatusIcon personnelId={person.id} />
                            )}

                            <button
                              className={`${styles.prEditBtn} ${
                                lockedPersonnel[person.id]?.isLocked
                                  ? styles.disabled
                                  : ""
                              }`}
                              onClick={() => {
                                if (lockedPersonnel[person.id]?.isLocked) {
                                  toast.warning(
                                    `Cannot edit: ${
                                      lockedPersonnel[person.id]?.lockReason
                                    }`
                                  );
                                } else {
                                  openEdit(person);
                                }
                              }}
                              disabled={lockedPersonnel[person.id]?.isLocked}
                            >
                              Edit
                            </button>

                            <button
                              className={`${styles.prDeleteBtn} ${
                                lockedPersonnel[person.id]?.isLocked
                                  ? styles.disabled
                                  : ""
                              }`}
                              onClick={() => {
                                if (lockedPersonnel[person.id]?.isLocked) {
                                  toast.warning(
                                    `Cannot delete: ${
                                      lockedPersonnel[person.id]?.lockReason
                                    }`
                                  );
                                } else {
                                  handleDeleteClick(
                                    person.id,
                                    `${person.first_name} ${person.last_name}`
                                  );
                                }
                              }}
                              disabled={lockedPersonnel[person.id]?.isLocked}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {renderTableHeader()}

          {/* Filter Panel */}
          {showFilters && renderFilterPanel()}

          {/* Personnel Table */}
          {renderTable()}
          {/* ========== BOTTOM PAGINATION ========== */}
          <div className={styles.prBottomPagination}>
            {renderPaginationButtons()}
          </div>
        </div>
        {/* Edit Modal - Fixed version */}
        {showEditModal && (
          <div
            className={`${styles.modal} ${styles.show} ${
              isSidebarCollapsed ? styles.sidebarCollapsed : ""
            }`}
          >
            <div
              className={`${styles.modalContent} ${
                isSidebarCollapsed ? styles.modalContentCollapsed : ""
              }`}
            >
              <div className={styles.modalHeader}>
                <h2>
                  Edit Personnel -{" "}
                  {editingPerson
                    ? `${editingPerson.first_name} ${editingPerson.last_name}`
                    : ""}
                </h2>
                <button
                  className={styles.ShowEditModalCloseBtn}
                  onClick={handleCloseEditModal}
                >
                  &times;
                </button>
              </div>

              <form
                id="edit-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setIsSavingEdit(true);
                    setError("");

                    console.log("=== STARTING EDIT (TRIGGER DISABLED) ===");

                    // Validate required fields
                    if (
                      !editFormData.first_name?.trim() ||
                      !editFormData.last_name?.trim()
                    ) {
                      toast.error("First name and last name are required!");
                      setIsSavingEdit(false);
                      return;
                    }

                    if (!editSelectedRank) {
                      toast.error("Please select a rank!");
                      setIsSavingEdit(false);
                      return;
                    }

                    // Prepare date_hired and hired_at values
                    let dateHiredValue = null;
                    let hiredAtTimeValue = null;

                    if (editFormData.date_hired) {
                      dateHiredValue = editFormData.date_hired;

                      // Prepare time value
                      if (
                        editFormData.hired_time &&
                        editFormData.hired_time.trim() !== ""
                      ) {
                        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
                        if (timeRegex.test(editFormData.hired_time)) {
                          hiredAtTimeValue = `${editFormData.hired_time}:00`;
                        } else {
                          hiredAtTimeValue = null;
                        }
                      }
                    }

                    // Prepare personnel update data - ALL FIELDS
                    const personnelUpdateData = {
                      // Basic info
                      badge_number: editFormData.badge_number || null,
                      first_name: editFormData.first_name.trim(),
                      middle_name: editFormData.middle_name?.trim() || null,
                      last_name: editFormData.last_name.trim(),
                      suffix: editFormData.suffix?.trim() || null,

                      // Rank and position
                      rank: editSelectedRank,
                      rank_image: editSelectedRankImage,
                      designation: editFormData.designation?.trim() || null,
                      station: editFormData.station?.trim() || null,

                      // Dates
                      birth_date: editFormData.birth_date || null,
                      date_hired: dateHiredValue,
                      hired_at_display: hiredAtTimeValue,

                      // Metadata
                      updated_at: new Date().toISOString(),
                    };

                    console.log("🚀 Sending update:", personnelUpdateData);

                    // Perform the update
                    const { data, error: updateError } = await supabase
                      .from("personnel")
                      .update(personnelUpdateData)
                      .eq("id", editingPerson.id)
                      .select()
                      .single();

                    if (updateError) {
                      console.error("❌ Update error:", updateError);
                      toast.error(`Update failed: ${updateError.message}`);
                      setIsSavingEdit(false);
                      return;
                    }

                    console.log("✅ Update successful:", data);

                    if (editPhotoInputRef.current?.files?.[0]) {
                      try {
                        const file = editPhotoInputRef.current.files[0];
                        // Create personnel data object with current info
                        const personnelDataForUpload = {
                          id: editingPerson.id,
                          first_name: editFormData.first_name.trim(),
                          last_name: editFormData.last_name.trim(),
                          rank: editSelectedRank,
                        };

                        const uploadResult = await uploadImage(
                          file,
                          personnelDataForUpload
                        );

                        if (uploadResult) {
                          await supabase
                            .from("personnel")
                            .update({
                              photo_url: uploadResult.url,
                              photo_path: uploadResult.path,
                            })
                            .eq("id", editingPerson.id);
                        }
                      } catch (photoError) {
                        console.error("Photo error:", photoError);
                      }
                    } else if (isPhotoRemoved) {
                      await supabase
                        .from("personnel")
                        .update({
                          photo_url: null,
                          photo_path: null,
                        })
                        .eq("id", editingPerson.id);
                    }

                    // Handle leave credits
                    const currentYear = new Date().getFullYear();
                    const existingCredits = await loadPersonnelLeaveCredits(
                      editingPerson.id,
                      currentYear
                    );

                    if (
                      existingCredits === null ||
                      parseFloat(editFormData.vacation_balance || 0) !==
                        parseFloat(existingCredits?.vacation_balance || 0) ||
                      parseFloat(editFormData.sick_balance || 0) !==
                        parseFloat(existingCredits?.sick_balance || 0) ||
                      parseFloat(editFormData.emergency_balance || 0) !==
                        parseFloat(existingCredits?.emergency_balance || 0)
                    ) {
                      const leaveData = {
                        personnel_id: editingPerson.id,
                        year: currentYear,
                        vacation_balance:
                          parseFloat(editFormData.vacation_balance) || 0,
                        sick_balance:
                          parseFloat(editFormData.sick_balance) || 0,
                        emergency_balance:
                          parseFloat(editFormData.emergency_balance) || 0,
                        updated_at: new Date().toISOString(),
                      };

                      if (!existingCredits) {
                        leaveData.initial_vacation_credits =
                          parseFloat(editFormData.vacation_balance) || 0;
                        leaveData.initial_sick_credits =
                          parseFloat(editFormData.sick_balance) || 0;
                        leaveData.initial_emergency_credits =
                          parseFloat(editFormData.emergency_balance) || 0;
                        leaveData.vacation_used = 0;
                        leaveData.sick_used = 0;
                        leaveData.emergency_used = 0;
                      }

                      await supabase
                        .from("leave_balances")
                        .upsert([leaveData], {
                          onConflict: "personnel_id,year",
                        });
                    }

                    // Refresh
                    await loadPersonnel(false);

                    toast.success(
                      `✅ ${editFormData.first_name} ${editFormData.last_name} updated successfully!`
                    );

                    setShowEditModal(false);
                    resetEditModal();
                  } catch (error) {
                    console.error("Edit error:", error);
                    toast.error("Update failed");
                  } finally {
                    setIsSavingEdit(false);
                  }
                }}
              >
                <div className={styles.prEditModalLayout}>
                  {/* Photo Section */}
                  <div className={styles.prEditModalPhotoSection}>
                    <div className={styles.prEditModalPhotoPreview}>
                      {editPhotoPreview ? (
                        <img src={editPhotoPreview} alt="Preview" />
                      ) : editingPerson?.photo_url ? (
                        <img src={editingPerson.photo_url} alt="Current" />
                      ) : (
                        <div className={styles.prNoPhotoPreview}>
                          <span className={styles.prNoPhotoIcon}>📷</span>
                          <span>No Photo</span>
                        </div>
                      )}
                    </div>

                    <div className={styles.prEditModalFileUpload}>
                      <label
                        className={styles.prEditModalFileUploadLabel}
                        htmlFor="edit-photo"
                      >
                        <input
                          type="file"
                          id="edit-photo"
                          ref={editPhotoInputRef}
                          accept="image/*"
                          onChange={handleEditPhotoChange}
                          style={{ display: "none" }}
                        />
                        {editPhotoPreview || editingPerson?.photo_url
                          ? "Change Photo"
                          : "Upload Photo"}
                      </label>
                      <span>{EditFileChosen}</span>

                      {(editPhotoPreview || editingPerson?.photo_url) && (
                        <button
                          type="button"
                          className={styles.prEditModalClearBtn}
                          onClick={() => {
                            if (editPhotoPreview) {
                              if (editPhotoPreview.startsWith("blob:")) {
                                URL.revokeObjectURL(editPhotoPreview);
                              }
                              setEditPhotoPreview(null);
                              setEditFileChosen("No new Photo selected");
                              setIsPhotoRemoved(true);
                              if (editPhotoInputRef.current) {
                                editPhotoInputRef.current.value = "";
                              }
                            } else if (editingPerson?.photo_url) {
                              setIsPhotoRemoved(true);
                              setEditPhotoPreview(null);
                              setEditFileChosen("Photo will be removed");
                            }
                          }}
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div style={{ flex: 1 }}>
                    {/* Debug Info */}

                    <div className={styles.prFormRow}>
                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="text"
                            id="edit-badge-number"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.badge_number || ""}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                badge_number: e.target.value,
                              }))
                            }
                          />
                          <label
                            htmlFor="edit-badge-number"
                            className={styles.floatingLabel}
                          >
                            Badge Number
                          </label>
                        </div>
                      </div>

                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <button
                            type="button"
                            id="edit-rank-trigger"
                            className={styles.rankTrigger}
                            onClick={() => setShowEditRankModal(true)}
                          >
                            <div className={styles.selectedRank}>
                              {editSelectedRank ? (
                                <>
                                  <div
                                    className={`${styles.rankIcon} ${editSelectedRank}`}
                                  >
                                    <img
                                      src={editSelectedRankImage}
                                      alt={editSelectedRank}
                                    />
                                  </div>
                                  <span>
                                    {
                                      rankOptions.find(
                                        (r) => r.rank === editSelectedRank
                                      )?.name
                                    }
                                  </span>
                                </>
                              ) : (
                                <span className={styles.placeholder}>
                                  Select Rank *
                                </span>
                              )}
                            </div>
                          </button>
                          <input
                            type="hidden"
                            id="edit-rank"
                            value={editSelectedRank}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.prFormRow}>
                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="text"
                            id="edit-first-name"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.first_name || ""}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                first_name: e.target.value,
                              }))
                            }
                            required
                          />
                          <label
                            htmlFor="edit-first-name"
                            className={styles.floatingLabel}
                          >
                            First Name *
                          </label>
                        </div>
                      </div>

                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="text"
                            id="edit-middle-name"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.middle_name || ""}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                middle_name: e.target.value,
                              }))
                            }
                          />
                          <label
                            htmlFor="edit-middle-name"
                            className={styles.floatingLabel}
                          >
                            Middle Name
                          </label>
                        </div>
                      </div>

                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="text"
                            id="edit-last-name"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.last_name || ""}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                last_name: e.target.value,
                              }))
                            }
                            required
                          />
                          <label
                            htmlFor="edit-last-name"
                            className={styles.floatingLabel}
                          >
                            Last Name *
                          </label>
                        </div>
                      </div>

                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <select
                            id="edit-suffix"
                            className={styles.floatingSelect}
                            value={editFormData.suffix || ""}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                suffix: e.target.value,
                              }))
                            }
                          >
                            {suffixOptions.map((suffix) => (
                              <option key={suffix} value={suffix}>
                                {suffix || "Suffix (Optional)"}
                              </option>
                            ))}
                          </select>
                          <label
                            htmlFor="edit-suffix"
                            className={styles.floatingLabel}
                          >
                            Suffix
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className={styles.prFormRow}>
                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="text"
                            id="edit-designation"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.designation || ""}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                designation: e.target.value,
                              }))
                            }
                          />
                          <label
                            htmlFor="edit-designation"
                            className={styles.floatingLabel}
                          >
                            Designation
                          </label>
                        </div>
                      </div>

                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="text"
                            id="edit-station"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.station || ""}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                station: e.target.value,
                              }))
                            }
                          />
                          <label
                            htmlFor="edit-station"
                            className={styles.floatingLabel}
                          >
                            Station Assignment
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className={styles.prFormRow}>
                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="date"
                            id="edit-birth-date"
                            className={styles.floatingInput}
                            value={editFormData.birth_date || ""}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                birth_date: e.target.value,
                              }))
                            }
                          />
                          <label
                            htmlFor="edit-birth-date"
                            className={styles.floatingLabel}
                          >
                            Birth Date
                          </label>
                        </div>
                      </div>
                      {/* In the edit modal form */}
                      <div className={styles.prFormRow}>
                        <div className={styles.prFormGroup}>
                          <div className={styles.floatingGroup}>
                            <input
                              type="date"
                              id="edit-date-hired"
                              className={styles.floatingInput}
                              value={editFormData.date_hired || ""}
                              onChange={(e) =>
                                setEditFormData((prev) => ({
                                  ...prev,
                                  date_hired: e.target.value,
                                }))
                              }
                            />
                            <label
                              htmlFor="edit-date-hired"
                              className={styles.floatingLabel}
                            >
                              Date Hired
                            </label>
                          </div>
                        </div>

                        <div className={styles.prFormGroup}>
                          <div className={styles.floatingGroup}>
                            <input
                              type="time"
                              id="edit-time-hired"
                              className={styles.floatingInput}
                              value={editFormData.hired_time || "08:00"}
                              onChange={(e) =>
                                setEditFormData((prev) => ({
                                  ...prev,
                                  hired_time: e.target.value,
                                }))
                              }
                              step="300" // 5-minute increments
                            />
                            <label
                              htmlFor="edit-time-hired"
                              className={styles.floatingLabel}
                            >
                              Time Hired
                            </label>
                            {editFormData.hired_time && (
                              <div className={styles.timeDisplay}>
                                <small>
                                  {formatTimeToAMPM(editFormData.hired_time)}
                                </small>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Leave Credits - Already in your edit modal, just update step attribute */}
                    <div className={styles.prFormRow}>
                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="number"
                            id="edit-vacation-balance"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.vacation_balance || 0}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                vacation_balance:
                                  parseFloat(e.target.value) || 0,
                              }))
                            }
                            min="0"
                            max="999.99"
                            step="0.01"
                          />
                          <label
                            htmlFor="edit-vacation-balance"
                            className={styles.floatingLabel}
                          >
                            Vacation Leave
                          </label>
                          <span className={styles.leaveCreditUnit}>days</span>
                        </div>
                      </div>

                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="number"
                            id="edit-sick-balance"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.sick_balance || 0}
                            onChange={(e) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                sick_balance: parseFloat(e.target.value) || 0,
                              }))
                            }
                            min="0"
                            max="999.99"
                            step="0.01"
                          />
                          <label
                            htmlFor="edit-sick-balance"
                            className={styles.floatingLabel}
                          >
                            Sick Leave
                          </label>
                          <span className={styles.leaveCreditUnit}>days</span>
                        </div>
                      </div>

                      <div className={styles.prFormGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="number"
                            id="edit-emergency-balance"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.emergency_balance || 0}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              // Prevent increasing if already at max
                              if (emergencyMaxReached && newValue > 5) {
                                toast.warning(
                                  "Emergency leave cannot exceed 5 days"
                                );
                                return;
                              }
                              setEditFormData((prev) => ({
                                ...prev,
                                emergency_balance: newValue,
                              }));
                            }}
                            min="0"
                            max="5"
                            step="0.01"
                            disabled={emergencyMaxReached}
                            title={
                              emergencyMaxReached
                                ? "Emergency leave already at maximum (5 days)"
                                : ""
                            }
                          />
                          <label
                            htmlFor="edit-emergency-balance"
                            className={styles.floatingLabel}
                          >
                            Emergency Leave
                            {emergencyMaxReached && (
                              <span
                                className={styles.maxLimitIndicator}
                                title="Maximum reached"
                              >
                                (Max: 5)
                              </span>
                            )}
                          </label>
                          <span className={styles.leaveCreditUnit}>days</span>
                          {emergencyMaxReached && (
                            <div className={styles.maxLimitMessage}>
                              <small>Maximum of 5 days reached</small>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={styles.prFormActions}>
                      <button
                        type="button"
                        className={styles.prCancel}
                        onClick={handleCloseEditModal}
                        disabled={isSavingEdit}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={`${styles.prSubmit} ${
                          isSavingEdit ? styles.prSubmitLoading : ""
                        }`}
                        disabled={isSavingEdit}
                      >
                        {isSavingEdit ? (
                          <>
                            <span className={styles.editSaveSpinner}></span>
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Rank Modal */}
        {showEditRankModal && (
          <div
            className={`${styles.rankModal} ${styles.show} ${
              isSidebarCollapsed ? styles.sidebarCollapsed : ""
            }`}
          >
            <div
              className={`${styles.rankModalContent} ${
                isSidebarCollapsed ? styles.rankModalContentCollapsed : ""
              }`}
            >
              <div className={styles.rankModalHeader}>
                <h2>Select Rank</h2>
                <button
                  className={styles.rankModalClose}
                  onClick={() => setShowEditRankModal(false)}
                >
                  &times;
                </button>
              </div>
              <div className={styles.rankOptions}>
                {rankOptions.map((option) => (
                  <div
                    key={option.rank}
                    className={`${styles.rankOption} ${option.rank} ${
                      editSelectedRank === option.rank ? styles.selected : ""
                    }`}
                    onClick={() => selectEditRank(option.rank, option.image)}
                  >
                    <div className={styles.rankIcon}>
                      <img src={option.image} alt={option.rank} />
                    </div>
                    <div className={styles.rankName}>{option.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Edit Rank Modal */}
        {showEditRankModal && (
          <div
            className={`${styles.rankModal} ${styles.show} ${
              isSidebarCollapsed ? styles.sidebarCollapsed : ""
            }`}
          >
            <div
              className={`${styles.rankModalContent} ${
                isSidebarCollapsed ? styles.rankModalContentCollapsed : ""
              }`}
            >
              <div className={styles.rankModalHeader}>
                <h2>Select Rank</h2>
                <button
                  className={styles.rankModalClose}
                  onClick={() => setShowEditRankModal(false)}
                >
                  &times;
                </button>
              </div>
              <div className={styles.rankOptions}>
                {rankOptions.map((option) => (
                  <div
                    key={option.rank}
                    className={`${styles.rankOption} ${option.rank} ${
                      editSelectedRank === option.rank ? styles.selected : ""
                    }`}
                    onClick={() => selectEditRank(option.rank, option.image)}
                  >
                    <div className={styles.rankIcon}>
                      <img src={option.image} alt={option.rank} />
                    </div>
                    <div className={styles.rankName}>{option.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Rank Modal */}
        {showRankModal && (
          <div
            id="rankModal"
            className={`${styles.rankModal} ${styles.show} ${
              isSidebarCollapsed ? styles.sidebarCollapsed : ""
            }`}
          >
            <div
              className={`${styles.rankModalContent} ${
                isSidebarCollapsed ? styles.rankModalContentCollapsed : ""
              }`}
            >
              <div className={styles.rankModalHeader}>
                <h2>Select Rank</h2>
                <button
                  className={styles.rankModalClose}
                  onClick={() => setShowRankModal(false)}
                >
                  &times;
                </button>
              </div>
              <div className={styles.rankOptions}>
                {rankOptions.map((option) => (
                  <div
                    key={option.rank}
                    className={`${styles.rankOption} ${option.rank} ${
                      selectedRank === option.rank ? styles.selected : ""
                    }`}
                    onClick={() => selectRank(option.rank, option.image)}
                  >
                    <div className={styles.rankIcon}>
                      <img src={option.image} alt={option.rank} />
                    </div>
                    <div className={styles.rankName}>{option.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showLeaveModal && (
          <div className={styles.smallModalOverlay}>
            <div className={styles.smallModalContent}>
              <div className={styles.smallModalHeader}>
                <h3>Set Initial Leave Credits</h3>
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className={styles.smallModalClose}
                >
                  &times;
                </button>
              </div>

              <div className={styles.smallModalBody}>
                <div className={styles.leaveInputGroup}>
                  <label>
                    <span className={styles.leaveIcon}>🏖️</span>
                    Vacation Leave
                  </label>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      min="0"
                      max="999.99"
                      step="0.5"
                      value={formData.vacation_balance || 0}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          vacation_balance: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0.00"
                    />
                    <span className={styles.unitText}>days</span>
                  </div>
                </div>

                <div className={styles.leaveInputGroup}>
                  <label>
                    <span className={styles.leaveIcon}>🏥</span>
                    Sick Leave
                  </label>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      min="0"
                      max="999.99"
                      step="0.5"
                      value={formData.sick_balance || 0}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sick_balance: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0.00"
                    />
                    <span className={styles.unitText}>days</span>
                  </div>
                </div>

                <div className={styles.leaveInputGroup}>
                  <label>
                    <span className={styles.leaveIcon}>🚨</span>
                    Emergency Leave
                  </label>
                  <div className={styles.inputWithUnit}>
                    <input
                      type="number"
                      min="0"
                      max="999.99"
                      step="0.5"
                      value={formData.emergency_balance || 0}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          emergency_balance: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0.00"
                    />
                    <span className={styles.unitText}>days</span>
                  </div>
                </div>

                <div className={styles.leaveSummary}>
                  <div className={styles.summaryRow}>
                    <span>Vacation:</span>
                    <strong>{formData.vacation_balance || 0} days</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Sick:</span>
                    <strong>{formData.sick_balance || 0} days</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Emergency:</span>
                    <strong>{formData.emergency_balance || 0} days</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Total:</span>
                    <strong className={styles.totalDays}>
                      {(parseFloat(formData.vacation_balance) || 0) +
                        (parseFloat(formData.sick_balance) || 0) +
                        (parseFloat(formData.emergency_balance) || 0)}{" "}
                      days
                    </strong>
                  </div>
                </div>

                <div className={styles.leaveNote}>
                  <small>
                    These are initial leave credits for the current year. You
                    can adjust them later in the personnel list.
                  </small>
                </div>
              </div>

              <div className={styles.smallModalFooter}>
                <button
                  type="button"
                  className={styles.btnCancel}
                  onClick={() => setShowLeaveModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.btnSave}
                  onClick={() => {
                    if (validateLeaveCredits()) {
                      setShowLeaveModal(false);
                      toast.success("Leave credits saved to form");
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Delete Modal */}
        {showDeleteConfirm && (
          <div
            className={`${styles.preModalDelete} ${
              isSidebarCollapsed ? styles.sidebarCollapsed : ""
            }`}
            style={{ display: "flex" }}
          >
            <div
              className={`${styles.preModalContentDelete} ${
                isSidebarCollapsed ? styles.deleteModalContentCollapsed : ""
              }`}
              style={{ maxWidth: "450px" }}
            >
              <div className={styles.preModalHeaderDelete}>
                <h2 style={{ marginLeft: "30px" }}>Confirm Deletion</h2>
                <span className={styles.preCloseBtn} onClick={cancelDelete}>
                  &times;
                </span>
              </div>

              <div className={styles.preModalBody}>
                <div className={styles.deleteConfirmationContent}>
                  <div className={styles.deleteWarningIcon}>⚠️</div>
                  <p className={styles.deleteConfirmationText}>
                    Are you sure you want to delete the personnel record for
                  </p>
                  <p className={styles.documentNameHighlight}>
                    "{deleteName}"?
                  </p>
                  <p className={styles.deleteWarning}>
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className={styles.preModalActions}>
                <button
                  className={`${styles.preBtn} ${styles.preCancelBtn}`}
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.preBtn} ${styles.deleteConfirmBtn} ${
                    isDeleting ? styles.deleteConfirmBtnLoading : ""
                  }`}
                  onClick={confirmDeletePersonnel}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <span className={styles.deleteSpinner}></span>
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  export default PersonnelRegister;
