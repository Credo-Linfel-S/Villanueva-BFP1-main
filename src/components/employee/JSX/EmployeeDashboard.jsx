// components/EmployeeDashboard.jsx - UPDATED WITH BFP PRELOADER
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../AuthContext.jsx";
import EmployeeSidebar from "../../EmployeeSidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import styles from "../styles/EmployeeDashboard.module.css";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import jsbarcode from "jsbarcode";
import logo from "../../../assets/Firefighter.png"; // Add this import
import BFPPreloader from "../../BFPPreloader.jsx"; // Add BFPPreloader import
import { useLocation } from "react-router-dom"; // Add useLocation import

// Remove LoadingState component since we're using BFPPreloader
const ErrorState = ({ onRetry }) => (
  <div className={styles.modernLoading}>
    <div className={styles.errorState}>
      <i className="fas fa-exclamation-triangle"></i>
      <h3>Employee Profile Not Found</h3>
      <p>Your employee profile could not be loaded from the database.</p>
      <button onClick={onRetry} className={styles.retryButton}>
        <i className="fas fa-redo"></i> Retry
      </button>
    </div>
  </div>
);

const BarcodeModal = ({ show, onClose, selectedBarcode, onDownload }) => {
  useEffect(() => {
    if (show && selectedBarcode) {
      const timeoutId = setTimeout(() => {
        const canvas = document.getElementById("employee-barcode-canvas");
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          jsbarcode(canvas, selectedBarcode.code, {
            format: "CODE128",
            displayValue: true,
            fontSize: 14,
            textMargin: 8,
            margin: 10,
            width: 2,
            height: 50,
          });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [show, selectedBarcode]);

  if (!show || !selectedBarcode) return null;

  return (
    <div className={styles.barcodeModalOverlay} onClick={onClose}>
      <div className={styles.barcodeModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.barcodeModalHeader}>
          <h3>Equipment Barcode</h3>
          <button className={styles.barcodeModalClose} onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className={styles.barcodeModalContent}>
          <div className={styles.barcodeInfo}>
            <h4>{selectedBarcode.name}</h4>
            <p>
              <strong>Code:</strong> {selectedBarcode.code}
            </p>
          </div>
          <canvas
            id="employee-barcode-canvas"
            width="300"
            height="120"
            className={styles.barcodeCanvas}
          />
          <div className={styles.barcodeModalActions}>
            <button
              className={styles.barcodeDownloadBtn}
              onClick={() =>
                onDownload(selectedBarcode.code, selectedBarcode.name)
              }
            >
              <i className="fas fa-download"></i> Download Barcode
            </button>
            <button className={styles.barcodeCloseBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Photo Component with same logic as PersonnelRegister
const ProfilePhoto = ({ employee }) => {
  const [imageSrc, setImageSrc] = useState(logo);
  const [isLoading, setIsLoading] = useState(true);

  const testImage = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      setTimeout(() => resolve(false), 3000);
    });
  };

  useEffect(() => {
    const loadPhoto = async () => {
      setIsLoading(true);

      try {
        let url = logo; // Default to your imported image

        // Check in order of priority
        if (employee?.photo_url && employee.photo_url.startsWith("http")) {
          const isValid = await testImage(employee.photo_url);
          if (isValid) {
            url = employee.photo_url;
          } else if (employee?.photo_path) {
            const { data: urlData } = supabase.storage
              .from("personnel-documents")
              .getPublicUrl(employee.photo_path);
            const pathUrl = urlData?.publicUrl;
            if (pathUrl && (await testImage(pathUrl))) {
              url = pathUrl;
            }
          }
        } else if (employee?.photo_path) {
          const { data: urlData } = supabase.storage
            .from("personnel-documents")
            .getPublicUrl(employee.photo_path);
          const pathUrl = urlData?.publicUrl;
          if (pathUrl && (await testImage(pathUrl))) {
            url = pathUrl;
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

    if (employee) {
      loadPhoto();
    }
  }, [employee]);

  return (
    <div className={styles.profilePhotoContainer}>
      {isLoading ? (
        <div className={styles.profilePhotoLoading}>
          <div className={styles.profilePhotoSpinner}></div>
          <small>Loading...</small>
        </div>
      ) : (
        <img
          src={imageSrc}
          alt={`${employee?.first_name || ""} ${employee?.last_name || ""}`}
          className={styles.profilePhoto}
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

// Welcome Header Component
const WelcomeHeader = ({ employee, onRefresh }) => (
  <div className={styles.welcomeHeader}>
    <div className={styles.welcomeInfo}>
      <div className={styles.welcomeAvatar}>
        <ProfilePhoto employee={employee} />
      </div>
      <div className={styles.welcomeText}>
        <h1>Welcome back, {employee?.first_name || "Employee"}!</h1>
        <p className={styles.welcomeSubtitle}>
          Here's what's happening with your account today.
        </p>
        <div className={styles.welcomeBadges}>
          <RankBadge rank={employee?.rank} />
          <span className={`${styles.badge} ${styles.stationBadge}`}>
            <i className="fas fa-map-marker-alt"></i>
            {employee?.station || "No Station"}
          </span>
        </div>
      </div>
    </div>
    <div className={styles.headerActions}>
      <button
        className={styles.refreshButton}
        onClick={onRefresh}
        title="Refresh Dashboard"
      >
        <i className="fas fa-sync-alt"></i> Refresh
      </button>
    </div>
  </div>
);

// Rank Badge Component with Color Coding
const RankBadge = ({ rank }) => {
  const getRankColor = (rank) => {
    if (!rank) return "#667eea"; // Default color

    const rankUpper = rank.toUpperCase();
    switch (rankUpper) {
      case "FO1":
        return "#3b82f6"; // Blue 500
      case "FO2":
        return "#1d4ed8"; // Blue 700
      case "FO3":
        return "#1e40af"; // Blue 800
      case "SFO1":
        return "#f59e0b"; // Amber 500
      case "SFO2":
        return "#d97706"; // Amber 600
      case "SFO3":
        return "#b45309"; // Amber 700
      case "SFO4":
        return "#92400e"; // Amber 800
      default:
        return "#667eea"; // Default purple
    }
  };

  const getRankBackground = (rank) => {
    const color = getRankColor(rank);
    return {
      background: `linear-gradient(135deg, ${color} 0%, ${adjustColor(
        color,
        -20
      )} 100%)`,
    };
  };

  const adjustColor = (color, amount) => {
    let usePound = false;
    if (color[0] === "#") {
      color = color.slice(1);
      usePound = true;
    }
    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let g = ((num >> 8) & 0x00ff) + amount;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    let b = (num & 0x0000ff) + amount;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    return (
      (usePound ? "#" : "") +
      ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")
    );
  };

  return (
    <span
      className={`${styles.badge} ${styles.rankBadge}`}
      style={getRankBackground(rank)}
    >
      <i className="fas fa-user-shield"></i>
      {rank || "N/A"}
    </span>
  );
};

// Rank Stat Card Component
const RankStatCard = ({ employee, onTabChange }) => {
  const getRankColor = (rank) => {
    if (!rank) return "#667eea";

    const rankUpper = rank.toUpperCase();
    switch (rankUpper) {
      case "FO1":
        return "#3b82f6";
      case "FO2":
        return "#1d4ed8";
      case "FO3":
        return "#1e40af";
      case "SFO1":
        return "#f59e0b";
      case "SFO2":
        return "#d97706";
      case "SFO3":
        return "#b45309";
      case "SFO4":
        return "#92400e";
      default:
        return "#667eea";
    }
  };

  const getRankBackground = (rank) => {
    const color = getRankColor(rank);
    const darkerColor = adjustColor(color, -30);
    return `linear-gradient(135deg, ${color} 0%, ${darkerColor} 100%)`;
  };

  const adjustColor = (color, amount) => {
    let usePound = false;
    if (color[0] === "#") {
      color = color.slice(1);
      usePound = true;
    }
    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let g = ((num >> 8) & 0x00ff) + amount;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    let b = (num & 0x0000ff) + amount;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    return (
      (usePound ? "#" : "") +
      ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")
    );
  };

  const rank = employee?.rank || "N/A";
  const rankImage = employee?.rank_image;

  return (
    <div
      className={styles.metricCard}
      style={{ background: getRankBackground(rank) }}
      onClick={() => onTabChange("profile")}
    >
      <div
        className={styles.metricIcon}
        style={{ background: "rgba(255, 255, 255, 0.2)" }}
      >
        {rankImage ? (
          <img
            src={rankImage}
            alt={rank}
            className={styles.rankImage}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = "none";
              e.target.parentElement.innerHTML =
                '<i className="fas fa-user-shield"></i>';
            }}
          />
        ) : (
          <i className="fas fa-user-shield"></i>
        )}
      </div>
      <div className={styles.metricContent}>
        <h3 style={{ color: "white" }}>{rank}</h3>
        <p style={{ color: "rgba(255, 255, 255, 0.9)" }}>Current Rank</p>
        <div className={styles.rankProgress}>
          <div className={styles.rankLevel}>
            <span className={styles.rankDot}></span>
            <span style={{ color: "rgba(255, 255, 255, 0.8)" }}>
              Fire Officer
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Key Metrics Component with Rank Card
const KeyMetrics = ({
  equipmentCount,
  clearanceCount,
  pendingClearances,
  employee,
  onTabChange,
}) => (
  <div className={styles.keyMetrics}>
    <div className={styles.metricCard}>
      <div
        className={styles.metricIcon}
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <i className="fas fa-laptop">🔧</i>
      </div>
      <div className={styles.metricContent}>
        <h3>{equipmentCount}</h3>
        <p>Assigned Equipment</p>
        <button
          className={styles.metricAction}
          onClick={() => onTabChange("equipment")}
        >
          View All <i className="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>

    <div className={styles.metricCard}>
      <div
        className={styles.metricIcon}
        style={{
          background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        }}
      >
        <i className="fas fa-file-contract">📋</i>
      </div>
      <div className={styles.metricContent}>
        <h3>{clearanceCount}</h3>
        <p> Total Clearances</p>
        <button
          className={styles.metricAction}
          onClick={() => onTabChange("clearance")}
        >
          View All <i className="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>

    {/* Rank Stat Card */}
    <RankStatCard employee={employee} onTabChange={onTabChange} />
  </div>
);

// Profile Card with Side Layout
const ProfileCard = ({ employee, formatDate }) => (
  <div className={styles.profileCard}>
    <div className={styles.cardHeader}>
      <h2>
        <i className="fas fa-id-card"></i> Employee Profile
      </h2>
    </div>

    <div className={styles.profileContent}>
      <div className={styles.profileMain}>
        <div className={styles.profileAvatar}>
          <ProfilePhoto employee={employee} />
          <div className={styles.avatarStatus}>
            <span className={styles.statusDot}></span>
            Active
          </div>
        </div>

        <div className={styles.profileInfo}>
          <h3>{`${employee?.rank || ""} ${employee?.first_name || ""} ${
            employee?.middle_name || ""
          } ${employee?.last_name || ""}`}</h3>
          <p className={styles.profileDesignation}>
            <i className="fas fa-briefcase"></i>{" "}
            {employee?.designation || "Employee"}
          </p>
          <div className={styles.profileContact}>
            <span>
              <i className="fas fa-id-badge"></i> Badge:{" "}
              {employee?.badge_number || "-"}
            </span>
            <span>
              <i className="fas fa-user"></i> Username:{" "}
              {employee?.username || "-"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.profileDetails}>
        <div className={styles.detailRow}>
          <ProfileDetailItem
            icon="fas fa-calendar-alt"
            label="Date Hired"
            value={formatDate(employee?.date_hired)}
          />
          <ProfileDetailItem
            icon="fas fa-birthday-cake"
            label="Birth Date"
            value={formatDate(employee?.birth_date)}
          />
        </div>
        <div className={styles.detailRow}>
          <ProfileDetailItem
            icon="fas fa-map-marker-alt"
            label="Station"
            value={employee?.station}
          />
          <ProfileDetailItem
            icon="fas fa-clock"
            label="Service Years"
            value={
              employee?.date_hired
                ? `${
                    new Date().getFullYear() -
                    new Date(employee.date_hired).getFullYear()
                  } years`
                : "-"
            }
          />
        </div>
      </div>
    </div>
  </div>
);

const ProfileDetailItem = ({ icon, label, value }) => (
  <div className={styles.detailItem}>
    <i className={icon}></i>
    <div>
      <label>{label}</label>
      <span>{value || "-"}</span>
    </div>
  </div>
);

// Main Content Component
const MainContent = ({
  activeTab,
  setActiveTab,
  employee,
  assignedEquipment,
  recentEquipment,
  clearanceRequests,
  recentClearances,
  clearanceLoading,
  getStatusColor,
  formatDate,
  showBarcode,
  downloadBarcode,
  viewClearanceDetails,
  downloadClearanceDocument,
  refreshClearanceData,
  pendingClearanceCount,
  onRefresh,
}) => (
  <div className={styles.mainContent}>
    <div className={styles.contentHeader}>
      <div className={styles.tabNavigation}>
        <TabButton
          icon="fas fa-chart-pie"
          label="Dashboard"
          isActive={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
        />
        <TabButton
          icon="fas fa-laptop"
          label="Equipment"
          isActive={activeTab === "equipment"}
          onClick={() => setActiveTab("equipment")}
          badge={assignedEquipment.length}
        />
        <TabButton
          icon="fas fa-file-contract"
          label="Clearance"
          isActive={activeTab === "clearance"}
          onClick={() => setActiveTab("clearance")}
          badge={pendingClearanceCount}
          badgeColor="#f59e0b"
        />
      </div>
    </div>

    {activeTab === "overview" && (
      <div className={styles.dashboardOverview}>
        <KeyMetrics
          equipmentCount={assignedEquipment.length}
          clearanceCount={clearanceRequests.length}
          pendingClearances={pendingClearanceCount}
          employee={employee}
          onTabChange={setActiveTab}
        />

        <div className={styles.overviewGrid}>
          <ProfileCard employee={employee} formatDate={formatDate} />
        </div>
      </div>
    )}

    {activeTab === "equipment" && (
      <div className={styles.tabSection}>
        <div className={styles.sectionHeader}>
          <h2>
            <i className="fas fa-laptop"></i> Assigned Equipment
          </h2>
          <span className={styles.countBadge}>
            {assignedEquipment.length} items
          </span>
        </div>
        <EquipmentTable
          equipment={assignedEquipment}
          formatDate={formatDate}
          getStatusColor={getStatusColor}
          showBarcode={showBarcode}
          downloadBarcode={downloadBarcode}
        />
      </div>
    )}

    {activeTab === "clearance" && (
      <div className={styles.tabSection}>
        <div className={styles.sectionHeader}>
          <h2>
            <i className="fas fa-file-contract"></i> Clearance Requests
          </h2>
          <div className={styles.headerActions}>
            <span className={styles.countBadge}>
              {clearanceRequests.length} total
            </span>
            <button
              onClick={refreshClearanceData}
              className={styles.refreshSmallButton}
              title="Refresh Clearance"
              disabled={clearanceLoading}
            >
              <i
                className={`fas fa-sync-alt ${
                  clearanceLoading ? styles.spinning : ""
                }`}
              ></i>
            </button>
          </div>
        </div>

        {clearanceLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinnerSmall}></div>
            <p>Loading clearance requests...</p>
          </div>
        ) : (
          <ClearanceTable
            clearances={clearanceRequests}
            getStatusColor={getStatusColor}
            viewClearanceDetails={viewClearanceDetails}
            downloadClearanceDocument={downloadClearanceDocument}
            pendingClearanceCount={pendingClearanceCount}
          />
        )}
      </div>
    )}
  </div>
);

const TabButton = ({ icon, label, isActive, onClick, badge, badgeColor }) => (
  <button
    className={`${styles.tabButton} ${isActive ? styles.active : ""}`}
    onClick={onClick}
  >
    <i className={icon}></i>
    <span>{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className={styles.tabBadge} style={{ backgroundColor: badgeColor }}>
        {badge}
      </span>
    )}
  </button>
);

// Equipment Table Component
const EquipmentTable = ({
  equipment,
  formatDate,
  getStatusColor,
  showBarcode,
  downloadBarcode,
}) => (
  <div className={styles.tableContainer}>
    <table className={styles.modernTable}>
      <thead>
        <tr>
          <th>Equipment Name</th>
          <th>Barcode</th>
          <th>Category</th>
          <th>Purchase Date</th>
          <th>Last Checked</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {equipment.map((item, index) => (
          <tr key={index}>
            <td>
              <div className={styles.itemWithIcon}>
                <i className="fas fa-laptop"></i>
                {item.item_name || item.itemName || "-"}
              </div>
            </td>
            <td>
              <div className={styles.barcodeCell}>
                <span className={styles.barcodeText}>
                  {item.item_code || item.itemCode || "-"}
                </span>
              </div>
            </td>
            <td>
              <span className={styles.categoryTag}>{item.category || "-"}</span>
            </td>
            <td>{formatDate(item.purchase_date || item.purchaseDate)}</td>
            <td>{formatDate(item.last_checked || item.lastChecked)}</td>
            <td>
              <span
                className={styles.statusBadge}
                style={{
                  backgroundColor: getStatusColor(item.status),
                  color: "white",
                }}
              >
                {item.status || "-"}
              </span>
            </td>
          </tr>
        ))}
        {equipment.length === 0 && (
          <tr>
            <td colSpan="7" className={styles.noData}>
              <div className={styles.emptyState}>
                <i className="fas fa-laptop"></i>
                <h4>No Equipment Assigned</h4>
                <p>You don't have any equipment assigned to you.</p>
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

// Clearance Table Component
const ClearanceTable = ({
  clearances,
  getStatusColor,
  viewClearanceDetails,
  downloadClearanceDocument,
  pendingClearanceCount,
}) => (
  <>
    <div className={styles.tableContainer}>
      <table className={styles.modernTable}>
        <thead>
          <tr>
            <th>Request Date</th>
            <th>Clearance Type</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {clearances.map((clearance, index) => (
            <tr key={clearance.id || index}>
              <td>
                <div className={styles.dateCell}>
                  <div className={styles.dateText}>{clearance.date}</div>
                  {clearance.created_at && (
                    <div className={styles.timeText}>
                      {new Date(clearance.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </td>
              <td>
                <div className={styles.typeCell}>
                  <div
                    className={`${styles.typeBadge} ${
                      styles[
                        "type-" + (clearance.type?.toLowerCase() || "other")
                      ]
                    }`}
                  >
                    <i className="fas fa-file-alt"></i>
                    {clearance.type || "Unknown"}
                  </div>
                  {clearance.reason && (
                    <div className={styles.reasonText}>
                      {clearance.reason.length > 50
                        ? clearance.reason.substring(0, 50) + "..."
                        : clearance.reason}
                    </div>
                  )}
                </div>
              </td>
              <td>
                <div className={styles.statusCell}>
                  <span
                    className={styles.statusBadge}
                    style={{
                      backgroundColor: getStatusColor(clearance.status),
                      color: "white",
                    }}
                  >
                    {clearance.status || "Unknown"}
                  </span>
                  {clearance.approved_by && (
                    <div className={styles.approvedBy}>
                      <small>
                        <i className="fas fa-user-check"></i>
                        {clearance.approved_by}
                      </small>
                    </div>
                  )}
                </div>
              </td>
              <td>
                <div className={styles.actionButtons}>
                  <button
                    className={styles.actionIcon}
                    onClick={() => viewClearanceDetails(clearance)}
                    title="View Details"
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                  <button
                    className={styles.actionIcon}
                    onClick={() => downloadClearanceDocument(clearance)}
                    title="Download Document"
                  >
                    <i className="fas fa-download"></i>
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {clearances.length === 0 && (
            <tr>
              <td colSpan="4" className={styles.noData}>
                <div className={styles.emptyState}>
                  <i className="fas fa-file-alt"></i>
                  <h4>No Clearance Requests</h4>
                  <p>You haven't submitted any clearance requests yet.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {clearances.length > 0 && (
      <div className={styles.infoPanel}>
        <div className={styles.infoItem}>
          <i className="fas fa-info-circle"></i>
          <span>
            <strong>Pending:</strong> {pendingClearanceCount} requests
          </span>
        </div>
        <div className={styles.infoItem}>
          <i className="fas fa-info-circle"></i>
          <span>
            <strong>Completed:</strong>{" "}
            {clearances.filter((c) => c.status === "Completed").length} requests
          </span>
        </div>
        <div className={styles.infoItem}>
          <i className="fas fa-info-circle"></i>
          <span>
            <strong>Latest Request:</strong>{" "}
            {clearances.length > 0 ? clearances[0].date : "None"}
          </span>
        </div>
        <div className={styles.infoItem}>
          <i className="fas fa-database"></i>
          <span>
            <strong>Data Source:</strong> Supabase (Real-time)
          </span>
        </div>
      </div>
    )}
  </>
);

// Main EmployeeDashboard Component
const EmployeeDashboard = () => {
  const { user } = useAuth();
  const location = useLocation(); // Get current location
  const [employee, setEmployee] = useState(null);
  const [assignedEquipment, setAssignedEquipment] = useState([]);
  const [clearanceRequests, setClearanceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const { isSidebarCollapsed } = useSidebar();
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [selectedBarcode, setSelectedBarcode] = useState(null);
  const [clearanceLoading, setClearanceLoading] = useState(false);

  // Formatting utilities
  const formatDate = useCallback((dateString) => {
    if (!dateString || dateString.trim() === "") return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      console.warn("Date formatting error:", error);
      return dateString;
    }
  }, []);

  const formatDateTime = useCallback((dateString) => {
    if (!dateString || dateString.trim() === "") return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.warn("Date formatting error:", error);
      return dateString;
    }
  }, []);

  const getStatusColor = useCallback((status) => {
    const statusLower = (status || "").toLowerCase();
    switch (statusLower) {
      case "approved":
      case "completed":
      case "active":
      case "good":
        return "#10b981";
      case "pending":
      case "in progress":
      case "needs maintenance":
        return "#f59e0b";
      case "rejected":
      case "cancelled":
      case "inactive":
      case "damaged":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  }, []);

  // Data loading functions
  const loadEmployeeData = useCallback(async () => {
    if (!user || user.role !== "employee") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: employeeData, error } = await supabase
        .from("personnel")
        .select("*")
        .eq("username", user.username)
        .single();

      if (error || !employeeData) {
        console.error("Error loading employee:", error);
        setEmployee(null);
        setAssignedEquipment([]);
        setClearanceRequests([]);
        return;
      }

      setEmployee(employeeData);

      // Load data in parallel
      await Promise.all([
        loadAssignedEquipment(employeeData),
        loadClearanceRequests(employeeData),
      ]);
    } catch (error) {
      console.error("Error loading employee data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadAssignedEquipment = useCallback(async (emp) => {
    try {
      const { data: inventoryData, error } = await supabase
        .from("inventory")
        .select("*");

      if (error || !inventoryData) {
        console.error("Error loading equipment:", error);
        setAssignedEquipment([]);
        return;
      }

      const fullName = `${emp.first_name} ${emp.last_name}`
        .toLowerCase()
        .trim();

      const assignedItems = inventoryData.filter((item) => {
        if (!item.assigned_to) return false;
        const assignedToName = item.assigned_to.toLowerCase().trim();
        return (
          assignedToName.includes(fullName) ||
          assignedToName.includes(emp.first_name.toLowerCase()) ||
          assignedToName.includes(emp.last_name.toLowerCase())
        );
      });

      setAssignedEquipment(assignedItems);
    } catch (error) {
      console.error("Error loading equipment:", error);
      setAssignedEquipment([]);
    }
  }, []);

  const loadClearanceRequests = useCallback(
    async (emp) => {
      try {
        setClearanceLoading(true);

        const { data: clearanceData, error } = await supabase
          .from("clearance_requests")
          .select(
            `
          *,
          personnel:personnel_id (
            first_name,
            middle_name,
            last_name
          )
        `
          )
          .eq("personnel_id", emp.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading clearance:", error);
          setClearanceRequests([]);
          return;
        }

        const formattedClearances = (clearanceData || []).map((clearance) => ({
          id: clearance.id,
          type: clearance.type,
          status: clearance.status,
          date: clearance.created_at ? formatDate(clearance.created_at) : "",
          reason: clearance.reason,
          remarks: clearance.remarks,
          approved_by: clearance.approved_by,
          approved_at: clearance.approved_at,
          created_at: clearance.created_at,
          employee_name: clearance.personnel
            ? `${clearance.personnel.first_name || ""} ${
                clearance.personnel.middle_name || ""
              } ${clearance.personnel.last_name || ""}`
                .replace(/\s+/g, " ")
                .trim()
            : "Unknown",
        }));

        setClearanceRequests(formattedClearances);
      } catch (error) {
        console.error("Error loading clearance:", error);
        setClearanceRequests([]);
      } finally {
        setClearanceLoading(false);
      }
    },
    [formatDate]
  );

  // Barcode functions
  const generateBarcodeImage = useCallback((itemCode, itemName) => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 80;

        jsbarcode(canvas, itemCode, {
          format: "CODE128",
          displayValue: true,
          fontSize: 12,
          textMargin: 5,
          margin: 5,
          width: 1.5,
          height: 40,
        });

        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        console.error("Error generating barcode:", error);
        reject(error);
      }
    });
  }, []);

  const downloadBarcode = useCallback(
    async (itemCode, itemName) => {
      try {
        const barcodeImage = await generateBarcodeImage(itemCode, itemName);

        if (barcodeImage) {
          const link = document.createElement("a");
          link.href = barcodeImage;
          link.download = `Barcode_${itemCode}_${itemName.replace(
            /[^a-z0-9]/gi,
            "_"
          )}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (error) {
        console.error("Error downloading barcode:", error);
        alert("Error downloading barcode");
      }
    },
    [generateBarcodeImage]
  );

  const showBarcode = useCallback((itemCode, itemName) => {
    setSelectedBarcode({ code: itemCode, name: itemName });
    setShowBarcodeModal(true);
  }, []);

  // Event handlers
  const viewClearanceDetails = useCallback(
    (clearance) => {
      const details = `
      Clearance ID: ${clearance.id}
      Type: ${clearance.type}
      Status: ${clearance.status}
      Request Date: ${clearance.date}
      ${clearance.reason ? `Reason: ${clearance.reason}\n` : ""}
      ${clearance.remarks ? `Remarks: ${clearance.remarks}\n` : ""}
      ${clearance.approved_by ? `Approved By: ${clearance.approved_by}\n` : ""}
      ${
        clearance.approved_at
          ? `Approved At: ${formatDateTime(clearance.approved_at)}\n`
          : ""
      }
    `;

      alert("Clearance Details:\n\n" + details);
    },
    [formatDateTime]
  );

  const downloadClearanceDocument = useCallback((clearance) => {
    alert(
      `Downloading clearance document for ${clearance.type} (ID: ${clearance.id})\n\nThis feature will generate a PDF document.`
    );
  }, []);

  const refreshClearanceData = useCallback(async () => {
    if (employee) {
      setClearanceLoading(true);
      await loadClearanceRequests(employee);
    }
  }, [employee, loadClearanceRequests]);

  // Effects
  useEffect(() => {
    loadEmployeeData();
  }, [loadEmployeeData]);

  useEffect(() => {
    if (!employee?.id) return;

    const subscription = supabase
      .channel(`clearance-${employee.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clearance_requests",
          filter: `personnel_id=eq.${employee.id}`,
        },
        () => {
          loadClearanceRequests(employee);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [employee?.id, loadClearanceRequests, employee]);

  // Memoized values for performance
  const pendingClearanceCount = useMemo(
    () => clearanceRequests.filter((c) => c.status === "Pending").length,
    [clearanceRequests]
  );

  const recentEquipment = useMemo(
    () => assignedEquipment.slice(0, 6),
    [assignedEquipment]
  );

  const recentClearances = useMemo(
    () => clearanceRequests.slice(0, 5),
    [clearanceRequests]
  );

  // Render BFPPreloader when loading
  if (loading) {
    return <BFPPreloader loading={loading} />;
  }

  if (!user)
    return (
      <div className={styles.modernLoading}>
        Please log in to access the dashboard.
      </div>
    );
  if (!employee) return <ErrorState onRetry={loadEmployeeData} />;

  return (
    <div className="app">
      <Title>Employee Dashboard | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <EmployeeSidebar />
      <Hamburger />

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <WelcomeHeader employee={employee} onRefresh={loadEmployeeData} />

        <div className={styles.dashboardContainer}>
          <MainContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            employee={employee}
            assignedEquipment={assignedEquipment}
            recentEquipment={recentEquipment}
            clearanceRequests={clearanceRequests}
            recentClearances={recentClearances}
            clearanceLoading={clearanceLoading}
            getStatusColor={getStatusColor}
            formatDate={formatDate}
            showBarcode={showBarcode}
            downloadBarcode={downloadBarcode}
            viewClearanceDetails={viewClearanceDetails}
            downloadClearanceDocument={downloadClearanceDocument}
            refreshClearanceData={refreshClearanceData}
            pendingClearanceCount={pendingClearanceCount}
            onRefresh={loadEmployeeData}
          />
        </div>
      </div>

      <BarcodeModal
        show={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
        selectedBarcode={selectedBarcode}
        onDownload={downloadBarcode}
      />
    </div>
  );
};

export default EmployeeDashboard;
