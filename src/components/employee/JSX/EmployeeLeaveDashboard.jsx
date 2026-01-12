import React, { useState, useEffect, useCallback } from "react";
import EmployeeSidebar from "../../EmployeeSidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import styles from "../styles/EmployeeLeaveDashboard.module.css";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import { useAuth } from "../../AuthContext.jsx";
import LeaveMeter from "../JSX/LeaveMeter.jsx";
import BFPPreloader from "../../BFPPreloader.jsx";
import { useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
const EmployeeLeaveDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [employee, setEmployee] = useState(null);
  const [leaveData, setLeaveData] = useState({
    leaveCounts: { vacation: 0, sick: 0, emergency: 0 },
    userRequests: [],
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
  const rowsPerPage = 5;

  const calculateDays = useCallback((start, end) => {
    if (!start || !end) return 0;
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays + 1;
    } catch (error) {
      return 0;
    }
  }, []);

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

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setLoading(true);

        if (!user || !user.username) {
          console.error("❌ No user found in auth context");
          setLoading(false);
          return;
        }

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

        setEmployee(employeeData);

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
      } catch (error) {
        console.error("💥 Initialization error:", error);
        toast.error(`Error loading dashboard: ${error.message}`);
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

  const getLeaveCardData = () => {
    if (!employee || !leaveData) {
      return {
        vacation: { earned: "0", value: "0 / 0", progress: 0 },
        sick: { earned: "0", value: "0 / 0", progress: 0 },
        emergency: { earned: "0", value: "0 / 0", progress: 0 },
      };
    }

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

  const getSummaryCardsData = () => {
    const allRequests = leaveData.userRequests || [];

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

  const applyFilters = (requests) => {
    let filtered = [...requests];

    if (currentFilterCard === "approved") {
      filtered = filtered.filter((req) => req.status === "Approved");
    } else if (currentFilterCard === "pending") {
      filtered = filtered.filter((req) => req.status === "Pending");
    } else if (currentFilterCard === "rejected") {
      filtered = filtered.filter((req) => req.status === "Rejected");
    }

    const searchTerm = search.trim().toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(
        (req) =>
          (req.leave_type?.toLowerCase() || "").includes(searchTerm) ||
          (req.status?.toLowerCase() || "").includes(searchTerm) ||
          formatDate(req.start_date).toLowerCase().includes(searchTerm) ||
          formatDate(req.end_date).toLowerCase().includes(searchTerm) ||
          (req.location?.toLowerCase() || "").includes(searchTerm) ||
          (req.vacation_location_type?.toLowerCase() || "").includes(
            searchTerm
          ) ||
          (req.illness_type?.toLowerCase() || "").includes(searchTerm) ||
          (req.illness_details?.toLowerCase() || "").includes(searchTerm) ||
          (req.leave_subtype?.toLowerCase() || "").includes(searchTerm)
      );
    }

    if (filterStatus) {
      filtered = filtered.filter(
        (req) => req.status?.toLowerCase() === filterStatus.toLowerCase()
      );
    }

    if (filterType) {
      filtered = filtered.filter(
        (req) => req.leave_type?.toLowerCase() === filterType.toLowerCase()
      );
    }

    return filtered;
  };

  const handleCardClick = (filter) => {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  };

  const handleDelete = (id) => {
    const request = leaveData.userRequests.find((req) => req.id === id);
    if (request && request.status !== "Pending") {
      toast.info(
        `Cannot delete ${request.status.toLowerCase()} requests. Only pending requests can be deleted.`
      );
      return;
    }
    setDeleteId(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId || !employee) return;

    try {
      const { data: request, error: fetchError } = await supabase
        .from("leave_requests")
        .select("status, leave_type, num_days")
        .eq("id", deleteId)
        .eq("personnel_id", employee.id)
        .single();

      if (fetchError) throw fetchError;

      if (request.status !== "Pending") {
        toast.info("Only pending leave requests can be deleted.");
        setDeleteModalOpen(false);
        setDeleteId(null);
        return;
      }

      if (request.status === "Pending") {
        const { data: currentBalance, error: balanceError } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("personnel_id", employee.id)
          .eq("year", new Date().getFullYear())
          .single();

        if (!balanceError && currentBalance) {
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

          if (Object.keys(balanceUpdates).length > 0) {
            await supabase
              .from("leave_balances")
              .update(balanceUpdates)
              .eq("personnel_id", employee.id)
              .eq("year", new Date().getFullYear());
          }
        }
      }

      const { error } = await supabase
        .from("leave_requests")
        .delete()
        .eq("id", deleteId)
        .eq("personnel_id", employee.id);

      if (error) throw error;

      await Promise.all([refreshLeaveRequests(), refreshLeaveBalances()]);

      setDeleteModalOpen(false);
      setDeleteId(null);
      toast.success("Leave request deleted successfully!");
    } catch (error) {
      console.error("Error deleting leave request:", error);
      toast.error("Error deleting leave request. Please try again.");
    }
  };

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
        className={`${styles.EMPLDpaginationBtn} ${
          hasNoData ? styles.EMPLDdisabled : ""
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
        className={`${styles.EMPLDpaginationBtn} ${
          1 === currentPage ? styles.EMPLDactive : ""
        } ${hasNoData ? styles.EMPLDdisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.EMPLDpaginationEllipsis}>
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

    if (currentPage < pageCount - 2) {
      buttons.push(
        <span key="ellipsis2" className={styles.EMPLDpaginationEllipsis}>
          ...
        </span>
      );
    }

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
    return <BFPPreloader loading={loading} />;
  }

  return (
    <div className="appELD">
      <Title>Employee Leave Dashboard | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <EmployeeSidebar />
      <Hamburger />
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
      <main className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.EMPLDdashboardHeader}>
          <h1>Employee Leave Dashboard</h1>
          {employee && (
            <p className={styles.welcomeMessage}>
              Welcome, {employee.first_name} {employee.last_name}!
            </p>
          )}
        </div>

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

        <div
          className={`${styles.EMPLDpaginationContainer} ${styles.EMPLDtopPagination}`}
        >
          {renderPaginationButtons()}
        </div>

        <div className={styles.EMPLDtableContainer}>
          <table className={styles.EMPLDtable}>
            <thead>
              <tr>
                <th>Leave Type</th>
                <th>Details</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th> 
              </tr>
            </thead>
            <tbody className={styles.EMPLDtbody}>
              {paginatedRequests.length > 0 ? (
                paginatedRequests.map((request) => {
                  const getLeaveDetails = () => {
                    const details = [];

                    if (request.location) {
                      details.push(`📍 ${request.location}`);
                    }

                    if (
                      request.leave_type === "Vacation" &&
                      request.vacation_location_type
                    ) {
                      const locationType =
                        request.vacation_location_type === "philippines"
                          ? "🇵🇭 Within Philippines"
                          : "✈️ Abroad";
                      details.push(locationType);
                    }

                    if (request.leave_type === "Sick") {
                      if (request.illness_type) {
                        const illnessType =
                          request.illness_type === "in_hospital"
                            ? "🏥 Hospitalized"
                            : "💊 Out-patient";
                        details.push(illnessType);
                      }
                      if (request.illness_details) {
                        details.push(
                          `ℹ️ ${request.illness_details.substring(0, 30)}${
                            request.illness_details.length > 30 ? "..." : ""
                          }`
                        );
                      }
                    }

                    if (
                      request.leave_type === "Emergency" &&
                      request.illness_details
                    ) {
                      details.push(
                        `🚨 ${request.illness_details.substring(0, 30)}${
                          request.illness_details.length > 30 ? "..." : ""
                        }`
                      );
                    }

                    if (request.leave_subtype) {
                      details.push(`📋 ${request.leave_subtype}`);
                    }

                    return details.length > 0 ? (
                      details.map((detail, index) => (
                        <div key={index} className={styles.detailItem}>
                          {detail}
                        </div>
                      ))
                    ) : (
                      <span className={styles.noDetails}>
                        No additional details
                      </span>
                    );
                  };

                  return (
                    <tr
                      key={request.id}
                      className={
                        request.status !== "Pending"
                          ? styles.EMPLDrowLocked
                          : ""
                      }
                    >
                      <td>
                        <div className={styles.leaveTypeCell}>
                          <span className={styles.leaveTypeText}>
                            {request.leave_type}
                          </span>
                          {request.leave_subtype && (
                            <span className={styles.leaveSubtype}>
                              ({request.leave_subtype})
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.leaveDetailsCell}>
                          {getLeaveDetails()}
                        </div>
                      </td>
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
                        <div className={styles.EMPLDstatusWrapper}>
                          {request.status}
                          {request.status !== "Pending" && (
                            <span className={styles.EMPLDstatusIcon}>
                              {request.status === "Approved" ? "✓" : "✗"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.EMPLDmanageButtons}>
                          {/* REMOVED EDIT BUTTON - Only Delete button remains */}
                          <button
                            className={`${styles.EMPLDbtnDelete} ${
                              request.status !== "Pending"
                                ? styles.EMPLDbtnDisabled
                                : ""
                            }`}
                            onClick={() => handleDelete(request.id)}
                            disabled={request.status !== "Pending"}
                            title={
                              request.status !== "Pending"
                                ? `Cannot delete ${request.status.toLowerCase()} requests`
                                : "Delete this request"
                            }
                          >
                            <span className={styles.EMPLDbtnText}>Delete</span>
                            {request.status !== "Pending" && (
                              <span className={styles.EMPLDlockIcon}>🔒</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className={styles.EMPLDNoRequestsTable}>
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

        <div className={styles.EMPLDpaginationContainer}>
          {renderPaginationButtons()}
        </div>

        {/* REMOVED EDIT MODAL */}

        {/* DELETE MODAL - Keep this */}
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
                deleted. Approved or rejected requests cannot be deleted.
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
