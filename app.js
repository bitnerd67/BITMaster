(function () {
  "use strict";

  // --- State ---
  const STORAGE_KEY = "condo_reservations";
  let currentYear;
  let currentMonth; // 0-indexed
  let selectionStart = null; // Date string YYYY-MM-DD
  let selectionEnd = null;

  // --- EmailJS config ---
  // Replace these with your actual EmailJS service and template IDs.
  // See the setup comment in index.html for instructions.
  var EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
  var EMAILJS_APPROVAL_TEMPLATE = "approval_request";
  var EMAILJS_GUEST_TEMPLATE = "guest_confirmation";
  var ADMIN_EMAIL = "bitnercondo@gmail.com";

  // --- DOM refs ---
  const calendarTitle = document.getElementById("calendar-title");
  const calendarDays = document.getElementById("calendar-days");
  const prevBtn = document.getElementById("prev-month");
  const nextBtn = document.getElementById("next-month");
  const form = document.getElementById("reservation-form");
  const checkInInput = document.getElementById("check-in");
  const checkOutInput = document.getElementById("check-out");
  const formError = document.getElementById("form-error");
  const formSuccess = document.getElementById("form-success");
  const submitBtn = document.getElementById("submit-btn");
  const reservationsList = document.getElementById("reservations-list");

  // --- Helpers ---
  function toDateStr(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDisplay(str) {
    const d = parseDate(str);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function today() {
    const d = new Date();
    return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function datesOverlap(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
  }

  // --- Storage ---
  function loadReservations() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveReservations(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // --- Build reserved-date lookup ---
  // Returns { dateStr: { name: string, status: "pending"|"approved" } }
  function buildReservedMap() {
    const reservations = loadReservations();
    const map = {};
    reservations.forEach(function (r) {
      const start = parseDate(r.checkIn);
      const end = parseDate(r.checkOut);
      var status = r.status || "approved";
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const key = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
        map[key] = { name: r.name, status: status };
      }
    });
    return map;
  }

  // --- Build selected-range set ---
  function buildSelectedSet() {
    const set = {};
    if (!selectionStart || !selectionEnd) return set;
    const start = parseDate(
      selectionStart < selectionEnd ? selectionStart : selectionEnd,
    );
    const end = parseDate(
      selectionStart < selectionEnd ? selectionEnd : selectionStart,
    );
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      set[toDateStr(d.getFullYear(), d.getMonth(), d.getDate())] = true;
    }
    return set;
  }

  // --- Calendar rendering ---
  function renderCalendar() {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    calendarTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayStr = today();
    const reservedMap = buildReservedMap();
    const selectedSet = buildSelectedSet();

    calendarDays.innerHTML = "";

    // Leading empties
    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement("div");
      el.className = "calendar-day empty";
      calendarDays.appendChild(el);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toDateStr(currentYear, currentMonth, day);
      const el = document.createElement("div");
      el.className = "calendar-day";
      el.textContent = day;

      const isPast = dateStr < todayStr;
      const entry = reservedMap[dateStr];
      const isSelected =
        dateStr === selectionStart || dateStr === selectionEnd;
      const isInRange = selectedSet[dateStr];

      if (isPast) {
        el.classList.add("past");
      } else if (entry) {
        el.classList.add(entry.status === "pending" ? "pending" : "reserved");
        const tooltip = document.createElement("span");
        tooltip.className = "tooltip";
        tooltip.textContent = entry.name + (entry.status === "pending" ? " (pending)" : "");
        el.appendChild(tooltip);
      } else if (isSelected) {
        el.classList.add("selected");
        el.addEventListener("click", function () {
          handleDayClick(dateStr);
        });
      } else if (isInRange) {
        el.classList.add("in-range");
        el.addEventListener("click", function () {
          handleDayClick(dateStr);
        });
      } else {
        el.classList.add("available");
        el.addEventListener("click", function () {
          handleDayClick(dateStr);
        });
      }

      calendarDays.appendChild(el);
    }
  }

  function handleDayClick(dateStr) {
    if (!selectionStart || selectionEnd) {
      // Start new selection
      selectionStart = dateStr;
      selectionEnd = null;
      checkInInput.value = dateStr;
      checkOutInput.value = "";
    } else {
      // Complete selection
      selectionEnd = dateStr;
      if (selectionStart > selectionEnd) {
        var tmp = selectionStart;
        selectionStart = selectionEnd;
        selectionEnd = tmp;
      }
      checkInInput.value = selectionStart;
      checkOutInput.value = selectionEnd;
    }
    renderCalendar();
  }

  // --- Reservation list ---
  function renderReservations() {
    const reservations = loadReservations();
    const todayStr = today();

    // Filter to current and future reservations, sorted by check-in
    const upcoming = reservations
      .filter(function (r) {
        return r.checkOut >= todayStr;
      })
      .sort(function (a, b) {
        return a.checkIn < b.checkIn ? -1 : 1;
      });

    if (upcoming.length === 0) {
      reservationsList.innerHTML =
        '<p class="empty-state">No reservations yet. Be the first to book!</p>';
      return;
    }

    reservationsList.innerHTML = "";
    upcoming.forEach(function (r) {
      const card = document.createElement("div");
      card.className = "reservation-card";

      var notesHtml = r.notes
        ? "<p>" + escapeHtml(r.notes) + "</p>"
        : "";
      var status = r.status || "approved";
      var statusBadge = status === "pending"
        ? '<span class="badge badge-pending">Pending Approval</span>'
        : '<span class="badge badge-approved">Approved</span>';

      card.innerHTML =
        '<div class="reservation-info">' +
        "<h3>" + escapeHtml(r.name) + " " + statusBadge + "</h3>" +
        '<p class="dates">' + formatDisplay(r.checkIn) + " &ndash; " + formatDisplay(r.checkOut) + "</p>" +
        "<p>" + r.guests + " guest" + (r.guests > 1 ? "s" : "") + "</p>" +
        notesHtml +
        "</div>";

      var cancelBtn = document.createElement("button");
      cancelBtn.className = "btn-cancel";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", function () {
        cancelReservation(r.id);
      });
      card.appendChild(cancelBtn);

      reservationsList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Email sending ---
  function sendEmails(reservation) {
    // Check if EmailJS is loaded and configured
    if (typeof emailjs === "undefined") {
      console.warn("EmailJS not loaded — emails will not be sent.");
      return;
    }
    if (EMAILJS_SERVICE_ID === "YOUR_SERVICE_ID") {
      console.warn("EmailJS not configured — update the service/template IDs in app.js");
      return;
    }

    // Email 1: Notify admin (bitnercondo@gmail.com) for approval
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_APPROVAL_TEMPLATE, {
      to_email: ADMIN_EMAIL,
      from_name: reservation.name,
      from_email: reservation.email,
      check_in: formatDisplay(reservation.checkIn),
      check_out: formatDisplay(reservation.checkOut),
      guests: reservation.guests,
      notes: reservation.notes || "None",
    }).then(function () {
      console.log("Approval request email sent to admin.");
    }, function (err) {
      console.error("Failed to send approval email:", err);
    });

    // Email 2: Confirm to the guest that their request is pending
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_GUEST_TEMPLATE, {
      to_name: reservation.name,
      to_email: reservation.email,
      check_in: formatDisplay(reservation.checkIn),
      check_out: formatDisplay(reservation.checkOut),
      guests: reservation.guests,
    }).then(function () {
      console.log("Confirmation email sent to guest.");
    }, function (err) {
      console.error("Failed to send guest confirmation email:", err);
    });
  }

  function showSuccess(msg) {
    formSuccess.textContent = msg;
    formSuccess.hidden = false;
    setTimeout(function () { formSuccess.hidden = true; }, 6000);
  }

  // --- Form submission ---
  function handleSubmit(e) {
    e.preventDefault();
    formError.hidden = true;
    formSuccess.hidden = true;

    var name = document.getElementById("guest-name").value.trim();
    var email = document.getElementById("guest-email").value.trim();
    var checkIn = checkInInput.value;
    var checkOut = checkOutInput.value;
    var guests = parseInt(document.getElementById("num-guests").value, 10);
    var notes = document.getElementById("notes").value.trim();

    if (!name || !email || !checkIn || !checkOut) {
      showError("Please fill in your name, email, check-in, and check-out dates.");
      return;
    }

    if (checkIn >= checkOut) {
      showError("Check-out must be after check-in.");
      return;
    }

    if (checkIn < today()) {
      showError("Check-in date cannot be in the past.");
      return;
    }

    // Check for overlapping reservations
    var reservations = loadReservations();
    var hasConflict = reservations.some(function (r) {
      return datesOverlap(checkIn, checkOut, r.checkIn, r.checkOut);
    });

    if (hasConflict) {
      showError(
        "These dates overlap with an existing reservation. Please choose different dates.",
      );
      return;
    }

    var reservation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name,
      email: email,
      checkIn: checkIn,
      checkOut: checkOut,
      guests: guests,
      notes: notes,
      status: "pending",
    };

    // Disable button while sending
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    reservations.push(reservation);
    saveReservations(reservations);

    // Send notification emails
    sendEmails(reservation);

    // Reset form and selection
    form.reset();
    selectionStart = null;
    selectionEnd = null;
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit for Approval";

    showSuccess("Reservation submitted! A confirmation email has been sent. Your booking is pending approval.");
    renderCalendar();
    renderReservations();
  }

  function cancelReservation(id) {
    if (!confirm("Cancel this reservation?")) return;
    var reservations = loadReservations().filter(function (r) {
      return r.id !== id;
    });
    saveReservations(reservations);
    renderCalendar();
    renderReservations();
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
  }

  // --- Sync date inputs with calendar selection ---
  checkInInput.addEventListener("change", function () {
    selectionStart = checkInInput.value || null;
    if (selectionStart && selectionEnd && selectionStart >= selectionEnd) {
      selectionEnd = null;
      checkOutInput.value = "";
    }
    renderCalendar();
  });

  checkOutInput.addEventListener("change", function () {
    selectionEnd = checkOutInput.value || null;
    if (selectionStart && selectionEnd && selectionStart >= selectionEnd) {
      selectionStart = null;
      checkInInput.value = "";
    }
    renderCalendar();
  });

  // --- Init ---
  function init() {
    var now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();

    prevBtn.addEventListener("click", function () {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });

    nextBtn.addEventListener("click", function () {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });

    form.addEventListener("submit", handleSubmit);

    renderCalendar();
    renderReservations();
  }

  init();
})();
