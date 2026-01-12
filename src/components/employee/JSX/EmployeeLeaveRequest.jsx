import React, { useState, useEffect } from "react";
import styles from "../styles/EmployeeLeaveRequest.module.css";
import Hamburger from "../../Hamburger.jsx";
import EmployeeSidebar from "../../EmployeeSidebar.jsx";
import LeaveMeter from "./LeaveMeter.jsx";
import { useSidebar } from "../../SidebarContext.jsx";
import { useAuth } from "../../AuthContext.jsx";
import { Title, Meta } from "react-head";
import { supabase } from "../../../lib/supabaseClient.js";
import BFPPreloader from "../../BFPPreloader.jsx";
import { useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const EmployeeLeaveRequest = () => {
  const [formData, setFormData] = useState({
    employeeName: "",
    dateOfFiling: "",
    leaveType: "",
    startDate: "",
    endDate: "",
    numDays: 0,
  });

  // Keep only the leaveBalanceId for tracking
  const [leaveBalanceId, setLeaveBalanceId] = useState(null);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSickLeaveModal, setShowSickLeaveModal] = useState(false);
  const [chosenLocation, setChosenLocation] = useState("");
  const [sickLeaveDetails, setSickLeaveDetails] = useState({
    type: "",
    illness: "",
  });
  const [selectedLocation, setSelectedLocation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { isSidebarCollapsed } = useSidebar();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // State for insufficient balance warning and user confirmation
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] =
    useState(false);
  const [leaveRequestData, setLeaveRequestData] = useState(null);
  const [isWithoutPay, setIsWithoutPay] = useState(false);
  const [showImportantNotice, setShowImportantNotice] = useState(true);

  // Separate state for location details
  const [abroadLocation, setAbroadLocation] = useState("");
  const [philippinesLocation, setPhilippinesLocation] = useState("");

  // State for holidays
  const [holidays, setHolidays] = useState([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // NEW: State to control form modal visibility
  const [showFormModal, setShowFormModal] = useState(false);

  // Define which leave types don't require credits
  const LEAVES_WITHOUT_CREDIT_REQUIREMENT = [
    "Maternity",
    "Paternity",
    "Emergency",
  ];

  // PH Timezone constants and functions
  const PH_TIMEZONE_OFFSET = 8 * 60 * 60 * 1000;

  // Toast notification functions
  const showSuccessToast = (message) => {
    toast.success(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  const showErrorToast = (message) => {
    toast.error(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  const showWarningToast = (message) => {
    toast.warning(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  const showInfoToast = (message) => {
    toast.info(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  // Helper function to check if leave type requires credits
  const requiresLeaveCredits = (leaveType) => {
    return !LEAVES_WITHOUT_CREDIT_REQUIREMENT.includes(leaveType);
  };

  // Convert any date to PH time
  const toPHTime = (date) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Date(dateObj.getTime() + PH_TIMEZONE_OFFSET);
  };

  // Format date as YYYY-MM-DD in PH time
  const formatPHDate = (date) => {
    const phDate = toPHTime(date);
    const year = phDate.getUTCFullYear();
    const month = String(phDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(phDate.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get current date in PH time
  const getCurrentPHDate = () => {
    return toPHTime(new Date());
  };

  // Get PH timestamp for database (ISO string)
  const getPHTimestamp = () => {
    return toPHTime(new Date()).toISOString();
  };

  // Load holidays from API
  const loadHolidays = async () => {
    try {
      const response = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${currentYear}/PH`
      );
      if (response.ok) {
        const data = await response.json();
        setHolidays(data);
      } else {
        const fallbackHolidays = [
          { date: `${currentYear}-01-01`, name: "New Year's Day" },
          { date: `${currentYear}-04-09`, name: "Araw ng Kagitingan" },
          { date: `${currentYear}-05-01`, name: "Labor Day" },
          { date: `${currentYear}-06-12`, name: "Independence Day" },
          { date: `${currentYear}-08-21`, name: "Ninoy Aquino Day" },
          { date: `${currentYear}-08-30`, name: "National Heroes' Day" },
          { date: `${currentYear}-11-01`, name: "All Saints' Day" },
          { date: `${currentYear}-11-30`, name: "Bonifacio Day" },
          { date: `${currentYear}-12-25`, name: "Christmas Day" },
          { date: `${currentYear}-12-30`, name: "Rizal Day" },
        ];
        setHolidays(fallbackHolidays);
      }
    } catch (error) {
      console.error("Failed to load holidays:", error);
      setHolidays([]);
    }
  };

  // Calculate calendar days (for display only)
  const calculateCalendarDays = (start, end) => {
    if (!start || !end) return 0;

    const startDate = toPHTime(start);
    const endDate = toPHTime(end);

    if (isNaN(startDate) || isNaN(endDate) || endDate < startDate) return 0;

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

    const timeDiff = endDate - startDate;
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  };

  // Calculate working days (excludes weekends and holidays)
  const calculateWorkingDays = (start, end) => {
    if (!start || !end) return 0;

    let count = 0;
    let current = new Date(start);
    const endDate = new Date(end);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const dateStr = current.toISOString().split("T")[0];
      const isHoliday = holidays.some((h) => h.date === dateStr);

      if (!isWeekend && !isHoliday) {
        count++;
      }

      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  // Calculate days (now returns working days for deduction)
  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    return calculateWorkingDays(start, end);
  };

  // Get leave balance ID for tracking
  const getLeaveBalanceId = async (personnelId) => {
    try {
      const currentYear = new Date().getFullYear();

      const { data: balance, error } = await supabase
        .from("leave_balances")
        .select("id")
        .eq("personnel_id", personnelId)
        .eq("year", currentYear)
        .single();

      if (error && error.code === "PGRST116") {
        const { data: personnelData } = await supabase
          .from("personnel")
          .select("date_hired")
          .eq("id", personnelId)
          .single();

        const initialVacation = 15.0;
        const initialSick = 15.0;
        const initialEmergency = 5.0;

        const newBalance = {
          personnel_id: personnelId,
          year: currentYear,
          vacation_balance: initialVacation,
          sick_balance: initialSick,
          emergency_balance: initialEmergency,
          initial_vacation_credits: initialVacation,
          initial_sick_credits: initialSick,
          initial_emergency_credits: initialEmergency,
          created_at: getPHTimestamp(),
          updated_at: getPHTimestamp(),
        };

        const { data: created, error: createError } = await supabase
          .from("leave_balances")
          .insert([newBalance])
          .select()
          .single();

        if (createError) throw createError;

        return created.id;
      }

      if (error) throw error;

      return balance.id;
    } catch (error) {
      console.error("Error getting leave balance ID:", error);
      return null;
    }
  };

  // Function to get current leave balance for a specific type
  const getCurrentLeaveBalance = async (personnelId, leaveType) => {
    try {
      const currentYear = new Date().getFullYear();
      const fieldMap = {
        Vacation: "vacation_balance",
        Sick: "sick_balance",
        Emergency: "emergency_balance",
      };

      const field = fieldMap[leaveType];
      if (!field) return 0;

      const { data: balance, error } = await supabase
        .from("leave_balances")
        .select(field)
        .eq("personnel_id", personnelId)
        .eq("year", currentYear)
        .single();

      if (error) {
        console.error("Error getting leave balance:", error);
        return 0;
      }

      return parseFloat(balance[field]) || 0;
    } catch (error) {
      console.error("Error fetching leave balance:", error);
      return 0;
    }
  };

  // Check if sufficient balance (now uses working days)
  const hasSufficientBalance = async (personnelId, leaveType) => {
    if (!formData.startDate || !formData.endDate) return false;

    const balance = await getCurrentLeaveBalance(personnelId, leaveType);
    const workingDays = calculateWorkingDays(
      formData.startDate,
      formData.endDate
    );

    return balance >= workingDays;
  };

  // Deduct leave balance ONLY when approved
  const deductLeaveBalanceOnApproval = async (leaveRequestId) => {
    try {
      const { data: leaveRequest, error: fetchError } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("id", leaveRequestId)
        .single();

      if (fetchError) throw fetchError;

      // Skip if it's leave without pay OR if it's a leave type that doesn't require credits
      if (
        leaveRequest.approve_for === "without_pay" ||
        !requiresLeaveCredits(leaveRequest.leave_type)
      ) {
        console.log("No balance deduction needed for this leave type");
        return;
      }

      const { data: balance, error: balanceError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("id", leaveRequest.leave_balance_id)
        .single();

      if (balanceError) throw balanceError;

      const fieldToUpdate = leaveRequest.leave_type.toLowerCase() + "_balance";
      const usedField = leaveRequest.leave_type.toLowerCase() + "_used";

      const currentBalance = parseFloat(balance[fieldToUpdate]) || 0;
      const currentUsed = parseFloat(balance[usedField]) || 0;

      const daysToDeduct = leaveRequest.working_days || leaveRequest.num_days;

      const newBalance = Math.max(0, currentBalance - daysToDeduct);
      const newUsed = currentUsed + daysToDeduct;

      const { error: updateError } = await supabase
        .from("leave_balances")
        .update({
          [fieldToUpdate]: newBalance.toFixed(2),
          [usedField]: newUsed.toFixed(2),
          updated_at: getPHTimestamp(),
        })
        .eq("id", leaveRequest.leave_balance_id);

      if (updateError) throw updateError;

      const { error: updateRequestError } = await supabase
        .from("leave_requests")
        .update({
          balance_before: currentBalance,
          balance_after: newBalance,
          approved_at: getPHTimestamp(),
        })
        .eq("id", leaveRequestId);

      if (updateRequestError) throw updateRequestError;

      console.log(
        `Balance deducted for leave request ${leaveRequestId}: ${daysToDeduct} days`
      );
    } catch (error) {
      console.error("Error deducting leave balance on approval:", error);
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

        const middle = employeeData.middle_name
          ? ` ${employeeData.middle_name}`
          : "";
        const fullName =
          `${employeeData.first_name}${middle} ${employeeData.last_name}`.trim();
        setFormData((prev) => ({ ...prev, employeeName: fullName }));

        const balanceId = await getLeaveBalanceId(employeeData.id);
        setLeaveBalanceId(balanceId);
      }
    } catch (error) {
      console.error("Error loading employee data:", error);
      setErrorMessage("Failed to load employee data. Please refresh.");
      showErrorToast("Failed to load employee data. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize form when user is loaded
  useEffect(() => {
    if (!authLoading && user) {
      loadEmployeeData();
      loadHolidays();

      const today = formatPHDate(new Date());

      const minStartDate = getCurrentPHDate();
      minStartDate.setDate(minStartDate.getDate() + 5);
      const minStart = formatPHDate(minStartDate);

      setFormData((prev) => ({
        ...prev,
        dateOfFiling: today,
        startDate: minStart,
        endDate: minStart,
        numDays: calculateDays(minStart, minStart),
      }));
    }
  }, [user, authLoading]);

  // Load holidays when component mounts
  useEffect(() => {
    loadHolidays();
  }, [currentYear]);

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
  }, [formData.startDate, formData.endDate, holidays]);

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
      showSuccessToast("Vacation location saved successfully!");
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
      showSuccessToast("Vacation location saved successfully!");
    } else if (!selectedLocation) {
      showErrorToast("Please select a location (Abroad or Philippines).");
    } else if (selectedLocation === "Abroad" && !abroadLocation.trim()) {
      showErrorToast(
        "Please specify the country and city for abroad location."
      );
    } else if (
      selectedLocation === "Philippines" &&
      !philippinesLocation.trim()
    ) {
      showErrorToast(
        "Please specify the province and city/municipality for Philippines location."
      );
    }
  };

  // Handle sick leave details confirmation
  const handleConfirmSickLeaveDetails = () => {
    if (!sickLeaveDetails.type) {
      showErrorToast("Please select whether it's In hospital or Out patient.");
      return;
    }

    if (!sickLeaveDetails.illness.trim()) {
      showErrorToast("Please specify the illness.");
      return;
    }

    setShowSickLeaveModal(false);
    showSuccessToast("Sick leave details saved successfully!");
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

  // Close insufficient balance modal
  const handleCloseInsufficientBalanceModal = () => {
    setShowInsufficientBalanceModal(false);
    setIsWithoutPay(false);
    setLeaveRequestData(null);
    setSubmitLoading(false);
  };

  // NEW: Close form modal
  const handleCloseFormModal = () => {
    setShowFormModal(false);
    const today = formatPHDate(new Date());
    const minStartDate = getCurrentPHDate();
    minStartDate.setDate(minStartDate.getDate() + 5);
    const minStart = formatPHDate(minStartDate);

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
    setErrorMessage("");
    setIsWithoutPay(false);

    showInfoToast("Form reset to default values");
  };

  // Handle insufficient balance confirmation
  const handleConfirmWithoutPay = () => {
    if (!isWithoutPay) {
      showErrorToast(
        "You must acknowledge that this will be leave without pay."
      );
      return;
    }
    submitLeaveRequestFinal(leaveRequestData, true);
    setShowInsufficientBalanceModal(false);
  };

  // Submit leave request to Supabase - DO NOT deduct balance here
  const submitLeaveRequest = async (leaveRequestData) => {
    try {
      // Only get balance for leave types that require credits
      let balanceBefore = 0;
      if (requiresLeaveCredits(leaveRequestData.leave_type)) {
        balanceBefore = await getCurrentLeaveBalance(
          employeeId,
          leaveRequestData.leave_type
        );
      }

      leaveRequestData.balance_before = balanceBefore;
      leaveRequestData.balance_after = balanceBefore;

      const { data, error } = await supabase
        .from("leave_requests")
        .insert([leaveRequestData])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error("Error submitting leave request:", error);
      throw error;
    }
  };

  // Final submission function WITHOUT balance deduction
  const submitLeaveRequestFinal = async (data, isWithoutPay = false) => {
    try {
      const calendarDays = calculateCalendarDays(
        data.start_date,
        data.end_date
      );
      const workingDays = calculateWorkingDays(data.start_date, data.end_date);
      const holidayDays = calendarDays - workingDays;

      data.num_days = calendarDays;
      data.working_days = workingDays;
      data.holiday_days = holidayDays;

      // For leaves without credit requirement, always mark as "special_leave" instead of with/without pay
      if (!requiresLeaveCredits(data.leave_type)) {
       data.approve_for = "with_pay";
        data.paid_days = workingDays; // Special leaves are typically paid
        data.unpaid_days = 0;
      } else {
        data.approve_for = isWithoutPay ? "without_pay" : "with_pay";
        data.paid_days = isWithoutPay ? 0 : workingDays;
        data.unpaid_days = isWithoutPay ? workingDays : 0;
      }

      const result = await submitLeaveRequest(data);

      if (result.success) {
        if (!requiresLeaveCredits(data.leave_type)) {
          showSuccessToast(
            `${data.leave_type} leave request submitted successfully!`
          );
        } else if (isWithoutPay) {
          showWarningToast(
            "Leave request submitted as WITHOUT PAY. No credits deducted."
          );
        } else {
          showSuccessToast(
            "Leave request submitted successfully! Balance will be deducted upon approval."
          );
        }

        const today = formatPHDate(new Date());
        const minStartDate = getCurrentPHDate();
        minStartDate.setDate(minStartDate.getDate() + 5);
        const minStart = formatPHDate(minStartDate);

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

        setShowFormModal(false);
        setShowImportantNotice(false);
      }
    } catch (error) {
      console.error("Error saving leave request:", error);
      showErrorToast("Failed to submit leave request: " + error.message);
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
      showErrorToast("Please select a leave type.");
      setSubmitLoading(false);
      return;
    }

    if (formData.leaveType === "Vacation" && !chosenLocation) {
      showErrorToast("Please select a location for vacation leave.");
      setShowLocationModal(true);
      setSubmitLoading(false);
      return;
    }

    if (
      formData.leaveType === "Sick" &&
      (!sickLeaveDetails.type || !sickLeaveDetails.illness)
    ) {
      showErrorToast("Please provide sick leave details.");
      setShowSickLeaveModal(true);
      setSubmitLoading(false);
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      showErrorToast("Please select both start and end dates.");
      setSubmitLoading(false);
      return;
    }

    if (!formData.numDays || formData.numDays <= 0) {
      showErrorToast("Please enter a valid number of days.");
      setSubmitLoading(false);
      return;
    }

    // Calculate calendar and working days
    const calendarDays = calculateCalendarDays(
      formData.startDate,
      formData.endDate
    );
    const workingDays = calculateWorkingDays(
      formData.startDate,
      formData.endDate
    );

    // Prepare leave request data
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
      num_days: calendarDays,
      working_days: workingDays,
      holiday_days: calendarDays - workingDays,
      status: "Pending",
      reason:
        formData.leaveType === "Sick"
          ? `${
              sickLeaveDetails.type === "in_hospital"
                ? "In hospital"
                : "Out patient"
            }: ${sickLeaveDetails.illness}`
          : `Leave request for ${formData.leaveType.toLowerCase()} leave`,
      submitted_at: getPHTimestamp(),
      leave_balance_id: leaveBalanceId,
      illness_type:
        formData.leaveType === "Sick" ? sickLeaveDetails.type : null,
      illness_details:
        formData.leaveType === "Sick" ? sickLeaveDetails.illness : null,
    };

    // Check if this leave type requires credits
    if (requiresLeaveCredits(formData.leaveType)) {
      // Only check balance for leave types that require credits
      const hasBalance = await hasSufficientBalance(
        employeeId,
        formData.leaveType
      );
      if (!hasBalance) {
        setLeaveRequestData(leaveRequestData);
        setShowInsufficientBalanceModal(true);
        return;
      }
    }

    // For leaves without credit requirement OR leaves with sufficient balance
    await submitLeaveRequestFinal(leaveRequestData);
  };

  // Handle form reset
  const handleReset = () => {
    const today = formatPHDate(new Date());
    const minStartDate = getCurrentPHDate();
    minStartDate.setDate(minStartDate.getDate() + 5);
    const minStart = formatPHDate(minStartDate);

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

    showInfoToast("Form has been reset");
  };

  // Show BFPPreloader when loading
  if (authLoading || isLoading) {
    return <BFPPreloader loading={true} />;
  }

  if (!user) return null;

  return (
    <div className="app">
      <Title>Employee Leave Request | BFP Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <EmployeeSidebar />
      <Hamburger />

      {/* Add ToastContainer here */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />

      <div className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className={styles.leaveFormContainer}>
          <h2 className={styles.pageTitle}>Request Leave</h2>

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
            <p>
              <strong>Special Leaves:</strong> Maternity, Paternity, and
              Emergency leaves do not require leave credits.
            </p>

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
                ⚠️ <strong>Important Notice:</strong>
                <br />
                1. Leave credits will only be deducted when your leave is
                approved.
                <br />
                2. Only working days (excluding weekends/holidays) are deducted
                from your balance.
                <br />
                3. Maternity, Paternity, and Emergency leaves do not require
                leave credits.
                <br />
                4. For Vacation and Sick leaves, you can still apply even with
                insufficient credits, but it will be considered as leave without
                pay.
              </p>
            )}
          </div>
          <div className={styles.requestButtonContainer}>
            <button
              className={styles.requestButton}
              onClick={() => setShowFormModal(true)}
            >
              <i className="fas fa-plus-circle"></i> Request New Leave
            </button>
          </div>
          <div className={styles.leaveMeterTop}>
            <LeaveMeter />
          </div>

          {errorMessage && (
            <div className={styles.errorMessage}>
              <span className={styles.errorIcon}>⚠️</span>
              {errorMessage}
            </div>
          )}

          {/* NEW: Form Modal */}
          {showFormModal && (
            <div
              className={`${styles.modal} ${styles.formModal}`}
              style={{ display: "flex" }}
            >
              <div className={styles.modalContent}>
                <span
                  className={styles.closeBtn}
                  onClick={handleCloseFormModal}
                >
                  &times;
                </span>
                <h3>Request New Leave</h3>

                <form onSubmit={handleSubmit} className={styles.formCardModal}>
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
                        max={formatPHDate(new Date())}
                      />
                      <label>Date of Filing</label>
                    </div>

                    <div className={styles.formGroupFull}>
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
                      {formData.leaveType === "Sick" &&
                        sickLeaveDetails.type && (
                          <small className={styles.chosenLocation}>
                            Type:{" "}
                            {sickLeaveDetails.type === "in_hospital"
                              ? "In hospital"
                              : "Out patient"}
                            {sickLeaveDetails.illness &&
                              ` - ${sickLeaveDetails.illness}`}
                          </small>
                        )}
                      {LEAVES_WITHOUT_CREDIT_REQUIREMENT.includes(
                        formData.leaveType
                      ) && (
                        <small
                          className={styles.chosenLocation}
                          style={{ color: "#2e7d32", fontWeight: "bold" }}
                        >
                          ✓ This leave type does not require leave credits
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
                        min={formatPHDate(
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

                    <div className={styles.formGroupFull}>
                      <input
                        type="number"
                        name="numDays"
                        value={formData.numDays}
                        readOnly
                        className={styles.numDaysInput}
                      />
                      <label>Working Days (for deduction)</label>
                      <small className={styles.daysNote}>
                        Excludes weekends and holidays
                      </small>
                    </div>
                  </div>

                  <div className={styles.formButtons}>
                    <button
                      type="button"
                      onClick={handleCloseFormModal}
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
          )}
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

        {/* Insufficient Balance Modal */}
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
                  <strong>You don't have enough leave credits!</strong>
                </p>
                <p>
                  Leave Type: <strong>{leaveRequestData.leave_type}</strong>
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
                  Your leave request will be submitted as
                  <strong> leave without pay</strong>. No leave credits will be
                  deducted, and this will be unpaid leave.
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
      </div>
    </div>
  );
};

export default EmployeeLeaveRequest;
