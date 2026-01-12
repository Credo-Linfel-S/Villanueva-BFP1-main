import React, { useState, useEffect, useRef, useMemo } from "react";
import styles from "../styles/LeaveManagement.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BFPPreloader from "../../BFPPreloader.jsx"; // UNCOMMENT THIS
import { useAuth } from "../../AuthContext.jsx";
import {
  uploadLeaveDocumentToStorage,
  createPersonnelFolderName,
  createLeavePdfFileName,
  saveLeaveDocumentMetadata,
} from "../../utils/leaveDocumentUpload.js";
import { fillLeaveFormEnhanced } from "../../utils/pdfLeaveFormFiller.js";
// Import from your new client-side utility
import {
  calculateWorkingDays,
  getPhilippineHolidays,
  calculateCalendarDays,
  LeaveCalculator,
} from "../../utils/holidayCalendar.js";
import LeaveOfficerInputModal from "../../utils/LeaveOfficerInputModal.jsx";
import { useUserId } from "../../hooks/useUserId.js";

const LeaveManagement = () => {
  const { isSidebarCollapsed } = useSidebar();
  const { user: authUser, hasSupabaseAuth } = useAuth();
  const { userId, isAuthenticated, userRole } = useUserId();
  // UNCOMMENT AND ACTIVATE THESE PRELOADER STATES
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showLeaveBreakdownModal, setShowLeaveBreakdownModal] = useState(false);
  const [selectedLeaveForCalculation, setSelectedLeaveForCalculation] =
    useState(null);
  const [leaveBreakdown, setLeaveBreakdown] = useState(null);
  // Add this state to track if data is fully loaded
  const [isDataFullyLoaded, setIsDataFullyLoaded] = useState(false);
  const [showLeaveOfficerModal, setShowLeaveOfficerModal] = useState(false);
  const [selectedRequestForCustomPdf, setSelectedRequestForCustomPdf] =
    useState(null);
  const [leaveOfficerNames, setLeaveOfficerNames] = useState({});
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [currentView, setCurrentView] = useState("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageCards, setCurrentPageCards] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [filterValue, setFilterValue] = useState("All");
  const [modalData, setModalData] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [showApprovalOptionsModal, setShowApprovalOptionsModal] =
    useState(false);
  const [selectedRequestForApproval, setSelectedRequestForApproval] =
    useState(null);

  // Add this state to track if data is fully loaded

  // New states for confirmation modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // PDF generation states
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfDownloadProgress, setPdfDownloadProgress] = useState(0);
  const [pdfDownloadForRequest, setPdfDownloadForRequest] = useState(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  // Add this function to identify leave types that count holidays/weekends as paid
  const isSpecialLeaveType = (leaveType) => {
    if (!leaveType) return false;
    const type = leaveType.toLowerCase().trim();
    return (
      type === "maternity" ||
      type === "paternity" ||
      type === "emergency" ||
      type === "emergency leave"
    );
  };

  // Also add this for leave types that don't require credits
  const doesRequireLeaveCredits = (leaveType) => {
    if (!leaveType) return true;
    const type = leaveType.toLowerCase().trim();
    // Emergency, Maternity, Paternity don't require credits
    return !(
      type.includes("emergency") ||
      type === "maternity" ||
      type === "paternity"
    );
  };
  // Dynamic card count based on sidebar state
  const rowsPerPage = 5;
  const rowsPerPageCards = isSidebarCollapsed ? 8 : 6; // Dynamic card count

  // Recalculate pagination when sidebar state changes
  useEffect(() => {
    // When sidebar state changes, reset to first page and recalculate
    setCurrentPageCards(1);
  }, [isSidebarCollapsed]);

  // UNCOMMENT AND ACTIVATE loading phases
  const loadingPhasesRef = useRef([
    { name: "Checking Authentication", progress: 20, completed: false },
    { name: "Loading User Data", progress: 40, completed: false },
    { name: "Fetching Leave Requests", progress: 70, completed: false },
    { name: "Setting Up Real-time Updates", progress: 90, completed: false },
    { name: "Finalizing", progress: 100, completed: false },
  ]);

  // UNCOMMENT AND ACTIVATE loading phase helper
  const updateLoadingPhase = async (phaseIndex, phaseName) => {
    return new Promise((resolve) => {
      // Update progress based on phase
      setLoadingProgress(loadingPhasesRef.current[phaseIndex].progress);

      // Small delay for smooth progress animation
      setTimeout(resolve, 150);
    });
  };
  // Add this useEffect to update CSS variables based on sidebar state
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--modal-margin-left",
      isSidebarCollapsed ? "100px" : "290px"
    );
  }, [isSidebarCollapsed]);
  useEffect(() => {
    // ENHANCED INITIALIZATION WITH PRELOADER SYNC
    const initializeData = async () => {
      try {
        // Phase 1: Check authentication
        await updateLoadingPhase(0, "Checking Authentication");

        // Phase 2: Load user data
        await updateLoadingPhase(1, "Loading User Data");
        await checkIfAdmin();

        // Phase 3: Fetch leave requests (WAIT FOR THIS TO COMPLETELY FINISH)
        await updateLoadingPhase(2, "Fetching Leave Requests");
        await loadLeaveRequests(); // This will set isDataFullyLoaded when done

        // Phase 4: Setup real-time updates
        await updateLoadingPhase(3, "Setting Up Real-time Updates");
        setupRealtimeUpdates();

        // Phase 5: Finalize - Wait for data to be fully loaded
        await updateLoadingPhase(4, "Finalizing");

        // Add a small delay to ensure all data is processed
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Mark data as fully loaded
        setIsDataFullyLoaded(true);

        // Now we can safely hide the preloader
        setTimeout(() => {
          setIsInitializing(false);
          setTimeout(() => setShowContent(true), 300);
        }, 500);
      } catch (error) {
        console.error("Data loading error:", error);
        toast.error("Some data failed to load. Please refresh if needed.");
        // Still show content even on error, but mark as loaded
        setIsDataFullyLoaded(true);
        setIsInitializing(false);
        setTimeout(() => setShowContent(true), 300);
      }
    };

    initializeData();

    return () => {
      // Cleanup real-time subscription
      const channel = supabase.channel("leave-requests-changes");
      supabase.removeChannel(channel);
    };
  }, []); // Empty dependency array - runs once on mount
  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    try {
      const response = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${currentYear}/PH`
      );
      const data = await response.json();
      setHolidays(data);
    } catch (error) {
      console.error("Failed to load holidays:", error);
      // Load fallback
      const fallback = [
        { date: `${currentYear}-01-01`, name: "New Year's Day" },
        // ... other holidays
      ];
      setHolidays(fallback);
    }
  };
  // Add these helper functions after your existing functions like updateStatus

  // Replace the placeholder with actual implementation
  const getLeaveBalanceForType = async (leaveType, personnelId) => {
    try {
      const currentYear = new Date().getFullYear();

      const { data: balance, error } = await supabase
        .from("leave_balances")
        .select("vacation_balance, sick_balance, emergency_balance")
        .eq("personnel_id", personnelId)
        .eq("year", currentYear)
        .single();

      if (error) {
        console.error("Error fetching balance:", error);
        return 0;
      }

      const normalizedLeaveType = leaveType?.trim() || "Vacation";
      let balanceValue = 0;

      switch (normalizedLeaveType) {
        case "Vacation":
          balanceValue = parseFloat(balance.vacation_balance) || 0;
          break;
        case "Sick":
          balanceValue = parseFloat(balance.sick_balance) || 0;
          break;
        case "Emergency":
          balanceValue = parseFloat(balance.emergency_balance) || 0;
          break;
        default:
          balanceValue = parseFloat(balance.vacation_balance) || 0;
      }

      // Return with 2 decimal places for precision
      return parseFloat(balanceValue.toFixed(2));
    } catch (error) {
      console.error("Error in getLeaveBalanceForType:", error);
      return 0;
    }
  };
  // Create a simple calculator (or put this in a separate utils file)
  // Add these constants for the calendar calculations
  const calculateCalendarDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end - start;
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  };

  // OR you can import it from your utility file
  // Calculate working days for a request
  const calculateLeaveDetails = async (leaveRequest) => {
    const { startDate, endDate } = leaveRequest;

    // Get working days (exclude weekends and holidays)
    const workingDays = calculateWorkingDays(startDate, endDate, holidays);
    const totalDays = calculateCalendarDays(startDate, endDate);
    const holidayDays = totalDays - workingDays;

    return {
      totalCalendarDays: totalDays,
      workingDays,
      holidayDays,
      holidaysInRange: holidays.filter((h) => {
        const holidayDate = new Date(h.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return holidayDate >= start && holidayDate <= end;
      }),
    };
  };

  // In your modal or view details, show the breakdown
  const showLeaveCalculation = async (request) => {
    setSelectedLeaveForCalculation(request);
    const breakdown = await calculateLeaveDetails(request);
    setLeaveBreakdown(breakdown);
    setShowLeaveBreakdownModal(true);
  };
  const setupRealtimeUpdates = () => {
    const channel = supabase
      .channel("leave-requests-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => {
          // Debounced reload
          setTimeout(() => {
            loadLeaveRequests();
          }, 1000);
        }
      )
      .subscribe();
  };

  useEffect(() => {
    applyFilterAndSearch();
  }, [searchValue, filterValue, leaveRequests]);

  const checkIfAdmin = async () => {
    try {
      const currentUserData = localStorage.getItem("adminUser");

      if (currentUserData) {
        const user = JSON.parse(currentUserData);
        setCurrentUser(user);

        const userIsAdmin = user.role === "admin" || user.isAdmin === true;
        setIsAdmin(userIsAdmin);
        setAdminUsername(user.username || "Admin");

        console.log("Admin check result:", {
          isAdmin: userIsAdmin,
          username: user.username,
          role: user.role,
        });
      } else {
        setIsAdmin(false);
        console.log("No admin user found in localStorage");
      }
    } catch (error) {
      console.error("Error in checkIfAdmin:", error);
      setIsAdmin(false);
      throw error; // Re-throw to be caught in initialization
    }
  };

  const loadLeaveRequests = async () => {
    try {
      let query = supabase
        .from("leave_requests")
        .select(
          `
        *,
        personnel:personnel_id (
          first_name,
          last_name,
          middle_name,
          rank,
          rank_image,
          station,
          username,
          email,
          is_admin,
          can_approve_leaves
        ),
        leave_documents (
          id,
          document_name,
          file_url,
          file_path,
          uploaded_at,
          document_type
        )
      `
        )
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        if (currentUser && currentUser.username) {
          query = query.eq("username", currentUser.username);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading leave requests:", error);
        toast.error("Failed to load leave requests");
        throw error;
      }

      const transformedData = await Promise.all(
        data.map(async (item) => {
          const personnel = item.personnel || {};

          // Build full name with separate components
          const firstName = personnel.first_name || "";
          const lastName = personnel.last_name || "";
          const middleName = personnel.middle_name || "";

          const employeeName =
            item.employee_name ||
            `${firstName} ${lastName}`.trim() ||
            item.username ||
            "Unknown Employee";

          // Get rank image URL
          let rankImageUrl = "";
          if (personnel.rank_image) {
            try {
              // Check if it's already a full URL
              if (personnel.rank_image.startsWith("http")) {
                rankImageUrl = personnel.rank_image;
              } else {
                // Get public URL from rank_images bucket
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

          // Check if LEAVE_FORM PDF already exists
          const leaveFormDocuments =
            item.leave_documents?.filter(
              (doc) => doc.document_type === "LEAVE_FORM"
            ) || [];

          const hasExistingPdf = leaveFormDocuments.length > 0;
          const existingPdfUrl = hasExistingPdf
            ? leaveFormDocuments[0].file_url
            : null;

          return {
            id: item.id,
            personnel_id: item.personnel_id,
            username: item.username || personnel.username || "Unknown",
            employeeName: employeeName,
            firstName: firstName,
            lastName: lastName,
            middleName: middleName,
            leaveType: item.leave_type,
            startDate: item.start_date
              ? new Date(item.start_date).toISOString().split("T")[0]
              : "N/A",
            endDate: item.end_date
              ? new Date(item.end_date).toISOString().split("T")[0]
              : "N/A",
            num_days: item.num_days,
            location: item.location || personnel.station || "-",
            status: item.status || "Pending",
            dateOfFiling: item.date_of_filing
              ? new Date(item.date_of_filing).toISOString().split("T")[0]
              : "N/A",
            submittedAt: item.submitted_at,
            createdAt: item.created_at,
            updated_at: item.updated_at,
            approved_by: item.approved_by || null,
            reason: item.reason || null,
            balance_before: item.balance_before,
            balance_after: item.balance_after,
            leave_balance_id: item.leave_balance_id,
            rank: personnel.rank || "",
            rankImage: rankImageUrl, // ADD THIS
            station: personnel.station || "",
            hasExistingPdf: hasExistingPdf,
            existingPdfUrl: existingPdfUrl,
            vacation_location_type: item.vacation_location_type || null,
            illness_type: item.illness_type || null,
            illness_details: item.illness_details || null,
          };
        })
      );

      setLeaveRequests(transformedData);
      setFilteredRequests(transformedData);

      return transformedData;
    } catch (err) {
      console.error("Error loading leave requests:", err);
      toast.error("Error loading leave requests");
      throw err;
    }
  };
  const applyFilterAndSearch = () => {
    const filtered = leaveRequests.filter((req) => {
      const statusMatch =
        filterValue.toLowerCase() === "all" ||
        (req.status &&
          req.status.toLowerCase().trim() === filterValue.toLowerCase());
      const searchMatch =
        req.employeeName?.toLowerCase().includes(searchValue.toLowerCase()) ||
        req.leaveType?.toLowerCase().includes(searchValue.toLowerCase()) ||
        (req.location &&
          req.location.toLowerCase().includes(searchValue.toLowerCase()));
      return statusMatch && searchMatch;
    });
    setFilteredRequests(filtered);
    setCurrentPage(1);
    setCurrentPageCards(1);
  };

  const toggleView = () => {
    setCurrentView(currentView === "table" ? "cards" : "table");
  };

  // PDF Generation Functions
  const loadPdfTemplate = async () => {
    try {
      // Try multiple paths for the template
      const templatePaths = [
        "/forms/BFP_Leave_Form.pdf", // Public folder
        "./forms/BFP_Leave_Form.pdf", // Relative path
        `${window.location.origin}/forms/BFP_Leave_Form.pdf`, // Absolute URL
      ];

      let response = null;
      let lastError = null;

      for (const path of templatePaths) {
        try {
          console.log("Trying to load template from:", path);
          response = await fetch(path);
          if (response.ok) {
            console.log("Template loaded successfully from:", path);
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

  // Helper function to format dates for PDF
  const formatDateForPDF = (dateString) => {
    if (!dateString || dateString === "N/A") return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  };

  // Helper function to split long text into multiple lines
  const splitTextIntoLines = (text, maxLength) => {
    if (!text) return [];
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + word).length > maxLength) {
        lines.push(currentLine.trim());
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    return lines;
  };

  const downloadPdf = (pdfBytes, fileName) => {
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

  const generatePDF = async (leaveData) => {
    try {
      console.log("=== GENERATE PDF - START DEBUG ===");
      console.log("Initial leaveData received:", leaveData);
      console.log("Keys in leaveData:", Object.keys(leaveData));

      // Load PDF template
      const pdfBytes = await loadPdfTemplate();

      // First, try to fetch the latest data from database to ensure accuracy
      let databaseData = null;
      try {
        const { data: latestData, error } = await supabase
          .from("leave_requests")
          .select(
            `
          approve_for, 
          paid_days, 
          unpaid_days, 
          balance_before, 
          balance_after, 
          num_days,
          working_days,
          holiday_days,
          leave_type,
          start_date,
          end_date,
          location,
          personnel_id
        `
          )
          .eq("id", leaveData.id)
          .single();

        if (error) {
          console.warn(
            "Could not fetch latest data from database:",
            error.message
          );
        } else {
          databaseData = latestData;
          console.log("Database data fetched successfully:", databaseData);
        }
      } catch (dbError) {
        console.warn("Error fetching from database:", dbError.message);
      }

      // Use database data if available, otherwise use provided data
      const effectiveData = databaseData || leaveData;

      // Extract critical fields
      const approveFor =
        effectiveData.approve_for || leaveData.approve_for || "with_pay";
      const paidDays = effectiveData.paid_days || leaveData.paid_days || 0;
      const unpaidDays =
        effectiveData.unpaid_days || leaveData.unpaid_days || 0;

      // Calculate total deduction - THIS IS CRITICAL
      // First try working_days from database (most accurate)
      // Then try paid+unpaid calculation
      // Fallback to num_days as last resort
      let totalDeducted = effectiveData.working_days || paidDays + unpaidDays;

      // If totalDeducted is still 0, use num_days (calendar days)
      if (totalDeducted === 0) {
        totalDeducted =
          effectiveData.num_days ||
          leaveData.num_days ||
          leaveData.numDays ||
          0;
      }

      // Calculate balance before and after
      const balanceBefore = parseFloat(
        effectiveData.balance_before || leaveData.balance_before || 0
      );
      let balanceAfter = parseFloat(
        effectiveData.balance_after || leaveData.balance_after || 0
      );

      // If balanceAfter is 0 or not provided, calculate it
      if (balanceAfter === 0 && balanceBefore > 0) {
        balanceAfter = Math.max(0, balanceBefore - totalDeducted);
      }

      // Debug logging for critical values
      console.log("=== PDF GENERATION - CRITICAL VALUES ===");
      console.log("Approve For:", approveFor);
      console.log("Paid Days:", paidDays);
      console.log("Unpaid Days:", unpaidDays);
      console.log("Total Deducted (working days):", totalDeducted);
      console.log("Balance Before:", balanceBefore);
      console.log("Balance After:", balanceAfter);
      console.log("Working Days from DB:", effectiveData.working_days);
      console.log(
        "Num Days:",
        effectiveData.num_days || leaveData.num_days || leaveData.numDays || 0
      );

      // Also fetch personnel data for name fields if available
      let personnelData = null;
      if (leaveData.personnel_id) {
        try {
          const { data: personnel, error } = await supabase
            .from("personnel")
            .select("first_name, last_name, middle_name, rank, station")
            .eq("id", leaveData.personnel_id)
            .single();

          if (!error) {
            personnelData = personnel;
            console.log("Personnel data fetched:", personnelData);
          }
        } catch (personnelError) {
          console.warn(
            "Could not fetch personnel data:",
            personnelError.message
          );
        }
      }

      // Prepare data for PDF filler
      const pdfData = {
        ...leaveData,
        // Critical payment fields
        approve_for: approveFor,
        paid_days: paidDays,
        unpaid_days: unpaidDays,
        total_deducted: totalDeducted,

        // Balance fields
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        balanceBefore: balanceBefore, // Add camelCase version
        balanceAfter: balanceAfter, // Add camelCase version

        // Leave type and details
        leaveType: leaveData.leaveType || effectiveData.leave_type || "",
        leave_type: leaveData.leave_type || effectiveData.leave_type || "",
        num_days:
          effectiveData.num_days ||
          leaveData.num_days ||
          leaveData.numDays ||
          0,
        numDays:
          effectiveData.num_days ||
          leaveData.num_days ||
          leaveData.numDays ||
          0,

        // Name fields - use personnel data if available
        lastName: leaveData.lastName || personnelData?.last_name || "",
        firstName: leaveData.firstName || personnelData?.first_name || "",
        middleName: leaveData.middleName || personnelData?.middle_name || "",

        // Rank and station
        rank: leaveData.rank || personnelData?.rank || "",
        station: leaveData.station || personnelData?.station || "",

        // Location and dates
        location: leaveData.location || effectiveData.location || "",
        startDate: leaveData.startDate || effectiveData.start_date || "",
        endDate: leaveData.endDate || effectiveData.end_date || "",

        // Filing date
        dateOfFiling:
          leaveData.dateOfFiling ||
          leaveData.createdAt ||
          new Date().toISOString(),
        date_of_filing:
          leaveData.date_of_filing ||
          leaveData.createdAt ||
          new Date().toISOString(),

        // Additional fields
        vacationLocationType: leaveData.vacation_location_type || "philippines",
        vacation_location_type:
          leaveData.vacation_location_type || "philippines",
        illnessType: leaveData.illness_type || "",
        illness_type: leaveData.illness_type || "",
        illnessDetails: leaveData.illness_details || "",
        illness_details: leaveData.illness_details || "",

        // Employee name for fallback
        employeeName:
          leaveData.employeeName ||
          `${personnelData?.first_name || ""} ${
            personnelData?.last_name || ""
          }`.trim(),
        fullName:
          leaveData.fullName ||
          `${personnelData?.first_name || ""} ${
            personnelData?.last_name || ""
          }`.trim(),
      };

      console.log("=== PDF DATA BEING SENT TO FILLER ===");
      console.log("Final pdfData structure:", {
        approve_for: pdfData.approve_for,
        paid_days: pdfData.paid_days,
        unpaid_days: pdfData.unpaid_days,
        total_deducted: pdfData.total_deducted,
        balance_before: pdfData.balance_before,
        balance_after: pdfData.balance_after,
        num_days: pdfData.num_days,
        leaveType: pdfData.leaveType,
        lastName: pdfData.lastName,
        firstName: pdfData.firstName,
        middleName: pdfData.middleName,
      });

      // Use the imported enhanced function
      const filledPdf = await fillLeaveFormEnhanced(pdfBytes, pdfData, {
        isYearly: false,
        generationDate: new Date().toISOString(),
        adminUsername: adminUsername,
      });

      console.log("✅ PDF generated successfully");
      return filledPdf;
    } catch (error) {
      console.error("Error generating PDF:", error);
      console.error("Error stack:", error.stack);
      throw error;
    }
  };
  // Helper function to update UI without database updates
  const updateUIWithPdf = (requestId, pdfUrl, documentData = null) => {
    setLeaveRequests((prev) =>
      prev.map((req) =>
        req.id === requestId
          ? {
              ...req,
              hasExistingPdf: true,
              existingPdfUrl: pdfUrl,
              // Add document data if available
              ...(documentData && {
                documentId: documentData.id,
                documentUploadedAt: documentData.uploaded_at,
              }),
            }
          : req
      )
    );

    setFilteredRequests((prev) =>
      prev.map((req) =>
        req.id === requestId
          ? {
              ...req,
              hasExistingPdf: true,
              existingPdfUrl: pdfUrl,
              ...(documentData && {
                documentId: documentData.id,
                documentUploadedAt: documentData.uploaded_at,
              }),
            }
          : req
      )
    );
  };

  // Add this function after your other handler functions like handleApproveClick, handleRejectClick, etc.
  const handleCustomizeLeavePdf = (leaveRequest) => {
    setSelectedRequestForCustomPdf(leaveRequest);
    setShowLeaveOfficerModal(true);
  };

  const handleConfirmLeaveOfficerNames = async (names) => {
    setShowLeaveOfficerModal(false);
    if (selectedRequestForCustomPdf) {
      // Generate PDF with custom officer names
      await generateAndUploadLeaveForm(selectedRequestForCustomPdf, names);
    }
    setLeaveOfficerNames(names); // Save for future use
    setSelectedRequestForCustomPdf(null);
  };
  const generateAndUploadLeaveForm = async (
    leaveRequest,
    customOfficerNames = {}
  ) => {
    if (!leaveRequest || !leaveRequest.id) {
      toast.error("Invalid leave request data");
      return;
    }

    // Check if already approved
    if (leaveRequest.status?.toLowerCase() !== "approved") {
      toast.warning("PDF form is only available for approved leave requests");
      return;
    }

    setGeneratingPdf(true);
    setPdfDownloadForRequest(leaveRequest.id);
    setPdfDownloadProgress(10);

    try {
      console.log("=== DEBUG: LEAVE DATA FOR PDF ===");
      console.log("Full leaveRequest object:", leaveRequest);
      console.log("Custom officer names:", customOfficerNames); // <-- Debug log
      console.log("Keys in leaveRequest:", Object.keys(leaveRequest));

      // Calculate what should be displayed
      const totalDeducted =
        (leaveRequest.paid_days || 0) + (leaveRequest.unpaid_days || 0);
      console.log("Calculated total deduction:", totalDeducted);

      setPdfDownloadProgress(40);

      // Generate PDF with corrected data AND officer names
      const filledPdfBytes = await generatePDF({
        ...leaveRequest,
        // Ensure these fields are properly passed
        total_deducted: totalDeducted,
        balance_before: leaveRequest.balance_before || 0,
        balance_after: leaveRequest.balance_after || 0,
        // Make sure these are included
        approve_for: leaveRequest.approve_for || "with_pay",
        paid_days: leaveRequest.paid_days || 0,
        unpaid_days: leaveRequest.unpaid_days || 0,
        // ADD OFFICER NAMES HERE: (THIS IS THE KEY CHANGE)
        officerNames: customOfficerNames, // <-- This gets passed to fillLeaveFormEnhanced
      });

      // Get personnel data
      let personnelData = null;
      if (leaveRequest.personnel_id) {
        const { data, error } = await supabase
          .from("personnel")
          .select("*")
          .eq("id", leaveRequest.personnel_id)
          .single();

        if (!error) {
          personnelData = data;
        }
      }

      // Create record object
      const record = {
        ...leaveRequest,
        fullName: leaveRequest.employeeName,
        rank: leaveRequest.rank,
        badgeNumber: leaveRequest.badge_number,
        dateRequested: leaveRequest.created_at,
        approvedBy: adminUsername,
      };

      // Create filename
      const fileName = createLeavePdfFileName(record, personnelData);

      setPdfDownloadProgress(80);

      // Download locally
      downloadPdf(filledPdfBytes, fileName);

      setPdfDownloadProgress(85);

      try {
        // Use shared upload function
        const uploadResult = await uploadLeaveDocumentToStorage({
          record,
          pdfBytes: filledPdfBytes,
          fileName,
          isYearly: false,
          generatedBy: adminUsername,
        });

        // Save metadata using shared function
        const savedDocument = await saveLeaveDocumentMetadata({
          leaveRequestId: leaveRequest.id,
          documentName: fileName,
          fileUrl: uploadResult.fileUrl,
          filePath: uploadResult.filePath,
          fileSize: uploadResult.fileSize,
          uploadedBy: adminUsername,
        });

        // Update UI with saved document info
        if (savedDocument) {
          updateUIWithPdf(leaveRequest.id, uploadResult.fileUrl, savedDocument);
        } else {
          updateUIWithPdf(leaveRequest.id, uploadResult.fileUrl);
        }

        toast.success("✅ PDF uploaded and saved successfully!");
        setPdfDownloadProgress(100);
      } catch (uploadError) {
        console.warn("Upload process error:", uploadError);
        toast.warn("PDF downloaded locally. Cloud upload skipped.", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error in generateAndUploadLeaveForm:", error);
      toast.error(`Upload failed: ${error.message}`);
      toast.info("✅ PDF downloaded locally.");
    } finally {
      setTimeout(() => {
        setGeneratingPdf(false);
        setPdfDownloadForRequest(null);
        setPdfDownloadProgress(0);
      }, 1000);
    }
  };

  const downloadExistingPdf = async (pdfUrl, leaveRequest) => {
    if (!pdfUrl) {
      toast.error("PDF URL not found");
      return;
    }

    try {
      // First try direct download
      const response = await fetch(pdfUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      // Get personnel data for filename
      let personnelData = null;
      if (leaveRequest.personnel_id) {
        const { data, error } = await supabase
          .from("personnel")
          .select("*")
          .eq("id", leaveRequest.personnel_id)
          .single();

        if (!error) {
          personnelData = data;
        }
      }

      // Create filename with personnel details
      const fileName = createLeavePdfFileName(leaveRequest, personnelData);

      // Download the blob
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error downloading PDF:", error);

      // Fallback: Direct link opening
      toast.info("Opening PDF in new tab...");
      window.open(pdfUrl, "_blank");
    }
  };

  const updateLeaveBalanceForApproval = async (
    leaveBalanceId,
    leaveType,
    days
  ) => {
    try {
      // Validate leaveType
      if (!leaveType) {
        console.error("Leave type is undefined or null");
        return;
      }

      const fieldMap = {
        Vacation: "vacation_balance",
        Sick: "sick_balance",
        Emergency: "emergency_balance",
      };

      const fieldName = fieldMap[leaveType];
      if (!fieldName) {
        console.error("Invalid leave type:", leaveType);
        console.log("Available leave types:", Object.keys(fieldMap));
        return;
      }

      const { data: currentBalance, error: fetchError } = await supabase
        .from("leave_balances")
        .select(fieldName)
        .eq("id", leaveBalanceId)
        .single();

      if (fetchError) {
        console.error("Error fetching current balance:", fetchError);
        return;
      }

      const currentValue = parseFloat(currentBalance[fieldName] || 0);
      const newValue = Math.max(0, currentValue - days);

      const { error: updateError } = await supabase
        .from("leave_balances")
        .update({
          [fieldName]: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaveBalanceId);

      if (updateError) {
        console.error("Error updating leave balance:", updateError);
      }
    } catch (error) {
      console.error("Error in updateLeaveBalanceForApproval:", error);
    }
  };

  const updateLeaveBalanceForRejection = async (
    leaveBalanceId,
    leaveType,
    days
  ) => {
    try {
      const fieldMap = {
        Vacation: "vacation_balance",
        Sick: "sick_balance",
        Emergency: "emergency_balance",
      };

      const fieldName = fieldMap[leaveType];
      if (!fieldName) {
        console.error("Invalid leave type:", leaveType);
        return;
      }

      const { data: currentBalance, error: fetchError } = await supabase
        .from("leave_balances")
        .select(fieldName)
        .eq("id", leaveBalanceId)
        .single();

      if (fetchError) {
        console.error("Error fetching current balance:", fetchError);
        return;
      }

      const currentValue = parseFloat(currentBalance[fieldName] || 0);
      const newValue = currentValue + days;

      const { error: updateError } = await supabase
        .from("leave_balances")
        .update({
          [fieldName]: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaveBalanceId);

      if (updateError) {
        console.error("Error updating leave balance:", updateError);
      }
    } catch (error) {
      console.error("Error in updateLeaveBalanceForRejection:", error);
    }
  };

  const updatePersonnelLeaveBalance = async (
    personnelId,
    leaveType,
    days,
    isReturn = false
  ) => {
    try {
      const { data: employee, error: employeeError } = await supabase
        .from("personnel")
        .select("earned_vacation, earned_sick, earned_emergency")
        .eq("id", personnelId)
        .single();

      if (employeeError) {
        console.error("Error fetching employee:", employeeError);
        throw employeeError;
      }

      const balanceUpdateData = {};
      const leaveTypeLower = leaveType?.toLowerCase();

      if (leaveTypeLower === "vacation" && employee.earned_vacation != null) {
        const current = parseFloat(employee.earned_vacation) || 0;
        balanceUpdateData.earned_vacation = isReturn
          ? current + parseFloat(days || 0)
          : Math.max(0, current - parseFloat(days || 0));
      } else if (leaveTypeLower === "sick" && employee.earned_sick != null) {
        const current = parseFloat(employee.earned_sick) || 0;
        balanceUpdateData.earned_sick = isReturn
          ? current + parseFloat(days || 0)
          : Math.max(0, current - parseFloat(days || 0));
      } else if (
        leaveTypeLower === "emergency" &&
        employee.earned_emergency != null
      ) {
        const current = parseFloat(employee.earned_emergency) || 0;
        balanceUpdateData.earned_emergency = isReturn
          ? current + parseFloat(days || 0)
          : Math.max(0, current - parseFloat(days || 0));
      }

      if (Object.keys(balanceUpdateData).length > 0) {
        const { error: balanceError } = await supabase
          .from("personnel")
          .update(balanceUpdateData)
          .eq("id", personnelId);

        if (balanceError) {
          console.error("Error updating leave balance:", balanceError);
          throw balanceError;
        }
      }
    } catch (error) {
      console.error("Error in updatePersonnelLeaveBalance:", error);
      throw error;
    }
  };

  const returnLeaveCreditsForRejection = async (requestId, requestData) => {
    try {
      if (
        requestData.balance_before !== null &&
        requestData.balance_after !== null
      ) {
        const deductedAmount =
          requestData.balance_before - requestData.balance_after;

        if (deductedAmount > 0) {
          if (requestData.leave_balance_id) {
            await updateLeaveBalanceForRejection(
              requestData.leave_balance_id,
              requestData.leave_type,
              deductedAmount
            );
          } else {
            await updatePersonnelLeaveBalance(
              requestData.personnel_id,
              requestData.leave_type,
              deductedAmount,
              true
            );
          }
        }
      } else {
        const { data: previousStatus, error } = await supabase
          .from("leave_requests")
          .select("status")
          .eq("id", requestId)
          .single();

        if (!error && previousStatus?.status?.toLowerCase() === "approved") {
          await updatePersonnelLeaveBalance(
            requestData.personnel_id,
            requestData.leave_type,
            requestData.num_days,
            true
          );
        }
      }
    } catch (error) {
      console.error("Error returning leave credits:", error);
      throw error;
    }
  };

  const updateStatus = async (id, newStatus, reason = "") => {
    if (!isAdmin) {
      toast.error("Only administrators can update leave request status.");
      return;
    }

    setProcessingAction(id);

    try {
      const { data: currentRequest, error: fetchError } = await supabase
        .from("leave_requests")
        .select(
          "status, personnel_id, leave_type, num_days, username, employee_name, balance_before, balance_after, leave_balance_id"
        )
        .eq("id", id)
        .single();

      if (fetchError) {
        console.error("Error fetching request:", fetchError);
        toast.error("Error fetching leave request details");
        throw fetchError;
      }

      if (currentRequest.status?.toLowerCase() !== "pending") {
        toast.warn(
          `⚠️ This leave request has already been ${
            currentRequest.status?.toLowerCase() || "processed"
          }.`
        );
        setProcessingAction(null);
        // Don't reload immediately - just return
        return;
      }

      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        approved_by: adminUsername || "Admin",
      };

      if (newStatus === "Rejected") {
        if (reason.trim() !== "") {
          updateData.reason = reason.trim();
          updateData.rejection_reason = reason.trim();
        }
      } else if (newStatus === "Approved") {
        updateData.approval_remarks = `Approved by ${adminUsername || "Admin"}`;
      }

      // OPTIMISTIC UPDATE: Update local state immediately for instant UI feedback
      setLeaveRequests((prevRequests) =>
        prevRequests.map((request) =>
          request.id === id
            ? {
                ...request,
                status: newStatus,
                approved_by: adminUsername || "Admin",
                reason:
                  newStatus === "Rejected" ? reason.trim() : request.reason,
                updated_at: new Date().toISOString(),
              }
            : request
        )
      );

      setFilteredRequests((prevRequests) =>
        prevRequests.map((request) =>
          request.id === id
            ? {
                ...request,
                status: newStatus,
                approved_by: adminUsername || "Admin",
                reason:
                  newStatus === "Rejected" ? reason.trim() : request.reason,
                updated_at: new Date().toISOString(),
              }
            : request
        )
      );

      // Then make the API call to update the database
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        console.error("Error updating request:", updateError);
        toast.error("Failed to update leave request");

        // Revert optimistic update on error
        await loadLeaveRequests();
        throw updateError;
      }

      // Update leave balances if needed
      if (newStatus === "Approved") {
        if (
          currentRequest.balance_before !== null &&
          currentRequest.balance_after !== null
        ) {
          if (currentRequest.leave_balance_id) {
            await updateLeaveBalanceForApproval(
              currentRequest.leave_balance_id,
              currentRequest.leave_type,
              currentRequest.num_days
            );
          } else {
            await updatePersonnelLeaveBalance(
              currentRequest.personnel_id,
              currentRequest.leave_type,
              currentRequest.num_days,
              false
            );
          }
        } else {
          await updatePersonnelLeaveBalance(
            currentRequest.personnel_id,
            currentRequest.leave_type,
            currentRequest.num_days,
            false
          );
        }
      } else if (newStatus === "Rejected") {
        await returnLeaveCreditsForRejection(id, currentRequest);
      }

      // Show success toast
      toast.info(
        `Leave request has been ${newStatus.toLowerCase()} successfully!`
      );

      // Instead of reloading immediately, wait a bit for the toast to show
      // Then refresh data in the background
      setTimeout(() => {
        loadLeaveRequests();
      }, 2000);
    } catch (err) {
      console.error("Error updating status:", err);

      let errorMessage =
        "Error updating leave request status. Please try again.";

      if (err.code === "23505") {
        errorMessage =
          "Duplicate entry error. This request may have already been processed.";
      } else if (err.code === "23503") {
        errorMessage =
          "Foreign key violation. The personnel record may not exist.";
      } else if (err.message?.includes("network")) {
        errorMessage = "Network error. Please check your internet connection.";
      }

      toast.error(errorMessage);
    } finally {
      setProcessingAction(null);
      // Close modals
      setShowApproveModal(false);
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason("");
    }
  };

  // Replace or modify your existing handleApproveClick function
  const handleApproveClick = (id, employeeName) => {
    const request = leaveRequests.find((req) => req.id === id);
    if (!request) return;

    setSelectedRequestForApproval(request);
    setShowApprovalOptionsModal(true);
  };
const handleApproveWithOptions = async (
  requestId,
  approveFor,
  withPayDays = null
) => {
  try {
    setProcessingAction(requestId);
    const request = leaveRequests.find((req) => req.id === requestId);
    if (!request) {
      toast.error("Leave request not found");
      return;
    }

    const leaveType = request.leaveType || request.leave_type || "Vacation";
    const numDays = request.numDays || request.num_days || 0;

    // Check if it's a special leave type directly
    const isSpecialLeave = () => {
      if (!leaveType) return false;
      const type = leaveType.toLowerCase().trim();
      return (
        type === "maternity" ||
        type === "paternity" ||
        type === "emergency" ||
        type === "emergency leave"
      );
    };

    const isSpecial = isSpecialLeave();
    const requiresCredits = !isSpecial; // Special leaves don't require credits

    // Get the LeaveCalculator
    const calculator = new LeaveCalculator(holidays);

    // For special leaves, use calendar days; otherwise use working days
    let totalDaysToConsider = 0;
    let holidayDays = 0;
    let totalWorkingDays = 0;

    if (isSpecial) {
      // For maternity/paternity/emergency: count ALL calendar days
      totalDaysToConsider = numDays; // Use calendar days
      holidayDays = 0; // Holidays/weekends count as paid
      totalWorkingDays = numDays; // All days are considered "working" for payment
    } else {
      // For regular leaves: count only working days
      totalWorkingDays = calculator.calculateWorkingDays(
        request.startDate,
        request.endDate
      );
      holidayDays = numDays - totalWorkingDays;
      totalDaysToConsider = totalWorkingDays;
    }

    // Get available balance (only if credits are required)
    let availableBalance = 0;
    let usableBalance = 0;
    const MINIMUM_BALANCE = requiresCredits ? 1.25 : 0; // No minimum for special leaves

    if (requiresCredits) {
      availableBalance = await getLeaveBalanceForType(
        leaveType,
        request.personnel_id
      );
      usableBalance = Math.max(0, availableBalance - MINIMUM_BALANCE);
    } else {
      // Special leaves don't require credits, so all days are "usable"
      usableBalance = totalDaysToConsider;
    }

    console.log("=== LEAVE TYPE ANALYSIS ===");
    console.log("Leave Type:", leaveType);
    console.log("Is Special Leave:", isSpecial);
    console.log("Requires Credits:", requiresCredits);
    console.log("Total Calendar Days:", numDays);
    console.log("Days to Consider (for payment):", totalDaysToConsider);
    console.log("Holidays/Weekends:", holidayDays);

    let finalApproveFor = approveFor;
    let paidDays = 0;
    let unpaidDays = 0;
    let totalDeducted = 0;

    if (approveFor === "with_pay") {
      if (isSpecial || !requiresCredits) {
        // Special leaves: all days are paid, no credit deduction
        paidDays = totalDaysToConsider;
        unpaidDays = 0;
        totalDeducted = 0; // No credits deducted
        finalApproveFor = "with_pay";
      } else {
        // Regular leaves: check credit balance
        if (usableBalance >= totalDaysToConsider) {
          paidDays = totalDaysToConsider;
          unpaidDays = 0;
          totalDeducted = totalDaysToConsider;
          finalApproveFor = "with_pay";
        } else {
          // Insufficient balance - auto-split
          paidDays = Math.min(usableBalance, totalDaysToConsider);
          unpaidDays = totalDaysToConsider - paidDays;
          totalDeducted = paidDays;
          finalApproveFor = "both";

          toast.info(
            `⚠️ To preserve minimum balance of ${MINIMUM_BALANCE}, ` +
              `only ${usableBalance.toFixed(2)} credits are usable. ` +
              `${paidDays.toFixed(2)} days will be paid, ${unpaidDays.toFixed(
                2
              )} days will be unpaid.`,
            { duration: 5000 }
          );
        }
      }
    } else if (approveFor === "without_pay") {
      // All days are unpaid
      paidDays = 0;
      unpaidDays = totalDaysToConsider;
      totalDeducted = 0;
      console.log("Without Pay - No days deducted");
    } else if (approveFor === "both") {
      // For partial approval
      let validatedWithPayDays = Math.min(
        Math.max(0, withPayDays || 0),
        totalDaysToConsider
      );

      if (isSpecial || !requiresCredits) {
        // Special leaves: all requested paid days are approved
        paidDays = validatedWithPayDays;
        unpaidDays = totalDaysToConsider - paidDays;
        totalDeducted = 0; // No credits deducted
      } else {
        // Regular leaves: check against usable balance
        if (validatedWithPayDays > usableBalance) {
          const adjustedPaidDays = Math.min(usableBalance, totalDaysToConsider);
          const adjustedUnpaidDays = totalDaysToConsider - adjustedPaidDays;

          paidDays = adjustedPaidDays;
          unpaidDays = adjustedUnpaidDays;
          totalDeducted = paidDays;

          toast.info(
            `⚠️ To preserve minimum balance of ${MINIMUM_BALANCE}, ` +
              `only ${usableBalance.toFixed(2)} credits are usable. ` +
              `Auto-adjusted to ${paidDays.toFixed(
                2
              )} paid, ${unpaidDays.toFixed(2)} unpaid.`,
            { duration: 5000 }
          );
        } else {
          paidDays = validatedWithPayDays;
          unpaidDays = totalDaysToConsider - paidDays;
          totalDeducted = paidDays;
        }
      }
    }

    // Calculate balance after deduction
    let balanceAfter = availableBalance;
    if (requiresCredits) {
      balanceAfter = Math.max(
        MINIMUM_BALANCE,
        availableBalance - totalDeducted
      );
    }

    console.log("=== FINAL CALCULATION ===");
    console.log("Leave Type:", leaveType);
    console.log("Requires Credits:", requiresCredits);
    console.log("Balance Before:", availableBalance);
    console.log("Paid Days:", paidDays);
    console.log("Unpaid Days:", unpaidDays);
    console.log("Total Deducted from balance:", totalDeducted);
    console.log("Balance After:", balanceAfter);
    console.log("Payment Type:", finalApproveFor);

    // Update leave request with payment details (REMOVED is_special_leave and requires_credits columns)
    const updateData = {
      status: "Approved",
      approve_for: finalApproveFor,
      paid_days: paidDays,
      unpaid_days: unpaidDays,
      working_days: totalWorkingDays,
      holiday_days: holidayDays,
      updated_at: new Date().toISOString(),
      approved_by: adminUsername,
      balance_before: requiresCredits ? availableBalance : 0,
      balance_after: requiresCredits ? balanceAfter : 0,
      minimum_balance_preserved: requiresCredits ? MINIMUM_BALANCE : 0,
      usable_balance_used: requiresCredits
        ? usableBalance
        : totalDaysToConsider,
    };

    // Update in database
    const { error } = await supabase
      .from("leave_requests")
      .update(updateData)
      .eq("id", requestId);

    if (error) {
      console.error("Database update error:", error);
      toast.error("Failed to update leave request in database");
      throw error;
    }

    // Deduct ONLY paid days from leave balance (only if credits are required)
    if (totalDeducted > 0 && requiresCredits) {
      if (request.leave_balance_id) {
        await updateLeaveBalanceForApproval(
          request.leave_balance_id,
          leaveType,
          totalDeducted
        );
      } else {
        await updatePersonnelLeaveBalance(
          request.personnel_id,
          leaveType,
          totalDeducted,
          false
        );
      }
    }

    // Update local state
    const updatedRequest = {
      ...request,
      ...updateData,
      status: "Approved",
      approve_for: finalApproveFor,
      paid_days: paidDays,
      unpaid_days: unpaidDays,
    };

    setLeaveRequests((prev) =>
      prev.map((req) => (req.id === requestId ? updatedRequest : req))
    );

    setFilteredRequests((prev) =>
      prev.map((req) => (req.id === requestId ? updatedRequest : req))
    );

    // Show success message
    let message = `✅ Leave approved successfully!\n\n`;
    message += `📊 **Breakdown:**\n`;
    message += `• Calendar Days: ${numDays}\n`;

    if (!isSpecial) {
      message += `• Working Days: ${totalWorkingDays}\n`;
      if (holidayDays > 0) {
        message += `• Holidays/Weekends: ${holidayDays}\n`;
      }
    }

    message += `\n💰 **Payment Details:**\n`;

    if (finalApproveFor === "with_pay") {
      if (isSpecial) {
        message += `• ${paidDays.toFixed(
          2
        )} paid days (all calendar days counted)\n`;
        message += `• ✅ Special leave - holidays/weekends count as paid\n`;
      } else {
        message += `• ${paidDays.toFixed(2)} paid working days\n`;
        if (unpaidDays > 0) {
          message += `• ${unpaidDays.toFixed(2)} unpaid working days\n`;
          message += `• ⚠️ Auto-split to preserve minimum balance of ${MINIMUM_BALANCE}\n`;
        }
      }
    } else if (finalApproveFor === "without_pay") {
      message += `• ${unpaidDays.toFixed(2)} unpaid days\n`;
    } else if (finalApproveFor === "both") {
      message += `• ${paidDays.toFixed(2)} paid days\n`;
      message += `• ${unpaidDays.toFixed(2)} unpaid days\n`;
      if (paidDays < withPayDays) {
        message += `• ⚠️ Auto-adjusted to preserve minimum balance of ${MINIMUM_BALANCE}\n`;
      }
    }

    // Replace the entire success message section with just a simple success message:
    toast.success("Leave request approved successfully!", {
      duration: 3000,
      position: "top-right",
    });

    // Close modal
    setShowApprovalOptionsModal(false);
    setSelectedRequestForApproval(null);

    // Refresh data after a short delay
    setTimeout(() => {
      loadLeaveRequests();
    }, 1000);
  } catch (error) {
    console.error("Error approving leave:", error);
    toast.error(`Failed to approve leave: ${error.message}`);
  } finally {
    setProcessingAction(null);
  }
};

const ApprovalOptionsModal = ({ request, onClose, onApprove }) => {
  // Helper functions for leave type analysis
  const isSpecialLeaveType = (leaveType) => {
    if (!leaveType) return false;
    const type = leaveType.toLowerCase().trim();
    return (
      type === "maternity" ||
      type === "paternity" ||
      type === "emergency" ||
      type === "emergency leave"
    );
  };

  const doesRequireLeaveCredits = (leaveType) => {
    if (!leaveType) return true;
    const type = leaveType.toLowerCase().trim();
    // Emergency, Maternity, Paternity don't require credits
    return !(
      type.includes("emergency") ||
      type === "maternity" ||
      type === "paternity"
    );
  };

  const [approveFor, setApproveFor] = useState("");
  const [withPayDays, setWithPayDays] = useState(0);
  const [breakdown, setBreakdown] = useState(null);
  const [totalWorkingDays, setTotalWorkingDays] = useState(0);
  const [holidayDays, setHolidayDays] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [requiresCredits, setRequiresCredits] = useState(true);
  const [isSpecialLeave, setIsSpecialLeave] = useState(false);
  const [MINIMUM_BALANCE, setMinimumBalance] = useState(1.25);
  const [usableBalance, setUsableBalance] = useState(0);
  const [leaveType, setLeaveType] = useState("");

  // Initialize values based on request
  useEffect(() => {
    const calculateInitialValues = async () => {
      if (!request) return;

      setIsCalculating(true);

      try {
        const currentLeaveType =
          request.leaveType || request.leave_type || "Vacation";
        setLeaveType(currentLeaveType);

        const specialLeave = isSpecialLeaveType(currentLeaveType);
        const needsCredits = doesRequireLeaveCredits(currentLeaveType);

        setIsSpecialLeave(specialLeave);
        setRequiresCredits(needsCredits);

        // Set minimum balance: 0 for special leaves, 1.25 for others
        const minBalance = needsCredits ? 1.25 : 0;
        setMinimumBalance(minBalance);

        const calculator = new LeaveCalculator(holidays);
        const numDays = request.numDays || request.num_days || 0;

        let totalWorkingDaysCalc = 0;
        let holidayDaysCalc = 0;

        if (specialLeave) {
          // For special leaves: all calendar days count
          totalWorkingDaysCalc = numDays;
          holidayDaysCalc = 0;
        } else {
          // For regular leaves: exclude holidays/weekends
          totalWorkingDaysCalc = calculator.calculateWorkingDays(
            request.startDate,
            request.endDate
          );
          holidayDaysCalc = numDays - totalWorkingDaysCalc;
        }

        setTotalWorkingDays(totalWorkingDaysCalc);
        setHolidayDays(holidayDaysCalc);

        // Get available balance only if credits are required
        let balance = 0;
        if (needsCredits) {
          balance = await getLeaveBalanceForType(
            currentLeaveType,
            request.personnel_id
          );
        }
        setAvailableBalance(balance);

        // Calculate usable balance
        const usable = needsCredits
          ? Math.max(0, balance - minBalance)
          : totalWorkingDaysCalc; // All days are usable for special leaves

        setUsableBalance(usable);

        // Default withPayDays to usable balance
        const defaultWithPayDays = Math.min(usable, totalWorkingDaysCalc);
        setWithPayDays(defaultWithPayDays);

        console.log("Initial calculation:", {
          leaveType: currentLeaveType,
          isSpecialLeave: specialLeave,
          requiresCredits: needsCredits,
          totalCalendarDays: numDays,
          totalWorkingDays: totalWorkingDaysCalc,
          holidayDays: holidayDaysCalc,
          availableBalance: balance,
          usableBalance: usable,
          minimumBalance: minBalance,
        });
      } catch (error) {
        console.error("Error calculating initial values:", error);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateInitialValues();
  }, [request, holidays]);

  // Recalculate breakdown when options change
  useEffect(() => {
    if (approveFor) {
      // Only calculate if an option is selected
      calculateBreakdown();
    } else {
      setBreakdown(null); // Clear breakdown if no option selected
    }
  }, [approveFor, withPayDays]);

  const calculateBreakdown = async () => {
    if (!request || isCalculating || !approveFor) return;

    setIsCalculating(true);

    try {
      let validatedWithPayDays = withPayDays;
      let calculatedPaidDays = 0;
      let calculatedUnpaidDays = 0;
      let totalDeducted = 0;

      if (approveFor === "with_pay") {
        if (isSpecialLeave || !requiresCredits) {
          // Special leaves: all days are paid, no credit deduction
          calculatedPaidDays = totalWorkingDays;
          calculatedUnpaidDays = 0;
          validatedWithPayDays = totalWorkingDays;
          totalDeducted = 0;
        } else {
          // Regular leaves: check credit balance
          if (usableBalance >= totalWorkingDays) {
            calculatedPaidDays = totalWorkingDays;
            calculatedUnpaidDays = 0;
            validatedWithPayDays = totalWorkingDays;
            totalDeducted = totalWorkingDays;
          } else {
            // Insufficient balance - auto-split
            calculatedPaidDays = Math.min(usableBalance, totalWorkingDays);
            calculatedUnpaidDays = totalWorkingDays - calculatedPaidDays;
            validatedWithPayDays = calculatedPaidDays;
            totalDeducted = calculatedPaidDays;
          }
        }
      } else if (approveFor === "without_pay") {
        calculatedPaidDays = 0;
        calculatedUnpaidDays = totalWorkingDays;
        validatedWithPayDays = 0;
        totalDeducted = 0;
      } else if (approveFor === "both") {
        // Validate withPayDays
        validatedWithPayDays = Math.min(
          Math.max(0, withPayDays),
          totalWorkingDays
        );

        if (isSpecialLeave || !requiresCredits) {
          // Special leaves: all requested paid days are approved
          calculatedPaidDays = validatedWithPayDays;
          calculatedUnpaidDays = totalWorkingDays - validatedWithPayDays;
          totalDeducted = 0;
        } else {
          // Regular leaves: check against usable balance
          if (validatedWithPayDays > usableBalance) {
            const adjustedPaidDays = Math.min(usableBalance, totalWorkingDays);
            const adjustedUnpaidDays = totalWorkingDays - adjustedPaidDays;

            calculatedPaidDays = adjustedPaidDays;
            calculatedUnpaidDays = adjustedUnpaidDays;
            validatedWithPayDays = adjustedPaidDays;
            totalDeducted = calculatedPaidDays;
          } else {
            calculatedPaidDays = validatedWithPayDays;
            calculatedUnpaidDays = totalWorkingDays - validatedWithPayDays;
            totalDeducted = calculatedPaidDays;
          }
        }
      }

      // Calculate final balance after deduction
      const balanceAfter = requiresCredits
        ? Math.max(MINIMUM_BALANCE, availableBalance - totalDeducted)
        : availableBalance; // No change for special leaves

      setBreakdown({
        totalWorkingDays: totalWorkingDays,
        paidDays: calculatedPaidDays,
        unpaidDays: calculatedUnpaidDays,
        holidayDays: holidayDays,
        availableBalance: availableBalance,
        usableBalance: usableBalance,
        minimumBalance: MINIMUM_BALANCE,
        balanceAfter: balanceAfter,
        totalDeducted: totalDeducted,
        isSpecialLeave: isSpecialLeave,
        requiresCredits: requiresCredits,
        // Validation flags
        canFullyPay: usableBalance >= totalWorkingDays,
        canPartiallyPay: usableBalance > 0 && usableBalance < totalWorkingDays,
        cannotPay: usableBalance === 0 && requiresCredits,
        // Special flags for UI
        requiresAutoSplit:
          approveFor === "with_pay" &&
          requiresCredits &&
          usableBalance < totalWorkingDays,
        requiresAdjustment:
          approveFor === "both" &&
          requiresCredits &&
          withPayDays > usableBalance,
      });
    } catch (error) {
      console.error("Error calculating breakdown:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Check if options should be disabled
  const getOptionDisabledStatus = () => {
    if (isSpecialLeave || !requiresCredits) {
      // Special leaves: all options available
      return {
        withPayDisabled: false,
        withoutPayDisabled: false,
        partialDisabled: false,
        sliderDisabled: approveFor !== "both",
      };
    }

    return {
      // "With Pay" should be disabled if usable balance is 0
      withPayDisabled: usableBalance === 0,
      withoutPayDisabled: false,
      // "Partial" should be disabled if usable balance is 0
      partialDisabled: usableBalance === 0,
      // Slider should be disabled if usable balance is 0 or no option selected
      sliderDisabled: usableBalance === 0 || approveFor !== "both",
    };
  };

  const disabledStatus = getOptionDisabledStatus();

  const handleWithPayDaysChange = (value) => {
    const parsedValue = parseFloat(value) || 0;
    let maxValue = totalWorkingDays;

    if (requiresCredits) {
      maxValue = Math.min(totalWorkingDays, usableBalance);
    }

    const clampedValue = Math.max(0, Math.min(parsedValue, maxValue));
    setWithPayDays(clampedValue);
  };

  const handleSliderChange = (value) => {
    const parsedValue = parseFloat(value) || 0;
    setWithPayDays(parsedValue);
  };

  const handleApprove = () => {
    if (isCalculating || !approveFor) return;

    // For "with_pay" and "without_pay", don't pass withPayDays
    const finalWithPayDays = approveFor === "both" ? withPayDays : undefined;

    onApprove(request.id, approveFor, finalWithPayDays);
  };

  // Calculate days without pay for display
  const daysWithoutPay = totalWorkingDays - withPayDays;

  // Format leave type for display
  const formatLeaveTypeDisplay = (type) => {
    if (!type) return "N/A";
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  };

  return (
    <div className={styles.confirmationModalOverlay} onClick={onClose}>
      <div
        className={`${styles.confirmationModal} ${styles.landscapeModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className={styles.confirmationHeader}>
          <div className={styles.headerContent}>
            <h2>Approve Leave Request</h2>
            <div className={styles.headerInfo}>
              <div className={styles.employeeBadge}>
                <span className={styles.employeeName}>
                  {request?.employeeName || "Unknown"}
                </span>
                <span className={styles.leaveType}>
                  {formatLeaveTypeDisplay(request?.leaveType)} Leave
                  {isSpecialLeave && (
                    <span className={styles.specialLeaveBadge}>SPECIAL</span>
                  )}
                </span>
              </div>
              <div className={styles.leaveDates}>
                {request?.startDate ? formatDate(request.startDate) : "N/A"} →{" "}
                {request?.endDate ? formatDate(request.endDate) : "N/A"}
                <span className={styles.daysBadge}>
                  {request?.numDays || request?.num_days || 0} days
                </span>
              </div>
            </div>
          </div>
          <button className={styles.confirmationCloseBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        {/* MAIN CONTENT */}
        <div className={styles.landscapeContent}>
          {/* LEFT COLUMN - PAYMENT OPTIONS */}
          <div className={styles.leftColumn}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>💰</span>
                Payment Type
                {isSpecialLeave && (
                  <span className={styles.specialTypeIndicator}>
                    • Special Leave
                  </span>
                )}
              </h3>

              {isCalculating && (
                <div className={styles.calculatingOverlay}>
                  <div className={styles.calculatingSpinner}></div>
                  <span>Calculating...</span>
                </div>
              )}

              {/* SPECIAL LEAVE BANNER */}
              {isSpecialLeave && (
                <div className={styles.specialLeaveBanner}>
                  <div className={styles.specialLeaveIcon}>🎉</div>
                  <div className={styles.specialLeaveContent}>
                    <strong>
                      Special Leave ({formatLeaveTypeDisplay(leaveType)})
                    </strong>
                    <p>
                      • All calendar days count as paid (including
                      holidays/weekends)
                      <br />
                      • No leave credits required
                      <br />• Full payment for all days
                    </p>
                  </div>
                </div>
              )}

              {/* BALANCE WARNING BANNER - Only for regular leaves */}
              {requiresCredits && usableBalance === 0 && (
                <div className={styles.severeWarningCard}>
                  <div className={styles.warningIcon}>🚫</div>
                  <div className={styles.warningContent}>
                    <strong>Cannot Approve as Paid Leave</strong>
                    <p>
                      Available balance ({availableBalance.toFixed(2)}) minus
                      minimum preservation ({MINIMUM_BALANCE}) leaves 0 usable
                      credits.
                    </p>
                    <p>
                      <strong>Only "Without Pay" option is available.</strong>
                    </p>
                  </div>
                </div>
              )}

              {requiresCredits &&
                usableBalance > 0 &&
                usableBalance < totalWorkingDays && (
                  <div className={styles.warningCard}>
                    <div className={styles.warningIcon}>⚠️</div>
                    <div className={styles.warningContent}>
                      <strong>Partial Payment Required</strong>
                      <p>
                        Only {usableBalance.toFixed(2)} credits are usable
                        (preserving {MINIMUM_BALANCE} minimum balance).
                        {totalWorkingDays - usableBalance} day(s) will be
                        unpaid.
                      </p>
                    </div>
                  </div>
                )}

              <div className={styles.paymentOptions}>
                {/* With Pay Option */}
                <div
                  className={`${styles.paymentOption} ${
                    approveFor === "with_pay" ? styles.selected : ""
                  } ${
                    disabledStatus.withPayDisabled ? styles.disabledOption : ""
                  }`}
                >
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="with_pay"
                      checked={approveFor === "with_pay"}
                      onChange={(e) => setApproveFor(e.target.value)}
                      disabled={isCalculating || disabledStatus.withPayDisabled}
                    />
                    <div className={styles.radioContent}>
                      <div className={styles.optionHeader}>
                        <span className={styles.optionTitle}>With Pay</span>
                        {isSpecialLeave ? (
                          <span className={styles.optionBadgeSuccess}>
                            Available
                          </span>
                        ) : usableBalance >= totalWorkingDays ? (
                          <span className={styles.optionBadge}>Available</span>
                        ) : usableBalance > 0 ? (
                          <span className={styles.optionBadgeWarning}>
                            Will Auto-Split
                          </span>
                        ) : (
                          <span className={styles.optionBadgeDanger}>
                            Unavailable
                          </span>
                        )}
                      </div>
                      <div className={styles.optionDescription}>
                        {isSpecialLeave
                          ? "Employee receives full salary for all days"
                          : usableBalance >= totalWorkingDays
                          ? "Employee receives full salary during leave"
                          : usableBalance > 0
                          ? `Will auto-split: ${Math.min(
                              usableBalance,
                              totalWorkingDays
                            ).toFixed(2)} paid, ${Math.max(
                              0,
                              totalWorkingDays - usableBalance
                            ).toFixed(2)} unpaid`
                          : "Not available - insufficient usable credits"}
                      </div>
                      {disabledStatus.withPayDisabled && requiresCredits && (
                        <div className={styles.disabledReason}>
                          {usableBalance === 0
                            ? `❌ 0 usable credits (preserving ${MINIMUM_BALANCE} minimum balance)`
                            : `❌ Insufficient credits (need ${totalWorkingDays}, have ${usableBalance.toFixed(
                                2
                              )} usable)`}
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Without Pay Option */}
                <div
                  className={`${styles.paymentOption} ${
                    approveFor === "without_pay" ? styles.selected : ""
                  }`}
                >
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="without_pay"
                      checked={approveFor === "without_pay"}
                      onChange={(e) => setApproveFor(e.target.value)}
                      disabled={isCalculating}
                    />
                    <div className={styles.radioContent}>
                      <div className={styles.optionHeader}>
                        <span className={styles.optionTitle}>Without Pay</span>
                        <span className={styles.optionBadge}>
                          Always Available
                        </span>
                      </div>
                      <div className={styles.optionDescription}>
                        Employee receives no salary during leave
                      </div>
                      <div className={styles.optionDetails}>
                        <span className={styles.detailItem}>
                          ❌ {totalWorkingDays} days unpaid
                        </span>
                        {requiresCredits && (
                          <>
                            <span className={styles.detailItem}>
                              ✅ Preserves all leave credits
                            </span>
                            <span className={styles.detailItem}>
                              ✅ Minimum balance of {MINIMUM_BALANCE} maintained
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Partial (Mixed) Option */}
                <div
                  className={`${styles.paymentOption} ${
                    approveFor === "both" ? styles.selected : ""
                  } ${
                    disabledStatus.partialDisabled ? styles.disabledOption : ""
                  }`}
                >
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="both"
                      checked={approveFor === "both"}
                      onChange={(e) => setApproveFor(e.target.value)}
                      disabled={isCalculating || disabledStatus.partialDisabled}
                    />
                    <div className={styles.radioContent}>
                      <div className={styles.optionHeader}>
                        <span className={styles.optionTitle}>
                          Partial (Mixed)
                        </span>
                        {isSpecialLeave ? (
                          <span className={styles.optionBadgeSuccess}>
                            Available
                          </span>
                        ) : usableBalance > 0 ? (
                          <span className={styles.optionBadgeInfo}>
                            Available
                          </span>
                        ) : (
                          <span className={styles.optionBadgeDanger}>
                            Unavailable
                          </span>
                        )}
                      </div>
                      <div className={styles.optionDescription}>
                        {isSpecialLeave
                          ? `Split days (any ${totalWorkingDays} days can be paid)`
                          : usableBalance > 0
                          ? `Split working days (up to ${usableBalance.toFixed(
                              2
                            )} paid)`
                          : "Not available - insufficient usable credits"}
                      </div>
                      {disabledStatus.partialDisabled && requiresCredits && (
                        <div className={styles.disabledReason}>
                          ❌ 0 usable credits (preserving {MINIMUM_BALANCE}{" "}
                          minimum balance)
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Partial Days Section - Only for "both" mode and when selected */}
              {approveFor === "both" && !disabledStatus.partialDisabled && (
                <div className={styles.partialSection}>
                  <div className={styles.sliderHeader}>
                    <h4>Days with Pay</h4>
                    <div className={styles.sliderStats}>
                      <span className={styles.totalWorkingDaysDisplay}>
                        Total Days: <strong>{totalWorkingDays}</strong>
                        {!isSpecialLeave &&
                          holidayDays > 0 &&
                          ` (excludes ${holidayDays} holiday(s)/weekend(s))`}
                      </span>
                      {requiresCredits && (
                        <span className={styles.usableBalanceDisplay}>
                          Usable Credits:{" "}
                          <strong>{usableBalance.toFixed(2)}</strong>
                          (preserving {MINIMUM_BALANCE} minimum)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      min="0"
                      max={
                        requiresCredits
                          ? Math.min(totalWorkingDays, usableBalance)
                          : totalWorkingDays
                      }
                      value={withPayDays}
                      onChange={(e) => handleSliderChange(e.target.value)}
                      className={styles.rangeSlider}
                      disabled={isCalculating || disabledStatus.sliderDisabled}
                    />
                    <div className={styles.sliderLabels}>
                      <span>0</span>
                      <span>
                        {Math.floor(
                          (requiresCredits
                            ? Math.min(totalWorkingDays, usableBalance)
                            : totalWorkingDays) / 2
                        )}
                      </span>
                      <span>
                        {requiresCredits
                          ? Math.min(totalWorkingDays, usableBalance)
                          : totalWorkingDays}
                      </span>
                    </div>
                  </div>

                  <div className={styles.daysInputRow}>
                    <div className={styles.inputGroup}>
                      <label>Days with pay:</label>
                      <input
                        type="number"
                        min="0"
                        max={
                          requiresCredits
                            ? Math.min(totalWorkingDays, usableBalance)
                            : totalWorkingDays
                        }
                        value={withPayDays}
                        onChange={(e) =>
                          handleWithPayDaysChange(e.target.value)
                        }
                        className={styles.daysInput}
                        disabled={
                          isCalculating || disabledStatus.sliderDisabled
                        }
                      />
                      <small className={styles.inputHelper}>
                        Enter 0-
                        {(requiresCredits
                          ? Math.min(totalWorkingDays, usableBalance)
                          : totalWorkingDays
                        ).toFixed(2)}{" "}
                        days
                        {requiresCredits &&
                          ` (max ${usableBalance.toFixed(2)} usable credits)`}
                      </small>
                    </div>

                    <div className={styles.daysPreview}>
                      <div className={styles.daysBar}>
                        <div
                          className={styles.paidBar}
                          style={{
                            width:
                              totalWorkingDays > 0
                                ? `${(withPayDays / totalWorkingDays) * 100}%`
                                : "0%",
                          }}
                        ></div>
                        <div
                          className={styles.unpaidBar}
                          style={{
                            width:
                              totalWorkingDays > 0
                                ? `${
                                    (daysWithoutPay / totalWorkingDays) * 100
                                  }%`
                                : "0%",
                          }}
                        ></div>
                      </div>
                      <div className={styles.barLabels}>
                        <span>Paid ({withPayDays.toFixed(2)})</span>
                        <span>Unpaid ({daysWithoutPay.toFixed(2)})</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Show message if no option selected yet */}
              {!approveFor && (
                <div className={styles.selectionPrompt}>
                  <div className={styles.promptIcon}>👉</div>
                  <div className={styles.promptText}>
                    <strong>Please select a payment option</strong>
                    <p>Choose how you want to approve this leave request</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - BREAKDOWN & ACTIONS */}
          <div className={styles.rightColumn}>
            {/* Leave Type Summary Card */}
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>📋</span>
                Leave Type Summary
              </h3>
              <div className={styles.leaveTypeSummary}>
                <div className={styles.summaryRow}>
                  <span>Type:</span>
                  <strong className={styles.leaveTypeValue}>
                    {formatLeaveTypeDisplay(leaveType)} Leave
                  </strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Category:</span>
                  <strong
                    className={
                      isSpecialLeave ? styles.specialValue : styles.regularValue
                    }
                  >
                    {isSpecialLeave ? "Special Leave" : "Regular Leave"}
                  </strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Credits Required:</span>
                  <strong
                    className={
                      requiresCredits
                        ? styles.requiresCredits
                        : styles.noCredits
                    }
                  >
                    {requiresCredits ? "Yes" : "No"}
                  </strong>
                </div>
                {isSpecialLeave && (
                  <div className={styles.specialLeaveNotes}>
                    <span className={styles.noteItem}>
                      ✅ All calendar days count as paid
                    </span>
                    <span className={styles.noteItem}>
                      ✅ Holidays/weekends included
                    </span>
                    <span className={styles.noteItem}>
                      ✅ No leave credit deduction
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Balance Summary Card - Only show if credits are required */}
            {requiresCredits && (
              <div className={styles.sectionCard}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>🏦</span>
                  Leave Credit Summary
                </h3>
                <div className={styles.balanceSummary}>
                  <div className={styles.balanceRow}>
                    <span>Available Balance:</span>
                    <strong className={styles.balanceValue}>
                      {availableBalance.toFixed(2)} days
                    </strong>
                  </div>
                  <div className={styles.balanceRow}>
                    <span>Minimum to Preserve:</span>
                    <strong className={styles.balanceValue}>
                      - {MINIMUM_BALANCE} days
                    </strong>
                  </div>
                  <div className={styles.balanceDivider}></div>
                  <div className={styles.balanceRow}>
                    <span>Usable Credits:</span>
                    <strong
                      className={`${styles.balanceValue} ${styles.highlighted}`}
                    >
                      {usableBalance.toFixed(2)} days
                    </strong>
                  </div>
                  <div className={styles.balanceNote}>
                    {usableBalance === 0 ? (
                      <span className={styles.warningText}>
                        ⚠️ Only "Without Pay" option available
                      </span>
                    ) : usableBalance < totalWorkingDays ? (
                      <span className={styles.warningText}>
                        ⚠️ Partial payment required ({usableBalance.toFixed(2)}/
                        {totalWorkingDays} days)
                      </span>
                    ) : (
                      <span className={styles.successText}>
                        ✅ Sufficient credits for full payment
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Leave Details Card */}
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>📅</span>
                Leave Details
              </h3>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Employee:</span>
                  <span className={styles.detailValue}>
                    {request.employeeName}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Days:</span>
                  <span className={styles.detailValue}>
                    {totalWorkingDays} {isSpecialLeave ? "calendar" : "working"}{" "}
                    days
                  </span>
                </div>
                {!isSpecialLeave && holidayDays > 0 && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>
                      Holidays/Weekends:
                    </span>
                    <span className={styles.detailValue}>
                      {holidayDays} days (excluded)
                    </span>
                  </div>
                )}
                {isSpecialLeave && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Calculation:</span>
                    <span className={styles.detailValue}>
                      All {totalWorkingDays} days count as paid
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Breakdown Card - Only show when an option is selected */}
            {breakdown && approveFor && (
              <div className={styles.sectionCard}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>🧮</span>
                  Payment Breakdown
                </h3>
                <div className={styles.breakdownGrid}>
                  <div className={styles.breakdownCard}>
                    <div className={styles.breakdownIcon}>📅</div>
                    <div className={styles.breakdownContent}>
                      <span className={styles.breakdownLabel}>Total Days</span>
                      <span className={styles.breakdownValue}>
                        {totalWorkingDays}
                      </span>
                    </div>
                  </div>
                  <div className={styles.breakdownCard}>
                    <div className={styles.breakdownIcon}>✅</div>
                    <div className={styles.breakdownContent}>
                      <span className={styles.breakdownLabel}>With Pay</span>
                      <span
                        className={`${styles.breakdownValue} ${styles.valueGreen}`}
                      >
                        {breakdown.paidDays?.toFixed(2) || 0}
                      </span>
                    </div>
                  </div>
                  <div className={styles.breakdownCard}>
                    <div className={styles.breakdownIcon}>❌</div>
                    <div className={styles.breakdownContent}>
                      <span className={styles.breakdownLabel}>Without Pay</span>
                      <span
                        className={`${styles.breakdownValue} ${styles.valueRed}`}
                      >
                        {breakdown.unpaidDays?.toFixed(2) || 0}
                      </span>
                    </div>
                  </div>
                  {requiresCredits && (
                    <div className={styles.breakdownCard}>
                      <div className={styles.breakdownIcon}>📊</div>
                      <div className={styles.breakdownContent}>
                        <span className={styles.breakdownLabel}>To Deduct</span>
                        <span className={styles.breakdownValue}>
                          {breakdown.totalDeducted?.toFixed(2) || 0} days
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Balance Information - Only for regular leaves */}
                {requiresCredits && (
                  <div className={styles.balanceInfo}>
                    <div className={styles.balanceItem}>
                      <span>Balance Before:</span>
                      <strong>
                        {breakdown.availableBalance?.toFixed(2) || 0} days
                      </strong>
                    </div>
                    <div className={styles.balanceItem}>
                      <span>Balance After:</span>
                      <strong className={styles.finalBalance}>
                        {breakdown.balanceAfter?.toFixed(2) || 0} days
                      </strong>
                    </div>
                    <div className={styles.minimumBalanceNote}>
                      ✅ Minimum balance of {MINIMUM_BALANCE} preserved
                    </div>
                  </div>
                )}

                {/* Special Leave Notes */}
                {isSpecialLeave && (
                  <div className={styles.specialLeaveBreakdown}>
                    <div className={styles.specialNote}>
                      <span className={styles.noteIcon}>🎉</span>
                      <div className={styles.noteContent}>
                        <strong>Special Leave Benefits</strong>
                        <p>
                          No leave credits required • All days paid • No balance
                          deduction
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER - ACTION BUTTONS */}
        <div className={styles.modalFooter}>
          <div className={styles.footerSummary}>
            <div className={styles.summaryItem}>
              <span>Selected:</span>
              <strong>
                {!approveFor
                  ? "None selected"
                  : approveFor === "with_pay"
                  ? "With Pay"
                  : approveFor === "without_pay"
                  ? "Without Pay"
                  : `Partial (${withPayDays.toFixed(
                      2
                    )} paid, ${daysWithoutPay.toFixed(2)} unpaid)`}
              </strong>
            </div>
            {breakdown && requiresCredits && (
              <div className={styles.summaryItem}>
                <span>To deduct:</span>
                <strong className={styles.deductionAmount}>
                  {breakdown.totalDeducted?.toFixed(2) || 0} days from leave
                  credits
                </strong>
              </div>
            )}
            {breakdown && !requiresCredits && (
              <div className={styles.summaryItem}>
                <span>Deduction:</span>
                <strong className={styles.noDeduction}>
                  No leave credits required (Special Leave)
                </strong>
              </div>
            )}
          </div>
          <div className={styles.footerActions}>
            <button
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isCalculating}
            >
              Cancel
            </button>
            <button
              className={styles.approveButton}
              onClick={handleApprove}
              disabled={isCalculating || !breakdown || !approveFor}
              title={!approveFor ? "Please select a payment option first" : ""}
            >
              {isCalculating ? (
                <div className={styles.loadingContent}>
                  <span className={styles.spinnerSmall}></span>
                  Calculating...
                </div>
              ) : !approveFor ? (
                <div className={styles.selectFirstContent}>
                  <span className={styles.selectIcon}>⚠️</span>
                  <div className={styles.selectText}>
                    <strong>Select Option First</strong>
                    <span className={styles.selectSubtext}>
                      Choose payment type above
                    </span>
                  </div>
                </div>
              ) : (
                <div className={styles.approveContent}>
                  <span className={styles.approveIcon}>✓</span>
                  <div className={styles.approveText}>
                    <strong>Approve Leave</strong>
                    {breakdown && (
                      <span className={styles.approveSubtext}>
                        {breakdown.paidDays?.toFixed(2) || 0} paid •{" "}
                        {breakdown.unpaidDays?.toFixed(2) || 0} unpaid
                      </span>
                    )}
                  </div>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
  const handleRejectClick = (id, employeeName) => {
    setSelectedRequest({ id, employeeName });
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const confirmApprove = async () => {
    if (selectedRequest) {
      await updateStatus(selectedRequest.id, "Approved");
    }
  };

  const confirmReject = async () => {
    if (selectedRequest) {
      await updateStatus(selectedRequest.id, "Rejected", rejectionReason);
    }
  };

  const cancelAction = () => {
    setShowApproveModal(false);
    setShowRejectModal(false);
    setSelectedRequest(null);
    setRejectionReason("");
  };

  const paginate = (data, page, rows) => {
    const start = (page - 1) * rows;
    return data.slice(start, start + rows);
  };

  const renderPaginationButtons = (page, setPage, rows) => {
    const pageCount = Math.max(1, Math.ceil(filteredRequests.length / rows));
    const hasNoRequests = filteredRequests.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.leavePaginationBtn} ${
          hasNoRequests ? styles.leaveDisabled : ""
        }`}
        disabled={page === 1 || hasNoRequests}
        onClick={() => setPage(Math.max(1, page - 1))}
      >
        Previous
      </button>
    );

    // Show page 1
    buttons.push(
      <button
        key={1}
        className={`${styles.leavePaginationBtn} ${
          1 === page ? styles.leaveActive : ""
        } ${hasNoRequests ? styles.leaveDisabled : ""}`}
        onClick={() => setPage(1)}
        disabled={hasNoRequests}
      >
        1
      </button>
    );

    // If pageCount is 5 or less, show all pages
    if (pageCount <= 4) {
      for (let i = 2; i <= pageCount; i++) {
        buttons.push(
          <button
            key={i}
            className={`${styles.leavePaginationBtn} ${
              i === page ? styles.leaveActive : ""
            } ${hasNoRequests ? styles.leaveDisabled : ""}`}
            onClick={() => setPage(i)}
            disabled={hasNoRequests}
          >
            {i}
          </button>
        );
      }
    } else {
      // If pageCount is more than 5, show ellipses and selective pages
      let startPage, endPage;

      if (page <= 3) {
        // When current page is 1, 2, or 3
        startPage = 2;
        endPage = 4;
      } else if (page >= pageCount - 2) {
        // When current page is near the end
        startPage = pageCount - 3;
        endPage = pageCount - 1;
      } else {
        // When current page is in the middle
        startPage = page - 1;
        endPage = page + 1;
      }

      // Show ellipsis after page 1 if needed
      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis1" className={styles.leavePaginationEllipsis}>
            ...
          </span>
        );
      }

      // Show middle pages
      for (let i = startPage; i <= endPage; i++) {
        if (i > 1 && i < pageCount) {
          buttons.push(
            <button
              key={i}
              className={`${styles.leavePaginationBtn} ${
                i === page ? styles.leaveActive : ""
              } ${hasNoRequests ? styles.leaveDisabled : ""}`}
              onClick={() => setPage(i)}
              disabled={hasNoRequests}
            >
              {i}
            </button>
          );
        }
      }

      // Show ellipsis before last page if needed
      if (endPage < pageCount - 1) {
        buttons.push(
          <span key="ellipsis2" className={styles.leavePaginationEllipsis}>
            ...
          </span>
        );
      }

      // Always show last page
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.leavePaginationBtn} ${
            pageCount === page ? styles.leaveActive : ""
          } ${hasNoRequests ? styles.leaveDisabled : ""}`}
          onClick={() => setPage(pageCount)}
          disabled={hasNoRequests}
        >
          {pageCount}
        </button>
      );
    }

    // Next button
    buttons.push(
      <button
        key="next"
        className={`${styles.leavePaginationBtn} ${
          hasNoRequests ? styles.leaveDisabled : ""
        }`}
        disabled={page === pageCount || hasNoRequests}
        onClick={() => setPage(Math.min(pageCount, page + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  const getStatusClass = (status) => {
    const statusLower = status?.toLowerCase() || "";

    if (statusLower === "pending") return styles.leavePending;
    if (statusLower === "approved" || statusLower === "completed")
      return styles.leaveApproved;
    if (statusLower === "rejected") return styles.leaveRejected;

    return styles[
      `leave${statusLower.charAt(0).toUpperCase() + statusLower.slice(1)}`
    ];
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === "N/A") return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "Invalid Date";
    }
  };

  // Calculate current paginated cards
  const currentCards = useMemo(() => {
    return paginate(filteredRequests, currentPageCards, rowsPerPageCards);
  }, [filteredRequests, currentPageCards, rowsPerPageCards]);

  // COMMENTED OUT PRELOADER CONDITIONAL RENDERING - not needed anymore
  if (!showContent) {
    return (
      <BFPPreloader
        loading={isInitializing}
        progress={loadingProgress}
        moduleTitle="LEAVE MANAGEMENT SYSTEM • Loading Leave Requests..."
        onRetry={() => {
          // Retry logic
          setIsInitializing(true);
          setShowContent(false);
          setLoadingProgress(0);
          setIsDataFullyLoaded(false);

          setTimeout(async () => {
            try {
              // Reset phases
              await updateLoadingPhase(0, "Checking Authentication");
              await checkIfAdmin();

              await updateLoadingPhase(1, "Loading User Data");
              await updateLoadingPhase(2, "Fetching Leave Requests");
              await loadLeaveRequests();

              await updateLoadingPhase(3, "Setting Up Real-time Updates");
              setupRealtimeUpdates();

              await updateLoadingPhase(4, "Finalizing");
              setIsDataFullyLoaded(true);

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
    <div className="app-container">
      <Title>Leave Management | BFP Villanueva</Title>
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
        <h1>Leave Management</h1>

        <div className={styles.leaveFilterSearchWrapper}>
          <div className={styles.leaveFilterGroup}>
            <label htmlFor="leaveStatusFilter">Filter by Status:</label>
            <select
              id={styles.leaveStatusFilter}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className={styles.leaveSearchGroup}>
            <label
              htmlFor="leaveSearchInput"
              style={{ fontWeight: "500", fontSize: "14px" }}
            >
              Search:
            </label>
            <input
              id={styles.leaveSearchInput}
              type="text"
              placeholder="Search by employee, type, location..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
        </div>
        <button className={styles.leaveViewToggle} onClick={toggleView}>
          🔄 Switch to {currentView === "table" ? "Card" : "Table"} View
        </button>

        {/* Optional: Show loading indicator while data is being fetched after initial load */}
        {!isDataFullyLoaded && showContent && (
          <div className={styles.dataLoadingIndicator}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading leave requests...</p>
          </div>
        )}

        {currentView === "table" && isDataFullyLoaded && (
          <>
            <div className={styles.tableTopPagination}>
              {renderPaginationButtons(
                currentPage,
                setCurrentPage,
                rowsPerPage
              )}
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.leaveTable}>
                <thead>
                  <tr>
                    <th>Personnel</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Date of Filing</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Number of Days</th>
                    <th>Status</th>
                    <th>Actions</th>
                    <th>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length > 0 ? (
                    paginate(filteredRequests, currentPage, rowsPerPage).map(
                      (req) => {
                        const statusClass = getStatusClass(req.status);
                        const isProcessing = processingAction === req.id;
                        const isPending =
                          req.status?.toLowerCase() === "pending";
                        const isApproved =
                          req.status?.toLowerCase() === "approved";
                        const isDownloadingPdf =
                          pdfDownloadForRequest === req.id;

                        return (
                          <tr key={req.id}>
                            <td className={styles.rankCellColumn}>
                              <div className={styles.rankCell}>
                                {req.rankImage ? (
                                  <img
                                    src={req.rankImage}
                                    alt={req.rank || "Rank"}
                                    className={styles.rankImage}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.style.display = "none";
                                    }}
                                  />
                                ) : null}
                                <div className={styles.nameContainer}>
                                  <span className={styles.employeeName}>
                                    {req.employeeName || "Unknown"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>{req.leaveType || "N/A"}</td>
                            <td>{req.location || "-"}</td>
                            <td>{formatDate(req.dateOfFiling)}</td>
                            <td>{formatDate(req.startDate)}</td>
                            <td>{formatDate(req.endDate)}</td>
                            <td>{req.num_days || 0}</td>
                            <td>
                              <span className={statusClass}>
                                {req.status || "Pending"}
                              </span>
                            </td>
                            <td className={styles.leaveActions}>
                              {isAdmin && isPending ? (
                                <div className={styles.actionButtons}>
                                  <button
                                    className={`${styles.leaveApprove} ${
                                      isProcessing ? styles.processing : ""
                                    }`}
                                    onClick={() =>
                                      handleApproveClick(
                                        req.id,
                                        req.employeeName
                                      )
                                    }
                                    disabled={isProcessing}
                                    title="Approve this leave request"
                                  >
                                    {isProcessing ? "Processing..." : "Approve"}
                                  </button>
                                  <button
                                    className={`${styles.leaveReject} ${
                                      isProcessing ? styles.processing : ""
                                    }`}
                                    onClick={() =>
                                      handleRejectClick(
                                        req.id,
                                        req.employeeName
                                      )
                                    }
                                    disabled={isProcessing}
                                    title="Reject this leave request"
                                  >
                                    {isProcessing ? "Processing..." : "Reject"}
                                  </button>
                                  <button
                                    className={styles.viewBtn}
                                    onClick={() => setModalData(req)}
                                    title="View details"
                                  >
                                    View
                                  </button>
                                </div>
                              ) : !isPending ? (
                                <div className={styles.statusInfo}>
                                  <button
                                    className={styles.viewBtn}
                                    onClick={() => setModalData(req)}
                                  >
                                    View
                                  </button>
                                </div>
                              ) : (
                                <div className={styles.actionButtons}>
                                  <button
                                    className={styles.viewBtn}
                                    onClick={() => setModalData(req)}
                                  >
                                    View
                                  </button>
                                </div>
                              )}
                            </td>
                            {/* NEW DOWNLOAD COLUMN */}
                            <td className={styles.downloadColumn}>
                              {isApproved ? (
                                <div className={styles.downloadActions}>
                                  {req.hasExistingPdf ? (
                                    <>
                                      <button
                                        className={styles.downloadExistingBtn}
                                        onClick={() =>
                                          downloadExistingPdf(
                                            req.existingPdfUrl,
                                            req
                                          )
                                        }
                                        title="Download existing PDF"
                                      >
                                        📥 Download
                                      </button>
                                      <button
                                        className={styles.customizePdfBtn}
                                        onClick={() =>
                                          handleCustomizeLeavePdf(req)
                                        }
                                        disabled={
                                          isDownloadingPdf || generatingPdf
                                        }
                                        title="Customize PDF with officer names"
                                      >
                                        ✏️ Customize
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      className={styles.generatePdfBtn}
                                      onClick={() =>
                                        generateAndUploadLeaveForm(req)
                                      }
                                      disabled={
                                        isDownloadingPdf || generatingPdf
                                      }
                                      title="Generate and download PDF form"
                                    >
                                      {isDownloadingPdf ? (
                                        <>
                                          <span
                                            className={styles.spinner}
                                          ></span>
                                          Generating...
                                        </>
                                      ) : (
                                        "📄 Generate PDF"
                                      )}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className={styles.notAvailable}>
                                  {req.status === "Pending"
                                    ? "Pending Approval"
                                    : "Not Available"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )
                  ) : (
                    <tr
                      className={
                        filteredRequests.length === 0
                          ? styles.leaveNoRequestsRow
                          : ""
                      }
                    >
                      <td colSpan="10" className={styles.leaveNoRequestsTable}>
                        <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                          <span className={styles.animatedEmoji}>📭</span>
                        </div>
                        <h3
                          style={{
                            fontSize: "18px",
                            fontWeight: "600",
                            color: "#2b2b2b",
                            marginBottom: "8px",
                          }}
                        >
                          No Leave Requests Found
                        </h3>
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#999",
                          }}
                        >
                          Try adjusting your search or filter criteria
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.tableBottomPagination}>
              {renderPaginationButtons(
                currentPage,
                setCurrentPage,
                rowsPerPage
              )}
            </div>
          </>
        )}

        {currentView === "cards" && (
          <>
            <div className={styles.cardsTopPagination}>
              {renderPaginationButtons(
                currentPageCards,
                setCurrentPageCards,
                rowsPerPageCards
              )}
            </div>

            <div id={styles.leaveCards} className={styles.leaveCards}>
              {filteredRequests.length === 0 ? (
                <div className={styles.leaveNoRequests}>
                  <div style={{ fontSize: "48px", marginBottom: "1px" }}>
                    <span className={styles.animatedEmoji}>📭</span>
                  </div>
                  <h3>No Leave Requests Found</h3>
                  <p>Try adjusting your search or filter criteria</p>
                </div>
              ) : (
                currentCards.map((req) => {
                  const statusClass = getStatusClass(req.status);
                  const isProcessing = processingAction === req.id;
                  const isPending = req.status?.toLowerCase() === "pending";
                  const isApproved = req.status?.toLowerCase() === "approved";
                  const isDownloadingPdf = pdfDownloadForRequest === req.id;

                  return (
                    <div key={req.id} className={styles.leaveCard}>
                      <div className={styles.leaveCardHeader}>
                        <div className={styles.cardRankName}>
                          {req.rankImage && (
                            <img
                              src={req.rankImage}
                              alt={req.rank || "Rank"}
                              className={styles.cardRankImage}
                            />
                          )}
                          <div className={styles.cardNameInfo}>
                            <h3>{req.employeeName || "Unknown Employee"}</h3>
                          </div>
                        </div>
                        <span className={statusClass}>
                          {req.status || "Pending"}
                        </span>
                      </div>
                      <div className={styles.leaveCardBody}>
                        <p>
                          <strong>Type:</strong> {req.leaveType || "N/A"}
                        </p>
                        <p>
                          <strong>Location:</strong> {req.location || "-"}
                        </p>
                        <p>
                          <strong>Duration:</strong> {formatDate(req.startDate)}{" "}
                          to {formatDate(req.endDate)}
                        </p>
                        <p>
                          <strong>Days:</strong> {req.num_days || 0}
                        </p>
                        <p>
                          <strong>Filed:</strong>
                          {formatDate(req.dateOfFiling) || "Unknown"}
                        </p>
                        {req.approved_by && req.status !== "Pending" && (
                          <p>
                            <strong>Processed by:</strong> {req.approved_by}
                          </p>
                        )}
                      </div>
                      <div className={styles.leaveCardActions}>
                        {isAdmin && isPending ? (
                          <div className={styles.cardActionButtons}>
                            <button
                              className={`${styles.leaveApprove} ${
                                isProcessing ? styles.processing : ""
                              }`}
                              onClick={() =>
                                handleApproveClick(req.id, req.employeeName)
                              }
                              disabled={isProcessing}
                            >
                              {isProcessing ? "Processing..." : "Approve"}
                            </button>
                            <button
                              className={`${styles.leaveReject} ${
                                isProcessing ? styles.processing : ""
                              }`}
                              onClick={() =>
                                handleRejectClick(req.id, req.employeeName)
                              }
                              disabled={isProcessing}
                            >
                              {isProcessing ? "Processing..." : "Reject"}
                            </button>

                            <button
                              className={styles.viewBtn}
                              onClick={() => setModalData(req)}
                            >
                              Details
                            </button>
                            {/* PDF Button in Card View */}
                            {isApproved && (
                              <button
                                className={styles.pdfCardBtn}
                                onClick={() => generateAndUploadLeaveForm(req)}
                                disabled={isDownloadingPdf || generatingPdf}
                                title="Download PDF Form"
                              >
                                {isDownloadingPdf ? "⏳" : "📄"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className={styles.cardActionButtons}>
                            <button
                              className={styles.viewBtn}
                              onClick={() => setModalData(req)}
                            >
                              Details
                            </button>
                            {/* PDF Button in Card View */}
                            {isApproved && (
                              <button
                                className={styles.pdfCardBtn}
                                onClick={() =>
                                  generateAndDownloadLeaveForm(req)
                                }
                                disabled={isDownloadingPdf || generatingPdf}
                                title="Download PDF Form"
                              >
                                {isDownloadingPdf ? "⏳" : "📄"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.cardsBottomPagination}>
              {renderPaginationButtons(
                currentPageCards,
                setCurrentPageCards,
                rowsPerPageCards
              )}
            </div>
          </>
        )}
        {/* Add this near your other modals (showApproveModal, showRejectModal) */}
        {showApprovalOptionsModal && selectedRequestForApproval && (
          <div
            className={`${styles.confirmationModalOverlay} ${
              isSidebarCollapsed ? "collapsed" : ""
            }`}
            style={{
              left: isSidebarCollapsed ? "80px" : "250px",
              width: isSidebarCollapsed
                ? "calc(100vw - 80px)"
                : "calc(100vw - 250px)",
            }}
            onClick={() => {
              setShowApprovalOptionsModal(false);
              setSelectedRequestForApproval(null);
            }}
          >
            <ApprovalOptionsModal
              request={selectedRequestForApproval}
              onClose={() => {
                setShowApprovalOptionsModal(false);
                setSelectedRequestForApproval(null);
              }}
              onApprove={handleApproveWithOptions}
            />
          </div>
        )}
        {showLeaveBreakdownModal && leaveBreakdown && (
          <div
            className={`${styles.confirmationModalOverlay} ${
              isSidebarCollapsed ? "collapsed" : ""
            }`}
            onClick={() => setShowLeaveBreakdownModal(false)}
          >
            <div className={styles.breakdownModal}>
              <h3>Leave Breakdown</h3>
              <div className={styles.breakdownDetails}>
                <p>
                  <strong>Total Calendar Days:</strong>{" "}
                  {leaveBreakdown.totalCalendarDays}
                </p>
                <p>
                  <strong>Working Days:</strong> {leaveBreakdown.workingDays}
                </p>
                <p>
                  <strong>Holidays/Weekends:</strong>{" "}
                  {leaveBreakdown.holidayDays}
                </p>

                {leaveBreakdown.holidaysInRange.length > 0 && (
                  <div className={styles.holidayList}>
                    <strong>Holidays during leave:</strong>
                    <ul>
                      {leaveBreakdown.holidaysInRange.map((holiday, idx) => (
                        <li key={idx}>
                          {new Date(holiday.date).toLocaleDateString()}:{" "}
                          {holiday.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {modalData && (
          <div
            className={`${styles.leaveModal} ${styles.leaveActive}`}
            onClick={() => setModalData(null)}
          >
            <div
              className={styles.leaveModalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className={styles.leaveCloseBtn}
                onClick={() => setModalData(null)}
              >
                &times;
              </span>
              <h2>Leave Request Details</h2>

              <div className={styles.modalContentGrid}>
                {/* Row 1: Basic Info */}
                <div className={styles.modalRow}>
                  <div className={styles.modalField}>
                    <label>Employee:</label>
                    <span>{modalData.employeeName || "Unknown"}</span>
                  </div>
                  <div className={styles.modalField}>
                    <label>Leave Type:</label>
                    <span>{modalData.leaveType || "N/A"}</span>
                  </div>
                </div>

                {/* Row 2: Location */}
                <div className={styles.modalRow}>
                  <div className={styles.modalFieldFull}>
                    <label>Location:</label>
                    <span>{modalData.location || "-"}</span>
                  </div>
                </div>

                {/* Row 3: Dates */}
                <div className={styles.modalRow}>
                  <div className={styles.modalField}>
                    <label>Start Date:</label>
                    <span>{formatDate(modalData.startDate) || "N/A"}</span>
                  </div>
                  <div className={styles.modalField}>
                    <label>End Date:</label>
                    <span>{formatDate(modalData.endDate) || "N/A"}</span>
                  </div>
                </div>

                {/* Row 4: Duration & Filing */}
                <div className={styles.modalRow}>
                  <div className={styles.modalField}>
                    <label>Duration:</label>
                    <span>{modalData.num_days || 0} day(s)</span>
                  </div>
                  <div className={styles.modalField}>
                    <label>Date Filed:</label>
                    <span>
                      {formatDate(modalData.dateOfFiling) || "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Row 5: Status & Processed */}
                <div className={styles.modalRow}>
                  <div className={styles.modalField}>
                    <label>Status:</label>
                    <span className={getStatusClass(modalData.status)}>
                      {modalData.status || "Pending"}
                    </span>
                  </div>
                  {modalData.approved_by && (
                    <div className={styles.modalField}>
                      <label>Processed by:</label>
                      <span>{modalData.approved_by}</span>
                    </div>
                  )}
                </div>

                {/* Row 6: Rank & Station */}
                <div className={styles.modalRow}>
                  {modalData.rank && (
                    <div className={styles.modalField}>
                      <label>Rank:</label>
                      <span>{modalData.rank}</span>
                    </div>
                  )}
                  {modalData.station && (
                    <div className={styles.modalField}>
                      <label>Station:</label>
                      <span>{modalData.station}</span>
                    </div>
                  )}
                </div>

                {/* Row 7: Reason/Appropriate */}
                {modalData.reason && (
                  <div className={styles.modalRow}>
                    <div className={styles.modalFieldFull}>
                      <label>Reason:</label>
                      <span className={styles.reasonText}>
                        {modalData.reason}
                      </span>
                    </div>
                  </div>
                )}

                {/* Row 8: Last Updated */}
                {modalData.updated_at && (
                  <div className={styles.modalRow}>
                    <div className={styles.modalFieldFull}>
                      <label>Last Updated:</label>
                      <span>
                        {new Date(modalData.updated_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* PDF Download Section */}
              {modalData.status?.toLowerCase() === "approved" && (
                <div className={styles.modalPdfSection}>
                  <hr />
                  <h3>PDF Form</h3>
                  {modalData.hasExistingPdf ? (
                    <div className={styles.existingPdfInfo}>
                      <p>✅ PDF form has been generated</p>
                      <button
                        className={styles.modalDownloadBtn}
                        onClick={() =>
                          downloadExistingPdf(
                            modalData.existingPdfUrl,
                            modalData // Pass the full object, not just filename
                          )
                        }
                      >
                        📥 Download PDF
                      </button>
                    </div>
                  ) : (
                    <div className={styles.generatePdfInfo}>
                      <p>📄 PDF form is available for download</p>
                      <button
                        className={styles.modalGenerateBtn}
                        onClick={() => {
                          generateAndUploadLeaveForm(modalData);
                          setModalData(null);
                        }}
                        disabled={generatingPdf}
                      >
                        {generatingPdf
                          ? "Generating..."
                          : "Generate & Download PDF"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Actions */}
              {isAdmin && modalData.status?.toLowerCase() === "pending" && (
                <div className={styles.modalActions}>
                  <button
                    className={styles.leaveApprove}
                    onClick={() => {
                      handleApproveClick(modalData.id, modalData.employeeName);
                      setModalData(null);
                    }}
                  >
                    ✓ Approve This Request
                  </button>
                  <button
                    className={styles.leaveReject}
                    onClick={() => {
                      handleRejectClick(modalData.id, modalData.employeeName);
                      setModalData(null);
                    }}
                  >
                    ✗ Reject This Request
                  </button>
                  <button
                    className={styles.calculateBtn}
                    onClick={() => showLeaveCalculation(modalData)}
                    title="Calculate working days and holidays"
                  >
                    🧮 Calculate
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {showApproveModal && selectedRequest && (
          <div
            className={`${styles.confirmationModalOverlay} ${
              isSidebarCollapsed ? "collapsed" : ""
            }`}
            style={{
              left: isSidebarCollapsed ? "80px" : "250px",
              width: isSidebarCollapsed
                ? "calc(100vw - 80px)"
                : "calc(100vw - 250px)",
            }}
            onClick={cancelAction}
          >
            <div
              className={styles.confirmationModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmationHeader}>
                <h2>Confirm Approval</h2>
                <button
                  className={styles.confirmationCloseBtn}
                  onClick={cancelAction}
                >
                  &times;
                </button>
              </div>

              <div className={styles.confirmationBody}>
                <div className={styles.confirmationIcon}>✅</div>
                <p className={styles.confirmationText}>
                  Are you sure you want to APPROVE the leave request for
                </p>
                <p className={styles.employeeNameHighlight}>
                  "{selectedRequest.employeeName}"?
                </p>
                <p className={styles.confirmationNote}>
                  This action will deduct the leave credits from the personnel's
                  balance. PDF form will be available for download after
                  approval.
                </p>
              </div>

              <div className={styles.confirmationActions}>
                <button
                  className={styles.confirmationCancelBtn}
                  onClick={cancelAction}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmationApproveBtn}
                  onClick={confirmApprove}
                  disabled={processingAction === selectedRequest.id}
                >
                  {processingAction === selectedRequest.id
                    ? "Processing..."
                    : "Approve"}
                </button>
              </div>
            </div>
          </div>
        )}
        {showRejectModal && selectedRequest && (
          <div
            className={`${styles.confirmationModalOverlay} ${
              isSidebarCollapsed ? "collapsed" : ""
            }`}
            onClick={cancelAction}
          >
            <div
              className={styles.confirmationModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmationHeader}>
                <h2>Confirm Rejection</h2>
                <button
                  className={styles.confirmationCloseBtn}
                  onClick={cancelAction}
                >
                  &times;
                </button>
              </div>

              <div className={styles.confirmationBody}>
                <div className={styles.confirmationIcon}>❌</div>
                <p className={styles.confirmationText}>
                  Are you sure you want to REJECT the leave request for
                </p>
                <p className={styles.employeeNameHighlight}>
                  "{selectedRequest.employeeName}"?
                </p>

                <div className={styles.rejectionReasonContainer}>
                  <label htmlFor="rejectionReason">
                    Reason for rejection (optional):
                  </label>
                  <textarea
                    id="rejectionReason"
                    className={styles.rejectionReasonInput}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    rows="3"
                  />
                </div>

                <p className={styles.confirmationNote}>
                  This action will return any deducted leave credits to the
                  personnel's balance.
                </p>
              </div>

              <div className={styles.confirmationActions}>
                <button
                  className={styles.confirmationCancelBtn}
                  onClick={cancelAction}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmationRejectBtn}
                  onClick={confirmReject}
                  disabled={processingAction === selectedRequest.id}
                >
                  {processingAction === selectedRequest.id
                    ? "Processing..."
                    : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
        {showLeaveOfficerModal && (
          <LeaveOfficerInputModal
            isOpen={showLeaveOfficerModal}
            onClose={() => {
              setShowLeaveOfficerModal(false);
              setSelectedRequestForCustomPdf(null);
            }}
            onConfirm={handleConfirmLeaveOfficerNames}
            initialData={leaveOfficerNames}
            isGenerating={
              generatingPdf &&
              pdfDownloadForRequest === selectedRequestForCustomPdf?.id
            }
          />
        )}
        {/* PDF Progress Overlay */}
        {generatingPdf && (
          <div className={styles.pdfProgressOverlay}>
            <div className={styles.pdfProgressModal}>
              <h3>Generating Leave Form PDF</h3>
              <div className={styles.pdfProgressBar}>
                <div
                  className={styles.pdfProgressFill}
                  style={{ width: `${pdfDownloadProgress}%` }}
                ></div>
              </div>
              <p>{pdfDownloadProgress}% Complete</p>
              <p className={styles.pdfProgressNote}>
                Please wait while we generate your leave form...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveManagement;
