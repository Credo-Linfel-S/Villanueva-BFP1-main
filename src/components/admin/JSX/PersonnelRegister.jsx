import React, { useState, useEffect, useRef } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaCopy,
  FaCheck,
  FaDownload,
  FaFilter,
} from "react-icons/fa";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSidebar } from "../../SidebarContext.jsx";

import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import styles from "../styles/PersonnelRegister.module.css";
import BFPPreloader from "../../BFPPreloader.jsx";

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
  const [EditFileChosen, setEditFileChosen] = useState("No new Photo selected");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const formRef = useRef(null);
  // Add this to your existing state declarations
  const [showSetLeaveCreditsModal, setShowSetLeaveCreditsModal] =
    useState(false);
  const [editingLeavePersonnel, setEditingLeavePersonnel] = useState(null);

  // ========== FILTER STATES (ADDED) ==========
  const [search, setSearch] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [filterStation, setFilterStation] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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
    if (personnel && personnel.length > 0) {
      console.log("Personnel data updated, checking lock status...");
      loadAllPersonnelLockStatus();
    } else {
      setLockedPersonnel({});
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
    retirement_date: "",
  });

  const applyFilters = (items) => {
    // Add null check
    if (!items || !Array.isArray(items)) {
      return [];
    }

    let filtered = [...items];

    // Search filter - only searches name, rank, station, and badge
    const searchTerm = search.trim().toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter((person) => {
        // Add person null check
        if (!person) return false;

        // Create searchable text from only the fields we want
        const searchText = `
        ${person.first_name || ""} 
        ${person.middle_name || ""} 
        ${person.last_name || ""}
        ${person.rank || ""}
        ${person.station || ""}
        ${person.badge_number || ""}
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
    setCurrentPage(1);
  };

  const getUniqueStations = () => {
    const stations = new Set();

    // Add null check here
    if (!personnel || !Array.isArray(personnel)) {
      return [];
    }

    personnel.forEach((person) => {
      if (person && person.station) {
        stations.add(person.station);
      }
    });

    return Array.from(stations).sort();
  };
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
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date =
        dateString instanceof Date ? dateString : new Date(dateString);
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
      const date =
        dateString instanceof Date ? dateString : new Date(dateString);
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
    suffix: "", // ADDED
    designation: "",
    station: "",
    birth_date: "",
    date_hired: "",
    retirement_date: "",
  });

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

      // Only select fields you need, excluding any potential base64 fields
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
        retirement_date,
        photo_url,
        photo_path,
        created_at,
        updated_at
      `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      const personnelData = Array.isArray(data) ? data : [];
      console.log(`📊 Loaded ${personnelData.length} records`);

      // Process personnel - generate fresh URLs from photo_path
      const processedPersonnel = personnelData.map((person) => {
        let photoUrl = person.photo_url;

        // Always generate fresh URL from path if available
        if (person.photo_path && typeof person.photo_path === "string") {
          try {
            const cleanPath = person.photo_path.replace(/^\/+/, "").trim();
            const { data: urlData } = supabase.storage
              .from("leave-documents")
              .getPublicUrl(cleanPath);

            if (urlData?.publicUrl) {
              photoUrl = urlData.publicUrl;
            }
          } catch (error) {
            console.error(`Error generating URL for ${person.id}:`, error);
          }
        }

        // Clean any Base64 URLs that might still exist
        if (
          photoUrl &&
          (photoUrl.includes("base64") || photoUrl.startsWith("data:image/"))
        ) {
          console.warn(
            `⚠️ Found Base64 URL for ${person.first_name} ${person.last_name}, clearing it`
          );
          photoUrl = null;
        }

        return {
          ...person,
          photo_url: photoUrl,
          // Ensure no base64 field exists
          photo_base64: undefined,
        };
      });

      console.log("✅ Processed personnel without Base64");
      console.log("Sample personnel:", {
        first: processedPersonnel[0]?.first_name,
        has_photo: !!processedPersonnel[0]?.photo_url,
        photo_type: processedPersonnel[0]?.photo_url?.substring(0, 50),
      });

      setPersonnel(processedPersonnel);
      setFilteredPersonnel(processedPersonnel);

      if (showLoading) {
        toast.success(`Loaded ${personnelData.length} personnel records`);
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

  // Then update your handlePhotoChange and handleEditPhotoChange:
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Validate and process the image
        const processedFile = await validateAndProcessImage(file);

        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotoPreview(e.target.result);
        };
        reader.readAsDataURL(processedFile);

        // Replace the original file with processed one
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(processedFile);
        photoInputRef.current.files = dataTransfer.files;

        setFileChosen(processedFile.name);
      } catch (error) {
        console.error("❌ Image processing error:", error);
        toast.error(`Invalid image: ${error.message}`);
        clearPhoto();
      }
    } else {
      setFileChosen("No Photo selected");
    }
  };
  const uploadImage = async (file, personnelId) => {
    try {
      console.log("📤 Uploading photo to leave-documents bucket...", {
        name: file.name,
        type: file.type,
        size: (file.size / 1024).toFixed(2) + "KB",
        personnelId: personnelId,
      });

      // Validate personnelId
      if (!personnelId) {
        console.error("❌ No personnelId provided for photo upload");
        toast.error("Cannot upload photo: Personnel ID is missing");
        return null;
      }

      // Basic validation
      if (!file || !file.type.startsWith("image/")) {
        toast.error("Please select a valid image file");
        return null;
      }

      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        toast.error("Image must be less than 10MB");
        return null;
      }

      // Create folder structure: leave-documents/personnel/{personnelId}/
      const fileExt = file.name.split(".").pop().toLowerCase();
      const timestamp = Date.now();
      const fileName = `photo_${timestamp}.${fileExt}`;
      const filePath = `personnel/${personnelId}/${fileName}`;

      console.log("📁 Upload path:", filePath);

      // Upload to Supabase Storage bucket "leave-documents"
      const { data, error } = await supabase.storage
        .from("leave-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error("❌ Upload error:", error.message);

        // If file exists, add random string
        if (error.message.includes("already exists")) {
          const randomStr = Math.random().toString(36).substring(2, 8);
          const newFileName = `photo_${timestamp}_${randomStr}.${fileExt}`;
          const newFilePath = `personnel/${personnelId}/${newFileName}`;

          const { data: retryData, error: retryError } = await supabase.storage
            .from("leave-documents")
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
            .from("leave-documents")
            .getPublicUrl(retryData.path);

          return {
            url: urlData.publicUrl,
            path: retryData.path,
          };
        }

        toast.error(`Upload failed: ${error.message}`);
        return null;
      }

      console.log("✅ Upload successful:", data.path);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("leave-documents")
        .getPublicUrl(data.path);

      return {
        url: urlData.publicUrl,
        path: data.path,
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
      <div className={`${styles.paginationContainer} ${styles.topPagination}`}>
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

  const handleEditPhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Check file size
        if (file.size > 2 * 1024 * 1024) {
          // 2MB limit
          toast.warning(
            "Image is too large. Please select an image under 2MB."
          );
          return;
        }

        // Compress image before converting to Base64
        const compressedBase64 = await compressImageToBase64(file, 800, 0.7); // Max 800px, 70% quality

        setEditPhotoPreview(compressedBase64);
        setEditFileChosen(file.name);

        // Store original file for backup
        if (editPhotoInputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          editPhotoInputRef.current.files = dataTransfer.files;
        }

        console.log("✅ Photo compressed:", {
          original: (file.size / 1024).toFixed(0) + "KB",
          compressed: (compressedBase64.length / 1024).toFixed(0) + "KB",
          reduction:
            Math.round((1 - compressedBase64.length / file.size) * 100) + "%",
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
              compressedReader.onload = () => resolve(compressedReader.result);
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
    setPhotoPreview(null);
    setFileChosen("No Photo selected");
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const clearEditPhoto = () => {
    setEditPhotoPreview(null);
    setEditFileChosen("No new Photo selected");
    setIsPhotoRemoved(true);
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = "";
    }
  };

  // Function to load leave credits for a personnel
  const loadPersonnelLeaveCredits = async (personnelId, year = null) => {
    try {
      const query = supabase
        .from("leave_balances")
        .select("*")
        .eq("personnel_id", personnelId);

      if (year) {
        query.eq("year", year);
      } else {
        // Get current year's balance by default
        query.eq("year", new Date().getFullYear());
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading leave credits:", error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error("Error in loadPersonnelLeaveCredits:", error);
      return null;
    }
  };
  // Add this function right after your component declaration

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsRegistering(true);
      setError("");

      // Validation
      if (!formData.first_name?.trim() || !formData.last_name?.trim()) {
        toast.error("First name and last name are required!");
        setIsRegistering(false);
        return;
      }

      if (!selectedRank) {
        toast.error("Please select a rank!");
        setIsRegistering(false);
        return;
      }

      // Generate username and password
      const username = generatedUsername;
      const password = generatedPassword;

      // Show loading toast
      const loadingToastId = toast.loading("Registering personnel...", {
        position: "top-right",
        autoClose: false,
      });

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
        birth_date: formData.birth_date
          ? new Date(formData.birth_date).toISOString()
          : null,
        date_hired: formData.date_hired
          ? new Date(formData.date_hired).toISOString()
          : null,
        retirement_date: formData.retirement_date
          ? new Date(formData.retirement_date).toISOString()
          : null,
      };

      console.log("📝 Creating personnel record...");

      // First, create personnel record to get ID
      const { data: personnelData, error: insertError } = await supabase
        .from("personnel")
        .insert([personnelDataToInsert])
        .select()
        .single(); // Use .single() to get one record

      if (insertError) {
        console.error("❌ Error creating personnel:", insertError);
        toast.update(loadingToastId, {
          render: `Failed to create personnel record: ${insertError.message}`,
          type: "error",
          isLoading: false,
          autoClose: 5000,
        });
        setIsRegistering(false);
        return;
      }

      console.log("✅ Personnel created:", personnelData);

      // Handle photo upload if exists
      if (photoInputRef.current?.files?.[0]) {
        try {
          toast.update(loadingToastId, {
            render: "Uploading photo...",
            type: "info",
            isLoading: true,
          });

          const file = photoInputRef.current.files[0];

          // Now upload photo with personnel ID
          const uploadResult = await uploadImage(file, personnelData.id);

          if (uploadResult) {
            // Update personnel record with photo info
            const { error: updateError } = await supabase
              .from("personnel")
              .update({
                photo_url: uploadResult.url,
                photo_path: uploadResult.path,
              })
              .eq("id", personnelData.id);

            if (updateError) {
              console.warn("Could not update photo info:", updateError);
              toast.warning(
                "Personnel created but photo info could not be saved"
              );
            } else {
              console.log("✅ Photo info saved");
            }
          }
        } catch (error) {
          // In your handleSubmit catch block
          console.error("❌ Error in handleSubmit:", error);
          console.error("Error details:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
          });

          if (error.message.includes("Cannot read properties of null")) {
            console.error("personnelData was null. Form data:", {
              formData,
              hasFile: !!photoInputRef.current?.files?.[0],
            });

            // Check database connection
            const { data: testData, error: testError } = await supabase
              .from("personnel")
              .select("count")
              .limit(1);

            console.log("Database connection test:", { testData, testError });
          }

          toast.error("An unexpected error occurred. Please try again.");
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
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSavingEdit(true);
      setError("");

      if (!editingPerson || !editingPerson.id) {
        toast.error("Invalid personnel record. Cannot update.");
        setIsSavingEdit(false);
        return;
      }

      const loadingToastId = toast.loading("Updating personnel...", {
        position: "top-right",
        autoClose: false,
      });

      // Handle photo updates
      let photoUrl = editingPerson.photo_url;
      let photoPath = editingPerson.photo_path;

      // Case 1: New photo uploaded
      if (editPhotoInputRef.current?.files?.[0]) {
        const file = editPhotoInputRef.current.files[0];

        toast.update(loadingToastId, {
          render: "Uploading new photo...",
          type: "info",
          isLoading: true,
        });

        // Delete old photo if exists
        if (editingPerson.photo_path) {
          try {
            const { error: deleteError } = await supabase.storage
              .from("leave-documents")
              .remove([editingPerson.photo_path]);

            if (deleteError) {
              console.warn("Could not delete old photo:", deleteError);
            }
          } catch (deleteError) {
            console.warn("Error deleting old photo:", deleteError);
          }
        }

        // Upload new photo
        const uploadResult = await uploadImage(file, editingPerson.id);
        if (uploadResult) {
          photoUrl = uploadResult.url;
          photoPath = uploadResult.path;
        }
      }
      // Case 2: Photo removed
      else if (isPhotoRemoved) {
        // Delete photo from storage
        if (editingPerson.photo_path) {
          try {
            const { error: deleteError } = await supabase.storage
              .from("leave-documents")
              .remove([editingPerson.photo_path]);

            if (deleteError) {
              console.warn("Could not delete photo:", deleteError);
            }
          } catch (deleteError) {
            console.warn("Error deleting photo:", deleteError);
          }
        }
        photoUrl = null;
        photoPath = null;
      }

      // Prepare update data - NEVER include base64
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
        birth_date: editFormData.birth_date
          ? new Date(editFormData.birth_date).toISOString()
          : null,
        date_hired: editFormData.date_hired
          ? new Date(editFormData.date_hired).toISOString()
          : null,
        retirement_date: editFormData.retirement_date
          ? new Date(editFormData.retirement_date).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      };

      // Only add photo fields if changed
      if (editPhotoInputRef.current?.files?.[0] || isPhotoRemoved) {
        updateData.photo_url = photoUrl;
        updateData.photo_path = photoPath;
      }

      // IMPORTANT: Ensure no base64 field is sent
      delete updateData.photo_base64;

      console.log("📝 Updating personnel with:", updateData);

      // Update personnel record
      const { error: updateError } = await supabase
        .from("personnel")
        .update(updateData)
        .eq("id", editingPerson.id);

      if (updateError) {
        console.error("❌ Update error:", updateError);
        toast.update(loadingToastId, {
          render: `Failed to update: ${updateError.message}`,
          type: "error",
          isLoading: false,
          autoClose: 5000,
        });
        setIsSavingEdit(false);
        return;
      }

      // Success
      await loadPersonnel(false);
      setShowEditModal(false);
      resetEditModal();

      toast.update(loadingToastId, {
        render: `✅ ${editFormData.first_name} ${editFormData.last_name} updated successfully!`,
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });
    } catch (error) {
      console.error("❌ Error in handleEditSubmit:", error);
      toast.error("An unexpected error occurred during update.");
    } finally {
      setIsSavingEdit(false);
    }
  };
  // Add this helper function to reset edit modal
  const resetEditModal = () => {
    setEditingPerson(null);
    setEditPhotoPreview(null);
    setEditFileChosen("No new Photo selected");
    setIsPhotoRemoved(false);
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

      // Check if personnel is locked
      if (lockedPersonnel[person.id]?.isLocked) {
        toast.warning(`Cannot edit: ${lockedPersonnel[person.id]?.lockReason}`);
        return;
      }

      console.log("Opening edit for personnel:", person);

      setEditingPerson(person);
      setEditFormData({
        badge_number: person.badge_number || "",
        first_name: person.first_name || "",
        middle_name: person.middle_name || "",
        last_name: person.last_name || "",
        suffix: person.suffix || "",
        designation: person.designation || "",
        station: person.station || "",
        birth_date: formatDateForInput(person.birth_date),
        date_hired: formatDateForInput(person.date_hired),
        retirement_date: formatDateForInput(person.retirement_date),
      });
      setEditSelectedRank(person.rank || "");
      setEditSelectedRankImage(person.rank_image || "");

      // Set existing photo preview from URL only
      if (person.photo_url) {
        setEditPhotoPreview(person.photo_url);
        setEditFileChosen("Current photo (click to change)");
      } else {
        setEditPhotoPreview(null);
        setEditFileChosen("No new Photo selected");
      }

      setIsPhotoRemoved(false);

      setShowEditModal(true);
    } catch (error) {
      console.error("Error opening edit:", error);
      setError("Failed to load personnel data for editing.");
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
      retirement_date: "",
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
        toast.error(`Cannot delete: ${lockedPersonnel[deleteId]?.lockReason}`);
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

  const PhotoCell = ({ photoUrl, photoPath, alt = "Personnel Photo" }) => {
    const [imgSrc, setImgSrc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
      console.log("🖼️ PhotoCell rendering with:", {
        hasUrl: !!photoUrl,
        hasPath: !!photoPath,
      });

      // Generate URL from path if we have one
      let finalUrl = photoUrl;

      if (!finalUrl && photoPath && typeof photoPath === "string") {
        try {
          const cleanPath = photoPath.replace(/^\/+/, "").trim();
          const { data: urlData } = supabase.storage
            .from("leave-documents")
            .getPublicUrl(cleanPath);

          if (urlData?.publicUrl) {
            finalUrl = urlData.publicUrl;
          }
        } catch (error) {
          console.error("Error generating URL:", error);
        }
      }

      // Clean any Base64 URLs
      if (
        finalUrl &&
        (finalUrl.includes("base64") || finalUrl.startsWith("data:image/"))
      ) {
        console.warn("⚠️ Ignoring Base64 URL");
        finalUrl = null;
      }

      if (finalUrl) {
        // Add cache busting
        const cacheBustedUrl =
          finalUrl + (finalUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
        console.log("🔗 Using URL:", cacheBustedUrl.substring(0, 80));

        // Test if image loads
        const img = new Image();
        img.onload = () => {
          console.log("✅ Image valid");
          setImgSrc(cacheBustedUrl);
          setLoading(false);
        };
        img.onerror = () => {
          console.warn("❌ Image failed to load");
          setError(true);
          setLoading(false);
        };
        img.src = cacheBustedUrl;
      } else {
        console.log("📭 No valid photo source");
        setLoading(false);
      }
    }, [photoUrl, photoPath]);

    if (loading) {
      return (
        <td className={styles.prPhotoCell}>
          <div className={styles.prPhotoContainer}>
            <div className={styles.prNoPhotoContainer}>
              <span className={styles.prNoPhotoIcon}>⏳</span>
              <span className={styles.prNoPhotoText}>Loading...</span>
            </div>
          </div>
        </td>
      );
    }

    if (error || !imgSrc) {
      return (
        <td className={styles.prPhotoCell}>
          <div className={styles.prPhotoContainer}>
            <div className={styles.prNoPhotoContainer}>
              <span className={styles.prNoPhotoIcon}>📷</span>
              <span className={styles.prNoPhotoText}>No Photo</span>
            </div>
          </div>
        </td>
      );
    }

    return (
      <td className={styles.prPhotoCell}>
        <div className={styles.prPhotoContainer}>
          <img
            src={imgSrc}
            className={styles.prPhotoThumb}
            alt={alt}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "6px",
              backgroundColor: "#f5f5f5",
            }}
            onLoad={() => console.log("🖼️ Image loaded successfully")}
            onError={(e) => {
              console.error("❌ Failed to load image");
              e.target.style.display = "none";
              const container = e.target.parentElement;
              if (container) {
                container.innerHTML = `
                <div style="
                  width: 100%;
                  height: 100%;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  background: #f5f5f5;
                  border-radius: 6px;
                  padding: 10px;
                  text-align: center;
                ">
                  <div style="font-size: 24px; margin-bottom: 5px;">⚠️</div>
                  <div style="font-size: 11px; color: #666;">Image failed to load</div>
                </div>
              `;
              }
            }}
          />
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
      if (showRankModal && event.target.classList.contains(styles.rankModal)) {
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

  // Get current personnel for display
  const currentPersonnel = paginate(
    filteredPersonnel,
    currentPage,
    rowsPerPage
  );

  return (
    <div className={styles.prContainer}>
      <Title>Personnel Register | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
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
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
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
                              <img src={selectedRankImage} alt={selectedRank} />
                            </div>
                            <span>
                              {
                                rankOptions.find((r) => r.rank === selectedRank)
                                  ?.name
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
                    <label htmlFor="last-name" className={styles.floatingLabel}>
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

              <div className={styles.prFormRow}>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <Flatpickr
                      value={formData.birth_date}
                      onChange={([date]) =>
                        setFormData((prev) => ({ ...prev, birth_date: date }))
                      }
                      options={{ dateFormat: "Y-m-d", maxDate: "today" }}
                      className={styles.floatingInput}
                      placeholder=" "
                    />
                    <label
                      htmlFor="birth-date"
                      className={styles.floatingLabel}
                    >
                      Birth Date
                    </label>
                  </div>
                </div>
                <div className={styles.prFormGroup}>
                  <div className={styles.floatingGroup}>
                    <Flatpickr
                      value={formData.date_hired}
                      onChange={([date]) =>
                        setFormData((prev) => ({ ...prev, date_hired: date }))
                      }
                      options={{ dateFormat: "Y-m-d", maxDate: "today" }}
                      className={styles.floatingInput}
                      placeholder=" "
                    />
                    <label
                      htmlFor="date-hired"
                      className={styles.floatingLabel}
                    >
                      Date Hired
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.prDateValidationNote}>
                <small>Note: Birth Date ≤ Date Hired ≤ Retirement Date</small>
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
                <th>Rank</th>
                <th>Badge No.</th>
                <th>First</th>
                <th>Middle</th>
                <th>Last</th>
                <th>Suffix</th>
                <th>Designation</th>
                <th>Station</th>
                <th>Birth Date</th>
                <th>Date Hired</th>
                <th>Retirement</th>
                <th>Username</th>
                <th>Password</th>
                <th>Photo temp. disabled</th>
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
                      {search || filterRank || filterStation
                        ? "No Personnel Found Matching Filters"
                        : "No Personnel Registered"}
                    </h3>
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      {search || filterRank || filterStation
                        ? "Try adjusting your search or filter criteria"
                        : "BFP personnel register is empty - add your first team member"}
                    </p>
                  </td>
                </tr>
              ) : (
                currentPersonnel.map((person) => {
                  if (!person) return null;
                  return (
                    <tr key={person.id}>
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
                      <td>{formatDate(person.date_hired)}</td>
                      <td>{formatDate(person.retirement_date)}</td>
                      <td>{person.username}</td>
                      <PasswordCell password={person.password} />

                      <PhotoCell
                        photoUrl={person.photo_url}
                        photoPath={person.photo_path}
                        alt={`${person.first_name} ${person.last_name}`}
                      />
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
                            className={`${styles.prLeaveCreditsBtn} ${
                              lockedPersonnel[person.id]?.isLocked
                                ? styles.disabled
                                : ""
                            }`}
                            onClick={() => {
                              if (lockedPersonnel[person.id]?.isLocked) {
                                toast.warning(
                                  `Cannot set leave credits: ${
                                    lockedPersonnel[person.id]?.lockReason
                                  }`
                                );
                              } else {
                                openSetLeaveCreditsModal(person);
                              }
                            }}
                            disabled={lockedPersonnel[person.id]?.isLocked}
                            title="Set Leave Credits"
                          >
                            <span style={{ marginRight: "4px" }}>📋</span>
                            Set Leave
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
        {/* ========== BOTTOM PAGINATION ========== */}
        <div className={styles.prBottomPagination}>
          {renderPaginationButtons()}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div
          id="editModal"
          className={`${styles.modal} ${styles.show} main-content ${
            isSidebarCollapsed ? styles.sidebarCollapsed : ""
          }`}
        >
          <div
            className={`${styles.modalContent} ${
              isSidebarCollapsed ? styles.modalContentCollapsed : ""
            }`}
          >
            <div className={styles.modalHeader}>
              <h2>Edit Personnel</h2>
              <button
                onClick={handleCloseEditModal}
                className={styles.ShowEditModalCloseBtn}
              >
                &times;
              </button>
            </div>

            <div className={styles.prEditModalLayout}>
              <div className={styles.prEditModalPhotoSection}>
                <div className={styles.prEditModalPhotoSection}>
                  {/* In your edit modal JSX */}
                  <div className={styles.prEditModalPhotoPreview}>
                    {editPhotoPreview ? (
                      <img
                        src={editPhotoPreview}
                        alt="Photo Preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : editingPerson?.photo_base64 ? (
                      <img
                        src={editingPerson.photo_base64}
                        alt="Current Photo"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : editingPerson?.photo_url ? (
                      <img
                        src={editingPerson.photo_url}
                        alt="Current Photo"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                        onError={(e) => {
                          console.log(
                            "Failed to load URL photo, showing placeholder"
                          );
                          e.target.style.display = "none";
                          // You could show a fallback here
                        }}
                      />
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
                    <span className={styles.prEditFileInfo}>
                      {EditFileChosen}
                    </span>
                    {(editPhotoPreview || editingPerson?.photo_url) && (
                      <button
                        type="button"
                        className={styles.prClearPhotoBtn}
                        onClick={clearEditPhoto}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className={styles.prPhotoInstructions}>
                    <small>Max size: 5MB • JPG, PNG, GIF, WebP</small>
                  </div>
                </div>
              </div>

              <form id="edit-form" onSubmit={handleEditSubmit}>
                <input type="hidden" id="edit-id" value={editingPerson?.id} />

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-badge">Badge Number</label>
                    <input
                      type="text"
                      id="edit-badge"
                      value={editFormData.badge_number}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          badge_number: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-rank">Rank</label>
                    <div className={styles.prEditRankGroup}>
                      <button
                        type="button"
                        id="edit-rank-trigger"
                        className={styles.prEditRankTrigger}
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
                              Select Rank
                            </span>
                          )}
                        </div>
                      </button>
                      <input
                        type="hidden"
                        id="edit-rank"
                        value={editSelectedRank}
                      />
                      <input
                        type="hidden"
                        id="edit-rank-image"
                        value={editSelectedRankImage}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-first">First Name *</label>
                    <input
                      type="text"
                      id="edit-first"
                      value={editFormData.first_name}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-middle">Middle Name</label>
                    <input
                      type="text"
                      id="edit-middle"
                      value={editFormData.middle_name}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          middle_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-last">Last Name *</label>
                    <input
                      type="text"
                      id="edit-last"
                      value={editFormData.last_name}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          last_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-suffix">Suffix</label>
                    <select
                      id="edit-suffix"
                      value={editFormData.suffix}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          suffix: e.target.value,
                        }))
                      }
                    >
                      {suffixOptions.map((suffix) => (
                        <option key={suffix} value={suffix}>
                          {suffix || "None"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-designation">Designation</label>
                    <input
                      type="text"
                      id="edit-designation"
                      value={editFormData.designation}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          designation: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-station">Station</label>
                    <input
                      type="text"
                      id="edit-station"
                      value={editFormData.station}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          station: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-retirement">Retirement Date</label>
                    <Flatpickr
                      value={editFormData.retirement_date}
                      onChange={([date]) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          retirement_date: date,
                        }))
                      }
                      options={{
                        dateFormat: "Y-m-d",
                        minDate: editFormData.date_hired || "today",
                      }}
                    />
                  </div>
                </div>

                <div className={styles.prFormRow}>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-birth">Birth Date</label>
                    <Flatpickr
                      value={editFormData.birth_date}
                      onChange={([date]) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          birth_date: date,
                        }))
                      }
                      options={{
                        dateFormat: "Y-m-d",
                        maxDate: editFormData.date_hired || "today",
                      }}
                    />
                  </div>
                  <div className={styles.prFormGroup}>
                    <label htmlFor="edit-hired">Date Hired</label>
                    <Flatpickr
                      value={editFormData.date_hired}
                      onChange={([date]) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          date_hired: date,
                        }))
                      }
                      options={{
                        dateFormat: "Y-m-d",
                        minDate: editFormData.birth_date || "1900-01-01",
                        maxDate: editFormData.retirement_date || "today",
                      }}
                    />
                  </div>
                </div>

                <div className={styles.prDateValidationNote}>
                  <small>Note: Birth Date ≤ Date Hired ≤ Retirement Date</small>
                </div>

                <div className={styles.prFormActions}>
                  <button
                    onClick={handleCloseEditModal}
                    type="button"
                    className={styles.prCancel}
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
              </form>
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

      {/* Edit Rank Modal */}
      {showEditRankModal && (
        <div
          id="editRankModal"
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

      {/* Set Leave Credits Modal */}
      {showSetLeaveCreditsModal && editingLeavePersonnel && (
        <div
          className={`${styles.modal} ${styles.show} main-content ${
            isSidebarCollapsed ? styles.sidebarCollapsed : ""
          }`}
        >
          <div
            className={`${styles.modalContent} ${
              isSidebarCollapsed ? styles.modalContentCollapsed : ""
            }`}
            style={{ maxWidth: "500px" }}
          >
            <div className={styles.modalHeader}>
              <h2>Set Leave Credits</h2>
              <button
                onClick={() => {
                  setShowSetLeaveCreditsModal(false);
                  setEditingLeavePersonnel(null);
                }}
                className={styles.ShowEditModalCloseBtn}
              >
                &times;
              </button>
            </div>

            <div className={styles.leaveCreditsModalBody}>
              <div className={styles.leaveCreditsNote}>
                <p>
                  <strong>Setting leave credits for:</strong>
                </p>
                <p className={styles.personnelNameHighlight}>
                  {editingLeavePersonnel.first_name}{" "}
                  {editingLeavePersonnel.last_name}
                  {editingLeavePersonnel.rank &&
                    ` (${editingLeavePersonnel.rank})`}
                </p>
                <p>
                  <strong>Note:</strong> Enter exact existing leave balances.
                  This will be stored directly in the leave_balances table
                  without any calculations.
                </p>
                <p>
                  <strong>Maximum value:</strong> 999.99 days per leave type.
                </p>
              </div>

              <div className={styles.leaveCreditsForm}>
                <div className={styles.leaveCreditField}>
                  <label htmlFor="set-vacation-leave">
                    <span className={styles.leaveCreditIcon}>🏖️</span>
                    Vacation Leave
                  </label>
                  <input
                    type="number"
                    id="set-vacation-leave"
                    min="0"
                    max="999.99"
                    step="0.5"
                    value={leaveCredits.vacation_balance}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      if (value > 999.99) {
                        toast.error("Maximum value is 999.99 days");
                        return;
                      }
                      setLeaveCredits((prev) => ({
                        ...prev,
                        vacation_balance: value,
                      }));
                    }}
                    placeholder="0.00"
                  />
                  <span className={styles.leaveCreditUnit}>days</span>
                </div>

                <div className={styles.leaveCreditField}>
                  <label htmlFor="set-sick-leave">
                    <span className={styles.leaveCreditIcon}>🏥</span>
                    Sick Leave
                  </label>
                  <input
                    type="number"
                    id="set-sick-leave"
                    min="0"
                    max="999.99"
                    step="0.5"
                    value={leaveCredits.sick_balance}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      if (value > 999.99) {
                        toast.error("Maximum value is 999.99 days");
                        return;
                      }
                      setLeaveCredits((prev) => ({
                        ...prev,
                        sick_balance: value,
                      }));
                    }}
                    placeholder="0.00"
                  />
                  <span className={styles.leaveCreditUnit}>days</span>
                </div>

                <div className={styles.leaveCreditField}>
                  <label htmlFor="set-emergency-leave">
                    <span className={styles.leaveCreditIcon}>🚨</span>
                    Emergency Leave
                  </label>
                  <input
                    type="number"
                    id="set-emergency-leave"
                    min="0"
                    max="999.99"
                    step="0.5"
                    value={leaveCredits.emergency_balance}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      if (value > 999.99) {
                        toast.error("Maximum value is 999.99 days");
                        return;
                      }
                      setLeaveCredits((prev) => ({
                        ...prev,
                        emergency_balance: value,
                      }));
                    }}
                    placeholder="0.00"
                  />
                  <span className={styles.leaveCreditUnit}>days</span>
                </div>

                <div className={styles.leaveCreditYear}>
                  <label htmlFor="set-leave-year">
                    <span className={styles.leaveCreditIcon}>📅</span>
                    Year
                  </label>
                  <input
                    type="number"
                    id="set-leave-year"
                    value={leaveCredits.year}
                    onChange={(e) =>
                      setLeaveCredits((prev) => ({
                        ...prev,
                        year:
                          parseInt(e.target.value) || new Date().getFullYear(),
                      }))
                    }
                    min="2000"
                    max="2100"
                  />
                </div>

                <div className={styles.leaveCreditsSummary}>
                  <h4>Summary:</h4>
                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryItem}>
                      <span>Vacation:</span>
                      <strong>{leaveCredits.vacation_balance} days</strong>
                    </div>
                    <div className={styles.summaryItem}>
                      <span>Sick:</span>
                      <strong>{leaveCredits.sick_balance} days</strong>
                    </div>
                    <div className={styles.summaryItem}>
                      <span>Emergency:</span>
                      <strong>{leaveCredits.emergency_balance} days</strong>
                    </div>
                    <div className={styles.summaryItem}>
                      <span>Total:</span>
                      <strong className={styles.totalCredits}>
                        {parseFloat(leaveCredits.vacation_balance || 0) +
                          parseFloat(leaveCredits.sick_balance || 0) +
                          parseFloat(leaveCredits.emergency_balance || 0)}{" "}
                        days
                      </strong>
                    </div>
                  </div>
                </div>

                <div className={styles.leaveCreditsActions}>
                  <button
                    type="button"
                    className={styles.prCancel}
                    onClick={() => {
                      setShowSetLeaveCreditsModal(false);
                      setEditingLeavePersonnel(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.prSubmit}
                    onClick={saveLeaveCreditsDirectly}
                  >
                    Save Leave Credits
                  </button>
                </div>
              </div>
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
                <p className={styles.documentNameHighlight}>"{deleteName}"?</p>
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
