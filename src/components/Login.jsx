import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Title, Meta } from "react-head";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  User,
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Lock as LockIcon,
  Key,
  UserCheck,
  Info,
  ShieldAlert,
  Copyright,
  FileWarning,
  X,
  Clock3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import "./Login.css";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/OPSCORE.png";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    type: "info", // 'success', 'warning', 'error', 'info'
  });

  // Enhanced notice modal state
  const [noticeModal, setNoticeModal] = useState({
    show: false,
    title: "📌 Important Notice: Use of Generated Assets",
    message: "",
    acknowledged: false,
  });

  const [isLocked, setIsLocked] = useState(false);
  const [loginButtonText, setLoginButtonText] = useState("Login");
  const [shake, setShake] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState(null);
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const [attempts, setAttempts] = useState(0);
  const [securityData, setSecurityData] = useState(null);
  const [loadingSecurity, setLoadingSecurity] = useState(true);
  const [loading, setLoading] = useState(false);

  // Enhanced idle timer
  const idleTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const idleWarningRef = useRef(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const activityEvents = [
    "mousemove",
    "keydown",
    "click",
    "scroll",
    "touchstart",
    "mousedown",
  ];
  const [questionsModal, setQuestionsModal] = useState({
    show: false,
    title: "Contact Information",
    message:
      "For questions about this project, please contact the development team. This is a capstone project for educational purposes only.",
  });
  // NEW: Mobile scroll functionality
  const missionSectionRef = useRef(null);
  const loginSectionRef = useRef(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  const MAX_ATTEMPTS = 3;
  const MAX_LOCKOUTS = 3;
  const [clientIp, setClientIp] = useState("unknown");

  // Get client IP
  useEffect(() => {
    const getIP = async () => {
      try {
        const response = await fetch("https://api.ipify.org?format=json");
        const data = await response.json();
        setClientIp(data.ip);
      } catch (error) {
        console.log("Could not get IP:", error);
        setClientIp(
          `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        );
      }
    };
    getIP();
  }, []);

  // Load security data when IP is available
  useEffect(() => {
    if (clientIp !== "unknown") {
      loadSecurityData();
    }
  }, [clientIp]);

  // Enhanced effect for showing notice modal
  useEffect(() => {
    // Check if user has already acknowledged the notice
    const hasAcknowledged = localStorage.getItem("bfp_notice_acknowledged");

    if (!hasAcknowledged) {
      // Show notice modal after a short delay
      const timer = setTimeout(() => {
        showNoticeModal();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  // Enhanced effect for idle time tracking
  useEffect(() => {
    if (noticeModal.show) {
      // Reset timer
      setTimeRemaining(60);
      setShowIdleWarning(false);

      // Clear existing timers
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      if (idleWarningRef.current) clearTimeout(idleWarningRef.current);

      // Start idle timer
      idleTimerRef.current = setInterval(() => {
        const now = Date.now();
        const idleTime = now - lastActivityRef.current;

        if (idleTime >= 50000 && !showIdleWarning) {
          // 50 seconds
          setShowIdleWarning(true);
          idleWarningRef.current = setTimeout(() => {
            closeNoticeModal();
          }, 10000); // Close after 10 more seconds
        }

        // Update countdown
        const remaining = Math.max(0, 60 - Math.floor(idleTime / 1000));
        setTimeRemaining(remaining);

        if (idleTime >= 60000) {
          // 1 minute
          closeNoticeModal();
        }
      }, 1000);

      // Add activity listeners
      activityEvents.forEach((event) => {
        window.addEventListener(event, updateLastActivity);
      });

      // Cleanup function
      return () => {
        if (idleTimerRef.current) clearInterval(idleTimerRef.current);
        if (idleWarningRef.current) clearTimeout(idleWarningRef.current);
        activityEvents.forEach((event) => {
          window.removeEventListener(event, updateLastActivity);
        });
      };
    }
  }, [noticeModal.show]);

  // NEW: Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 992;
      setIsMobile(mobile);
      if (!mobile) {
        setShowScrollDown(false);
        setShowScrollUp(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // NEW: Handle scroll to show/hide arrows
  useEffect(() => {
    const handleScroll = () => {
      if (!isMobile) return;

      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Show scroll down arrow if we're near the top (login section)
      setShowScrollDown(scrollTop < windowHeight * 0.3);

      // Show scroll up arrow if we're scrolled down to mission section
      setShowScrollUp(scrollTop > windowHeight * 0.5);

      setHasScrolled(scrollTop > 50);
    };

    if (isMobile) {
      window.addEventListener("scroll", handleScroll);
      handleScroll(); // Initial check
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  // Function to update last activity time
  const updateLastActivity = () => {
    lastActivityRef.current = Date.now();
    if (showIdleWarning) {
      setShowIdleWarning(false);
      if (idleWarningRef.current) {
        clearTimeout(idleWarningRef.current);
      }
    }
  };

  // NEW: Scroll to mission section
  const scrollToMission = () => {
    if (missionSectionRef.current) {
      missionSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // NEW: Scroll to login section
  const scrollToLogin = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Enhanced function to show notice modal
  const showNoticeModal = () => {
    setNoticeModal({
      show: true,
      title: "📌 Important Notice: Use of Generated Assets",
      message: `

## Generated Visual Assets

All rank insignias, badges, icons, logos, and visual elements displayed in this system are:
📌Digitally generated for demonstration purposes
📌Not official BFP representations
📌Not authorized for operational use
📌Not intended for identification or official government purposes

## Intellectual Property Disclaimer

The developers do not claim ownership of any official BFP trademarks, insignias, or intellectual property. All official BFP symbols remain the exclusive property of the Bureau of Fire Protection.

## Purpose Statement

This project is developed strictly for:
📌Academic requirements fulfillment
📌System functionality demonstration
📌Interface design visualization
📌Educational technology showcase

## User Acknowledgement

By continuing to use this system, you acknowledge that this is a demonstration project and not an official government system.`,
      acknowledged: false,
    });

    // Reset last activity
    lastActivityRef.current = Date.now();
  };

  // Enhanced function to close notice modal
  const closeNoticeModal = (permanent = false) => {
    if (permanent) {
      localStorage.setItem("bfp_notice_acknowledged", "true");
      setNoticeModal((prev) => ({ ...prev, acknowledged: true }));
    }

    setNoticeModal({
      show: false,
      title: "",
      message: "",
      acknowledged: false,
    });

    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (idleWarningRef.current) {
      clearTimeout(idleWarningRef.current);
      idleWarningRef.current = null;
    }

    setShowIdleWarning(false);
  };

  // Click outside handler for the notice modal
  const handleNoticeOverlayClick = (e) => {
    if (e.target.classList.contains("notice-modal-overlay")) {
      // Don't close on overlay click - require explicit acknowledgement
      showModal(
        "Notice Acknowledgement Required",
        "Please read and acknowledge the notice before proceeding.",
        "info"
      );
    }
  };

  // Helper function to render markdown-like text
  const renderNoticeMessage = (message) => {
    const lines = message.split("\n");
    return lines.map((line, index) => {
      if (line.startsWith("## ")) {
        return (
          <h4 key={index} className="notice-section-title">
            {line.replace("## ", "")}
          </h4>
        );
      } else if (line.startsWith("**") && line.endsWith("**")) {
        return (
          <strong key={index} className="notice-bold">
            {line.replace(/\*\*/g, "")}
          </strong>
        );
      } else if (line.trim() === "") {
        return <br key={index} />;
      } else {
        return (
          <p key={index} className="notice-paragraph">
            {line}
          </p>
        );
      }
    });
  };

  const loadSecurityData = async () => {
    try {
      setLoadingSecurity(true);
      const now = Date.now();

      // Try to load from login_security table
      try {
        const { data, error } = await supabase
          .from("login_security")
          .select("*")
          .eq("ip_address", clientIp)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 means no rows returned
          console.error("Error loading security data:", error);
          // Initialize with default data
          const defaultData = {
            failed_attempts: 0,
            lockout_count: 0,
            temp_until: null,
            brute_force_until: null,
          };
          setSecurityData(defaultData);
        } else if (data) {
          setSecurityData(data);
          handleSecurityData(data, now);
        } else {
          // Create new security record
          await createSecurityRecord();
        }
      } catch (error) {
        console.error("Error in security data load:", error);
        // Initialize with default data
        const defaultData = {
          failed_attempts: 0,
          lockout_count: 0,
          temp_until: null,
          brute_force_until: null,
        };
        setSecurityData(defaultData);
      }
    } catch (error) {
      console.error("Error in loadSecurityData:", error);
      // Initialize with default data
      const defaultData = {
        failed_attempts: 0,
        lockout_count: 0,
        temp_until: null,
        brute_force_until: null,
      };
      setSecurityData(defaultData);
    } finally {
      setLoadingSecurity(false);
    }
  };

  const handleSecurityData = (data, now) => {
    if (data?.brute_force_until && now < data.brute_force_until) {
      const remainingMs = data.brute_force_until - now;
      startBruteForceCountdown(remainingMs);
      showModal(
        "🚫 Login Blocked",
        `Login is blocked. Please wait ${formatMs(
          remainingMs
        )} before trying again.`,
        "error"
      );
      return;
    }

    if (data?.temp_until && now < data.temp_until) {
      const remaining = Math.ceil((data.temp_until - now) / 1000);
      lockLoginTemp(remaining);
      showModal(
        "⏳ Temporary Lock",
        `Too many failed attempts. Please wait ${remaining} seconds before retrying.`,
        "warning"
      );
    } else {
      setIsLocked(false);
      setAttempts(data?.failed_attempts || 0);
    }
  };

  const createSecurityRecord = async () => {
    try {
      const newRecord = {
        ip_address: clientIp,
        failed_attempts: 0,
        lockout_count: 0,
        temp_until: null,
        brute_force_until: null,
        last_attempt: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("login_security")
        .insert([newRecord])
        .select()
        .single();

      if (!error) {
        setSecurityData(data);
        return data;
      }

      // If error, just set default data
      setSecurityData(newRecord);
      return newRecord;
    } catch (error) {
      console.error("Error creating security record:", error);
      const defaultData = {
        failed_attempts: 0,
        lockout_count: 0,
        temp_until: null,
        brute_force_until: null,
      };
      setSecurityData(defaultData);
      return defaultData;
    }
  };

  const updateSecurityRecord = async (updates) => {
    try {
      const supabaseUpdates = {
        ...updates,
        last_attempt: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("login_security")
        .update(supabaseUpdates)
        .eq("ip_address", clientIp)
        .select()
        .single();

      if (!error && data) {
        setSecurityData(data);
        return data;
      }

      // If update fails, update local state
      const newData = { ...securityData, ...updates };
      setSecurityData(newData);
      return newData;
    } catch (error) {
      console.error("Error updating security record:", error);
      const newData = { ...securityData, ...updates };
      setSecurityData(newData);
      return newData;
    }
  };

  const formatMs = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  };

  const showModal = (title, message, type = "info") => {
    setModal({ show: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ show: false, title: "", message: "", type: "info" });
    setAttemptStatus(null);
  };

  const lockLoginTemp = async (seconds) => {
    setIsLocked(true);
    const now = Date.now();
    const tempUntil = now + seconds * 1000;

    await updateSecurityRecord({
      temp_until: tempUntil,
    });

    let remaining = seconds;
    setLoginButtonText(`Retry in ${remaining}s`);
    setAttemptStatus("locked");

    const interval = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        setLoginButtonText(`Retry in ${remaining}s`);
      } else {
        clearInterval(interval);
        setIsLocked(false);
        setAttempts(0);
        updateSecurityRecord({
          temp_until: null,
          failed_attempts: 0,
        });
        setLoginButtonText("Login");
        setAttemptStatus(null);
      }
    }, 1000);
  };

  const startBruteForceCountdown = (remainingMs) => {
    const update = () => {
      remainingMs -= 1000;

      if (remainingMs <= 0) {
        updateSecurityRecord({
          brute_force_until: null,
          lockout_count: 0,
          failed_attempts: 0,
        });
        setLoginButtonText("Login");
        setAttemptStatus(null);
        if (modal.show) {
          closeModal();
        }
        return;
      }

      const formatted = formatMs(remainingMs);
      setLoginButtonText(`Blocked ${formatted}`);

      setTimeout(update, 1000);
    };

    update();
  };

  const triggerBruteForceBlock = async (seconds) => {
    const now = Date.now();
    const until = now + seconds * 1000;

    await updateSecurityRecord({
      brute_force_until: until,
      lockout_count: (securityData?.lockout_count || 0) + 1,
      failed_attempts: 0,
      temp_until: null,
    });

    startBruteForceCountdown(seconds * 1000);
    showModal(
      "🚫 Account Blocked",
      `Multiple lockouts detected. Login blocked for ${Math.ceil(
        seconds / 60
      )} minute(s).`,
      "error"
    );
  };

  const handleTempLockAndMaybeBruteForce = async (seconds) => {
    const newLockoutCount = (securityData?.lockout_count || 0) + 1;

    await updateSecurityRecord({
      lockout_count: newLockoutCount,
      failed_attempts: MAX_ATTEMPTS,
    });

    lockLoginTemp(seconds);

    if (newLockoutCount >= MAX_LOCKOUTS) {
      triggerBruteForceBlock(600);
    }
  };

  const getAttemptStatusMessage = () => {
    if (!securityData) return null;

    const failedAttempts = securityData.failed_attempts || 0;
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - failedAttempts);

    if (failedAttempts === 0) {
      return {
        message: "No failed attempts",
        type: "success",
        icon: <CheckCircle size={16} />,
      };
    } else if (failedAttempts === 1) {
      return {
        message: `1 failed attempt • ${attemptsLeft} attempts remaining`,
        type: "warning",
        icon: <AlertCircle size={16} />,
      };
    } else if (failedAttempts === 2) {
      return {
        message: `2 failed attempts • ${attemptsLeft} attempt remaining`,
        type: "warning",
        icon: <AlertTriangle size={16} />,
      };
    } else if (failedAttempts >= MAX_ATTEMPTS) {
      return {
        message: `Account locked • Too many failed attempts`,
        type: "error",
        icon: <LockIcon size={16} />,
      };
    }
    return null;
  };

  const getSecurityStatus = () => {
    if (!securityData) return "Loading...";

    if (
      securityData.brute_force_until &&
      Date.now() < securityData.brute_force_until
    ) {
      return "Blocked";
    } else if (
      securityData.temp_until &&
      Date.now() < securityData.temp_until
    ) {
      return "Temporary Lock";
    } else if ((securityData.failed_attempts || 0) > 0) {
      return "Warning";
    }
    return "Secure";
  };

  const getSecurityLevel = () => {
    if (!securityData) return 3;

    if (
      securityData.brute_force_until &&
      Date.now() < securityData.brute_force_until
    ) {
      return 0;
    } else if (
      securityData.temp_until &&
      Date.now() < securityData.temp_until
    ) {
      return 1;
    } else if ((securityData.failed_attempts || 0) >= 2) {
      return 2;
    }
    return 3;
  };

  const handleLogin = async () => {
    if (loadingSecurity || loading) {
      showModal("Please wait", "System is initializing...", "info");
      return;
    }

    if (!securityData) {
      showModal("System Error", "Security system not initialized.", "error");
      return;
    }

    // Check brute force lock
    if (
      securityData.brute_force_until &&
      Date.now() < securityData.brute_force_until
    ) {
      const remainingMs = securityData.brute_force_until - Date.now();
      showModal(
        "🚫 Login Blocked",
        `Please wait ${formatMs(remainingMs)}`,
        "error"
      );
      return;
    }

    if (isLocked) {
      showModal("Please wait", "Temporary cooldown active.", "warning");
      return;
    }

    if (!username.trim() || !password.trim()) {
      showModal(
        "Missing fields",
        "Please enter both username and password.",
        "warning"
      );
      return;
    }

    setLoading(true);
    setLoginButtonText("Logging in...");
    setAttemptStatus("loading");

    try {
      // Try unified login (this checks all user types)
      const result = await authLogin(username, password);

      if (result.success) {
        // Reset security attempts on successful login
        await updateSecurityRecord({
          failed_attempts: 0,
          lockout_count: 0,
          temp_until: null,
          brute_force_until: null,
        });

        setAttemptStatus("success");
        showModal(
          "Login Successful",
          `Welcome back, ${
            result.user?.name || username
          }! Redirecting to dashboard...`,
          "success"
        );

        // Navigate based on user type and role
        setTimeout(() => {
          closeModal();
          const user = result.user;
          console.log("Login successful, user data:", user);

          // Handle routing based on user role
          switch (user.role) {
            case "admin":
              navigate("/admin");
              break;
            case "inspector":
              navigate("/inspectorDashboard");
              break;
            case "employee":
              navigate("/employee/dashboard");
              break;
            case "recruitment":
              navigate("/recruitment/dashboard");
              break;
            default:
              // Check user_type as fallback
              if (user.user_type === "admin") {
                navigate("/admin");
              } else if (user.user_type === "personnel") {
                navigate("/employee/dashboard");
              } else if (user.user_type === "recruitment") {
                navigate("/recruitment/dashboard");
              } else {
                navigate("/");
              }
          }
        }, 1500);
      } else {
        // Handle failed login
        const newAttempts = (securityData?.failed_attempts || 0) + 1;
        const attemptsLeft = Math.max(0, MAX_ATTEMPTS - newAttempts);

        await updateSecurityRecord({
          failed_attempts: newAttempts,
        });

        setPassword("");
        setShake(true);
        setAttemptStatus("failed");
        setTimeout(() => setShake(false), 400);

        if (newAttempts >= MAX_ATTEMPTS) {
          handleTempLockAndMaybeBruteForce(30);
          showModal(
            " Account Locked",
            "Too many failed attempts. Account locked for 30 seconds. Please wait before trying again.",
            "error"
          );
        } else {
          showModal(
            " Invalid Credentials",
            result.message ||
              `Invalid username or password. You have ${attemptsLeft} attempt${
                attemptsLeft !== 1 ? "s" : ""
              } remaining.`,
            "warning"
          );
        }

        setLoginButtonText("Login");
      }
    } catch (error) {
      console.error("Login error:", error);
      setAttemptStatus("error");
      showModal(
        " System Error",
        "Unable to login. Please try again or contact support.",
        "error"
      );
      setLoginButtonText("Login");
    } finally {
      setLoading(false);
      if (attemptStatus !== "success") {
        setTimeout(() => setAttemptStatus(null), 2000);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
    updateLastActivity();
  };

  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    updateLastActivity();
  };

  if (loadingSecurity) {
    return (
      <div className="login-container">
        <div className="login-left">
          <div className="logo-container">
            <h1>Bureau of Fire Protection Villanueva</h1>
          </div>
        </div>
        <div className="login-right">
          <div className="login-box">
            <div className="loading-spinner">
              <Loader2 className="animate-spin" size={32} />
            </div>
            <h2>Loading Security Settings...</h2>
            <p>Please wait while we initialize the login system</p>
          </div>
        </div>
      </div>
    );
  }

  const attemptStatusInfo = getAttemptStatusMessage();
  const securityStatus = getSecurityStatus();
  const securityLevel = getSecurityLevel();

  return (
    <div className="login-container">
      <Title>Bureau of Fire Protection Villanueva</Title>
      <Meta name="robots" content="noindex, nofollow" />

      {/* Mobile Scroll Arrows */}
      {isMobile && showScrollDown && (
        <button
          className="scroll-arrow scroll-down"
          onClick={scrollToMission}
          aria-label="Scroll down to mission section"
        >
          <ChevronDown size={24} />
          <span>View Our Mission</span>
        </button>
      )}

      {isMobile && showScrollUp && (
        <button
          className="scroll-arrow scroll-up"
          onClick={scrollToLogin}
          aria-label="Scroll up to login form"
        >
          <ChevronUp size={24} />
          <span>Back to Login</span>
        </button>
      )}

      {/* Conditional rendering based on screen size */}
      {!isMobile ? (
        // Desktop Layout
        <>
          {/* Left Side with background.png and Mission Statements */}
          <div className="login-left">
            <div className="logo-container">
              <div className="logo-wrapper">
                <h1 className="h1text">Bureau of Fire Protection</h1>
                <h2>Villanueva Fire Station</h2>
                <p className="tagline">
                  Serving with Courage, Protecting with Care
                </p>
              </div>
            </div>
            <div className="mission-section">
              <div className="mission-cards">
                <div className="mission-card">
                  <div className="mission-icon">🔥</div>
                  <div className="mission-content">
                    <h3>"Service, Honor, and Duty"</h3>
                    <p>
                      To save lives and protect property with unwavering
                      commitment
                    </p>
                  </div>
                </div>

                <div className="mission-card">
                  <div className="mission-icon">🚒</div>
                  <div className="mission-content">
                    <h3>"Always Ready to Respond"</h3>
                    <p>
                      Always committed to public safety and emergency response
                    </p>
                  </div>
                </div>

                <div className="mission-card">
                  <div className="mission-icon">👨‍🚒</div>
                  <div className="mission-content">
                    <h3>"Dedicated Firefighters"</h3>
                    <p>
                      Upholding excellence, discipline, and integrity in service
                    </p>
                  </div>
                </div>
              </div>

              <div className="vision-banner">
                <div className="vision-content">
                  <h4>Our Vision</h4>
                  <p>
                    A modern fire service institution, responsive to the needs
                    of our community, working towards a safer Villanueva.
                  </p>
                </div>
              </div>
            </div>

            <div className="contact-info">
              <p>📍Poblacion-1, Villanueva Fire Station, Misamis Oriental</p>
              <p>📞 Emergency: 911 | Station: (088) 890 6310</p>
              <p>📧 bfp.villanueva@fireprotection.gov.ph</p>
            </div>
          </div>

          {/* Right Side with Login Form */}
          <div className="login-right">
            <div className="login-wrapper">
              <div className={`login-box ${shake ? "shake" : ""}`}>
                <div className="login-header">
                  <div className="header-icon">
                    <Lock size={28} />
                  </div>
                  <h2>Secure Login Portal</h2>
                  <p>Authorized Personnel Access Only</p>
                  <p className="login-subtitle">
                    Bureau of Fire Protection Villanueva
                  </p>
                </div>

                {/* Attempt Status Indicator */}
                {attemptStatusInfo && (
                  <div className={`attempt-status ${attemptStatusInfo.type}`}>
                    <div className="attempt-status-icon">
                      {attemptStatusInfo.icon}
                    </div>
                    <span>{attemptStatusInfo.message}</span>
                  </div>
                )}

                <div className="input-group">
                  <div className="input-wrapper">
                    <User className="input-icon" size={18} />
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={handleInputChange(setUsername)}
                      onKeyPress={handleKeyPress}
                      required
                      placeholder=" "
                      disabled={
                        isLocked ||
                        (securityData?.brute_force_until &&
                          Date.now() < securityData.brute_force_until) ||
                        loadingSecurity ||
                        loading
                      }
                      autoComplete="username"
                    />
                    <label htmlFor="username">Username / ID Number</label>
                  </div>
                </div>

                <div className="input-group">
                  <div className="input-wrapper">
                    <Lock className="input-icon" size={18} />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={handleInputChange(setPassword)}
                      onKeyPress={handleKeyPress}
                      required
                      placeholder=" "
                      disabled={
                        isLocked ||
                        (securityData?.brute_force_until &&
                          Date.now() < securityData.brute_force_until) ||
                        loadingSecurity ||
                        loading
                      }
                      autoComplete="current-password"
                    />
                    <label htmlFor="password">Password</label>
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => {
                        setShowPassword(!showPassword);
                        updateLastActivity();
                      }}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Security Status Indicator */}
                <div className="security-status">
                  <div className="security-level">
                    <div className="security-bars">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`security-bar ${
                            securityLevel >= level ? "active" : ""
                          } ${
                            securityLevel >= level
                              ? `level-${securityLevel}`
                              : ""
                          }`}
                        ></div>
                      ))}
                    </div>
                    <div className="security-info">
                      <span className="security-label">Security Status:</span>
                      <span
                        className={`security-value ${securityStatus.toLowerCase()}`}
                      >
                        {securityStatus}
                      </span>
                    </div>
                  </div>

                  {securityData && (
                    <div className="security-details">
                      <div className="security-detail">
                        <Key size={12} />
                        <span>
                          Failed Attempts: {securityData.failed_attempts || 0}/3
                        </span>
                      </div>
                      <div className="security-detail">
                        <Shield size={12} />
                        <span>
                          Lockouts: {securityData.lockout_count || 0}/3
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  className={`login-button ${
                    attemptStatus ? attemptStatus : ""
                  }`}
                  onClick={() => {
                    handleLogin();
                    updateLastActivity();
                  }}
                  disabled={
                    isLocked ||
                    (securityData?.brute_force_until &&
                      Date.now() < securityData.brute_force_until) ||
                    loadingSecurity ||
                    loading
                  }
                >
                  <span className="button-content">
                    {loginButtonText}
                    {attemptStatus === "loading" && (
                      <Loader2 className="button-loading" size={18} />
                    )}
                    {attemptStatus === "success" && (
                      <CheckCircle className="button-success" size={18} />
                    )}
                    {attemptStatus === "failed" && (
                      <XCircle className="button-failed" size={18} />
                    )}
                    {!attemptStatus && <span className="button-icon">→</span>}
                  </span>
                </button>

                <div className="login-info">
                  <div className="info-item">
                    <UserCheck size={14} />
                    <small>Use your official BFP credentials</small>
                  </div>
                  <div className="info-item">
                    <Shield size={14} />
                    <small>256-bit encryption & secure access logging</small>
                  </div>
                  <small className="access-warning">
                    ⚠️ Unauthorized access is prohibited and punishable by law
                  </small>
                </div>
              </div>

              <div className="login-footer">
                <div className="system-info">
                  <span>System v1.5.2</span>
                  <span className="status-dot active"></span>
                  <span>Operational</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        // Mobile Layout - Login Form First
        <div className="mobile-login-container">
          {/* Login Section at Top */}
          <div className="mobile-login-section" ref={loginSectionRef}>
            <div className="login-right mobile-login-right">
              <div className="login-wrapper">
                <div className={`login-box ${shake ? "shake" : ""}`}>
                  <div className="login-header">
                    <div className="header-icon">
                      <Lock size={28} />
                    </div>
                    <h2>Secure Login Portal</h2>
                    <p>Authorized Personnel Access Only</p>
                    <p className="login-subtitle">
                      Bureau of Fire Protection Villanueva
                    </p>
                  </div>

                  {/* Attempt Status Indicator */}
                  {attemptStatusInfo && (
                    <div className={`attempt-status ${attemptStatusInfo.type}`}>
                      <div className="attempt-status-icon">
                        {attemptStatusInfo.icon}
                      </div>
                      <span>{attemptStatusInfo.message}</span>
                    </div>
                  )}

                  <div className="input-group">
                    <div className="input-wrapper">
                      <User className="input-icon" size={18} />
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={handleInputChange(setUsername)}
                        onKeyPress={handleKeyPress}
                        required
                        placeholder=" "
                        disabled={
                          isLocked ||
                          (securityData?.brute_force_until &&
                            Date.now() < securityData.brute_force_until) ||
                          loadingSecurity ||
                          loading
                        }
                        autoComplete="username"
                      />
                      <label htmlFor="username">Username / ID Number</label>
                    </div>
                  </div>

                  <div className="input-group">
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={18} />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={handleInputChange(setPassword)}
                        onKeyPress={handleKeyPress}
                        required
                        placeholder=" "
                        disabled={
                          isLocked ||
                          (securityData?.brute_force_until &&
                            Date.now() < securityData.brute_force_until) ||
                          loadingSecurity ||
                          loading
                        }
                        autoComplete="current-password"
                      />
                      <label htmlFor="password">Password</label>
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => {
                          setShowPassword(!showPassword);
                          updateLastActivity();
                        }}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Security Status Indicator */}
                  <div className="security-status">
                    <div className="security-level">
                      <div className="security-bars">
                        {[1, 2, 3].map((level) => (
                          <div
                            key={level}
                            className={`security-bar ${
                              securityLevel >= level ? "active" : ""
                            } ${
                              securityLevel >= level
                                ? `level-${securityLevel}`
                                : ""
                            }`}
                          ></div>
                        ))}
                      </div>
                      <div className="security-info">
                        <span className="security-label">Security Status:</span>
                        <span
                          className={`security-value ${securityStatus.toLowerCase()}`}
                        >
                          {securityStatus}
                        </span>
                      </div>
                    </div>

                    {securityData && (
                      <div className="security-details">
                        <div className="security-detail">
                          <Key size={12} />
                          <span>
                            Failed Attempts: {securityData.failed_attempts || 0}
                            /3
                          </span>
                        </div>
                        <div className="security-detail">
                          <Shield size={12} />
                          <span>
                            Lockouts: {securityData.lockout_count || 0}/3
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    className={`login-button ${
                      attemptStatus ? attemptStatus : ""
                    }`}
                    onClick={() => {
                      handleLogin();
                      updateLastActivity();
                    }}
                    disabled={
                      isLocked ||
                      (securityData?.brute_force_until &&
                        Date.now() < securityData.brute_force_until) ||
                      loadingSecurity ||
                      loading
                    }
                  >
                    <span className="button-content">
                      {loginButtonText}
                      {attemptStatus === "loading" && (
                        <Loader2 className="button-loading" size={18} />
                      )}
                      {attemptStatus === "success" && (
                        <CheckCircle className="button-success" size={18} />
                      )}
                      {attemptStatus === "failed" && (
                        <XCircle className="button-failed" size={18} />
                      )}
                      {!attemptStatus && <span className="button-icon">→</span>}
                    </span>
                  </button>

                  <div className="login-info">
                    <div className="info-item">
                      <UserCheck size={14} />
                      <small>Use your official BFP credentials</small>
                    </div>
                    <div className="info-item">
                      <Shield size={14} />
                      <small>256-bit encryption & secure access logging</small>
                    </div>
                    <small className="access-warning">
                      ⚠️ Unauthorized access is prohibited and punishable by law
                    </small>
                  </div>
                </div>

                <div className="login-footer">
                  <div className="system-info">
                    <span>System v1.5.2</span>
                    <span className="status-dot active"></span>
                    <span>Operational</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mission Section Below */}
          <div className="mobile-mission-section" ref={missionSectionRef}>
            <div className="login-left mobile-login-left">
              <div className="logo-container">
                <div className="logo-wrapper">
                  <h1 className="h1text">Bureau of Fire Protection</h1>
                  <h2>Villanueva Fire Station</h2>
                  <p className="tagline">
                    Serving with Courage, Protecting with Care
                  </p>
                </div>
              </div>
              <div className="mission-section">
                <div className="mission-cards">
                  <div className="mission-card">
                    <div className="mission-icon">🔥</div>
                    <div className="mission-content">
                      <h3>"Service, Honor, and Duty"</h3>
                      <p>
                        To save lives and protect property with unwavering
                        commitment
                      </p>
                    </div>
                  </div>

                  <div className="mission-card">
                    <div className="mission-icon">🚒</div>
                    <div className="mission-content">
                      <h3>"Always Ready to Respond"</h3>
                      <p>
                        Always committed to public safety and emergency response
                      </p>
                    </div>
                  </div>

                  <div className="mission-card">
                    <div className="mission-icon">👨‍🚒</div>
                    <div className="mission-content">
                      <h3>"Dedicated Firefighters"</h3>
                      <p>
                        Upholding excellence, discipline, and integrity in
                        service
                      </p>
                    </div>
                  </div>
                </div>

                <div className="vision-banner">
                  <div className="vision-content">
                    <h4>Our Vision</h4>
                    <p>
                      A modern fire service institution, responsive to the needs
                      of our community, working towards a safer Villanueva.
                    </p>
                  </div>
                </div>
              </div>

              <div className="contact-info">
                <p>📍Poblacion-1, Villanueva Fire Station, Misamis Oriental</p>
                <p>📞 Emergency: 911 | Station: (088) 890 6310</p>
                <p>📧 bfp.villanueva@fireprotection.gov.ph</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal.show && (
        <div className="modal-overlay-log">
          <div className={`modal-content-log modal-${modal.type}`}>
            <div className="modal-header-log">
              {modal.type === "success" && (
                <CheckCircle className="modal-icon-log" size={28} />
              )}
              {modal.type === "warning" && (
                <AlertTriangle className="modal-icon-log" size={28} />
              )}
              {modal.type === "error" && (
                <XCircle className="modal-icon-log" size={28} />
              )}
              {modal.type === "info" && (
                <AlertCircle className="modal-icon-log" size={28} />
              )}
              <h3 className={`modal-title-${modal.type}`}>{modal.title}</h3>
            </div>
            <p>{modal.message}</p>
            <button
              className={`modal-button-log modal-${modal.type}`}
              onClick={closeModal}
              autoFocus
            >
              {modal.type === "success" ? "Continue" : "OK"}
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Notice Modal with Logo at the top of the sentence */}
      {noticeModal.show && (
        <div
          className="notice-modal-overlay"
          onClick={handleNoticeOverlayClick}
        >
          <div
            className="notice-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notice-modal-header">
              <div className="notice-header-logo">
                <img src={logo} alt="OPSCORE Logo" className="notice-logo" />
              </div>
              <div className="notice-header-content">
                <h3>{noticeModal.title}</h3>
                <div className="notice-subtitle">
                  <Info size={14} />
                  <span>Educational System • Demonstration Only</span>
                </div>
              </div>
              <button
                className="notice-modal-close"
                onClick={() => closeNoticeModal(false)}
                aria-label="Close notice"
              >
                <X size={20} />
              </button>
            </div>

            <div className="notice-modal-body-container">
              <div className="notice-modal-body">
                <div className="notice-alert-banner">
                  <div className="banner-content">
                    <FileWarning size={20} />
                    <span>
                      <strong>Important Disclaimer:</strong> All visual assets
                      in this system are digitally generated for demonstration
                      purposes only and do not represent official BFP materials.
                    </span>
                  </div>
                </div>

                {/* Logo at the top of the sentence */}
                <div className="notice-top-section">
                  <div className="notice-logo-sentence">
                    <div className="sentence-logo">
                      <img
                        src={logo}
                        alt="OPSCORE Logo"
                        className="sentence-logo-img"
                      />
                    </div>
                    <div className="sentence-content">
                      <h4 className="sentence-title">About OPSCORE</h4>
                      <p className="sentence-text">
                        <strong>OPSCORE</strong> is a capstone project developed
                        for educational purposes only. This system demonstrates
                        modern web application development concepts and is{" "}
                        <strong>not</strong> an official Bureau of Fire
                        Protection (BFP) system.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="notice-content">
                  {renderNoticeMessage(noticeModal.message)}
                </div>

                <div className="notice-highlights">
                  <div className="notice-highlight">
                    <div className="highlight-icon">🎓</div>
                    <span>Academic Project</span>
                    <p className="highlight-description">
                      Developed for educational requirements
                    </p>
                  </div>
                  <div className="notice-highlight">
                    <div className="highlight-icon">🖼️</div>
                    <span>Generated Assets</span>
                    <p className="highlight-description">
                      All visuals are for demonstration only
                    </p>
                  </div>
                  <div className="notice-highlight">
                    <div className="highlight-icon">⚠️</div>
                    <span>Not Official BFP</span>
                    <p className="highlight-description">
                      Not an official government system
                    </p>
                  </div>
                </div>

                <div className="notice-project-info">
                  <div className="project-logo-container">
                    <img
                      src={logo}
                      alt="OPSCORE Project Logo"
                      className="project-logo"
                    />
                    <div className="project-details">
                      <h4>OPSCORE Project</h4>
                      <p>
                        Capstone Development • Web Application Demonstration
                      </p>
                      <p className="project-version">
                        Version 1.5.2 • Educational Use Only
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="notice-modal-footer">
              <div className="notice-footer-content">
                <div className="notice-footer-top">
                  <div className="idle-timer">
                    <Clock3 size={16} />
                    <span>
                      Auto-close in: <strong>{timeRemaining}s</strong>
                    </span>
                    {showIdleWarning && (
                      <div className="idle-warning">
                        ⚡ Stay active to keep this notice open
                      </div>
                    )}
                  </div>

                  <div className="notice-footer-buttons">
                    <button
                      className="notice-tertiary-btn"
                      onClick={() =>
                        setQuestionsModal({ ...questionsModal, show: true })
                      }
                    >
                      <Info size={16} />
                      Questions?
                    </button>
                    <button
                      className="notice-secondary-btn"
                      onClick={() => closeNoticeModal(false)}
                    >
                      Read Later
                    </button>
                    <button
                      className="notice-primary-btn"
                      onClick={() => closeNoticeModal(true)}
                    >
                      <CheckCircle size={18} />I Understand & Acknowledge
                    </button>
                  </div>
                </div>

                <div className="notice-footer-bottom">
                  <div className="notice-footer-note">
                    <Copyright size={12} />
                    <span>
                      All official BFP symbols and trademarks are property of
                      the Bureau of Fire Protection
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
            {/* Questions Modal - Separate from notice modal */}
      {questionsModal.show && (
        <div className="questions-modal-overlay">
          <div className="questions-modal-content">
            <div className="questions-modal-header">
              <div className="questions-modal-icon">
                <Info size={24} />
              </div>
              <h3>{questionsModal.title}</h3>
              <button
                className="questions-modal-close"
                onClick={() => setQuestionsModal({ ...questionsModal, show: false })}
                aria-label="Close questions modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="questions-modal-body">
              <p>{questionsModal.message}</p>
              <p><strong>Important Note:</strong> This system is a demonstration project and is not an official Bureau of Fire Protection system. All generated assets are for educational purposes only.</p>
              <p>For technical inquiries or to learn more about this capstone project, please reach out to the development team through appropriate academic channels.</p>
            </div>

            <div className="questions-modal-footer">
              <button
                className="questions-modal-btn secondary"
                onClick={() => setQuestionsModal({ ...questionsModal, show: false })}
              >
                Close
              </button>
              <button
                className="questions-modal-btn primary"
                onClick={() => {
                  setQuestionsModal({ ...questionsModal, show: false });
                  // You could add contact form or email link here
                  // window.open('mailto:contact@example.com');
                   window.alert("credolinfel329@gmail.com --Capstone Leader");
                }}
              >
                <Info size={16} />
                Contact Support
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
