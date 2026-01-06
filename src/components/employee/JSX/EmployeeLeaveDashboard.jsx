import React, { useState, useEffect, useCallback } from "react";
import EmployeeSidebar from "../../EmployeeSidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import styles from "../styles/EmployeeLeaveDashboard.module.css";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import { useAuth } from "../../AuthContext.jsx";
import LeaveMeter from "../JSX/LeaveMeter.jsx";

const EmployeeLeaveDashboard = () => {
  const { user } = useAuth(); // Get user from AuthContext
  const [employee, setEmployee] = useState(null);
  const [leaveData, setLeaveData] = useState({
    leaveCounts: { vacation: 0, sick: 0, emergency: 0 },
    userRequests: [],
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();

  // ===== NEW STATE VARIABLES =====
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [insufficientModalData, setInsufficientModalData] = useState(null);
  const [pendingEditData, setPendingEditData] = useState(null);
  const [isWithoutPay, setIsWithoutPay] = useState(false);
  // ===== END NEW STATE VARIABLES =====

  // Table and pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
  const rowsPerPage = 5;

  // Calculate days between dates
  const calculateDays = useCallback((start, end) => {
    if (!start || !end) return 0;
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays + 1; // Inclusive of both start and end dates
    } catch (error) {
      return 0;
    }
  }, []);

  // Date formatting helper
  const formatDate = useCallback((dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "Invalid Date";
    }
  }, []);

  // Main initialization effect
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setLoading(true);

        console.log("🔍 Initializing dashboard for user:", user?.username);

        if (!user || !user.username) {
          console.error("❌ No user found in auth context");
          setLoading(false);
          return;
        }

        // 1. Fetch employee data from Supabase
        console.log("📋 Fetching personnel data for:", user.username);
        const { data: employeeData, error: personnelError } = await supabase
          .from("personnel")
          .select("*")
          .eq("username", user.username.trim())
          .single();

        if (personnelError) {
          console.error("❌ Error fetching personnel:", personnelError);
          throw new Error(
            `Failed to load employee data: ${personnelError.message}`
          );
        }

        if (!employeeData) {
          console.error("❌ Employee not found for username:", user.username);
          throw new Error("Employee record not found");
        }

        console.log(
          "✅ Employee found:",
          employeeData.first_name,
          employeeData.last_name
        );
        setEmployee(employeeData);

        // 2. Fetch leave requests for this employee using personnel_id
        console.log(
          "📋 Fetching leave requests for personnel_id:",
          employeeData.id
        );
        const { data: leaveRequests, error: leaveError } = await supabase
          .from("leave_requests")
          .select("*")
          .eq("personnel_id", employeeData.id)
          .order("date_of_filing", { ascending: false });

        if (leaveError) {
          console.error("❌ Error fetching leave requests:", leaveError);
          throw new Error(
            `Failed to load leave requests: ${leaveError.message}`
          );
        }

        console.log("✅ Leave requests found:", leaveRequests?.length || 0);

        // 3. Calculate leave counts for APPROVED requests only
        const leaveCounts = { vacation: 0, sick: 0, emergency: 0 };
        (leaveRequests || []).forEach((req) => {
          if (req.status === "Approved") {
            const days =
              req.num_days || calculateDays(req.start_date, req.end_date);
            if (req.leave_type === "Vacation") leaveCounts.vacation += days;
            if (req.leave_type === "Sick") leaveCounts.sick += days;
            if (req.leave_type === "Emergency") leaveCounts.emergency += days;
          }
        });

        console.log("📊 Calculated leave counts:", leaveCounts);

        // 4. Update state
        setLeaveData({
          leaveCounts,
          userRequests: leaveRequests || [],
        });

        console.log("✅ Dashboard initialized successfully");
      } catch (error) {
        console.error("💥 Initialization error:", error);
        alert(`Error loading dashboard: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      initializeDashboard();
    } else {
      setLoading(false);
    }
  }, [user, calculateDays]);

  // ===== NEW HELPER FUNCTIONS =====
  const processLeaveEditUpdate = async (
    formData,
    oldLeaveType,
    newLeaveType,
    oldDays,
    newDays,
    isWithoutPay = false
  ) => {
    try {
      // 1. First, get current leave balances
      const { data: currentBalance, error: balanceError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("personnel_id", employee.id)
        .eq("year", new Date().getFullYear())
        .single();

      if (balanceError) {
        console.error("Error fetching leave balances:", balanceError);
        throw new Error("Could not fetch leave balances");
      }

      // 2. Prepare updates for leave_balances
      let balanceUpdates = {};
      let finalBalanceUpdates = {};

      if (oldLeaveType !== newLeaveType) {
        // Remove days from old leave type's used credits (if not without pay)
        if (!isWithoutPay && oldLeaveType) {
          switch (oldLeaveType) {
            case "Vacation":
              balanceUpdates.vacation_used = Math.max(
                0,
                (currentBalance.vacation_used || 0) - oldDays
              );
              break;
            case "Sick":
              balanceUpdates.sick_used = Math.max(
                0,
                (currentBalance.sick_used || 0) - oldDays
              );
              break;
            case "Emergency":
              balanceUpdates.emergency_used = Math.max(
                0,
                (currentBalance.emergency_used || 0) - oldDays
              );
              break;
          }
        }

        // Add days to new leave type's used credits (if not without pay)
        if (!isWithoutPay) {
          switch (newLeaveType) {
            case "Vacation":
              balanceUpdates.vacation_used =
                (currentBalance.vacation_used || 0) + newDays;
              break;
            case "Sick":
              balanceUpdates.sick_used =
                (currentBalance.sick_used || 0) + newDays;
              break;
            case "Emergency":
              balanceUpdates.emergency_used =
                (currentBalance.emergency_used || 0) + newDays;
              break;
          }
        }
      } else {
        // Same leave type, just adjust the days difference (if not without pay)
        if (!isWithoutPay) {
          const dayDifference = newDays - oldDays;
          switch (newLeaveType) {
            case "Vacation":
              balanceUpdates.vacation_used = Math.max(
                0,
                (currentBalance.vacation_used || 0) + dayDifference
              );
              break;
            case "Sick":
              balanceUpdates.sick_used = Math.max(
                0,
                (currentBalance.sick_used || 0) + dayDifference
              );
              break;
            case "Emergency":
              balanceUpdates.emergency_used = Math.max(
                0,
                (currentBalance.emergency_used || 0) + dayDifference
              );
              break;
          }
        }
      }

      // 3. Calculate new balances
      if (!isWithoutPay) {
        finalBalanceUpdates = {
          vacation_balance: Math.max(
            0,
            (currentBalance.initial_vacation_credits || 0) -
              (balanceUpdates.vacation_used ||
                currentBalance.vacation_used ||
                0)
          ),
          sick_balance: Math.max(
            0,
            (currentBalance.initial_sick_credits || 0) -
              (balanceUpdates.sick_used || currentBalance.sick_used || 0)
          ),
          emergency_balance: Math.max(
            0,
            (currentBalance.initial_emergency_credits || 0) -
              (balanceUpdates.emergency_used ||
                currentBalance.emergency_used ||
                0)
          ),
          ...balanceUpdates,
        };
      }

      // 4. Update leave balances if there are changes
      if (Object.keys(finalBalanceUpdates).length > 0) {
        const { error: balanceUpdateError } = await supabase
          .from("leave_balances")
          .update(finalBalanceUpdates)
          .eq("personnel_id", employee.id)
          .eq("year", new Date().getFullYear());

        if (balanceUpdateError) {
          console.error("Error updating leave balances:", balanceUpdateError);
          throw new Error("Could not update leave balances");
        }
      }

      // 5. Update the leave request
      const updatedRequest = {
        leave_type: newLeaveType,
        start_date: formData.get("startDate"),
        end_date: formData.get("endDate"),
        num_days: newDays,
        updated_at: new Date().toISOString(),
        approve_for: isWithoutPay ? "without_pay" : "with_pay",
        paid_days: isWithoutPay ? 0 : newDays,
        unpaid_days: isWithoutPay ? newDays : 0,
      };

      const { error } = await supabase
        .from("leave_requests")
        .update(updatedRequest)
        .eq("id", selectedRequest.id)
        .eq("personnel_id", employee.id);

      if (error) throw error;

      // 6. Refresh all data
      await Promise.all([refreshLeaveRequests(), refreshLeaveBalances()]);

      setEditModalOpen(false);
      setSelectedRequest(null);
      setIsWithoutPay(false);
      setShowInsufficientModal(false);
      setInsufficientModalData(null);
      setPendingEditData(null);

      alert(
        `Leave request updated successfully!${
          isWithoutPay ? " (Leave without pay)" : ""
        }`
      );
    } catch (error) {
      console.error("Error updating leave request:", error);
      alert(
        "Error updating leave request: " +
          (error.message || "Please try again.")
      );
    }
  };

  const refreshLeaveRequests = async () => {
    if (!employee) return;

    const { data: leaveRequests, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("personnel_id", employee.id)
      .order("date_of_filing", { ascending: false });

    if (error) {
      console.error("Error refreshing leave requests:", error);
      return;
    }

    // Recalculate leave counts for APPROVED requests only
    const leaveCounts = { vacation: 0, sick: 0, emergency: 0 };
    (leaveRequests || []).forEach((req) => {
      if (req.status === "Approved") {
        const days =
          req.num_days || calculateDays(req.start_date, req.end_date);
        if (req.leave_type === "Vacation") leaveCounts.vacation += days;
        if (req.leave_type === "Sick") leaveCounts.sick += days;
        if (req.leave_type === "Emergency") leaveCounts.emergency += days;
      }
    });

    setLeaveData({
      leaveCounts,
      userRequests: leaveRequests || [],
    });
  };

  const refreshLeaveBalances = async () => {
    if (!employee) return;
    console.log("Leave balances should be refreshed");
  };
  // ===== END NEW HELPER FUNCTIONS =====

  // Update leave cards
  const getLeaveCardData = () => {
    if (!employee || !leaveData) {
      return {
        vacation: { earned: "0", value: "0 / 0", progress: 0 },
        sick: { earned: "0", value: "0 / 0", progress: 0 },
        emergency: { earned: "0", value: "0 / 0", progress: 0 },
      };
    }

    // Calculate remaining leave days (earned minus approved days used)
    const remaining = {
      vacation: Math.max(
        0,
        (employee.earned_vacation || 0) - (leaveData.leaveCounts.vacation || 0)
      ),
      sick: Math.max(
        0,
        (employee.earned_sick || 0) - (leaveData.leaveCounts.sick || 0)
      ),
      emergency: Math.max(
        0,
        (employee.earned_emergency || 0) -
          (leaveData.leaveCounts.emergency || 0)
      ),
    };

    const earned = { vacation: 1.25, sick: 1, emergency: 0.5 };

    return {
      vacation: {
        earned: earned.vacation.toFixed(2),
        value: `${remaining.vacation.toFixed(2)} / ${(
          employee.earned_vacation || 0
        ).toFixed(2)}`,
        progress:
          (employee.earned_vacation || 0) > 0
            ? (remaining.vacation / (employee.earned_vacation || 1)) * 100
            : 0,
      },
      sick: {
        earned: earned.sick.toFixed(2),
        value: `${remaining.sick.toFixed(2)} / ${(
          employee.earned_sick || 0
        ).toFixed(2)}`,
        progress:
          (employee.earned_sick || 0) > 0
            ? (remaining.sick / (employee.earned_sick || 1)) * 100
            : 0,
      },
      emergency: {
        earned: earned.emergency.toFixed(2),
        value: `${remaining.emergency.toFixed(2)} / ${(
          employee.earned_emergency || 0
        ).toFixed(2)}`,
        progress:
          (employee.earned_emergency || 0) > 0
            ? (remaining.emergency / (employee.earned_emergency || 1)) * 100
            : 0,
      },
    };
  };

  // Summary cards data
  const getSummaryCardsData = () => {
    const allRequests = leaveData.userRequests || [];

    // Count all requests by status
    const approvedRequests = allRequests.filter(
      (req) => req.status === "Approved"
    ).length;
    const pendingRequests = allRequests.filter(
      (req) => req.status === "Pending"
    ).length;
    const rejectedRequests = allRequests.filter(
      (req) => req.status === "Rejected"
    ).length;
    const totalRequests = allRequests.length;

    return {
      total: totalRequests,
      approved: approvedRequests,
      pending: pendingRequests,
      rejected: rejectedRequests,
    };
  };

  // Filtering logic
  const applyFilters = (requests) => {
    let filtered = [...requests];

    // First apply card filter (clicking on summary cards)
    if (currentFilterCard === "approved") {
      filtered = filtered.filter((req) => req.status === "Approved");
    } else if (currentFilterCard === "pending") {
      filtered = filtered.filter((req) => req.status === "Pending");
    } else if (currentFilterCard === "rejected") {
      filtered = filtered.filter((req) => req.status === "Rejected");
    }

    // Then apply search filter
    const searchTerm = search.trim().toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(
        (req) =>
          (req.leave_type?.toLowerCase() || "").includes(searchTerm) ||
          (req.status?.toLowerCase() || "").includes(searchTerm) ||
          formatDate(req.start_date).toLowerCase().includes(searchTerm) ||
          formatDate(req.end_date).toLowerCase().includes(searchTerm)
      );
    }

    // Then apply status filter from dropdown (if any)
    if (filterStatus) {
      filtered = filtered.filter(
        (req) => req.status?.toLowerCase() === filterStatus.toLowerCase()
      );
    }

    // Then apply type filter from dropdown (if any)
    if (filterType) {
      filtered = filtered.filter(
        (req) => req.leave_type?.toLowerCase() === filterType.toLowerCase()
      );
    }

    return filtered;
  };

  // Card click handler
  const handleCardClick = (filter) => {
    if (currentFilterCard === filter) {
      // If clicking the same card again, reset to show all
      setCurrentFilterCard("total");
    } else {
      // Otherwise, apply the filter
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  };

  // Event handlers
  const handleEdit = (request) => {
    setSelectedRequest(request);
    setEditModalOpen(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setDeleteModalOpen(true);
  };

  // ===== UPDATED handleEditSubmit FUNCTION =====
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !selectedRequest.id || !employee) return;

    const formData = new FormData(e.target);
    const oldLeaveType = selectedRequest.leave_type;
    const newLeaveType = formData.get("leaveType");
    const oldDays = selectedRequest.num_days;
    const newDays = calculateDays(
      formData.get("startDate"),
      formData.get("endDate")
    );

    // Only proceed if the request is still pending
    if (selectedRequest.status !== "Pending") {
      alert("Only pending leave requests can be edited.");
      setEditModalOpen(false);
      setSelectedRequest(null);
      return;
    }

    // VALIDATION 1: Emergency leave cannot exceed 5 days
    if (newLeaveType === "Emergency" && newDays > 5) {
      alert(
        "❌ Emergency leave cannot exceed 5 days per request. Please adjust your dates."
      );
      return;
    }

    // VALIDATION 2: Check if insufficient credits for Vacation/Sick leave
    let showWarningModal = false;
    let insufficientData = null;

    if (newLeaveType === "Vacation" || newLeaveType === "Sick") {
      // Get current leave balances
      const { data: currentBalance, error: balanceError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("personnel_id", employee.id)
        .eq("year", new Date().getFullYear())
        .single();

      if (!balanceError && currentBalance) {
        const availableBalance =
          newLeaveType === "Vacation"
            ? parseFloat(currentBalance.vacation_balance)
            : parseFloat(currentBalance.sick_balance);

        const newDaysRequested = newDays;

        // Check if editing will result in insufficient credits
        let finalRequestedDays = newDaysRequested;
        if (oldLeaveType === newLeaveType) {
          // Same type, adjust for the difference
          finalRequestedDays = Math.max(0, newDaysRequested - oldDays);
        } else if (oldLeaveType !== newLeaveType && oldLeaveType) {
          // Changing from another type, count full new days
          finalRequestedDays = newDaysRequested;
        }

        // Show warning if less than 1.25 credits will remain
        const remainingAfterRequest = availableBalance - finalRequestedDays;
        if (remainingAfterRequest < 1.25 && remainingAfterRequest >= 0) {
          showWarningModal = true;
          insufficientData = {
            leaveType: newLeaveType,
            requestedDays: finalRequestedDays,
            availableBalance: availableBalance,
            remainingAfter: remainingAfterRequest,
            willBeWithoutPay: false,
          };
        }

        // Check if completely insufficient (negative balance)
        if (availableBalance < finalRequestedDays) {
          showWarningModal = true;
          insufficientData = {
            leaveType: newLeaveType,
            requestedDays: finalRequestedDays,
            availableBalance: availableBalance,
            remainingAfter: remainingAfterRequest,
            willBeWithoutPay: true,
          };
        }
      }
    }

    // If we need to show warning, store data and show modal
    if (showWarningModal && insufficientData) {
      setShowInsufficientModal(true);
      setInsufficientModalData(insufficientData);
      setPendingEditData({
        formData,
        oldLeaveType,
        newLeaveType,
        oldDays,
        newDays,
      });
      return;
    }

    // Proceed with normal update if no warnings
    await processLeaveEditUpdate(
      formData,
      oldLeaveType,
      newLeaveType,
      oldDays,
      newDays,
      false // isWithoutPay
    );
  };
  // ===== END UPDATED handleEditSubmit =====

  // ===== UPDATED handleDeleteConfirm FUNCTION =====
  const handleDeleteConfirm = async () => {
    if (!deleteId || !employee) return;

    try {
      // Get the request details before deleting
      const { data: request, error: fetchError } = await supabase
        .from("leave_requests")
        .select("status, leave_type, num_days")
        .eq("id", deleteId)
        .eq("personnel_id", employee.id)
        .single();

      if (fetchError) throw fetchError;

      if (request.status !== "Pending") {
        alert("Only pending leave requests can be deleted.");
        setDeleteModalOpen(false);
        setDeleteId(null);
        return;
      }

      // If it's a pending request, adjust leave balances
      if (request.status === "Pending") {
        // Get current leave balances
        const { data: currentBalance, error: balanceError } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("personnel_id", employee.id)
          .eq("year", new Date().getFullYear())
          .single();

        if (!balanceError && currentBalance) {
          // Remove the days from used credits
          let balanceUpdates = {};

          switch (request.leave_type) {
            case "Vacation":
              balanceUpdates.vacation_used = Math.max(
                0,
                (currentBalance.vacation_used || 0) - (request.num_days || 0)
              );
              break;
            case "Sick":
              balanceUpdates.sick_used = Math.max(
                0,
                (currentBalance.sick_used || 0) - (request.num_days || 0)
              );
              break;
            case "Emergency":
              balanceUpdates.emergency_used = Math.max(
                0,
                (currentBalance.emergency_used || 0) - (request.num_days || 0)
              );
              break;
          }

          // Update leave balances
          if (Object.keys(balanceUpdates).length > 0) {
            await supabase
              .from("leave_balances")
              .update(balanceUpdates)
              .eq("personnel_id", employee.id)
              .eq("year", new Date().getFullYear());
          }
        }
      }

      // Now delete the request
      const { error } = await supabase
        .from("leave_requests")
        .delete()
        .eq("id", deleteId)
        .eq("personnel_id", employee.id);

      if (error) throw error;

      // Refresh data
      await Promise.all([refreshLeaveRequests(), refreshLeaveBalances()]);

      setDeleteModalOpen(false);
      setDeleteId(null);
      alert("Leave request deleted successfully!");
    } catch (error) {
      console.error("Error deleting leave request:", error);
      alert("Error deleting leave request. Please try again.");
    }
  };
  // ===== END UPDATED handleDeleteConfirm =====

  // Pagination logic
  const filteredRequests = applyFilters(leaveData.userRequests);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginatedRequests = filteredRequests.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Pagination buttons renderer
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredRequests.length / rowsPerPage)
    );
    const hasNoData = filteredRequests.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.EMPLDpaginationBtn} ${
          hasNoData ? styles.EMPLDdisabled : ""
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
        className={`${styles.EMPLDpaginationBtn} ${
          1 === currentPage ? styles.EMPLDactive : ""
        } ${hasNoData ? styles.EMPLDdisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.EMPLDpaginationEllipsis}>
          ...
        </span>
      );
    }

    // Show pages around current page
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(pageCount - 1, currentPage + 1);

    // Adjust if we're near the beginning
    if (currentPage <= 3) {
      endPage = Math.min(pageCount - 1, 4);
    }

    // Adjust if we're near the end
    if (currentPage >= pageCount - 2) {
      startPage = Math.max(2, pageCount - 3);
    }

    // Generate middle page buttons
    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < pageCount) {
        buttons.push(
          <button
            key={i}
            className={`${styles.EMPLDpaginationBtn} ${
              i === currentPage ? styles.EMPLDactive : ""
            } ${hasNoData ? styles.EMPLDdisabled : ""}`}
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
        <span key="ellipsis2" className={styles.EMPLDpaginationEllipsis}>
          ...
        </span>
      );
    }

    // Always show last page if there is more than 1 page
    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.EMPLDpaginationBtn} ${
            pageCount === currentPage ? styles.EMPLDactive : ""
          } ${hasNoData ? styles.EMPLDdisabled : ""}`}
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
        className={`${styles.EMPLDpaginationBtn} ${
          hasNoData ? styles.EMPLDdisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  const leaveCardData = getLeaveCardData();
  const summaryCardsData = getSummaryCardsData();

  if (loading) {
    return (
      <div className="appELD">
        <EmployeeSidebar />
        <Hamburger />
        <main
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="appELD">
      <Title>Employee Leave Dashboard | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <EmployeeSidebar />
      <Hamburger />

      <main className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.EMPLDdashboardHeader}>
          <h1>Employee Leave Dashboard</h1>
          {employee && (
            <p className={styles.welcomeMessage}>
              Welcome, {employee.first_name} {employee.last_name}!
            </p>
          )}
        </div>

        {/* Summary Cards */}
        <div className={styles.EMPLDsummaryCards}>
          <button
            className={`${styles.EMPLDsummaryCard} ${styles.EMPLDtotal} ${
              currentFilterCard === "total" ? styles.EMPLDactive : ""
            }`}
            onClick={() => handleCardClick("total")}
            title="Click to show all requests"
          >
            <h3>Total Requests</h3>
            <p>{summaryCardsData.total}</p>
            <small>All statuses combined</small>
          </button>
          <button
            className={`${styles.EMPLDsummaryCard} ${styles.EMPLDapproved} ${
              currentFilterCard === "approved" ? styles.EMPLDactive : ""
            }`}
            onClick={() => handleCardClick("approved")}
            title={`Click to filter: ${
              currentFilterCard === "approved"
                ? "Show all"
                : "Show approved only"
            }`}
          >
            <h3>Approved</h3>
            <p>{summaryCardsData.approved}</p>
            <small>
              {currentFilterCard === "approved"
                ? "Currently filtered"
                : "Click to filter"}
            </small>
          </button>
          <button
            className={`${styles.EMPLDsummaryCard} ${styles.EMPLDpending} ${
              currentFilterCard === "pending" ? styles.EMPLDactive : ""
            }`}
            onClick={() => handleCardClick("pending")}
            title={`Click to filter: ${
              currentFilterCard === "pending" ? "Show all" : "Show pending only"
            }`}
          >
            <h3>Pending</h3>
            <p>{summaryCardsData.pending}</p>
            <small>
              {currentFilterCard === "pending"
                ? "Currently filtered"
                : "Click to filter"}
            </small>
          </button>
          <button
            className={`${styles.EMPLDsummaryCard} ${styles.EMPLDrejected} ${
              currentFilterCard === "rejected" ? styles.EMPLDactive : ""
            }`}
            onClick={() => handleCardClick("rejected")}
            title={`Click to filter: ${
              currentFilterCard === "rejected"
                ? "Show all"
                : "Show rejected only"
            }`}
          >
            <h3>Rejected</h3>
            <p>{summaryCardsData.rejected}</p>
            <small>
              {currentFilterCard === "rejected"
                ? "Currently filtered"
                : "Click to filter"}
            </small>
          </button>
        </div>

        <div className={styles.EMPLDleaveSection}>
          <LeaveMeter />
        </div>

        {/* Recent Leave Requests */}
        <div className={styles.EMPLDtableSectionHeader}>
          <h2>
            Recent Leave Requests
            {currentFilterCard !== "total" && (
              <span className={styles.activeFilterBadge}>
                Filtered by:{" "}
                {currentFilterCard.charAt(0).toUpperCase() +
                  currentFilterCard.slice(1)}
              </span>
            )}
          </h2>
          <div className={styles.tableInfo}>
            Showing {filteredRequests.length} of {leaveData.userRequests.length}{" "}
            total requests
          </div>
        </div>

        {/* Filters and Search */}
        <div className={styles.EMPLDtopControls}>
          <div className={styles.EMPLDtableHeader}>
            <select
              className={styles.EMPLDfilterType}
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Types</option>
              <option value="Vacation">Vacation</option>
              <option value="Sick">Sick</option>
              <option value="Emergency">Emergency</option>
            </select>

            <select
              className={styles.EMPLDfilterStatus}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Status</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>

            <input
              type="text"
              className={styles.EMPLDsearchBar}
              placeholder="🔍 Search requests..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Top Pagination */}
        <div
          className={`${styles.EMPLDpaginationContainer} ${styles.EMPLDtopPagination}`}
        >
          {renderPaginationButtons()}
        </div>

        {/* Table */}
        <div className={styles.EMPLDtableContainer}>
          <table className={styles.EMPLDtable}>
            <thead>
              <tr>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody className={styles.EMPLDtbody}>
              {paginatedRequests.length > 0 ? (
                paginatedRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.leave_type}</td>
                    <td>{formatDate(request.start_date)}</td>
                    <td>{formatDate(request.end_date)}</td>
                    <td>{request.num_days}</td>
                    <td
                      className={
                        request.status?.toLowerCase() === "approved"
                          ? styles.EMPLDstatusApproved
                          : request.status?.toLowerCase() === "pending"
                          ? styles.EMPLDstatusPending
                          : styles.EMPLDstatusRejected
                      }
                    >
                      {request.status}
                    </td>
                    <td>
                      <div className={styles.EMPLDmanageButtons}>
                        <button
                          className={styles.EMPLDbtnEdit}
                          onClick={() => handleEdit(request)}
                          disabled={request.status !== "Pending"}
                          title={
                            request.status !== "Pending"
                              ? "Only pending requests can be edited"
                              : "Edit"
                          }
                        >
                          Edit
                        </button>
                        <button
                          className={styles.EMPLDbtnDelete}
                          onClick={() => handleDelete(request.id)}
                          disabled={request.status !== "Pending"}
                          title={
                            request.status !== "Pending"
                              ? "Only pending requests can be deleted"
                              : "Delete"
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className={styles.EMPLDNoRequestsTable}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      📋
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
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      {search ||
                      filterStatus ||
                      filterType ||
                      currentFilterCard !== "total"
                        ? "Try adjusting your filters or search terms"
                        : "You haven't submitted any leave requests yet"}
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginTop: "8px",
                      }}
                    >
                      Current filter: {currentFilterCard} | Status:{" "}
                      {filterStatus || "Any"} | Type: {filterType || "Any"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <div className={styles.EMPLDpaginationContainer}>
          {renderPaginationButtons()}
        </div>

        {/* Edit Modal */}
        {editModalOpen && selectedRequest && (
          <div className={`${styles.EMPLDmodal} ${styles.EMPLDmodalOpen}`}>
            <div className={styles.EMPLDmodalContent}>
              <span
                className={styles.EMPLDclose}
                onClick={() => setEditModalOpen(false)}
              >
                &times;
              </span>
              <h2>Edit Leave Request</h2>
              <form onSubmit={handleEditSubmit}>
                <label>Leave Type</label>
                <select
                  name="leaveType"
                  defaultValue={selectedRequest.leave_type}
                  required
                >
                  <option value="Vacation">Vacation</option>
                  <option value="Sick">Sick</option>
                  <option value="Emergency">Emergency</option>
                </select>
                <label>Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={selectedRequest.start_date}
                  required
                />
                <label>End Date</label>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={selectedRequest.end_date}
                  required
                  min={selectedRequest.start_date}
                />
                <div className={styles.EMPLDmodalActions}>
                  <button
                    type="button"
                    className={styles.EMPLDmodalCancel}
                    onClick={() => setEditModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.EMPLDmodalSubmit}>
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== NEW: INSUFFICIENT CREDITS WARNING MODAL ===== */}
        {showInsufficientModal && insufficientModalData && (
          <div className={`${styles.EMPLDmodal} ${styles.EMPLDmodalOpen}`}>
            <div className={styles.EMPLDmodalContent}>
              <span
                className={styles.EMPLDclose}
                onClick={() => {
                  setShowInsufficientModal(false);
                  setInsufficientModalData(null);
                  setPendingEditData(null);
                  setIsWithoutPay(false);
                }}
              >
                &times;
              </span>
              <h2 style={{ color: "#d32f2f" }}>
                ⚠️ Insufficient Leave Credits
              </h2>

              <div
                style={{
                  backgroundColor: "#fff8e1",
                  padding: "15px",
                  borderRadius: "8px",
                  margin: "15px 0",
                  border: "1px solid #ffd54f",
                }}
              >
                <p>
                  <strong>Leave Type:</strong> {insufficientModalData.leaveType}
                </p>
                <p>
                  <strong>Requested Days:</strong>{" "}
                  {insufficientModalData.requestedDays}
                </p>
                <p>
                  <strong>Available Balance:</strong>{" "}
                  {insufficientModalData.availableBalance.toFixed(2)} days
                </p>
                <p>
                  <strong>Remaining After Request:</strong>{" "}
                  {insufficientModalData.remainingAfter.toFixed(2)} days
                </p>

                {insufficientModalData.remainingAfter < 0 ? (
                  <div
                    style={{
                      color: "#d32f2f",
                      marginTop: "10px",
                      padding: "10px",
                      backgroundColor: "#ffebee",
                      borderRadius: "5px",
                    }}
                  >
                    <strong>⚠️ This will be leave without pay!</strong>
                    <p style={{ marginTop: "5px", fontSize: "14px" }}>
                      You don't have enough credits. This leave will be
                      processed as leave without pay.
                    </p>
                  </div>
                ) : insufficientModalData.remainingAfter < 1.25 ? (
                  <div
                    style={{
                      color: "#f57c00",
                      marginTop: "10px",
                      padding: "10px",
                      backgroundColor: "#fff3e0",
                      borderRadius: "5px",
                    }}
                  >
                    <strong>⚠️ Low Balance Warning!</strong>
                    <p style={{ marginTop: "5px", fontSize: "14px" }}>
                      After this request, you'll have less than 1.25 credits
                      remaining. You can proceed, but you won't be able to take
                      another full-day leave until next month's accrual.
                    </p>
                  </div>
                ) : null}
              </div>

              {insufficientModalData.remainingAfter < 0 && (
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "15px",
                    borderRadius: "8px",
                    margin: "15px 0",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={isWithoutPay}
                      onChange={(e) => setIsWithoutPay(e.target.checked)}
                      style={{ marginRight: "10px" }}
                    />
                    <span style={{ fontWeight: "bold" }}>
                      I understand this will be leave without pay
                    </span>
                  </label>
                </div>
              )}

              <div className={styles.EMPLDmodalActions}>
                <button
                  className={styles.EMPLDmodalCancel}
                  onClick={() => {
                    setShowInsufficientModal(false);
                    setInsufficientModalData(null);
                    setPendingEditData(null);
                    setIsWithoutPay(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className={styles.EMPLDmodalSubmit}
                  style={{
                    backgroundColor:
                      insufficientModalData.remainingAfter < 0
                        ? isWithoutPay
                          ? "#d32f2f"
                          : "#ccc"
                        : "#3498db",
                  }}
                  disabled={
                    insufficientModalData.remainingAfter < 0 && !isWithoutPay
                  }
                  onClick={() => {
                    if (pendingEditData) {
                      const isWithoutPayFinal =
                        insufficientModalData.remainingAfter < 0;
                      processLeaveEditUpdate(
                        pendingEditData.formData,
                        pendingEditData.oldLeaveType,
                        pendingEditData.newLeaveType,
                        pendingEditData.oldDays,
                        pendingEditData.newDays,
                        isWithoutPayFinal
                      );
                    }
                  }}
                >
                  {insufficientModalData.remainingAfter < 0
                    ? "Submit as Leave Without Pay"
                    : "Proceed with Low Balance"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ===== END INSUFFICIENT CREDITS MODAL ===== */}

        {/* Delete Modal */}
        {deleteModalOpen && (
          <div className={`${styles.EMPLDmodal} ${styles.EMPLDmodalOpen}`}>
            <div className={styles.EMPLDmodalContent}>
              <span
                className={styles.EMPLDclose}
                onClick={() => setDeleteModalOpen(false)}
              >
                &times;
              </span>
              <h2>Confirm Delete</h2>
              <p>Are you sure you want to delete this leave request?</p>
              <p className={styles.warningText}>
                <strong>Note:</strong> Only pending leave requests can be
                deleted.
              </p>
              <div className={styles.EMPLDmodalActions}>
                <button
                  className={styles.EMPLDmodalCancel}
                  onClick={() => setDeleteModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.EMPLDconfirmDelete}
                  onClick={handleDeleteConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeeLeaveDashboard;
