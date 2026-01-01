import React, { useState, useEffect } from "react";
import Hamburger from "../../Hamburger.jsx";
import Sidebar from "../../Sidebar.jsx";

import MainContent from "./MainContext.jsx";
import "../styles/AdminDashboard.css"
import "../../../components/Sidebar.css";
import { useSidebar } from "../../SidebarContext.jsx";
import { Title, Meta } from "react-head";
const AdminDashboard = () => {
  const { isSidebarCollapsed } = useSidebar();

  return (
    <div className="admin-dashboard">
      <Title>Admin Dashboard | BFP Villanueva</Title>

      <Meta name="robots" content="noindex, nofollow" />
      <Hamburger />

      {/* Theme toggle removed from here - now inside Sidebar */}
      <Sidebar />

      <MainContent isCollapsed={isSidebarCollapsed} />
    </div>
  );
};

export default AdminDashboard;
