// components/LeaveMeter.jsx - CORRECTED VERSION
import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient.js";
import { useAuth } from "../../AuthContext.jsx";
import styles from "../styles/LeaveMeter.module.css";

const LeaveMeter = () => {
  const { user } = useAuth();
  const [leaveData, setLeaveData] = useState({
    vacation: { current: 15, initial: 15, used: 0 },
    sick: { current: 15, initial: 15, used: 0 },
    emergency: { current: 5, initial: 5, used: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [currentYear] = useState(new Date().getFullYear());
  const [employeeId, setEmployeeId] = useState(null);

  useEffect(() => {
    if (user?.username) {
      loadLeaveData();

      // Subscribe to real-time changes for this employee
      if (employeeId) {
        const subscription = supabase
          .channel(`leave-balances-${employeeId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "leave_balances",
              filter: `personnel_id=eq.${employeeId}`,
            },
            () => {
              console.log("Balance updated, refreshing...");
              loadLeaveData();
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(subscription);
        };
      }
    }
  }, [user, employeeId]);

  const loadLeaveData = async () => {
    try {
      setLoading(true);
      console.log("🔄 Loading leave data for user:", user.username);

      // 1. Get employee ID
      const { data: employeeData, error: employeeError } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, rank, date_hired")
        .eq("username", user.username)
        .single();

      if (employeeError) {
        console.error("Employee error:", employeeError);
        throw employeeError;
      }

      setEmployeeId(employeeData.id);
      console.log("Employee ID:", employeeData.id);

      // 2. Get current year leave balance
      const { data: balanceRecord, error: balanceError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("personnel_id", employeeData.id)
        .eq("year", currentYear)
        .single();

      console.log("Balance record:", balanceRecord);

      if (balanceError && balanceError.code !== "PGRST116") {
        console.error("Balance error:", balanceError);
        // If no balance record exists, create one with defaults
        if (balanceError.code === "PGRST116") {
          console.log("No balance record found, using defaults");
          setLeaveData({
            vacation: { current: 15, initial: 15, used: 0 },
            sick: { current: 15, initial: 15, used: 0 },
            emergency: { current: 5, initial: 5, used: 0 },
          });
          setLoading(false);
          return;
        }
      }

      if (balanceRecord) {
        // Use actual database balances
        const vacationCurrent = parseFloat(balanceRecord.vacation_balance) || 0;
        const vacationInitial =
          parseFloat(balanceRecord.initial_vacation_credits) || 15;
        const vacationUsed = parseFloat(balanceRecord.vacation_used) || 0;

        const sickCurrent = parseFloat(balanceRecord.sick_balance) || 0;
        const sickInitial =
          parseFloat(balanceRecord.initial_sick_credits) || 15;
        const sickUsed = parseFloat(balanceRecord.sick_used) || 0;

        const emergencyCurrent =
          parseFloat(balanceRecord.emergency_balance) || 0;
        const emergencyInitial =
          parseFloat(balanceRecord.initial_emergency_credits) || 5;
        const emergencyUsed = parseFloat(balanceRecord.emergency_used) || 0;

        console.log("Parsed balances:", {
          vacation: {
            current: vacationCurrent,
            initial: vacationInitial,
            used: vacationUsed,
          },
          sick: { current: sickCurrent, initial: sickInitial, used: sickUsed },
          emergency: {
            current: emergencyCurrent,
            initial: emergencyInitial,
            used: emergencyUsed,
          },
        });

        setLeaveData({
          vacation: {
            current: vacationCurrent,
            initial: vacationInitial,
            used: vacationUsed,
          },
          sick: {
            current: sickCurrent,
            initial: sickInitial,
            used: sickUsed,
          },
          emergency: {
            current: emergencyCurrent,
            initial: emergencyInitial,
            used: emergencyUsed,
          },
        });
      } else {
        // Use defaults if no balance record
        console.log("Using default balances");
        setLeaveData({
          vacation: { current: 15, initial: 15, used: 0 },
          sick: { current: 15, initial: 15, used: 0 },
          emergency: { current: 5, initial: 5, used: 0 },
        });
      }
    } catch (error) {
      console.error("💥 Error loading leave data:", error);
      // Set defaults on error
      setLeaveData({
        vacation: { current: 15, initial: 15, used: 0 },
        sick: { current: 15, initial: 15, used: 0 },
        emergency: { current: 5, initial: 5, used: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (current, max) => {
    if (max <= 0) return 0;
    return Math.min(100, (current / max) * 100);
  };

  const getMeterColor = (percentage) => {
    if (percentage >= 75) return "#10b981"; // Green
    if (percentage >= 50) return "#f59e0b"; // Yellow
    if (percentage >= 25) return "#f97316"; // Orange
    return "#ef4444"; // Red
  };

  const formatNumber = (num) => {
    return parseFloat(num || 0).toFixed(2);
  };

  if (loading) {
    return (
      <div className={styles.meterLoading}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading leave data...</p>
      </div>
    );
  }

  const vacationPercent = calculatePercentage(
    leaveData.vacation.current,
    leaveData.vacation.initial
  );
  const sickPercent = calculatePercentage(
    leaveData.sick.current,
    leaveData.sick.initial
  );
  const emergencyPercent = calculatePercentage(
    leaveData.emergency.current,
    leaveData.emergency.initial
  );

  return (
    <div className={styles.leaveMeterContainer}>
      <div className={styles.meterHeader}>
        <h2>
          <i className="fas fa-calendar-alt"></i> Leave Credits {currentYear}
        </h2>
        <button
          onClick={loadLeaveData}
          className={styles.refreshButton}
          disabled={loading}
        >
          {loading ? "🔄 Loading..." : "🔄 Refresh"}
        </button>
      </div>

      {/* Info Banner */}
      <div className={styles.infoBanner}>
        <span
          style={{ color: "#0369a1", fontSize: "1.2rem", marginRight: "10px" }}
        >
          ℹ️
        </span>
        <div>
          <strong>How it works:</strong> The meter shows your current available
          leave balance. Balances update automatically when monthly accrual runs
          or when leave requests are approved.
        </div>
      </div>

      <div className={styles.meterGrid}>
        {/* Vacation Leave Meter */}
        <div className={styles.meterCard}>
          <div className={styles.meterCardHeader}>
            <div className={styles.meterIcon}>
              <span className={styles.emojiIcon}>🏖️</span>
            </div>
            <h3>🏖️ Vacation Leave</h3>
          </div>

          <div className={styles.meterWrapper}>
            <div className={styles.meterLabels}>
              <span className={styles.meterLabel}>
                <span className={styles.emojiSmall}>🎯</span> Available
              </span>
              <span className={styles.meterValue}>
                {formatNumber(leaveData.vacation.current)} days
              </span>
              <span className={styles.meterLabel}>
                <span className={styles.emojiSmall}>📊</span> Total
              </span>
              <span className={styles.meterValue}>
                {formatNumber(leaveData.vacation.initial)} days
              </span>
            </div>
            <div className={styles.meterContainer}>
              <div className={styles.meterTrack}>
                <div
                  className={styles.meterFill}
                  style={{
                    width: `${vacationPercent}%`,
                    backgroundColor: getMeterColor(vacationPercent),
                  }}
                ></div>
              </div>
              <div className={styles.meterPercentage}>
                {vacationPercent.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className={styles.meterStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <span className={styles.emojiSmall}>📝</span> Used:
              </span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.vacation.used)} days
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <span className={styles.emojiSmall}>📈</span> Remaining:
              </span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.vacation.current)} days
              </span>
            </div>
          </div>
        </div>

        {/* Sick Leave Meter */}
        <div className={styles.meterCard}>
          <div className={styles.meterCardHeader}>
            <div className={styles.meterIcon}>
              <span className={styles.emojiIcon}>🤒</span>
            </div>
            <h3>🤒 Sick Leave</h3>
          </div>

          <div className={styles.meterWrapper}>
            <div className={styles.meterLabels}>
              <span className={styles.meterLabel}>
                <span className={styles.emojiSmall}>🎯</span> Available
              </span>
              <span className={styles.meterValue}>
                {formatNumber(leaveData.sick.current)} days
              </span>
              <span className={styles.meterLabel}>
                <span className={styles.emojiSmall}>📊</span> Total
              </span>
              <span className={styles.meterValue}>
                {formatNumber(leaveData.sick.initial)} days
              </span>
            </div>
            <div className={styles.meterContainer}>
              <div className={styles.meterTrack}>
                <div
                  className={styles.meterFill}
                  style={{
                    width: `${sickPercent}%`,
                    backgroundColor: getMeterColor(sickPercent),
                  }}
                ></div>
              </div>
              <div className={styles.meterPercentage}>
                {sickPercent.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className={styles.meterStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <span className={styles.emojiSmall}>📝</span> Used:
              </span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.sick.used)} days
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <span className={styles.emojiSmall}>📈</span> Remaining:
              </span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.sick.current)} days
              </span>
            </div>
          </div>
        </div>

        {/* Emergency Leave Meter */}
        <div className={styles.meterCard}>
          <div className={styles.meterCardHeader}>
            <div className={styles.meterIcon}>
              <span className={styles.emojiIcon}>🚨</span>
            </div>
            <h3>🚨 Emergency Leave</h3>
          </div>

          <div className={styles.meterWrapper}>
            <div className={styles.meterLabels}>
              <span className={styles.meterLabel}>
                <span className={styles.emojiSmall}>🎯</span> Available
              </span>
              <span className={styles.meterValue}>
                {formatNumber(leaveData.emergency.current)} days
              </span>
              <span className={styles.meterLabel}>
                <span className={styles.emojiSmall}>📊</span> Total
              </span>
              <span className={styles.meterValue}>
                {formatNumber(leaveData.emergency.initial)} days
              </span>
            </div>
            <div className={styles.meterContainer}>
              <div className={styles.meterTrack}>
                <div
                  className={styles.meterFill}
                  style={{
                    width: `${emergencyPercent}%`,
                    backgroundColor: getMeterColor(emergencyPercent),
                  }}
                ></div>
              </div>
              <div className={styles.meterPercentage}>
                {emergencyPercent.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className={styles.meterStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <span className={styles.emojiSmall}>📝</span> Used:
              </span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.emergency.used)} days
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <span className={styles.emojiSmall}>📈</span> Remaining:
              </span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.emergency.current)} days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className={styles.meterFooter}>
        <div className={styles.summaryCard}>
          <div className={styles.emojiLarge}>📊</div>
          <div>
            <h4>Total Available</h4>
            <p className={styles.totalDays}>
              {formatNumber(
                leaveData.vacation.current +
                  leaveData.sick.current +
                  leaveData.emergency.current
              )}{" "}
              days
            </p>
            <small>All leave types combined</small>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.emojiLarge}>📝</div>
          <div>
            <h4>Total Used</h4>
            <p className={styles.usedDays}>
              {formatNumber(
                leaveData.vacation.used +
                  leaveData.sick.used +
                  leaveData.emergency.used
              )}{" "}
              days
            </p>
            <small>Approved leaves this year</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveMeter;
