import React, { useState, useEffect, useRef, useCallback } from "react";
import{NotificationService} from "../components/admin/JSX/services/notificationService"
//import { NotificationService } from "../../admin/JSX/services/notificationService.js";
import styles from "./FloatingNotificationBell.module.css";
import { useAuth } from "./AuthContext";

const FloatingNotificationBell = () => {
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ top: "1010px", right: "30px" });
  const [dropdownPosition, setDropdownPosition] = useState({
    right: "30px",
    top: "10px",
    direction: "below", // 'below', 'above', 'left', 'right'
  });

  const bellRef = useRef(null);
  const dropdownRef = useRef(null);

  // Format time ago
  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calculate smart dropdown position
  const calculateSmartDropdownPosition = useCallback((bellPosition) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownWidth = 350;
    const dropdownHeight = 400; // Approximate max height
    const bellSize = 60;

    // Parse bell position
    const bellTop = parseInt(bellPosition.top) || 100;
    const bellRight = parseInt(bellPosition.right) || 30;
    const bellLeft = viewportWidth - bellRight - bellSize;

    // Default position (below, to the left)
    let newRight = bellRight;
    let newTop = bellTop + bellSize + 10;
    let direction = "below";

    // Check if dropdown would go off screen to the bottom
    if (bellTop + bellSize + dropdownHeight + 10 > viewportHeight) {
      // Not enough space below, try above
      if (bellTop - dropdownHeight - 10 > 0) {
        newTop = bellTop - dropdownHeight - 10;
        direction = "above";
      } else {
        // Not enough space above either, adjust to fit
        newTop = Math.max(10, viewportHeight - dropdownHeight - 10);
        direction = "below";
      }
    }

    // Check if dropdown would go off screen to the right
    if (bellRight - dropdownWidth < 0) {
      // Not enough space to the left, try to the right
      if (bellLeft + bellSize + dropdownWidth + 10 < viewportWidth) {
        newRight = bellRight + bellSize + dropdownWidth + 10;
        direction = "right";
      } else {
        // Not enough space on right either, adjust
        newRight = 10;
        direction = "left";
      }
    }

    // Check if dropdown would go off screen to the left
    if (newRight + dropdownWidth > viewportWidth) {
      newRight = viewportWidth - dropdownWidth - 10;
      direction = "left";
    }

    return {
      right: `${newRight}px`,
      top: `${newTop}px`,
      direction,
    };
  }, []);

  // Update dropdown position when bell moves or window resizes
  useEffect(() => {
    if (showDropdown) {
      const newPosition = calculateSmartDropdownPosition(position);
      setDropdownPosition(newPosition);
    }
  }, [position, showDropdown, calculateSmartDropdownPosition]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (showDropdown) {
        const newPosition = calculateSmartDropdownPosition(position);
        setDropdownPosition(newPosition);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [showDropdown, position, calculateSmartDropdownPosition]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const userNotifications = await NotificationService.getNotifications(
        userId
      );
      setNotifications(userNotifications);
      const count = await NotificationService.getUnreadCount(userId);
      setUnreadCount(count);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Mark as read
  const markAsRead = async (notificationId) => {
    try {
      await NotificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId
            ? { ...notif, read: true, read_at: new Date().toISOString() }
            : notif
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      await NotificationService.markAllAsRead(userId);
      setNotifications((prev) =>
        prev.map((notif) => ({
          ...notif,
          read: true,
          read_at: new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    if (!userId) return;
    try {
      await NotificationService.clearAll(userId);
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  // Mouse event handlers for dragging
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;

    setIsDragging(true);
    const rect = bellRef.current.getBoundingClientRect();
    setMouseOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const bellSize = 60;
      const padding = 20;

      // Calculate new position
      const newX = e.clientX - mouseOffset.x;
      const newY = e.clientY - mouseOffset.y;

      // Constrain within viewport
      const constrainedX = Math.max(
        padding,
        Math.min(viewportWidth - bellSize - padding, newX)
      );
      const constrainedY = Math.max(
        padding,
        Math.min(viewportHeight - bellSize - padding, newY)
      );

      // Convert to pixel values (right positioning)
      const rightPosition = viewportWidth - constrainedX - bellSize;

      const newPosition = {
        top: `${constrainedY}px`,
        right: `${rightPosition}px`,
      };

      setPosition(newPosition);

      // Update dropdown position in real-time while dragging
      if (showDropdown) {
        const newDropdownPos = calculateSmartDropdownPosition(newPosition);
        setDropdownPosition(newDropdownPos);
      }
    },
    [isDragging, mouseOffset, showDropdown, calculateSmartDropdownPosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // Save position to localStorage
    localStorage.setItem("floatingNotifBellPosition", JSON.stringify(position));
  }, [position]);

  // Initialize position from localStorage or default to top-right
  useEffect(() => {
    const savedPosition = localStorage.getItem("floatingNotifBellPosition");
    if (savedPosition) {
      try {
        const parsedPosition = JSON.parse(savedPosition);
        // Validate position
        if (parsedPosition.top && parsedPosition.right) {
          setPosition(parsedPosition);
        }
      } catch (error) {
        console.error("Error parsing saved position:", error);
        // Default to top-right
        setPosition({ top: "100px", right: "30px" });
      }
    } else {
      // Default to top-right
      setPosition({ top: "100px", right: "30px" });
    }
  }, []);

  // Set up event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Toggle dropdown with smart positioning
  const toggleDropdown = () => {
    if (!isDragging) {
      const newShowState = !showDropdown;
      setShowDropdown(newShowState);

      if (newShowState) {
        // Calculate smart position before showing
        const newPosition = calculateSmartDropdownPosition(position);
        setDropdownPosition(newPosition);
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showDropdown &&
        bellRef.current &&
        !bellRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showDropdown]);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Add loading state for user
  if (!user) {
    return null;
  }

  return (
    <>
      <div
        ref={bellRef}
        className={`${styles.floatingContainer} ${
          isDragging ? styles.dragging : ""
        } ${styles[dropdownPosition.direction]}`}
        style={{
          top: position.top,
          right: position.right,
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          className={styles.bellWrapper}
          onClick={toggleDropdown}
          title="Drag to move, click to view notifications"
        >
          <div className={`notification-bell ${styles.floatingBell}`}>
            <span className="notification-icon">🔔</span>
            {unreadCount > 0 && (
              <span className="notification-count">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            {isDragging && <div className={styles.dragHint}>Moving...</div>}
          </div>
        </div>

        {showDropdown && (
          <div
            ref={dropdownRef}
            className={`${styles.dropdown} ${styles.floatingDropdown} ${
              styles[`dropdown-${dropdownPosition.direction}`]
            }`}
            style={{
              right: dropdownPosition.right,
              top: dropdownPosition.top,
            }}
          >
            <div className="notification-header">
              <h3>Notifications</h3>
              <div className="notification-actions">
                <button
                  className="notification-action-btn"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  disabled={unreadCount === 0}
                >
                  ✓
                </button>
                <button
                  className="notification-action-btn"
                  onClick={clearAllNotifications}
                  title="Clear all"
                  disabled={notifications.length === 0}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="notification-list">
              {loading ? (
                <div className="notification-loading">Loading...</div>
              ) : notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${
                      notification.read ? "read" : "unread"
                    }`}
                    onClick={() =>
                      !notification.read && markAsRead(notification.id)
                    }
                  >
                    <div className="notification-content">
                      <span
                        className={`notification-type-icon ${notification.type}`}
                      >
                        {notification.type === "warning"
                          ? "⚠️"
                          : notification.type === "error"
                          ? "❌"
                          : notification.type === "success"
                          ? "✅"
                          : "ℹ️"}
                      </span>
                      <div className="notification-text">
                        <p className="notification-title">
                          {notification.title}
                        </p>
                        <p className="notification-message">
                          {notification.message}
                        </p>
                        <p className="notification-time">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="notification-unread-dot"></div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="notification-empty">No notifications</div>
              )}
            </div>

            <div className="notification-footer">
              <span className="notification-count-text">
                {unreadCount} unread • {notifications.length} total
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default FloatingNotificationBell;