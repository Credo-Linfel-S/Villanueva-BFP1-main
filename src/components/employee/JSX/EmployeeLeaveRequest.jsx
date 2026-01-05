import React, { useState, useEffect } from "react";
import styles from "../styles/EmployeeLeaveRequest.module.css";
import Hamburger from "../../Hamburger.jsx";
import EmployeeSidebar from "../../EmployeeSidebar.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { useAuth } from "../../AuthContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";

const EmployeeLeaveRequest = () => {
  const [formData, setFormData] = useState({
    employeeName: "",
    dateOfFiling: "",
    leaveType: "",
    startDate: "",
    endDate: "",
    numDays: 0,
  });

  const [leaveBalance, setLeaveBalance] = useState({
    vacation: 0,
    sick: 0,
    emergency: 0,
  });

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSickLeaveModal, setShowSickLeaveModal] = useState(false);
  const [chosenLocation, setChosenLocation] = useState("");
  const [sickLeaveDetails, setSickLeaveDetails] = useState({
    type: "",
    illness: "",
  });
  const [showToast, setShowToast] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();
  const { user, loading: authLoading } = useAuth();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [leaveBalanceId, setLeaveBalanceId] = useState(null);

  // NEW: State for insufficient balance warning and user confirmation
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] =
    useState(false);
  const [leaveRequestData, setLeaveRequestData] = useState(null);
  const [isWithoutPay, setIsWithoutPay] = useState(false);
  const [showImportantNotice, setShowImportantNotice] = useState(true); // NEW: Control important notice visibility

  // Separate state for location details
  const [abroadLocation, setAbroadLocation] = useState("");
  const [philippinesLocation, setPhilippinesLocation] = useState("");

  // Format date as YYYY-MM-DD
  const formatDate = (date) => date.toISOString().split("T")[0];

  // Calculate days between dates (simple calendar days)
  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate) || isNaN(endDate) || endDate < startDate) return 0;
    const timeDiff = endDate - startDate;
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  };

  // Get current year leave balance WITH monthly accrual calculation
  const getCurrentYearLeaveBalance = async (personnelId) => {
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1; // 1-12

      const { data: balance, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("personnel_id", personnelId)
        .eq("year", currentYear)
        .single();

      if (error && error.code === "PGRST116") {
        // No balance record yet - create one with initial credits based on hire date
        const { data: personnelData } = await supabase
          .from("personnel")
          .select("date_hired")
          .eq("id", personnelId)
          .single();

        let initialVacation = 0;
        let initialSick = 0;
        const initialEmergency = 5.0; // Emergency leave starts with 5 days

        if (personnelData?.date_hired) {
          const hireDate = new Date(personnelData.date_hired);
          const hireYear = hireDate.getFullYear();

          // If hired in current year, calculate pro-rated credits
          if (hireYear === currentYear) {
            const hireMonth = hireDate.getMonth() + 1; // 1-12
            const monthsWorked = currentMonth - hireMonth + 1;

            if (monthsWorked > 0) {
              initialVacation = (monthsWorked * 1.25).toFixed(2);
              initialSick = (monthsWorked * 1.25).toFixed(2);
            }
          } else {
            // Hired in previous year, start with full accrual
            initialVacation = (currentMonth * 1.25).toFixed(2);
            initialSick = (currentMonth * 1.25).toFixed(2);
          }
        } else {
          // Default if no hire date
          initialVacation = (currentMonth * 1.25).toFixed(2);
          initialSick = (currentMonth * 1.25).toFixed(2);
        }

        // Cap at 15 days max for vacation and sick
        initialVacation = Math.min(parseFloat(initialVacation), 15).toFixed(2);
        initialSick = Math.min(parseFloat(initialSick), 15).toFixed(2);

        const newBalance = {
          personnel_id: personnelId,
          year: currentYear,
          vacation_balance: initialVacation,
          sick_balance: initialSick,
          emergency_balance: initialEmergency,
          initial_vacation_credits: initialVacation,
          initial_sick_credits: initialSick,
          initial_emergency_credits: initialEmergency,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: created, error: createError } = await supabase
          .from("leave_balances")
          .insert([newBalance])
          .select()
          .single();

        if (createError) throw createError;

        setLeaveBalanceId(created.id);
        return {
          vacation: parseFloat(initialVacation),
          sick: parseFloat(initialSick),
          emergency: parseFloat(initialEmergency),
          id: created.id,
        };
      }

      if (error) throw error;

      // Check if we need to apply monthly accrual
      const lastUpdated = new Date(balance.updated_at);
      const now = new Date();

      // If it's a new month, apply accrual
      if (
        lastUpdated.getMonth() !== now.getMonth() ||
        lastUpdated.getFullYear() !== now.getFullYear()
      ) {
        let newVacation = parseFloat(balance.vacation_balance) + 1.25;
        let newSick = parseFloat(balance.sick_balance) + 1.25;

        // Cap at 15 days max
        newVacation = Math.min(newVacation, 15);
        newSick = Math.min(newSick, 15);

        // Update in database
        const { error: updateError } = await supabase
          .from("leave_balances")
          .update({
            vacation_balance: newVacation.toFixed(2),
            sick_balance: newSick.toFixed(2),
            updated_at: new Date().toISOString(),
          })
          .eq("id", balance.id);

        if (updateError) throw updateError;

        setLeaveBalanceId(balance.id);
        return {
          vacation: newVacation,
          sick: newSick,
          emergency: parseFloat(balance.emergency_balance) || 0,
          id: balance.id,
        };
      }

      setLeaveBalanceId(balance.id);
      return {
        vacation: parseFloat(balance.vacation_balance) || 0,
        sick: parseFloat(balance.sick_balance) || 0,
        emergency: parseFloat(balance.emergency_balance) || 0,
        id: balance.id,
      };
    } catch (error) {
      console.error("Error getting leave balance:", error);
      return {
        vacation: 0,
        sick: 0,
        emergency: 0,
        id: null,
      };
    }
  };

  // Get leave balance for type
  const getLeaveBalanceForType = (leaveType) => {
    switch (leaveType) {
      case "Vacation":
        return leaveBalance.vacation;
      case "Sick":
        return leaveBalance.sick;
      case "Emergency":
        return leaveBalance.emergency;
      default:
        return 0;
    }
  };

  // Check if sufficient balance
  const hasSufficientBalance = (leaveType, requestedDays) => {
    const balance = getLeaveBalanceForType(leaveType);
    return balance >= requestedDays;
  };

  // NEW: Update leave balance in database
  const updateLeaveBalanceInDatabase = async (leaveType, daysToDeduct) => {
    try {
      if (!leaveBalanceId) return;

      const fieldToUpdate = leaveType.toLowerCase() + "_balance";
      const usedField = leaveType.toLowerCase() + "_used";

      // Get current balance
      const { data: currentBalance, error: fetchError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("id", leaveBalanceId)
        .single();

      if (fetchError) throw fetchError;

      const currentValue = parseFloat(currentBalance[fieldToUpdate]) || 0;
      const currentUsed = parseFloat(currentBalance[usedField]) || 0;

      const newBalance = Math.max(0, currentValue - daysToDeduct);
      const newUsed = currentUsed + daysToDeduct;

      // Update in database
      const { error: updateError } = await supabase
        .from("leave_balances")
        .update({
          [fieldToUpdate]: newBalance.toFixed(2),
          [usedField]: newUsed.toFixed(2),
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaveBalanceId);

      if (updateError) throw updateError;

      return newBalance;
    } catch (error) {
      console.error("Error updating leave balance:", error);
      throw error;
    }
  };

  // Load employee data from Supabase
  const loadEmployeeData = async () => {
    try {
      setIsLoading(true);

      if (!user) {
        window.location.href = "/index.html";
        return;
      }

      const { data: employeeData, error: employeeError } = await supabase
        .from("personnel")
        .select("*")
        .eq("username", user.username)
        .single();

      if (employeeError) throw employeeError;

      if (employeeData) {
        setEmployeeId(employeeData.id);

        // Build full name
        const middle = employeeData.middle_name
          ? ` ${employeeData.middle_name}`
          : "";
        const fullName =
          `${employeeData.first_name}${middle} ${employeeData.last_name}`.trim();
        setFormData((prev) => ({ ...prev, employeeName: fullName }));

        // Get current year leave balance
        const balanceRecord = await getCurrentYearLeaveBalance(employeeData.id);

        setLeaveBalance({
          vacation: balanceRecord.vacation,
          sick: balanceRecord.sick,
          emergency: balanceRecord.emergency,
        });
      }
    } catch (error) {
      console.error("Error loading employee data:", error);
      setErrorMessage("Failed to load employee data. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize form when user is loaded
  useEffect(() => {
    if (!authLoading && user) {
      loadEmployeeData();

      const today = formatDate(new Date());
      const minStartDate = new Date();
      minStartDate.setDate(minStartDate.getDate() + 5);
      const minStart = formatDate(minStartDate);

      setFormData((prev) => ({
        ...prev,
        dateOfFiling: today,
        startDate: minStart,
        endDate: minStart,
        numDays: calculateDays(minStart, minStart),
      }));
    }
  }, [user, authLoading]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/index.html";
    }
  }, [user, authLoading]);

  // Update days when start or end date changes
  useEffect(() => {
    const days = calculateDays(formData.startDate, formData.endDate);
    setFormData((prev) => ({ ...prev, numDays: days }));
  }, [formData.startDate, formData.endDate]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "leaveType") {
      if (value === "Vacation") {
        setShowLocationModal(true);
        setChosenLocation("");
        setAbroadLocation("");
        setPhilippinesLocation("");
      } else if (value === "Sick") {
        setShowSickLeaveModal(true);
        setSickLeaveDetails({
          type: "",
          illness: "",
        });
      } else {
        setChosenLocation("");
        setSickLeaveDetails({
          type: "",
          illness: "",
        });
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "startDate" && formData.endDate < value) {
      setFormData((prev) => ({ ...prev, endDate: value }));
    }
  };

  // Handle location confirmation
  const handleConfirmLocation = () => {
    if (selectedLocation === "Abroad" && abroadLocation.trim()) {
      const fullLocation = `Abroad: ${abroadLocation.trim()}`;
      setChosenLocation(fullLocation);
      setShowLocationModal(false);
      setSelectedLocation("");
      setAbroadLocation("");
      setPhilippinesLocation("");
    } else if (
      selectedLocation === "Philippines" &&
      philippinesLocation.trim()
    ) {
      const fullLocation = `Philippines: ${philippinesLocation.trim()}`;
      setChosenLocation(fullLocation);
      setShowLocationModal(false);
      setSelectedLocation("");
      setAbroadLocation("");
      setPhilippinesLocation("");
    } else if (!selectedLocation) {
      alert("Please select a location (Abroad or Philippines).");
    } else if (selectedLocation === "Abroad" && !abroadLocation.trim()) {
      alert("Please specify the country and city for abroad location.");
    } else if (
      selectedLocation === "Philippines" &&
      !philippinesLocation.trim()
    ) {
      alert(
        "Please specify the province and city/municipality for Philippines location."
      );
    }
  };

  // Handle sick leave details confirmation
  const handleConfirmSickLeaveDetails = () => {
    if (!sickLeaveDetails.type) {
      alert("Please select whether it's In hospital or Out patient.");
      return;
    }

    if (!sickLeaveDetails.illness.trim()) {
      alert("Please specify the illness.");
      return;
    }

    setShowSickLeaveModal(false);
  };

  // Close modals
  const handleCloseSickLeaveModal = () => {
    setShowSickLeaveModal(false);
    if (formData.leaveType === "Sick") {
      setFormData((prev) => ({ ...prev, leaveType: "" }));
    }
    setSickLeaveDetails({
      type: "",
      illness: "",
    });
  };

  const handleCloseLocationModal = () => {
    setShowLocationModal(false);
    if (formData.leaveType === "Vacation") {
      setFormData((prev) => ({ ...prev, leaveType: "" }));
    }
    setSelectedLocation("");
    setAbroadLocation("");
    setPhilippinesLocation("");
  };

  // NEW: Close insufficient balance modal
  const handleCloseInsufficientBalanceModal = () => {
    setShowInsufficientBalanceModal(false);
    setIsWithoutPay(false);
    setLeaveRequestData(null);
    setSubmitLoading(false);
  };

  // NEW: Handle insufficient balance confirmation
  const handleConfirmWithoutPay = () => {
    if (!isWithoutPay) {
      alert("You must acknowledge that this will be leave without pay.");
      return;
    }
    // Continue with submission
    submitLeaveRequestFinal(leaveRequestData, true);
    setShowInsufficientBalanceModal(false);
  };

  // Submit leave request to Supabase
  const submitLeaveRequest = async (leaveRequestData) => {
    try {
      const { error } = await supabase
        .from("leave_requests")
        .insert([leaveRequestData]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("Error submitting leave request:", error);
      throw error;
    }
  };

  // NEW: Final submission function with proper balance deduction
  const submitLeaveRequestFinal = async (data, isWithoutPay = false) => {
    try {
      // If it's without pay, don't deduct from balance
      if (isWithoutPay) {
        // For leave without pay, set appropriate fields
        data.approve_for = "without_pay";
        data.paid_days = 0;
        data.unpaid_days = data.num_days;
        // Don't update balance_before and balance_after for without pay leaves
        data.balance_before = 0;
        data.balance_after = 0;

        // Hide the important notice after submission
        setShowImportantNotice(false);
      } else {
        // For with pay, deduct from balance
        const balanceBefore = getLeaveBalanceForType(data.leave_type);

        // Update balance in database
        const newBalance = await updateLeaveBalanceInDatabase(
          data.leave_type,
          data.num_days
        );

        data.balance_before = balanceBefore;
        data.balance_after = newBalance;
        data.approve_for = "with_pay";
        data.paid_days = data.num_days;
        data.unpaid_days = 0;

        // Update local leave balance
        setLeaveBalance((prev) => ({
          ...prev,
          [data.leave_type.toLowerCase()]: parseFloat(newBalance.toFixed(2)),
        }));
      }

      const result = await submitLeaveRequest(data);

      if (result.success) {
        // Show success toast
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);

        // Reset form
        const today = formatDate(new Date());
        const minStartDate = new Date();
        minStartDate.setDate(minStartDate.getDate() + 5);
        const minStart = formatDate(minStartDate);

        setFormData({
          employeeName: formData.employeeName,
          dateOfFiling: today,
          leaveType: "",
          startDate: minStart,
          endDate: minStart,
          numDays: calculateDays(minStart, minStart),
        });

        setChosenLocation("");
        setSickLeaveDetails({ type: "", illness: "" });
        setErrorMessage("");
        setIsWithoutPay(false);

        // Hide the important notice after successful submission
        setShowImportantNotice(false);
      }
    } catch (error) {
      console.error("Error saving leave request:", error);
      alert("Failed to submit leave request: " + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle form submission to Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setErrorMessage("");

    // Validations
    if (!formData.leaveType) {
      alert("Please select a leave type.");
      setSubmitLoading(false);
      return;
    }

    if (formData.leaveType === "Vacation" && !chosenLocation) {
      alert("Please select a location for vacation leave.");
      setShowLocationModal(true);
      setSubmitLoading(false);
      return;
    }

    if (
      formData.leaveType === "Sick" &&
      (!sickLeaveDetails.type || !sickLeaveDetails.illness)
    ) {
      alert("Please provide sick leave details.");
      setShowSickLeaveModal(true);
      setSubmitLoading(false);
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      alert("Please select both start and end dates.");
      setSubmitLoading(false);
      return;
    }

    if (!formData.numDays || formData.numDays <= 0) {
      alert("Please enter a valid number of days.");
      setSubmitLoading(false);
      return;
    }

    // Prepare leave request data
    const balanceBefore = getLeaveBalanceForType(formData.leaveType);

    const leaveRequestData = {
      personnel_id: employeeId,
      username: user.username,
      employee_name: formData.employeeName,
      leave_type: formData.leaveType,
      location: formData.leaveType === "Vacation" ? chosenLocation : null,
      vacation_location_type:
        formData.leaveType === "Vacation"
          ? chosenLocation.startsWith("Abroad")
            ? "abroad"
            : "philippines"
          : null,
      date_of_filing: formData.dateOfFiling,
      start_date: formData.startDate,
      end_date: formData.endDate,
      num_days: parseFloat(formData.numDays),
      status: "Pending",
      reason:
        formData.leaveType === "Sick"
          ? `${
              sickLeaveDetails.type === "in_hospital"
                ? "In hospital"
                : "Out patient"
            }: ${sickLeaveDetails.illness}`
          : `Leave request for ${formData.leaveType.toLowerCase()} leave`,
      submitted_at: new Date().toISOString(),
      leave_balance_id: leaveBalanceId,
      balance_before: balanceBefore,
      // balance_after will be set based on with/without pay
      illness_type:
        formData.leaveType === "Sick" ? sickLeaveDetails.type : null,
      illness_details:
        formData.leaveType === "Sick" ? sickLeaveDetails.illness : null,
      // Default to "with_pay" - will be updated if insufficient balance
      approve_for: "with_pay",
      paid_days: parseFloat(formData.numDays),
      unpaid_days: 0,
    };

    // NEW: Check balance and show warning if insufficient
    if (!hasSufficientBalance(formData.leaveType, formData.numDays)) {
      // Store the request data and show modal
      setLeaveRequestData(leaveRequestData);
      setShowInsufficientBalanceModal(true);
      return;
    }

    // If sufficient balance, proceed with normal submission
    await submitLeaveRequestFinal(leaveRequestData);
  };

  // Handle form reset
  const handleReset = () => {
    const today = formatDate(new Date());
    const minStartDate = new Date();
    minStartDate.setDate(minStartDate.getDate() + 5);
    const minStart = formatDate(minStartDate);

    setFormData({
      employeeName: formData.employeeName,
      dateOfFiling: today,
      leaveType: "",
      startDate: minStart,
      endDate: minStart,
      numDays: calculateDays(minStart, minStart),
    });

    setChosenLocation("");
    setSelectedLocation("");
    setAbroadLocation("");
    setPhilippinesLocation("");
    setSickLeaveDetails({
      type: "",
      illness: "",
    });
    setShowLocationModal(false);
    setShowSickLeaveModal(false);
    setShowInsufficientBalanceModal(false);
    setErrorMessage("");
    setIsWithoutPay(false);
  };

  // Calculate progress percentages
  const maxVacationSickDays = 15;
  const maxEmergencyDays = 5;
  const vacationPercent = Math.min(
    (leaveBalance.vacation / maxVacationSickDays) * 100,
    100
  );
  const sickPercent = Math.min(
    (leaveBalance.sick / maxVacationSickDays) * 100,
    100
  );
  const emergencyPercent = Math.min(
    (leaveBalance.emergency / maxEmergencyDays) * 100,
    100
  );

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="app">
        <EmployeeSidebar />
        <Hamburger />
        <div
          className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}
        >
          <div className={styles.leaveFormContainer}>
            <div className={styles.loading}>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app">
      <Title>Employee Leave Request | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <EmployeeSidebar />
      <Hamburger />
      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.leaveFormContainer}>
          <h2 className={styles.pageTitle}>Request Leave</h2>

          {/* Simple Info */}
          <div className={styles.formulaInfo}>
            <h4>Leave Credits Information:</h4>
            <p>
              <strong>Monthly Accrual:</strong> 1.25 days per month (Vacation &
              Sick)
            </p>
            <p>
              <strong>Max Balance:</strong> 15 days for Vacation & Sick, 5 days
              for Emergency
            </p>
            <p>
              <strong>Accrual Date:</strong> 1st of every month (automatic)
            </p>
            <p>
              <strong>Emergency Leave:</strong> 5 days per year (no monthly
              accrual)
            </p>

            {/* Important Notice - Only shown until first submission */}
            {showImportantNotice && (
              <p
                style={{
                  color: "#d32f2f",
                  fontWeight: "bold",
                  backgroundColor: "#fff3cd",
                  padding: "8px",
                  borderRadius: "4px",
                }}
              >
                ⚠️ <strong>Important Notice:</strong> You can still apply for
                leave even with insufficient credits, but it will be considered
                as leave without pay.
              </p>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className={styles.errorMessage}>
              <span className={styles.errorIcon}>⚠️</span>
              {errorMessage}
            </div>
          )}

          <div className={styles.contentWrapper}>
            {/* Leave Balance Card */}
            <div className={styles.leaveBalance}>
              <h3>Leave Balance</h3>
              <div className={styles.balanceInfo}>
                <p>Max: Vacation/Sick: 15 days | Emergency: 5 days</p>
                <p>Monthly accrual: 1.25 days (Vacation & Sick)</p>
                <p>Credits accrue automatically on the 1st of each month</p>
              </div>
              <ul>
                <li>
                  <div className={styles.label}>
                    <span>Vacation</span>
                    <span>{leaveBalance.vacation.toFixed(2)} days</span>
                  </div>
                  <div className={styles.progress}>
                    <div
                      className={`${styles.progressBar} ${styles.progressVacation}`}
                      style={{ width: `${vacationPercent}%` }}
                    ></div>
                  </div>
                  <div className={styles.leavesTaken}>
                    Used:{" "}
                    {15 - leaveBalance.vacation > 0
                      ? (15 - leaveBalance.vacation).toFixed(2)
                      : "0.00"}{" "}
                    days
                  </div>
                </li>
                <li>
                  <div className={styles.label}>
                    <span>Sick</span>
                    <span>{leaveBalance.sick.toFixed(2)} days</span>
                  </div>
                  <div className={styles.progress}>
                    <div
                      className={`${styles.progressBar} ${styles.progressSick}`}
                      style={{ width: `${sickPercent}%` }}
                    ></div>
                  </div>
                  <div className={styles.leavesTaken}>
                    Used:{" "}
                    {15 - leaveBalance.sick > 0
                      ? (15 - leaveBalance.sick).toFixed(2)
                      : "0.00"}{" "}
                    days
                  </div>
                </li>
                <li>
                  <div className={styles.label}>
                    <span>Emergency</span>
                    <span>{leaveBalance.emergency.toFixed(2)} days</span>
                  </div>
                  <div className={styles.progress}>
                    <div
                      className={`${styles.progressBar} ${styles.progressEmergency}`}
                      style={{ width: `${emergencyPercent}%` }}
                    ></div>
                  </div>
                  <div className={styles.leavesTaken}>
                    Used:{" "}
                    {5 - leaveBalance.emergency > 0
                      ? (5 - leaveBalance.emergency).toFixed(2)
                      : "0.00"}{" "}
                    days
                  </div>
                </li>
              </ul>
            </div>

            {/* Leave Request Form */}
            <form onSubmit={handleSubmit} className={styles.formCard}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <input
                    type="text"
                    name="employeeName"
                    value={formData.employeeName}
                    readOnly
                    placeholder=" "
                  />
                  <label>Employee Name</label>
                </div>

                <div className={styles.formGroup}>
                  <input
                    type="date"
                    name="dateOfFiling"
                    value={formData.dateOfFiling}
                    onChange={handleInputChange}
                    required
                    max={formatDate(new Date())}
                  />
                  <label>Date of Filing</label>
                </div>

                <div className={styles.formGroup}>
                  <select
                    name="leaveType"
                    value={formData.leaveType}
                    onChange={handleInputChange}
                    required
                    disabled={submitLoading}
                  >
                    <option value="" disabled hidden></option>
                    <option value="Vacation">Vacation Leave</option>
                    <option value="Sick">Sick Leave</option>
                    <option value="Emergency">Emergency Leave</option>
                    <option value="Maternity">Maternity Leave</option>
                    <option value="Paternity">Paternity Leave</option>
                  </select>
                  <label>Leave Type</label>
                  {chosenLocation && formData.leaveType === "Vacation" && (
                    <small className={styles.chosenLocation}>
                      Location: {chosenLocation}
                    </small>
                  )}
                  {formData.leaveType === "Sick" && sickLeaveDetails.type && (
                    <small className={styles.chosenLocation}>
                      Type:{" "}
                      {sickLeaveDetails.type === "in_hospital"
                        ? "In hospital"
                        : "Out patient"}
                      {sickLeaveDetails.illness &&
                        ` - ${sickLeaveDetails.illness}`}
                    </small>
                  )}
                  {formData.leaveType && (
                    <small className={styles.availableBalance}>
                      Available:{" "}
                      {getLeaveBalanceForType(formData.leaveType).toFixed(2)}{" "}
                      days
                    </small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    min={formatDate(
                      new Date(new Date().setDate(new Date().getDate() + 5))
                    )}
                    disabled={submitLoading}
                  />
                  <label>Start Date</label>
                </div>

                <div className={styles.formGroup}>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                    min={formData.startDate}
                    disabled={submitLoading}
                  />
                  <label>End Date</label>
                </div>

                <div className={styles.formGroup}>
                  <input
                    type="number"
                    name="numDays"
                    value={formData.numDays}
                    readOnly
                    className={styles.numDaysInput}
                  />
                  <label>Number of Days</label>
                  {formData.leaveType && formData.numDays > 0 && (
                    <div className={styles.daysWarning}>
                      {!hasSufficientBalance(
                        formData.leaveType,
                        formData.numDays
                      ) ? (
                        <span className={styles.warningText}>
                          ⚠️ Insufficient balance (will be leave without pay)
                        </span>
                      ) : (
                        <span className={styles.okText}>
                          ✓ Balance sufficient (will be leave with pay)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.formButtons}>
                <button
                  type="button"
                  onClick={handleReset}
                  className={styles.btnSecondary}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={submitLoading}
                >
                  {submitLoading ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Location Modal for Vacation Leave */}
        {showLocationModal && (
          <div className={styles.modal} style={{ display: "flex" }}>
            <div className={styles.modalContent}>
              <span
                className={styles.closeBtn}
                onClick={handleCloseLocationModal}
              >
                &times;
              </span>
              <h3>Select Location for Vacation Leave</h3>

              <div className={styles.modalRadioOptions}>
                <label>
                  <input
                    type="radio"
                    name="location"
                    value="Abroad"
                    checked={selectedLocation === "Abroad"}
                    onChange={(e) => {
                      setSelectedLocation(e.target.value);
                      setPhilippinesLocation("");
                    }}
                  />
                  Abroad
                </label>
                <label>
                  <input
                    type="radio"
                    name="location"
                    value="Philippines"
                    checked={selectedLocation === "Philippines"}
                    onChange={(e) => {
                      setSelectedLocation(e.target.value);
                      setAbroadLocation("");
                    }}
                  />
                  Philippines
                </label>
              </div>

              {selectedLocation === "Abroad" && (
                <div className={styles.locationDetails}>
                  <label htmlFor="abroadLocation">Country and City:</label>
                  <input
                    id="abroadLocation"
                    type="text"
                    value={abroadLocation}
                    onChange={(e) => setAbroadLocation(e.target.value)}
                    placeholder="e.g., Japan, Tokyo"
                    className={styles.locationInput}
                  />
                </div>
              )}

              {selectedLocation === "Philippines" && (
                <div className={styles.locationDetails}>
                  <label htmlFor="philippinesLocation">
                    Province and City/Municipality:
                  </label>
                  <input
                    id="philippinesLocation"
                    type="text"
                    value={philippinesLocation}
                    onChange={(e) => setPhilippinesLocation(e.target.value)}
                    placeholder="e.g., Cebu Province, Cebu City"
                    className={styles.locationInput}
                  />
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  onClick={handleConfirmLocation}
                  className={styles.btnPrimary}
                  disabled={
                    !selectedLocation ||
                    (selectedLocation === "Abroad" && !abroadLocation.trim()) ||
                    (selectedLocation === "Philippines" &&
                      !philippinesLocation.trim())
                  }
                >
                  Confirm Location
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sick Leave Modal */}
        {showSickLeaveModal && (
          <div className={styles.modal} style={{ display: "flex" }}>
            <div className={styles.modalContent}>
              <span
                className={styles.closeBtn}
                onClick={handleCloseSickLeaveModal}
              >
                &times;
              </span>
              <h3>Sick Leave Details</h3>

              <div className={styles.modalRadioOptions}>
                <label>
                  <input
                    type="radio"
                    name="sickLeaveType"
                    value="in_hospital"
                    checked={sickLeaveDetails.type === "in_hospital"}
                    onChange={(e) =>
                      setSickLeaveDetails((prev) => ({
                        ...prev,
                        type: e.target.value,
                      }))
                    }
                  />
                  In hospital
                </label>
                <label>
                  <input
                    type="radio"
                    name="sickLeaveType"
                    value="out_patient"
                    checked={sickLeaveDetails.type === "out_patient"}
                    onChange={(e) =>
                      setSickLeaveDetails((prev) => ({
                        ...prev,
                        type: e.target.value,
                      }))
                    }
                  />
                  Out patient
                </label>
              </div>

              <div className={styles.locationDetails}>
                <label htmlFor="illnessDetails">Specify Illness:</label>
                <textarea
                  id="illnessDetails"
                  value={sickLeaveDetails.illness}
                  onChange={(e) =>
                    setSickLeaveDetails((prev) => ({
                      ...prev,
                      illness: e.target.value,
                    }))
                  }
                  placeholder="e.g., Flu with high fever, Dengue fever, etc."
                  className={styles.locationInput}
                  rows="3"
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  onClick={handleConfirmSickLeaveDetails}
                  className={styles.btnPrimary}
                  disabled={
                    !sickLeaveDetails.type || !sickLeaveDetails.illness.trim()
                  }
                >
                  Confirm Sick Leave Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NEW: Insufficient Balance Modal */}
        {showInsufficientBalanceModal && leaveRequestData && (
          <div className={styles.modal} style={{ display: "flex" }}>
            <div className={styles.modalContent}>
              <span
                className={styles.closeBtn}
                onClick={handleCloseInsufficientBalanceModal}
              >
                &times;
              </span>
              <h3 style={{ color: "#d32f2f" }}>
                ⚠️ Insufficient Leave Balance
              </h3>

              <div className={styles.warningBox}>
                <p>
                  <strong>You are out of leave credits!</strong>
                </p>
                <p>
                  Leave Type: <strong>{leaveRequestData.leave_type}</strong>
                </p>
                <p>
                  Requested Days: <strong>{leaveRequestData.num_days}</strong>
                </p>
                <p>
                  Available Balance:{" "}
                  <strong>
                    {getLeaveBalanceForType(
                      leaveRequestData.leave_type
                    ).toFixed(2)}{" "}
                    days
                  </strong>
                </p>
                <hr style={{ margin: "15px 0", borderColor: "#ddd" }} />
                <p
                  style={{
                    color: "#d32f2f",
                    fontWeight: "bold",
                    fontSize: "16px",
                  }}
                >
                  ⚠️ <strong>This will be leave without pay.</strong>
                </p>
                <p style={{ marginTop: "10px" }}>
                  Your leave request will still be submitted for approval, but
                  it will be marked as
                  <strong> leave without pay</strong>. No leave credits will be
                  deducted.
                </p>
              </div>

              <div className={styles.confirmationCheckbox}>
                <label>
                  <input
                    type="checkbox"
                    checked={isWithoutPay}
                    onChange={(e) => setIsWithoutPay(e.target.checked)}
                  />
                  <span style={{ marginLeft: "8px", fontWeight: "bold" }}>
                    I understand that this will be leave without pay
                  </span>
                </label>
              </div>

              <div className={styles.modalActions}>
                <button
                  onClick={handleCloseInsufficientBalanceModal}
                  className={styles.btnSecondary}
                  style={{ marginRight: "10px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmWithoutPay}
                  className={styles.btnPrimary}
                  disabled={!isWithoutPay}
                  style={{ backgroundColor: isWithoutPay ? "#d32f2f" : "#ccc" }}
                >
                  Submit as Leave Without Pay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {showToast && (
          <div
            className={styles.toast}
            style={{ opacity: 1, transform: "translateY(0)" }}
          >
            ✅ Leave request submitted successfully!
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeLeaveRequest;
