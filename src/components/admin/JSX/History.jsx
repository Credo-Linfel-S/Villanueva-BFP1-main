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
import { reactivatePersonnel } from "./Utility/personnelStatusUtils.js";
import FloatingNotificationBell from "../../FloatingNotificationBell.jsx";
import { useUserId } from "../../hooks/useUserId.js";

const History = () => {
  const { isSidebarCollapsed } = useSidebar();
  const [historyRecords, setHistoryRecords] = useState([]);
  const [clearanceHistory, setClearanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("personnel");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15; // Increased for landscape
  const { userId, isAuthenticated, userRole } = useUserId();
  const [showPreloader, setShowPreloader] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // DELETE MODAL STATES
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteName, setDeleteName] = useState("");
  const [personnelToDelete, setPersonnelToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // REACTIVATE MODAL STATES
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [reactivateId, setReactivateId] = useState(null);
  const [reactivateName, setReactivateName] = useState("");
  const [personnelToReactivate, setPersonnelToReactivate] = useState(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isTransferredPersonnel, setIsTransferredPersonnel] = useState(false);

  // Compact view state
  const [compactView, setCompactView] = useState(false);

  // Rank options for rank images
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

  // Helper function to get rank image
  const getRankImage = (rank) => {
    const rankOption = rankOptions.find((option) => option.rank === rank);
    return rankOption ? rankOption.image : null;
  };

  // Helper function to get rank name
  const getRankName = (rank) => {
    const rankOption = rankOptions.find((option) => option.rank === rank);
    return rankOption ? rankOption.name : rank || "N/A";
  };

  const updateLoadingProgress = (progress) => {
    setLoadingProgress(progress);
  };

  const handleRetryFromPreloader = () => {
    setShowPreloader(true);
    setLoadingProgress(0);
    loadHistoryData();
  };

  const loadHistoryData = async () => {
    try {
      setLoading(true);
      updateLoadingProgress(10);

      // Load retired, resigned, and transferred personnel
      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("*")
        .or("status.eq.Retired,status.eq.Resigned,status.eq.Transferred")
        .order("updated_at", { ascending: false });

      if (personnelError) {
        console.error("Error loading personnel history:", personnelError);
        toast.error("Failed to load personnel history");
      }

      updateLoadingProgress(30);

      // Load completed clearance requests
      const { data: clearanceData, error: clearanceError } = await supabase
        .from("clearance_requests")
        .select(
          `
        *,
        personnel:personnel_id(first_name, middle_name, last_name, badge_number, rank, station)
      `
        )
        .eq("status", "Completed")
        .in("type", ["Resignation", "Retirement", "Transfer"])
        .order("completed_at", { ascending: false });

      if (clearanceError) {
        console.error("Error loading clearance history:", clearanceError);
        toast.error("Failed to load clearance history");
      }

      updateLoadingProgress(60);

      // Transform personnel data
      const transformedPersonnelData = (personnelData || []).map((person) => {
        const fullName = `${person.first_name || ""} ${
          person.middle_name || ""
        } ${person.last_name || ""}`
          .replace(/\s+/g, " ")
          .trim();

        let separationDate;
        if (person.status === "Retired") {
          separationDate = person.retirement_date || person.updated_at;
        } else if (person.status === "Resigned") {
          separationDate = person.separation_date || person.updated_at;
        } else if (person.status === "Transferred") {
          separationDate = person.transfer_date || person.updated_at;
        } else {
          separationDate = person.updated_at;
        }

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
          new_station: person.new_station,
          date_hired: person.date_hired,
          separation_date: separationDate,
          photo_url: person.photo_url,
          status: person.status,
          separation_type: person.separation_type,
          separation_reason: person.separation_reason,
          transfer_reason: person.transfer_reason,
          years_of_service: calculateYearsOfService(
            person.date_hired,
            separationDate
          ),
          last_updated: person.updated_at,
          is_active: person.is_active,
        };
      });

      // Transform clearance data
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
            new_station: clearance.new_station,
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
            loadHistoryData();
          }
        }
      )
      .subscribe();

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
          loadHistoryData();
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
        if (filterTypeLower === "transfer" && !recordType.includes("transfer"))
          return false;
      }

      if (filterType !== "all" && activeTab === "clearance") {
        const recordType = record.clearance_type?.toLowerCase() || "";
        const filterTypeLower = filterType.toLowerCase();

        if (filterTypeLower === "retirement" && !recordType.includes("retire"))
          return false;
        if (filterTypeLower === "resignation" && !recordType.includes("resign"))
          return false;
        if (filterTypeLower === "transfer" && !recordType.includes("transfer"))
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

  // ========== REACTIVATE FUNCTIONALITY ==========
  const handleReactivateClick = (record) => {
    if (!record || !record.id) {
      toast.error("Invalid record — cannot reactivate.");
      return;
    }

    const personnelRecord = historyRecords.find((r) => r.id === record.id);
    const isTransferred = personnelRecord?.status === "Transferred";

    setReactivateId(record.id);
    setReactivateName(record.full_name);
    setPersonnelToReactivate(record);
    setIsTransferredPersonnel(isTransferred);
    setShowReactivateConfirm(true);
  };

  const confirmReactivateRecord = async () => {
    try {
      setIsReactivating(true);
      if (!reactivateId) {
        toast.error("No record selected for reactivation.");
        setIsReactivating(false);
        return;
      }

      const result = await reactivatePersonnel(reactivateId);

      if (result.success) {
        toast.success(
          `${reactivateName} has been reactivated and is now Active`
        );
        setTimeout(() => {
          loadHistoryData();
        }, 500);
      } else {
        toast.error(result.message || "Failed to reactivate personnel");
      }
    } catch (error) {
      console.error("Error reactivating personnel:", error);
      toast.error("Failed to reactivate personnel");
    } finally {
      setIsReactivating(false);
      setShowReactivateConfirm(false);
      setReactivateId(null);
      setReactivateName("");
      setPersonnelToReactivate(null);
      setIsTransferredPersonnel(false);
    }
  };

  const cancelReactivate = () => {
    setShowReactivateConfirm(false);
    setReactivateId(null);
    setReactivateName("");
    setPersonnelToReactivate(null);
    setIsTransferredPersonnel(false);
    setIsReactivating(false);
  };

  // ========== DELETE FUNCTIONALITY ==========
  const handleDeleteClick = (record) => {
    if (!record || !record.id) {
      toast.error("Invalid record — cannot delete.");
      return;
    }

    setDeleteId(record.id);
    setDeleteName(record.full_name);
    setPersonnelToDelete(record);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteRecord = async () => {
    try {
      setIsDeleting(true);
      if (!deleteId) {
        toast.error("No record selected for deletion.");
        setIsDeleting(false);
        return;
      }

      const recordToDelete = filteredRecords.find((r) => r.id === deleteId);
      if (!recordToDelete) {
        toast.error("Record not found.");
        setIsDeleting(false);
        return;
      }

      if (activeTab === "personnel") {
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
      } else {
        const { error } = await supabase
          .from("clearance_requests")
          .delete()
          .eq("id", deleteId);

        if (error) {
          console.error("Supabase delete error:", error);
          if (error.code === "42501") {
            toast.error(
              "Permission denied. Please check Row Level Security policies."
            );
          } else {
            toast.error("Failed to delete clearance record.");
          }
          throw error;
        }
      }

      toast.warn(
        `${
          activeTab === "personnel" ? "Personnel" : "Clearance"
        } deleted successfully!`
      );

      await loadHistoryData();

      setShowDeleteConfirm(false);
      setDeleteId(null);
      setDeleteName("");
      setPersonnelToDelete(null);
    } catch (error) {
      console.error("Error deleting record:", error);
      if (!error.message?.includes("Permission denied")) {
        toast.error(
          `Failed to delete ${
            activeTab === "personnel" ? "personnel" : "clearance record"
          }.`
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteId(null);
    setDeleteName("");
    setPersonnelToDelete(null);
    setIsDeleting(false);
  };

  // REACTIVATE MODAL COMPONENT (Updated for Landscape)
  const ReactivateModal = () => {
    if (!showReactivateConfirm || !personnelToReactivate) return null;

    const reactivateMessage = isTransferredPersonnel
      ? `Reactivate ${reactivateName}? This will change their status to Active and keep them at their current station.`
      : `Reactivate ${reactivateName}? This will change their status to Active.`;

    return (
      <div
        className={`${styles.modalOverlay} ${
          isSidebarCollapsed ? styles.sidebarCollapsed : ""
        }`}
        style={{
          left: isSidebarCollapsed ? "80px" : "285px",
          width: isSidebarCollapsed
            ? "calc(100vw - 80px)"
            : "calc(100vw - 150px)",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) cancelReactivate();
        }}
      >
        <div className={styles.modalCompact}>
          <div className={styles.modalHeaderCompact}>
            <div className={styles.modalTitleIcon}>↻</div>
            <h3 className={styles.modalTitleCompact}>Confirm Reactivation</h3>
            <button
              className={styles.modalCloseCompact}
              onClick={cancelReactivate}
              disabled={isReactivating}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBodyCompact}>
            {/* Personnel Info in Compact Layout */}
            <div className={styles.personnelInfoCompact}>
              {/* Photo and Rank */}
              <div className={styles.personnelImageSection}>
                {personnelToReactivate.photo_url ? (
                  <img
                    src={personnelToReactivate.photo_url}
                    alt={personnelToReactivate.full_name}
                    className={styles.personnelPhotoCompact}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://via.placeholder.com/60";
                    }}
                  />
                ) : (
                  <div className={styles.personnelPhotoPlaceholderCompact}>
                    {personnelToReactivate.first_name?.[0]}
                    {personnelToReactivate.last_name?.[0]}
                  </div>
                )}

                {personnelToReactivate.rank && (
                  <div className={styles.personnelRankBadgeCompact}>
                    {getRankImage(personnelToReactivate.rank) ? (
                      <img
                        src={getRankImage(personnelToReactivate.rank)}
                        alt={personnelToReactivate.rank}
                        className={styles.rankIconCompact}
                      />
                    ) : (
                      <span>{personnelToReactivate.rank}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Name and Details */}
              <div className={styles.personnelDetailsCompact}>
                <h4 className={styles.personnelNameCompact}>
                  {reactivateName}
                </h4>

                <div className={styles.personnelMetaCompact}>
                  {personnelToReactivate.badge_number && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Badge:</span>
                      <span className={styles.metaValue}>
                        {personnelToReactivate.badge_number}
                      </span>
                    </div>
                  )}

                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Status:</span>
                    <span
                      className={`${styles.statusBadgeCompact} ${
                        personnelToReactivate.status === "Retired"
                          ? styles.retired
                          : personnelToReactivate.status === "Resigned"
                          ? styles.resigned
                          : personnelToReactivate.status === "Transferred"
                          ? styles.transferred
                          : ""
                      }`}
                    >
                      {personnelToReactivate.status || "Unknown"}
                    </span>
                  </div>

                  {isTransferredPersonnel &&
                    personnelToReactivate.new_station && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Transfer:</span>
                        <span className={styles.metaValue}>
                          {personnelToReactivate.station} →{" "}
                          {personnelToReactivate.new_station}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Confirmation Message */}
            <div className={styles.confirmationMessageCompact}>
              <div className={styles.warningIconCompact}>⚠️</div>
              <p className={styles.messageTextCompact}>{reactivateMessage}</p>
              <p className={styles.warningTextCompact}>
                This action will restore the personnel to active status.
              </p>
            </div>

            {/* Quick Info Grid */}
            <div className={styles.quickInfoGrid}>
              {personnelToReactivate.date_hired && (
                <div className={styles.quickInfoItem}>
                  <span className={styles.quickInfoLabel}>Hired:</span>
                  <span className={styles.quickInfoValue}>
                    {formatDate(personnelToReactivate.date_hired)}
                  </span>
                </div>
              )}

              {personnelToReactivate.separation_date && (
                <div className={styles.quickInfoItem}>
                  <span className={styles.quickInfoLabel}>
                    {personnelToReactivate.status === "Transferred"
                      ? "Transferred:"
                      : "Separated:"}
                  </span>
                  <span className={styles.quickInfoValue}>
                    {formatDate(personnelToReactivate.separation_date)}
                  </span>
                </div>
              )}

              {personnelToReactivate.years_of_service && (
                <div className={styles.quickInfoItem}>
                  <span className={styles.quickInfoLabel}>Service:</span>
                  <span className={styles.quickInfoValue}>
                    {personnelToReactivate.years_of_service.toFixed(1)} years
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.modalFooterCompact}>
            <button
              className={styles.cancelBtnCompact}
              onClick={cancelReactivate}
              disabled={isReactivating}
            >
              Cancel
            </button>
            <button
              className={`${styles.confirmBtnCompact} ${
                styles.reactivateBtnCompact
              } ${isReactivating ? styles.loading : ""}`}
              onClick={confirmReactivateRecord}
              disabled={isReactivating}
            >
              {isReactivating ? (
                <>
                  <span className={styles.spinnerCompact}></span>
                  Reactivating...
                </>
              ) : (
                <>
                  <span className={styles.btnIcon}>↻</span>
                  Confirm Reactivation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // DELETE MODAL COMPONENT (Updated for Landscape)
  const DeleteModal = () => {
    if (!showDeleteConfirm || !personnelToDelete) return null;

    return (
      <div
        className={`${styles.modalOverlay} ${
          isSidebarCollapsed ? styles.sidebarCollapsed : ""
        }`}
        style={{
          left: isSidebarCollapsed ? "80px" : "285px",
          width: isSidebarCollapsed
            ? "calc(100vw - 80px)"
            : "calc(100vw - 150px)",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) cancelDelete();
        }}
      >
        <div className={styles.modalCompact}>
          <div
            className={`${styles.modalHeaderCompact} ${styles.deleteHeader}`}
          >
            <div className={styles.modalTitleIcon}>🗑️</div>
            <h3 className={styles.modalTitleCompact}>Confirm Deletion</h3>
            <button
              className={styles.modalCloseCompact}
              onClick={cancelDelete}
              disabled={isDeleting}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBodyCompact}>
            {/* Personnel Info in Compact Layout */}
            <div className={styles.personnelInfoCompact}>
              {/* Photo and Rank */}
              <div className={styles.personnelImageSection}>
                {personnelToDelete.photo_url ? (
                  <img
                    src={personnelToDelete.photo_url}
                    alt={personnelToDelete.full_name}
                    className={styles.personnelPhotoCompact}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://via.placeholder.com/60";
                    }}
                  />
                ) : (
                  <div className={styles.personnelPhotoPlaceholderCompact}>
                    {personnelToDelete.first_name?.[0]}
                    {personnelToDelete.last_name?.[0]}
                  </div>
                )}

                {personnelToDelete.rank && (
                  <div className={styles.personnelRankBadgeCompact}>
                    {getRankImage(personnelToDelete.rank) ? (
                      <img
                        src={getRankImage(personnelToDelete.rank)}
                        alt={personnelToDelete.rank}
                        className={styles.rankIconCompact}
                      />
                    ) : (
                      <span>{personnelToDelete.rank}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Name and Details */}
              <div className={styles.personnelDetailsCompact}>
                <h4 className={styles.personnelNameCompact}>{deleteName}</h4>

                <div className={styles.personnelMetaCompact}>
                  {activeTab === "personnel" ? (
                    <>
                      {personnelToDelete.badge_number && (
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Badge:</span>
                          <span className={styles.metaValue}>
                            {personnelToDelete.badge_number}
                          </span>
                        </div>
                      )}

                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Type:</span>
                        <span
                          className={`${styles.recordTypeBadge} ${
                            personnelToDelete.status === "Retired"
                              ? styles.retired
                              : personnelToDelete.status === "Resigned"
                              ? styles.resigned
                              : personnelToDelete.status === "Transferred"
                              ? styles.transferred
                              : ""
                          }`}
                        >
                          {personnelToDelete.status || "Unknown"}
                        </span>
                      </div>

                      {personnelToDelete.station && (
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Station:</span>
                          <span className={styles.metaValue}>
                            {personnelToDelete.station}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Type:</span>
                        <span
                          className={`${styles.recordTypeBadge} ${
                            personnelToDelete.clearance_type === "Retirement"
                              ? styles.retired
                              : personnelToDelete.clearance_type ===
                                "Resignation"
                              ? styles.resigned
                              : personnelToDelete.clearance_type === "Transfer"
                              ? styles.transferred
                              : ""
                          }`}
                        >
                          {personnelToDelete.clearance_type || "Unknown"}
                        </span>
                      </div>

                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Completed:</span>
                        <span className={styles.metaValue}>
                          {formatDateTime(personnelToDelete.completed_at)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Danger Warning */}
            <div className={styles.dangerWarningCompact}>
              <div className={styles.dangerIconCompact}>⚠️</div>
              <div className={styles.warningContent}>
                <p className={styles.dangerTitleCompact}>
                  {activeTab === "personnel"
                    ? "Delete Personnel Record?"
                    : "Delete Clearance Record?"}
                </p>
                <p className={styles.dangerTextCompact}>
                  This action <strong>cannot be undone</strong>. All associated
                  data will be permanently removed from the system.
                </p>
              </div>
            </div>

            {/* Additional Warning for Personnel */}
            {activeTab === "personnel" && (
              <div className={styles.additionalWarning}>
      
                <div className={styles.warningItem}>
                  <span className={styles.warningIcon}>🔄</span>
                  <span>Cannot be recovered or reactivated</span>
                </div>
              </div>
            )}

            {/* Additional Warning for Clearance */}
            {activeTab === "clearance" && (
              <div className={styles.additionalWarning}>
                <div className={styles.warningItem}>
                  <span className={styles.warningIcon}>📄</span>
                  <span>Clearance documentation will be deleted</span>
                </div>
                <div className={styles.warningItem}>
                  <span className={styles.warningIcon}>📋</span>
                  <span>Approval records will be removed</span>
                </div>
                <div className={styles.warningItem}>
                  <span className={styles.warningIcon}>🔄</span>
                  <span>Cannot be restored once deleted</span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.modalFooterCompact}>
            <button
              className={styles.cancelBtnCompact}
              onClick={cancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className={`${styles.confirmBtnCompact} ${
                styles.deleteBtnCompact
              } ${isDeleting ? styles.loading : ""}`}
              onClick={confirmDeleteRecord}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <span className={styles.spinnerCompact}></span>
                  Deleting...
                </>
              ) : (
                <>
                  <span className={styles.btnIcon}>🗑️</span>
                  {activeTab === "personnel"
                    ? "Delete Personnel"
                    : "Delete Clearance"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
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

  // Compact table headers for personnel
  const PersonnelTableHeaders = () => {
    if (compactView) {
      return (
        <>
          <th>Photo</th>
          <th>Name & Badge</th>
          <th>Rank & Station</th>
          <th>Years</th>
          <th>Separation</th>
          <th>Status</th>
          <th>Actions</th>
        </>
      );
    }

    return (
      <>
        <th>Photo</th>
        <th>Name</th>
        <th>Badge</th>
        <th>Rank</th>
        <th>Station</th>
        <th>New Station</th>
        <th>Years of Service</th>
        <th>Date Hired</th>
        <th>
          {filterType === "transfer" ? "Transfer Date" : "Separation Date"}
        </th>
        <th>Status</th>
        <th>Actions</th>
      </>
    );
  };

  // Compact table headers for clearance
  const ClearanceTableHeaders = () => {
    if (compactView) {
      return (
        <>
          <th>Personnel</th>
          <th>Type & Reason</th>
          <th>Dates</th>
          <th>Status</th>
          <th>Actions</th>
        </>
      );
    }

    return (
      <>
        <th>Personnel</th>
        <th>Clearance Type</th>
        <th>Reason</th>
        <th>New Station</th>
        <th>Effective Date</th>
        <th>Completed Date</th>
        <th>Approved By</th>
        <th>Status</th>
        <th>Actions</th>
      </>
    );
  };

  // Compact personnel row
  const CompactPersonnelRow = ({ record }) => (
    <tr key={`${record.id}-${record.type}`} className={styles.tableRow}>
      <td>
        {record.photo_url ? (
          <img
            src={record.photo_url}
            alt={record.full_name}
            className={styles.photoCompact}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://via.placeholder.com/40";
            }}
          />
        ) : (
          <div className={styles.photoPlaceholderCompact}>
            {record.first_name?.[0]}
            {record.last_name?.[0]}
          </div>
        )}
      </td>
      <td>
        <div className={styles.nameCellCompact}>
          <strong className={styles.compactName}>{record.full_name}</strong>
          <div className={styles.compactBadge}>
            {record.badge_number || "N/A"}
          </div>
          {record.designation && (
            <div className={styles.compactDesignation}>
              {record.designation}
            </div>
          )}
        </div>
      </td>
      <td>
        <div className={styles.compactRankStation}>
          <div className={styles.compactRank}>
            <div className={styles.rankImageContainerCompact}>
              {record.rank && getRankImage(record.rank) ? (
                <img
                  src={getRankImage(record.rank)}
                  alt={record.rank || "Rank"}
                  className={styles.rankImageCompact}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = "none";
                    const parent = e.target.parentElement;
                    if (parent) {
                      const placeholder = parent.querySelector(
                        `.${styles.rankPlaceholderCompact}`
                      );
                      if (placeholder) {
                        placeholder.style.display = "flex";
                      }
                    }
                  }}
                />
              ) : null}
              <div
                className={styles.rankPlaceholderCompact}
                style={{
                  display:
                    record.rank && getRankImage(record.rank) ? "none" : "flex",
                }}
              >
                {record.rank ? record.rank.charAt(0) : "R"}
              </div>
            </div>
            <span className={styles.compactRankText}>
              {record.rank || "N/A"}
            </span>
          </div>
          <div className={styles.compactStation}>
            {record.station || "N/A"}
            {record.status === "Transferred" && record.new_station && (
              <div className={styles.compactTransfer}>
                → {record.new_station}
              </div>
            )}
          </div>
        </div>
      </td>
      <td>
        <span className={styles.yearsBadgeCompact}>
          {record.years_of_service.toFixed(1)}y
        </span>
      </td>
      <td>
        <div className={styles.compactDates}>
          <div>Hired: {formatDate(record.date_hired)}</div>
          <div>Sep: {formatDate(record.separation_date)}</div>
        </div>
      </td>
      <td>
        <span
          className={`${styles.statusBadgeCompact} ${
            record.status && record.status.toLowerCase().includes("retired")
              ? styles.retired
              : record.status &&
                record.status.toLowerCase().includes("resigned")
              ? styles.resigned
              : record.status &&
                record.status.toLowerCase().includes("transferred")
              ? styles.transferred
              : styles.other
          }`}
        >
          {record.status || "Inactive"}
        </span>
      </td>
      <td>
        <div className={styles.actionButtonsCompact}>
          <button
            className={styles.reactivateBtnCompact}
            onClick={() => handleReactivateClick(record)}
            title="Reactivate"
          >
            ↻
          </button>
          <button
            className={styles.deleteBtnCompact}
            onClick={() => handleDeleteClick(record)}
            title="Delete"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );

  // Compact clearance row
  const CompactClearanceRow = ({ record }) => (
    <tr key={`${record.id}-${record.type}`} className={styles.tableRow}>
      <td>
        <div className={styles.compactPersonnelInfo}>
          <strong>{record.full_name}</strong>
          <div className={styles.compactPersonnelMeta}>
            <span>Badge: {record.badge_number || "N/A"}</span>
            <span>Rank: {record.rank || "N/A"}</span>
            <span>Station: {record.station || "N/A"}</span>
          </div>
        </div>
      </td>
      <td>
        <div className={styles.compactClearanceInfo}>
          <span
            className={`${styles.clearanceTypeCompact} ${
              record.clearance_type === "Retirement"
                ? styles.retired
                : record.clearance_type === "Resignation"
                ? styles.resigned
                : record.clearance_type === "Transfer"
                ? styles.transferred
                : styles.equipment
            }`}
          >
            {record.clearance_type}
          </span>
          <div className={styles.compactReason}>
            {record.reason || "No reason provided"}
          </div>
          {record.clearance_type === "Transfer" && record.new_station && (
            <div className={styles.compactTransfer}>→ {record.new_station}</div>
          )}
        </div>
      </td>
      <td>
        <div className={styles.compactDates}>
          <div>Effective: {formatDate(record.effective_date)}</div>
          <div>Completed: {formatDateTime(record.completed_at)}</div>
          <div>Approved: {record.approved_by || "N/A"}</div>
        </div>
      </td>
      <td>
        <span className={`${styles.statusBadgeCompact} ${styles.completed}`}>
          {record.status}
        </span>
      </td>
      <td>
        <div className={styles.actionButtonsCompact}>
          <button
            className={styles.deleteBtnCompact}
            onClick={() => handleDeleteClick(record)}
            title="Delete"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );

  // Regular personnel row
  const RegularPersonnelRow = ({ record }) => (
    <tr key={`${record.id}-${record.type}`} className={styles.tableRow}>
      <td>
        {record.photo_url ? (
          <img
            src={record.photo_url}
            alt={record.full_name}
            className={styles.photo}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://via.placeholder.com/50";
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
            <span className={styles.designation}>{record.designation}</span>
          )}
        </div>
      </td>
      <td>{record.badge_number || "N/A"}</td>
      <td>
        <div className={styles.rankDisplay}>
          <div
            className={`${styles.rankImageContainer} ${
              record.rank ? styles[`rank${record.rank}`] : ""
            }`}
          >
            {record.rank && getRankImage(record.rank) ? (
              <img
                src={getRankImage(record.rank)}
                alt={record.rank || "Rank"}
                className={styles.rankImage}
                onError={(e) => {
                  const target = e.target;
                  if (!target) return;

                  target.onerror = null;
                  target.style.display = "none";

                  const parent = target.parentElement;
                  if (parent) {
                    const placeholder = parent.querySelector(
                      `.${styles.rankPlaceholder}`
                    );
                    if (placeholder) {
                      placeholder.style.display = "flex";
                    }
                  }
                }}
              />
            ) : null}
            <div
              className={styles.rankPlaceholder}
              style={{
                display:
                  record.rank && getRankImage(record.rank) ? "none" : "flex",
              }}
            >
              {record.rank ? record.rank.charAt(0) : "R"}
            </div>
          </div>
          <div className={styles.rankInfo}>
            <div className={styles.rankAbbreviation}>
              {record.rank || "N/A"}
            </div>
            <div className={styles.rankFullName}>
              {getRankName(record.rank)}
            </div>
          </div>
        </div>
      </td>
      <td>{record.station || "N/A"}</td>
      <td>
        {record.status === "Transferred" && record.new_station ? (
          <div className={styles.transferStation}>
            <span className={styles.transferArrow}>→</span>
            <span className={styles.newStation}>{record.new_station}</span>
          </div>
        ) : (
          "N/A"
        )}
      </td>
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
            record.status && record.status.toLowerCase().includes("retired")
              ? styles.retired
              : record.status &&
                record.status.toLowerCase().includes("resigned")
              ? styles.resigned
              : record.status &&
                record.status.toLowerCase().includes("transferred")
              ? styles.transferred
              : styles.other
          }`}
        >
          {record.status || "Inactive"}
        </span>
      </td>
      <td>
        <div className={styles.actionButtons}>
          <button
            className={styles.reactivateBtn}
            onClick={() => handleReactivateClick(record)}
            title="Reactivate this personnel"
          >
            Reactivate
          </button>
          <button
            className={styles.deleteBtn}
            onClick={() => handleDeleteClick(record)}
            title="Delete this record"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );

  // Regular clearance row
  const RegularClearanceRow = ({ record }) => (
    <tr key={`${record.id}-${record.type}`} className={styles.tableRow}>
      <td>
        <div className={styles.nameCell}>
          <strong>{record.full_name}</strong>
          <div className={styles.clearanceMeta}>
            <span>Badge: {record.badge_number || "N/A"}</span>
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
              : record.clearance_type === "Transfer"
              ? styles.transferred
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
      <td>
        {record.clearance_type === "Transfer" && record.new_station ? (
          <div className={styles.transferStation}>
            <span className={styles.transferArrow}>→</span>
            <span className={styles.newStation}>{record.new_station}</span>
          </div>
        ) : (
          "N/A"
        )}
      </td>
      <td>{formatDate(record.effective_date)}</td>
      <td>{formatDateTime(record.completed_at)}</td>
      <td>{record.approved_by || "N/A"}</td>
      <td>
        <span className={`${styles.statusBadge} ${styles.completed}`}>
          {record.status}
        </span>
      </td>
      <td>
        <div className={styles.actionButtons}>
          <button
            className={styles.deleteBtn}
            onClick={() => handleDeleteClick(record)}
            title="Delete this clearance record"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className={`${styles.container} ${styles.landscapeMode}`}>
      <Title>History | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <ToastContainer position="top-right" autoClose={3000} />
      <Sidebar />
      <ReactivateModal />
      <DeleteModal />

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.header}>
          <h1>Separation & Clearance History</h1>
          <p className={styles.subtitle}>
            View retired, resigned, transferred personnel and completed
            clearance requests
          </p>
        </div>

        {/* Controls Row */}
        <div className={styles.controlsRow}>
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
              👥 Personnel ({historyRecords.length})
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
              📋 Clearance ({clearanceHistory.length})
            </button>
          </div>

          {/* Search and Filters */}
          <div className={styles.searchFilters}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder={`Search ${
                  activeTab === "personnel" ? "personnel" : "clearance"
                }...`}
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
                <option value="transfer">Transfer</option>
              </select>
            </div>

            {/* View Toggle Button */}
            <button
              className={`${styles.viewToggleBtn} ${
                compactView ? styles.compactActive : ""
              }`}
              onClick={() => setCompactView(!compactView)}
              title={
                compactView
                  ? "Switch to detailed view"
                  : "Switch to compact view"
              }
            >
              {compactView ? "📱" : "🖥️"}
            </button>
          </div>
        </div>

        {/* Stats Cards - Compact Layout */}
        <div className={styles.statsCompact}>
          <div className={styles.statCardCompact}>
            <div className={styles.statIconCompact}>📜</div>
            <div className={styles.statContentCompact}>
              <div className={styles.statNumberCompact}>
                {activeTab === "personnel"
                  ? historyRecords.length
                  : clearanceHistory.length}
              </div>
              <div className={styles.statLabelCompact}>Total Records</div>
            </div>
          </div>

          {activeTab === "personnel" ? (
            <>
              <div
                className={`${styles.statCardCompact} ${styles.retiredCard}`}
              >
                <div className={styles.statIconCompact}>👴</div>
                <div className={styles.statContentCompact}>
                  <div className={styles.statNumberCompact}>
                    {
                      historyRecords.filter((r) => r.status === "Retired")
                        .length
                    }
                  </div>
                  <div className={styles.statLabelCompact}>Retired</div>
                </div>
              </div>

              <div
                className={`${styles.statCardCompact} ${styles.resignedCard}`}
              >
                <div className={styles.statIconCompact}>👋</div>
                <div className={styles.statContentCompact}>
                  <div className={styles.statNumberCompact}>
                    {
                      historyRecords.filter((r) => r.status === "Resigned")
                        .length
                    }
                  </div>
                  <div className={styles.statLabelCompact}>Resigned</div>
                </div>
              </div>

              <div
                className={`${styles.statCardCompact} ${styles.transferredCard}`}
              >
                <div className={styles.statIconCompact}>🚚</div>
                <div className={styles.statContentCompact}>
                  <div className={styles.statNumberCompact}>
                    {
                      historyRecords.filter((r) => r.status === "Transferred")
                        .length
                    }
                  </div>
                  <div className={styles.statLabelCompact}>Transferred</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div
                className={`${styles.statCardCompact} ${styles.retiredCard}`}
              >
                <div className={styles.statIconCompact}>👴</div>
                <div className={styles.statContentCompact}>
                  <div className={styles.statNumberCompact}>
                    {
                      clearanceHistory.filter(
                        (r) => r.clearance_type === "Retirement"
                      ).length
                    }
                  </div>
                  <div className={styles.statLabelCompact}>Retirement</div>
                </div>
              </div>

              <div
                className={`${styles.statCardCompact} ${styles.resignedCard}`}
              >
                <div className={styles.statIconCompact}>👋</div>
                <div className={styles.statContentCompact}>
                  <div className={styles.statNumberCompact}>
                    {
                      clearanceHistory.filter(
                        (r) => r.clearance_type === "Resignation"
                      ).length
                    }
                  </div>
                  <div className={styles.statLabelCompact}>Resignation</div>
                </div>
              </div>

              <div
                className={`${styles.statCardCompact} ${styles.transferredCard}`}
              >
                <div className={styles.statIconCompact}>🚚</div>
                <div className={styles.statContentCompact}>
                  <div className={styles.statNumberCompact}>
                    {
                      clearanceHistory.filter(
                        (r) => r.clearance_type === "Transfer"
                      ).length
                    }
                  </div>
                  <div className={styles.statLabelCompact}>Transfer</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Table Container with Horizontal Scroll */}
        <div
          className={`${styles.tableContainer} ${
            compactView ? styles.compactTable : ""
          }`}
        >
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
                  ? "No retired, resigned, or transferred personnel found."
                  : "No completed clearance requests found."}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table
                  className={`${styles.table} ${
                    compactView ? styles.compact : ""
                  }`}
                >
                  <thead>
                    <tr>
                      {activeTab === "personnel" ? (
                        <PersonnelTableHeaders />
                      ) : (
                        <ClearanceTableHeaders />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((record) =>
                      activeTab === "personnel" ? (
                        compactView ? (
                          <CompactPersonnelRow
                            key={`${record.id}-${record.type}`}
                            record={record}
                          />
                        ) : (
                          <RegularPersonnelRow
                            key={`${record.id}-${record.type}`}
                            record={record}
                          />
                        )
                      ) : compactView ? (
                        <CompactClearanceRow
                          key={`${record.id}-${record.type}`}
                          record={record}
                        />
                      ) : (
                        <RegularClearanceRow
                          key={`${record.id}-${record.type}`}
                          record={record}
                        />
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredRecords.length > rowsPerPage && (
                <div className={styles.pagination}>
                  <div className={styles.paginationInfo}>
                    Showing {startIndex + 1}-
                    {Math.min(startIndex + rowsPerPage, filteredRecords.length)}{" "}
                    of {filteredRecords.length} records
                  </div>
                  <div className={styles.paginationControls}>
                    <button
                      className={`${styles.paginationBtn} ${
                        currentPage === 1 ? styles.disabled : ""
                      }`}
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      ← Previous
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
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick Instructions */}
        <div className={styles.quickInstructions}>
          <h3>💡 Quick Actions:</h3>
          <div className={styles.instructionItems}>
            <div className={styles.instructionItem}>
              <span className={styles.instructionIcon}>↻</span>
              <span>
                <strong>Reactivate:</strong> Click ↻ to restore personnel to
                Active status
              </span>
            </div>
            <div className={styles.instructionItem}>
              <span className={styles.instructionIcon}>×</span>
              <span>
                <strong>Delete:</strong> Click × to permanently remove records
              </span>
            </div>
            <div className={styles.instructionItem}>
              <span className={styles.instructionIcon}>📱</span>
              <span>
                <strong>View:</strong> Toggle between compact and detailed views
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
