// hooks/Sidebar.jsx - Updated to show tooltips in both states
import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSidebar } from "./SidebarContext";
import logo from "../assets/background.png";

const Sidebar = () => {
  const { isSidebarCollapsed, expandSidebar, currentTheme, toggleTheme } =
    useSidebar();
  const [activeTab, setActiveTab] = useState("");
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const location = useLocation();
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Use refs instead of querySelector
  const hamburgerRef = useRef(null);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const hamburger = hamburgerRef.current;
    const sidebar = sidebarRef.current;

    if (!hamburger || !sidebar) return;

    const handleHamburgerClick = () => {
      hamburger.classList.toggle("active");
      sidebar.classList.toggle("active");

      // Optional: Prevent body scroll when sidebar is open on mobile
      if (window.innerWidth <= 768) {
        document.body.style.overflow = sidebar.classList.contains("active")
          ? "hidden"
          : "";
      }
    };

    const handleDocumentClick = (event) => {
      if (
        window.innerWidth <= 768 &&
        sidebar.classList.contains("active") &&
        !sidebar.contains(event.target) &&
        !hamburger.contains(event.target)
      ) {
        sidebar.classList.remove("active");
        hamburger.classList.remove("active");
        document.body.style.overflow = "";
      }
    };

    const handleResize = () => {
      if (window.innerWidth > 768 && sidebar) {
        // Reset mobile styles when above mobile breakpoint
        sidebar.classList.remove("active");
        if (hamburger) hamburger.classList.remove("active");
        document.body.style.overflow = "";
      }
    };

    // Add event listeners
    hamburger.addEventListener("click", handleHamburgerClick);
    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      hamburger.removeEventListener("click", handleHamburgerClick);
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("resize", handleResize);
    };
  }, []); // Empty dependency array means this runs once on mount

  const dropdownSections = [
    {
      id: "personnel",
      title: "Personnel Records",
      icon: "👥",
      items: [
        {
          href: "/personnelProfile",
          icon: "📁",
          text: "Personnel Profile (201 Files)",
        },
        { href: "/leaveRecords", icon: "🗄️", text: "Leave Request Records" },
        {
          href: "/clearanceRecords",
          icon: "💾",
          text: "Clearance Request Records",
        },
      ],
    },
    {
      id: "morale",
      title: "Morale & Welfare",
      icon: "❤️",
      items: [
        {
          href: "/medicalRecords",
          icon: "🩺",
          text: "Medical Records of Personnel",
        },
        {
          href: "/awardsCommendations",
          icon: "🏅",
          text: "Awards & Commendations",
        },
      ],
    },
    {
      id: "hr",
      title: "HR Management",
      icon: "🧑‍🤝‍🧑",
      items: [
        { href: "/promotion", icon: "📈", text: "Qualified for Promotion" },
        { href: "/placement", icon: "📍", text: "Personnel Designation" },
        { href: "/trainings", icon: "🎓", text: "Personnel Trainings" },
        {
          href: "/recruitmentPersonnel",
          icon: "👥",
          text: "Recruited Applicants",
        },

        { href: "/history", icon: "⏳", text: "Archived Personnel Accounts" },
      ],
    },
  ];

  useEffect(() => {
    const currentPath = location.pathname;
    setActiveTab(currentPath);
  }, [location.pathname]);

  const handleDropdownHover = (section, e) => {
    // Always show tooltip when hovering dropdown section (both collapsed and expanded)
    const rect = e.currentTarget.getBoundingClientRect();

    if (isSidebarCollapsed) {
      // Position for collapsed sidebar
      setTooltipPosition({
        x: rect.right + 10,
        y: rect.top,
      });
    } else {
      // Position for expanded sidebar - tooltip appears to the right
      setTooltipPosition({
        x: rect.right + 10,
        y: rect.top,
      });
    }

    setTooltipContent(section);

    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
  };

  const handleTooltipEnter = () => {
    // Clear the hide timeout when entering the tooltip
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
  };

  const handleTooltipLeave = () => {
    // Hide tooltip after a short delay
    const timeout = setTimeout(() => {
      setTooltipContent(null);
    }, 150);
    setHoverTimeout(timeout);
  };

  const handleDropdownLeave = (e) => {
    // Only hide if not hovering over the tooltip itself
    if (!e.relatedTarget || !e.relatedTarget.closest(".dropdown-tooltip")) {
      // Add a small delay to allow moving to the tooltip
      const timeout = setTimeout(() => {
        setTooltipContent(null);
      }, 250);
      setHoverTimeout(timeout);
    }
  };

  const handleTooltipItemClick = (href) => {
    setTooltipContent(null);
    if (isSidebarCollapsed) {
      expandSidebar();
    }
  };

  const isTabActive = (href) => activeTab === href;
  const isDropdownItemActive = (href) => activeTab === href;

  const handleTabClick = (e, href) => {
    if (isSidebarCollapsed) {
      expandSidebar();
    }
  };

  return (
    <div
      ref={sidebarRef}
      className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}
    >
      <div className="sidebar-inner">
        <h2>Admin</h2>
        <a
          href="/admin"
          className="no-hover"
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
            cursor: "default",
          }}
          onClick={(e) => handleTabClick(e, "/admin")}
        >
          <img
            src={logo}
            alt="Logo"
            style={{
              height: "40px",
              width: "40px",
              objectFit: "cover",
              borderRadius: "50%",
              marginRight: "10px",
              
            }}
          />
          <span style={{ fontWeight: "800" }}>Villanueva Fire Station</span>
        </a>
        <a
          href="/admin"
          onClick={(e) => handleTabClick(e, "/admin")}
          className={`${isTabActive("/admin") ? "active" : ""}`}
        >
          🖥️ <span>Admin Dashboard</span>
        </a>
        {/* Regular tabs */}
        <a
          href="/leaveManagement"
          onClick={(e) => handleTabClick(e, "/leaveManagement")}
          className={`${isTabActive("/leaveManagement") ? "active" : ""}`}
        >
          🗓️ <span>Leave Management</span>
        </a>
        <a
          href="/inventoryControl"
          onClick={(e) => handleTabClick(e, "/inventoryControl")}
          className={`${isTabActive("/inventoryControl") ? "active" : ""}`}
        >
          📦 <span>Inventory Control</span>
        </a>
        <a
          href="/clearanceSystem"
          onClick={(e) => handleTabClick(e, "/clearanceSystem")}
          className={`${isTabActive("/clearanceSystem") ? "active" : ""}`}
        >
          🪪 <span>Clearance System</span>
        </a>
        <a
          href="/personnelRegister"
          onClick={(e) => handleTabClick(e, "/personnelRegister")}
          className={`${isTabActive("/personnelRegister") ? "active" : ""}`}
        >
          🧑‍💼 <span>Personnel Register</span>
        </a>
        <a
          href="/personnelRecentActivity"
          onClick={(e) => handleTabClick(e, "/personnelRecentActivity")}
        >
          🕓 <span>Personnel Recent Activity</span>
        </a>

        {/* Dropdown sections - simplified */}
        {dropdownSections.map((section) => (
          <div
            key={section.id}
            className={`dropdown-section ${section.id}-records`}
            onMouseEnter={(e) => handleDropdownHover(section, e)}
            onMouseLeave={handleDropdownLeave}
          >
            <div className="dropdown-toggle">
              {section.icon} <span>{section.title}</span>{" "}
              <span className="arrow">▼</span>
            </div>
          </div>
        ))}

        <a href="/logout" onClick={(e) => handleTabClick(e, "/logout")}>
          🚪 <span>Logout</span>
        </a>
      </div>

      {tooltipContent && (
        <div
          className={`dropdown-tooltip ${tooltipContent.id}-records`}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        >
          <div className="tooltip-header">
            <span>
              {tooltipContent.icon} {tooltipContent.title}
            </span>
          </div>
          <div className="tooltip-items">
            {tooltipContent.items.map((item, index) => (
              <a
                key={index}
                href={item.href}
                className={`tooltip-item ${
                  isDropdownItemActive(item.href) ? "active" : ""
                }`}
                onClick={() => handleTooltipItemClick(item.href)}
              >
                {item.icon} {item.text}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
