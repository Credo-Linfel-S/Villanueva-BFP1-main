import React, { useEffect, useState, useRef } from "react";
import styles from "../styles/InventoryControl.module.css";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Scanner } from "@yudiel/react-qr-scanner";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.css";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import jsbarcode from "jsbarcode";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BFPPreloader from "../../BFPPreloader.jsx";
import { useAuth } from "../../AuthContext.jsx";
import {
  filterActivePersonnel,
  isPersonnelActive,
} from "../../filterActivePersonnel.js";

import { useUserId } from "../../hooks/useUserId.js";

export default function InventoryControl() {
  // ========== PRELOADER STATES ==========
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const { userId, isAuthenticated, userRole } = useUserId();
  const editModalQrReaderRef = useRef(null);
  // ========== NEW: Scan Result Modal State ==========
  const [showScanResultModal, setShowScanResultModal] = useState(false);
  const [scanResult, setScanResult] = useState({
    type: "", // 'found' or 'not_found'
    message: "",
    equipmentData: null,
    barcode: "",
  });

  // ========== NEW: Update loading phases to include clearance requests ==========
  const loadingPhasesRef = useRef([
    { name: "Checking Authentication", progress: 20, completed: false },
    { name: "Loading User Data", progress: 40, completed: false },
    { name: "Loading Inventory Data", progress: 60, completed: false },
    { name: "Loading Personnel Data", progress: 75, completed: false },
    { name: "Loading Clearance Requests", progress: 90, completed: false }, // NEW
    { name: "Setting Up System", progress: 100, completed: false },
  ]);

  const { user: authUser, hasSupabaseAuth } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [clearanceRequests, setClearanceRequests] = useState([]); // NEW: State for clearance requests
  const { isSidebarCollapsed } = useSidebar();
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
  const [showScanner, setShowScanner] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [selectedBarcode, setSelectedBarcode] = useState(null);
  const qrScannerRef = useRef(null);
  const [isProcessingAdd, setIsProcessingAdd] = useState(false);
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);
  // ========== EDIT MODAL SCANNER STATE ==========
  const [showEditScanner, setShowEditScanner] = useState(false);
  const [isRequestingEditPermission, setIsRequestingEditPermission] =
    useState(false);
  const editScannerRef = useRef(null);
  // Update the emptyNew object to include price
  // Update the emptyNew object to include assignedDate
  const emptyNew = {
    itemName: "",
    itemCode: "",
    category: "",
    status: "",
    assignedTo: "", // CHANGED: Now stores personnel ID or "unassigned"
    purchaseDate: "",
    lastChecked: "",
    price: "", // Add price field
    assignedDate: "",
    lastAssigned: "",
    unassignedDate: "",
  };
  const [newItem, setNewItem] = useState(emptyNew);

  // Update the state for floating labels in add sidebar
  const [floatingLabels, setFloatingLabels] = useState({
    category: false,
    status: false,
    assignedTo: false,
    assignedDate: false, // NEW
  });

  // Update the state for floating labels in edit modal
  const [editFloatingLabels, setEditFloatingLabels] = useState({
    category: false,
    status: false,
    assignedTo: false,
    assignedDate: false, // NEW
  });
  // edit modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editItem, setEditItem] = useState(emptyNew);
  const [isUnderInspection, setIsUnderInspection] = useState(false);

  // delete modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // add sidebar state
  const [isAddSidebarOpen, setIsAddSidebarOpen] = useState(false);

  // Summary numbers (computed)
  const totalItems = inventory.length;
  const assignedItems = inventory.filter(
    (i) => i.assigned_to && i.assigned_to !== "Unassigned"
  ).length;
  const storageItems = inventory.filter(
    (i) => !i.assigned_to || i.assigned_to === "Unassigned"
  ).length;

  // ========== NEW: CLEARANCE REQUEST FUNCTIONS ==========

  // Load clearance requests for resignation, retirement, and equipment completion
  const loadClearanceRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("clearance_requests")
        .select(
          `
          id,
          personnel_id,
          type,
          status,
          effective_date,
          expected_completion_date,
          actual_completion_date,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            badge_number
          )
        `
        )
        .in("type", ["Resignation", "Retirement", "Equipment Completion"])
        .in("status", ["Pending", "In Progress"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClearanceRequests(data || []);
    } catch (err) {
      console.error("loadClearanceRequests error", err);
      toast.error("Failed to load clearance requests: " + err.message);
      throw err;
    }
  };

  // Check if a personnel has an active clearance request
  const checkPersonnelHasActiveClearance = (personnelId) => {
    if (!personnelId || personnelId === "unassigned") return false;

    return clearanceRequests.some(
      (request) =>
        request.personnel_id === personnelId &&
        ["Pending", "In Progress"].includes(request.status)
    );
  };

  // Get clearance request details for a personnel
  const getPersonnelClearanceDetails = (personnelId) => {
    if (!personnelId || personnelId === "unassigned") return null;

    const request = clearanceRequests.find(
      (request) =>
        request.personnel_id === personnelId &&
        ["Pending", "In Progress"].includes(request.status)
    );

    return request;
  };

  // CHANGED: REMOVED the findPersonnelIdByName function - no longer needed

  // Function to show clearance warning
  const showClearanceWarning = (clearanceInfo) => {
    toast.error(
      <div style={{ padding: "10px" }}>
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}
        >
          <span style={{ fontSize: "20px", marginRight: "10px" }}>🚫</span>
          <strong style={{ fontSize: "16px" }}>Cannot Assign Equipment</strong>
        </div>
        <div
          style={{ fontSize: "14px", lineHeight: "1.4", marginBottom: "10px" }}
        >
          <strong>{clearanceInfo.personnelName}</strong> has an active{" "}
          <strong>{clearanceInfo.type}</strong> request.
          <br />
          Equipment cannot be assigned to personnel with pending clearance
          requests.
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "#666",
            backgroundColor: "#f8f9fa",
            padding: "8px",
            borderRadius: "4px",
            borderLeft: "3px solid #1060af",
          }}
        >
          <strong>Clearance Type:</strong> {clearanceInfo.type}
          <br />
          <strong>Status:</strong> {clearanceInfo.status}
          {clearanceInfo.effectiveDate && (
            <>
              <br />
              <strong>Effective Date:</strong>{" "}
              {formatDate(clearanceInfo.effectiveDate)}
            </>
          )}
        </div>
        <div
          style={{ fontSize: "12px", marginTop: "10px", fontStyle: "italic" }}
        >
          Please complete the clearance process or select another personnel.
        </div>
      </div>,
      { autoClose: 8000, closeButton: true, position: "top-center" }
    );
  };

  // ========== NEW: Scan Result Modal Functions ==========
  const showScanResult = (
    type,
    message,
    equipmentData = null,
    barcode = ""
  ) => {
    setScanResult({
      type,
      message,
      equipmentData,
      barcode,
    });
    setShowScanResultModal(true);
  };

  const closeScanResultModal = () => {
    setShowScanResultModal(false);
    setScanResult({
      type: "",
      message: "",
      equipmentData: null,
      barcode: "",
    });
  };

  const applyScannedData = (equipmentData, barcode, applyAllFields = false) => {
    // For edit mode: if scanning a different equipment, only allow barcode update
    const isDifferentEquipment =
      isEditOpen && equipmentData && equipmentData.id !== editId;

    if (isDifferentEquipment && applyAllFields) {
      toast.error(
        <div style={{ padding: "10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "20px", marginRight: "10px" }}>🚫</span>
            <strong style={{ fontSize: "16px" }}>Restricted Operation</strong>
          </div>
          <div style={{ fontSize: "14px", lineHeight: "1.4" }}>
            Cannot copy data from a different equipment while editing.
            <br />
            You can only update the barcode field.
          </div>
        </div>,
        { autoClose: 5000, closeButton: true }
      );
      return;
    }

    if (equipmentData) {
      if (isAddSidebarOpen) {
        // Add mode - apply all data
        setNewItem({
          itemName: equipmentData.item_name || "",
          itemCode: equipmentData.item_code || "",
          category: equipmentData.category || "",
          status: equipmentData.status || "",
          assignedTo: equipmentData.assigned_personnel_id || "unassigned",
          purchaseDate: equipmentData.purchase_date || "",
          lastChecked: equipmentData.last_checked || "",
          price: equipmentData.price || "",
          assignedDate: equipmentData.assigned_date || "",
          lastAssigned: equipmentData.last_assigned || "",
          unassignedDate: equipmentData.unassigned_date || "",
        });

        setFloatingLabels({
          category: !!equipmentData.category,
          status: !!equipmentData.status,
          assignedTo: !!equipmentData.assigned_personnel_id,
          assignedDate: !!equipmentData.assigned_date,
        });

        toast.success("Equipment data loaded from scan!");
      } else if (isEditOpen) {
        if (isDifferentEquipment) {
          // Different equipment in edit mode - only update barcode
          setEditItem((prev) => ({
            ...prev,
            itemCode: barcode,
          }));
          toast.info(`Barcode updated to: ${barcode}`);
        } else if (equipmentData.id === editId) {
          // Same equipment in edit mode - user can choose what to update
          if (applyAllFields) {
            // Update all fields (for same equipment)
            setEditItem({
              itemName: equipmentData.item_name || "",
              itemCode: equipmentData.item_code || "",
              category: equipmentData.category || "",
              status: equipmentData.status || "",
              assignedTo: equipmentData.assigned_personnel_id || "unassigned",
              purchaseDate: equipmentData.purchase_date || "",
              lastChecked: equipmentData.last_checked || "",
              price: equipmentData.price || "",
              assignedDate: equipmentData.assigned_date || "",
              lastAssigned: equipmentData.last_assigned || "",
              unassignedDate: equipmentData.unassigned_date || "",
            });

            setEditFloatingLabels({
              category: !!equipmentData.category,
              status: !!equipmentData.status,
              assignedTo: !!equipmentData.assigned_personnel_id,
              assignedDate: !!equipmentData.assigned_date,
            });

            toast.success("All fields updated from scan!");
          } else {
            // Only update barcode (default)
            setEditItem((prev) => ({
              ...prev,
              itemCode: equipmentData.item_code || prev.itemCode,
            }));
            toast.success("Barcode updated!");
          }
        }
      }
    } else {
      // No equipment found - just update barcode
      if (isAddSidebarOpen) {
        setNewItem((prev) => ({ ...prev, itemCode: barcode }));
        toast.info(`New barcode set: ${barcode}`);
      } else if (isEditOpen) {
        setEditItem((prev) => ({ ...prev, itemCode: barcode }));
        toast.info(`Barcode updated to: ${barcode}`);
      }
    }

    closeScanResultModal();
  };

  // ========== INSPECTION CHECK FUNCTIONS ==========

  // Batch check for loading all inventory items
  const checkAllEquipmentUnderInspection = async (inventoryItems) => {
    try {
      const equipmentIds = inventoryItems.map((item) => item.id);

      if (equipmentIds.length === 0) {
        return inventoryItems.map((item) => ({
          ...item,
          under_inspection: false,
        }));
      }

      // Query inspections table instead of scheduled_inspections
      const { data: inspections } = await supabase
        .from("inspections")
        .select("equipment_id, status, schedule_inspection_date")
        .in("equipment_id", equipmentIds)
        .in("status", ["PENDING", "IN_PROGRESS"]);

      const { data: clearanceInventory } = await supabase
        .from("clearance_inventory")
        .select("inventory_id")
        .in("inventory_id", equipmentIds)
        .in("status", ["Pending", "In Progress"]);

      // Combine all inspection types
      const inspectionIds = new Set(
        (inspections || []).map((i) => i.equipment_id)
      );
      const clearanceIds = new Set(
        (clearanceInventory || []).map((ci) => ci.inventory_id)
      );

      return inventoryItems.map((item) => ({
        ...item,
        under_inspection:
          inspectionIds.has(item.id) || clearanceIds.has(item.id),
      }));
    } catch (error) {
      console.error("Error checking equipment inspection status:", error);
      return inventoryItems.map((item) => ({
        ...item,
        under_inspection: false,
      }));
    }
  };
  // Single equipment check (used in edit modal and handleEditSubmit)
  const checkSingleEquipmentUnderInspection = async (equipmentId) => {
    try {
      const [{ data: inspections }, { data: clearanceInventory }] =
        await Promise.all([
          supabase
            .from("inspections")
            .select("*")
            .eq("equipment_id", equipmentId)
            .in("status", ["PENDING", "IN_PROGRESS"])
            .limit(1),
          supabase
            .from("clearance_inventory")
            .select("*")
            .eq("inventory_id", equipmentId)
            .in("status", ["Pending", "In Progress"])
            .limit(1),
        ]);

      return {
        isUnderInspection: !!(
          (inspections && inspections.length > 0) ||
          (clearanceInventory && clearanceInventory.length > 0)
        ),
        inspection: inspections && inspections[0],
        clearanceInventory: clearanceInventory && clearanceInventory[0],
      };
    } catch (error) {
      console.error("Error checking equipment inspection status:", error);
      return { isUnderInspection: false };
    }
  };
  // Loading phase helper function
  const updateLoadingPhase = async (phaseIndex, phaseName) => {
    return new Promise((resolve) => {
      setLoadingProgress(loadingPhasesRef.current[phaseIndex].progress);
      setTimeout(resolve, 150);
    });
  };

  async function loadInventory() {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*") // Use * to get all columns
        .order("created_at", { ascending: false });

      if (error) throw error;

      console.log("=== DEBUG: Loaded inventory ===");
      if (data && data.length > 0) {
        console.log("Sample item with new fields:", {
          id: data[0].id,
          item_name: data[0].item_name,
          last_assigned: data[0].last_assigned,
          unassigned_date: data[0].unassigned_date,
          assigned_date: data[0].assigned_date,
        });
      }

      const inventoryWithInspectionStatus =
        await checkAllEquipmentUnderInspection(data || []);

      setInventory(inventoryWithInspectionStatus || []);

      const totalPages = Math.max(
        1,
        Math.ceil((inventoryWithInspectionStatus || []).length / rowsPerPage)
      );
      if (currentPage > totalPages) setCurrentPage(totalPages);
    } catch (err) {
      console.error("loadInventory error", err);
      toast.error("Failed to load inventory: " + err.message);
      throw err;
    }
  }

  // Then update your loadPersonnel function:
  async function loadPersonnel() {
    try {
      const { data, error } = await supabase
        .from("personnel")
        .select(
          "id, first_name, last_name, badge_number, rank, rank_image, is_active, status, separation_type, separation_date, retirement_date"
        )
        .order("last_name", { ascending: true });

      if (error) throw error;

      // Filter out retired/resigned personnel
      const activePersonnel = filterActivePersonnel(data || []);

      console.log(
        `Loaded ${activePersonnel.length} active personnel out of ${
          data?.length || 0
        } total`
      );

      // Load clearance requests to check each personnel
      await loadClearanceRequests();

      setPersonnel(activePersonnel);
    } catch (err) {
      console.error("loadPersonnel error", err);
      toast.error("Failed to load personnel: " + err.message);
      throw err;
    }
  }

  // Robust date formatting function
  const formatDate = (dateString) => {
    if (!dateString || dateString.trim() === "") return "";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.warn("Date formatting error:", error);
      return dateString;
    }
  };

  // Helper function to get personnel name from ID
  const getPersonnelNameFromId = (personnelId) => {
    if (!personnelId || personnelId === "unassigned") return "Unassigned";

    const person = personnel.find((p) => p.id === personnelId);
    return person ? `${person.first_name} ${person.last_name}` : "Unassigned";
  };

  // Helper function to get personnel name with badge
  const getPersonnelDisplayName = (person) => {
    return `${person.first_name} ${person.last_name}${
      person.badge_number ? ` (${person.badge_number})` : ""
    }`;
  };

  // Move stopScanner function definition BEFORE the useEffect that uses it
  const stopScanner = () => {
    if (qrScannerRef.current?.html5QrcodeScanner) {
      try {
        qrScannerRef.current.html5QrcodeScanner.clear().catch((error) => {
          console.error("Failed to clear scanner:", error);
        });
        qrScannerRef.current.html5QrcodeScanner = null;
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    setShowScanner(false);
  };

  // ========== REPLACED: ENHANCED INITIALIZATION FUNCTION WITH PRELOADER ==========
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Phase 1: Check authentication
        await updateLoadingPhase(0, "Checking Authentication");

        // Phase 2: Load user data
        await updateLoadingPhase(1, "Loading User Data");

        // Phase 3: Load inventory data
        await updateLoadingPhase(2, "Loading Inventory Data");
        await loadInventory();

        // Phase 4: Load personnel data
        await updateLoadingPhase(3, "Loading Personnel Data");
        await loadPersonnel();

        // Phase 5: Load clearance requests (already loaded in loadPersonnel but included for clarity)
        await updateLoadingPhase(4, "Loading Clearance Requests");

        // Phase 6: Finalize
        await updateLoadingPhase(5, "Setting Up System");

        // Add a small delay to ensure all data is processed
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Now we can safely hide the preloader
        setTimeout(() => {
          setIsInitializing(false);
          setTimeout(() => setShowContent(true), 300);
        }, 500);
      } catch (error) {
        console.error("Data loading error:", error);
        toast.error("Some data failed to load. Please refresh if needed.");
        setIsInitializing(false);
        setTimeout(() => setShowContent(true), 300);
      }
    };

    initializeData();

    return () => {
      // Cleanup
      stopScanner();
    };
  }, []);

  // Handler for select changes in add sidebar
  const handleAddSelectChange = (field, value) => {
    setNewItem((prev) => ({ ...prev, [field]: value }));
    setFloatingLabels((prev) => ({ ...prev, [field]: value !== "" }));
  };

  // Handler for select changes in edit modal
  const handleEditSelectChange = (field, value) => {
    setEditItem((prev) => ({ ...prev, [field]: value }));
    setEditFloatingLabels((prev) => ({ ...prev, [field]: value !== "" }));
  };

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];
    if (currentFilterCard === "assigned") {
      filtered = filtered.filter(
        (i) => i.assigned_to && i.assigned_to !== "Unassigned"
      );
    } else if (currentFilterCard === "storage") {
      filtered = filtered.filter(
        (i) => !i.assigned_to || i.assigned_to === "Unassigned"
      );
    }

    const s = search.trim().toLowerCase();
    const cat = filterCategory.trim().toLowerCase();
    const stat = filterStatus.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.item_name} ${i.item_code} ${i.category} ${i.status} ${i.assigned_to} ${i.purchase_date} ${i.last_checked}`.toLowerCase();
      const catMatch = !cat || (i.category || "").toLowerCase().includes(cat);
      const statMatch = !stat || (i.status || "").toLowerCase().includes(stat);
      const searchMatch = !s || text.includes(s);
      return catMatch && statMatch && searchMatch;
    });

    return filtered;
  }

  const filteredInventory = applyFilters(inventory);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredInventory.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredInventory.slice(pageStart, pageStart + rowsPerPage);

  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredInventory.length / rowsPerPage)
    );
    const hasNoData = filteredInventory.length === 0;

    const buttons = [];

    buttons.push(
      <button
        key="prev"
        className={`${styles.inventoryPaginationBtn} ${
          hasNoData ? styles.inventoryDisabled : ""
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
        className={`${styles.inventoryPaginationBtn} ${
          1 === currentPage ? styles.inventoryActive : ""
        } ${hasNoData ? styles.inventoryDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.inventoryPaginationEllipsis}>
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
            className={`${styles.inventoryPaginationBtn} ${
              i === currentPage ? styles.inventoryActive : ""
            } ${hasNoData ? styles.inventoryDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.inventoryPaginationEllipsis}>
          ...
        </span>
      );
    }

    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.inventoryPaginationBtn} ${
            pageCount === currentPage ? styles.inventoryActive : ""
          } ${hasNoData ? styles.inventoryDisabled : ""}`}
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
        className={`${styles.inventoryPaginationBtn} ${
          hasNoData ? styles.inventoryDisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  // Generate barcode image - FIXED VERSION
  const generateBarcodeImage = (
    itemCode,
    itemName,
    equipmentDetails = null
  ) => {
    return new Promise((resolve, reject) => {
      try {
        // Create responsive container
        const container = document.createElement("div");
        container.style.width = "100%";
        container.style.maxWidth = "400px";
        container.style.padding = "15px";
        container.style.backgroundColor = "white";
        container.style.boxSizing = "border-box";
        container.style.fontFamily = "Arial, sans-serif";
        container.style.wordWrap = "break-word";

        // Title
        const title = document.createElement("h3");
        title.textContent = "BFP Villanueva - Equipment Barcode";
        title.style.margin = "0 0 10px 0";
        title.style.fontSize = "14px";
        title.style.fontWeight = "bold";
        title.style.color = "#2b2b2b";
        title.style.textAlign = "center";
        title.style.wordBreak = "break-word";
        container.appendChild(title);

        // Equipment details
        const detailsDiv = document.createElement("div");
        detailsDiv.style.marginBottom = "10px";
        detailsDiv.style.fontSize = "11px";
        detailsDiv.style.lineHeight = "1.4";

        let detailsHTML = `
        <div><strong>Equipment:</strong> ${itemName || "N/A"}</div>
        <div><strong>Barcode:</strong> <span class="barcode-text">${itemCode}</span></div>
      `;

        if (equipmentDetails) {
          detailsHTML += `
          <div><strong>Category:</strong> ${
            equipmentDetails.category || "N/A"
          }</div>
          <div><strong>Status:</strong> ${
            equipmentDetails.status || "N/A"
          }</div>
          <div><strong>Assigned To:</strong> ${
            equipmentDetails.assigned_to || "Unassigned"
          }</div>
          <div><strong>Price:</strong> ${
            equipmentDetails.price
              ? new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(equipmentDetails.price)
              : "₱0.00"
          }</div>
        `;
        }

        detailsDiv.innerHTML = detailsHTML;
        container.appendChild(detailsDiv);

        // Create canvas for barcode
        const canvas = document.createElement("canvas");

        // Adjust canvas size based on barcode length
        const barcodeLength = itemCode.length;
        let canvasWidth = 350;
        let canvasHeight = 80;

        if (barcodeLength > 20) {
          canvasWidth = 400;
          canvasHeight = 100;
        } else if (barcodeLength > 30) {
          canvasWidth = 450;
          canvasHeight = 120;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        canvas.style.display = "block";
        canvas.style.margin = "10px auto";
        canvas.style.maxWidth = "100%";
        canvas.style.height = "auto";

        try {
          // Configure barcode based on length
          const barcodeConfig = {
            format: "CODE128",
            displayValue: true,
            fontSize: barcodeLength > 25 ? 12 : 14,
            textMargin: 5,
            margin: barcodeLength > 20 ? 10 : 5,
            width: barcodeLength > 20 ? 1.5 : 2,
            height: barcodeLength > 20 ? 60 : 50,
            background: "#ffffff",
          };

          jsbarcode(canvas, itemCode, barcodeConfig);

          container.appendChild(canvas);

          // Footer
          const footer = document.createElement("div");
          footer.textContent = `Generated: ${new Date().toLocaleDateString()}`;
          footer.style.fontSize = "10px";
          footer.style.color = "#666";
          footer.style.textAlign = "center";
          footer.style.marginTop = "5px";
          container.appendChild(footer);

          // Convert to image
          const tempImg = new Image();
          tempImg.onload = () => {
            const finalCanvas = document.createElement("canvas");
            finalCanvas.width = 400;
            finalCanvas.height = 300; // Increased height for long content
            const ctx = finalCanvas.getContext("2d");

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 400, 300);

            // Draw title
            ctx.fillStyle = "#000000";
            ctx.font = "bold 14px Arial";
            ctx.fillText("BFP Villanueva - Equipment Barcode", 20, 30);

            // Draw equipment info with word wrap
            ctx.font = "11px Arial";

            // Function to wrap text
            const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
              const words = text.split(" ");
              let line = "";
              let testLine = "";
              let lineCount = 0;
              const maxLines = 5;

              for (let n = 0; n < words.length; n++) {
                testLine = line + words[n] + " ";
                const metrics = context.measureText(testLine);
                const testWidth = metrics.width;

                if (testWidth > maxWidth && n > 0 && lineCount < maxLines - 1) {
                  context.fillText(line, x, y);
                  line = words[n] + " ";
                  y += lineHeight;
                  lineCount++;
                } else {
                  line = testLine;
                }
              }
              context.fillText(line, x, y);
              return y + lineHeight;
            };

            let yPosition = 60;
            yPosition = wrapText(
              ctx,
              `Equipment: ${itemName}`,
              20,
              yPosition,
              360,
              14
            );
            yPosition = wrapText(
              ctx,
              `Barcode: ${itemCode}`,
              20,
              yPosition,
              360,
              14
            );

            if (equipmentDetails) {
              yPosition += 5;
              yPosition = wrapText(
                ctx,
                `Category: ${equipmentDetails.category || "N/A"}`,
                20,
                yPosition,
                360,
                14
              );
              yPosition = wrapText(
                ctx,
                `Status: ${equipmentDetails.status || "N/A"}`,
                20,
                yPosition,
                360,
                14
              );
              yPosition = wrapText(
                ctx,
                `Assigned To: ${equipmentDetails.assigned_to || "Unassigned"}`,
                20,
                yPosition,
                360,
                14
              );
            }

            // Draw barcode
            const barcodeCanvas = document.createElement("canvas");
            barcodeCanvas.width = canvasWidth;
            barcodeCanvas.height = canvasHeight;

            jsbarcode(barcodeCanvas, itemCode, barcodeConfig);

            ctx.drawImage(barcodeCanvas, 20, yPosition + 10);

            // Footer
            ctx.font = "10px Arial";
            ctx.fillStyle = "#666";
            ctx.fillText(
              `Generated: ${new Date().toLocaleDateString()}`,
              20,
              290
            );

            const dataUrl = finalCanvas.toDataURL("image/png", 1.0);
            resolve(dataUrl);
          };

          tempImg.src = canvas.toDataURL("image/png");
        } catch (barcodeError) {
          console.error("Barcode generation error:", barcodeError);

          // Fallback for very long barcodes
          if (barcodeError.message.includes("width") || itemCode.length > 50) {
            // Create a simpler barcode for very long codes
            const fallbackCanvas = document.createElement("canvas");
            fallbackCanvas.width = 450;
            fallbackCanvas.height = 100;

            jsbarcode(fallbackCanvas, itemCode.substring(0, 50), {
              format: "CODE128",
              displayValue: false, // Hide text for very long codes
              margin: 10,
              width: 1,
              height: 60,
            });

            const dataUrl = fallbackCanvas.toDataURL("image/png");
            resolve(dataUrl);
          } else {
            reject(barcodeError);
          }
        }
      } catch (error) {
        console.error("Error in generateBarcodeImage:", error);
        reject(error);
      }
    });
  };
  // Simple barcode generation (just the barcode)
  const generateSimpleBarcode = (itemCode) => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 100;

        jsbarcode(canvas, itemCode, {
          format: "CODE128",
          displayValue: true,
          fontSize: 16,
          textMargin: 10,
          margin: 10,
          width: 2,
          height: 70,
        });

        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Handlers
  function openAddSidebar() {
    setIsAddSidebarOpen(true);
    loadPersonnel();
    setFloatingLabels({
      category: false,
      status: false,
      assignedTo: false,
    });
  }

  function closeAddSidebar() {
    setIsAddSidebarOpen(false);
    setNewItem(emptyNew);
    setFloatingLabels({
      category: false,
      status: false,
      assignedTo: false,
      assignedDate: false,
    });
  }

  // ========== REPLACED: handleAddSubmit function ==========
  async function handleAddSubmit(e) {
    e.preventDefault();

    // Prevent multiple submissions
    if (isProcessingAdd) {
      toast.info("Please wait, processing your request...");
      return;
    }

    // ========== NEW: Check if assignment is blocked due to clearance request ==========
    // CHANGED: Use the ID directly
    if (newItem.assignedTo && newItem.assignedTo !== "unassigned") {
      const personnelId = newItem.assignedTo;
      if (checkPersonnelHasActiveClearance(personnelId)) {
        const clearanceDetails = getPersonnelClearanceDetails(personnelId);
        const personnelName = getPersonnelNameFromId(personnelId);
        showClearanceWarning({
          blocked: true,
          type: clearanceDetails.type,
          status: clearanceDetails.status,
          effectiveDate: clearanceDetails.effective_date,
          personnelName: personnelName,
        });
        return; // Stop the submission
      }
    }

    setIsProcessingAdd(true);

    try {
      // Generate simple barcode image
      let barcodeImage = null;
      if (newItem.itemCode) {
        barcodeImage = await generateSimpleBarcode(newItem.itemCode);
      }

      // CHANGED: Use personnel ID directly
      let assignedPersonnelId =
        newItem.assignedTo !== "unassigned" ? newItem.assignedTo : null;
      let assignedToName = "Unassigned";

      if (assignedPersonnelId) {
        assignedToName = getPersonnelNameFromId(assignedPersonnelId);
      }

      // ========== UPDATED: Use manual aconst inventoryDataconst inventoryDatassignedDate or set to current date ==========
      let assignedDate = null;
      if (assignedPersonnelId) {
        // Use manually entered date if provided, otherwise use current date
        assignedDate = newItem.assignedDate?.trim()
          ? newItem.assignedDate
          : new Date().toISOString().split("T")[0];
      }
      // In handleAddSubmit function, update the inventoryData object:
      const inventoryData = {
        item_name: newItem.itemName,
        item_code: newItem.itemCode,
        category: newItem.category,
        status: newItem.status,
        assigned_to: assignedToName,
        assigned_personnel_id: assignedPersonnelId,
        purchase_date: newItem.purchaseDate?.trim()
          ? newItem.purchaseDate
          : null,
        last_checked: newItem.lastChecked?.trim() ? newItem.lastChecked : null,
        price:
          newItem.price !== "" &&
          newItem.price !== null &&
          newItem.price !== undefined
            ? parseFloat(newItem.price)
            : null,
        barcode_image: barcodeImage,
        assigned_date: assignedDate,
        last_assigned: newItem.lastAssigned?.trim() || null,
        unassigned_date:
          !assignedPersonnelId && newItem.unassignedDate?.trim()
            ? newItem.unassignedDate
            : null,
      };

      console.log("Submitting data:", inventoryData);

      const { data, error } = await supabase
        .from("inventory")
        .insert([inventoryData])
        .select()
        .single();

      if (error) {
        console.error("Insert error details:", error);
        throw error;
      }

      await loadInventory();
      closeAddSidebar();
      toast.success("Equipment added successfully!");
    } catch (err) {
      console.error("add error", err);
      toast.error("Error adding item: " + err.message);
    } finally {
      setIsProcessingAdd(false);
    }
  }

  function openEditModal(item) {
    setEditId(item.id);

    // CHANGED: Find the personnel ID for the assigned person
    let assignedToId = "unassigned";
    if (item.assigned_to && item.assigned_to !== "Unassigned") {
      // Find the personnel by name to get their ID
      const assignedPerson = personnel.find(
        (p) =>
          `${p.first_name} ${p.last_name}` === item.assigned_to ||
          getPersonnelDisplayName(p) === item.assigned_to
      );
      assignedToId = assignedPerson ? assignedPerson.id : "unassigned";
    }

    // FIXED: Convert dates to proper format for Flatpickr
    const formatDateForPicker = (dateString) => {
      if (!dateString || dateString.trim() === "") return "";

      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";

        // Format as YYYY-MM-DD for Flatpickr
        return date.toISOString().split("T")[0];
      } catch (error) {
        console.warn("Date formatting error:", error);
        return "";
      }
    };

    const editData = {
      itemName: item.item_name || "",
      itemCode: item.item_code || "",
      category: item.category || "",
      status: item.status || "",
      assignedTo: assignedToId, // CHANGED: Store ID instead of name
      purchaseDate: formatDateForPicker(item.purchase_date), // FIXED: Format date
      lastChecked: formatDateForPicker(item.last_checked), // FIXED: Format date
      price: item.price || "", // Add price field
      assignedDate: formatDateForPicker(item.assigned_date), // FIXED: Format date
      lastAssigned: item.last_assigned || "",
      unassignedDate: formatDateForPicker(item.unassigned_date), // FIXED: Format date
    };
    setEditItem(editData);

    setEditFloatingLabels({
      category: !!editData.category,
      status: !!editData.status,
      assignedTo: !!editData.assignedTo && editData.assignedTo !== "unassigned",
      assignedDate: !!editData.assignedDate, // NEW
    });

    // Check if equipment is under inspection
    checkSingleEquipmentUnderInspection(item.id).then((status) => {
      setIsUnderInspection(status.isUnderInspection);
    });

    loadPersonnel();
    setIsEditOpen(true);
  }

  function closeEditModal() {
    setIsEditOpen(false);
    setEditId(null);
    setEditItem(emptyNew);
    setIsUnderInspection(false);
    setEditFloatingLabels({
      category: false,
      status: false,
      assignedTo: false,
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editId || isProcessingEdit) return;

    // Get existing item FIRST
    const existingItem = inventory.find((item) => item.id === editId);
    if (!existingItem) {
      toast.error("Equipment not found!");
      return;
    }
    // ========== NEW: Last Assigned Logic ==========
    // FIXED: Add proper null checking before calling .trim()
    let lastAssignedValue = null;
    if (editItem.lastAssigned && typeof editItem.lastAssigned === "string") {
      const trimmedValue = editItem.lastAssigned.trim();
      lastAssignedValue = trimmedValue !== "" ? trimmedValue : null;
    }

    // OR using optional chaining more safely:
    // let lastAssignedValue = editItem.lastAssigned?.trim?.() || null;
    // ========== NEW: Check if new assignment is blocked due to clearance request ==========
    // CHANGED: Use the ID directly
    if (editItem.assignedTo && editItem.assignedTo !== "unassigned") {
      const personnelId = editItem.assignedTo;
      if (checkPersonnelHasActiveClearance(personnelId)) {
        const clearanceDetails = getPersonnelClearanceDetails(personnelId);
        const personnelName = getPersonnelNameFromId(personnelId);
        showClearanceWarning({
          blocked: true,
          type: clearanceDetails.type,
          status: clearanceDetails.status,
          effectiveDate: clearanceDetails.effective_date,
          personnelName: personnelName,
        });
        return; // Stop the submission
      }
    }

    // Check if equipment is under inspection
    const inspectionStatus = await checkSingleEquipmentUnderInspection(editId);

    // Check if assignment is being changed while equipment is under inspection
    // CHANGED: Compare by ID instead of name
    if (inspectionStatus.isUnderInspection) {
      const existingPersonnelId = existingItem.assigned_personnel_id;
      const newPersonnelId =
        editItem.assignedTo !== "unassigned" ? editItem.assignedTo : null;

      const isAssignmentChanging = existingPersonnelId !== newPersonnelId;
      const isUnassigning = existingPersonnelId && newPersonnelId === null;
      const isReassigning =
        existingPersonnelId &&
        newPersonnelId &&
        existingPersonnelId !== newPersonnelId;

      if (isAssignmentChanging || isUnassigning || isReassigning) {
        let inspectionType = "";
        let inspectionDetails = "";

        if (inspectionStatus.inspection) {
          inspectionType = "Inspection";
          inspectionDetails = `Inspector: ${
            inspectionStatus.inspection.inspector_name || "N/A"
          }`;
          if (inspectionStatus.inspection.schedule_inspection_date) {
            inspectionDetails += `, Scheduled: ${new Date(
              inspectionStatus.inspection.schedule_inspection_date
            ).toLocaleDateString()}`;
          }
        } else if (inspectionStatus.clearanceInventory) {
          inspectionType = "Clearance Request";
          inspectionDetails = `Status: ${inspectionStatus.clearanceInventory.status}`;
        }

        toast.error(
          <div style={{ padding: "10px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "20px",
                  marginRight: "10px",
                }}
              >
                🚫
              </span>
              <strong style={{ fontSize: "16px" }}>
                Equipment Cannot Be Modified
              </strong>
            </div>

            <div
              style={{
                fontSize: "14px",
                lineHeight: "1.4",
                marginBottom: "10px",
              }}
            >
              This equipment is currently undergoing{" "}
              <strong>{inspectionType}</strong>.
              <br />
              Assignment changes are restricted until the inspection is
              completed.
            </div>

            {inspectionDetails && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#666",
                  backgroundColor: "#f8f9fa",
                  padding: "8px",
                  borderRadius: "4px",
                  borderLeft: "3px solid #1060af",
                }}
              >
                <strong>Details:</strong> {inspectionDetails}
              </div>
            )}

            <div
              style={{
                fontSize: "12px",
                marginTop: "10px",
                fontStyle: "italic",
              }}
            >
              Please complete the inspection before modifying equipment
              assignments.
            </div>
          </div>,
          {
            autoClose: 8000,
            closeButton: true,
            position: "top-center",
          }
        );
        return;
      }
    }

    setIsProcessingEdit(true);

    try {
      let barcodeImage = null;
      if (editItem.itemCode !== existingItem.item_code) {
        barcodeImage = await generateSimpleBarcode(editItem.itemCode);
      }

      // CHANGED: Use personnel ID directly
      let assignedPersonnelId =
        editItem.assignedTo !== "unassigned" ? editItem.assignedTo : null;
      let assignedToName = "Unassigned";

      if (assignedPersonnelId) {
        assignedToName = getPersonnelNameFromId(assignedPersonnelId);
      }

      // ========== UPDATED: Determine assigned_date logic ==========
      let assignedDate = editItem.assignedDate?.trim()
        ? editItem.assignedDate
        : existingItem.assigned_date;

      // ========== CORRECTED: Determine unassigned_date logic ==========
      let unassignedDate = existingItem.unassigned_date; // Start with existing value

      // ========== NEW: Last Assigned Logic ==========
      let lastAssignedValue = editItem.lastAssigned?.trim() || null;

      // ========== SCENARIO 1: UNASSIGNMENT (Person → Storage) ==========
      if (existingItem.assigned_personnel_id && !assignedPersonnelId) {
        console.log("=== SCENARIO 1: Unassignment (Person → Storage) ===");

        // Set unassigned_date to TODAY (when equipment is being returned to storage)
        // Use manually entered date if provided, otherwise use current date
        unassignedDate = editItem.unassignedDate?.trim()
          ? editItem.unassignedDate
          : new Date().toISOString().split("T")[0];

        // Clear assigned_date since equipment is now unassigned
        assignedDate = null;

        // Set last_assigned to the previous assigned personnel
        lastAssignedValue = existingItem.assigned_to || null;

        // Update the editItem state to reflect this
        setEditItem((prev) => ({
          ...prev,
          lastAssigned: lastAssignedValue || "",
        }));
      }
      // ========== SCENARIO 2: ASSIGNMENT (Storage → Person) ==========
      else if (!existingItem.assigned_personnel_id && assignedPersonnelId) {
        console.log("=== SCENARIO 2: Assignment (Storage → Person) ===");

        // Clear unassigned_date when equipment is assigned to someone
        unassignedDate = null;

        // Set assigned_date (use manually entered or current date)
        assignedDate = editItem.assignedDate?.trim()
          ? editItem.assignedDate
          : new Date().toISOString().split("T")[0];

        // Keep existing last_assigned (if any)
        // If coming from storage, last_assigned might be empty or have previous person
      }
      // ========== SCENARIO 3: REASSIGNMENT (Person A → Person B) ==========
      else if (
        existingItem.assigned_personnel_id &&
        assignedPersonnelId &&
        existingItem.assigned_personnel_id !== assignedPersonnelId
      ) {
        console.log("=== SCENARIO 3: Reassignment (Person A → Person B) ===");
        console.log("From:", existingItem.assigned_to);
        console.log("To:", assignedToName);

        // IMPORTANT: For reassignment, Person A should get an unassigned_date
        // This is when Person A stopped holding the equipment
        unassignedDate = new Date().toISOString().split("T")[0]; // TODAY for Person A

        // Set last_assigned to Person A (the previous holder)
        lastAssignedValue = existingItem.assigned_to || null;

        // Set new assigned_date for Person B
        assignedDate = editItem.assignedDate?.trim()
          ? editItem.assignedDate
          : new Date().toISOString().split("T")[0];

        console.log("Person A unassigned_date:", unassignedDate);
        console.log("Person B assigned_date:", assignedDate);
        console.log("last_assigned (Person A):", lastAssignedValue);
      }
      // ========== SCENARIO 4: No assignment change (keeping same status) ==========
      else {
        console.log("=== SCENARIO 4: No change ===");

        // Keep existing values
        if (!assignedPersonnelId && existingItem.unassigned_date) {
          unassignedDate = existingItem.unassigned_date;
        }
      }

      // In handleEditSubmit, update the price field:
      // In handleEditSubmit, update the price field:
      const updatedData = {
        item_name: editItem.itemName,
        item_code: editItem.itemCode,
        category: editItem.category,
        status: editItem.status,
        assigned_to: assignedToName,
        assigned_personnel_id: assignedPersonnelId,
        purchase_date: editItem.purchaseDate?.trim()
          ? editItem.purchaseDate
          : null,
        last_checked: editItem.lastChecked?.trim()
          ? editItem.lastChecked
          : null,
        price:
          editItem.price !== "" &&
          editItem.price !== null &&
          editItem.price !== undefined
            ? parseFloat(editItem.price)
            : null,
        assigned_date: assignedDate,
        unassigned_date: unassignedDate,
        last_assigned: lastAssignedValue,
        updated_at: new Date().toISOString(),
      };

      if (barcodeImage) {
        updatedData.barcode_image = barcodeImage;
      }

      console.log("=== FINAL UPDATED DATA ===");
      console.log(
        "Scenario:",
        existingItem.assigned_personnel_id && !assignedPersonnelId
          ? "Unassignment"
          : !existingItem.assigned_personnel_id && assignedPersonnelId
          ? "Assignment"
          : existingItem.assigned_personnel_id &&
            assignedPersonnelId &&
            existingItem.assigned_personnel_id !== assignedPersonnelId
          ? "Reassignment"
          : "No change"
      );
      console.log("Updated data:", updatedData);

      const { data: updateResponse, error: updateError } = await supabase
        .from("inventory")
        .update(updatedData)
        .eq("id", editId)
        .select("*")
        .single();

      if (updateError) {
        console.error("Update error details:", updateError);
        throw updateError;
      }

      console.log("=== DATABASE RESPONSE ===");
      console.log("Returned data:", updateResponse);

      let updatedItem = updateResponse;

      // If update didn't return data, fetch it fresh
      if (!updatedItem) {
        console.warn(
          "Update successful but no data returned. Fetching fresh data..."
        );
        const { data: freshData, error: fetchError } = await supabase
          .from("inventory")
          .select("*")
          .eq("id", editId)
          .single();

        if (fetchError) {
          console.error("Error fetching updated record:", fetchError);
          throw fetchError;
        }

        updatedItem = freshData;
      }

      console.log("last_assigned in response:", updatedItem?.last_assigned);
      console.log("unassigned_date in response:", updatedItem?.unassigned_date);

      // Force a complete reload of inventory
      setTimeout(async () => {
        await loadInventory();
      }, 100);

      // Also update local state immediately if we have the data
      if (updatedItem) {
        setInventory((prev) =>
          prev.map((item) =>
            item.id === editId ? { ...item, ...updatedItem } : item
          )
        );
      }

      closeEditModal();
      toast.success("Equipment updated successfully!");
    } catch (err) {
      console.error("edit error", err);
      toast.error("Error updating item: " + err.message);
    } finally {
      setIsProcessingEdit(false);
    }
  }
  function confirmDelete(id) {
    const item = inventory.find((item) => item.id === id);
    if (item && item.under_inspection) {
      showDeleteWarning(item);
      return;
    }

    setDeleteId(id);
    setIsDeleteOpen(true);
  }

  function cancelDelete() {
    setDeleteId(null);
    setIsDeleteOpen(false);
  }

  async function performDelete() {
    if (!deleteId) return;

    const item = inventory.find((item) => item.id === deleteId);
    if (item && item.under_inspection) {
      toast.error("Cannot delete equipment while it is under inspection");
      cancelDelete();
      return;
    }

    try {
      const { error } = await supabase
        .from("inventory")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      await loadInventory();
      cancelDelete();
      toast.warn("Equipment deleted successfully!");
    } catch (err) {
      console.error("delete error", err);
      toast.error("Error deleting item: " + err.message);
    }
  }

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }
  // ========== EDIT MODAL SCANNER FUNCTIONS ==========

  const startEditScanner = async () => {
    setIsRequestingEditPermission(true);

    try {
      // Request camera permission first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      // Stop the stream immediately since we just needed permission
      stream.getTracks().forEach((track) => track.stop());

      // Set scanner to show
      setShowEditScanner(true);
    } catch (error) {
      console.error("Edit modal camera permission denied:", error);

      // Show specific error messages
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        toast.error(
          "Camera access denied. Please allow camera permissions in your browser settings."
        );
      } else if (error.name === "NotFoundError") {
        toast.error(
          "No camera found. Please check if your device has a camera."
        );
      } else if (error.name === "NotReadableError") {
        toast.error("Camera is already in use by another application.");
      } else {
        toast.error("Camera access error: " + error.message);
      }
    } finally {
      setIsRequestingEditPermission(false);
    }
  };

  const stopEditScanner = () => {
    setShowEditScanner(false);
  };

  // Handle scan result
  // Handle scan result
  const handleEditScan = (result) => {
    if (!result || !result[0]) return;

    const decodedText = result[0].rawValue;
    console.log("Edit Modal - Scanned barcode:", decodedText);

    // Process the scan result
    processScannedBarcode(decodedText);
  };

