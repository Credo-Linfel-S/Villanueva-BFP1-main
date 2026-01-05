import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import "./Login.css";
import { supabase } from "../lib/supabaseClient";

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
  const [isLocked, setIsLocked] = useState(false);
  const [loginButtonText, setLoginButtonText] = useState("Login");
  const [shake, setShake] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState(null); // Track current attempt status
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const [attempts, setAttempts] = useState(0);
  const [securityData, setSecurityData] = useState(null);
  const [loadingSecurity, setLoadingSecurity] = useState(true);
  const [loading, setLoading] = useState(false);

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

  // Load security data
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

      {/* Left Side with background.png and Mission Statements */}
      <div className="login-left">
        <div className="logo-container">
          <div className="logo-wrapper">
            <h1>Bureau of Fire Protection</h1>
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
                  To save lives and protect property with unwavering commitment
                </p>
              </div>
            </div>

            <div className="mission-card">
              <div className="mission-icon">🚒</div>
              <div className="mission-content">
                <h3>"Always Ready to Respond"</h3>
                <p>Always committed to public safety and emergency response</p>
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
                A modern fire service institution, responsive to the needs of
                our community, working towards a safer Villanueva.
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
                  onChange={(e) => setUsername(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
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
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                        securityLevel >= level ? `level-${securityLevel}` : ""
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
                    <span>Lockouts: {securityData.lockout_count || 0}/3</span>
                  </div>
                </div>
              )}
            </div>

            <button
              className={`login-button ${attemptStatus ? attemptStatus : ""}`}
              onClick={handleLogin}
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
            <div className="footer-links">
              <a href="#forgot">Forgot Password?</a>
              <span>•</span>
              <a href="#help">Need Help?</a>
              <span>•</span>
              <a href="#policy">Security Policy</a>
            </div>
            <div className="system-info">
              <span>System v1.5.2</span>
              <span className="status-dot active"></span>
              <span>Operational</span>
            </div>
          </div>
        </div>
      </div>

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
              <h3>{modal.title}</h3>
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
    </div>
  );
};

export default Login;
