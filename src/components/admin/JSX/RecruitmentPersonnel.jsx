// RecruitmentPersonnel.jsx - FIXED VERSION
import React, { useState, useEffect, useRef } from "react";
import styles from "../styles/RecruitmentPersonnel.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.css";
import { supabase } from "../../../lib/supabaseClient.js";
import BFPPreloader from "../../BFPPreloader.jsx";
import { FaEye, FaEyeSlash, FaCopy, FaCheck } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FloatingNotificationBell from "../../FloatingNotificationBell.jsx";
import { useUserId } from "../../hooks/useUserId.js";
const RecruitmentPersonnel = () => {
       
  // FORM DATA STATES - Separate for add and edit
  const [addFormData, setAddFormData] = useState({
    candidate: "",
    position: "",
    applicationDate: "",
    stage: "",
    interviewDate: "",
    status: "",
  });

  const [editFormData, setEditFormData] = useState({
    candidate: "",
    position: "",
    applicationDate: "",
    stage: "",
    interviewDate: "",
    status: "",
    photoUrl: "",
    resumeUrl: "",
  });
const { userId, isAuthenticated, userRole } = useUserId();
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [records, setRecords] = useState([]);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { isSidebarCollapsed } = useSidebar();

  // State variables for table functionality
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // File upload states for ADD form
  const [photoFile, setPhotoFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // EDIT MODAL SPECIFIC STATES
  const [editPhotoPreview, setEditPhotoPreview] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editResumeFile, setEditResumeFile] = useState(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editPhotoInputRef = useRef(null);
  const editResumeInputRef = useRef(null);

  // Load data from Supabase
  useEffect(() => {
    fetchRecruitmentData();
  }, []);

  // Generate username from candidate name
  const generateUsername = (candidateName) => {
    if (!candidateName) return "";

    const baseUsername = candidateName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 15);

    const randomNumbers = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");

    return `${baseUsername}${randomNumbers}`;
  };

  // Generate random password
  const generatePassword = () => {
    const length = 10;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";

    password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    password += "0123456789"[Math.floor(Math.random() * 10)];
    password += "!@#$%^&*"[Math.floor(Math.random() * 8)];

    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  };

  // Auto-generate username when candidate name changes in ADD form
  useEffect(() => {
    if (addFormData.candidate) {
      const generatedUsername = generateUsername(addFormData.candidate);
      setAddUsername(generatedUsername);

      if (!addPassword) {
        const generatedPassword = generatePassword();
        setAddPassword(generatedPassword);
      }
    }
  }, [addFormData.candidate]);

  // Generate new password for ADD form
  const handleGeneratePassword = () => {
    const newPassword = generatePassword();
    setAddPassword(newPassword);
  };

  // Generate new password for EDIT form
  const handleGeneratePasswordEdit = () => {
    const newPassword = generatePassword();
    setEditPassword(newPassword);
  };

  const fetchRecruitmentData = async () => {
    try {
      setInitialLoading(true);
      setLoadingProgress(30);

      const { data, error } = await supabase
        .from("recruitment_personnel")
        .select("*")
        .order("created_at", { ascending: false });

      setLoadingProgress(70);

      if (error) {
        console.error("Error fetching recruitment data:", error);
        return;
      }

      setRecords(data || []);
      setLoadingProgress(100);

      // Small delay to show completion
      setTimeout(() => {
        setInitialLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error in fetchRecruitmentData:", error);
      setInitialLoading(false);
    }
  };

  // Handle input changes for ADD form
  const handleAddInputChange = (e) => {
    const { id, value } = e.target;
    setAddFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // Handle input changes for EDIT form
  const handleEditInputChange = (e) => {
    const { id, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // Handle photo file selection for ADD form
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.info("Please select an image file (JPEG, PNG, etc.)");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.info("Image file size should be less than 5MB");
        return;
      }

      setPhotoFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle resume file selection for ADD form
  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      const fileExtension = file.name.split(".").pop().toLowerCase();
      const isValidType =
        allowedTypes.includes(file.type) ||
        ["pdf", "doc", "docx"].includes(fileExtension);

      if (!isValidType) {
        toast.info("Please select a PDF or Word document (PDF, DOC, DOCX)");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.info("Resume file size should be less than 10MB");
        return;
      }

      setResumeFile(file);
      setResumeFileName(file.name);
    }
  };

  // Handle photo file selection for EDIT modal
  const handleEditPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.info("Please select an image file (JPEG, PNG, etc.)");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.warning("Image file size should be less than 5MB");
        return;
      }

      setEditPhotoFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle resume file selection for EDIT modal
  const handleEditResumeChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      const fileExtension = file.name.split(".").pop().toLowerCase();
      const isValidType =
        allowedTypes.includes(file.type) ||
        ["pdf", "doc", "docx"].includes(fileExtension);

      if (!isValidType) {
        toast.info("Please select a PDF or Word document (PDF, DOC, DOCX)");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.info("Resume file size should be less than 10MB");
        return;
      }

      setEditResumeFile(file);
      setResumeFileName(file.name);
    }
  };

  // Function to clear edit photo
  const clearEditPhoto = () => {
    if (editPhotoPreview && editPhotoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(editPhotoPreview);
    }
    setEditPhotoPreview(null);
    setEditPhotoFile(null);
    setIsPhotoRemoved(true);
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = "";
    }
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file, bucket, fileName) => {
    try {
      const fileExt = fileName.split(".").pop();
      const uniqueFileName = `${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}.${fileExt}`;
      const filePath = `${bucket}/${uniqueFileName}`;

      const { data, error } = await supabase.storage
        .from("recruitment-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Error uploading file:", error);
        throw error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("recruitment-files").getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error in uploadFile:", error);
      throw error;
    }
  };

  // Delete file from Supabase Storage
  const deleteFile = async (url) => {
    if (!url) return;

    try {
      const urlParts = url.split("/");
      const filePath = urlParts
        .slice(urlParts.indexOf("recruitment-files") + 1)
        .join("/");

      const { error } = await supabase.storage
        .from("recruitment-files")
        .remove([filePath]);

      if (error) {
        console.error("Error deleting file:", error);
      }
    } catch (error) {
      console.error("Error in deleteFile:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addNewCandidate();
  };

  // Add new candidate
  const addNewCandidate = async () => {
    try {
      setSubmitting(true);
      setUploadProgress(0);

      if (!addFormData.candidate) {
        toast.info("Candidate name is required");
        setSubmitting(false);
        return;
      }

      if (!addUsername || !addPassword) {
        toast.info("Please ensure username and password are generated");
        setSubmitting(false);
        return;
      }

      let photoUrl = "";
      let resumeUrl = "";

      if (photoFile) {
        setUploadProgress(30);
        photoUrl = await uploadFile(photoFile, "photos", photoFile.name);
      }

      if (resumeFile) {
        setUploadProgress(60);
        resumeUrl = await uploadFile(resumeFile, "resumes", resumeFile.name);
      }

      setUploadProgress(90);

      // Check what fields actually exist by examining existing records
      const sampleRecord = records[0];
      const existingFields = sampleRecord ? Object.keys(sampleRecord) : [];

      // Build candidate object with only fields that are likely to exist
      const candidateData = {
        candidate: addFormData.candidate,
        position: addFormData.position || "Firefighter Candidate",
        username: addUsername,
        password: addPassword,
        stage: addFormData.stage || "Applied",
        status: addFormData.status || "Pending",
      };

      // Only add these fields if they exist in the table structure
      if (existingFields.includes("full_name")) {
        candidateData.full_name = addFormData.candidate;
      }

      if (existingFields.includes("photo_url")) {
        candidateData.photo_url = photoUrl || null;
      }

      if (existingFields.includes("resume_url")) {
        candidateData.resume_url = resumeUrl || null;
      }

      if (existingFields.includes("application_date")) {
        candidateData.application_date = addFormData.applicationDate || null;
      }

      if (existingFields.includes("interview_date")) {
        candidateData.interview_date = addFormData.interviewDate || null;
      }

      if (existingFields.includes("auth_user_id")) {
        candidateData.auth_user_id = generateUniqueId();
      }

      console.log(
        "Inserting candidate with fields:",
        Object.keys(candidateData)
      );

      const { error } = await supabase
        .from("recruitment_personnel")
        .insert([candidateData]);

      if (error) {
        console.error("Error adding candidate:", error);
        toast.error(
          `Failed to add candidate: ${error.message}\n\nPlease check if all database columns exist.`
        );
        return;
      }

      setUploadProgress(100);
      await fetchRecruitmentData();

      resetAddForm();
      setShowForm(false);
      setCurrentPage(1);

      setTimeout(() => {
        setUploadProgress(0);
        toast.success(
          "Candidate added successfully!\n\nCredentials:\nUsername: " +
            addUsername +
            "\nPassword: " +
            addPassword
        );
      }, 500);
    } catch (error) {
     
      toast.error("An error occurred. Please try again.");
      setUploadProgress(0);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to generate unique ID
  const generateUniqueId = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  // Reset ADD form
  const resetAddForm = () => {
    setAddFormData({
      candidate: "",
      position: "",
      applicationDate: "",
      stage: "",
      interviewDate: "",
      status: "",
    });
    setAddUsername("");
    setAddPassword("");
    setShowPassword(false);
    setPhotoFile(null);
    setResumeFile(null);
    setPhotoPreview("");
    setResumeFileName("");
  };

  // Reset EDIT modal
  const resetEditModal = () => {
    setEditFormData({
      candidate: "",
      position: "",
      applicationDate: "",
      stage: "",
      interviewDate: "",
      status: "",
      photoUrl: "",
      resumeUrl: "",
    });
    setEditUsername("");
    setEditPassword("");
    setEditPhotoPreview("");
    setEditPhotoFile(null);
    setEditResumeFile(null);
    setIsPhotoRemoved(false);
    setResumeFileName("");
    setIsSavingEdit(false);
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = "";
    }
    if (editResumeInputRef.current) {
      editResumeInputRef.current.value = "";
    }
  };

  // Handle closing edit modal
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditId(null);
    resetEditModal();
  };

  const handleEdit = (id) => {
    const record = records.find((item) => item.id === id);
    if (record) {
      setEditFormData({
        candidate: record.candidate || "",
        position: record.position || "",
        applicationDate: record.application_date || "",
        stage: record.stage || "",
        interviewDate: record.interview_date || "",
        status: record.status || "",
        photoUrl: record.photo_url || "",
        resumeUrl: record.resume_url || "",
      });
      setEditUsername(record.username || "");
      setEditPassword(record.password || "");
      setEditPhotoPreview(record.photo_url || "");
      setResumeFileName(
        record.resume_url ? record.resume_url.split("/").pop() : ""
      );
      setEditId(id);
      setShowEditModal(true);
      setIsPhotoRemoved(false);
    }
  };

  // Update candidate
  const handleUpdateCandidate = async (e) => {
    e.preventDefault();

    if (editId === null) return;

    try {
      setIsSavingEdit(true);
      setUploadProgress(0);

      let photoUrl = editFormData.photoUrl;
      let resumeUrl = editFormData.resumeUrl;
      let oldPhotoUrl = editFormData.photoUrl;
      let oldResumeUrl = editFormData.resumeUrl;

      // Handle photo upload
      if (editPhotoFile) {
        setUploadProgress(30);
        photoUrl = await uploadFile(
          editPhotoFile,
          "photos",
          editPhotoFile.name
        );
        if (oldPhotoUrl) {
          await deleteFile(oldPhotoUrl);
        }
      } else if (isPhotoRemoved) {
        // Clear photo if removed
        photoUrl = "";
        if (oldPhotoUrl) {
          await deleteFile(oldPhotoUrl);
        }
      }

      // Handle resume upload
      if (editResumeFile) {
        setUploadProgress(60);
        resumeUrl = await uploadFile(
          editResumeFile,
          "resumes",
          editResumeFile.name
        );
        if (oldResumeUrl) {
          await deleteFile(oldResumeUrl);
        }
      }

      setUploadProgress(90);

      // Build update data
      const updatedData = {
        candidate: editFormData.candidate,
        position: editFormData.position,
        username: editUsername,
        password: editPassword,
        stage: editFormData.stage,
        status: editFormData.status,
        photo_url: photoUrl,
        resume_url: resumeUrl,
        application_date: editFormData.applicationDate || null,
        interview_date: editFormData.interviewDate || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("recruitment_personnel")
        .update(updatedData)
        .eq("id", editId);

      if (error) {
        console.error("Error updating candidate:", error);
        toast.error(`Failed to update candidate: ${error.message}`);
        return;
      }

      setUploadProgress(100);
      await fetchRecruitmentData();

      setShowEditModal(false);
      resetEditModal();

      setTimeout(() => {
        setUploadProgress(0);
        toast.success("Candidate updated successfully!");
      }, 500);
    } catch (error) {
      console.error("Error in handleUpdateCandidate:", error);
      toast.error("An error occurred. Please try again.");
      setUploadProgress(0);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;

    try {
      const record = records.find((item) => item.id === deleteId);

      if (record?.photo_url) {
        await deleteFile(record.photo_url);
      }

      if (record?.resume_url) {
        await deleteFile(record.resume_url);
      }

      const { error } = await supabase
        .from("recruitment_personnel")
        .delete()
        .eq("id", deleteId);

      if (error) {
        console.error("Error deleting candidate:", error);
        toast.error("Failed to delete candidate. Please try again.");
        return;
      }

      await fetchRecruitmentData();

      setShowDeleteModal(false);
      setDeleteId(null);
      setCurrentPage(1);

      toast.success("Candidate deleted successfully!");
    } catch (error) {
      console.error("Error in confirmDelete:", error);
      toast.error("An error occurred. Please try again.");
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  // Function to view/download resume
  const viewResume = (url) => {
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.warning("No resume available for this candidate.");
    }
  };

  // Function to view/download photo
  const viewPhoto = (url) => {
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.info("No photo available for this candidate.");
    }
  };

  const getOptionColor = (selectId, value) => {
    const options = {
      stage: {
        Applied: "#facc15",
        Screening: "#3b82f6",
        Interview: "#06b6d4",
        "Final Review": "#10b981",
      },
      status: {
        Pending: "#facc15",
        Approved: "#10b981",
        Rejected: "#dc2626",
      },
    };
    return options[selectId]?.[value] || null;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return "-";
    }
  };

  // Get file name from URL
  const getFileNameFromUrl = (url) => {
    if (!url) return "";
    const parts = url.split("/");
    return parts[parts.length - 1];
  };

  // Password cell component for table
  // Replace the existing PasswordCell component with this:
  const PasswordCell = ({ password }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    const togglePassword = () => {
      setShowPassword(!showPassword);
    };

    const copyPassword = () => {
      if (!password) return;

      navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <td className={styles.passwordCell}>
        <div className={styles.passwordContainer}>
          <span className={styles.passwordMask}>
            {showPassword ? password : "••••••••"}
          </span>
          <div className={styles.passwordActions}>
            <button
              className={styles.passwordToggle}
              onClick={togglePassword}
              type="button"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <FaEyeSlash className={styles.passwordIcon} />
              ) : (
                <FaEye className={styles.passwordIcon} />
              )}
            </button>
            <button
              className={styles.copyBtn}
              onClick={copyPassword}
              type="button"
              title="Copy password"
              disabled={!password}
            >
              {copied ? (
                <FaCheck className={styles.copyIcon} />
              ) : (
                <FaCopy className={styles.copyIcon} />
              )}
            </button>
          </div>
          {copied && <span className={styles.copiedText}>Copied!</span>}
        </div>
      </td>
    );
  };

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];

    if (currentFilterCard === "applied") {
      filtered = filtered.filter((i) => i.stage?.toLowerCase() === "applied");
    } else if (currentFilterCard === "screening") {
      filtered = filtered.filter((i) => i.stage?.toLowerCase() === "screening");
    } else if (currentFilterCard === "interview") {
      filtered = filtered.filter((i) => i.stage?.toLowerCase() === "interview");
    } else if (currentFilterCard === "final") {
      filtered = filtered.filter(
        (i) => i.stage?.toLowerCase() === "final review"
      );
    }

    const s = search.trim().toLowerCase();
    const stageFilter = filterStage.trim().toLowerCase();
    const statusFilter = filterStatus.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.candidate} ${i.position} ${i.username} ${i.application_date} ${i.stage} ${i.interview_date} ${i.status}`.toLowerCase();
      const stageMatch =
        !stageFilter || (i.stage || "").toLowerCase().includes(stageFilter);
      const statusMatch =
        !statusFilter || (i.status || "").toLowerCase().includes(statusFilter);
      const searchMatch = !s || text.includes(s);
      return stageMatch && statusMatch && searchMatch;
    });

    return filtered;
  }

  const filteredRecruitmentData = applyFilters(records);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecruitmentData.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredRecruitmentData.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Summary numbers for cards
  const totalItems = records.length;
  const appliedItems = records.filter(
    (i) => i.stage?.toLowerCase() === "applied"
  ).length;
  const screeningItems = records.filter(
    (i) => i.stage?.toLowerCase() === "screening"
  ).length;
  const interviewItems = records.filter(
    (i) => i.stage?.toLowerCase() === "interview"
  ).length;
  const finalReviewItems = records.filter(
    (i) => i.stage?.toLowerCase() === "final review"
  ).length;

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  // Pagination function
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredRecruitmentData.length / rowsPerPage)
    );
    const hasNoData = filteredRecruitmentData.length === 0;

    const buttons = [];

    buttons.push(
      <button
        key="prev"
        className={`${styles.paginationBtn} ${
          hasNoData ? styles.disabled : ""
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
        className={`${styles.paginationBtn} ${
          1 === currentPage ? styles.active : ""
        } ${hasNoData ? styles.disabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.paginationEllipsis}>
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
            className={`${styles.paginationBtn} ${
              i === currentPage ? styles.active : ""
            } ${hasNoData ? styles.disabled : ""}`}
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
        <span key="ellipsis2" className={styles.paginationEllipsis}>
          ...
        </span>
      );
    }

    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.paginationBtn} ${
            pageCount === currentPage ? styles.active : ""
          } ${hasNoData ? styles.disabled : ""}`}
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
        className={`${styles.paginationBtn} ${
          hasNoData ? styles.disabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return (
      <div className={`${styles.paginationContainer} ${styles.topPagination}`}>
        {buttons}
      </div>
    );
  };

  // Function to handle retry when connection fails
  const handleRetryConnection = () => {
    setLoadingProgress(0);
    fetchRecruitmentData();
  };

  return (
    <>
      {/* BFP Preloader */}
      <BFPPreloader
        loading={initialLoading}
        progress={loadingProgress}
        moduleTitle="RECRUITMENT DASHBOARD • Screening Candidates..."
        onRetry={handleRetryConnection}
      />

      <div className={styles.container}>
        <Title>Recruitment Personnel | BFP Villanueva</Title>
        <Meta name="robots" content="noindex, nofollow" />
        <FloatingNotificationBell userId={userId} />

        <Hamburger />
        <Sidebar />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <h1>Recruitment Personnel</h1>

          {/* Top Controls */}
          <div className={styles.topControls}>
            <div className={styles.tableHeader}>
              <select
                className={styles.filterType}
                value={filterStage}
                onChange={(e) => {
                  setFilterStage(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Stages</option>
                <option>Applied</option>
                <option>Screening</option>
                <option>Interview</option>
                <option>Final Review</option>
              </select>

              <select
                className={styles.filterType}
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Status</option>
                <option>Pending</option>
                <option>Approved</option>
                <option>Rejected</option>
              </select>

              <input
                type="text"
                className={styles.searchBar}
                placeholder="🔍 Search candidates..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {/* Summary Cards */}
          <div className={styles.summary}>
            <button
              className={`${styles.summaryCard} ${styles.total} ${
                currentFilterCard === "total" ? styles.active : ""
              }`}
              onClick={() => handleCardClick("total")}
            >
              <h3>Total Candidates</h3>
              <p>{totalItems}</p>
            </button>
            <button
              className={`${styles.summaryCard} ${styles.applied} ${
                currentFilterCard === "applied" ? styles.active : ""
              }`}
              onClick={() => handleCardClick("applied")}
            >
              <h3>Applied</h3>
              <p>{appliedItems}</p>
            </button>
            <button
              className={`${styles.summaryCard} ${styles.screening} ${
                currentFilterCard === "screening" ? styles.active : ""
              }`}
              onClick={() => handleCardClick("screening")}
            >
              <h3>Screening</h3>
              <p>{screeningItems}</p>
            </button>
            <button
              className={`${styles.summaryCard} ${styles.interview} ${
                currentFilterCard === "interview" ? styles.active : ""
              }`}
              onClick={() => handleCardClick("interview")}
            >
              <h3>Interview</h3>
              <p>{interviewItems}</p>
            </button>
            <button
              className={`${styles.summaryCard} ${styles.final} ${
                currentFilterCard === "final" ? styles.active : ""
              }`}
              onClick={() => handleCardClick("final")}
            >
              <h3>Final Review</h3>
              <p>{finalReviewItems}</p>
            </button>
          </div>

          {/* Form Card */}
          <div className={styles.card}>
            <h2>Add New Candidate</h2>
            <button
              className={`${styles.showFormBtn} ${styles.submit}${
                showForm ? styles.showing : ""
              }`}
              onClick={() => setShowForm(!showForm)}
              type="button"
              disabled={submitting || initialLoading}
            >
              {showForm ? "Hide Form" : "Add New Candidate"}
            </button>

            {/* Upload Progress Bar */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className={styles.progressBarContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${uploadProgress}%` }}
                >
                  Uploading... {uploadProgress}%
                </div>
              </div>
            )}

            <form
              className={`${styles.form} ${styles.layout} ${
                showForm ? styles.show : ""
              }`}
              onSubmit={handleSubmit}
            >
              {/* Left: Photo Section */}
              <div className={styles.photoSection}>
                <div className={styles.photoPreview}>
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Candidate preview"
                      className={styles.photoImage}
                    />
                  ) : (
                    <span>No Photo</span>
                  )}
                </div>
                <div className={styles.fileUpload}>
                  <label htmlFor="photo" className={styles.fileUploadLabel}>
                    📂 Upload Photo (Max 5MB)
                  </label>
                  <input
                    type="file"
                    id="photo"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    disabled={submitting || initialLoading}
                  />
                  <span>
                    {photoFile ? photoFile.name : "No photo selected"}
                  </span>
                </div>

                {/* Resume Upload */}
                <div
                  className={styles.fileUpload}
                  style={{ marginTop: "20px" }}
                >
                  <label htmlFor="resume" className={styles.fileUploadLabel}>
                    📄 Upload Resume (PDF/DOC, Max 10MB)
                  </label>
                  <input
                    type="file"
                    id="resume"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleResumeChange}
                    disabled={submitting || initialLoading}
                  />
                  <span>{resumeFileName || "No resume selected"}</span>
                </div>
              </div>

              {/* Right: Info fields - FIXED LAYOUT */}
              <div className={styles.infoSection}>
                {/* Row 1: Candidate Name and Position */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="candidate"
                        className={styles.floatingInput}
                        placeholder=" "
                        value={addFormData.candidate}
                        onChange={handleAddInputChange}
                        required
                        disabled={submitting || initialLoading}
                      />
                      <label
                        htmlFor="candidate"
                        className={styles.floatingLabel}
                      >
                        Candidate Name *
                      </label>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="position"
                        className={styles.floatingInput}
                        placeholder=" "
                        value={addFormData.position}
                        onChange={handleAddInputChange}
                        required
                        disabled={submitting || initialLoading}
                      />
                      <label
                        htmlFor="position"
                        className={styles.floatingLabel}
                      >
                        Position *
                      </label>
                    </div>
                  </div>
                </div>

                {/* Row 2: Username and Password */}
                {/* Row 2: Username and Password - FIXED VERSION */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <div className={styles.floatingGroup}>
                      <input
                        type="text"
                        id="username"
                        className={styles.floatingInput}
                        placeholder=" "
                        value={addUsername}
                        onChange={(e) => setAddUsername(e.target.value)}
                        required
                        disabled={submitting || initialLoading}
                      />
                      <label
                        htmlFor="username"
                        className={styles.floatingLabel}
                      >
                        Username *
                      </label>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <div className={styles.floatingGroup}>
                      <div className={styles.passwordInputContainer}>
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          className={styles.floatingInput}
                          placeholder=" "
                          value={addPassword}
                          onChange={(e) => setAddPassword(e.target.value)}
                          required
                          disabled={submitting || initialLoading}
                        />
                        <label
                          htmlFor="password"
                          className={styles.floatingLabel}
                        >
                          Password *
                        </label>
                        <button
                          type="button"
                          className={styles.eyeToggleBtn}
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={submitting || initialLoading}
                        >
                          {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.generatePasswordBtn}
                      onClick={handleGeneratePassword}
                      disabled={submitting || initialLoading}
                    >
                      Generate
                    </button>
                  </div>
                </div>
                {/* Row 3: Application Date and Stage */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <div className={styles.floatingGroup}>
                      <Flatpickr
                        value={addFormData.applicationDate}
                        onChange={([date]) =>
                          setAddFormData((prev) => ({
                            ...prev,
                            applicationDate: date
                              ? date.toISOString().split("T")[0]
                              : "",
                          }))
                        }
                        options={{
                          dateFormat: "Y-m-d",
                          maxDate: "today",
                        }}
                        className={styles.floatingInput}
                        placeholder=" "
                        disabled={submitting || initialLoading}
                      />
                      <label
                        htmlFor="applicationDate"
                        className={styles.floatingLabel}
                      >
                        Application Date
                      </label>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <div className={styles.floatingGroup}>
                      <select
                        id="stage"
                        className={styles.floatingSelect}
                        value={addFormData.stage}
                        onChange={handleAddInputChange}
                        required
                        disabled={submitting || initialLoading}
                        style={{
                          backgroundColor:
                            getOptionColor("stage", addFormData.stage) ||
                            "#fff",
                          color: getOptionColor("stage", addFormData.stage)
                            ? "#fff"
                            : "#000",
                        }}
                      >
                        <option value="" disabled></option>
                        <option value="Applied">Applied</option>
                        <option value="Screening">Screening</option>
                        <option value="Interview">Interview</option>
                        <option value="Final Review">Final Review</option>
                      </select>
                      <label htmlFor="stage" className={styles.floatingLabel}>
                        Select Stage *
                      </label>
                    </div>
                  </div>
                </div>

                {/* Row 4: Interview Date and Status */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <div className={styles.floatingGroup}>
                      <Flatpickr
                        value={addFormData.interviewDate}
                        onChange={([date]) =>
                          setAddFormData((prev) => ({
                            ...prev,
                            interviewDate: date
                              ? date.toISOString().split("T")[0]
                              : "",
                          }))
                        }
                        options={{
                          dateFormat: "Y-m-d",
                        }}
                        className={styles.floatingInput}
                        placeholder=" "
                        disabled={submitting || initialLoading}
                      />
                      <label
                        htmlFor="interviewDate"
                        className={styles.floatingLabel}
                      >
                        Interview Date
                      </label>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <div className={styles.floatingGroup}>
                      <select
                        id="status"
                        className={styles.floatingSelect}
                        value={addFormData.status}
                        onChange={handleAddInputChange}
                        required
                        disabled={submitting || initialLoading}
                        style={{
                          backgroundColor:
                            getOptionColor("status", addFormData.status) ||
                            "#fff",
                          color: getOptionColor("status", addFormData.status)
                            ? "#fff"
                            : "#000",
                        }}
                      >
                        <option value="" disabled></option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                      <label htmlFor="status" className={styles.floatingLabel}>
                        Select Status *
                      </label>
                    </div>
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.cancel}
                    onClick={() => {
                      resetAddForm();
                      setShowForm(false);
                    }}
                    disabled={submitting || initialLoading}
                  >
                    Clear Information
                  </button>
                  <button
                    type="submit"
                    className={styles.submit}
                    disabled={submitting || initialLoading}
                  >
                    {submitting ? "Processing..." : "Add Candidate"}
                  </button>
                </div>
              </div>
            </form>
          </div>
          {/* Table Section */}
          <div className={styles.tableHeaderSection}>
            <h2>All Recruitment Records</h2>
            {renderPaginationButtons()}
          </div>

          {/* Table with Scrollbar Container */}
          <div className={styles.tableBorder}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Username</th>
                  <th>Password</th>
                  <th>Application Date</th>
                  <th>Stage</th>
                  <th>Interview Date</th>
                  <th>Status</th>
                  <th>Resume</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialLoading ? (
                  <tr>
                    <td
                      colSpan="11"
                      style={{ textAlign: "center", padding: "40px" }}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                        <span className={styles.animatedEmoji}>⏳</span>
                      </div>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#2b2b2b",
                        }}
                      >
                        Loading recruitment data...
                      </h3>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan="11"
                      style={{ textAlign: "center", padding: "40px" }}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                        <span className={styles.animatedEmoji}>📇</span>
                      </div>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#2b2b2b",
                        }}
                      >
                        No Recruitment Records
                      </h3>
                      <p style={{ fontSize: "14px", color: "#999" }}>
                        Add your first candidate to get started
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginated.map((record) => (
                    <tr key={record.id}>
                      <td>
                        {record.photo_url ? (
                          <div className={styles.photoCell}>
                            <img
                              src={record.photo_url}
                              alt={record.candidate}
                              className={styles.tablePhoto}
                              onClick={() => viewPhoto(record.photo_url)}
                              title="Click to view full photo"
                            />
                          </div>
                        ) : (
                          <div className={styles.noPhoto}>No Photo</div>
                        )}
                      </td>
                      <td>{record.candidate}</td>
                      <td>{record.position}</td>
                      <td>{record.username || "N/A"}</td>
                      <PasswordCell password={record.password} />
                      <td>{formatDate(record.application_date)}</td>
                      <td>
                        <span
                          className={styles.status}
                          style={{
                            backgroundColor: getOptionColor(
                              "stage",
                              record.stage
                            ),
                            color: "#fff",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {record.stage}
                        </span>
                      </td>
                      <td>{formatDate(record.interview_date)}</td>
                      <td>
                        <span
                          className={styles.status}
                          style={{
                            backgroundColor: getOptionColor(
                              "status",
                              record.status
                            ),
                            color: "#fff",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td>
                        {record.resume_url ? (
                          <div className={styles.resumeCell}>
                            <button
                              className={styles.resumeBtn}
                              onClick={() => viewResume(record.resume_url)}
                              title={`View ${getFileNameFromUrl(
                                record.resume_url
                              )}`}
                            >
                              📄 View Resume
                            </button>
                            <div className={styles.resumeInfo}>
                              <small>
                                {getFileNameFromUrl(record.resume_url)}
                              </small>
                            </div>
                          </div>
                        ) : (
                          <span className={styles.noResume}>No Resume</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.editBtn}
                            onClick={() => handleEdit(record.id)}
                            disabled={submitting || initialLoading}
                          >
                            Edit
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(record.id)}
                            disabled={submitting || initialLoading}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Delete Confirmation Modal */}
          {/* Delete Confirmation Modal - Updated to match Personnel Register */}
          {showDeleteModal && (
            <div className={`${styles.preModalDelete} ${styles.show}`}>
              <div
                className={styles.preModalContentDelete}
                style={{ maxWidth: "450px" }}
              >
                <div className={styles.preModalHeaderDelete}>
                  <h2 style={{ marginLeft: "30px" }}>Confirm Deletion</h2>
                  <span className={styles.preCloseBtn} onClick={cancelDelete}>
                    &times;
                  </span>
                </div>

                <div className={styles.preModalBody}>
                  <div className={styles.deleteConfirmationContent}>
                    <div className={styles.deleteWarningIcon}>⚠️</div>
                    <p className={styles.deleteConfirmationText}>
                      Are you sure you want to delete the candidate record for
                    </p>
                    <p className={styles.documentNameHighlight}>
                      "
                      {records.find((record) => record.id === deleteId)
                        ?.candidate || "this candidate"}
                      "?
                    </p>
                    <p className={styles.deleteWarning}>
                      This action cannot be undone. All associated files (photo
                      and resume) will also be deleted.
                    </p>
                  </div>
                </div>

                <div className={styles.preModalActions}>
                  <button
                    className={`${styles.preBtn} ${styles.preCancelBtn}`}
                    onClick={cancelDelete}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    className={`${styles.preBtn} ${styles.deleteConfirmBtn} ${
                      submitting ? styles.deleteConfirmBtnLoading : ""
                    }`}
                    onClick={confirmDelete}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className={styles.deleteSpinner}></span>
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* EDIT MODAL */}
          {showEditModal && (
            <div className={`${styles.modal} ${styles.show}`}>
              <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                  <h2>
                    Edit Candidate - {editFormData.candidate || "Candidate"}
                  </h2>
                  <button
                    className={styles.ShowEditModalCloseBtn}
                    onClick={handleCloseEditModal}
                  >
                    &times;
                  </button>
                </div>

                <form
                  id="edit-form"
                  onSubmit={handleUpdateCandidate}
                  className={styles.prEditModalLayout}
                >
                  {/* Photo Section */}
                  <div className={styles.prEditModalPhotoSection}>
                    <div className={styles.prEditModalPhotoPreview}>
                      {editPhotoPreview || editFormData.photoUrl ? (
                        <img
                          src={editPhotoPreview || editFormData.photoUrl}
                          alt="Candidate preview"
                          className={styles.photoImage}
                        />
                      ) : (
                        <div className={styles.prNoPhotoPreview}>
                          <span className={styles.prNoPhotoIcon}>📷</span>
                          <span>No Photo</span>
                        </div>
                      )}
                    </div>

                    <div className={styles.prEditModalFileUpload}>
                      <label
                        className={styles.prEditModalFileUploadLabel}
                        htmlFor="edit-photo"
                      >
                        <input
                          type="file"
                          id="edit-photo"
                          ref={editPhotoInputRef}
                          accept="image/*"
                          onChange={handleEditPhotoChange}
                          style={{ display: "none" }}
                          disabled={isSavingEdit}
                        />
                        {editPhotoPreview || editFormData.photoUrl
                          ? "Change Photo"
                          : "Upload Photo"}
                      </label>
                      <span>
                        {editPhotoFile
                          ? editPhotoFile.name
                          : editFormData.photoUrl
                          ? "Current photo"
                          : "No photo selected"}
                      </span>

                      {(editPhotoPreview || editFormData.photoUrl) && (
                        <button
                          type="button"
                          className={styles.prEditModalClearBtn}
                          onClick={clearEditPhoto}
                          disabled={isSavingEdit}
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>

                    {/* Resume Upload Section */}
                    <div
                      className={styles.prEditModalFileUpload}
                      style={{ marginTop: "20px" }}
                    >
                      <label
                        className={styles.prEditModalFileUploadLabel}
                        htmlFor="edit-resume"
                      >
                        <input
                          type="file"
                          id="edit-resume"
                          ref={editResumeInputRef}
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={handleEditResumeChange}
                          style={{ display: "none" }}
                          disabled={isSavingEdit}
                        />
                        {editResumeFile || editFormData.resumeUrl
                          ? "Change Resume"
                          : "Upload Resume"}
                      </label>
                      <span>
                        {editResumeFile
                          ? editResumeFile.name
                          : resumeFileName || "No resume selected"}
                      </span>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div style={{ flex: 1 }}>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="text"
                            id="edit-candidate"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.candidate}
                            onChange={handleEditInputChange}
                            required
                            disabled={isSavingEdit}
                          />
                          <label
                            htmlFor="edit-candidate"
                            className={styles.floatingLabel}
                          >
                            Candidate Name *
                          </label>
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="text"
                            id="edit-position"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editFormData.position}
                            onChange={handleEditInputChange}
                            required
                            disabled={isSavingEdit}
                          />
                          <label
                            htmlFor="edit-position"
                            className={styles.floatingLabel}
                          >
                            Position *
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <div className={styles.floatingGroup}>
                          <input
                            type="text"
                            id="edit-username"
                            className={styles.floatingInput}
                            placeholder=" "
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            required
                            disabled={isSavingEdit}
                          />
                          <label
                            htmlFor="edit-username"
                            className={styles.floatingLabel}
                          >
                            Username *
                          </label>
                        </div>
                      </div>

                      {/* FIXED EDIT MODAL PASSWORD INPUT WITH FLOATING LABEL */}
                      <div className={styles.formGroup}>
                        <div className={styles.floatingGroup}>
                          <div className={styles.passwordInputContainer}>
                            <input
                              type={showPassword ? "text" : "password"}
                              id="edit-password"
                              className={styles.floatingInput}
                              placeholder=" "
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              required
                              disabled={isSavingEdit}
                            />
                            <label
                              htmlFor="edit-password"
                              className={styles.floatingLabel}
                            >
                              Password *
                            </label>
                            <button
                              type="button"
                              className={styles.eyeToggleBtn}
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={isSavingEdit}
                            >
                              {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.generatePasswordBtn}
                          onClick={handleGeneratePasswordEdit}
                          disabled={isSavingEdit}
                          style={{ marginTop: "5px" }}
                        >
                          Generate New Password
                        </button>
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <div className={styles.floatingGroup}>
                          <Flatpickr
                            value={editFormData.applicationDate}
                            onChange={([date]) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                applicationDate: date
                                  ? date.toISOString().split("T")[0]
                                  : "",
                              }))
                            }
                            options={{
                              dateFormat: "Y-m-d",
                              maxDate: "today",
                            }}
                            className={styles.floatingInput}
                            placeholder=" "
                            disabled={isSavingEdit}
                          />
                          <label
                            htmlFor="edit-applicationDate"
                            className={styles.floatingLabel}
                          >
                            Application Date
                          </label>
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <div className={styles.floatingGroup}>
                          <select
                            id="stage"
                            className={styles.floatingSelect}
                            value={editFormData.stage}
                            onChange={handleEditInputChange}
                            required
                            disabled={isSavingEdit}
                            style={{
                              backgroundColor:
                                getOptionColor("stage", editFormData.stage) ||
                                "#fff",
                              color: getOptionColor("stage", editFormData.stage)
                                ? "#fff"
                                : "#000",
                            }}
                          >
                            <option value="" disabled></option>
                            <option value="Applied">Applied</option>
                            <option value="Screening">Screening</option>
                            <option value="Interview">Interview</option>
                            <option value="Final Review">Final Review</option>
                          </select>
                          <label
                            htmlFor="stage"
                            className={styles.floatingLabel}
                          >
                            Select Stage *
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <div className={styles.floatingGroup}>
                          <Flatpickr
                            value={editFormData.interviewDate}
                            onChange={([date]) =>
                              setEditFormData((prev) => ({
                                ...prev,
                                interviewDate: date
                                  ? date.toISOString().split("T")[0]
                                  : "",
                              }))
                            }
                            options={{
                              dateFormat: "Y-m-d",
                            }}
                            className={styles.floatingInput}
                            placeholder=" "
                            disabled={isSavingEdit}
                          />
                          <label
                            htmlFor="edit-interviewDate"
                            className={styles.floatingLabel}
                          >
                            Interview Date
                          </label>
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <div className={styles.floatingGroup}>
                          <select
                            id="status"
                            className={styles.floatingSelect}
                            value={editFormData.status}
                            onChange={handleEditInputChange}
                            required
                            disabled={isSavingEdit}
                            style={{
                              backgroundColor:
                                getOptionColor("status", editFormData.status) ||
                                "#fff",
                              color: getOptionColor(
                                "status",
                                editFormData.status
                              )
                                ? "#fff"
                                : "#000",
                            }}
                          >
                            <option value="" disabled></option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                          <label
                            htmlFor="status"
                            className={styles.floatingLabel}
                          >
                            Select Status *
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className={styles.formActions}>
                      <button
                        type="button"
                        className={styles.cancel}
                        onClick={handleCloseEditModal}
                        disabled={isSavingEdit}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={styles.submit}
                        disabled={isSavingEdit}
                      >
                        {isSavingEdit ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RecruitmentPersonnel;
