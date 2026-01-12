// AdminGearIcon.jsx - SIMPLIFIED VERSION
import React, { useState, useEffect, useRef } from "react";
import {
  FaCog,
  FaUserShield,
  FaEdit,
  FaCopy,
  FaEye,
  FaEyeSlash,
  FaUserPlus,
  FaUserTimes,
  FaUser,
  FaUsers,
  FaUserCheck,
  FaUserTag,
} from "react-icons/fa";
import { supabase } from "../../../lib/supabaseClient.js";
import { toast } from "react-toastify";
import styles from "../styles/AdminGearIcon.module.css";

const AdminGearIcon = () => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [personnelList, setPersonnelList] = useState([]);
  const [availablePersonnel, setAvailablePersonnel] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignmentType, setAssignmentType] = useState("primary"); // 'primary' or 'secondary'
  const [userType, setUserType] = useState("admin"); // 'admin' or 'inspector'
  const tooltipRef = useRef(null);

  // Admin role options
  const adminRoleOptions = [
    { value: "system_admin", label: "System Administrator" },
    { value: "inspector_admin", label: "Inspector Administrator" },
 
  ];

  // Form state for editing admin
  const [editForm, setEditForm] = useState({
    username: "",
    password: "",
    showPassword: false,
    admin_role: "",
    is_active: true,
  });

  // Form state for assigning personnel
  const [assignForm, setAssignForm] = useState({
    personnel_id: "",
    assignment_type: "primary",
    user_type: "admin",
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setShowTooltip(false);
        setShowAdminPanel(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (showAdminPanel) {
      loadAdminUsers();
      loadPersonnel();
    }
  }, [showAdminPanel]);

  const loadAdminUsers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("admin_users")
        .select(
          `
          *,
          primary_personnel:primary_personnel_id (
            id,
            first_name,
            last_name,
            badge_number,
            rank
          ),
          secondary_personnel:secondary_personnel_id (
            id,
            first_name,
            last_name,
            badge_number,
            rank
          ),
          inspector_primary_personnel:inspector_primary_personnel_id (
            id,
            first_name,
            last_name,
            badge_number,
            rank
          ),
          inspector_secondary_personnel:inspector_secondary_personnel_id (
            id,
            first_name,
            last_name,
            badge_number,
            rank
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAdminUsers(data || []);
    } catch (error) {
      console.error("Error loading admin users:", error);
      toast.error("Failed to load admin users");
    } finally {
      setLoading(false);
    }
  };

  const loadPersonnel = async () => {
    try {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, badge_number, rank, station")
        .order("last_name", { ascending: true });

      if (error) throw error;
      setPersonnelList(data || []);

      // Get all currently assigned personnel IDs
      const { data: adminData } = await supabase
        .from("admin_users")
        .select(
          "primary_personnel_id, secondary_personnel_id, inspector_primary_personnel_id, inspector_secondary_personnel_id"
        );

      const assignedIds = new Set();
      adminData?.forEach((admin) => {
        if (admin.primary_personnel_id)
          assignedIds.add(admin.primary_personnel_id);
        if (admin.secondary_personnel_id)
          assignedIds.add(admin.secondary_personnel_id);
        if (admin.inspector_primary_personnel_id)
          assignedIds.add(admin.inspector_primary_personnel_id);
        if (admin.inspector_secondary_personnel_id)
          assignedIds.add(admin.inspector_secondary_personnel_id);
      });

      // Filter out already assigned personnel
      const available =
        data?.filter((person) => !assignedIds.has(person.id)) || [];
      setAvailablePersonnel(available);
    } catch (error) {
      console.error("Error loading personnel:", error);
    }
  };

  const getAssignedPersonnel = (admin, type = "admin") => {
    if (type === "admin") {
      return {
        primary: admin.primary_personnel,
        secondary: admin.secondary_personnel,
      };
    } else {
      return {
        primary: admin.inspector_primary_personnel,
        secondary: admin.inspector_secondary_personnel,
      };
    }
  };

  const handleAdminClick = () => {
    setShowAdminPanel(true);
  };

  const handleAdminSelect = (admin) => {
    setSelectedAdmin(admin);
    setEditForm({
      username: admin.username,
      password: "",
      showPassword: false,
      admin_role: admin.admin_role || "system_admin",
      is_active: admin.is_active,
    });
    setShowEditModal(true);
  };

  const handleAssignClick = (
    admin,
    type = "admin",
    assignmentType = "primary"
  ) => {
    setSelectedAdmin(admin);
    setUserType(type);
    setAssignmentType(assignmentType);
    setAssignForm({
      personnel_id: "",
      assignment_type: assignmentType,
      user_type: type,
    });
    setShowAssignModal(true);
  };

  const handleEditAdmin = async (e) => {
    e.preventDefault();
    try {
      if (!selectedAdmin) return;

      const updates = {
        username: editForm.username.trim(),
        admin_role: editForm.admin_role,
        is_active: editForm.is_active,
        updated_at: new Date().toISOString(),
      };

      // Only update password if it was changed
      if (editForm.password && editForm.password.trim() !== "") {
        updates.password = editForm.password.trim();
      }

      const { error } = await supabase
        .from("admin_users")
        .update(updates)
        .eq("id", selectedAdmin.id);

      if (error) throw error;

      toast.success("Admin updated successfully");
      loadAdminUsers();
      setShowEditModal(false);
      setSelectedAdmin(null);
    } catch (error) {
      console.error("Error updating admin:", error);
      toast.error("Failed to update admin");
    }
  };

  const handleAssignPersonnel = async (e) => {
    e.preventDefault();
    try {
      if (!selectedAdmin || !assignForm.personnel_id) return;

      // Check if personnel is already assigned
      const { data: existingAssignments } = await supabase
        .from("admin_users")
        .select("*")
        .or(
          `primary_personnel_id.eq.${assignForm.personnel_id},secondary_personnel_id.eq.${assignForm.personnel_id},inspector_primary_personnel_id.eq.${assignForm.personnel_id},inspector_secondary_personnel_id.eq.${assignForm.personnel_id}`
        )
        .neq("id", selectedAdmin.id);

      if (existingAssignments && existingAssignments.length > 0) {
        toast.error("This personnel is already assigned to another user");
        return;
      }

      const updates = {};
      const columnName =
        assignForm.user_type === "admin"
          ? assignForm.assignment_type === "primary"
            ? "primary_personnel_id"
            : "secondary_personnel_id"
          : assignForm.assignment_type === "primary"
          ? "inspector_primary_personnel_id"
          : "inspector_secondary_personnel_id";

      updates[columnName] = assignForm.personnel_id;
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("admin_users")
        .update(updates)
        .eq("id", selectedAdmin.id);

      if (error) throw error;

      toast.success("Personnel assigned successfully");
      loadAdminUsers();
      loadPersonnel(); // Refresh available personnel
      setShowAssignModal(false);
      setSelectedAdmin(null);
    } catch (error) {
      console.error("Error assigning personnel:", error);
      toast.error(error.message || "Failed to assign personnel");
    }
  };

  const handleRemoveAssignment = async (adminId, userType, assignmentType) => {
    try {
      const columnName =
        userType === "admin"
          ? assignmentType === "primary"
            ? "primary_personnel_id"
            : "secondary_personnel_id"
          : assignmentType === "primary"
          ? "inspector_primary_personnel_id"
          : "inspector_secondary_personnel_id";

      const updates = {
        [columnName]: null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("admin_users")
        .update(updates)
        .eq("id", adminId);

      if (error) throw error;

      toast.success("Assignment removed successfully");
      loadAdminUsers();
      loadPersonnel(); // Refresh available personnel
    } catch (error) {
      console.error("Error removing assignment:", error);
      toast.error("Failed to remove assignment");
    }
  };

  const togglePasswordVisibility = () => {
    setEditForm((prev) => ({ ...prev, showPassword: !prev.showPassword }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const generateRandomPassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEditForm((prev) => ({ ...prev, password }));
  };

  const renderPersonnelAssignments = (admin) => {
    const adminAssignments = getAssignedPersonnel(admin, "admin");
    const inspectorAssignments = getAssignedPersonnel(admin, "inspector");

    return (
      <div className={styles.assignmentsContainer}>
        {/* Admin Assignments */}
        <div className={styles.assignmentSection}>
          <div className={styles.sectionHeader}>
            <FaUserShield /> Admin Users
          </div>
          <div className={styles.assignmentList}>
            {adminAssignments.primary ? (
              <div className={styles.assignmentItem}>
                <span className={styles.assignmentType}>
                  <FaUser title="Primary Admin" />
                </span>
                <span className={styles.personnelName}>
                  {adminAssignments.primary.first_name}{" "}
                  {adminAssignments.primary.last_name}
                </span>
                <span className={styles.personnelDetails}>
                  ({adminAssignments.primary.badge_number})
                </span>
                <button
                  className={styles.removeAssignmentButton}
                  onClick={() =>
                    handleRemoveAssignment(admin.id, "admin", "primary")
                  }
                  title="Remove"
                >
                  <FaUserTimes />
                </button>
              </div>
            ) : (
              <button
                className={styles.addAssignmentButton}
                onClick={() => handleAssignClick(admin, "admin", "primary")}
              >
                <FaUserPlus /> Add Primary Admin
              </button>
            )}

            {adminAssignments.secondary ? (
              <div className={styles.assignmentItem}>
                <span className={styles.assignmentType}>
                  <FaUsers title="Secondary Admin" />
                </span>
                <span className={styles.personnelName}>
                  {adminAssignments.secondary.first_name}{" "}
                  {adminAssignments.secondary.last_name}
                </span>
                <span className={styles.personnelDetails}>
                  ({adminAssignments.secondary.badge_number})
                </span>
                <button
                  className={styles.removeAssignmentButton}
                  onClick={() =>
                    handleRemoveAssignment(admin.id, "admin", "secondary")
                  }
                  title="Remove"
                >
                  <FaUserTimes />
                </button>
              </div>
            ) : (
              adminAssignments.primary && (
                <button
                  className={styles.addAssignmentButton}
                  onClick={() => handleAssignClick(admin, "admin", "secondary")}
                >
                  <FaUserPlus /> Add Secondary Admin
                </button>
              )
            )}
          </div>
        </div>

        {/* Inspector Assignments (only for inspector admins) */}
        {admin.role === "inspector" && (
          <div className={styles.assignmentSection}>
            <div className={styles.sectionHeader}>
              <FaUserCheck /> Inspector Users
            </div>
            <div className={styles.assignmentList}>
              {inspectorAssignments.primary ? (
                <div className={styles.assignmentItem}>
                  <span className={styles.assignmentType}>
                    <FaUserTag title="Primary Inspector" />
                  </span>
                  <span className={styles.personnelName}>
                    {inspectorAssignments.primary.first_name}{" "}
                    {inspectorAssignments.primary.last_name}
                  </span>
                  <span className={styles.personnelDetails}>
                    ({inspectorAssignments.primary.badge_number})
                  </span>
                  <button
                    className={styles.removeAssignmentButton}
                    onClick={() =>
                      handleRemoveAssignment(admin.id, "inspector", "primary")
                    }
                    title="Remove"
                  >
                    <FaUserTimes />
                  </button>
                </div>
              ) : (
                <button
                  className={styles.addAssignmentButton}
                  onClick={() =>
                    handleAssignClick(admin, "inspector", "primary")
                  }
                >
                  <FaUserPlus /> Add Primary Inspector
                </button>
              )}

              {inspectorAssignments.secondary ? (
                <div className={styles.assignmentItem}>
                  <span className={styles.assignmentType}>
                    <FaUserTag title="Secondary Inspector" />
                  </span>
                  <span className={styles.personnelName}>
                    {inspectorAssignments.secondary.first_name}{" "}
                    {inspectorAssignments.secondary.last_name}
                  </span>
                  <span className={styles.personnelDetails}>
                    ({inspectorAssignments.secondary.badge_number})
                  </span>
                  <button
                    className={styles.removeAssignmentButton}
                    onClick={() =>
                      handleRemoveAssignment(admin.id, "inspector", "secondary")
                    }
                    title="Remove"
                  >
                    <FaUserTimes />
                  </button>
                </div>
              ) : (
                inspectorAssignments.primary && (
                  <button
                    className={styles.addAssignmentButton}
                    onClick={() =>
                      handleAssignClick(admin, "inspector", "secondary")
                    }
                  >
                    <FaUserPlus /> Add Secondary Inspector
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={styles.gearIconContainer} ref={tooltipRef}>
        <button
          className={styles.gearIconButton}
          onClick={() => setShowTooltip(!showTooltip)}
          title="Admin Settings"
        >
          <FaCog />
        </button>

        {showTooltip && (
          <div className={styles.tooltip}>
            <button className={styles.tooltipButton} onClick={handleAdminClick}>
              <FaUserShield /> Admin Panel
            </button>
          </div>
        )}

        {showAdminPanel && (
          <div className={styles.adminPanel}>
            <div className={styles.panelHeader}>
              <h3>Admin Users Management</h3>
              <button
                className={styles.closeButton}
                onClick={() => setShowAdminPanel(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.panelContent}>
              {loading ? (
                <div className={styles.loading}>Loading...</div>
              ) : (
                <table className={styles.adminTable}>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Assigned Personnel (Max: 2 per type)</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((admin) => (
                      <tr key={admin.id}>
                        <td>{admin.username}</td>
                        <td>
                          <span
                            className={`${styles.roleBadge} ${
                              styles[admin.role] || ""
                            }`}
                          >
                            {admin.role === "admin"
                              ? "Administrator"
                              : "Inspector"}
                          </span>
                          {admin.admin_role && (
                            <span className={styles.adminRoleBadge}>
                              {admin.admin_role.replace("_", " ")}
                            </span>
                          )}
                        </td>
                        <td>{renderPersonnelAssignments(admin)}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              admin.is_active ? styles.active : styles.inactive
                            }`}
                          >
                            {admin.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <button
                            className={styles.editButton}
                            onClick={() => handleAdminSelect(admin)}
                          >
                            <FaEdit /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Admin Modal */}
      {showEditModal && selectedAdmin && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Edit Admin User</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditAdmin} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label>Username:</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Password:</label>
                <div className={styles.passwordInputGroup}>
                  <input
                    type={editForm.showPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder="Leave empty to keep current password"
                  />
                  <div className={styles.passwordActions}>
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className={styles.iconButton}
                    >
                      {editForm.showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(editForm.password)}
                      className={styles.iconButton}
                      disabled={!editForm.password}
                    >
                      <FaCopy />
                    </button>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className={styles.generateButton}
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Admin Role:</label>
                <select
                  value={editForm.admin_role}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      admin_role: e.target.value,
                    }))
                  }
                  required
                >
                  {adminRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        is_active: e.target.checked,
                      }))
                    }
                  />
                  Active Account
                </label>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveButton}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Personnel Modal */}
      {showAssignModal && selectedAdmin && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Assign Personnel</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowAssignModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAssignPersonnel} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label>Admin Username:</label>
                <input
                  type="text"
                  value={selectedAdmin.username}
                  readOnly
                  className={styles.readOnlyInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label>User Type:</label>
                <div className={styles.userTypeDisplay}>
                  {userType === "admin" ? (
                    <span className={styles.adminType}>
                      <FaUserShield /> Administrator
                    </span>
                  ) : (
                    <span className={styles.inspectorType}>
                      <FaUserCheck /> Inspector
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Assignment Type:</label>
                <div className={styles.assignmentTypeDisplay}>
                  {assignmentType === "primary" ? (
                    <span className={styles.primaryType}>
                      <FaUser /> Primary User
                    </span>
                  ) : (
                    <span className={styles.secondaryType}>
                      <FaUsers /> Secondary User
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Select Personnel:</label>
                <select
                  value={assignForm.personnel_id}
                  onChange={(e) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      personnel_id: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select Personnel</option>
                  {availablePersonnel.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.last_name}, {person.first_name} (
                      {person.badge_number}) - {person.rank}
                    </option>
                  ))}
                </select>
                <div className={styles.availableCount}>
                  {availablePersonnel.length} personnel available
                </div>
              </div>

              <div className={styles.currentAssignments}>
                <h4>Current Assignments for {selectedAdmin.username}:</h4>
                {renderPersonnelAssignments(selectedAdmin)}
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={availablePersonnel.length === 0}
                >
                  Assign Personnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminGearIcon;