const processScannedBarcode = async (decodedText) => {
  try {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("item_code", decodedText)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (data) {
      if (data.id === editId) {
        setEditItem((prev) => ({
          ...prev,
          itemCode: decodedText,
        }));
        toast.success("Barcode updated for current equipment!");
      } else {
        toast.error(
          <div style={{ padding: "10px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "20px", marginRight: "10px" }}>⚠️</span>
              <strong style={{ fontSize: "16px" }}>
                Different Equipment Scanned
              </strong>
            </div>
            <div style={{ fontSize: "14px", lineHeight: "1.4" }}>
              You scanned equipment: <strong>{data.item_name}</strong> (ID:{" "}
              {data.id})<br />
              Currently editing: <strong>{editItem.itemName}</strong> (ID:{" "}
              {editId})
            </div>
            <div
              style={{
                fontSize: "12px",
                marginTop: "10px",
                color: "#666",
              }}
            >
              Cannot apply data from a different equipment in edit mode.
            </div>
          </div>,
          { autoClose: 5000, closeButton: true }
        );

        setScanResult({
          type: "different",
          message: `Scanned equipment "${data.item_name}" is different from "${editItem.itemName}"`,
          equipmentData: data,
          barcode: decodedText,
        });
        setShowScanResultModal(true);
      }
    } else {
      setEditItem((prev) => ({
        ...prev,
        itemCode: decodedText,
      }));
      toast.success(`New barcode set: ${decodedText}`);
    }

    stopEditScanner();
  } catch (err) {
    console.error("Error fetching equipment:", err);
    setEditItem((prev) => ({
      ...prev,
      itemCode: decodedText,
    }));
    toast.info(`Barcode updated to: ${decodedText}`);
    stopEditScanner();
  }
};
  const handleEditScanError = (error) => {
    console.log("Scanner error:", error);
    // Don't show toast for every error, just log it
  };

  const initializeEditScanner = async () => {
    try {
      // Try to find the element
      const element = document.getElementById("editModalQrReader");

      if (!element) {
        console.log("Element not found, trying again...");
        // Try again after a delay
        await new Promise((resolve) => setTimeout(resolve, 200));
        const element2 = document.getElementById("editModalQrReader");

        if (!element2) {
          throw new Error("Scanner container element not found after retry");
        }
      }

      console.log("editModalQrReader element found!");

      // Clear any existing scanner
      if (editScannerRef.current?.html5QrcodeScanner) {
        try {
          await editScannerRef.current.html5QrcodeScanner.clear();
        } catch (error) {
          console.warn("Error clearing previous scanner:", error);
        }
      }

      // Initialize new scanner
      editScannerRef.current = {
        html5QrcodeScanner: new Html5QrcodeScanner(
          "editModalQrReader",
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            rememberLastUsedCamera: true,
          },
          false
        ),
      };

      editScannerRef.current.html5QrcodeScanner.render(
        async (decodedText) => {
          // ... existing scan handler code ...
        },
        (errorMessage) => {
          // ... existing error handler code ...
        }
      );

      setIsRequestingEditPermission(false);
    } catch (error) {
      console.error("Failed to initialize scanner:", error);
      toast.error("Failed to initialize scanner. Please try again.");
      setIsRequestingEditPermission(false);
      setShowEditScanner(false);
    }
  };

  // Cleanup edit scanner when component unmounts or edit modal closes
  useEffect(() => {
    return () => {
      stopEditScanner();
    };
  }, []);

  // Add this useEffect to clean up the scanner when modal closes
  useEffect(() => {
    if (!showEditScanner && editScannerRef.current?.html5QrcodeScanner) {
      try {
        editScannerRef.current.html5QrcodeScanner.clear();
      } catch (error) {
        console.warn("Error cleaning up edit scanner:", error);
      }
    }
  }, [showEditScanner]);
  const startScanner = async () => {
    setIsRequestingPermission(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });

      stream.getTracks().forEach((track) => track.stop());

      const permissionRequest = document.getElementById(
        styles.inventoryCameraPermissionRequest
      );
      const qrReader = document.getElementById(styles.inventoryQrReader);

      if (permissionRequest && qrReader) {
        if (permissionRequest) permissionRequest.style.display = "none";
        if (qrReader) qrReader.style.display = "block";
      }

      if (
        document.getElementById(styles.inventoryQrReader) &&
        !qrScannerRef.current?.html5QrcodeScanner
      ) {
        qrScannerRef.current = {
          html5QrcodeScanner: new Html5QrcodeScanner(
            styles.inventoryQrReader,
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
            },
            false
          ),
        };

        qrScannerRef.current.html5QrcodeScanner.render(
          async (decodedText) => {
            console.log("Scanned barcode:", decodedText);

            try {
              const { data, error } = await supabase
                .from("inventory")
                .select("*")
                .eq("item_code", decodedText)
                .single();

              if (error && error.code !== "PGRST116") throw error;

              if (data) {
                // Show modal instead of toast
                showScanResult("found", `Equipment Found!`, data, decodedText);
              } else {
                // Show modal for not found
                showScanResult(
                  "not_found",
                  `No existing equipment found with barcode: ${decodedText}`,
                  null,
                  decodedText
                );
              }

              stopScanner();
            } catch (err) {
              console.error("Error fetching equipment:", err);
              // Show modal for error
              showScanResult(
                "not_found",
                `Scanned barcode: ${decodedText}\n\nEnter equipment details manually.`,
                null,
                decodedText
              );
              stopScanner();
            }
          },
          (errorMessage) => {
            if (
              !errorMessage.includes("NotFoundException") &&
              !errorMessage.includes("No MultiFormat Readers")
            ) {
              console.log("Scan status:", errorMessage);
            }
          }
        );
      }
    } catch (error) {
      console.error("Camera permission denied:", error);
      handleCameraError(error);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleCameraError = (error) => {
    const permissionRequest = document.getElementById(
      styles.inventoryCameraPermissionRequest
    );
    if (permissionRequest) {
      permissionRequest.innerHTML = `
      <div class="${styles.inventoryPermissionIcon}">❌</div>
      <h4>Camera Access Denied</h4>
      <p>Unable to access camera. Please ensure you've granted camera permissions and that no other app is using the camera.</p>
      <div class="${styles.inventoryPermissionTroubleshoot}">
        <p><strong>To fix this:</strong></p>
        <ul>
          <li>Check browser permissions</li>
          <li>Ensure no other app is using the camera</li>
          <li>Try refreshing the page</li>
        </ul>
      </div>
      <button class="${styles.inventoryRequestPermissionBtn} ${styles.inventoryRetryBtn}" onclick="window.location.reload()">
        Retry Camera Access
      </button> 
    `;
      permissionRequest.style.display = "block";
    }
  };

  const showDeleteWarning = (item) => {
    toast.error(
      <div style={{ padding: "10px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "20px",
              marginRight: "10px",
            }}
          >
            🚫
          </span>
          <strong style={{ fontSize: "16px" }}>Cannot Delete Equipment</strong>
        </div>

        <div
          style={{
            fontSize: "14px",
            lineHeight: "1.4",
            marginBottom: "10px",
          }}
        >
          <strong>{item.item_name}</strong> is currently under inspection.
          <br />
          Equipment cannot be deleted while undergoing inspection or clearance
          process.
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#666",
            backgroundColor: "#f8f9fa",
            padding: "8px",
            borderRadius: "4px",
            borderLeft: "3px solid #1060af",
          }}
        >
          <strong>Item Code:</strong> {item.item_code}
          <br />
          <strong>Assigned To:</strong> {item.assigned_to || "Unassigned"}
        </div>

        <div
          style={{
            fontSize: "12px",
            marginTop: "10px",
            fontStyle: "italic",
          }}
        >
          Please complete the inspection before deleting this equipment.
        </div>
      </div>,
      {
        autoClose: 8000,
        closeButton: true,
        position: "top-center",
      }
    );
  };

  const showBarcode = async (itemCode, itemName) => {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("item_code", itemCode)
        .single();

      if (error) throw error;

      setSelectedBarcode({
        code: itemCode,
        name: itemName,
        details: data,
      });
      setShowBarcodeModal(true);
    } catch (err) {
      console.error("Error fetching item details:", err);
      setSelectedBarcode({
        code: itemCode,
        name: itemName,
        details: null,
      });
      setShowBarcodeModal(true);
    }
  };

  const downloadBarcode = async (itemCode, itemName) => {
    try {
      let equipmentDetails = null;
      try {
        const { data } = await supabase
          .from("inventory")
          .select("*")
          .eq("item_code", itemCode)
          .single();
        equipmentDetails = data;
      } catch (err) {
        console.log("Could not fetch equipment details:", err);
      }

      const barcodeImage = await generateBarcodeImage(
        itemCode,
        itemName,
        equipmentDetails
      );

      if (barcodeImage) {
        const link = document.createElement("a");
        link.href = barcodeImage;
        link.download = `BFP_Equipment_${itemCode.replace(
          /[^a-z0-9]/gi,
          "_"
        )}.png`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Barcode downloaded successfully!");
      }
    } catch (error) {
      console.error("Error downloading barcode:", error);

      try {
        const simpleBarcode = await generateSimpleBarcode(itemCode);
        const link = document.createElement("a");
        link.href = simpleBarcode;
        link.download = `BFP_Barcode_${itemCode.replace(
          /[^a-z0-9]/gi,
          "_"
        )}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Simple barcode downloaded!");
      } catch (fallbackError) {
        console.error("Fallback barcode generation failed:", fallbackError);
        toast.error("Error downloading barcode. Please try again.");
      }
    }
  };

  useEffect(() => {
    if (showBarcodeModal && selectedBarcode) {
      const canvas = document.getElementById("barcode-canvas");
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        jsbarcode(canvas, selectedBarcode.code, {
          format: "CODE128",
          displayValue: true,
          fontSize: 16,
          textMargin: 10,
          margin: 10,
          width: 2,
          height: 70,
        });
      }
    }
  }, [showBarcodeModal, selectedBarcode]);

  // PRELOADER CONDITIONAL RENDERING
  if (!showContent) {
    return (
      <BFPPreloader
        loading={isInitializing}
        progress={loadingProgress}
        moduleTitle="INVENTORY CONTROL SYSTEM • Loading Equipment Data..."
        onRetry={() => {
          setIsInitializing(true);
          setShowContent(false);
          setLoadingProgress(0);

          setTimeout(async () => {
            try {
              await updateLoadingPhase(0, "Checking Authentication");
              await updateLoadingPhase(1, "Loading User Data");
              await updateLoadingPhase(2, "Loading Inventory Data");
              await loadInventory();

              await updateLoadingPhase(3, "Loading Personnel Data");
              await loadPersonnel();

              await updateLoadingPhase(4, "Loading Clearance Requests");

              await updateLoadingPhase(5, "Setting Up System");

              setIsInitializing(false);
              setTimeout(() => setShowContent(true), 300);
            } catch (error) {
              console.error("Retry failed:", error);
              setIsInitializing(false);
              setShowContent(true);
            }
          }, 1000);
        }}
      />
    );
  }

  return (
    <div className={styles.inventoryAppContainer}>
      <Title>Inventory Control | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <Sidebar />

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

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1>Inventory Control</h1>
        <div className={styles.inventoryTopControls}>
          <button
            id={styles.inventoryAddEquipmentBtn}
            className={styles.inventoryAddBtn}
            onClick={openAddSidebar}
          >
            + Add Equipment
          </button>

          <div className={styles.inventoryTableHeader}>
            <select
              className={styles.inventoryFilterCategory}
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Categories</option>
              <option>Firefighting Equipment</option>
              <option>Protective Gear</option>
              <option>Vehicle Equipment</option>
              <option>Communication Equipment</option>
              <option>Medical Equipment</option>
              <option>Tools</option>
            </select>

            <select
              className={styles.inventoryFilterStatus}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Status</option>
              <option>Good</option>
              <option>Needs Maintenance</option>
              <option>Damaged</option>
              <option>Lost</option>
            </select>

            <input
              type="text"
              className={styles.inventorySearchBar}
              placeholder="🔍 Search equipment..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
        <div
          id={styles.inventorySummary}
          style={{ display: "flex", gap: 20, margin: 20 }}
        >
          <button
            className={`${styles.inventorySummaryCard} ${
              styles.inventoryTotal
            } ${currentFilterCard === "total" ? styles.inventoryActive : ""}`}
            data-filter="total"
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Items</h3>
            <p id={styles.inventoryTotalItems}>{totalItems}</p>
          </button>
          <button
            className={`${styles.inventorySummaryCard} ${
              styles.inventoryAssigned
            } ${
              currentFilterCard === "assigned" ? styles.inventoryActive : ""
            }`}
            data-filter="assigned"
            onClick={() => handleCardClick("assigned")}
          >
            <h3>Assigned</h3>
            <p id={styles.inventoryAssignedItems}>{assignedItems}</p>
          </button>
          <button
            className={`${styles.inventorySummaryCard} ${
              styles.inventoryStorage
            } ${currentFilterCard === "storage" ? styles.inventoryActive : ""}`}
            data-filter="storage"
            onClick={() => handleCardClick("storage")}
          >
            <h3>In Storage</h3>
            <p id={styles.inventoryStorageItems}>{storageItems}</p>
          </button>
        </div>
        {isAddSidebarOpen && (
          <div
            className={styles.inventoryRightSidebarOverlay}
            onClick={closeAddSidebar}
          >
            <div
              className={styles.inventoryRightSidebar}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.inventorySidebarHeader}>
                <h3>Add New Equipment</h3>
                <button
                  className={styles.inventoryCloseBtn}
                  onClick={closeAddSidebar}
                >
                  &times;
                </button>
              </div>
              <form
                className={styles.inventorySidebarForm}
                onSubmit={handleAddSubmit}
              >
                <div className={styles.inventoryFormSection}>
                  <h3>Equipment Details</h3>

                  <div className={styles.inventoryInputGroup}>
                    <input
                      id={styles.inventoryAddItemName}
                      type="text"
                      required
                      value={newItem.itemName}
                      onChange={(e) =>
                        setNewItem((s) => ({ ...s, itemName: e.target.value }))
                      }
                      placeholder=" "
                    />
                    <h4>Equipment Name</h4>
                  </div>

                  <div className={styles.inventoryInputGroup}>
                    <div className={styles.inventoryBarcodeGrid}>
                      <input
                        id={styles.inventoryAddItemCode}
                        type="text"
                        required
                        value={newItem.itemCode}
                        onChange={(e) =>
                          setNewItem((s) => ({
                            ...s,
                            itemCode: e.target.value,
                          }))
                        }
                        placeholder=""
                      />
                      <h4>Barcode</h4>
                      <button
                        type="button"
                        className={styles.inventoryQrScannerBtn}
                        onClick={() => {
                          setShowScanner(true);
                          startScanner();
                        }}
                      >
                        📷 Scan
                      </button>
                    </div>
                  </div>
                  <div className={styles.inventoryInputGroup}>
                    <select
                      id={styles.inventoryAddCategory}
                      required
                      value={newItem.category}
                      onChange={(e) =>
                        handleAddSelectChange("category", e.target.value)
                      }
                      className={floatingLabels.category ? styles.floating : ""}
                    >
                      <option value="" disabled hidden></option>
                      <option value="Firefighting Equipment">
                        Firefighting Equipment
                      </option>
                      <option value="Protective Gear">Protective Gear</option>
                      <option value="Vehicle Equipment">
                        Vehicle Equipment
                      </option>
                      <option value="Communication Equipment">
                        Communication Equipment
                      </option>
                      <option value="Medical Equipment">
                        Medical Equipment
                      </option>
                      <option value="Tools">Tools</option>
                    </select>
                    <h4>Select Category</h4>
                  </div>
                  <div className={styles.inventoryInputGroup}>
                    <input
                      id={styles.inventoryAddPrice}
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItem.price}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty string or valid number
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                          setNewItem((s) => ({ ...s, price: value }));
                        }
                      }}
                      placeholder="0.00"
                    />
                    <h4>Price (₱)</h4>
                    {newItem.price && isNaN(parseFloat(newItem.price)) && (
                      <small style={{ color: "#dc3545", fontSize: "12px" }}>
                        Please enter a valid number
                      </small>
                    )}
                  </div>
                </div>

                <div className={styles.inventoryFormSection}>
                  <h3>Status & Assignment</h3>

                  <div className={styles.inventoryInputGroup}>
                    <select
                      id={styles.inventoryAddStatus}
                      required
                      value={newItem.status}
                      onChange={(e) =>
                        handleAddSelectChange("status", e.target.value)
                      }
                      className={floatingLabels.status ? styles.floating : ""}
                    >
                      <option value="" disabled hidden></option>
                      <option value="Good">Good</option>
                      <option value="Needs Maintenance">
                        Needs Maintenance
                      </option>
                      <option value="Damaged">Damaged</option>
                      <option value="Lost">Lost</option>
                    </select>
                    <h4>Status</h4>
                  </div>

                  {/* ========== CHANGED: AssignedTo dropdown in Add Form ========== */}
                  <div className={styles.inventoryInputGroup}>
                    <select
                      id={styles.inventoryAddAssignedTo}
                      required
                      value={newItem.assignedTo}
                      onChange={(e) =>
                        handleAddSelectChange("assignedTo", e.target.value)
                      }
                      className={
                        floatingLabels.assignedTo ? styles.floating : ""
                      }
                    >
                      <option value="" disabled hidden></option>
                      <option value="unassigned">Unassigned</option>{" "}
                      {/* CHANGED: lowercase */}
                      {personnel.map((person) => {
                        const hasActiveClearance =
                          checkPersonnelHasActiveClearance(person.id);
                        return (
                          <option
                            key={person.id}
                            value={person.id} // CHANGED: Use ID instead of name
                            disabled={hasActiveClearance}
                            title={
                              hasActiveClearance
                                ? "Personnel has active clearance request - Cannot assign equipment"
                                : ""
                            }
                          >
                            {person.first_name} {person.last_name}
                            {person.badge_number
                              ? ` (${person.badge_number})`
                              : ""}
                            {hasActiveClearance
                              ? " - Has active clearance request"
                              : ""}
                          </option>
                        );
                      })}
                    </select>
                    <h4>Assign to Personnel</h4>
                    {newItem.assignedTo &&
                      newItem.assignedTo !== "unassigned" &&
                      checkPersonnelHasActiveClearance(newItem.assignedTo) && ( // CHANGED: Use ID directly
                        <div className={styles.clearanceNotice}>
                          ⚠️ This personnel has an active clearance request.
                          Equipment assignment is not allowed.
                        </div>
                      )}
                  </div>
                </div>
                <div className={styles.inventoryFormSection}>
                  <h3>Dates</h3>
                  {(!newItem.assignedTo ||
                    newItem.assignedTo === "unassigned") && (
                    <div className={styles.inventoryInputGroup}>
                      <Flatpickr
                        id={styles.inventoryAddUnassignedDate}
                        type="date"
                        value={newItem.unassignedDate}
                        onChange={(dates) => {
                          if (dates && dates[0]) {
                            // FIX: Use local date format instead of ISO string
                            const date = dates[0];
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(
                              2,
                              "0"
                            );
                            const day = String(date.getDate()).padStart(2, "0");
                            const dateStr = `${year}-${month}-${day}`;
                            setNewItem((s) => ({
                              ...s,
                              unassignedDate: dateStr,
                            }));
                          } else {
                            setNewItem((s) => ({ ...s, unassignedDate: "" }));
                          }
                        }}
                        options={{
                          dateFormat: "Y-m-d",
                          maxDate: "today",
                          defaultDate: newItem.unassignedDate || null,
                        }}
                        placeholder="Select date"
                      />
                      <h4>Unassigned Date (Optional)</h4>
                      <p className={styles.dateHint}>
                        Date equipment was returned to storage
                      </p>
                    </div>
                  )}
                  {/* NEW: Assigned Date field */}
                  {newItem.assignedTo &&
                    newItem.assignedTo !== "unassigned" && (
                      <div className={styles.inventoryInputGroup}>
                        <Flatpickr
                          id={styles.inventoryAddAssignedDate}
                          type="date"
                          value={newItem.assignedDate}
                          onChange={(dates) => {
                            if (dates && dates[0]) {
                              // FIX: Use local date format instead of ISO string
                              const date = dates[0];
                              const year = date.getFullYear();
                              const month = String(
                                date.getMonth() + 1
                              ).padStart(2, "0");
                              const day = String(date.getDate()).padStart(
                                2,
                                "0"
                              );
                              const dateStr = `${year}-${month}-${day}`;
                              setNewItem((s) => ({
                                ...s,
                                assignedDate: dateStr,
                              }));
                            } else {
                              setNewItem((s) => ({ ...s, assignedDate: "" }));
                            }
                          }}
                          options={{
                            dateFormat: "Y-m-d",
                            maxDate: "today",
                            defaultDate: newItem.assignedDate || null,
                          }}
                          placeholder="Select date"
                        />
                        <h4>Assigned Date</h4>
                        <small className={styles.dateHint}>
                          (Optional and it will automatically added the current
                          date)
                        </small>
                      </div>
                    )}

                  <div className={styles.inventoryInputGroup}>
                    <Flatpickr
                      id={styles.inventoryAddPurchaseDate}
                      type="date"
                      required
                      value={newItem.purchaseDate}
                      onChange={(dates) => {
                        if (dates && dates[0]) {
                          // FIX: Use local date format instead of ISO string
                          const date = dates[0];
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(
                            2,
                            "0"
                          );
                          const day = String(date.getDate()).padStart(2, "0");
                          const dateStr = `${year}-${month}-${day}`;
                          setNewItem((s) => ({ ...s, purchaseDate: dateStr }));
                        } else {
                          setNewItem((s) => ({ ...s, purchaseDate: "" }));
                        }
                      }}
                      options={{
                        dateFormat: "Y-m-d",
                        maxDate: "today",
                        defaultDate: newItem.purchaseDate || null,
                      }}
                      placeholder="Select date"
                    />
                    <h4>Purchase Date</h4>
                  </div>

                  <div className={styles.inventoryInputGroup}>
                    <Flatpickr
                      id={styles.inventoryAddLastChecked}
                      type="date"
                      required
                      value={newItem.lastChecked}
                      onChange={(dates) => {
                        if (dates && dates[0]) {
                          // FIX: Use local date format instead of ISO string
                          const date = dates[0];
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(
                            2,
                            "0"
                          );
                          const day = String(date.getDate()).padStart(2, "0");
                          const dateStr = `${year}-${month}-${day}`;
                          setNewItem((s) => ({ ...s, lastChecked: dateStr }));
                        } else {
                          setNewItem((s) => ({ ...s, lastChecked: "" }));
                        }
                      }}
                      options={{
                        dateFormat: "Y-m-d",
                        maxDate: "today",
                        defaultDate: newItem.lastChecked || null,
                      }}
                      placeholder="Select date"
                    />
                    <h4>Last Checked</h4>
                  </div>
                </div>

                <div className={styles.inventorySidebarActions}>
                  <button
                    type="submit"
                    className={styles.inventorySubmitBtn}
                    disabled={isProcessingAdd}
                  >
                    {isProcessingAdd ? (
                      <>
                        <span className={styles.inventorySpinner}></span>
                        Adding Equipment...
                      </>
                    ) : (
                      "Add Equipment"
                    )}
                  </button>
                  <button
                    className={styles.inventoryCancelBtn}
                    type="button"
                    onClick={closeAddSidebar}
                    disabled={isProcessingAdd}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Table */}
        <div
          className={`${styles.inventoryPaginationContainer} ${styles.inventoryTopPagination}`}
        >
          {renderPaginationButtons()}
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.inventoryTable}>
            <thead>
              <tr>
                <th>Equipment Name</th>
                <th>Barcode</th>
                <th>Category</th>
                <th>Status</th>
                <th className={styles.rankHeader}>Assigned Personnel</th>
                <th>Assigned Date</th>
                <th className={styles.rankHeader}>Last Assigned</th>
                <th>Unassigned Date</th>
                <th>Purchase Date</th>
                <th>Last Checked</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id={styles.inventoryTableBody}>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan="20"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>🛠️</span>
                    </div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#2b2b2b",
                        marginBottom: "8px",
                      }}
                    >
                      No Equipment Found
                    </h3>
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      Ready to serve but no equipment in inventory yet
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.item_name}
                      {item.under_inspection && (
                        <span
                          className={styles.inspectionBadge}
                          title="Equipment currently undergoing inspection or clearance process"
                          style={{
                            cursor: "help",
                            animation: "pulse 2s infinite",
                          }}
                        >
                          🔒 Inspection in Progress
                        </span>
                      )}
                    </td>
                    <td>
                      <div className={styles.barcodeCell}>
                        <span className={styles.barcodeText}>
                          {item.item_code}
                        </span>
                        <button
                          className={styles.barcodeViewBtn}
                          onClick={() =>
                            showBarcode(item.item_code, item.item_name)
                          }
                        >
                          📄 View Barcode
                        </button>
                        <button
                          className={styles.barcodeDownloadBtn}
                          onClick={() =>
                            downloadBarcode(item.item_code, item.item_name)
                          }
                        >
                          ⬇️ Download
                        </button>
                      </div>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.status}</td>
                    <td className={styles.rankCellColumn}>
                      <div className={styles.rankCell}>
                        {item.assigned_to &&
                        item.assigned_to !== "Unassigned" ? (
                          <>
                            {/* Get personnel info for rank image */}
                            {(() => {
                              const assignedPersonnel = personnel.find(
                                (p) =>
                                  `${p.first_name} ${p.last_name}` ===
                                    item.assigned_to ||
                                  p.id === item.assigned_personnel_id
                              );

                              if (
                                assignedPersonnel &&
                                assignedPersonnel.rank_image
                              ) {
                                return (
                                  <>
                                    <img
                                      src={assignedPersonnel.rank_image}
                                      alt={assignedPersonnel.rank || "Rank"}
                                      className={styles.rankImage}
                                      onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.style.display = "none";
                                        // Show the placeholder when image fails to load
                                        const placeholder =
                                          e.target.parentNode.querySelector(
                                            `.${styles.rankPlaceholder}`
                                          );
                                        if (placeholder)
                                          placeholder.style.display = "flex";
                                      }}
                                    />
                                    <div
                                      className={`${styles.rankPlaceholder} ${styles.hidden}`}
                                    >
                                      <span
                                        className={styles.rankPlaceholderText}
                                      >
                                        {assignedPersonnel.rank?.charAt(0) ||
                                          "R"}
                                      </span>
                                    </div>
                                  </>
                                );
                              }

                              // Show placeholder if no rank image
                              return (
                                <div
                                  className={`${styles.rankPlaceholder} ${styles.show}`}
                                >
                                  <span className={styles.rankPlaceholderText}>
                                    {(() => {
                                      const name = item.assigned_to;
                                      return name?.charAt(0) || "U";
                                    })()}
                                  </span>
                                </div>
                              );
                            })()}

                            <span className={styles.rankText}>
                              {item.assigned_to}
                            </span>
                          </>
                        ) : (
                          // If unassigned, just show the text
                          <span>Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {item.assigned_date
                        ? formatDate(item.assigned_date)
                        : "N/A"}
                    </td>
                    <td className={styles.rankCellColumn}>
                      <div className={styles.rankCell}>
                        {item.last_assigned &&
                        item.last_assigned.trim() !== "" &&
                        item.last_assigned !== "Unassigned" &&
                        item.last_assigned !== "N/A" ? (
                          <>
                            {/* Get personnel info for rank image */}
                            {(() => {
                              // Try to find the personnel by name in last_assigned field
                              const lastAssignedPersonnel = personnel.find(
                                (p) =>
                                  `${p.first_name} ${p.last_name}` ===
                                  item.last_assigned
                              );

                              if (
                                lastAssignedPersonnel &&
                                lastAssignedPersonnel.rank_image
                              ) {
                                return (
                                  <>
                                    <img
                                      src={lastAssignedPersonnel.rank_image}
                                      alt={lastAssignedPersonnel.rank || "Rank"}
                                      className={styles.rankImage}
                                      onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.style.display = "none";
                                        // Show the placeholder when image fails to load
                                        const placeholder =
                                          e.target.parentNode.querySelector(
                                            `.${styles.rankPlaceholder}`
                                          );
                                        if (placeholder)
                                          placeholder.style.display = "flex";
                                      }}
                                    />
                                    <div
                                      className={`${styles.rankPlaceholder} ${styles.hidden}`}
                                    >
                                      <span
                                        className={styles.rankPlaceholderText}
                                      >
                                        {lastAssignedPersonnel.rank?.charAt(
                                          0
                                        ) || "R"}
                                      </span>
                                    </div>
                                  </>
                                );
                              }

                              // Show placeholder if no rank image found
                              return (
                                <div
                                  className={`${styles.rankPlaceholder} ${styles.show}`}
                                >
                                  <span className={styles.rankPlaceholderText}>
                                    {item.last_assigned?.charAt(0) || "L"}
                                  </span>
                                </div>
                              );
                            })()}

                            <span className={styles.rankText}>
                              {item.last_assigned}
                            </span>
                          </>
                        ) : (
                          // If no last assigned, show N/A
                          <span className={styles.spanning}>N/A</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {item.unassigned_date
                        ? formatDate(item.unassigned_date)
                        : "N/A"}
                    </td>
                    <td>{formatDate(item.purchase_date)}</td>
                    <td>{formatDate(item.last_checked)}</td>
                    <td>
                      {item.price && !isNaN(parseFloat(item.price))
                        ? new Intl.NumberFormat("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          }).format(parseFloat(item.price))
                        : "₱0.00"}
                    </td>
                    <td>
                      <button
                        className={styles.inventoryEditBtn}
                        onClick={() => openEditModal(item)}
                      >
                        Edit
                      </button>
                      <button
                        className={`${styles.inventoryDeleteBtn} ${
                          item.under_inspection ? styles.disabledDeleteBtn : ""
                        }`}
                        onClick={() => {
                          if (!item.under_inspection) {
                            confirmDelete(item.id);
                          } else {
                            showDeleteWarning(item);
                          }
                        }}
                        disabled={item.under_inspection}
                        title={
                          item.under_inspection
                            ? "Cannot delete equipment while under inspection"
                            : "Delete equipment"
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.tableBottomPagination}>
          {renderPaginationButtons()}
        </div>

        {isDeleteOpen && (
          <div
            className={styles.inventoryModalDeleteOverlay}
            style={{ display: "flex" }}
            onClick={(e) => {
              if (
                e.target.className.includes(styles.inventoryModalDeleteOverlay)
              )
                cancelDelete();
            }}
          >
            <div
              className={styles.inventoryModalDeleteContent}
              style={{ maxWidth: "450px" }}
            >
              <div className={styles.inventoryModalDeleteHeader}>
                <h2 style={{ marginLeft: "30px" }}>Confirm Deletion</h2>
                <span
                  className={styles.inventoryModalDeleteCloseBtn}
                  onClick={cancelDelete}
                >
                  &times;
                </span>
              </div>

              <div className={styles.inventoryModalDeleteBody}>
                <div className={styles.inventoryDeleteConfirmationContent}>
                  <div className={styles.inventoryDeleteWarningIcon}>⚠️</div>
                  <p className={styles.inventoryDeleteConfirmationText}>
                    Are you sure you want to delete the inventory item
                  </p>
                  <p className={styles.inventoryDocumentNameHighlight}>
                    "
                    {inventory.find((item) => item.id === deleteId)
                      ?.item_name || "this item"}
                    "?
                  </p>

                  {inventory.find((item) => item.id === deleteId)
                    ?.under_inspection && (
                    <div className={styles.inspectionDeleteWarning}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          margin: "10px 0",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "16px",
                            marginRight: "8px",
                          }}
                        >
                          🔒
                        </span>
                        <strong style={{ color: "#dc3545" }}>
                          Equipment is Under Inspection
                        </strong>
                      </div>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#666",
                          margin: "5px 0 15px 0",
                        }}
                      >
                        This equipment is currently undergoing inspection or
                        clearance process. Deleting it may cause data
                        inconsistencies.
                      </p>
                    </div>
                  )}

                  <p className={styles.inventoryDeleteWarning}>
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className={styles.inventoryModalDeleteActions}>
                <button
                  className={`${styles.inventoryModalDeleteBtn} ${styles.inventoryModalCancelBtn}`}
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.inventoryModalDeleteBtn} ${styles.inventoryDeleteConfirmBtn}`}
                  onClick={performDelete}
                  disabled={
                    inventory.find((item) => item.id === deleteId)
                      ?.under_inspection
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditOpen && (
          <div className={styles.modalContainer}>
            <div
              className={`${styles.inventoryEditModalOverlay} ${styles.show}`}
              onClick={closeEditModal}
            >
              <div
                className={styles.inventoryModalWrapper}
                style={{
                  marginLeft: isSidebarCollapsed ? "80px" : "250px",
                  width: isSidebarCollapsed
                    ? "calc(100% -190px)"
                    : "calc(100% - 750px)",
                }}
              >
                <div
                  className={styles.inventoryModalContainer}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.inventoryModalHeader}>
                    <h3 className={styles.inventoryModalTitle}>
                      Edit Equipment
                    </h3>
                    <button
                      className={styles.inventoryModalCloseBtn}
                      onClick={closeEditModal}
                    >
                      &times;
                    </button>
                  </div>

                  <form
                    id={styles.inventoryEditEquipmentForm}
                    className={styles.inventoryModalForm}
                    onSubmit={handleEditSubmit}
                  >
                    <div className={styles.inventoryModalSection}>
                      <h3 className={styles.inventoryModalSectionTitle}>
                        Equipment Details
                      </h3>

                      <div className={styles.inventoryModalInputRow}>
                        <div
                          className={`${styles.inventoryModalInputGroup} ${styles.fullWidth}`}
                        >
                          <input
                            id={styles.inventoryEditItemName}
                            type="text"
                            required
                            value={editItem.itemName}
                            onChange={(e) =>
                              setEditItem((s) => ({
                                ...s,
                                itemName: e.target.value,
                              }))
                            }
                            placeholder=" "
                            className={styles.inventoryModalInput}
                          />
                          <h4 className={styles.inventoryModalInputLabel}>
                            Equipment Name
                          </h4>
                        </div>
                        <div className={styles.inventoryModalBarcodeGroup}>
                          <div
                            className={styles.inventoryModalBarcodeContainer}
                          >
                            <input
                              id={styles.inventoryEditItemCode}
                              type="text"
                              required
                              value={editItem.itemCode}
                              onChange={(e) =>
                                setEditItem((s) => ({
                                  ...s,
                                  itemCode: e.target.value,
                                }))
                              }
                              placeholder=" "
                              className={styles.inventoryModalInput}
                            />
                            <h4
                              className={styles.inventoryModalInputLabelBarCode}
                            >
                              Barcode
                            </h4>

                            <button
                              type="button"
                              className={styles.inventoryModalScanBtn}
                              onClick={() => {
                                startEditScanner();
                              }}
                            >
                              📷 Scan
                            </button>
                          </div>
                        </div>
                        <div className={styles.inventoryModalInputGroup}>
                          <select
                            id={styles.inventoryEditCategory}
                            required
                            value={editItem.category}
                            onChange={(e) =>
                              handleEditSelectChange("category", e.target.value)
                            }
                            className={`${styles.inventoryModalSelect} ${
                              editFloatingLabels.category ? styles.floating : ""
                            }`}
                          >
                            <option value="" disabled hidden>
                              Select Category
                            </option>
                            <option value="Firefighting Equipment">
                              Firefighting Equipment
                            </option>
                            <option value="Protective Gear">
                              Protective Gear
                            </option>
                            <option value="Vehicle Equipment">
                              Vehicle Equipment
                            </option>
                            <option value="Communication Equipment">
                              Communication Equipment
                            </option>
                            <option value="Medical Equipment">
                              Medical Equipment
                            </option>
                            <option value="Tools">Tools</option>
                          </select>
                          <h4 className={styles.inventoryModalInputLabel}>
                            Category
                          </h4>
                        </div>
                        <div className={styles.inventoryModalInputGroup}>
                          <select
                            id={styles.inventoryEditStatus}
                            required
                            value={editItem.status}
                            onChange={(e) =>
                              handleEditSelectChange("status", e.target.value)
                            }
                            className={`${styles.inventoryModalSelect} ${
                              editFloatingLabels.status ? styles.floating : ""
                            }`}
                          >
                            <option value="" disabled hidden>
                              Select Status
                            </option>
                            <option value="Good">Good</option>
                            <option value="Needs Maintenance">
                              Needs Maintenance
                            </option>
                            <option value="Damaged">Damaged</option>
                            <option value="Lost">Lost</option>
                          </select>
                          <h4 className={styles.inventoryModalInputLabel}>
                            Status
                          </h4>
                        </div>
                        <div className={styles.inventoryModalInputGroup}>
                          <input
                            id={styles.inventoryEditPrice}
                            type="number"
                            step="0.01"
                            min="0"
                            value={editItem.price}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Allow empty string or valid number
                              if (value === "" || /^\d*\.?\d*$/.test(value)) {
                                setEditItem((s) => ({ ...s, price: value }));
                              }
                            }}
                            placeholder="0.00"
                            className={styles.inventoryModalInput}
                          />
                          <h4 className={styles.inventoryModalInputLabel}>
                            Price (₱)
                          </h4>
                          {editItem.price &&
                            isNaN(parseFloat(editItem.price)) && (
                              <small
                                style={{
                                  color: "#dc3545",
                                  fontSize: "12px",
                                  marginTop: "4px",
                                }}
                              >
                                Please enter a valid number
                              </small>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* ========== CHANGED: Assignment section in Edit Modal ========== */}
                    <div className={styles.inventoryModalSection}>
                      <h3 className={styles.inventoryModalSectionTitle}>
                        Assignment
                        {isUnderInspection && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#dc3545",
                              marginLeft: "10px",
                              fontWeight: "normal",
                            }}
                          >
                            (Locked - Equipment Under Inspection)
                          </span>
                        )}
                      </h3>

                      <div className={styles.inventoryModalInputRow}>
                        <div
                          className={`${styles.inventoryModalInputGroup} ${
                            styles.fullWidth
                          } ${isUnderInspection ? styles.disabledField : ""}`}
                          title={
                            isUnderInspection
                              ? "Cannot change assignment while equipment is under inspection"
                              : ""
                          }
                        >
                          <select
                            id={styles.inventoryEditAssignedTo}
                            required
                            value={editItem.assignedTo}
                            onChange={(e) =>
                              handleEditSelectChange(
                                "assignedTo",
                                e.target.value
                              )
                            }
                            className={`${styles.inventoryModalSelect} ${
                              editFloatingLabels.assignedTo
                                ? styles.floating
                                : ""
                            } ${
                              isUnderInspection ? styles.disabledSelect : ""
                            }`}
                            disabled={isUnderInspection}
                          >
                            <option value="" disabled hidden>
                              Assign to Personnel
                            </option>
                            <option value="unassigned">Unassigned</option>{" "}
                            {/* CHANGED: lowercase */}
                            {personnel.map((person) => {
                              const hasActiveClearance =
                                checkPersonnelHasActiveClearance(person.id);
                              const isCurrentlyAssigned =
                                editItem.assignedTo === person.id; // CHANGED: Compare by ID

                              return (
                                <option
                                  key={person.id}
                                  value={person.id} // CHANGED: Use ID instead of name
                                  disabled={
                                    hasActiveClearance && !isCurrentlyAssigned
                                  }
                                  title={
                                    hasActiveClearance && !isCurrentlyAssigned
                                      ? "Personnel has active clearance request - Cannot assign equipment"
                                      : hasActiveClearance
                                      ? "Currently assigned but has active clearance request"
                                      : ""
                                  }
                                >
                                  {person.first_name} {person.last_name}
                                  {person.badge_number
                                    ? ` (${person.badge_number})`
                                    : ""}
                                  {hasActiveClearance && !isCurrentlyAssigned
                                    ? " - Has active clearance request"
                                    : ""}
                                  {hasActiveClearance && isCurrentlyAssigned
                                    ? " - Currently assigned (has clearance)"
                                    : ""}
                                </option>
                              );
                            })}
                          </select>
                          <h4 className={styles.inventoryModalInputLabel}>
                            Assign to Personnel
                            {isUnderInspection && (
                              <span
                                style={{
                                  color: "#dc3545",
                                  fontSize: "11px",
                                  marginLeft: "5px",
                                }}
                              >
                                🔒 Locked
                              </span>
                            )}
                          </h4>
                          {editItem.assignedTo &&
                            editItem.assignedTo !== "unassigned" &&
                            checkPersonnelHasActiveClearance(
                              editItem.assignedTo
                            ) && ( // CHANGED: Use ID directly
                              <div className={styles.clearanceNotice}>
                                ⚠️ This personnel has an active clearance
                                request. Equipment assignment changes are not
                                allowed.
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.inventoryModalSection}>
                      <h3 className={styles.inventoryModalSectionTitle}>
                        Additional Information
                      </h3>

                      <div className={styles.inventoryModalInputRow}>
                        <div className={styles.inventoryModalInputGroup}>
                          <input
                            id={styles.inventoryEditLastAssigned}
                            type="text"
                            value={editItem.lastAssigned}
                            onChange={(e) =>
                              setEditItem((s) => ({
                                ...s,
                                lastAssigned: e.target.value,
                              }))
                            }
                            placeholder=" "
                            className={styles.inventoryModalInput}
                          />
                          <h4 className={styles.inventoryModalInputLabel}>
                            Last Assigned Personnel (Optional)
                          </h4>
                        </div>
                      </div>
                    </div>
                    {/* Edit Modal - Dates Section */}
                    <div className={styles.inventoryModalSection}>
                      <h3 className={styles.inventoryModalSectionTitle}>
                        Dates
                      </h3>

                      <div className={styles.inventoryModalInputRow}>
                        {/* NEW: Assigned Date field */}
                        {editItem.assignedTo &&
                          editItem.assignedTo !== "unassigned" && (
                            <div className={styles.inventoryModalInputGroup}>
                              <Flatpickr
                                id={styles.inventoryEditAssignedDate}
                                type="date"
                                value={editItem.assignedDate}
                                onChange={(dates) => {
                                  if (dates && dates[0]) {
                                    // FIX: Use local date format instead of ISO string
                                    const date = dates[0];
                                    const year = date.getFullYear();
                                    const month = String(
                                      date.getMonth() + 1
                                    ).padStart(2, "0");
                                    const day = String(date.getDate()).padStart(
                                      2,
                                      "0"
                                    );
                                    const dateStr = `${year}-${month}-${day}`;
                                    setEditItem((s) => ({
                                      ...s,
                                      assignedDate: dateStr,
                                    }));
                                  } else {
                                    setEditItem((s) => ({
                                      ...s,
                                      assignedDate: "",
                                    }));
                                  }
                                }}
                                options={{
                                  dateFormat: "Y-m-d",
                                  maxDate: "today",
                                  defaultDate: editItem.assignedDate || null,
                                }}
                                placeholder="Select date"
                                className={styles.inventoryModalInput}
                              />
                              <h4 className={styles.inventoryModalInputLabel}>
                                Assigned Date (Optional)
                              </h4>
                            </div>
                          )}
                        {(!editItem.assignedTo ||
                          editItem.assignedTo === "unassigned") && (
                          <div className={styles.inventoryModalInputGroup}>
                            <Flatpickr
                              id={styles.inventoryEditUnassignedDate}
                              type="date"
                              value={editItem.unassignedDate}
                              onChange={(dates) => {
                                if (dates && dates[0]) {
                                  // FIX: Use local date format instead of ISO string
                                  const date = dates[0];
                                  const year = date.getFullYear();
                                  const month = String(
                                    date.getMonth() + 1
                                  ).padStart(2, "0");
                                  const day = String(date.getDate()).padStart(
                                    2,
                                    "0"
                                  );
                                  const dateStr = `${year}-${month}-${day}`;
                                  setEditItem((s) => ({
                                    ...s,
                                    unassignedDate: dateStr,
                                  }));
                                } else {
                                  setEditItem((s) => ({
                                    ...s,
                                    unassignedDate: "",
                                  }));
                                }
                              }}
                              options={{
                                dateFormat: "Y-m-d",
                                maxDate: "today",
                                defaultDate: editItem.unassignedDate || null,
                              }}
                              placeholder="Select date"
                              className={styles.inventoryModalInput}
                            />
                            <h4 className={styles.inventoryModalInputLabel}>
                              Unassigned Date (Optional)
                            </h4>
                            <p className={styles.dateHint}>
                              Date when equipment was returned to storage
                            </p>
                          </div>
                        )}
                        <div className={styles.inventoryModalInputGroup}>
                          <Flatpickr
                            id={styles.inventoryAddPurchaseDate}
                            type="date"
                            required
                            value={newItem.purchaseDate}
                            onChange={(dates) => {
                              if (dates && dates[0]) {
                                // FIX: Use local date format instead of ISO string
                                const date = dates[0];
                                const year = date.getFullYear();
                                const month = String(
                                  date.getMonth() + 1
                                ).padStart(2, "0");
                                const day = String(date.getDate()).padStart(
                                  2,
                                  "0"
                                );
                                const dateStr = `${year}-${month}-${day}`;
                                setNewItem((s) => ({
                                  ...s,
                                  purchaseDate: dateStr,
                                }));
                              } else {
                                setNewItem((s) => ({ ...s, purchaseDate: "" }));
                              }
                            }}
                            options={{
                              dateFormat: "Y-m-d",
                              maxDate: "today",
                              defaultDate: newItem.purchaseDate || null,
                            }}
                            placeholder="Select date"
                            className={styles.inventoryModalInput}
                          />
                          <h4 className={styles.inventoryModalInputLabel}>
                            Purchase Date
                          </h4>
                        </div>

                        <div className={styles.inventoryModalInputGroup}>
                          <Flatpickr
                            id={styles.inventoryEditLastChecked}
                            type="date"
                            required
                            value={editItem.lastChecked}
                            onChange={(dates) => {
                              if (dates && dates[0]) {
                                // FIX: Use local date format instead of ISO string
                                const date = dates[0];
                                const year = date.getFullYear();
                                const month = String(
                                  date.getMonth() + 1
                                ).padStart(2, "0");
                                const day = String(date.getDate()).padStart(
                                  2,
                                  "0"
                                );
                                const dateStr = `${year}-${month}-${day}`;
                                setEditItem((s) => ({
                                  ...s,
                                  lastChecked: dateStr,
                                }));
                              } else {
                                setEditItem((s) => ({ ...s, lastChecked: "" }));
                              }
                            }}
                            options={{
                              dateFormat: "Y-m-d",
                              maxDate: "today",
                              defaultDate: editItem.lastChecked || null,
                            }}
                            placeholder="Select date"
                            className={styles.inventoryModalInput}
                          />
                          <h4 className={styles.inventoryModalInputLabel}>
                            Last Checked
                          </h4>
                        </div>
                      </div>
                    </div>
                    <div className={styles.inventoryModalActions}>
                      <button
                        type="submit"
                        className={styles.inventoryModalSubmitBtn}
                        disabled={isProcessingEdit}
                      >
                        {isProcessingEdit ? (
                          <>
                            <span className={styles.inventorySpinner}></span>
                            Saving Changes...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </button>
                      <button
                        type="button"
                        className={styles.inventoryModalCancelBtn}
                        onClick={closeEditModal}
                        disabled={isProcessingEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QR Scanner Modal */}
        {showScanner && (
          <div
            className={styles.inventoryQrScannerModalOverlay}
            onClick={stopScanner}
          >
            <div
              className={styles.inventoryQrScannerModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.inventoryQrScannerHeader}>
                <h3>Scan Barcode</h3>
                <button
                  className={styles.inventoryCloseBtn}
                  onClick={stopScanner}
                >
                  &times;
                </button>
              </div>
              <div className={styles.inventoryQrScannerContent}>
                <div
                  className={styles.inventoryCameraPermissionRequest}
                  id={styles.inventoryCameraPermissionRequest}
                >
                  <div className={styles.inventoryPermissionIcon}>📷</div>
                  <h4>Camera Access Required</h4>
                  <p>
                    To scan barcodes, we need access to your camera. Please
                    allow camera permissions when prompted.
                  </p>
                  <button
                    className={`${styles.inventoryRequestPermissionBtn} ${
                      isRequestingPermission ? styles.inventoryLoading : ""
                    }`}
                    onClick={startScanner}
                    disabled={isRequestingPermission}
                  >
                    {isRequestingPermission
                      ? "Requesting..."
                      : "Allow Camera Access"}
                  </button>
                </div>

                <div
                  id={styles.inventoryQrReader}
                  className={styles.inventoryQrReader}
                  style={{ display: "none" }}
                ></div>

                <p className={styles.inventoryQrScannerHint}>
                  Point camera at barcode to scan automatically
                </p>
                <div className={styles.inventoryQrScannerActions}>
                  <button
                    className={styles.inventoryCancelScanBtn}
                    onClick={stopScanner}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== NEW: Scan Result Modal ========== */}
        {showScanResultModal && (
          <div
            className={styles.inventoryScanResultModalOverlay}
            onClick={closeScanResultModal}
          >
            <div
              className={styles.inventoryScanResultModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.inventoryScanResultModalHeader}>
                <h3>Scan Result</h3>
                <button
                  className={styles.inventoryScanResultModalCloseBtn}
                  onClick={closeScanResultModal}
                >
                  &times;
                </button>
              </div>

              <div className={styles.inventoryScanResultModalContent}>
                <div
                  className={`${styles.inventoryScanResultIcon} ${
                    scanResult.type === "found"
                      ? styles.successIcon
                      : styles.infoIcon
                  }`}
                >
                  {scanResult.type === "found" ? "✅" : "ℹ️"}
                </div>

                <h4 className={styles.inventoryScanResultTitle}>
                  {scanResult.type === "found"
                    ? "Equipment Found!"
                    : "Scan Result"}
                </h4>

                <div className={styles.inventoryScanResultDetails}>
                  <p className={styles.inventoryScanResultMessage}>
                    {scanResult.message}
                  </p>

                  {scanResult.type === "found" && scanResult.equipmentData && (
                    <div className={styles.inventoryScanResultEquipmentInfo}>
                      <div className={styles.inventoryScanResultInfoRow}>
                        <strong>Equipment Name:</strong>{" "}
                        {scanResult.equipmentData.item_name || "N/A"}
                      </div>
                      <div className={styles.inventoryScanResultInfoRow}>
                        <strong>Category:</strong>{" "}
                        {scanResult.equipmentData.category || "N/A"}
                      </div>
                      <div className={styles.inventoryScanResultInfoRow}>
                        <strong>Status:</strong>{" "}
                        {scanResult.equipmentData.status || "N/A"}
                      </div>
                      <div className={styles.inventoryScanResultInfoRow}>
                        <strong>Assigned To:</strong>{" "}
                        {scanResult.equipmentData.assigned_to || "Unassigned"}
                      </div>
                      <div className={styles.inventoryScanResultInfoRow}>
                        <strong>Scanned Barcode:</strong> {scanResult.barcode}
                      </div>
                    </div>
                  )}

                  {scanResult.type === "not_found" && (
                    <div className={styles.inventoryScanResultNotice}>
                      <p>
                        <strong>Scanned Barcode:</strong> {scanResult.barcode}
                      </p>
                      <p>
                        This barcode does not exist in the system. You can
                        manually enter the equipment details.
                      </p>
                    </div>
                  )}
                </div>

                <div className={styles.inventoryScanResultModalActions}>
                  {scanResult.type === "found" ? (
                    <>
                      {isEditOpen && scanResult.equipmentData?.id === editId ? (
                        <>
                          <button
                            className={styles.inventoryScanResultApplyBtn}
                            onClick={() =>
                              applyScannedData(
                                scanResult.equipmentData,
                                scanResult.barcode,
                                true
                              )
                            }
                          >
                            Apply All Fields
                          </button>
                          <button
                            className={styles.inventoryScanResultApplyBtn}
                            onClick={() =>
                              applyScannedData(
                                scanResult.equipmentData,
                                scanResult.barcode,
                                false
                              )
                            }
                          >
                            Update Barcode Only
                          </button>
                        </>
                      ) : (
                        <button
                          className={styles.inventoryScanResultApplyBtn}
                          onClick={() =>
                            applyScannedData(
                              scanResult.equipmentData,
                              scanResult.barcode
                            )
                          }
                        >
                          Apply to Form
                        </button>
                      )}
                      <button
                        className={styles.inventoryScanResultCancelBtn}
                        onClick={closeScanResultModal}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={styles.inventoryScanResultApplyBtn}
                        onClick={() =>
                          applyScannedData(null, scanResult.barcode)
                        }
                      >
                        Use Barcode Only
                      </button>
                      <button
                        className={styles.inventoryScanResultCancelBtn}
                        onClick={closeScanResultModal}
                      >
                        Close
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal Scanner */}
        {/* Edit Modal Scanner */}
        {showEditScanner && (
          <div
            className={styles.inventoryQrScannerModalOverlay}
            onClick={stopEditScanner}
          >
            <div
              className={styles.inventoryQrScannerModal}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "500px" }}
            >
              <div className={styles.inventoryQrScannerHeader}>
                <h3>
                  <span style={{ color: "#1060af", marginRight: "8px" }}>
                    ✏️
                  </span>
                  Edit Mode - Scan Barcode
                </h3>
                <button
                  className={styles.inventoryCloseBtn}
                  onClick={stopEditScanner}
                >
                  &times;
                </button>
              </div>
              <div className={styles.inventoryQrScannerContent}>
                <div className={styles.inventoryEditScannerInfo}>
                  <p
                    style={{
                      color: "#1060af",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    Currently editing: {editItem.itemName}
                  </p>
                  <p
                    style={{ fontSize: "12px", color: "#666", marginTop: "0" }}
                  >
                    ⚠️ Only scan the SAME equipment's barcode or a NEW barcode
                  </p>
                </div>

                <div
                  style={{
                    width: "100%",
                    minHeight: "300px",
                    backgroundColor: "#000",
                    borderRadius: "8px",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Scanner
                    onScan={handleEditScan}
                    onError={handleEditScanError}
                    constraints={{
                      facingMode: "environment",
                      width: { ideal: 640 },
                      height: { ideal: 480 },
                    }}
                    scanDelay={300}
                    styles={{
                      container: {
                        width: "100%",
                        height: "100%",
                      },
                      video: {
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      },
                    }}
                  />
                </div>

                <p className={styles.inventoryQrScannerHint}>
                  Point camera at the <strong>same equipment's</strong> barcode
                </p>

                <div className={styles.inventoryQrScannerActions}>
                  <button
                    className={styles.inventoryCancelScanBtn}
                    onClick={stopEditScanner}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Barcode Display Modal */}
        {showBarcodeModal && selectedBarcode && (
          <div
            className={styles.barcodeModalOverlay}
            onClick={() => setShowBarcodeModal(false)}
          >
            <div
              className={styles.barcodeModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.barcodeModalHeader}>
                <h3>Equipment Barcode</h3>
                <button
                  className={styles.barcodeModalClose}
                  onClick={() => setShowBarcodeModal(false)}
                >
                  &times;
                </button>
              </div>
              <div className={styles.barcodeModalContent}>
                <div className={styles.barcodeContainer}>
                  <div className={styles.barcodeInfo}>
                    <h4>{selectedBarcode.name}</h4>
                    <div className={styles.barcodeCode}>
                      <strong>Barcode:</strong> {selectedBarcode.code}
                    </div>

                    {selectedBarcode.details && (
                      <div className={styles.equipmentDetails}>
                        <p>
                          <strong>Category:</strong>{" "}
                          {selectedBarcode.details.category}
                        </p>
                        <p>
                          <strong>Status:</strong>{" "}
                          {selectedBarcode.details.status}
                        </p>
                        <p>
                          <strong>Assigned To:</strong>{" "}
                          {selectedBarcode.details.assigned_to || "Unassigned"}
                        </p>
                        <p>
                          <strong>Purchase Date:</strong>{" "}
                          {formatDate(selectedBarcode.details.purchase_date)}
                        </p>
                        <p>
                          <strong>Last Checked:</strong>{" "}
                          {formatDate(selectedBarcode.details.last_checked)}
                        </p>
                        <p>
                          <strong>Price:</strong>{" "}
                          {selectedBarcode.details.price
                            ? new Intl.NumberFormat("en-PH", {
                                style: "currency",
                                currency: "PHP",
                              }).format(selectedBarcode.details.price)
                            : "₱0.00"}
                        </p>
                      </div>
                    )}
                  </div>
                  <canvas
                    id="barcode-canvas"
                    width="300"
                    height="100"
                    className={
                      selectedBarcode.code.length > 20 ? styles.longBarcode : ""
                    }
                    style={{
                      marginTop: "20px",
                      maxWidth: "100%",
                      height: "auto",
                    }}
                  />
                </div>
                <div className={styles.barcodeModalActions}>
                  <button
                    className={styles.barcodeDownloadBtn}
                    onClick={() =>
                      downloadBarcode(
                        selectedBarcode.code,
                        selectedBarcode.name
                      )
                    }
                  >
                    ⬇️ Download Barcode
                  </button>
                  <button
                    className={styles.barcodeCloseBtn}
                    onClick={() => setShowBarcodeModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
