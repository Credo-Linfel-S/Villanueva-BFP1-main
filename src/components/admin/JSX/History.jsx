import React, { useState, useEffect } from "react";
import styles from "../styles/History.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BFPPreloader from "../../BFPPreloader.jsx";
import { reactivatePersonnel } from "./Utility/personnelStatusUtils.js"; // Import the utility function

const History = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [historyRecords, setHistoryRecords] = useState([]);
  const [clearanceHistory, setClearanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("personnel"); // 'personnel' or 'clearance'
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [showPreloader, setShowPreloader] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const updateLoadingProgress = (progress) => {
    setLoadingProgress(progress);
  };

  const handleRetryFromPreloader = () => {
    setShowPreloader(true);
    setLoadingProgress(0);
    loadHistoryData();
  };

  // Update the loadHistoryData function in History.jsx
  const loadHistoryData = async () => {
    try {
      setLoading(true);
      updateLoadingProgress(10);

      // Load ONLY retired and resigned personnel
      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("*")
        .or("status.eq.Retired,status.eq.Resigned") // ONLY Retirement and Resignation
        .order("updated_at", { ascending: false });

      if (personnelError) {
        console.error("Error loading personnel history:", personnelError);
        toast.error("Failed to load personnel history");
      }

      updateLoadingProgress(30);

      // Load completed clearance requests - ONLY Retirement and Resignation
      const { data: clearanceData, error: clearanceError } = await supabase
        .from("clearance_requests")
        .select(
          `
        *,
        personnel:personnel_id(first_name, middle_name, last_name, badge_number, rank, station)
      `
        )
        .eq("status", "Completed")
        .in("type", ["Resignation", "Retirement"]) // ONLY these two types
        .order("completed_at", { ascending: false });

      if (clearanceError) {
        console.error("Error loading clearance history:", clearanceError);
        toast.error("Failed to load clearance history");
      }

      updateLoadingProgress(60);

      // Transform personnel data - ONLY Retirement and Resignation
      const transformedPersonnelData = (personnelData || []).map((person) => {
        const fullName = `${person.first_name || ""} ${
          person.middle_name || ""
        } ${person.last_name || ""}`
          .replace(/\s+/g, " ")
          .trim();

        // Get separation date
        const separationDate =
          person.separation_date || person.retirement_date || person.updated_at;

        return {
          id: person.id,
          type: "personnel",
          personnel_id: person.id,
          first_name: person.first_name,
          middle_name: person.middle_name,
          last_name: person.last_name,
          full_name: fullName,
          badge_number: person.badge_number,
          rank: person.rank,
          designation: person.designation,
          station: person.station,
          date_hired: person.date_hired,
          separation_date: separationDate,
          photo_url: person.photo_url,
          status: person.status,
          separation_type: person.separation_type,
          separation_reason: person.separation_reason,
          years_of_service: calculateYearsOfService(
            person.date_hired,
            separationDate
          ),
          last_updated: person.updated_at,
          is_active: person.is_active,
        };
      });

      // Transform clearance data - ONLY Retirement and Resignation
      const transformedClearanceData = (clearanceData || []).map(
        (clearance) => {
          const personnel = clearance.personnel || {};
          const fullName = `${personnel.first_name || ""} ${
            personnel.middle_name || ""
          } ${personnel.last_name || ""}`
            .replace(/\s+/g, " ")
            .trim();

          return {
            id: clearance.id,
            type: "clearance",
            personnel_id: clearance.personnel_id,
            clearance_type: clearance.type,
            status: clearance.status,
            full_name: fullName,
            badge_number: personnel.badge_number,
            rank: personnel.rank,
            station: personnel.station,
            reason: clearance.reason,
            remarks: clearance.remarks,
            effective_date: clearance.effective_date,
            actual_completion_date: clearance.actual_completion_date,
            approved_by: clearance.approved_by,
            approved_at: clearance.approved_at,
            completed_at: clearance.completed_at,
            created_at: clearance.created_at,
          };
        }
      );

      updateLoadingProgress(80);

      setHistoryRecords(transformedPersonnelData);
      setClearanceHistory(transformedClearanceData);
      setLoading(false);
      updateLoadingProgress(100);

      setTimeout(() => {
        setShowPreloader(false);
      }, 500);
    } catch (error) {
      console.error("Error loading history:", error);
      toast.error("Failed to load history data");
      setLoading(false);
      setShowPreloader(false);
    }
  };

  const calculateYearsOfService = (dateHired, separationDate) => {
    if (!dateHired) return 0;
    try {
      const hiredDate = new Date(dateHired);
      const endDate = separationDate ? new Date(separationDate) : new Date();
      if (isNaN(hiredDate.getTime()) || isNaN(endDate.getTime())) return 0;
      const diffMs = endDate - hiredDate;
      const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
      return Math.floor(years * 10) / 10;
    } catch {
      return 0;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  useEffect(() => {
    loadHistoryData();

    // Set up real-time subscription for clearance updates
    const clearanceSubscription = supabase
      .channel("clearance-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "clearance_requests",
        },
        (payload) => {
          if (payload.new.status === "Completed") {
            loadHistoryData(); // Reload when clearance is completed
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for personnel updates
    const personnelSubscription = supabase
      .channel("personnel-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "personnel",
        },
        () => {
          loadHistoryData(); // Reload when personnel status changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(clearanceSubscription);
      supabase.removeChannel(personnelSubscription);
    };
  }, []);

  // Filter logic
  const getFilteredRecords = () => {
    const records =
      activeTab === "personnel" ? historyRecords : clearanceHistory;

    return records.filter((record) => {
      // Type filter
      if (filterType !== "all" && activeTab === "personnel") {
        const recordType = record.separation_type?.toLowerCase() || "";
        const filterTypeLower = filterType.toLowerCase();

        if (filterTypeLower === "retirement" && !recordType.includes("retire"))
          return false;
        if (filterTypeLower === "resignation" && !recordType.includes("resign"))
          return false;
        if (
          filterTypeLower === "equipment completion" &&
          !recordType.includes("equipment")
        )
          return false;
      }

      if (filterType !== "all" && activeTab === "clearance") {
        const recordType = record.clearance_type?.toLowerCase() || "";
        const filterTypeLower = filterType.toLowerCase();

        if (filterTypeLower === "retirement" && !recordType.includes("retire"))
          return false;
        if (filterTypeLower === "resignation" && !recordType.includes("resign"))
          return false;
        if (
          filterTypeLower === "equipment completion" &&
          !recordType.includes("equipment")
        )
          return false;
      }

      // Search filter
      if (search.trim()) {
        const searchTerm = search.toLowerCase();
        const fullName = record.full_name?.toLowerCase() || "";
        const badge = record.badge_number?.toLowerCase() || "";
        const rank = record.rank?.toLowerCase() || "";
        const station = record.station?.toLowerCase() || "";
        const reason = record.reason?.toLowerCase() || "";

        return (
          fullName.includes(searchTerm) ||
          badge.includes(searchTerm) ||
          rank.includes(searchTerm) ||
          station.includes(searchTerm) ||
          reason.includes(searchTerm)
        );
      }

      return true;
    });
  };

  const filteredRecords = getFilteredRecords();
  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRecords = filteredRecords.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // FIXED: Use the utility function for consistency
  const handleReactivate = async (personnelId, personName) => {
    if (
      !window.confirm(
        `Are you sure you want to reactivate ${personName}? This will change their status to Active.`
      )
    ) {
      return;
    }

    try {
      const result = await reactivatePersonnel(personnelId);

      if (result.success) {
        toast.success(`${personName} has been reactivated and is now Active`);
        // Wait a moment then reload to see the change
        setTimeout(() => {
          loadHistoryData();
        }, 500);
      } else {
        toast.error(result.message || "Failed to reactivate personnel");
      }
    } catch (error) {
      console.error("Error reactivating personnel:", error);
      toast.error("Failed to reactivate personnel");
    }
  };

  const handleViewClearanceDetails = (clearanceId) => {
    // Navigate to clearance details or show modal
    toast.info(`Viewing clearance details for ID: ${clearanceId}`);
    // Implement navigation to clearance details page
  };

  if (showPreloader) {
    return (
      <BFPPreloader
        loading={loading}
        progress={loadingProgress}
        moduleTitle="HISTORY SYSTEM • Retrieving Archives..."
        onRetry={handleRetryFromPreloader}
      />
    );
  }

  return (
    <div className={styles.container}>
      <Title>History | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <ToastContainer position="top-right" autoClose={3000} />
      <Sidebar />

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.header}>
          <h1>Separation & Clearance History</h1>
          <p className={styles.subtitle}>
            View retired, resigned personnel and completed clearance requests
          </p>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${
              activeTab === "personnel" ? styles.activeTab : ""
            }`}
            onClick={() => {
              setActiveTab("personnel");
              setCurrentPage(1);
            }}
          >
            👥 Personnel History ({historyRecords.length})
          </button>
          <button
            className={`${styles.tab} ${
              activeTab === "clearance" ? styles.activeTab : ""
            }`}
            onClick={() => {
              setActiveTab("clearance");
              setCurrentPage(1);
            }}
          >
            📋 Clearance History ({clearanceHistory.length})
          </button>
        </div>

        {/* Debug Info - Add this for troubleshooting */}
        <div className={styles.debugInfo} style={{ display: "none" }}>
          <p>Total Records: {historyRecords.length}</p>
          <p>
            Sample record:{" "}
            {historyRecords[0] && JSON.stringify(historyRecords[0])}
          </p>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={`Search ${
                activeTab === "personnel" ? "personnel" : "clearance"
              } records...`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className={styles.filterContainer}>
            <select
              className={styles.filterSelect}
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Types</option>
              <option value="retirement">Retirement</option>
              <option value="resignation">Resignation</option>
              {/* REMOVE Equipment Completion from History filters */}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📜</div>
            <div className={styles.statContent}>
              <h3>Total Records</h3>
              <p className={styles.statNumber}>
                {activeTab === "personnel"
                  ? historyRecords.length
                  : clearanceHistory.length}
              </p>
            </div>
          </div>

          {activeTab === "personnel" ? (
            <>
              <div className={`${styles.statCard} ${styles.retiredCard}`}>
                <div className={styles.statIcon}>👴</div>
                <div className={styles.statContent}>
                  <h3>Retired</h3>
                  <p className={styles.statNumber}>
                    {
                      historyRecords.filter((r) => r.status === "Retired")
                        .length
                    }
                  </p>
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.resignedCard}`}>
                <div className={styles.statIcon}>👋</div>
                <div className={styles.statContent}>
                  <h3>Resigned</h3>
                  <p className={styles.statNumber}>
                    {
                      historyRecords.filter((r) => r.status === "Resigned")
                        .length
                    }
                  </p>
                </div>
              </div>

              {/* REMOVE Equipment Completion stat card */}
            </>
          ) : (
            <>
              <div className={`${styles.statCard} ${styles.retiredCard}`}>
                <div className={styles.statIcon}>👴</div>
                <div className={styles.statContent}>
                  <h3>Retirement Clearances</h3>
                  <p className={styles.statNumber}>
                    {
                      clearanceHistory.filter(
                        (r) => r.clearance_type === "Retirement"
                      ).length
                    }
                  </p>
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.resignedCard}`}>
                <div className={styles.statIcon}>👋</div>
                <div className={styles.statContent}>
                  <h3>Resignation Clearances</h3>
                  <p className={styles.statNumber}>
                    {
                      clearanceHistory.filter(
                        (r) => r.clearance_type === "Resignation"
                      ).length
                    }
                  </p>
                </div>
              </div>

              {/* REMOVE Equipment Completion stat card */}
            </>
          )}
        </div>

        {/* Table */}
        <div className={styles.tableContainer}>
          {filteredRecords.length === 0 ? (
            <div className={styles.noRecords}>
              <div className={styles.noRecordsIcon}>
                {activeTab === "personnel" ? "📭" : "📋"}
              </div>
              <h3>No Records Found</h3>
              <p>
                {search || filterType !== "all"
                  ? "No records match your search criteria."
                  : activeTab === "personnel"
                  ? "No retired or resigned personnel found. Approve a clearance request first."
                  : "No completed clearance requests found."}
              </p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {activeTab === "personnel" ? (
                      <>
                        <th>Photo</th>
                        <th>Name</th>
                        <th>Badge</th>
                        <th>Rank</th>
                        <th>Station</th>
                        <th>Years of Service</th>
                        <th>Date Hired</th>
                        <th>Separation Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </>
                    ) : (
                      <>
                        <th>Personnel</th>
                        <th>Clearance Type</th>
                        <th>Reason</th>
                        <th>Effective Date</th>
                        <th>Completed Date</th>
                        <th>Approved By</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => (
                    <tr
                      key={`${record.id}-${record.type}`}
                      className={styles.tableRow}
                    >
                      {activeTab === "personnel" ? (
                        <>
                          <td>
                            {record.photo_url ? (
                              <img
                                src={record.photo_url}
                                alt={record.full_name}
                                className={styles.photo}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src =
                                    "https://via.placeholder.com/50";
                                }}
                              />
                            ) : (
                              <div className={styles.photoPlaceholder}>
                                {record.first_name?.[0]}
                                {record.last_name?.[0]}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className={styles.nameCell}>
                              <strong>{record.full_name}</strong>
                              {record.designation && (
                                <span className={styles.designation}>
                                  {record.designation}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{record.badge_number || "N/A"}</td>
                          <td>{record.rank || "N/A"}</td>
                          <td>{record.station || "N/A"}</td>
                          <td>
                            <span className={styles.yearsBadge}>
                              {record.years_of_service.toFixed(1)} years
                            </span>
                          </td>
                          <td>{formatDate(record.date_hired)}</td>
                          <td>{formatDate(record.separation_date)}</td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${
                                record.status &&
                                record.status.toLowerCase().includes("retired")
                                  ? styles.retired
                                  : record.status &&
                                    record.status
                                      .toLowerCase()
                                      .includes("resigned")
                                  ? styles.resigned
                                  : record.status === "Equipment Completed"
                                  ? styles.equipment
                                  : styles.other
                              }`}
                            >
                              {record.status || "Inactive"}
                            </span>
                          </td>
                          <td>
                            <button
                              className={styles.reactivateBtn}
                              onClick={() =>
                                handleReactivate(record.id, record.full_name)
                              }
                              title="Reactivate this personnel"
                            >
                              Reactivate
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <div className={styles.nameCell}>
                              <strong>{record.full_name}</strong>
                              <div className={styles.clearanceMeta}>
                                <span>
                                  Badge: {record.badge_number || "N/A"}
                                </span>
                                <span>Rank: {record.rank || "N/A"}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`${styles.clearanceType} ${
                                record.clearance_type === "Retirement"
                                  ? styles.retired
                                  : record.clearance_type === "Resignation"
                                  ? styles.resigned
                                  : styles.equipment
                              }`}
                            >
                              {record.clearance_type}
                            </span>
                          </td>
                          <td>
                            <div className={styles.reasonCell}>
                              {record.reason || "No reason provided"}
                            </div>
                          </td>
                          <td>{formatDate(record.effective_date)}</td>
                          <td>{formatDateTime(record.completed_at)}</td>
                          <td>{record.approved_by || "N/A"}</td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${styles.completed}`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className={styles.viewBtn}
                              onClick={() =>
                                handleViewClearanceDetails(record.id)
                              }
                              title="View clearance details"
                            >
                              View Details
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {filteredRecords.length > rowsPerPage && (
                <div className={styles.pagination}>
                  <button
                    className={`${styles.paginationBtn} ${
                      currentPage === 1 ? styles.disabled : ""
                    }`}
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className={styles.pageInfo}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className={`${styles.paginationBtn} ${
                      currentPage === totalPages ? styles.disabled : ""
                    }`}
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Instructions */}
        <div className={styles.instructions}>
          <h3>How This System Works:</h3>
          <ol>
            <li>
              <strong>Clearance Request:</strong> Initiate clearance in
              Clearance System
            </li>
            <li>
              <strong>Approval:</strong> When clearance is approved (status
              becomes "Completed")
            </li>
            <li>
              <strong>Auto-Update:</strong> Personnel status automatically
              changes (Retired/Resigned)
            </li>
            <li>
              <strong>Appearance:</strong> Personnel appears here automatically
            </li>
            <li>
              <strong>Reactivate:</strong> Use "Reactivate" button to make
              personnel Active again
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default History;
