import React, { useState, useEffect } from "react";
import styles from "../styles/Trainings.module.css";
import Sidebar from "../../Sidebar.jsx";
import Hamburger from "../../Hamburger.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import BFPPreloader from "../../BFPPreloader.jsx";
import { filterActivePersonnel } from "../../filterActivePersonnel.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FloatingNotificationBell from "../../FloatingNotificationBell.jsx";
import { useUserId } from "../../hooks/useUserId.js";
// Import the default logo image
import logo from "../../../assets/Firefighter.png"; // Adjust the path as needed

const Trainings = () => {
  const [trainings, setTrainings] = useState([]);
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
  const [filterStatus, setFilterStatus] = useState("");
  const [currentFilterCard, setCurrentFilterCard] = useState("total");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [formData, setFormData] = useState({
    personnelId: "",
    fullName: "",
    rank: "",
    dateOfTraining: "",
    days: "",
    status: "Pending",
    certificateUrl: "",
  });

  // File upload states
  const [certificateFile, setCertificateFile] = useState(null);
  const [certificateFileName, setCertificateFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  // Define rank images (simplified version)
  const rankImages = {
    FO1: "FO1.png",
    FO2: "FO2.png",
    FO3: "FO3.png",
    SFO1: "SFO1.png",
    SFO2: "SFO2.png",
    SFO3: "SFO3.png",
    SFO4: "SFO4.png",
    CINSP: "CINSP.png",
    SINSP: "SINSP.png",
    INSP: "INSP.png",
    SUPT: "SUPT.png",
  };

  // Helper function to get rank image URL
  const getRankImageUrl = (rank) => {
    if (!rank) return null;

    const normalizedRank = rank.toUpperCase();
    const imageName = rankImages[normalizedRank];

    if (!imageName) return null;

    // Get the base URL from your supabase client or use a relative path
    try {
      // Try to get from environment variable
      const supabaseUrl =
        import.meta.env?.VITE_SUPABASE_URL ||
        "https://wqjzbyblmcrxafcbljij.supabase.co";

      return `${supabaseUrl}/storage/v1/object/public/rank_images/${imageName}`;
    } catch (error) {
      console.warn("Could not construct image URL:", error);
      return null;
    }
  };

  useEffect(() => {
    loadPersonnel();
    loadTrainings();
  }, []);

  // Update loading progress
  const updateLoadingProgress = (progress) => {
    setLoadingProgress(progress);
  };

  // Load personnel from Supabase
  const loadPersonnel = async () => {
    try {
      updateLoadingProgress(10);

      const { data, error } = await supabase
        .from("personnel")
        .select("*")
        .order("last_name", { ascending: true });

      if (error) {
        console.error("Error loading personnel:", error);
        return;
      }

      const activePersonnel = filterActivePersonnel(data || []);
      console.log(
        `Trainings System: Loaded ${activePersonnel.length} active personnel`
      );

      setPersonnel(activePersonnel);
    } catch (error) {
      console.error("Error in loadPersonnel:", error);
    }
  };

  // Load trainings from Supabase with personnel data - UPDATED to include personnel photo
  const loadTrainings = async () => {
    try {
      setLoading(true);
      updateLoadingProgress(20);

      const { data: trainingsData, error: trainingsError } = await supabase
        .from("trainings")
        .select("*")
        .order("created_at", { ascending: false });

      if (trainingsError) {
        console.error("Error loading trainings:", trainingsError);

        if (trainingsError.message.includes("does not exist")) {
          updateLoadingProgress(30);
          await createTrainingsTable();
          setTrainings([]);
          setLoading(false);
          updateLoadingProgress(100);

          setTimeout(() => {
            setShowPreloader(false);
          }, 500);
          return;
        }
        return;
      }

      updateLoadingProgress(40);

      const trainingsWithPersonnel = await Promise.all(
        (trainingsData || []).map(async (training) => {
          try {
            const { data: personnelData, error: personnelError } =
              await supabase
                .from("personnel")
                .select("*")
                .eq("id", training.personnel_id)
                .single();

            if (personnelError) {
              console.error(
                "Error loading personnel for training:",
                personnelError
              );
              return {
                id: training.id,
                name: "Unknown",
                rank: "Unknown",
                date: training.training_date || "",
                days: training.duration_days || "",
                status: training.status || "Pending",
                personnelId: training.personnel_id,
                certificateUrl: training.certificate_url || "",
                created_at: training.created_at,
                isActive: false,
              };
            }

            const isActive = filterActivePersonnel([personnelData]).length > 0;
            const rankImageUrl = getRankImageUrl(personnelData.rank);

            const fullName = `${personnelData.first_name} ${
              personnelData.middle_name || ""
            } ${personnelData.last_name}`.trim();

            return {
              id: training.id,
              name: fullName,
              rank: personnelData.rank || "Unknown",
              rankImage: rankImageUrl,
              date: training.training_date || "",
              days: training.duration_days || "",
              status: training.status || "Pending",
              personnelId: training.personnel_id,
              certificateUrl: training.certificate_url || "",
              created_at: training.created_at,
              isActive: isActive,
              // Add personnel photo data
              personnelPhotoUrl: personnelData.photo_url || null,
              personnelPhotoPath: personnelData.photo_path || null,
            };
          } catch (error) {
            console.error("Error processing training:", error);
            return {
              id: training.id,
              name: "Error Loading",
              rank: "Error",
              rankImage: null,
              date: training.training_date || "",
              days: training.duration_days || "",
              status: training.status || "Pending",
              personnelId: training.personnel_id,
              certificateUrl: training.certificate_url || "",
              created_at: training.created_at,
              isActive: false,
              personnelPhotoUrl: null,
              personnelPhotoPath: null,
            };
          }
        })
      );

      updateLoadingProgress(80);

      const activeTrainings = trainingsWithPersonnel.filter(
        (training) => training.isActive
      );

      console.log(`Trainings: ${activeTrainings.length} active trainings`);

      setTrainings(activeTrainings);
      setLoading(false);
      updateLoadingProgress(90);

      setTimeout(() => {
        updateLoadingProgress(100);
        setTimeout(() => {
          setShowPreloader(false);
        }, 500);
      }, 300);
    } catch (error) {
      console.error("Error in loadTrainings:", error);
      setLoading(false);
      setShowPreloader(false);
    }
  };

  // Handle retry from preloader
  const handleRetryFromPreloader = () => {
    setShowPreloader(true);
    setLoadingProgress(0);
    loadPersonnel();
    loadTrainings();
  };

  // Create trainings table if it doesn't exist
  const createTrainingsTable = async () => {
    try {
      console.log("Creating trainings table...");
      // ... keep your existing createTrainingsTable code ...
    } catch (error) {
      console.error("Error creating table:", error);
    }
  };

  // Test if image URL is accessible
  const testImage = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;

      // Timeout to prevent hanging
      setTimeout(() => resolve(false), 3000);
    });
  };

  // Component to display personnel photo with loading state
  const PersonnelPhotoCell = ({ training }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [imageSrc, setImageSrc] = useState(logo); // Use imported default image

    useEffect(() => {
      const loadPhoto = async () => {
        setIsLoading(true);

        try {
          let url = logo; // Default to your imported image

          // Check in order of priority
          if (
            training.personnelPhotoUrl &&
            training.personnelPhotoUrl.startsWith("http")
          ) {
            // Test if the photo_url is accessible
            const isValid = await testImage(training.personnelPhotoUrl);
            if (isValid) {
              url = training.personnelPhotoUrl;
            } else {
              // Try photo_path as fallback
              if (training.personnelPhotoPath) {
                const { data: urlData } = supabase.storage
                  .from("personnel-documents")
                  .getPublicUrl(training.personnelPhotoPath);
                const pathUrl = urlData?.publicUrl;
                // Check if the path URL is valid
                if (pathUrl && (await testImage(pathUrl))) {
                  url = pathUrl;
                } else {
                  url = logo; // Fallback to default
                }
              }
            }
          } else if (training.personnelPhotoPath) {
            // Use photo_path if photo_url is not available
            const { data: urlData } = supabase.storage
              .from("personnel-documents")
              .getPublicUrl(training.personnelPhotoPath);
            const pathUrl = urlData?.publicUrl;
            // Check if the path URL is valid
            if (pathUrl && (await testImage(pathUrl))) {
              url = pathUrl;
            } else {
              url = logo; // Fallback to default
            }
          }

          setImageSrc(url);
        } catch (error) {
          console.error("Error loading photo:", error);
          setImageSrc(logo); // Fallback to default image on error
        } finally {
          // Small delay to prevent flash
          setTimeout(() => setIsLoading(false), 100);
        }
      };

      loadPhoto();
    }, [training]);

    return (
      <div className={styles.personnelPhotoCell}>
        <div className={styles.personnelPhotoContainer}>
          {isLoading ? (
            <div className={styles.personnelPhotoLoading}>
              <div className={styles.personnelPhotoSpinner}></div>
              <small>Loading...</small>
            </div>
          ) : (
            <img
              src={imageSrc}
              alt={training.name}
              className={styles.personnelPhotoThumb}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = logo; // Fallback to default image on load error
              }}
              loading="lazy"
            />
          )}
        </div>
      </div>
    );
  };

  // Handle file selection for certificate
  const handleCertificateChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      const fileExtension = file.name.split(".").pop().toLowerCase();
      const isValidType =
        allowedTypes.includes(file.type) ||
        ["pdf", "jpeg", "jpg", "png", "doc", "docx"].includes(fileExtension);

      if (!isValidType) {
        alert(
          "Please select a PDF, image, or Word document (PDF, JPEG, PNG, DOC, DOCX)"
        );
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("Certificate file size should be less than 10MB");
        return;
      }

      setCertificateFile(file);
      setCertificateFileName(file.name);
      setUploadError("");
    }
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file, folderName) => {
    try {
      setUploadError("");
      const fileExt = file.name.split(".").pop();
      const uniqueFileName = `${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}.${fileExt}`;
      const filePath = `${folderName}/${uniqueFileName}`;

      const { data, error } = await supabase.storage
        .from("training-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Upload error details:", error);
        if (error.message.includes("row-level security policy")) {
          setUploadError("Storage RLS policy is blocking uploads.");
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result);
            };
            reader.readAsDataURL(file);
          });
        }
        throw error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("training-files").getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error in uploadFile:", error);
      setUploadError(`Upload failed: ${error.message}`);
      throw error;
    }
  };

  // Delete file from Supabase Storage
  const deleteFile = async (url) => {
    if (!url) return;

    try {
      if (url.startsWith("data:")) {
        console.log("Skipping deletion of data URL");
        return;
      }

      const urlParts = url.split("/");
      const bucketIndex = urlParts.indexOf("training-files");

      if (bucketIndex === -1) {
        console.error("Invalid URL format for storage file");
        return;
      }

      const filePath = urlParts.slice(bucketIndex + 1).join("/");
      const { error } = await supabase.storage
        .from("training-files")
        .remove([filePath]);

      if (error) {
        console.error("Error deleting file:", error);
      }
    } catch (error) {
      console.error("Error in deleteFile:", error);
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;

    if (id === "personnelId") {
      const selectedPerson = personnel.find((p) => p.id === value);

      if (selectedPerson) {
        const fullName = `${selectedPerson.first_name} ${
          selectedPerson.middle_name || ""
        } ${selectedPerson.last_name}`.trim();

        setFormData((prev) => ({
          ...prev,
          personnelId: value,
          fullName: fullName,
          rank: selectedPerson.rank || "",
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [id]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setUploadProgress(0);
      setUploadError("");

      let certificateUrl = formData.certificateUrl;

      if (certificateFile) {
        try {
          setUploadProgress(30);
          certificateUrl = await uploadFile(certificateFile, "certificates");
          setUploadProgress(80);
        } catch (uploadError) {
          console.error("Certificate upload failed:", uploadError);
        }
      }

      const trainingData = {
        personnel_id: formData.personnelId,
        training_date: formData.dateOfTraining,
        duration_days: parseInt(formData.days, 10) || 1,
        status: formData.status,
        certificate_url: certificateUrl || null,
        updated_at: new Date().toISOString(),
      };

      if (editingTraining !== null) {
        const { error } = await supabase
          .from("trainings")
          .update(trainingData)
          .eq("id", editingTraining.id);

        if (error) {
          console.error("Error updating training:", error);
          alert("Failed to update training. Please try again.");
          return;
        }

        if (
          certificateFile &&
          formData.certificateUrl &&
          !formData.certificateUrl.startsWith("data:")
        ) {
          setTimeout(() => {
            deleteFile(formData.certificateUrl);
          }, 1000);
        }
      } else {
        trainingData.created_at = new Date().toISOString();
        const { error } = await supabase
          .from("trainings")
          .insert([trainingData]);

        if (error) {
          console.error("Error adding training:", error);
          alert("Failed to add training. Please try again.");
          return;
        }
      }

      setUploadProgress(100);
      await loadTrainings();
      closeAllForms();

      setTimeout(() => {
        setUploadProgress(0);
        alert(
          editingTraining !== null
            ? "Training updated successfully!"
            : "Training added successfully!"
        );
      }, 500);
    } catch (error) {
      console.error("Error saving training:", error);
      alert("An error occurred. Please try again.");
      setUploadProgress(0);
    }
  };

  const addNewTraining = () => {
    setFormData({
      personnelId: "",
      fullName: "",
      rank: "",
      dateOfTraining: "",
      days: "",
      status: "Pending",
      certificateUrl: "",
    });
    setCertificateFile(null);
    setCertificateFileName("");
    setEditingTraining(null);
    setUploadError("");
    openSidebar();
  };

  const editTraining = (training) => {
    setFormData({
      personnelId: training.personnelId,
      fullName: training.name,
      rank: training.rank,
      dateOfTraining: training.date,
      days: training.days,
      status: training.status || "Pending",
      certificateUrl: training.certificateUrl || "",
    });
    setCertificateFile(null);
    setCertificateFileName(
      training.certificateUrl ? training.certificateUrl.split("/").pop() : ""
    );
    setEditingTraining(training);
    setUploadError("");
    openModal();
  };

  const deleteTrainingRecord = async (index) => {
    const training = trainings[index];

    if (window.confirm("Are you sure you want to delete this training?")) {
      try {
        if (
          training.certificateUrl &&
          !training.certificateUrl.startsWith("data:")
        ) {
          await deleteFile(training.certificateUrl);
        }

        const { error } = await supabase
          .from("trainings")
          .delete()
          .eq("id", training.id);

        if (error) {
          console.error("Error deleting training:", error);
          alert("Failed to delete training. Please try again.");
          return;
        }

        await loadTrainings();
        alert("Training deleted successfully!");
      } catch (error) {
        console.error("Error in deleteTrainingRecord:", error);
        alert("An error occurred. Please try again.");
      }
    }
  };

  // Function to view/download certificate
  const viewCertificate = (url) => {
    if (url) {
      if (url.startsWith("data:")) {
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(
            `<img src="${url}" style="max-width:100%; height:auto;" />`
          );
        }
      } else {
        window.open(url, "_blank");
      }
    } else {
      alert("No certificate available for this training.");
    }
  };

  const openSidebar = () => setIsFormOpen(true);
  const openModal = () => setIsModalOpen(true);

  const closeAllForms = () => {
    setIsFormOpen(false);
    setIsModalOpen(false);
    setEditingTraining(null);
    setFormData({
      personnelId: "",
      fullName: "",
      rank: "",
      dateOfTraining: "",
      days: "",
      status: "Pending",
      certificateUrl: "",
    });
    setCertificateFile(null);
    setCertificateFileName("");
    setUploadProgress(0);
    setUploadError("");
  };

  // Filtering & pagination logic
  function applyFilters(items) {
    let filtered = [...items];

    if (currentFilterCard === "pending") {
      filtered = filtered.filter((i) => i.status?.toLowerCase() === "pending");
    } else if (currentFilterCard === "completed") {
      filtered = filtered.filter(
        (i) => i.status?.toLowerCase() === "completed"
      );
    } else if (currentFilterCard === "ongoing") {
      filtered = filtered.filter((i) => i.status?.toLowerCase() === "ongoing");
    } else if (currentFilterCard === "cancelled") {
      filtered = filtered.filter(
        (i) => i.status?.toLowerCase() === "cancelled"
      );
    }

    const s = search.trim().toLowerCase();
    const statusFilter = filterStatus.trim().toLowerCase();

    filtered = filtered.filter((i) => {
      const text =
        `${i.name} ${i.rank} ${i.date} ${i.days} ${i.status}`.toLowerCase();
      const statusMatch =
        !statusFilter || (i.status || "").toLowerCase().includes(statusFilter);
      const searchMatch = !s || text.includes(s);
      return statusMatch && searchMatch;
    });

    return filtered;
  }

  const filteredTrainingData = applyFilters(trainings);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTrainingData.length / rowsPerPage)
  );
  const pageStart = (currentPage - 1) * rowsPerPage;
  const paginated = filteredTrainingData.slice(
    pageStart,
    pageStart + rowsPerPage
  );

  // Pagination function
  const renderPaginationButtons = () => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredTrainingData.length / rowsPerPage)
    );
    const hasNoData = filteredTrainingData.length === 0;

    const buttons = [];

    buttons.push(
      <button
        key="prev"
        className={`${styles.TSPaginationBtn} ${
          hasNoData ? styles.TSDisabled : ""
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
        className={`${styles.TSPaginationBtn} ${
          1 === currentPage ? styles.TSActive : ""
        } ${hasNoData ? styles.TSDisabled : ""}`}
        onClick={() => setCurrentPage(1)}
        disabled={hasNoData}
      >
        1
      </button>
    );

    if (currentPage > 3) {
      buttons.push(
        <span key="ellipsis1" className={styles.TSPaginationEllipsis}>
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
            className={`${styles.TSPaginationBtn} ${
              i === currentPage ? styles.TSActive : ""
            } ${hasNoData ? styles.TSDisabled : ""}`}
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
        <span key="ellipsis2" className={styles.TSPaginationEllipsis}>
          ...
        </span>
      );
    }

    if (pageCount > 1) {
      buttons.push(
        <button
          key={pageCount}
          className={`${styles.TSPaginationBtn} ${
            pageCount === currentPage ? styles.TSActive : ""
          } ${hasNoData ? styles.TSDisabled : ""}`}
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
        className={`${styles.TSPaginationBtn} ${
          hasNoData ? styles.TSDisabled : ""
        }`}
        disabled={currentPage === pageCount || hasNoData}
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
      >
        Next
      </button>
    );

    return buttons;
  };

  // Summary numbers
  const totalItems = trainings.length;
  const pendingItems = trainings.filter(
    (i) => i.status?.toLowerCase() === "pending"
  ).length;
  const completedItems = trainings.filter(
    (i) => i.status?.toLowerCase() === "completed"
  ).length;
  const ongoingItems = trainings.filter(
    (i) => i.status?.toLowerCase() === "ongoing"
  ).length;
  const cancelledItems = trainings.filter(
    (i) => i.status?.toLowerCase() === "cancelled"
  ).length;

  function handleCardClick(filter) {
    if (currentFilterCard === filter) {
      setCurrentFilterCard("total");
    } else {
      setCurrentFilterCard(filter);
    }
    setCurrentPage(1);
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, currentFilterCard]);

  // Get file name from URL
  const getFileNameFromUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("data:")) return "Data URL Certificate";
    const parts = url.split("/");
    return parts[parts.length - 1];
  };

  // Render BFP Preloader if still loading
  if (showPreloader) {
    return (
      <BFPPreloader
        loading={loading}
        progress={loadingProgress}
        moduleTitle="TRAINING SYSTEM • Loading Schedules..."
        onRetry={handleRetryFromPreloader}
      />
    );
  }

  return (
    <div className={styles.TSAppContainer}>
      <Title>Training Management | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
    
      <Hamburger />
      <Sidebar />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <h1 className={styles.TSTitle}>Training Management</h1>

        {/* Top Controls */}
        <div className={styles.TSTopControls}>
          <div className={styles.TSTableHeader}>
            <select
              className={styles.TSFilterType}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Status</option>
              <option>Pending</option>
              <option>Completed</option>
              <option>Ongoing</option>
              <option>Cancelled</option>
            </select>

            <input
              type="text"
              className={styles.TSSearchBar}
              placeholder="🔍 Search training records..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.TSSummary}>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSTotal} ${
              currentFilterCard === "total" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("total")}
          >
            <h3>Active Trainings</h3>
            <p>{totalItems}</p>
            <small className={styles.summaryNote}>
              (Retired/Resigned excluded)
            </small>
          </button>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSPending} ${
              currentFilterCard === "pending" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("pending")}
          >
            <h3>Pending</h3>
            <p>{pendingItems}</p>
          </button>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSCompleted} ${
              currentFilterCard === "completed" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("completed")}
          >
            <h3>Completed</h3>
            <p>{completedItems}</p>
          </button>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSOngoing} ${
              currentFilterCard === "ongoing" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("ongoing")}
          >
            <h3>Ongoing</h3>
            <p>{ongoingItems}</p>
          </button>
          <button
            className={`${styles.TSSummaryCard} ${styles.TSCancelled} ${
              currentFilterCard === "cancelled" ? styles.TSActive : ""
            }`}
            onClick={() => handleCardClick("cancelled")}
          >
            <h3>Cancelled</h3>
            <p>{cancelledItems}</p>
          </button>
        </div>

        {/* Add Training Button */}
        <button className={styles.TSAddBtn} onClick={addNewTraining}>
          Add Training for Personnel
        </button>
        <div className={styles.TSPaginationContainer}>
          {renderPaginationButtons()}
        </div>
        {/* Table Container with Pagination */}
        <div className={styles.TSTableContainer}>
          {/* Pagination at the top */}

          <table className={styles.TSTable}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Rank</th>
                <th>Training Date</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Certificate</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="8" className={styles.TSNoRequestsTable}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <span className={styles.animatedEmoji}>📚</span>
                    </div>
                    <h3>No Training Records Found</h3>
                    <p>
                      There are no training records for active personnel.
                      Retired and resigned personnel are excluded from training
                      records.
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((training, index) => (
                  <tr key={training.id} className={styles.TSTableRow}>
                    <td>
                      <PersonnelPhotoCell training={training} />
                    </td>
                    <td>{training.name}</td>
                    <td>
                      <div className={styles.rankCell}>
                        {training.rankImage ? (
                          <img
                            src={training.rankImage}
                            alt={training.rank}
                            className={styles.rankImage}
                            onError={(e) => {
                              e.target.style.display = "none";
                              const fallback = e.target.nextElementSibling;
                              if (fallback) fallback.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className={styles.rankFallback}
                          style={{
                            display: training.rankImage ? "none" : "flex",
                          }}
                        >
                          <span className={styles.rankIcon}>🎖️</span>
                        </div>
                        <span className={styles.rankText}>{training.rank}</span>
                      </div>
                    </td>
                    <td>{training.date}</td>
                    <td>
                      {training.days} {training.days === "1" ? "day" : "days"}
                    </td>
                    <td>
                      <span
                        className={`${styles.TSStatus} ${
                          styles[training.status?.toLowerCase() || "pending"]
                        }`}
                      >
                        {training.status || "Pending"}
                      </span>
                    </td>
                    <td>
                      {training.certificateUrl ? (
                        <div className={styles.certificateCell}>
                          <button
                            className={styles.certificateBtn}
                            onClick={() =>
                              viewCertificate(training.certificateUrl)
                            }
                            title={`View ${getFileNameFromUrl(
                              training.certificateUrl
                            )}`}
                          >
                            📄 View
                          </button>
                          <div className={styles.certificateInfo}>
                            <small>
                              {getFileNameFromUrl(training.certificateUrl)}
                            </small>
                          </div>
                        </div>
                      ) : (
                        <span className={styles.noCertificate}>
                          No Certificate
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`${styles.TSActionBtn} ${styles.TSEditBtn}`}
                        onClick={() => editTraining(training)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className={`${styles.TSActionBtn} ${styles.TSDeleteBtn}`}
                        onClick={() => deleteTrainingRecord(pageStart + index)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sidebar Form for Add Training - Kept simple without rank image */}
        <div
          className={`${styles.TSFormCard} ${
            isFormOpen ? styles.TSActive : ""
          }`}
        >
          <div className={styles.TSFormHeader}>
            <h2>{editingTraining ? "Edit Training" : "Add New Training"}</h2>
            <button
              type="button"
              className={styles.TSCloseBtn}
              onClick={closeAllForms}
            >
              ×
            </button>
          </div>

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

          {uploadError && (
            <div className={styles.errorMessage}>
              <strong>⚠️ Notice:</strong> {uploadError}
              <br />
              <small>
                Training will be saved with a data URL for the certificate.
              </small>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.TSFormSection}>
              <h3>Personnel Information</h3>
              <div className={styles.TSFormRow}>
                <div className={styles.TSFormGroup}>
                  <label htmlFor="personnelId">Select Personnel *</label>
                  <select
                    id="personnelId"
                    value={formData.personnelId}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">-- Choose Personnel --</option>
                    {personnel.map((person) => (
                      <option key={person.id} value={person.id}>
                        {`${person.first_name} ${person.middle_name || ""} ${
                          person.last_name
                        }`}{" "}
                        - {person.rank || "No rank"}
                      </option>
                    ))}
                  </select>
                  <small className={styles.selectNote}>
                    Only active (non-retired/non-resigned) personnel are shown
                  </small>
                </div>
              </div>

              <div className={styles.TSFormRow}>
                <div className={styles.TSFormGroup}>
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    readOnly
                    className={styles.TSReadOnlyInput}
                    placeholder="Auto-filled from selection"
                  />
                </div>
                <div className={styles.TSFormGroup}>
                  <label>Rank</label>
                  <input
                    type="text"
                    value={formData.rank}
                    readOnly
                    className={styles.TSReadOnlyInput}
                  />
                </div>
              </div>
            </div>

            <div className={styles.TSFormSection}>
              <h3>Training Details</h3>
              <div className={styles.TSFormRow}>
                <div className={styles.TSFormGroup}>
                  <label htmlFor="dateOfTraining">Training Date *</label>
                  <input
                    type="date"
                    id="dateOfTraining"
                    value={formData.dateOfTraining}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className={styles.TSFormGroup}>
                  <label htmlFor="days">Duration (Days) *</label>
                  <input
                    type="number"
                    id="days"
                    min="1"
                    max="365"
                    value={formData.days}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., 5"
                  />
                </div>
              </div>

              <div className={styles.TSFormRow}>
                <div className={styles.TSFormGroup}>
                  <label htmlFor="status">Training Status *</label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="Pending">Pending</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className={styles.TSFormSection}>
                <h3>Training Certificate</h3>
                <div className={styles.TSFormRow}>
                  <div className={styles.TSFormGroup}>
                    <label htmlFor="certificate">
                      Upload Certificate (Optional)
                    </label>
                    <div className={styles.fileUpload}>
                      <label
                        htmlFor="certificate"
                        className={styles.fileUploadLabel}
                      >
                        📄 Upload Certificate (Max 10MB)
                      </label>
                      <input
                        type="file"
                        id="certificate"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleCertificateChange}
                      />
                      <span>
                        {certificateFileName || "No certificate selected"}
                      </span>
                    </div>
                    {formData.certificateUrl && !certificateFile && (
                      <div className={styles.currentFile}>
                        <small>
                          Current file:{" "}
                          {getFileNameFromUrl(formData.certificateUrl)}
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.TSFormActions}>
              <button type="submit" className={styles.TSSaveBtn}>
                {editingTraining ? "Update Training" : "Save Training"}
              </button>
              <button
                type="button"
                onClick={closeAllForms}
                className={styles.TSCancelBtn}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Edit Modal */}
        {isModalOpen && (
          <div className={styles.TSModalOverlay} onClick={closeAllForms}>
            <div
              className={styles.TSModalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.TSModalHeader}>
                <h2>Edit Training</h2>
                <button
                  type="button"
                  className={styles.TSCloseBtn}
                  onClick={closeAllForms}
                >
                  ×
                </button>
              </div>

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

              {uploadError && (
                <div className={styles.errorMessage}>
                  <strong>⚠️ Notice:</strong> {uploadError}
                  <br />
                  <small>
                    Training will be saved with a data URL for the certificate.
                  </small>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className={styles.TSFormSection}>
                  <h3>Personnel Information</h3>
                  <div className={styles.TSFormRow}>
                    <div className={styles.TSFormGroup}>
                      <label htmlFor="personnelId">Select Personnel *</label>
                      <select
                        id="personnelId"
                        value={formData.personnelId}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">-- Choose Personnel --</option>
                        {personnel.map((person) => (
                          <option key={person.id} value={person.id}>
                            {`${person.first_name} ${
                              person.middle_name || ""
                            } ${person.last_name}`}{" "}
                            - {person.rank || "No rank"}
                          </option>
                        ))}
                      </select>
                      <small className={styles.selectNote}>
                        Only active personnel are shown
                      </small>
                    </div>
                  </div>

                  <div className={styles.TSFormRow}>
                    <div className={styles.TSFormGroup}>
                      <label>Full Name</label>
                      <input
                        type="text"
                        value={formData.fullName}
                        readOnly
                        className={styles.TSReadOnlyInput}
                        placeholder="Auto-filled from selection"
                      />
                    </div>
                    <div className={styles.TSFormGroup}>
                      <label>Rank</label>
                      <input
                        type="text"
                        value={formData.rank}
                        readOnly
                        className={styles.TSReadOnlyInput}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.TSFormSection}>
                  <h3>Training Details</h3>
                  <div className={styles.TSFormRow}>
                    <div className={styles.TSFormGroup}>
                      <label htmlFor="dateOfTraining">Training Date *</label>
                      <input
                        type="date"
                        id="dateOfTraining"
                        value={formData.dateOfTraining}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className={styles.TSFormGroup}>
                      <label htmlFor="days">Duration (Days) *</label>
                      <input
                        type="number"
                        id="days"
                        min="1"
                        max="365"
                        value={formData.days}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., 5"
                      />
                    </div>
                  </div>

                  <div className={styles.TSFormRow}>
                    <div className={styles.TSFormGroup}>
                      <label htmlFor="status">Training Status *</label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="Pending">Pending</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.TSFormSection}>
                    <h3>Training Certificate</h3>
                    <div className={styles.TSFormRow}>
                      <div className={styles.TSFormGroup}>
                        <label htmlFor="certificate">
                          Upload Certificate (Optional)
                        </label>
                        <div className={styles.fileUpload}>
                          <label
                            htmlFor="certificate"
                            className={styles.fileUploadLabel}
                          >
                            📄 Change Certificate (Max 10MB)
                          </label>
                          <input
                            type="file"
                            id="certificate"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={handleCertificateChange}
                          />
                          <span>
                            {certificateFileName || "Keep current certificate"}
                          </span>
                        </div>
                        {formData.certificateUrl && !certificateFile && (
                          <div className={styles.currentFile}>
                            <small>
                              Current file:{" "}
                              {getFileNameFromUrl(formData.certificateUrl)}
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.TSFormActions}>
                  <button type="submit" className={styles.TSSaveBtn}>
                    Update Training
                  </button>
                  <button
                    type="button"
                    onClick={closeAllForms}
                    className={styles.TSCancelBtn}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bottom Pagination */}
        <div className={styles.TSPaginationContainer}>
          {renderPaginationButtons()}
        </div>

        {/* Information Note */}
        <div className={styles.infoNote}>
          <h3>Note:</h3>
          <ul>
            <li>
              Only active (non-retired/non-resigned) personnel are shown in
              training records
            </li>
            <li>
              Trainings for retired/resigned personnel are excluded from this
              view
            </li>
            <li>
              Historical training records can be accessed through the History
              system
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Trainings;
