// src/utils/personnelFilters.js

/**
 * Check if personnel is retired or resigned
 * @param {Object} personnel - Personnel record
 * @returns {boolean} - True if personnel is retired/resigned, false otherwise
 */
export const isRetiredOrResigned = (personnel) => {
  if (!personnel) return false;

  // Check status field
  if (personnel.status === "Retired" || personnel.status === "Resigned") {
    return true;
  }

  // Check separation_type
  if (
    personnel.separation_type === "Retirement" ||
    personnel.separation_type === "Resignation"
  ) {
    return true;
  }

  // Check if is_active is false with separation reason
  if (
    personnel.is_active === false &&
    (personnel.separation_reason?.includes("Retirement") ||
      personnel.separation_reason?.includes("Resignation"))
  ) {
    return true;
  }

  return false;
};

/**
 * Filter out retired/resigned personnel from an array
 * @param {Array} personnelList - Array of personnel records
 * @returns {Array} - Filtered array without retired/resigned personnel
 */
export const filterOutRetiredResigned = (personnelList) => {
  if (!Array.isArray(personnelList)) return [];

  return personnelList.filter((person) => !isRetiredOrResigned(person));
};

/**
 * Get only active personnel (not retired/resigned)
 * @param {Array} personnelList - Array of personnel records
 * @returns {Array} - Array of active personnel
 */
export const getActivePersonnel = (personnelList) => {
  if (!Array.isArray(personnelList)) return [];

  return personnelList.filter((person) => {
    // Active means not retired/resigned AND is_active is true
    return !isRetiredOrResigned(person) && person.is_active !== false;
  });
};

/**
 * Get only inactive personnel (retired/resigned)
 * @param {Array} personnelList - Array of personnel records
 * @returns {Array} - Array of retired/resigned personnel
 */
export const getInactivePersonnel = (personnelList) => {
  if (!Array.isArray(personnelList)) return [];

  return personnelList.filter(isRetiredOrResigned);
};

/**
 * Check if personnel should be displayed in active lists
 * @param {Object} personnel - Personnel record
 * @returns {boolean} - True if should be displayed in active lists
 */
export const shouldDisplayInActiveLists = (personnel) => {
  return !isRetiredOrResigned(personnel);
};

/**
 * Filter personnel by various criteria
 * @param {Array} personnelList - Array of personnel records
 * @param {Object} filters - Filter criteria
 * @returns {Array} - Filtered array
 */
export const filterPersonnel = (personnelList, filters = {}) => {
  if (!Array.isArray(personnelList)) return [];

  let filtered = [...personnelList];

  // Exclude retired/resigned by default unless specified
  if (filters.includeInactive !== true) {
    filtered = filterOutRetiredResigned(filtered);
  }

  // Search filter
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filtered = filtered.filter((person) => {
      const searchText = `
        ${person.first_name || ""} 
        ${person.middle_name || ""} 
        ${person.last_name || ""}
        ${person.rank || ""}
        ${person.station || ""}
        ${person.badge_number || ""}
        ${person.username || ""}
        ${person.designation || ""}
      `.toLowerCase();

      return searchText.includes(searchTerm);
    });
  }

  // Rank filter
  if (filters.rank) {
    filtered = filtered.filter((person) => person.rank === filters.rank);
  }

  // Station filter
  if (filters.station) {
    filtered = filtered.filter(
      (person) =>
        person.station &&
        person.station.toLowerCase().includes(filters.station.toLowerCase())
    );
  }

  // Status filter (active/inactive)
  if (filters.status === "active") {
    filtered = filtered.filter((person) => person.is_active !== false);
  } else if (filters.status === "inactive") {
    filtered = filtered.filter((person) => person.is_active === false);
  }

  return filtered;
};
