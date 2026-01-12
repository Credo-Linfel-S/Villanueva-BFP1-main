import React, { useState, useEffect, useMemo } from "react";
import styles from "../styles/Placement.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import BFPPreloader from "../../BFPPreloader.jsx";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  filterActivePersonnel,
  getAssignablePersonnel,
  isPersonnelActive,
} from "../../filterActivePersonnel.js";
import logo from "../../../assets/Firefighter.png";
import FloatingNotificationBell from "../../FloatingNotificationBell.jsx";
import { useUserId } from "../../hooks/useUserId.js";

const Placement = () => {
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();

  // Preloader state
  const [showPreloader, setShowPreloader] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { userId, isAuthenticated, userRole } = useUserId();

  // State variables for table functionality
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editData, setEditData] = useState({ designation: "", station: "" });

  // Use useMemo to filter active personnel whenever personnel changes
  const activePersonnel = useMemo(() => {
    return filterActivePersonnel(personnel);
  }, [personnel]);

  const assignablePersonnel = useMemo(() => {
    return getAssignablePersonnel(personnel);
  }, [personnel]);

  // Rank options
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

  // Helper functions
  const getRankImage = (rank) => {
    const rankOption = rankOptions.find((option) => option.rank === rank);
    return rankOption ? rankOption.image : null;
  };

  const getRankName = (rank) => {
    const rankOption = rankOptions.find((option) => option.rank === rank);
    return rankOption ? rankOption.name : rank || "N/A";
  };

  const updateLoadingProgress = (progress) => {
    setLoadingProgress(progress);
  };

  // Photo cell component
  const PhotoCell = ({ person }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [imageSrc, setImageSrc] = useState(logo);

    useEffect(() => {
      const loadPhoto = async () => {
        setIsLoading(true);

        try {
          let url = logo;

          // Check if personnel has a photo_url from Supabase
          if (person.photo_url && person.photo_url.startsWith("http")) {
            const isValid = await testImage(person.photo_url);
            if (isValid) {
              url = person.photo_url;
            } else {
              // Try photo_path as fallback
              if (person.photo_path) {
                const { data: urlData } = supabase.storage
                  .from("personnel-documents")
                  .getPublicUrl(person.photo_path);
                const pathUrl = urlData?.publicUrl;
                if (pathUrl && (await testImage(pathUrl))) {
                  url = pathUrl;
                } else {
                  url = logo;
                }
              }
            }
          } else if (person.photo_path) {
            // Use photo_path if photo_url is not available
            const { data: urlData } = supabase.storage
              .from("personnel-documents")
              .getPublicUrl(person.photo_path);
            const pathUrl = urlData?.publicUrl;
            if (pathUrl && (await testImage(pathUrl))) {
              url = pathUrl;
            } else {
              url = logo;
            }
          }

          setImageSrc(url);
        } catch (error) {
          console.error("Error loading photo:", error);
          setImageSrc(logo);
        } finally {
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
        setTimeout(() => resolve(false), 2000);
      });
    };

    return (
      <div className={styles.PMTPhotoContainer}>
        {isLoading ? (
          <div className={styles.PMTPhotoLoading}>
            <div className={styles.PMTPhotoSpinner}></div>
            <small>Loading...</small>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={`${person.first_name || ""} ${person.last_name || ""}`}
            className={styles.PMTPhotoThumb}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = logo;
            }}
            loading="lazy"
          />
        )}
      </div>
    );
  };

  // Load personnel data
  useEffect(() => {
    loadPersonnelData();
  }, []);

  const handleRetryFromPreloader = () => {
    setShowPreloader(true);
    setLoadingProgress(0);
    loadPersonnelData();
  };

  const loadPersonnelData = async () => {
    try {
      setLoading(true);
      updateLoadingProgress(10);

      // Fetch personnel data from Supabase
      const { data: personnelData, error } = await supabase
        .from("personnel")
        .select("*")
        .order("last_name", { ascending: true });

      if (error) {
        console.error("Error loading personnel data from Supabase:", error);
        throw error;
      }

      updateLoadingProgress(50);

      console.log(
        "Loaded personnel data from Supabase:",
        personnelData?.length || 0,
        "records"
      );

      const activeCount = filterActivePersonnel(personnelData || []).length;
      const totalCount = personnelData?.length || 0;
      console.log(`Active personnel: ${activeCount}/${totalCount}`);

      setPersonnel(personnelData || []);
      setLoading(false);
      updateLoadingProgress(80);

      // Small delay to show completion
      setTimeout(() => {
        updateLoadingProgress(100);
        setTimeout(() => {
          setShowPreloader(false);
        }, 500);
      }, 300);
    } catch (error) {
      console.error("Error loading personnel data:", error);
      setLoading(false);
      setShowPreloader(false);
    }
  };

  // Helper functions for data formatting
  const formatDateForDisplay = (dateValue) => {
    if (!dateValue) return "N/A";

    if (typeof dateValue === "string") {
      try {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }
      } catch {
        return dateValue;
      }
      return dateValue;
    }

    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    try {
      const date = new Date(dateValue);
      return isNaN(date.getTime())
        ? "N/A"
        : date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
    } catch {
      return "N/A";
    }
  };

  const calculateYears = (dateValue) => {
    if (!dateValue) return 0;

    let date;
    try {
      if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        date = new Date(dateValue);
      }

      if (isNaN(date.getTime())) return 0;

      const today = new Date();
      const diff = today - date;
      return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    } catch {
      return 0;
    }
  };

  const handleEdit = (index) => {
    const person = activePersonnel[index];
    setEditingIndex(index);
    setEditData({
      designation: person.designation || "",
      station: person.station || "",
    });
  };

  const handleSave = async (index) => {
    const { designation, station } = editData;

    if (!designation.trim() || !station.trim()) {
      toast.info("Please fill in both designation and station/unit.");
      return;
    }

    try {
      const personToUpdate = activePersonnel[index];

      // Prepare update data
      const updateData = {
        designation: designation.trim(),
        station: station.trim(),
        updated_at: new Date().toISOString(),
      };

      // Update in Supabase
      const { data, error } = await supabase
        .from("personnel")
        .update(updateData)
        .eq("id", personToUpdate.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating personnel data in Supabase:", error);
        throw error;
      }

      // Update local state
      setPersonnel((prevPersonnel) =>
        prevPersonnel.map((person) => (person.id === data.id ? data : person))
      );

      setEditingIndex(null);
      setEditData({ designation: "", station: "" });

      console.log("Successfully updated personnel placement data");
    } catch (error) {
      console.error("Error saving personnel data:", error);
      toast.error("Error saving changes. Please try again.");
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData({ designation: "", station: "" });
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getFullName = (person) => {
    const firstName = person.first_name || "";
    const middleName = person.middle_name || "";
    const lastName = person.last_name || "";
    return `${firstName} ${middleName} ${lastName}`.trim() || "N/A";
  };

  const getDateHired = (person) => {
    return person.date_hired;
  };

  const getLastPromotionDate = (person) => {
    return person.last_promoted || person.date_hired;
  };

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];

    // Card filter
    if (currentFilterCard === "eligible") {
      filtered = filtered.filter((person) => {
        const lastPromoted = getLastPromotionDate(person);
        const years = calculateYears(lastPromoted);
        return years >= 2;
      });
    } else if (currentFilterCard === "not-eligible") {
      filtered = filtered.filter((person) => {
        const lastPromoted = getLastPromotionDate(person);
        const years = calculateYears(lastPromoted);
        return years < 2;
      });
    }

    // Text filters
    const s = search.trim().toLowerCase();
    const rankFilter = filterRank.trim().toLowerCase();

    filtered = filtered.filter((person) => {
      const fullName = getFullName(person).toLowerCase();
      const designation = (person.designation || "").toLowerCase();
      const station = (person.station || "").toLowerCase();
      const rank = (person.rank || "").toLowerCase();

      const text =
        `${fullName} ${rank} ${designation} ${station}`.toLowerCase();
      const rankMatch = !rankFilter || rank.includes(rankFilter);
      const searchMatch = !s || text.includes(s);

      return rankMatch && searchMatch;
    });

    return filtered;
  }

  // Use activePersonnel for filtering and display
  const filteredPersonnel = applyFilters(activePersonnel);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPersonnel.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredPersonnel.slice(pageStart, pageStart + rowsPerPage);

  // Pagination function - copied from inventory
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredPersonnel.length / rowsPerPage)
    );
    const hasNoData = filteredPersonnel.length === 0;

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

  // Summary numbers - Use activePersonnel
  const totalItems = activePersonnel.length;
  const eligibleItems = activePersonnel.filter((person) => {
    const lastPromoted = getLastPromotionDate(person);
    const years = calculateYears(lastPromoted);
    return years >= 2;
  }).length;
  const notEligibleItems = totalItems - eligibleItems;

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  // Render BFP Preloader if still loading
  if (showPreloader) {
    return (
      <BFPPreloader
        loading={loading}
        progress={loadingProgress}
        moduleTitle="PLACEMENT SYSTEM • Assigning Positions..."
        onRetry={handleRetryFromPreloader}
      />
    );
  }

  return (
    <div className={styles.PMTAppContainer}>
      <Title>Personnel Placement | BFP Villanueva</Title>
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
        <h1 className={styles.PMTTitle}>Personnel Placement</h1>

        {/* Active personnel badge */}
        <div className={styles.PMTActiveBadge}>
          Showing {activePersonnel.length} active personnel
        </div>

        {/* ========== COPIED INVENTORY TABLE UI ========== */}
        <div className={styles.inventoryTopControls}>
          <div className={styles.inventoryTableHeader}>
            <select
              className={styles.inventoryFilterCategory}
              value={filterRank}
              onChange={(e) => {
                setFilterRank(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Ranks</option>
              <option>FO1</option>
              <option>FO2</option>
              <option>FO3</option>
              <option>SFO1</option>
              <option>SFO2</option>
              <option>SFO3</option>
              <option>SFO4</option>
            </select>

            <input
              type="text"
              className={styles.inventorySearchBar}
              placeholder="🔍 Search personnel..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards - Copied from inventory */}
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
            <h3>Active Personnel</h3>
            <p id={styles.inventoryTotalItems}>{totalItems}</p>
          </button>
          <button
            className={`${styles.inventorySummaryCard} ${
              styles.inventoryAssigned
            } ${
              currentFilterCard === "eligible" ? styles.inventoryActive : ""
            }`}
            data-filter="eligible"
            onClick={() => handleCardClick("eligible")}
          >
            <h3>Eligible</h3>
            <p id={styles.inventoryAssignedItems}>{eligibleItems}</p>
          </button>
          <button
            className={`${styles.inventorySummaryCard} ${
              styles.inventoryStorage
            } ${
              currentFilterCard === "not-eligible" ? styles.inventoryActive : ""
            }`}
            data-filter="not-eligible"
            onClick={() => handleCardClick("not-eligible")}
          >
            <h3>Not Eligible</h3>
            <p id={styles.inventoryStorageItems}>{notEligibleItems}</p>
          </button>
        </div>

        {/* Top Pagination */}
        <div
          className={`${styles.inventoryPaginationContainer} ${styles.inventoryTopPagination}`}
        >
          {renderPaginationButtons()}
        </div>

        {/* Table Wrapper - Copied from inventory */}
        <div className={styles.tableWrapper}>
          <table className={styles.inventoryTable}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Personnel</th>
                <th>Rank</th>
                <th>Current Designation</th>
                <th>Station/Unit</th>
                <th>Years in Designation</th>
                <th>Last Promotion Date</th>
                <th>Eligibility Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id={styles.inventoryTableBody}>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>👨‍🚒</span>
                    </div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#2b2b2b",
                        marginBottom: "8px",
                      }}
                    >
                      No Active Personnel Found
                    </h3>
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      Ready to serve but no personnel records yet
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((person, index) => {
                  const lastPromoted = getLastPromotionDate(person);
                  const years = calculateYears(lastPromoted);
                  const isEligible = years >= 2;
                  const isEditing = editingIndex === index;

                  return (
                    <tr key={person.id}>
                      <td>
                        <PhotoCell person={person} />
                      </td>
                      <td>{getFullName(person)}</td>
                      <td>
                        <div className={styles.rankCell}>
                          {(() => {
                            const rankImg = getRankImage(person.rank);
                            if (rankImg) {
                              return (
                                <>
                                  <img
                                    src={rankImg}
                                    alt={person.rank || "Rank"}
                                    className={styles.rankImage}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.style.display = "none";
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
                                      {person.rank?.charAt(0) || "R"}
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
                                  {person.rank?.charAt(0) || "R"}
                                </span>
                              </div>
                            );
                          })()}

                          <span className={styles.rankText}>
                            {person.rank || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className={styles.inventoryModalInput}
                            value={editData.designation}
                            onChange={(e) =>
                              handleInputChange("designation", e.target.value)
                            }
                            placeholder="Enter designation"
                          />
                        ) : (
                          person.designation || "Not assigned"
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className={styles.inventoryModalInput}
                            value={editData.station}
                            onChange={(e) =>
                              handleInputChange("station", e.target.value)
                            }
                            placeholder="Enter station/unit"
                          />
                        ) : (
                          person.station || "Not assigned"
                        )}
                      </td>
                      <td>{years}</td>
                      <td>{formatDateForDisplay(lastPromoted)}</td>
                      <td>
                        <span
                          style={{
                            padding: "6px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "600",
                            backgroundColor: isEligible ? "#d4edda" : "#f8d7da",
                            color: isEligible ? "#155724" : "#721c24",
                          }}
                        >
                          {isEligible ? "Eligible" : "Not Eligible"}
                        </span>
                      </td>
                      <td>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button
                              className={styles.inventoryEditBtn}
                              onClick={() => handleSave(index)}
                            >
                              Save
                            </button>
                            <button
                              className={styles.inventoryDeleteBtn}
                              onClick={handleCancel}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className={styles.inventoryEditBtn}
                            onClick={() => handleEdit(index)}
                          >
                            Manage
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.tableBottomPagination}>
          {renderPaginationButtons()}
        </div>
        {/* ========== END COPIED INVENTORY TABLE UI ========== */}
      </div>
    </div>
  );
};

export default Placement;
