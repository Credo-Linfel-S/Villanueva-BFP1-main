import React, { useState, useEffect } from "react";
import styles from "../admin/styles/LeaveOfficerInputModal.module.css";
import { useSidebar } from "../SidebarContext.jsx"; // Add this import

const LeaveOfficerInputModal = ({
  isOpen,
  onClose,
  onConfirm,
  initialData = {},
  isGenerating = false,
}) => {
  const { isSidebarCollapsed } = useSidebar(); // Get sidebar state
  const [officerNames, setOfficerNames] = useState({
    oicOfficer: "",
    adminOfficer: "",
    municipalFireMarshal: "",
  });

  // Initialize with existing data if provided
  useEffect(() => {
    if (initialData) {
      setOfficerNames((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [initialData]);

  const handleInputChange = (field, value) => {
    setOfficerNames((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    onConfirm(officerNames);
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.leaveOfficerModalOverlay}
      style={{
        left: isSidebarCollapsed ? "80px" : "250px",
        width: isSidebarCollapsed
          ? "calc(100vw - 80px)"
          : "calc(100vw - 250px)",
      }}
    >
      <div className={styles.leaveOfficerModal}>
        <div className={styles.leaveOfficerModalHeader}>
          <h3>Enter Officer Names for Leave Form</h3>
          <button
            className={styles.leaveOfficerModalCloseBtn}
            onClick={handleCancel}
            disabled={isGenerating}
          >
            &times;
          </button>
        </div>

        <div className={styles.leaveOfficerModalBody}>
          <div className={styles.leaveOfficerModalNote}>
            <p>
              Please enter the names of officers to be displayed on the leave
              form. Fields marked with * are required.
            </p>
          </div>

          <div className={styles.leaveOfficerInputsGrid}>
            {/* OIC Officer */}
            <div className={styles.leaveOfficerInputGroup}>
              <label htmlFor="oicOfficer">
                <span className={styles.required}>*</span> OIC
                (Officer-in-Charge)
              </label>
              <input
                type="text"
                id="oicOfficer"
                value={officerNames.oicOfficer}
                onChange={(e) =>
                  handleInputChange("oicOfficer", e.target.value)
                }
                placeholder="Enter OIC name..."
                disabled={isGenerating}
                required
              />
              <div className={styles.leaveOfficerDescription}>
                Officer-in-Charge who approved the leave
              </div>
            </div>

            {/* Admin Officer */}
            <div className={styles.leaveOfficerInputGroup}>
              <label htmlFor="adminOfficer">
                <span className={styles.required}>*</span> Admin Officer
              </label>
              <input
                type="text"
                id="adminOfficer"
                value={officerNames.adminOfficer}
                onChange={(e) =>
                  handleInputChange("adminOfficer", e.target.value)
                }
                placeholder="Enter Admin Officer name..."
                disabled={isGenerating}
                required
              />
              <div className={styles.leaveOfficerDescription}>
                Administrative officer who processed the leave
              </div>
            </div>

            {/* Municipal Fire Marshal */}
            <div className={styles.leaveOfficerInputGroup}>
              <label htmlFor="municipalFireMarshal">
                Municipal Fire Marshal
              </label>
              <input
                type="text"
                id="municipalFireMarshal"
                value={officerNames.municipalFireMarshal}
                onChange={(e) =>
                  handleInputChange("municipalFireMarshal", e.target.value)
                }
                placeholder="Enter Municipal Fire Marshal name..."
                disabled={isGenerating}
              />
              <div className={styles.leaveOfficerDescription}>
                Municipal Fire Marshal (optional)
              </div>
            </div>
          </div>

          {/* Summary Preview */}
          <div className={styles.leaveOfficerSummary}>
            <h4>Officer Names Preview:</h4>
            <div className={styles.leaveOfficerPreview}>
              {officerNames.oicOfficer && (
                <div className={styles.leaveOfficerPreviewItem}>
                  <span className={styles.leaveOfficerPreviewLabel}>OIC:</span>
                  <span className={styles.leaveOfficerPreviewValue}>
                    {officerNames.oicOfficer}
                  </span>
                </div>
              )}
              {officerNames.adminOfficer && (
                <div className={styles.leaveOfficerPreviewItem}>
                  <span className={styles.leaveOfficerPreviewLabel}>
                    Admin:
                  </span>
                  <span className={styles.leaveOfficerPreviewValue}>
                    {officerNames.adminOfficer}
                  </span>
                </div>
              )}
              {officerNames.municipalFireMarshal && (
                <div className={styles.leaveOfficerPreviewItem}>
                  <span className={styles.leaveOfficerPreviewLabel}>MFM:</span>
                  <span className={styles.leaveOfficerPreviewValue}>
                    {officerNames.municipalFireMarshal}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.leaveOfficerModalFooter}>
          <button
            className={styles.leaveOfficerModalCancelBtn}
            onClick={handleCancel}
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            className={styles.leaveOfficerModalConfirmBtn}
            onClick={handleSubmit}
            disabled={
              isGenerating ||
              !officerNames.oicOfficer ||
              !officerNames.adminOfficer
            }
          >
            {isGenerating ? (
              <>
                <span className={styles.leaveOfficerModalSpinner}></span>
                Generating...
              </>
            ) : (
              "Generate Leave PDF with Officer Names"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveOfficerInputModal;
