// utils/pdfLeaveFormFiller.js
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Enhanced PDF filling function with payment type text
 * @param {ArrayBuffer} pdfBytes - Original PDF template bytes
 * @param {Object} leaveData - Leave request data
 * @param {Object} options - Additional options
 * @returns {Promise<Uint8Array>} - Filled PDF bytes
 */
export const fillLeaveFormEnhanced = async (
  pdfBytes,
  leaveData,
  options = {}
) => {
  try {
    const {
      isYearly = false,
      generationDate = null,
      adminUsername = "System",
    } = options;

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const defaultFontSize = 10;
    const textColor = rgb(0, 0, 0);

    // ========== HELPER FUNCTIONS - MOVED TO THE TOP ==========

    // Helper function for drawing text
    const drawText = (text, x, y, size = defaultFontSize) => {
      if (text && typeof text === "string" && text.trim() !== "") {
        firstPage.drawText(text.trim(), {
          x,
          y,
          size: size,
          font: font,
          color: textColor,
        });
      }
    };

    // Helper function to draw numbers
    const drawNumber = (number, x, y, size = defaultFontSize) => {
      if (number !== null && number !== undefined) {
        const formatted =
          typeof number === "number"
            ? number.toFixed(2)
            : parseFloat(number || 0).toFixed(2);

        drawText(formatted, x, y, size);
      }
    };

    // Helper function to split long text into multiple lines
    const splitTextIntoLines = (text, maxLength) => {
      if (!text) return [];
      const words = text.split(" ");
      const lines = [];
      let currentLine = "";

      for (const word of words) {
        if ((currentLine + word).length > maxLength) {
          lines.push(currentLine.trim());
          currentLine = word + " ";
        } else {
          currentLine += word + " ";
        }
      }

      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }

      return lines;
    };

    // Helper function to format dates
    const formatDateForPDF = (dateString) => {
      if (!dateString || dateString === "N/A") return "";
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch (error) {
        return dateString;
      }
    };

    // Helper function to calculate text width
    const calculateTextWidth = (text, fontSize) => {
      if (!text) return 0;
      // Approximate width calculation for Helvetica
      const avgCharWidthRatio = 0.6;
      return text.length * avgCharWidthRatio * fontSize;
    };

    // ========== COORDINATE DEFINITIONS ==========

    // Add these coordinates to your existing coordinate definitions
    const officerCoordinates = {
      // Officer signatures/names positions
      oicOfficer: { x: 130, y: 270 },
      adminOfficer: { x: 425, y: 270 },

      municipalFireMarshal: { x: 240, y: 155 },
    };

    // Define coordinates for each leave type checkbox
    const leaveTypeCheckboxCoordinates = {
      "Vacation Leave": { x: 57, y: 702 },
      "Mandatory/Forced Leave": { x: 57, y: 702 },
      "Sick Leave": { x: 57, y: 673 },
      "Maternity Leave": { x: 57, y: 658 },
      "Paternity Leave": { x: 57, y: 643 },
      "Special Privilege Leave": { x: 57, y: 702 },
      "Solo Parent Leave": { x: 57, y: 702 },
      "Study Leave": { x: 57, y: 702 },
      "10-Day VAWC Leave": { x: 57, y: 702 },
      "Rehabilitation Privilege": { x: 57, y: 702 },
      "Special Leave Benefits for Women": { x: 57, y: 702 },
      "Special Emergency (Calamity) Leave": { x: 57, y: 543 },
      "Adoption Leave": { x: 57, y: 702 },
      Others: { x: 57, y: 702 },
    };

    // Coordinates for abroad/Philippines checkboxes
    const vacationLocationCoordinates = {
      philippines: { x: 347, y: 687 },
      abroad: { x: 347, y: 672 },
    };

    // Coordinates for sick leave checkboxes
    const sickLeaveCheckboxCoordinates = {
      in_hospital: { x: 347, y: 644 },
      out_patient: { x: 347, y: 630 },
    };

    // Coordinates for payment type text
    const paymentTypeNumbersCoordinates = {
      with_pay: { x: 57, y: 222 },
      without_pay: { x: 57, y: 207 },
      both_with_pay: { x: 57, y: 222 },
      both_without_pay: { x: 57, y: 207 },
    };

    // Define coordinates for name fields with boundaries
    const nameFields = {
      lastName: {
        x: 270,
        y: 775,
        minX: 250,
        maxX: 370,
        maxWidth: 100,
        text: leaveData.lastName || "",
      },
      firstName: {
        x: 385,
        y: 775,
        minX: 365,
        maxX: 485,
        maxWidth: 100,
        text: leaveData.firstName || "",
      },
      middleName: {
        x: 505,
        y: 775,
        minX: 475,
        maxX: 550,
        maxWidth: 60,
        text: leaveData.middleName || "",
      },
    };

    // Define coordinates for other form fields
    const fieldCoordinates = {
      // Rank and station
      rank: { x: 316, y: 753 },
      station: { x: 90, y: 775 },
      dateOfFiling: { x: 150, y: 753 },
      // Additional Info - Vacation
      locationPhilippines: { x: 460, y: 690 },
      locationAbroad: { x: 460, y: 675 },

      // Additional Info - Sick Leave
      illnessDetailsInHospital: { x: 460, y: 644 },
      illnessDetailsOutPatient: { x: 460, y: 630 },

      // Balance fields
      asOfDate: { x: 152, y: 375 },
      vacationTotalEarned: { x: 155, y: 340 },
      vacationLessApplication: { x: 155, y: 323 },
      vacationBalance: { x: 155, y: 310 },
      sickTotalEarned: { x: 237, y: 340 },
      sickLessApplication: { x: 237, y: 323 },
      sickBalance: { x: 237, y: 310 },
    };

    // ========== ADDITIONAL HELPER FUNCTIONS FOR NAME POSITIONING ==========

    // Helper function to check if all names fit with a given font size
    const checkAllNamesFit = (fontSize) => {
      for (const [fieldName, field] of Object.entries(nameFields)) {
        if (field.text.trim() === "") continue;

        const textWidth = calculateTextWidth(field.text, fontSize);
        const maxAllowedWidth = field.maxX - field.x;

        if (textWidth > maxAllowedWidth) {
          return false;
        }
      }
      return true;
    };

    // Find optimal font size that works for all names
    const findOptimalFontSizeForAllNames = () => {
      let fontSize = defaultFontSize;

      // Try decreasing font size until all names fit
      while (fontSize > 7) {
        if (checkAllNamesFit(fontSize)) {
          return fontSize;
        }
        fontSize -= 0.5;
      }

      // Return minimum font size if no better option
      return 7;
    };

    // Calculate optimal positions for all names with consistent font size
    const calculateOptimalPositions = (commonFontSize) => {
      const positions = {};

      for (const [fieldName, field] of Object.entries(nameFields)) {
        if (field.text.trim() === "") {
          positions[fieldName] = { x: field.x, fontSize: commonFontSize };
          continue;
        }

        const textWidth = calculateTextWidth(field.text, commonFontSize);
        let optimalX = field.x;

        // Adjust position to prevent overflow
        if (field.x + textWidth > field.maxX) {
          // Move left to fit within boundaries
          optimalX = Math.max(field.minX, field.maxX - textWidth);
        }

        positions[fieldName] = { x: optimalX, fontSize: commonFontSize };
      }

      return positions;
    };

    // Check for overlaps between names
    const checkForOverlaps = (positions) => {
      const textRanges = [];

      for (const [fieldName, field] of Object.entries(nameFields)) {
        if (field.text.trim() === "") continue;

        const position = positions[fieldName];
        const textWidth = calculateTextWidth(field.text, position.fontSize);

        textRanges.push({
          fieldName,
          startX: position.x,
          endX: position.x + textWidth,
          y: field.y,
        });
      }

      // Sort by startX for easier overlap detection
      textRanges.sort((a, b) => a.startX - b.startX);

      // Check for overlaps
      for (let i = 1; i < textRanges.length; i++) {
        const prev = textRanges[i - 1];
        const current = textRanges[i];

        if (current.startX < prev.endX) {
          // Overlap detected
          return {
            hasOverlap: true,
            overlappingFields: [prev.fieldName, current.fieldName],
            overlapAmount: prev.endX - current.startX,
          };
        }
      }

      return { hasOverlap: false };
    };

    // Adjust positions to resolve overlaps
    const resolveOverlaps = (positions, overlaps) => {
      const adjustedPositions = { ...positions };

      if (!overlaps.hasOverlap) return adjustedPositions;

      // For simplicity, adjust the later field to the right
      const [firstField, secondField] = overlaps.overlappingFields;
      const secondFieldInfo = nameFields[secondField];
      const overlapAmount = overlaps.overlapAmount;

      // Try to move the second field to the right
      const newX = Math.min(
        secondFieldInfo.maxX,
        adjustedPositions[secondField].x + overlapAmount + 2 // Add 2pt padding
      );

      // Check if we can move it without exceeding maxX
      const textWidth = calculateTextWidth(
        secondFieldInfo.text,
        adjustedPositions[secondField].fontSize
      );

      if (newX + textWidth <= secondFieldInfo.maxX) {
        adjustedPositions[secondField].x = newX;
      } else {
        // If can't move right, try moving first field left
        const firstFieldInfo = nameFields[firstField];
        const newFirstX = Math.max(
          firstFieldInfo.minX,
          adjustedPositions[firstField].x - overlapAmount - 2
        );

        adjustedPositions[firstField].x = newFirstX;
      }

      return adjustedPositions;
    };

    // ========== FILLING THE FORM ==========

    // Step 1: Extract name components from fullName
    const fullName = leaveData.fullName || leaveData.employeeName || "";
    const nameParts = fullName.trim().split(/\s+/);

    // Simple name parsing
    if (nameParts.length >= 2) {
      nameFields.lastName.text = nameParts[nameParts.length - 1] || "";
      nameFields.firstName.text = nameParts[0] || "";
      nameFields.middleName.text = nameParts.slice(1, -1).join(" ") || "";
    } else {
      nameFields.firstName.text = fullName;
    }

    // Step 2: Find optimal font size for all names
    const commonFontSize = findOptimalFontSizeForAllNames();

    // Step 3: Calculate initial positions
    let positions = calculateOptimalPositions(commonFontSize);

    // Step 4: Check and resolve overlaps
    let overlaps = checkForOverlaps(positions);
    let attempts = 0;
    const maxAttempts = 5;

    while (overlaps.hasOverlap && attempts < maxAttempts) {
      positions = resolveOverlaps(positions, overlaps);
      overlaps = checkForOverlaps(positions);
      attempts++;
    }

    // Step 5: Actually draw the names using calculated positions
    for (const [fieldName, field] of Object.entries(nameFields)) {
      if (field.text.trim() === "") continue;

      const position = positions[fieldName];

      // Actually draw the text with calculated position and font size
      drawText(field.text.trim(), position.x, field.y, position.fontSize);
    }

    // Step 6: Fill other fields

    // Rank and station
    drawText(
      leaveData.rank || "",
      fieldCoordinates.rank.x,
      fieldCoordinates.rank.y
    );
    drawText(
      leaveData.station || "",
      fieldCoordinates.station.x,
      fieldCoordinates.station.y
    );

    // Leave type checkbox
    const selectedLeaveType = leaveData.leaveType || "";
    const leaveTypeLower = selectedLeaveType.toLowerCase();

    // Find matching leave type
    const leaveTypeEntries = Object.entries(leaveTypeCheckboxCoordinates);
    const matchedLeaveType = leaveTypeEntries.find(([typeName, _]) => {
      const normalizedInput = selectedLeaveType.toLowerCase().trim();
      const normalizedType = typeName.toLowerCase().trim();
      return (
        normalizedType.includes(normalizedInput) ||
        normalizedInput.includes(normalizedType)
      );
    });

    // Place check mark if we found a match
    if (matchedLeaveType) {
      const [matchedTypeName, coordinates] = matchedLeaveType;
      drawText("X", coordinates.x, coordinates.y, 12);
    } else if (leaveTypeCheckboxCoordinates["Others"]) {
      drawText(
        "X",
        leaveTypeCheckboxCoordinates["Others"].x,
        leaveTypeCheckboxCoordinates["Others"].y,
        12
      );
    }

    // Fill dates
    if (fieldCoordinates.dateOfFiling) {
      // Format the date
      const filingDate = formatDateForPDF(
        leaveData.dateRequested ||
          leaveData.dateOfFiling ||
          leaveData.created_at ||
          leaveData.date_of_filing
      );

      console.log("Date of Filing:", filingDate);
      console.log("Drawing at coordinates:", fieldCoordinates.dateOfFiling);

      if (filingDate) {
        drawText(
          filingDate,
          fieldCoordinates.dateOfFiling.x,
          fieldCoordinates.dateOfFiling.y
        );
      }
    } else {
      console.warn("dateOfFiling coordinates not defined in fieldCoordinates");
    }

    // ========== DRAW OFFICER NAMES ==========
    if (leaveData.officerNames) {
      const officers = leaveData.officerNames;

      console.log("=== OFFICER NAMES DEBUG ===");
      console.log("Officer names data:", officers);
      console.log("Drawing at coordinates:", officerCoordinates);

      // Draw OIC Officer
      {
        /**/
      }
      if (officers.oicOfficer) {
        drawText(
          officers.oicOfficer,
          officerCoordinates.oicOfficer.x,
          officerCoordinates.oicOfficer.y
        );
      }

      // Draw Admin Officer
      if (officers.adminOfficer) {
        drawText(
          officers.adminOfficer,
          officerCoordinates.adminOfficer.x,
          officerCoordinates.adminOfficer.y
        );
      }

      // Draw Municipal Fire Marshal
      if (officers.municipalFireMarshal) {
        drawText(
          officers.municipalFireMarshal,
          officerCoordinates.municipalFireMarshal.x,
          officerCoordinates.municipalFireMarshal.y
        );
      }
    } else {
      console.log("No officer names provided");
    }

    // ========== ADD PAYMENT TYPE TEXT ==========
    const approveFor = leaveData.approve_for || "with_pay";
    const paidDays = leaveData.paid_days || 0;
    const unpaidDays = leaveData.unpaid_days || 0;

    // Debug logging
    console.log("=== PAYMENT TYPE DEBUG ===");
    console.log("approve_for:", approveFor);
    console.log("paid_days:", paidDays);
    console.log("unpaid_days:", unpaidDays);
    console.log("Payment coordinates:", paymentTypeNumbersCoordinates);

    // Draw payment type text
    if (approveFor === "with_pay") {
      // Only with pay - draw the number only
      console.log(
        "Drawing WITH PAY number:",
        paidDays,
        "at coordinates:",
        paymentTypeNumbersCoordinates.with_pay
      );
      if (paidDays > 0) {
        drawText(
          `${paidDays}`,
          paymentTypeNumbersCoordinates.with_pay.x,
          paymentTypeNumbersCoordinates.with_pay.y,
          10
        );
      }
    } else if (approveFor === "without_pay") {
      // Only without pay - draw the number only
      console.log(
        "Drawing WITHOUT PAY number:",
        unpaidDays,
        "at coordinates:",
        paymentTypeNumbersCoordinates.without_pay
      );
      if (unpaidDays > 0) {
        drawText(
          `${unpaidDays}`,
          paymentTypeNumbersCoordinates.without_pay.x,
          paymentTypeNumbersCoordinates.without_pay.y,
          10
        );
      }
    } else if (approveFor === "both") {
      // Mixed: show both numbers only
      console.log(
        "Drawing BOTH numbers - Paid:",
        paidDays,
        "Unpaid:",
        unpaidDays
      );
      if (paidDays > 0) {
        drawText(
          `${paidDays}`,
          paymentTypeNumbersCoordinates.both_with_pay.x,
          paymentTypeNumbersCoordinates.both_with_pay.y,
          10
        );
      }
      if (unpaidDays > 0) {
        drawText(
          `${unpaidDays}`,
          paymentTypeNumbersCoordinates.both_without_pay.x,
          paymentTypeNumbersCoordinates.both_without_pay.y,
          10
        );
      }
    }

    // Vacation location handling
    if (leaveTypeLower.includes("vacation")) {
      console.log("=== VACATION DEBUG ===");
      console.log("Full leaveData:", JSON.stringify(leaveData, null, 2));

      const vacationLocationType =
        leaveData.vacationLocationType?.toLowerCase() ||
        leaveData.vacation_location_type?.toLowerCase() ||
        "philippines";

      // Extract location from the "Philippines: CEBU" format
      let locationText = "";
      if (leaveData.location) {
        // If location contains "Philippines: ", extract just the location part
        if (leaveData.location.includes(": ")) {
          locationText =
            leaveData.location.split(": ")[1] || leaveData.location;
        } else {
          locationText = leaveData.location;
        }
      }

      console.log("Extracted location text:", locationText);

      if (vacationLocationType === "abroad") {
        // Check mark for ABROAD checkbox
        console.log(
          "Drawing ABROAD checkbox at",
          vacationLocationCoordinates.abroad
        );
        drawText(
          "X",
          vacationLocationCoordinates.abroad.x,
          vacationLocationCoordinates.abroad.y,
          12
        );

        // Display location text WITH LINE SPACING
        if (locationText) {
          console.log("Drawing location for abroad:", locationText);
          const locationLines = splitTextIntoLines(locationText, 60);
          console.log("Location lines:", locationLines.length);

          locationLines.forEach((line, index) => {
            const lineY = fieldCoordinates.locationAbroad.y - index * 15;
            console.log(`Line ${index}: "${line}" at Y:${lineY}`);
            drawText(line, fieldCoordinates.locationAbroad.x, lineY, 10);
          });
        }
      } else {
        // Check mark for WITHIN PHILIPPINES checkbox
        console.log(
          "Drawing PHILIPPINES checkbox at",
          vacationLocationCoordinates.philippines
        );
        drawText(
          "X",
          vacationLocationCoordinates.philippines.x,
          vacationLocationCoordinates.philippines.y,
          12
        );

        // Display location text WITH LINE SPACING
        if (locationText) {
          console.log("Drawing location for philippines:", locationText);
          const locationLines = splitTextIntoLines(locationText, 60);
          console.log("Location lines:", locationLines.length);

          locationLines.forEach((line, index) => {
            const lineY = fieldCoordinates.locationPhilippines.y - index * 15;
            console.log(`Line ${index}: "${line}" at Y:${lineY}`);
            drawText(line, fieldCoordinates.locationPhilippines.x, lineY, 10);
          });
        }
      }
    }

    // Sick leave handling
    if (leaveTypeLower.includes("sick")) {
      const illnessType =
        leaveData.illnessType?.toLowerCase() ||
        leaveData.illness_type?.toLowerCase();

      if (illnessType === "in_hospital") {
        // Check mark for IN HOSPITAL
        drawText(
          "X",
          sickLeaveCheckboxCoordinates.in_hospital.x,
          sickLeaveCheckboxCoordinates.in_hospital.y,
          12
        );

        // Display illness details
        if (leaveData.illness_details || leaveData.illnessDetails) {
          const illnessText =
            leaveData.illness_details || leaveData.illnessDetails;
          const illnessLines = splitTextIntoLines(illnessText, 60);
          illnessLines.forEach((line, index) => {
            drawText(
              line,
              fieldCoordinates.illnessDetailsInHospital.x,
              fieldCoordinates.illnessDetailsInHospital.y - index * 15
            );
          });
        }
      } else if (illnessType === "out_patient") {
        // Check mark for OUT PATIENT
        drawText(
          "X",
          sickLeaveCheckboxCoordinates.out_patient.x,
          sickLeaveCheckboxCoordinates.out_patient.y,
          12
        );

        // Display illness details
        if (leaveData.illness_details || leaveData.illnessDetails) {
          const illnessText =
            leaveData.illness_details || leaveData.illnessDetails;
          const illnessLines = splitTextIntoLines(illnessText, 60);
          illnessLines.forEach((line, index) => {
            drawText(
              line,
              fieldCoordinates.illnessDetailsOutPatient.x,
              fieldCoordinates.illnessDetailsOutPatient.y - index * 15
            );
          });
        }
      }
    }

    // ========== FILL LEAVE BALANCE INFORMATION ==========
    const balanceBefore =
      leaveData.balance_before || leaveData.balanceBefore || 0;
    const balanceAfter = leaveData.balance_after || leaveData.balanceAfter || 0;
    const num_days = leaveData.num_days || 0;

    // Calculate total deduction
    const paidDaysForBalance = leaveData.paid_days || 0;
    const unpaidDaysForBalance = leaveData.unpaid_days || 0;
    let totalDeducted = 0;

    if (leaveData.total_deducted) {
      totalDeducted = leaveData.total_deducted;
      console.log("Using total_deducted field:", totalDeducted);
    } else if (leaveData.paid_days || leaveData.unpaid_days) {
      const paidDaysForBalance = leaveData.paid_days || 0;
      const unpaidDaysForBalance = leaveData.unpaid_days || 0;
      totalDeducted = paidDaysForBalance + unpaidDaysForBalance;
      console.log("Calculated from paid+unpaid:", totalDeducted);
    } else {
      totalDeducted = num_days;
      console.log("Using num_days as fallback:", totalDeducted);
    }

    console.log("=== BALANCE CALCULATION DEBUG ===");
    console.log("balanceBefore:", balanceBefore);
    console.log("balanceAfter:", balanceAfter);
    console.log("num_days:", num_days);
    console.log("paid_days:", leaveData.paid_days || 0);
    console.log("unpaid_days:", leaveData.unpaid_days || 0);
    console.log("totalDeducted (final):", totalDeducted);
    console.log("total_deducted field:", leaveData.total_deducted);

    // Add today's date for "As of" field
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    drawText(today, fieldCoordinates.asOfDate.x, fieldCoordinates.asOfDate.y);

    // Determine which column to use based on leave type
    if (leaveTypeLower.includes("vacation")) {
      // Fill Vacation Leave column - USE totalDeducted instead of num_days
      drawNumber(
        balanceBefore,
        fieldCoordinates.vacationTotalEarned.x,
        fieldCoordinates.vacationTotalEarned.y
      );
      drawNumber(
        totalDeducted,
        fieldCoordinates.vacationLessApplication.x,
        fieldCoordinates.vacationLessApplication.y
      );
      drawNumber(
        balanceAfter,
        fieldCoordinates.vacationBalance.x,
        fieldCoordinates.vacationBalance.y
      );

      // Fill Sick Leave column with zero or existing values
      const sickBalance = leaveData.sick_balance_before || 0;
      drawNumber(
        sickBalance,
        fieldCoordinates.sickTotalEarned.x,
        fieldCoordinates.sickTotalEarned.y
      );
      drawNumber(
        0,
        fieldCoordinates.sickLessApplication.x,
        fieldCoordinates.sickLessApplication.y
      );
      drawNumber(
        sickBalance,
        fieldCoordinates.sickBalance.x,
        fieldCoordinates.sickBalance.y
      );

      console.log("=== VACATION LEAVE BALANCE SUMMARY ===");
      console.log("Total Earned (Before):", balanceBefore);
      console.log("Less Application (Deducted):", totalDeducted);
      console.log("Balance (After):", balanceAfter);
    } else if (leaveTypeLower.includes("sick")) {
      // Fill Sick Leave column - USE totalDeducted instead of num_days
      drawNumber(
        balanceBefore,
        fieldCoordinates.sickTotalEarned.x,
        fieldCoordinates.sickTotalEarned.y
      );
      drawNumber(
        totalDeducted,
        fieldCoordinates.sickLessApplication.x,
        fieldCoordinates.sickLessApplication.y
      );
      drawNumber(
        balanceAfter,
        fieldCoordinates.sickBalance.x,
        fieldCoordinates.sickBalance.y
      );

      // Fill Vacation Leave column with zero or existing values
      const vacationBalance = leaveData.vacation_balance_before || 0;
      drawNumber(
        vacationBalance,
        fieldCoordinates.vacationTotalEarned.x,
        fieldCoordinates.vacationTotalEarned.y
      );
      drawNumber(
        0,
        fieldCoordinates.vacationLessApplication.x,
        fieldCoordinates.vacationLessApplication.y
      );
      drawNumber(
        vacationBalance,
        fieldCoordinates.vacationBalance.x,
        fieldCoordinates.vacationBalance.y
      );

      console.log("=== SICK LEAVE BALANCE SUMMARY ===");
      console.log("Total Earned (Before):", balanceBefore);
      console.log("Less Application (Deducted):", totalDeducted);
      console.log("Balance (After):", balanceAfter);
    } else {
      // For other leave types, show balances as is
      drawNumber(
        leaveData.vacation_balance_before || 0,
        fieldCoordinates.vacationTotalEarned.x,
        fieldCoordinates.vacationTotalEarned.y
      );
      drawNumber(
        0,
        fieldCoordinates.vacationLessApplication.x,
        fieldCoordinates.vacationLessApplication.y
      );
      drawNumber(
        leaveData.vacation_balance_before || 0,
        fieldCoordinates.vacationBalance.x,
        fieldCoordinates.vacationBalance.y
      );

      drawNumber(
        leaveData.sick_balance_before || 0,
        fieldCoordinates.sickTotalEarned.x,
        fieldCoordinates.sickTotalEarned.y
      );
      drawNumber(
        0,
        fieldCoordinates.sickLessApplication.x,
        fieldCoordinates.sickLessApplication.y
      );
      drawNumber(
        leaveData.sick_balance_before || 0,
        fieldCoordinates.sickBalance.x,
        fieldCoordinates.sickBalance.y
      );
    }

    // ========== ADD ADDITIONAL DEBUG INFO ==========
    console.log("=== FINAL PDF DEBUG SUMMARY ===");
    console.log("Leave Type:", selectedLeaveType);
    console.log("Approve For:", approveFor);
    console.log("Payment Type Numbers:", {
      with_pay: paymentTypeNumbersCoordinates.with_pay,
      without_pay: paymentTypeNumbersCoordinates.without_pay,
    });
    console.log("Balance Fields:", {
      vacationTotalEarned: fieldCoordinates.vacationTotalEarned,
      vacationLessApplication: fieldCoordinates.vacationLessApplication,
      vacationBalance: fieldCoordinates.vacationBalance,
      sickTotalEarned: fieldCoordinates.sickTotalEarned,
      sickLessApplication: fieldCoordinates.sickLessApplication,
      sickBalance: fieldCoordinates.sickBalance,
    });

    const pdfBytesFilled = await pdfDoc.save();
    console.log("✅ PDF successfully filled with enhanced form filler");
    return pdfBytesFilled;
  } catch (error) {
    console.error("Error in fillLeaveFormEnhanced:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw error;
  }
};

/**
 * Simple fallback function for backward compatibility
 */
export const fillLeaveFormSimple = async (
  pdfBytes,
  leaveData,
  isYearly = false,
  generationDate = null
) => {
  // Use the enhanced function with default options
  return fillLeaveFormEnhanced(pdfBytes, leaveData, {
    isYearly,
    generationDate,
    adminUsername: leaveData.approvedBy || "System",
  });
};
