(function () {
  "use strict";

  // --- Admin password ---
  // Change this to your own password. This is a simple client-side gate
  // suitable for a family site. For stronger security, use Firebase Auth.
  var ADMIN_PASSWORD = "condoadmin";

  // --- EmailJS config (must match app.js) ---
  var EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
  var EMAILJS_GUEST_TEMPLATE = "guest_confirmation";

  // --- Textbelt SMS config (must match app.js) ---
  var TEXTBELT_KEY = "textbelt";

  // --- DOM refs ---
  var loginScreen = document.getElementById("login-screen");
  var dashboard = document.getElementById("admin-dashboard");
  var loginForm = document.getElementById("login-form");
  var loginError = document.getElementById("login-error");
  var pendingList = document.getElementById("pending-list");
  var approvedList = document.getElementById("approved-list");
  var deniedList = document.getElementById("denied-list");

  // --- State ---
  var reservations = [];
  var isLoggedIn = false;

  // --- Helpers ---
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

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Login ---
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var password = document.getElementById("admin-password").value;
    if (password === ADMIN_PASSWORD) {
      isLoggedIn = true;
      loginScreen.hidden = true;
      dashboard.hidden = false;
      subscribeToReservations();
    } else {
      loginError.textContent = "Incorrect password.";
      loginError.hidden = false;
    }
  });

  // Check if already logged in this session
  if (sessionStorage.getItem("admin_logged_in") === "true") {
    isLoggedIn = true;
    loginScreen.hidden = true;
    dashboard.hidden = false;
    subscribeToReservations();
  }

  // --- Firestore ---
  function subscribeToReservations() {
    sessionStorage.setItem("admin_logged_in", "true");
    db.collection("reservations")
      .orderBy("createdAt", "desc")
      .onSnapshot(function (snapshot) {
        reservations = [];
        snapshot.forEach(function (doc) {
          var data = doc.data();
          data.id = doc.id;
          reservations.push(data);
        });
        renderAll();
      }, function (err) {
        console.error("Firestore error:", err);
      });
  }

  function updateStatus(id, newStatus) {
    return db.collection("reservations").doc(id).update({ status: newStatus });
  }

  // --- Notifications ---
  function notifyGuest(reservation, decision) {
    // Send email
    if (typeof emailjs !== "undefined" && EMAILJS_SERVICE_ID !== "YOUR_SERVICE_ID") {
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_GUEST_TEMPLATE, {
        to_name: reservation.name,
        to_email: reservation.email,
        shareholder: reservation.shareholder,
        check_in: formatDisplay(reservation.checkIn),
        check_out: formatDisplay(reservation.checkOut),
        guests: reservation.guests,
        message: decision === "approved"
          ? "Your reservation has been approved! See you at the condo."
          : "Your reservation has been denied. Please contact the family for details.",
      }).then(function () {
        console.log("Notification email sent to " + reservation.email);
      }, function (err) {
        console.error("Email failed:", err);
      });
    }

    // Send SMS
    if (reservation.phone && TEXTBELT_KEY) {
      var msg = decision === "approved"
        ? "Hi " + reservation.name + ", your Family Condo reservation (" +
          formatDisplay(reservation.checkIn) + " - " + formatDisplay(reservation.checkOut) +
          ") has been APPROVED! See you there."
        : "Hi " + reservation.name + ", your Family Condo reservation (" +
          formatDisplay(reservation.checkIn) + " - " + formatDisplay(reservation.checkOut) +
          ") has been denied. Please contact the family for details.";

      var digits = reservation.phone.replace(/\D/g, "");
      fetch("https://textbelt.com/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, message: msg, key: TEXTBELT_KEY }),
      }).then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) console.log("SMS sent to " + digits);
          else console.error("SMS failed:", data.error);
        }, function (err) {
          console.error("SMS request failed:", err);
        });
    }
  }

  // --- Render ---
  function renderAll() {
    var today = new Date().toISOString().slice(0, 10);

    var pending = reservations.filter(function (r) { return r.status === "pending"; });
    var approved = reservations.filter(function (r) {
      return r.status === "approved" && r.checkOut >= today;
    });
    var denied = reservations.filter(function (r) { return r.status === "denied"; });

    renderList(pendingList, pending, "pending");
    renderList(approvedList, approved, "approved");
    renderList(deniedList, denied, "denied");
  }

  function renderList(container, items, type) {
    if (items.length === 0) {
      container.innerHTML = '<p class="empty-state">No ' + type + ' reservations.</p>';
      return;
    }

    container.innerHTML = "";
    items.forEach(function (r) {
      var card = document.createElement("div");
      card.className = "reservation-card admin-card";

      var notesHtml = r.notes ? "<p><em>" + escapeHtml(r.notes) + "</em></p>" : "";

      card.innerHTML =
        '<div class="reservation-info">' +
        "<h3>" + escapeHtml(r.name) + "</h3>" +
        '<p class="dates">' + formatDisplay(r.checkIn) + " &ndash; " + formatDisplay(r.checkOut) + "</p>" +
        "<p>Shareholder: <strong>" + escapeHtml(r.shareholder || "N/A") + "</strong></p>" +
        "<p>" + r.guests + " guest" + (r.guests > 1 ? "s" : "") + "</p>" +
        "<p>Email: " + escapeHtml(r.email || "") + "</p>" +
        "<p>Phone: " + escapeHtml(r.phone || "") + "</p>" +
        notesHtml +
        "</div>";

      var actions = document.createElement("div");
      actions.className = "admin-actions";

      if (type === "pending") {
        var approveBtn = document.createElement("button");
        approveBtn.className = "btn-approve";
        approveBtn.textContent = "Approve";
        approveBtn.addEventListener("click", function () {
          updateStatus(r.id, "approved").then(function () {
            notifyGuest(r, "approved");
          });
        });

        var denyBtn = document.createElement("button");
        denyBtn.className = "btn-deny";
        denyBtn.textContent = "Deny";
        denyBtn.addEventListener("click", function () {
          if (!confirm("Deny this reservation from " + r.name + "?")) return;
          updateStatus(r.id, "denied").then(function () {
            notifyGuest(r, "denied");
          });
        });

        actions.appendChild(approveBtn);
        actions.appendChild(denyBtn);
      } else if (type === "approved") {
        var revokeBtn = document.createElement("button");
        revokeBtn.className = "btn-deny";
        revokeBtn.textContent = "Revoke";
        revokeBtn.addEventListener("click", function () {
          if (!confirm("Revoke approval for " + r.name + "'s reservation?")) return;
          updateStatus(r.id, "denied");
        });
        actions.appendChild(revokeBtn);
      } else if (type === "denied") {
        var reapproveBtn = document.createElement("button");
        reapproveBtn.className = "btn-approve";
        reapproveBtn.textContent = "Re-approve";
        reapproveBtn.addEventListener("click", function () {
          updateStatus(r.id, "approved").then(function () {
            notifyGuest(r, "approved");
          });
        });

        var deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-cancel";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", function () {
          if (!confirm("Permanently delete this reservation?")) return;
          db.collection("reservations").doc(r.id).delete();
        });

        actions.appendChild(reapproveBtn);
        actions.appendChild(deleteBtn);
      }

      card.appendChild(actions);
      container.appendChild(card);
    });
  }
})();
