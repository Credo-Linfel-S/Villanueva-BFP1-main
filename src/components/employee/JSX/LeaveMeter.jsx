// components/LeaveMeter.jsx - PHILIPPINE TIME VERSION
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabaseClient.js";
import { useAuth } from "../../AuthContext.jsx";
import styles from "../styles/LeaveMeter.module.css";

// Helper function to get current time in Philippine Time (UTC+8)
const getPHTime = () => {
  const now = new Date();
  // Convert to Philippine Time (UTC+8)
  const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return phTime;
};

// Helper function to get current year in PH Time
const getPHYear = () => {
  return getPHTime().getUTCFullYear();
};

const LeaveMeter = () => {
  const { user } = useAuth();
  const [leaveData, setLeaveData] = useState({
    vacation: { current: 15, initial: 15, used: 0 },
    sick: { current: 15, initial: 15, used: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(getPHYear());
  const [employeeId, setEmployeeId] = useState(null);
  const [lastResetYear, setLastResetYear] = useState(getPHYear());
  const yearCheckRef = useRef(null);

  // Function to check if we need to create a new year's record
  const checkAndCreateNewYearRecord = async (employeeId) => {
    try {
      // Check if record for current year exists
      const { data: existingRecord, error: checkError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("personnel_id", employeeId)
        .eq("year", currentYear)
        .single();

      // If no record exists for current year, check for previous year
      if (checkError && checkError.code === "PGRST116") {
        // Get previous year's data to carry over any unused leave (if policy allows)
        const { data: prevYearRecord } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("personnel_id", employeeId)
          .eq("year", currentYear - 1)
          .single();

        // Default values
        let vacationBalance = 15;
        let sickBalance = 15;

        // Your business logic for carry-over:
        // Option 1: Reset to defaults (comment out the carry-over section below)
        // Option 2: Carry over unused leave up to a limit (example: max 5 days)
        if (prevYearRecord) {
          // Example: Carry over up to 5 days of unused vacation
          const carryOverVacation = Math.min(
            parseFloat(prevYearRecord.vacation_balance) || 0,
            5
          );
          vacationBalance = 15 + carryOverVacation;

          // Example: Carry over up to 5 days of unused sick leave
          const carryOverSick = Math.min(
            parseFloat(prevYearRecord.sick_balance) || 0,
            5
          );
          sickBalance = 15 + carryOverSick;
        }

        // Create new record for current year
        const { error: createError } = await supabase
          .from("leave_balances")
          .insert({
            personnel_id: employeeId,
            year: currentYear,
            vacation_balance: vacationBalance,
            initial_vacation_credits: vacationBalance,
            vacation_used: 0,
            sick_balance: sickBalance,
            initial_sick_credits: sickBalance,
            sick_used: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (createError) throw createError;

        console.log(
          `Created new leave balance record for year ${currentYear} (PH Time)`
        );
        setLastResetYear(currentYear);
      }

      return true;
    } catch (error) {
      console.error("Error creating new year record:", error);
      return false;
    }
  };

  // Function to check if year has changed in PH Time
  const checkYearChange = () => {
    const newYear = getPHYear();

    if (newYear !== currentYear) {
      console.log(`Year changed from ${currentYear} to ${newYear} (PH Time)`);
      setCurrentYear(newYear);
      if (employeeId) {
        // Trigger reload with new year
        loadLeaveData();
      }
    }
  };

  // Function to get current PH Time as formatted string
  const getPHTimeString = () => {
    const phTime = getPHTime();
    return phTime.toUTCString().replace("GMT", "PH Time");
  };

  useEffect(() => {
    if (user?.username) {
      loadLeaveData();

      // Set up interval to check for year change (check more frequently around midnight)
      yearCheckRef.current = setInterval(checkYearChange, 60000); // Check every minute for year change

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
              loadLeaveData();
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(subscription);
          if (yearCheckRef.current) {
            clearInterval(yearCheckRef.current);
          }
        };
      }
    }

    return () => {
      if (yearCheckRef.current) {
        clearInterval(yearCheckRef.current);
      }
    };
  }, [user, employeeId]);

  const loadLeaveData = async () => {
    try {
      setLoading(true);

      const { data: employeeData, error: employeeError } = await supabase
        .from("personnel")
        .select("id")
        .eq("username", user.username)
        .single();

      if (employeeError) throw employeeError;

      const employeeId = employeeData.id;
      setEmployeeId(employeeId);

      // Check and create new year record if needed
      await checkAndCreateNewYearRecord(employeeId);

      const { data: balanceRecord, error: balanceError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("personnel_id", employeeId)
        .eq("year", currentYear)
        .single();

      if (balanceError && balanceError.code !== "PGRST116") {
        throw balanceError;
      }

      if (balanceRecord) {
        const vacationCurrent = parseFloat(balanceRecord.vacation_balance) || 0;
        const vacationInitial =
          parseFloat(balanceRecord.initial_vacation_credits) || 15;
        const vacationUsed = parseFloat(balanceRecord.vacation_used) || 0;

        const sickCurrent = parseFloat(balanceRecord.sick_balance) || 0;
        const sickInitial =
          parseFloat(balanceRecord.initial_sick_credits) || 15;
        const sickUsed = parseFloat(balanceRecord.sick_used) || 0;

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
        });
      } else {
        // Default values if no record exists
        setLeaveData({
          vacation: { current: 15, initial: 15, used: 0 },
          sick: { current: 15, initial: 15, used: 0 },
        });
      }
    } catch (error) {
      console.error("Error loading leave data:", error);
      setLeaveData({
        vacation: { current: 15, initial: 15, used: 0 },
        sick: { current: 15, initial: 15, used: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (used, initial) => {
    if (initial <= 0) return 0;
    return Math.min(100, (used / initial) * 100);
  };

  const getMeterColor = (percentageUsed) => {
    if (percentageUsed <= 25) return "#10b981";
    if (percentageUsed <= 50) return "#f59e0b";
    if (percentageUsed <= 75) return "#f97316";
    return "#ef4444";
  };

  const formatNumber = (num) => {
    return parseFloat(num || 0).toFixed(2);
  };

  if (loading) {
    return (
      <div className={styles.meterLoading}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading leave data for {currentYear} (PH Time)...</p>
      </div>
    );
  }

  const vacationPercent = calculatePercentage(
    leaveData.vacation.used,
    leaveData.vacation.initial
  );
  const sickPercent = calculatePercentage(
    leaveData.sick.used,
    leaveData.sick.initial
  );

  return (
    <div className={styles.leaveMeterContainer}>
      <div className={styles.meterHeader}>
        <h2>
          <i className="fas fa-calendar-alt"></i> Leave Credits {currentYear}
          {currentYear !== lastResetYear && (
            <span className={styles.newYearBadge}>New Year! 🎉</span>
          )}
        </h2>
        <div className={styles.yearInfo}>
          <small>
            Data for calendar year {currentYear} • Philippine Time (UTC+8)
          </small>
          <br />
          <small className={styles.timeInfo}>
            Current PH Time: {getPHTimeString()}
          </small>
        </div>
      </div>

      <div className={styles.infoBanner}>
        <span style={{ fontSize: "1.2rem", marginRight: "10px" }}>ℹ️</span>
        <div>
          <strong>Meter Reading:</strong> Shows percentage of leave USED. Lower
          percentage = more leave available. Reset annually on January 1st
          (Philippine Time).
        </div>
      </div>

      <div className={styles.meterGrid}>
        {/* Vacation Leave Meter */}
        <div className={styles.meterCard}>
          <div className={styles.meterCardHeader}>
            <div className={styles.meterIcon}>
              <span className={styles.emojiIcon}>🏖️</span>
            </div>
            <h3>Vacation Leave</h3>
          </div>

          <div className={styles.meterWrapper}>
            <div className={styles.meterLabels}>
              <div className={styles.meterLabelGroup}>
                <span className={styles.meterLabel}>Total</span>
                <span className={styles.meterValue}>
                  {formatNumber(leaveData.vacation.initial)} days
                </span>
              </div>
              <div className={styles.meterLabelGroup}>
                <span className={styles.meterLabel}>Used</span>
                <span className={styles.meterValue}>
                  {formatNumber(leaveData.vacation.used)} days
                </span>
              </div>
              <div className={styles.meterLabelGroup}>
                <span className={styles.meterLabel}>Available</span>
                <span className={styles.meterValue}>
                  {formatNumber(leaveData.vacation.current)} days
                </span>
              </div>
            </div>

            <div className={styles.meterContainer}>
              <div className={styles.meterTrack}>
                <div
                  className={styles.meterFill}
                  style={{
                    width: `${vacationPercent}%`,
                    backgroundColor: getMeterColor(vacationPercent),
                  }}
                >
                  <span className={styles.meterFillText}>
                    {vacationPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className={styles.meterEndMarker}>100%</div>
            </div>

            <div className={styles.meterLegend}>
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <div className={styles.meterStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Available:</span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.vacation.current)} days
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Used:</span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.vacation.used)} days
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
            <h3>Sick Leave</h3>
          </div>

          <div className={styles.meterWrapper}>
            <div className={styles.meterLabels}>
              <div className={styles.meterLabelGroup}>
                <span className={styles.meterLabel}>Total</span>
                <span className={styles.meterValue}>
                  {formatNumber(leaveData.sick.initial)} days
                </span>
              </div>
              <div className={styles.meterLabelGroup}>
                <span className={styles.meterLabel}>Used</span>
                <span className={styles.meterValue}>
                  {formatNumber(leaveData.sick.used)} days
                </span>
              </div>
              <div className={styles.meterLabelGroup}>
                <span className={styles.meterLabel}>Available</span>
                <span className={styles.meterValue}>
                  {formatNumber(leaveData.sick.current)} days
                </span>
              </div>
            </div>

            <div className={styles.meterContainer}>
              <div className={styles.meterTrack}>
                <div
                  className={styles.meterFill}
                  style={{
                    width: `${sickPercent}%`,
                    backgroundColor: getMeterColor(sickPercent),
                  }}
                >
                  <span className={styles.meterFillText}>
                    {sickPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className={styles.meterEndMarker}>100%</div>
            </div>

            <div className={styles.meterLegend}>
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <div className={styles.meterStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Available:</span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.sick.current)} days
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Used:</span>
              <span className={styles.statValue}>
                {formatNumber(leaveData.sick.used)} days
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveMeter;
