import React, { useState, useEffect, useRef } from "react";
import styles from "../styles/AwardsCommendations.module.css";
import Sidebar from "../../Sidebar";
import Hamburger from "../../Hamburger";
import { useSidebar } from "../../SidebarContext";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// Import the BFP preloader component and its styles
import BFPPreloader from "../../BFPPreloader.jsx"; // Adjust path as needed

const AwardsCommendations = () => {
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();
const { userId, isAuthenticated, userRole } = useUserId();
  // Preloader state
  const [showPreloader, setShowPreloader] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // State variables for table functionality
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterAwardType, setFilterAwardType] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");

  // Update loading progress
  const updateLoadingProgress = (progress) => {
    setLoadingProgress(progress);
  };

  const loadAwards = async () => {
    try {
      console.log("Loading awards from Supabase...");
      updateLoadingProgress(10);

      // Fetch personnel with their award documents including rank_image
      const { data: personnelList, error: personnelError } = await supabase
        .from("personnel")
        .select("*")
        .order("last_name", { ascending: true });

      if (personnelError) {
        console.error("Error loading personnel:", personnelError);
        throw personnelError;
      }

      updateLoadingProgress(30);

      // Fetch all award/commendation documents
      const { data: documentsData, error: documentsError } = await supabase
        .from("personnel_documents")
        .select("*")
        .eq("category", "Award/Commendation")
        .order("uploaded_at", { ascending: false });

      if (documentsError) {
        console.error("Error loading documents:", documentsError);
        throw documentsError;
      }

      updateLoadingProgress(50);

      // Create a map of personnel by ID for quick lookup
      const personnelMap = {};
      personnelList?.forEach((personnel) => {
        personnelMap[personnel.id] = personnel;
      });

      const awardsData = [];

      // Process each award document
      for (const doc of documentsData || []) {
        const personnel = personnelMap[doc.personnel_id];

        if (!personnel) {
          console.warn(
            `No personnel found for document ${doc.id}, personnel_id: ${doc.personnel_id}`
          );
          continue;
        }

        const fullName = `${personnel.first_name || ""} ${
          personnel.middle_name || ""
        } ${personnel.last_name || ""}`.trim();
        const rank = personnel.rank || "N/A";
        const badge = personnel.badge_number || "N/A";

        // Get rank image URL (same logic as medical records)
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

        // Determine award type - use record_type if available, otherwise infer from name
        let awardType = doc.record_type || "General";

        // If record_type is not set, infer from file name
        if (!doc.record_type || doc.record_type === "General") {
          const docName = doc.name?.toLowerCase() || "";

          if (docName.includes("medal") || docName.includes("medal of")) {
            awardType = "Medal";
          } else if (docName.includes("commendation")) {
            awardType = "Commendation";
          } else if (
            docName.includes("certificate") ||
            docName.includes("certificate of")
          ) {
            awardType = "Certificate";
          } else if (
            docName.includes("ribbon") ||
            docName.includes("service ribbon")
          ) {
            awardType = "Ribbon";
          } else if (
            docName.includes("badge") ||
            docName.includes("special badge")
          ) {
            awardType = "Badge";
          }
        }

        // Format date
        const dateUploaded = doc.uploaded_at
          ? new Date(doc.uploaded_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "N/A";

        awardsData.push({
          id: doc.id,
          fullName,
          rank,
          rankImage: rankImageUrl,
          badgeNumber: badge,
          designation: personnel.designation || "N/A",
          awardName: doc.name,
          awardType: awardType,
          dateUploaded,
          downloadUrl: doc.file_url,
          fileName: doc.name,
          fileSize: doc.file_size,
          personnelId: doc.personnel_id,
          rawDocument: doc,
        });
      }

      updateLoadingProgress(80);

      console.log(`Loaded ${awardsData.length} awards from Supabase`);
      setAwards(awardsData);
      updateLoadingProgress(90);

      // Small delay to show completion
      setTimeout(() => {
        updateLoadingProgress(100);
        setLoading(false);
        // Hide preloader after a short delay to show completion
        setTimeout(() => {
          setShowPreloader(false);
        }, 500);
      }, 300);
    } catch (error) {
      console.error("Error loading awards:", error);
      toast.error("Failed to load awards");
      setAwards([]);
      setLoading(false);
      setShowPreloader(false);
    }
  };

  useEffect(() => {
    loadAwards();
  }, []);

  // Handle retry from preloader
  const handleRetryFromPreloader = () => {
    setShowPreloader(true);
    setLoadingProgress(0);
    loadAwards();
  };

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];

    // Card filter
    if (currentFilterCard === "medal") {
      filtered = filtered.filter((i) => i.awardType.toLowerCase() === "medal");
    } else if (currentFilterCard === "commendation") {
      filtered = filtered.filter((i) =>
        i.awardType.toLowerCase().includes("commendation")
      );
    } else if (currentFilterCard === "certificate") {
      filtered = filtered.filter(
        (i) => i.awardType.toLowerCase() === "certificate"
      );
    } else if (currentFilterCard === "ribbon") {
      filtered = filtered.filter((i) => i.awardType.toLowerCase() === "ribbon");
    } else if (currentFilterCard === "badge") {
      filtered = filtered.filter((i) => i.awardType.toLowerCase() === "badge");
    }

    // Text filters
    const s = search.trim().toLowerCase();
    const typeFilter = filterAwardType.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.fullName} ${i.rank} ${i.badgeNumber} ${i.designation} ${i.awardName} ${i.awardType} ${i.dateUploaded}`.toLowerCase();
      const typeMatch =
        !typeFilter || (i.awardType || "").toLowerCase().includes(typeFilter);
      const searchMatch = !s || text.includes(s);
      return typeMatch && searchMatch;
    });

    return filtered;
  }

  const filteredAwardsData = applyFilters(awards);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAwardsData.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredAwardsData.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Pagination function
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredAwardsData.length / rowsPerPage)
    );
    const hasNoData = filteredAwardsData.length === 0;

    const buttons = [];

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.ACSPaginationBtn} ${
          hasNoData ? styles.ACSDisabled : ""
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
        className={`${styles.ACSPaginationBtn} ${
          1 === currentPage ? styles.ACSActive : ""
        } ${hasNoData ? styles.ACSDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    // Show ellipsis after first page if needed
    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.ACSPaginationEllipsis}>
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

    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < pageCount) {
        buttons.push(
          <button
            key={i}
            className={`${styles.ACSPaginationBtn} ${
              i === currentPage ? styles.ACSActive : ""
            } ${hasNoData ? styles.ACSDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.ACSPaginationEllipsis}>
          ...
        </span>
      );
    }

    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.ACSPaginationBtn} ${
            pageCount === currentPage ? styles.ACSActive : ""
          } ${hasNoData ? styles.ACSDisabled : ""}`}
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
        className={`${styles.ACSPaginationBtn} ${
          hasNoData ? styles.ACSDisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  // Handle download
  const handleDownload = async (award) => {
    try {
      console.log("Downloading award:", award.id, award.fileName);

      if (award.downloadUrl) {
        // Create a temporary link and trigger download
        const link = document.createElement("a");
        link.href = award.downloadUrl;
        link.download = award.fileName || "award_commendation";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Download started");
      } else {
        toast.error("No download URL available");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Error downloading file");
    }
  };

  // Summary numbers
  const totalItems = awards.length;
  const medalItems = awards.filter(
    (i) => i.awardType.toLowerCase() === "medal"
  ).length;
  const commendationItems = awards.filter((i) =>
    i.awardType.toLowerCase().includes("commendation")
  ).length;
  const certificateItems = awards.filter(
    (i) => i.awardType.toLowerCase() === "certificate"
  ).length;
  const ribbonItems = awards.filter(
    (i) => i.awardType.toLowerCase() === "ribbon"
  ).length;
  const badgeItems = awards.filter(
    (i) => i.awardType.toLowerCase() === "badge"
  ).length;

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  // Utility function for truncation
  const truncateText = (text, maxLength = 30) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Enhanced AwardNameCell with smart positioning (similar to Medical Records)
  const AwardNameCell = ({ awardName, rowIndex, totalRows }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState("bottom");
    const cellRef = useRef(null);

    // Calculate if we're near the bottom of the table
    const isNearBottom = rowIndex > totalRows - 3;

    // Update position on hover
    useEffect(() => {
      if (isHovered && cellRef.current) {
        const rect = cellRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Check if there's enough space below the cell
        const spaceBelow = viewportHeight - rect.bottom;
        const tooltipHeight = 100;

        // If near bottom of viewport OR near bottom of table, show tooltip on top
        if (spaceBelow < tooltipHeight + 20 || isNearBottom) {
          setTooltipPosition("top");
        } else {
          setTooltipPosition("bottom");
        }
      }
    }, [isHovered, rowIndex, isNearBottom]);

    const showTooltip = awardName && awardName.length > 30 && isHovered;

    return (
      <div ref={cellRef} className={styles.awardNameCell}>
        <div
          className={styles.awardNameWrapper}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title={awardName}
        >
          <span className={styles.truncatedText}>
            {truncateText(awardName, 30)}
          </span>
          {awardName && awardName.length > 30 && (
            <span className={styles.fullLengthIndicator}>…</span>
          )}
        </div>

        {showTooltip && (
          <div className={`${styles.tooltip} ${styles[tooltipPosition]}`}>
            <div className={styles.tooltipContent}>
              <span className={styles.tooltipText}>{awardName}</span>
              <span className={styles.tooltipArrow}></span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render BFP Preloader if still loading
  if (showPreloader) {
    return (
      <BFPPreloader
        loading={loading}
        progress={loadingProgress}
        moduleTitle="AWARDS & COMMENDATIONS • Loading Achievements..."
        onRetry={handleRetryFromPreloader}
      />
    );
  }

  return (
    <div className={styles.ACSAppContainer}>
      <Title>Awards & Commendations | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      <Hamburger />
      <Sidebar />

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

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1 className={styles.ACSTitle}>Awards & Commendations of Personnel</h1>

        {/* Top Controls */}
        <div className={styles.ACSTopControls}>
          <div className={styles.ACSTableHeader}>
            <select
              className={styles.ACSFilterType}
              value={filterAwardType}
              onChange={(e) => {
                setFilterAwardType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Award Types</option>
              <option value="Medal">Medal</option>
              <option value="Commendation">Commendation</option>
              <option value="Certificate">Certificate</option>
              <option value="Ribbon">Ribbon</option>
              <option value="Badge">Badge</option>
              <option value="General">General</option>
            </select>

            <input
              type="text"
              className={styles.ACSSearchBar}
              placeholder="🔍 Search awards & commendations..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.ACSSummary}>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSTotal} ${
              currentFilterCard === "total" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Total Awards</h3>
            <p>{totalItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSMedal} ${
              currentFilterCard === "medal" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("medal")}
          >
            <h3>Medals</h3>
            <p>{medalItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSCommendation} ${
              currentFilterCard === "commendation" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("commendation")}
          >
            <h3>Commendations</h3>
            <p>{commendationItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSCertificate} ${
              currentFilterCard === "certificate" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("certificate")}
          >
            <h3>Certificates</h3>
            <p>{certificateItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSRibbon} ${
              currentFilterCard === "ribbon" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("ribbon")}
          >
            <h3>Ribbons</h3>
            <p>{ribbonItems}</p>
          </button>
          <button
            className={`${styles.ACSSummaryCard} ${styles.ACSBadge} ${
              currentFilterCard === "badge" ? styles.ACSActive : ""
            }`}
            onClick={() => handleCardClick("badge")}
          >
            <h3>Badges</h3>
            <p>{badgeItems}</p>
          </button>
        </div>

        <div className={styles.ACSPaginationContainer}>
          {renderPaginationButtons()}
        </div>

        {/* Table with Scrollable Container - Same as Medical Records */}
        <div className={styles.ACSTableScrollContainer}>
          <table className={styles.ACSTable}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Badge No.</th>
                <th>Award Name</th>
                <th>Award Type</th>
                <th>Date Awarded/Uploaded</th>
                <th>File Size</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="9" className={styles.ACSNoAwardsTable}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>🏆</span>
                    </div>
                    <h3>No Awards & Commendations Found</h3>
                    <p>There are no awards or commendations uploaded yet.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((award, index) => (
                  <tr key={award.id} className={styles.ACSTableRow}>
                    <td className={styles.rankCellColumn}>
                      <div className={styles.rankCell}>
                        {award.rankImage ? (
                          <img
                            src={award.rankImage}
                            alt={award.rank || "Rank"}
                            className={styles.rankImage}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = "none";
                            }}
                          />
                        ) : null}
                        <span className={styles.rankText}>
                          {award.rank || "No Rank"}
                        </span>
                      </div>
                    </td>
                    <td>{award.fullName}</td>
                    <td>{award.designation}</td>
                    <td>{award.badgeNumber}</td>
                    <td className={styles.tableCellWithTooltip}>
                      <AwardNameCell
                        awardName={award.awardName}
                        rowIndex={index}
                        totalRows={paginated.length}
                      />
                    </td>
                    <td>
                      <span
                        className={`${styles.ACSStatus} ${
                          styles[award.awardType.toLowerCase().replace(" ", "")]
                        }`}
                      >
                        {award.awardType}
                      </span>
                    </td>
                    <td>{award.dateUploaded}</td>
                    <td>
                      {award.fileSize
                        ? `${Math.round(award.fileSize / 1024)} KB`
                        : "N/A"}
                    </td>
                    <td>
                      <button
                        className={styles.ACSDownloadLink}
                        onClick={() => handleDownload(award)}
                        disabled={!award.downloadUrl}
                      >
                        📥 Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.ACSPaginationContainerBottom}>
          {renderPaginationButtons()}
        </div>
      </div>
    </div>
  );
};

export default AwardsCommendations;
