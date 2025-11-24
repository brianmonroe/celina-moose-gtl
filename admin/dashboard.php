<?php
session_start();
if (!isset($_SESSION['gtl_admin'])) {
    header("Location: index.php");
    exit;
}
?>
<!DOCTYPE html>
<html>
<head>
<title>GTL Admin Dashboard</title>
<style>
body { font-family: Arial; padding:20px; }
table { width:100%; border-collapse:collapse; margin-top:20px; }
td, th { border:1px solid #ccc; padding:6px; text-align:center; }
th { background:#333; color:white; }
input, select { width:60px; }
button { padding:10px 20px; margin-top:20px; }

.dnp {
  color: #b33;
  font-weight: bold;
}

.dnp-row {
  background: #f0f0f0;
}
</style>
</head>
<body>

<h2>GTL Admin Dashboard</h2>

<div id="admin-container">Loading...</div>

<button id="publish-btn">Publish Changes</button>

<hr style="margin: 30px 0;">

<!-- WEEKLY SUMMARIES (unchanged) -->
<section id="summary-admin">
  <h2>Weekly Summaries</h2>

  <div style="margin-bottom:10px;">
    <label><strong>Week:</strong></label>
    <select id="summary-week-select"></select>
  </div>

  <div style="margin-bottom:10px;">
    <label><strong>Title:</strong></label><br>
    <input type="text" id="summary-title-input" style="width:100%;">
  </div>

  <div style="margin-bottom:10px;">
    <label><strong>Content (HTML allowed):</strong></label><br>

    <div id="format-toolbar" style="margin-bottom:8px;">
      <button type="button" class="fmt-btn" data-tag="b">Bold</button>
      <button type="button" class="fmt-btn" data-tag="i">Italic</button>
      <button type="button" class="fmt-btn" data-insert="<br>">Line Break</button>
      <button type="button" class="fmt-btn" data-wrap="<p>" data-wrap-end="</p>">Paragraph</button>
      <button type="button" class="fmt-btn" data-insert="<ul><li>Item</li></ul>">Bullet List</button>
    </div>

    <textarea id="summary-content-input" rows="8" style="width:100%;"></textarea>
  </div>

  <button id="save-summary-btn">Save Summary</button>
  <span id="summary-status" style="margin-left:10px;"></span>
</section>

<script>
let players = [];
let courses = [];

// ------------------------------------------------------------
// LOAD PLAYER + COURSE DATA
// ------------------------------------------------------------
fetch("../data/players.json?_=" + Date.now())
  .then(r => r.json())
  .then(data => {

    // Ensure new structure exists
    data.players.forEach(p => {
      if (!p.handicaps) p.handicaps = p.scores.map(() => p.handicap ?? 0);
    });

    players = data.players;
    courses = data.courses ?? [];
    renderAdmin();
  });

// ------------------------------------------------------------
// RENDER ADMIN TABLE
// ------------------------------------------------------------
function renderAdmin() {
  const container = document.getElementById("admin-container");
  let maxWeeks = Math.max(...players.map(p => p.scores.length), courses.length);

  let html = "<table>";

  // --- COURSE ROW ---
  html += "<tr><th>Player</th><th></th>";
  for (let w = 0; w < maxWeeks; w++) {
    html += `<th colspan="2">W${w+1}</th>`;
  }
  html += "</tr>";

  // --- SUB-HEADER (HC / TS) ---
  html += "<tr><th></th><th></th>";
  for (let w = 0; w < maxWeeks; w++) {
    html += `<th>HC</th><th>TS</th>`;
  }
  html += "</tr>";

  // --- PLAYER ROWS ---
  players.forEach((p, i) => {
    html += `<tr><td>${p.name}</td><td></td>`;

    for (let w = 0; w < maxWeeks; w++) {
      const ts = p.scores[w] ?? "";
      const hc = p.handicaps[w] ?? "";

      const isDNP = ts === "DNP";

      html += `
        <td>
          <input type="number"
                 data-type="hc"
                 data-i="${i}"
                 data-w="${w}"
                 value="${isDNP ? "" : hc}"
                 ${isDNP ? "disabled" : ""}>
        </td>

        <td>
          <select data-type="ts" data-i="${i}" data-w="${w}">
            <option value="">—</option>
            <option value="DNP" ${ts === "DNP" ? "selected" : ""}>DNP</option>
            ${generateScoreOptions(ts)}
          </select>
        </td>
      `;
    }

    html += "</tr>";
  });

  html += "</table>";

  // Add week button
  html += `<button id="add-week-btn" style="margin-top:15px;">Add New Week</button>`;

  container.innerHTML = html;

  document.getElementById("add-week-btn").onclick = addWeek;

  attachDnpListeners();
}

// ------------------------------------------------------------
// GENERATE SCORE OPTIONS
// ------------------------------------------------------------
function generateScoreOptions(current) {
  let out = "";
  for (let n = 40; n <= 90; n++) {
    out += `<option value="${n}" ${current == n ? "selected" : ""}>${n}</option>`;
  }
  return out;
}

// ------------------------------------------------------------
// ADD NEW WEEK
// ------------------------------------------------------------
function addWeek() {
  courses.push("");
  players.forEach(p => {
    p.scores.push("");
    p.handicaps.push("");
  });
  renderAdmin();
}

// ------------------------------------------------------------
// AUTO-DISABLE HC WHEN TS = DNP
// ------------------------------------------------------------
function attachDnpListeners() {
  document.querySelectorAll('select[data-type="ts"]').forEach(sel => {
    sel.addEventListener("change", e => {
      const i = sel.dataset.i;
      const w = sel.dataset.w;
      const hcField = document.querySelector(`input[data-type="hc"][data-i="${i}"][data-w="${w}"]`);

      if (sel.value === "DNP") {
        hcField.value = "";
        hcField.disabled = true;
      } else {
        hcField.disabled = false;
      }
    });
  });
}

// ------------------------------------------------------------
// SAVE CHANGES
// ------------------------------------------------------------
document.getElementById("publish-btn").addEventListener("click", () => {

  // Courses
  document.querySelectorAll("input[data-type='course']").forEach(el => {
    courses[Number(el.dataset.w)] = el.value;
  });

  // Handicaps
  document.querySelectorAll("input[data-type='hc']").forEach(el => {
    const i = Number(el.dataset.i);
    const w = Number(el.dataset.w);
    players[i].handicaps[w] = el.value === "" ? "" : Number(el.value);
  });

  // Scores
  document.querySelectorAll("select[data-type='ts']").forEach(sel => {
    const i = Number(sel.dataset.i);
    const w = Number(sel.dataset.w);
    const val = sel.value;

    if (val === "") players[i].scores[w] = "";
    else if (val === "DNP") players[i].scores[w] = "DNP";
    else players[i].scores[w] = Number(val);
  });

  // Send JSON to backend
  fetch("save.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players, courses })
  })
  .then(r => r.text())
  .then(text => alert(text));
});
</script>

<!-- Summaries script unchanged -->
<script>
  /* (your summaries.js code goes here unchanged) */
</script>

</body>
</html>
