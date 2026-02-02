(function () {
  "use strict";

  // --- State ---
  var reservations = []; // loaded from Firestore
  var currentYear;
  var currentMonth; // 0-indexed
  var selectionStart = null; // Date string YYYY-MM-DD
  var selectionEnd = null;

  // --- EmailJS config ---
  // Replace these with your actual EmailJS service and template IDs.
  // See the setup comment in index.html for instructions.
  var EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
  var EMAILJS_APPROVAL_TEMPLATE = "approval_request";
  var EMAILJS_GUEST_TEMPLATE = "guest_confirmation";
  var ADMIN_EMAIL = "bitnercondo@gmail.com";

  // --- Textbelt SMS config ---
  // For testing: use "textbelt" as the key (1 free text/day).
  // For production: purchase a key at https://textbelt.com
  var TEXTBELT_KEY = "textbelt";
  // Admin phone number to receive SMS approval requests (digits only, e.g. "5551234567")
  var ADMIN_PHONE = "YOUR_ADMIN_PHONE";

  // --- DOM refs ---
  var calendarTitle = document.getElementById("calendar-title");
  var calendarDays = document.getElementById("calendar-days");
  var prevBtn = document.getElementById("prev-month");
  var nextBtn = document.getElementById("next-month");
  var form = document.getElementById("reservation-form");
  var checkInInput = document.getElementById("check-in");
  var checkOutInput = document.getElementById("check-out");
  var formError = document.getElementById("form-error");
  var formSuccess = document.getElementById("form-success");
  var submitBtn = document.getElementById("submit-btn");
  var reservationsList = document.getElementById("reservations-list");

  // --- Helpers ---
  function toDateStr(year, month, day) {
    var m = String(month + 1);
    var d = String(day);
    if (m.length < 2) m = "0" + m;
    if (d.length < 2) d = "0" + d;
    return year + "-" + m + "-" + d;
  }

  function parseDate(str) {
    var parts = str.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatDisplay(str) {
    var d = parseDate(str);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function today() {
    var d = new Date();
    return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function datesOverlap(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Firestore ---
  function subscribeToReservations() {
    db.collection("reservations").onSnapshot(function (snapshot) {
      reservations = [];
      snapshot.forEach(function (doc) {
        var data = doc.data();
        data.id = doc.id;
        reservations.push(data);
      });
      renderCalendar();
      renderReservations();
    }, function (err) {
      console.error("Firestore subscription error:", err);
    });
  }

  function addReservation(reservation) {
    return db.collection("reservations").add(reservation);
  }

  function deleteReservation(id) {
    return db.collection("reservations").doc(id).delete();
  }

  // --- Build reserved-date lookup ---
  function buildReservedMap() {
    var map = {};
    reservations.forEach(function (r) {
      if (r.status === "denied") return;
      var start = parseDate(r.checkIn);
      var end = parseDate(r.checkOut);
      var status = r.status || "approved";
      for (var d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        var key = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
        map[key] = { name: r.name, status: status };
      }
    });
    return map;
  }

  // --- Build selected-range set ---
  function buildSelectedSet() {
    var set = {};
    if (!selectionStart || !selectionEnd) return set;
    var s = selectionStart < selectionEnd ? selectionStart : selectionEnd;
    var e = selectionStart < selectionEnd ? selectionEnd : selectionStart;
    var start = parseDate(s);
    var end = parseDate(e);
    for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      set[toDateStr(d.getFullYear(), d.getMonth(), d.getDate())] = true;
    }
    return set;
  }

  // --- Calendar rendering ---
  function renderCalendar() {
    var monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    calendarTitle.textContent = monthNames[currentMonth] + " " + currentYear;

    var firstDay = new Date(currentYear, currentMonth, 1).getDay();
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var todayStr = today();
    var reservedMap = buildReservedMap();
    var selectedSet = buildSelectedSet();

    calendarDays.innerHTML = "";

    // Leading empties
    for (var i = 0; i < firstDay; i++) {
      var empty = document.createElement("div");
      empty.className = "calendar-day empty";
      calendarDays.appendChild(empty);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = toDateStr(currentYear, currentMonth, day);
      var el = document.createElement("div");
      el.className = "calendar-day";
      el.textContent = day;

      var isPast = dateStr < todayStr;
      var entry = reservedMap[dateStr];
      var isSelected = dateStr === selectionStart || dateStr === selectionEnd;
      var isInRange = selectedSet[dateStr];

      if (isPast) {
        el.classList.add("past");
      } else if (entry) {
        el.classList.add(entry.status === "pending" ? "pending" : "reserved");
        var tooltip = document.createElement("span");
        tooltip.className = "tooltip";
        tooltip.textContent = entry.name + (entry.status === "pending" ? " (pending)" : "");
        el.appendChild(tooltip);
      } else if (isSelected) {
        el.classList.add("selected");
        el.addEventListener("click", (function (ds) {
          return function () { handleDayClick(ds); };
        })(dateStr));
      } else if (isInRange) {
        el.classList.add("in-range");
        el.addEventListener("click", (function (ds) {
          return function () { handleDayClick(ds); };
        })(dateStr));
      } else {
        el.classList.add("available");
        el.addEventListener("click", (function (ds) {
          return function () { handleDayClick(ds); };
        })(dateStr));
      }

      calendarDays.appendChild(el);
    }
  }

  function handleDayClick(dateStr) {
    if (!selectionStart || selectionEnd) {
      selectionStart = dateStr;
      selectionEnd = null;
      checkInInput.value = dateStr;
      checkOutInput.value = "";
    } else {
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
    var todayStr = today();

    var upcoming = reservations
      .filter(function (r) {
        return r.checkOut >= todayStr && r.status !== "denied";
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
      var card = document.createElement("div");
      card.className = "reservation-card";

      var notesHtml = r.notes
        ? "<p>" + escapeHtml(r.notes) + "</p>"
        : "";
      var status = r.status || "approved";
      var statusBadge = status === "pending"
        ? '<span class="badge badge-pending">Pending Approval</span>'
        : '<span class="badge badge-approved">Approved</span>';

      var shareholderHtml = r.shareholder
        ? '<p>Shareholder: <strong>' + escapeHtml(r.shareholder) + '</strong></p>'
        : "";
      var phoneHtml = r.phone
        ? "<p>Phone: " + escapeHtml(r.phone) + "</p>"
        : "";

      card.innerHTML =
        '<div class="reservation-info">' +
        "<h3>" + escapeHtml(r.name) + " " + statusBadge + "</h3>" +
        '<p class="dates">' + formatDisplay(r.checkIn) + " &ndash; " + formatDisplay(r.checkOut) + "</p>" +
        shareholderHtml +
        "<p>" + r.guests + " guest" + (r.guests > 1 ? "s" : "") + "</p>" +
        phoneHtml +
        notesHtml +
        "</div>";

      var cancelBtn = document.createElement("button");
      cancelBtn.className = "btn-cancel";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", function () {
        if (!confirm("Cancel this reservation?")) return;
        deleteReservation(r.id).catch(function (err) {
          console.error("Failed to cancel reservation:", err);
        });
      });
      card.appendChild(cancelBtn);

      reservationsList.appendChild(card);
    });
  }

  // --- Email sending ---
  function sendEmails(reservation) {
    if (typeof emailjs === "undefined") {
      console.warn("EmailJS not loaded — emails will not be sent.");
      return;
    }
    if (EMAILJS_SERVICE_ID === "YOUR_SERVICE_ID") {
      console.warn("EmailJS not configured — update the service/template IDs in app.js");
      return;
    }

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_APPROVAL_TEMPLATE, {
      to_email: ADMIN_EMAIL,
      from_name: reservation.name,
      from_email: reservation.email,
      phone: reservation.phone,
      shareholder: reservation.shareholder,
      check_in: formatDisplay(reservation.checkIn),
      check_out: formatDisplay(reservation.checkOut),
      guests: reservation.guests,
      notes: reservation.notes || "None",
    }).then(function () {
      console.log("Approval request email sent to admin.");
    }, function (err) {
      console.error("Failed to send approval email:", err);
    });

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_GUEST_TEMPLATE, {
      to_name: reservation.name,
      to_email: reservation.email,
      shareholder: reservation.shareholder,
      check_in: formatDisplay(reservation.checkIn),
      check_out: formatDisplay(reservation.checkOut),
      guests: reservation.guests,
    }).then(function () {
      console.log("Confirmation email sent to guest.");
    }, function (err) {
      console.error("Failed to send guest confirmation email:", err);
    });
  }

  // --- SMS sending via Textbelt ---
  function sendSms(phone, message) {
    if (TEXTBELT_KEY === "textbelt") {
      console.warn("Textbelt using free test key (1 SMS/day). Get a production key at https://textbelt.com");
    }
    var digits = phone.replace(/\D/g, "");
    return fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: digits,
        message: message,
        key: TEXTBELT_KEY,
      }),
    }).then(function (res) {
      return res.json();
    }).then(function (data) {
      if (data.success) {
        console.log("SMS sent to " + digits);
      } else {
        console.error("SMS failed:", data.error);
      }
    }, function (err) {
      console.error("SMS request failed:", err);
    });
  }

  function sendTextMessages(reservation) {
    if (ADMIN_PHONE === "YOUR_ADMIN_PHONE") {
      console.warn("SMS not configured — set ADMIN_PHONE in app.js to enable text messages.");
      return;
    }

    var checkIn = formatDisplay(reservation.checkIn);
    var checkOut = formatDisplay(reservation.checkOut);

    var adminMsg = "New condo reservation request from " + reservation.name +
      " (Shareholder: " + reservation.shareholder + "). " +
      checkIn + " - " + checkOut + ", " +
      reservation.guests + " guest(s). Needs your approval.";
    sendSms(ADMIN_PHONE, adminMsg);

    var guestMsg = "Hi " + reservation.name +
      ", your Family Condo reservation (" + checkIn + " - " + checkOut +
      ") has been submitted and is pending approval. " +
      "You'll be notified once it's reviewed.";
    sendSms(reservation.phone, guestMsg);
  }

  function showSuccess(msg) {
    formSuccess.textContent = msg;
    formSuccess.hidden = false;
    setTimeout(function () { formSuccess.hidden = true; }, 6000);
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
  }

  // --- Form submission ---
  function handleSubmit(e) {
    e.preventDefault();
    formError.hidden = true;
    formSuccess.hidden = true;

    var name = document.getElementById("guest-name").value.trim();
    var email = document.getElementById("guest-email").value.trim();
    var phone = document.getElementById("guest-phone").value.trim();
    var shareholder = document.getElementById("shareholder-name").value.trim();
    var checkIn = checkInInput.value;
    var checkOut = checkOutInput.value;
    var guests = parseInt(document.getElementById("num-guests").value, 10);
    var notes = document.getElementById("notes").value.trim();

    if (!name || !email || !phone || !shareholder || !checkIn || !checkOut) {
      showError("Please fill in all required fields (name, email, phone, shareholder, and dates).");
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

    // Check for overlapping reservations (exclude denied)
    var hasConflict = reservations.some(function (r) {
      return r.status !== "denied" && datesOverlap(checkIn, checkOut, r.checkIn, r.checkOut);
    });

    if (hasConflict) {
      showError("These dates overlap with an existing reservation. Please choose different dates.");
      return;
    }

    // Deny if person already has an active reservation (pending or approved)
    var nameLower = name.toLowerCase();
    var existingReservation = reservations.some(function (r) {
      return r.name.toLowerCase() === nameLower &&
        r.status !== "denied" &&
        r.checkOut >= today();
    });

    if (existingReservation) {
      showError("You already have an active reservation. Please cancel your existing one before booking again.");
      return;
    }

    var reservation = {
      name: name,
      email: email,
      phone: phone,
      shareholder: shareholder,
      checkIn: checkIn,
      checkOut: checkOut,
      guests: guests,
      notes: notes,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    addReservation(reservation).then(function () {
      sendEmails(reservation);
      sendTextMessages(reservation);

      form.reset();
      selectionStart = null;
      selectionEnd = null;
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit for Approval";

      showSuccess("Reservation submitted! A confirmation email and text message have been sent. Your booking is pending approval.");
    }).catch(function (err) {
      console.error("Failed to save reservation:", err);
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit for Approval";
      showError("Failed to save reservation. Please check your connection and try again.");
    });
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

    // Subscribe to real-time Firestore updates
    subscribeToReservations();
  }

  init();
})();
