// Complete code with all sections properly filled in
import React, { useState, useEffect, useRef } from "react";

import styles from "../styles/PersonnelRecentActivity.module.css";
import { supabase } from "../../../lib/supabaseClient.js";
import { useAuth } from "../../AuthContext.jsx";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FloatingNotificationBell from "../../FloatingNotificationBell.jsx";
import { useUserId } from "../../hooks/useUserId.js";
const PersonnelRecentActivity = () => {
  const [recentActivities, setRecentActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [paginatedActivities, setPaginatedActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activityFilter, setActivityFilter] = useState("all");
const { userId, isAuthenticated, userRole } = useUserId();
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [activitiesPerPage, setActivitiesPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const { user } = useAuth();
  const { isSidebarCollapsed } = useSidebar();

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
    if (!rank) return null;
    const rankOption = rankOptions.find((r) => r.rank === rank);
    return rankOption ? rankOption.image : null;
  };

  // ========== ACTIVITY EXPIRATION FUNCTION ==========
  const filterExpiredActivities = (activities) => {
    if (!activities || !Array.isArray(activities)) return [];

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return activities.filter((activity) => {
      if (!activity.timestamp) return false;
      try {
        const activityDate = new Date(activity.timestamp);
        return activityDate >= oneMonthAgo;
      } catch (err) {
        console.error("Error parsing activity date:", err);
        return false;
      }
    });
  };

  // ========== PAGINATION FUNCTIONS ==========
  const updatePagination = (activities) => {
    if (!activities || !Array.isArray(activities)) {
      setPaginatedActivities([]);
      setTotalPages(1);
      return;
    }

    const total = Math.ceil(activities.length / activitiesPerPage);
    setTotalPages(total > 0 ? total : 1);

    if (currentPage > total) {
      setCurrentPage(total > 0 ? total : 1);
    }

    const startIndex = (currentPage - 1) * activitiesPerPage;
    const endIndex = startIndex + activitiesPerPage;
    const pageActivities = activities.slice(startIndex, endIndex);

    setPaginatedActivities(pageActivities);
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
  };

  const renderPaginationButtons = () => {
    if (totalPages <= 1) return null;

    const buttons = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    buttons.push(
      <button
        key="prev"
        className={`${styles.paginationBtn} ${
          currentPage === 1 ? styles.disabled : ""
        }`}
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </button>
    );

    // First page button
    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          className={`${styles.paginationBtn} ${
            1 === currentPage ? styles.active : ""
          }`}
          onClick={() => handlePageChange(1)}
        >
          1
        </button>
      );

      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis1" className={styles.paginationEllipsis}>
            ...
          </span>
        );
      }
    }

    // Page number buttons
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          className={`${styles.paginationBtn} ${
            i === currentPage ? styles.active : ""
          }`}
          onClick={() => handlePageChange(i)}
        >
          {i}
        </button>
      );
    }

    // Last page button
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(
          <span key="ellipsis2" className={styles.paginationEllipsis}>
            ...
          </span>
        );
      }

      buttons.push(
        <button
          key={totalPages}
          className={`${styles.paginationBtn} ${
            totalPages === currentPage ? styles.active : ""
          }`}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </button>
      );
    }

    // Next button
    buttons.push(
      <button
        key="next"
        className={`${styles.paginationBtn} ${
          currentPage === totalPages ? styles.disabled : ""
        }`}
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    );

    return (
      <div className={styles.paginationContainer}>
        <div className={styles.paginationInfo}>
          Showing {paginatedActivities.length} of {filteredActivities.length}{" "}
          activities
          {filteredActivities.length !== recentActivities.length &&
            ` (${
              recentActivities.length - filteredActivities.length
            } older than 1 month hidden)`}
        </div>
        <div className={styles.paginationButtons}>{buttons}</div>
        <div className={styles.itemsPerPageSelector}>
          <label>Items per page: </label>
          <select
            value={activitiesPerPage}
            onChange={(e) => {
              setActivitiesPerPage(parseInt(e.target.value));
              setCurrentPage(1);
            }}
            className={styles.itemsPerPageSelect}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>
    );
  };

  // ========== ACTIVITY FILTERING ==========
  useEffect(() => {
    if (!recentActivities || !Array.isArray(recentActivities)) {
      setFilteredActivities([]);
      return;
    }

    const nonExpiredActivities = filterExpiredActivities(recentActivities);

    const filtered = nonExpiredActivities.filter((activity) => {
      if (activityFilter === "all") return true;
      if (activityFilter === "leave")
        return activity.activityType === "leave_request";
      if (activityFilter === "clearance")
        return activity.activityType === "clearance_request";
      if (activityFilter === "admin_actions")
        return activity.activityType === "admin_action";
      if (activityFilter === "inventory")
        return activity.details?.requestType === "inventory";
      if (activityFilter === "equipment")
        return activity.details?.requestType === "equipment";
      if (activityFilter === "recruitment")
        return activity.details?.requestType === "recruitment";
      return false;
    });

    setFilteredActivities(filtered);
    setCurrentPage(1);
  }, [recentActivities, activityFilter]);

  useEffect(() => {
    updatePagination(filteredActivities);
  }, [filteredActivities, currentPage, activitiesPerPage]);

  // Helper function to format names properly
  const formatName = (name) => {
    if (!name || typeof name !== "string") return name || "Unknown";
    if (name.toLowerCase() === "admin") return "Admin";
    if (name.toLowerCase() === "inspector") return "Inspector";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Format leave type for display
  const formatLeaveType = (leaveType) => {
    if (!leaveType) return "Leave";
    const typeMap = {
      vacation: "Vacation",
      sick: "Sick",
      emergency: "Emergency",
      maternity: "Maternity",
      paternity: "Paternity",
      study: "Study",
      bereavement: "Bereavement",
      special: "Special",
    };
    return typeMap[leaveType.toLowerCase()] || leaveType;
  };

  // Format clearance type for display
  const formatClearanceType = (clearanceType) => {
    if (!clearanceType) return "Clearance";
    const typeMap = {
      resignation: "Resignation",
      retirement: "Retirement",
      "equipment completion": "Equipment Completion",
      transfer: "Transfer",
      promotion: "Promotion",
      administrative: "Administrative",
      others: "Others",
    };
    return typeMap[clearanceType.toLowerCase()] || clearanceType;
  };

  // Get admin user details by username or ID
  const getAdminDetails = async (adminIdentifier) => {
    try {
      if (!adminIdentifier) return null;
      let query = supabase.from("admin_users").select(`
          id,
          username,
          role,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            rank,
            station
          )
        `);
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(adminIdentifier)) {
        const { data: personnelData, error: personnelError } = await supabase
          .from("personnel")
          .select("id")
          .eq("id", adminIdentifier)
          .single();
        if (!personnelError && personnelData) {
          query = query.eq("personnel_id", personnelData.id);
        } else {
          query = query.eq("username", adminIdentifier);
        }
      } else {
        query = query.eq("username", adminIdentifier);
      }
      const { data: adminData, error: adminError } = await query
        .limit(1)
        .single();
      if (!adminError && adminData) {
        const personnel = adminData.personnel || {};
        const adminName =
          personnel.first_name && personnel.last_name
            ? `${personnel.first_name} ${personnel.last_name}`
            : adminData.username;
        return {
          adminId: adminData.id,
          username: adminData.username,
          role: adminData.role,
          personnelId: personnel.id,
          name: formatName(adminName),
          fullName:
            `${personnel.first_name || ""} ${
              personnel.last_name || ""
            }`.trim() || adminData.username,
          rank: personnel.rank,
          station: personnel.station,
        };
      }
      return null;
    } catch (err) {
      console.error("Error getting admin details:", err);
      return null;
    }
  };

  // Format description for different activity types
  const formatDescription = (activity) => {
    switch (activity.activityType) {
      case "leave_request":
        return `${formatLeaveType(activity.details.leaveType)} Leave Request`;
      case "clearance_request":
        return `${formatClearanceType(
          activity.details.clearanceType
        )} Clearance Request`;
      case "admin_action":
        if (activity.details.requestType === "leave") {
          const actionText =
            activity.details.action === "approved" ? "Approved" : "Rejected";
          const leaveType = formatLeaveType(activity.details.leaveType);
          return `${actionText} ${activity.details.employeeName}'s ${leaveType} Leave`;
        } else if (activity.details.requestType === "clearance") {
          const actionText =
            activity.details.action === "approved" ? "Approved" : "Rejected";
          const clearanceType = formatClearanceType(
            activity.details.clearanceType
          );
          return `${actionText} ${activity.details.employeeName}'s ${clearanceType} Clearance`;
        } else if (activity.details.requestType === "inventory") {
          const actionText =
            activity.details.action === "added"
              ? "Added"
              : activity.details.action === "deleted"
              ? "Deleted"
              : "Updated";
          return `${actionText} Inventory Item: ${activity.details.itemName}`;
        } else if (activity.details.requestType === "recruitment") {
          return `${
            activity.details.action === "hired" ? "Hired" : "Rejected"
          } Applicant: ${activity.details.applicantName}`;
        }
        return activity.description;
      case "inventory":
        return `Inventory: ${activity.details.itemName}`;
      case "recruitment":
        return `Recruitment: ${activity.details.applicantName}`;
      default:
        return activity.description;
    }
  };

  // Format status for display
  const formatStatus = (activity) => {
    if (activity.activityType === "admin_action") {
      return activity.details.action === "approved"
        ? "Approved"
        : activity.details.action === "deleted"
        ? "Deleted"
        : activity.details.action === "added"
        ? "Added"
        : "Updated";
    }
    return activity.status || "Pending";
  };

  // Check if user is admin
  const checkAdminStatus = () => {
    if (!user) return false;
    const adminCheck =
      user.username === "admin" ||
      user.username === "inspector" ||
      user.role === "admin" ||
      (user.personnelData && user.personnelData.is_admin === true) ||
      localStorage.getItem("isAdmin") === "true";
    setIsAdmin(adminCheck);
    return adminCheck;
  };

  // Get admin details for leave approval/rejection
  const getLeaveAdminDetails = async (request) => {
    let adminDetails = null;
    if (request.approved_by_id) {
      adminDetails = await getAdminDetails(request.approved_by_id);
      if (!adminDetails) {
        adminDetails = {
          username: request.approved_by,
          name: formatName(request.approved_by),
          role: "Admin",
        };
      }
    } else if (request.rejected_by_id) {
      adminDetails = await getAdminDetails(request.rejected_by_id);
      if (!adminDetails) {
        adminDetails = {
          username: request.rejected_by,
          name: formatName(request.rejected_by),
          role: "Admin",
        };
      }
    } else if (request.recommended_by_id) {
      adminDetails = await getAdminDetails(request.recommended_by_id);
      if (!adminDetails && request.recommended_by) {
        adminDetails = {
          username: request.recommended_by,
          name: formatName(request.recommended_by),
          role: "Admin",
        };
      }
    }
    return adminDetails;
  };

  // Get admin details for clearance approval
  const getClearanceAdminDetails = async (request) => {
    let adminDetails = null;
    if (request.approved_by_id) {
      adminDetails = await getAdminDetails(request.approved_by_id);
      if (!adminDetails && request.approved_by) {
        adminDetails = {
          username: request.approved_by,
          name: formatName(request.approved_by),
          role: "Admin",
        };
      }
    } else if (request.initiated_by_id) {
      adminDetails = await getAdminDetails(request.initiated_by_id);
      if (!adminDetails && request.initiated_by) {
        adminDetails = {
          username: request.initiated_by,
          name: formatName(request.initiated_by),
          role: "Admin",
        };
      }
    }
    return adminDetails;
  };

  // Update the fetchInventoryActivity function to get rank properly
  const fetchInventoryActivity = async () => {
    try {
      const inventoryActivities = [];

      // Fetch inventory audit logs
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const { data: inventoryAuditLogs, error: auditError } = await supabase
        .from("inventory_audit")
        .select(
          `
        *,
        admin:performed_by (
          id,
          username,
          role,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            rank,
            station
          )
        )
      `
        )
        .gte("performed_at", twoMonthsAgo.toISOString())
        .order("performed_at", { ascending: false })
        .limit(15);

      if (!auditError && inventoryAuditLogs) {
        console.log("Inventory audit logs fetched:", inventoryAuditLogs.length);

        for (const audit of inventoryAuditLogs) {
          let adminDetails = null;

          // DEBUG: Log what we're getting
          console.log("Audit item:", {
            id: audit.id,
            item_name: audit.item_name,
            performed_by: audit.performed_by,
            admin: audit.admin,
          });

          // Get admin details if available
          if (audit.admin) {
            const personnel = audit.admin.personnel || {};
            console.log("Personnel data:", personnel);

            adminDetails = {
              adminId: audit.admin.id,
              username: audit.admin.username,
              role: audit.admin.role,
              name:
                personnel.first_name && personnel.last_name
                  ? formatName(`${personnel.first_name} ${personnel.last_name}`)
                  : formatName(audit.admin.username),
              rank: personnel.rank,
              fullName:
                personnel.first_name && personnel.last_name
                  ? `${personnel.first_name} ${personnel.last_name}`
                  : audit.admin.username,
            };

            console.log("Admin details extracted:", adminDetails);
          } else if (audit.performed_by_username) {
            adminDetails = {
              username: audit.performed_by_username,
              name: formatName(audit.performed_by_username),
              role: "Admin",
            };
          }

          // Extract item data
          const itemData = audit.old_data || audit.new_data || {};
          const itemName =
            audit.item_name || itemData.item_name || "Unknown Item";
          const itemCode = audit.item_code || itemData.item_code || "N/A";
          const category = itemData.category || "N/A";
          const serialNumber = itemData.serial_number;
          const price = itemData.price;

          // Create activity with rank info
          const activity = {
            id: `inventory-${audit.id}`,
            type: "Inventory",
            activityType: "admin_action",
            description: `${
              audit.action.charAt(0).toUpperCase() + audit.action.slice(1)
            } Inventory Item: ${itemName}`,
            status:
              audit.action.charAt(0).toUpperCase() + audit.action.slice(1),
            timestamp: audit.performed_at || audit.created_at,
            date: audit.performed_at || audit.created_at,
            details: {
              action: audit.action,
              requestType: "inventory",
              itemId: audit.item_id,
              itemName: itemName,
              itemCode: itemCode,
              category: category,
              serialNumber: serialNumber,
              price: price,
              adminName: adminDetails?.name || "Admin",
              adminUsername: adminDetails?.username,
              adminId: adminDetails?.adminId,
              adminRole: adminDetails?.role,
              adminRank: adminDetails?.rank, // This should have the rank
              oldData: audit.old_data,
              newData: audit.new_data,
            },
            actionBy: adminDetails?.name || "Admin",
            actionType: audit.action,
            adminId: adminDetails?.adminId,
            adminRank: adminDetails?.rank, // Store rank at activity level too
          };

          console.log(
            "Created activity with rank:",
            activity.details.adminRank
          );
          inventoryActivities.push(activity);
        }
      } else if (auditError) {
        console.error("Error fetching inventory audit:", auditError);
      }

      return inventoryActivities;
    } catch (err) {
      console.error("Error fetching inventory activity:", err);
      return [];
    }
  };

  // Fetch equipment activity (admin actions)
  const fetchEquipmentActivity = async () => {
    try {
      const { data: equipmentData, error: equipmentError } = await supabase
        .from("equipment_items")
        .select(
          `
          *,
          personnel:added_by (
            id,
            first_name,
            last_name,
            username,
            rank
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(10);
      if (!equipmentError && equipmentData) {
        const equipmentActivities = [];
        for (const equipment of equipmentData) {
          const personnel = equipment.personnel || {};
          let adminDetails = null;
          if (personnel.id) {
            adminDetails = await getAdminDetails(personnel.id);
          }
          const adminName = adminDetails
            ? adminDetails.name
            : formatName(
                personnel.username ||
                  `${personnel.first_name || ""} ${
                    personnel.last_name || ""
                  }`.trim() ||
                  "Admin"
              );
          const adminId = adminDetails ? adminDetails.adminId : null;
          equipmentActivities.push({
            id: `equipment-${equipment.id}`,
            type: "Equipment",
            activityType: "admin_action",
            description: `Added Equipment: ${
              equipment.name || equipment.equipment_name || "Unknown"
            }`,
            status: "Completed",
            timestamp: equipment.created_at,
            date: equipment.created_at,
            details: {
              action: "added",
              requestType: "equipment",
              equipmentId: equipment.id,
              equipmentName: equipment.name || equipment.equipment_name,
              serialNumber: equipment.serial_number,
              category: equipment.category,
              condition: equipment.condition,
              adminName: adminName,
              adminUsername: adminDetails?.username,
              adminId: adminId,
              adminRole: adminDetails?.role,
              adminRank: adminDetails?.rank,
            },
            actionBy: adminName,
            actionType: "added",
            adminId: adminId,
          });
        }
        return equipmentActivities;
      }
      return [];
    } catch (err) {
      console.error("Error fetching equipment activity:", err);
      return [];
    }
  };

  // Fetch ALL recent activities (prioritizing clearance and leave requests)
  const fetchAllRecentActivities = async () => {
    try {
      setLoading(true);
      setError("");

      if (!user) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      // Check admin status
      const userIsAdmin = checkAdminStatus();

      // Calculate date range: last 2 months (to be safe)
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const twoMonthsAgoISO = twoMonthsAgo.toISOString();

      // We'll fetch multiple types of activities
      const activities = [];

      // 1. Fetch leave requests (for personnel or all for admin)
      let leaveQuery = supabase
        .from("leave_requests")
        .select(
          `
          *,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            username,
            rank,
            station
          )
        `
        )
        .gte("created_at", twoMonthsAgoISO)
        .order("created_at", { ascending: false })
        .limit(100);

      // If not admin, filter by user's personnel record
      if (!userIsAdmin) {
        const { data: personnelData, error: personnelError } = await supabase
          .from("personnel")
          .select("id")
          .eq("username", user.username)
          .single();

        if (!personnelError && personnelData) {
          leaveQuery = leaveQuery.eq("personnel_id", personnelData.id);
        }
      }

      const { data: leaveRequests, error: leaveError } = await leaveQuery;

      if (!leaveError && leaveRequests) {
        for (const request of leaveRequests) {
          const personnel = request.personnel || {};

          // Get raw employee name from various sources
          const rawEmployeeName =
            request.employee_name ||
            `${personnel.first_name || ""} ${
              personnel.last_name || ""
            }`.trim() ||
            personnel.username ||
            "Unknown Employee";

          // Format the employee name properly
          const employeeName = formatName(rawEmployeeName);

          // Format leave type
          const formattedLeaveType = formatLeaveType(request.leave_type);
    let personnelRank = personnel.rank;
    if (!personnelRank && request.personnel_id) {
      personnelRank = await getPersonnelRank(request.personnel_id);
    }
          // Create activity entry for the leave request submission
          activities.push({
            id: `leave-${request.id}`,
            type: "Leave Request",
            activityType: "leave_request",
            description: `${formattedLeaveType} Leave Request`,
            status: request.status || "Pending",
            timestamp:
              request.created_at ||
              request.submitted_at ||
              request.date_of_filing,
            date:
              request.created_at ||
              request.submitted_at ||
              request.date_of_filing,
            startDate: request.start_date,
            endDate: request.end_date,
            numDays: request.num_days || request.working_days || 0,
            personnelId: request.personnel_id,
            details: {
              leaveType: request.leave_type,
              formattedLeaveType: formattedLeaveType,
              location: request.location,
              reason: request.reason,
              status: request.status,
              recommendedBy: request.recommended_by,
              approvedBy: request.approved_by,
              rejectedBy: request.rejected_by,
              employeeName: employeeName,
              personnelName: employeeName,
              personnelRank: personnel.rank,
              personnelStation: personnel.station,
              personnelUsername: personnel.username,
              isPersonnelAdmin: personnel.is_admin || false,
            },
            actionBy: employeeName,
            actionType: "submitted",
          });

          // If request was approved/rejected, create another activity entry
          if (
            request.approved_by ||
            request.rejected_by ||
            request.recommended_by
          ) {
            const actionType = request.approved_by
              ? "approved"
              : request.rejected_by
              ? "rejected"
              : "recommended";
            const rawActionBy =
              request.approved_by ||
              request.rejected_by ||
              request.recommended_by;
            const actionTime =
              request.approved_at ||
              request.rejected_at ||
              request.recommended_at ||
              request.updated_at;

            // Get admin details
            const adminDetails = await getLeaveAdminDetails(request);

            // Format the actionBy to show proper capitalization
            const actionBy = adminDetails
              ? adminDetails.name
              : formatName(rawActionBy);

            // Format description for admin action
            const actionText =
              actionType === "approved"
                ? "Approved"
                : actionType === "rejected"
                ? "Rejected"
                : "Recommended";
            const description = `${actionText} ${employeeName}'s ${formattedLeaveType} Leave`;

            activities.push({
              id: `leave-action-${request.id}`,
              type: "Admin Action",
              activityType: "admin_action",
              description: description,
              status: actionText,
              timestamp: actionTime,
              date: actionTime,
              details: {
                action: actionType,
                actionBy: actionBy,
                requestType: "leave",
                leaveType: request.leave_type,
                formattedLeaveType: formattedLeaveType,
                employeeName: employeeName,
                reason: request.reason,
                remarks:
                  request.approval_remarks ||
                  request.rejection_reason ||
                  request.recommended_remarks,
                adminUsername: adminDetails?.username,
                adminId: adminDetails?.adminId,
                adminRole: adminDetails?.role,
                adminRank: adminDetails?.rank,
              },
              actionBy: actionBy,
              actionType: actionType,
              adminId: adminDetails?.adminId,
              relatedRequestId: request.id,
            });
          }
        }
      }

      // 2. Fetch clearance requests (only for admin or personnel's own)
      let clearanceQuery = supabase
        .from("clearance_requests")
        .select(
          `
          *,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            username,
            rank,
            station
          )
        `
        )
        .gte("created_at", twoMonthsAgoISO)
        .order("created_at", { ascending: false })
        .limit(100);

      // If not admin, filter by user's personnel record
      if (!userIsAdmin) {
        const { data: personnelData, error: personnelError } = await supabase
          .from("personnel")
          .select("id")
          .eq("username", user.username)
          .single();

        if (!personnelError && personnelData) {
          clearanceQuery = clearanceQuery.eq("personnel_id", personnelData.id);
        }
      }

      const { data: clearanceRequests, error: clearanceError } =
        await clearanceQuery;

      if (!clearanceError && clearanceRequests) {
        for (const request of clearanceRequests) {
          const personnel = request.personnel || {};

          // Get raw employee name
          const rawEmployeeName =
            `${personnel.first_name || ""} ${
              personnel.last_name || ""
            }`.trim() ||
            personnel.username ||
            "Unknown Employee";

          const employeeName = formatName(rawEmployeeName);
          const formattedClearanceType = formatClearanceType(request.type);
    let personnelRank = personnel.rank;
    if (!personnelRank && request.personnel_id) {
      personnelRank = await getPersonnelRank(request.personnel_id);
    }
          // Create activity entry for clearance request
          activities.push({
            id: `clearance-${request.id}`,
            type: "Clearance Request",
            activityType: "clearance_request",
            description: `${formattedClearanceType} Clearance Request`,
            status: request.status || "Pending",
            timestamp: request.created_at,
            date: request.created_at,
            effectiveDate: request.effective_date,
            expectedCompletionDate: request.expected_completion_date,
            details: {
              clearanceType: request.type,
              formattedClearanceType: formattedClearanceType,
              reason: request.reason,
              status: request.status,
              personnelRank: personnelRank,
              approvedBy: request.approved_by,
              rejectionReason: request.rejection_reason,
              currentDepartment: request.current_department,
              employeeName: employeeName,
              missingAmount: request.missing_amount,
            },
            actionBy: employeeName,
            actionType: "submitted",
          });

          // If clearance was approved/rejected, create admin action entry
          if (
            request.approved_by ||
            request.rejected_by ||
            request.initiated_by
          ) {
            const actionType = request.approved_by
              ? "approved"
              : request.rejected_by
              ? "rejected"
              : "initiated";
            const rawActionBy =
              request.approved_by ||
              request.rejected_by ||
              request.initiated_by;
            const actionTime =
              request.approved_at ||
              request.completed_at ||
              request.updated_at ||
              request.created_at;

            // Get admin details
            const adminDetails = await getClearanceAdminDetails(request);

            const actionBy = adminDetails
              ? adminDetails.name
              : formatName(rawActionBy);
            const actionText =
              actionType === "approved"
                ? "Approved"
                : actionType === "rejected"
                ? "Rejected"
                : "Initiated";
            const description = `${actionText} ${employeeName}'s ${formattedClearanceType} Clearance`;

            activities.push({
              id: `clearance-action-${request.id}`,
              type: "Admin Action",
              activityType: "admin_action",
              description: description,
              status: actionText,
              timestamp: actionTime,
              date: actionTime,
              details: {
                action: actionType,
                actionBy: actionBy,
                requestType: "clearance",
                clearanceType: request.type,
                formattedClearanceType: formattedClearanceType,
                employeeName: employeeName,
                remarks: request.remarks,
                rejectionReason: request.rejection_reason,
                adminUsername: adminDetails?.username,
                adminId: adminDetails?.adminId,
                adminRole: adminDetails?.role,
                adminRank: adminDetails?.rank,
              },
              actionBy: actionBy,
              actionType: actionType,
              adminId: adminDetails?.adminId,
              relatedRequestId: request.id,
            });
          }
        }
      }

      // 3. Fetch inventory activity from AUDIT TABLE (only for admin view)
      if (userIsAdmin) {
        const inventoryActivities = await fetchInventoryActivity();
        activities.push(...inventoryActivities);
      }

      // 4. Fetch equipment activity (only for admin view)
      if (userIsAdmin) {
        const equipmentActivities = await fetchEquipmentActivity();
        activities.push(...equipmentActivities);
      }

      // 5. Fetch recruitment activity (only for admin view)
      if (userIsAdmin) {
        // Placeholder - implement based on your recruitment table
        const recruitmentActivities = [];
        activities.push(...recruitmentActivities);
      }

      // Sort all activities by timestamp (newest first)
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Prioritize clearance and leave requests at the top
      const prioritizedActivities = activities.sort((a, b) => {
        const priority = {
          clearance_request: 1,
          leave_request: 2,
          admin_action: 3,
          equipment: 4,
          inventory: 5,
          recruitment: 6,
        };

        const priorityA = priority[a.activityType] || 7;
        const priorityB = priority[b.activityType] || 7;

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      // Remove expired activities (older than 1 month) immediately
      const nonExpiredActivities = filterExpiredActivities(
        prioritizedActivities
      );

      console.log("Total activities fetched:", activities.length);
      console.log(
        "Activities after expiration filter:",
        nonExpiredActivities.length
      );
      console.log(
        "Activities removed (older than 1 month):",
        activities.length - nonExpiredActivities.length
      );

      setRecentActivities(nonExpiredActivities);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Error loading activities: ${err.message}`);
      setRecentActivities([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch activities when component mounts
  useEffect(() => {
    if (user) {
      fetchAllRecentActivities();

      // Set up real-time subscriptions for all relevant tables
      const channel1 = supabase
        .channel("leave-requests-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "leave_requests" },
          () => {
            fetchAllRecentActivities();
          }
        )
        .subscribe();

      const channel2 = supabase
        .channel("clearance-requests-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "clearance_requests" },
          () => {
            fetchAllRecentActivities();
          }
        )
        .subscribe();

      const channel3 = supabase
        .channel("inventory-audit-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "inventory_audit" },
          () => {
            fetchAllRecentActivities();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel1);
        supabase.removeChannel(channel2);
        supabase.removeChannel(channel3);
      };
    } else {
      setLoading(false);
      setError("Please log in to view activities");
    }
  }, [user]);

  // Format functions
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (err) {
      return "Invalid Date";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (err) {
      return "Invalid Date";
    }
  };

  const getStatusClass = (status) => {
    const statusLower = (status || "").toLowerCase();
    switch (statusLower) {
      case "approved":
      case "completed":
        return styles.statusApproved;
      case "added":
        return styles.statusAdded;
      case "updated":
        return styles.statusUpdated;
      case "deleted":
        return styles.statusDeleted;
      case "pending":
      case "for review":
      case "in progress":
      case "pending for approval":
        return styles.statusPending;
      case "rejected":
        return styles.statusRejected;
      case "cancelled":
        return styles.statusCancelled;
      default:
        return styles.statusDefault;
    }
  };

  const getStatusText = (status) => {
    if (!status) return "Pending";
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const getActivityIcon = (activityType, actionType) => {
    switch (activityType) {
      case "leave_request":
        return "📋";
      case "clearance_request":
        return "📄";
      case "admin_action":
        if (actionType === "approved") return "✅";
        if (actionType === "rejected") return "❌";
        if (actionType === "recommended") return "👍";
        if (actionType === "initiated") return "🚀";
        if (actionType === "added") return "➕";
        if (actionType === "updated") return "✏️";
        if (actionType === "deleted") return "🗑️";
        if (actionType === "hired") return "👤";
        return "⚡";
      default:
        return "📝";
    }
  };
  // Add this function after your existing helper functions like formatName, formatLeaveType, etc.
  const getPersonnelRank = async (personnelId) => {
    if (!personnelId) return null;

    try {
      const { data, error } = await supabase
        .from("personnel")
        .select("rank")
        .eq("id", personnelId)
        .single();

      if (!error && data) {
        console.log(`Fetched rank for personnel ${personnelId}:`, data.rank);
        return data.rank;
      }
      return null;
    } catch (err) {
      console.error("Error fetching personnel rank:", err);
      return null;
    }
  };
  const getActionColor = (actionType) => {
    switch (actionType) {
      case "submitted":
        return "#3498db";
      case "approved":
        return "#2ecc71";
      case "rejected":
        return "#e74c3c";
      case "recommended":
        return "#f39c12";
      case "initiated":
        return "#9b59b6";
      case "added":
        return "#27ae60";
      case "updated":
        return "#3498db";
      case "deleted":
        return "#c0392b";
      case "hired":
        return "#1abc9c";
      default:
        return "#95a5a6";
    }
  };

  const handleRefresh = () => {
    fetchAllRecentActivities();
    setCurrentPage(1);
  };

  const handleViewDetails = (activity) => {
    let details = "";
    switch (activity.activityType) {
      case "leave_request":
        details =
          `Leave Request Details:\n` +
          `Submitted by: ${activity.actionBy}\n` +
          `Type: ${activity.details.formattedLeaveType || "N/A"}\n` +
          `Status: ${activity.details.status || "Pending"}\n` +
          `Dates: ${formatDate(activity.startDate)} to ${formatDate(
            activity.endDate
          )}\n` +
          `Days: ${activity.numDays}\n` +
          (activity.details.location
            ? `Location: ${activity.details.location}\n`
            : "") +
          (activity.details.reason ? `Reason: ${activity.details.reason}` : "");
        break;
      case "clearance_request":
        details =
          `Clearance Request Details:\n` +
          `Submitted by: ${activity.actionBy}\n` +
          `Type: ${activity.details.formattedClearanceType || "N/A"}\n` +
          `Status: ${activity.details.status || "Pending"}\n` +
          (activity.effectiveDate
            ? `Effective Date: ${formatDate(activity.effectiveDate)}\n`
            : "") +
          (activity.expectedCompletionDate
            ? `Expected Completion: ${formatDate(
                activity.expectedCompletionDate
              )}\n`
            : "") +
          (activity.details.reason
            ? `Reason: ${activity.details.reason}\n`
            : "") +
          (activity.details.currentDepartment
            ? `Current Department: ${activity.details.currentDepartment}\n`
            : "") +
          (activity.details.missingAmount
            ? `Missing Amount: ₱${activity.details.missingAmount}`
            : "");
        break;
      case "admin_action":
        if (activity.details.requestType === "inventory") {
          const actionText =
            activity.details.action.charAt(0).toUpperCase() +
            activity.details.action.slice(1);
          details =
            `Inventory Action Details:\n` +
            `Action: ${actionText}\n` +
            `Performed by: ${activity.actionBy}\n` +
            `Item: ${activity.details.itemName}\n` +
            `Item Code: ${activity.details.itemCode}\n` +
            `Category: ${activity.details.category}\n`;
          if (activity.details.serialNumber)
            details += `Serial Number: ${activity.details.serialNumber}\n`;
          if (activity.details.price)
            details += `Price: ₱${activity.details.price}\n`;
          if (
            activity.details.action === "deleted" &&
            activity.details.oldData
          ) {
            details += `\nDeleted Item Details:\n`;
            const oldData = activity.details.oldData;
            if (oldData.status) details += `Status: ${oldData.status}\n`;
            if (oldData.created_at)
              details += `Created: ${formatDate(oldData.created_at)}\n`;
            if (oldData.updated_at)
              details += `Last Updated: ${formatDate(oldData.updated_at)}\n`;
          }
        } else if (activity.details.requestType === "leave") {
          details =
            `Leave Action Details:\n` +
            `Action: ${activity.details.action}\n` +
            `Performed by: ${activity.actionBy}\n` +
            `On: ${activity.details.employeeName}'s ${activity.details.formattedLeaveType} Leave\n`;
        } else if (activity.details.requestType === "clearance") {
          details =
            `Clearance Action Details:\n` +
            `Action: ${activity.details.action}\n` +
            `Performed by: ${activity.actionBy}\n` +
            `On: ${activity.details.employeeName}'s ${activity.details.formattedClearanceType} Clearance\n`;
        } else if (activity.details.requestType === "equipment") {
          details += `Equipment: ${activity.details.equipmentName}\n`;
        }
        if (activity.details.adminId) {
          details +=
            `\nAdmin Details:\n` +
            `Admin ID: ${activity.details.adminId}\n` +
            `Username: ${activity.details.adminUsername || "N/A"}\n` +
            `Role: ${activity.details.adminRole || "N/A"}\n` +
            (activity.details.adminRank
              ? `Rank: ${activity.details.adminRank}\n`
              : "");
        }
        if (activity.details.remarks)
          details += `Remarks: ${activity.details.remarks}\n`;
        if (activity.details.rejectionReason)
          details += `Rejection Reason: ${activity.details.rejectionReason}`;
        break;
    }
    toast.info(details);
  };

  // Replace the renderActionByCell function with this:
  const renderActionByCell = (activity) => {
    // Get rank from personnel details, NOT admin details
    const rank = activity.details?.personnelRank;
    const rankImage = getRankImage(rank);



    return (
      <div className={styles.actionByCell}>
        <div className={styles.actionByContent}>
          {/* Rank Image Display */}
          {rankImage && (
            <div className={styles.rankImageContainer}>
              <img
                src={rankImage}
                alt={rank || "Rank"}
                className={styles.rankImage}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = "none";
                }}
              />
            </div>
          )}

          <div className={styles.personnelInfo}>
            <strong className={styles.personnelName}>
              {activity.actionBy}
            </strong>

            {/* Display personnel rank */}
            {rank && <small className={styles.personnelRank}>{rank}</small>}

            {/* Only show admin badge if it's an admin action */}
            {activity.details?.adminRole && (
              <div className={styles.adminInfo}>
                <small className={styles.adminRoleBadge}>
                  {activity.details.adminRole}
                </small>
                {activity.details.adminRank && (
                  <small className={styles.adminRank}>
                    {activity.details.adminRank}
                  </small>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="app-container">
        <Hamburger />
        <Sidebar />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <div className={styles.recentActivityContainer}>
            <div className={styles.header}>
              <h3>Recent Activities</h3>
              <button
                className={styles.refreshBtn}
                onClick={handleRefresh}
                disabled
              >
                ↻
              </button>
            </div>
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}></div>
              <p>Loading activities...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Title>Recent Activities | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
     
      <ToastContainer />
      <Hamburger />
      <Sidebar />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.recentActivityContainer}>
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <h3>Recent Activities</h3>
              <div className={styles.userInfo}>
                <span className={styles.username}>User: {user?.username}</span>
                {isAdmin && <span className={styles.adminBadge}>ADMIN</span>}
              </div>
            </div>
            <button
              className={styles.refreshBtn}
              onClick={handleRefresh}
              title="Refresh"
            >
              ↻
            </button>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <span className={styles.errorIcon}>⚠️</span>
              {error}
            </div>
          )}

          {/* Admin Info Banner */}
          {isAdmin && (
            <div className={styles.adminBanner}>
              <span className={styles.adminIcon}>👁️</span>
              <span>
                Admin View: Tracking all system activities including inventory,
                equipment, and recruitment
              </span>
            </div>
          )}

          {/* Priority Notice with Date Filter Info */}
          <div className={styles.priorityNotice}>
            <span className={styles.priorityIcon}>⚠️</span>
            <span>
              Showing activities from the last month only • Showing prioritized
              activities: Clearance → Leave → Admin Actions
            </span>
          </div>

          {/* Filter Controls */}
          <div className={styles.filterControls}>
            <div className={styles.filterGroup}>
              <label>Filter by Activity Type:</label>
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Activities</option>
                <option value="clearance">Clearance Requests</option>
                <option value="leave">Leave Requests</option>
                <option value="admin_actions">Admin Actions</option>
                <option value="inventory" disabled={!isAdmin}>
                  Inventory Management
                </option>
                <option value="equipment" disabled={!isAdmin}>
                  Equipment Management
                </option>
                <option value="recruitment" disabled={!isAdmin}>
                  Recruitment
                </option>
              </select>
            </div>
            <div className={styles.activitiesCount}>
              Showing <strong>{paginatedActivities.length}</strong> of{" "}
              {filteredActivities.length} activities
              {filteredActivities.length !== recentActivities.length &&
                ` (${
                  recentActivities.length - filteredActivities.length
                } older than 1 month hidden)`}
              {filteredActivities.length > 0 &&
                ` • Page ${currentPage} of ${totalPages}`}
            </div>
          </div>

          {/* Top Pagination */}
          {totalPages > 1 && (
            <div className={styles.topPagination}>
              {renderPaginationButtons()}
            </div>
          )}

          {paginatedActivities.length === 0 ? (
            <div className={styles.noActivities}>
              <div className={styles.noActivitiesIcon}>📭</div>
              <h3>No Recent Activities Found</h3>
              <p>
                {activityFilter === "all"
                  ? "No activities have been recorded in the last month."
                  : `No ${activityFilter.replace(
                      "_",
                      " "
                    )} activities found in the last month.`}
              </p>
              {recentActivities.length > 0 &&
                filteredActivities.length === 0 && (
                  <p className={styles.expiredNotice}>
                    <small>
                      Note: There are {recentActivities.length} activities that
                      are older than 1 month and are not being displayed.
                    </small>
                  </p>
                )}
            </div>
          ) : (
            <>
              {/* TABLE VIEW */}
              <div className={styles.tableContainer}>
                <table className={styles.activityTable}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Action By</th>
                      <th>Status</th>
                      <th>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedActivities.map((activity) => (
                      <tr key={activity.id} className={styles.tableRow}>
                        <td>
                          <div className={styles.activityTypeCell}>
                            <span
                              className={styles.activityIcon}
                              style={{
                                color: getActionColor(activity.actionType),
                              }}
                            >
                              {getActivityIcon(
                                activity.activityType,
                                activity.actionType
                              )}
                            </span>
                            <span>{activity.type}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.descriptionCell}>
                            <strong>{formatDescription(activity)}</strong>
                            {activity.activityType === "leave_request" && (
                              <small>
                                {formatDate(activity.startDate)} to{" "}
                                {formatDate(activity.endDate)} •{" "}
                                {activity.numDays} day
                                {activity.numDays !== 1 ? "s" : ""}
                              </small>
                            )}
                            {activity.activityType === "clearance_request" &&
                              activity.effectiveDate && (
                                <small>
                                  Effective:{" "}
                                  {formatDate(activity.effectiveDate)}
                                </small>
                              )}
                            {activity.details?.requestType === "inventory" && (
                              <small>
                                {activity.details.itemCode} •{" "}
                                {activity.details.category}
                                {activity.details.action === "deleted" &&
                                  " • 🗑️ Deleted"}
                              </small>
                            )}
                            {activity.details?.requestType === "equipment" && (
                              <small>
                                {activity.details.category} •{" "}
                                {activity.details.condition}
                              </small>
                            )}
                          </div>
                        </td>
                        <td>{renderActionByCell(activity)}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${getStatusClass(
                              formatStatus(activity)
                            )}`}
                          >
                            {getStatusText(formatStatus(activity))}
                          </span>
                        </td>
                        <td>
                          <div className={styles.timestampCell}>
                            <strong>{formatDate(activity.timestamp)}</strong>
                            <small>
                              {
                                formatDateTime(activity.timestamp).split(
                                  ", "
                                )[1]
                              }
                            </small>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CARD VIEW (for mobile) */}
              <div className={styles.activitiesList}>
                {paginatedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className={styles.activityCard}
                    style={{
                      borderLeftColor: getActionColor(activity.actionType),
                    }}
                  >
                    <div className={styles.activityHeader}>
                      <div className={styles.activityType}>
                        <span
                          className={styles.activityIcon}
                          style={{ color: getActionColor(activity.actionType) }}
                        >
                          {getActivityIcon(
                            activity.activityType,
                            activity.actionType
                          )}
                        </span>
                        <div>
                          <span className={styles.activityTypeLabel}>
                            {activity.type}
                          </span>
                          {activity.actionType !== "submitted" && (
                            <span
                              className={styles.actionBadge}
                              style={{
                                backgroundColor: getActionColor(
                                  activity.actionType
                                ),
                                color: "white",
                              }}
                            >
                              {activity.actionType === "approved"
                                ? "APPROVED"
                                : activity.actionType === "rejected"
                                ? "REJECTED"
                                : activity.actionType === "recommended"
                                ? "RECOMMENDED"
                                : activity.actionType === "initiated"
                                ? "INITIATED"
                                : activity.actionType === "added"
                                ? "ADDED"
                                : activity.actionType === "updated"
                                ? "UPDATED"
                                : activity.actionType === "deleted"
                                ? "DELETED"
                                : activity.actionType === "hired"
                                ? "HIRED"
                                : activity.actionType.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`${styles.statusBadge} ${getStatusClass(
                          formatStatus(activity)
                        )}`}
                      >
                        {getStatusText(formatStatus(activity))}
                      </span>
                    </div>
                    <div className={styles.activityBody}>
                      <h4 className={styles.activityTitle}>
                        {formatDescription(activity)}
                      </h4>
                      <div className={styles.activityMeta}>
                        {/* In the card view section */}
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>By:</span>
                          <span className={styles.metaValue}>
                            <div className={styles.actionByContent}>
                              {/* Add rank image for cards - FROM PERSONNEL */}
                              {activity.details?.personnelRank && (
                                <div className={styles.rankImageContainerSmall}>
                                  <img
                                    src={getRankImage(
                                      activity.details.personnelRank
                                    )}
                                    alt="Rank"
                                    className={styles.rankImageSmall}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.style.display = "none";
                                    }}
                                  />
                                </div>
                              )}

                              <div className={styles.personnelInfoInline}>
                                <span>{activity.actionBy}</span>
                                {/* Show personnel rank */}
                                {activity.details?.personnelRank && (
                                  <small className={styles.personnelRankBadge}>
                                    {activity.details.personnelRank}
                                  </small>
                                )}
                                {/* Only show admin info for admin actions */}
                                {activity.details?.adminRole && (
                                  <div className={styles.adminInfoInline}>
                                    <small className={styles.adminRoleBadge}>
                                      {activity.details.adminRole}
                                    </small>
                                    {activity.details.adminRank && (
                                      <small className={styles.adminRank}>
                                        ({activity.details.adminRank})
                                      </small>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Date:</span>
                          <span className={styles.metaValue}>
                            {formatDateTime(activity.timestamp)}
                          </span>
                        </div>
                        {activity.activityType === "leave_request" && (
                          <>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>Period:</span>
                              <span className={styles.metaValue}>
                                {formatDate(activity.startDate)} to{" "}
                                {formatDate(activity.endDate)}
                              </span>
                            </div>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>Days:</span>
                              <span className={styles.metaValue}>
                                {activity.numDays}
                              </span>
                            </div>
                          </>
                        )}
                        {activity.activityType === "clearance_request" &&
                          activity.effectiveDate && (
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>
                                Effective:
                              </span>
                              <span className={styles.metaValue}>
                                {formatDate(activity.effectiveDate)}
                              </span>
                            </div>
                          )}
                        {activity.details?.requestType === "inventory" && (
                          <>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>Code:</span>
                              <span className={styles.metaValue}>
                                {activity.details.itemCode}
                              </span>
                            </div>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>
                                Category:
                              </span>
                              <span className={styles.metaValue}>
                                {activity.details.category}
                              </span>
                            </div>
                          </>
                        )}
                        {activity.details?.requestType === "equipment" && (
                          <>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>
                                Category:
                              </span>
                              <span className={styles.metaValue}>
                                {activity.details.category}
                              </span>
                            </div>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>
                                Condition:
                              </span>
                              <span className={styles.metaValue}>
                                {activity.details.condition}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      {activity.details?.location && (
                        <div className={styles.activityLocation}>
                          <span className={styles.metaLabel}>Location:</span>
                          <span>{activity.details.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Pagination */}
              {totalPages > 1 && (
                <div className={styles.bottomPagination}>
                  {renderPaginationButtons()}
                </div>
              )}

              {/* VIEW ALL ACTIVITIES BUTTON */}
              <div className={styles.viewMoreContainer}>
                <button
                  className={styles.viewMoreBtn}
                  onClick={() => {
                    if (activityFilter !== "all") {
                      setActivityFilter("all");
                      toast.info("Now showing all activities");
                    } else {
                      toast.info("Already viewing all activities");
                    }
                  }}
                  title={
                    activityFilter !== "all"
                      ? "Show all activity types"
                      : "Already showing all activities"
                  }
                >
                  {activityFilter !== "all"
                    ? "View All Activities →"
                    : "Viewing All Activities"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonnelRecentActivity;
