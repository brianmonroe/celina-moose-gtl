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
    body { font-family: Arial, sans-serif; padding:20px; }
    table { width:100%; border-collapse:collapse; margin-top:20px; }
    td, th { border:1px solid #ccc; padding:6px; text-align:center; }
    th { background:#333; color:white; }
    input, select { width:70px; }
    button { padding:8px 16px; margin-top:15px; cursor:pointer; }

    .dnp { color:#b33; font-weight:bold; }
    .dnp-row { background:#f7f7f7; }

    #summary-admin { margin-top:40px; }
  </style>
</head>
<body>

<h2>GTL Admin Dashboard</h2>

<div id="admin-container">Loading...</div>

<button id="publish-btn">Publish Changes</button>
<button id="recompute-btn" style="background:#0a74d9;color:white;">Recompute Handicaps</button>

<hr style="margin: 30px 0;">

<!-- WEEKLY SUMMARIES -->
<section id="summary-admin">
  <h2>Weekly Summaries</h2>

  <div style="margin-bottom:10px;">
    <label for="summary-week-select"><strong>Week:</strong></label>
    <select id="summary-week-select"></select>
  </div>

  <div style="margin-bottom:10px;">
    <label for="summary-title-input"><strong>Title:</strong></label><br>
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
/* ============================================================
   SCORES / HANDICAPS ADMIN
   ============================================================ */
let players = [];
let courses = [];

// Load players + courses
fetch("../data/players.json?_=" + Date.now())
  .then(r => r.json())
  .then(data => {
    // Ensure handicaps array exists for every player
    data.players.forEach(p => {
      if (!p.handicaps) {
        // fallback: clone any legacy "handicap" value across weeks
        const base = (typeof p.handicap === "number") ? p.handicap : 0;
        p.handicaps = p.scores.map(() => base);
      }
    });

    players = data.players;
    courses = data.courses ?? [];
    renderAdmin();
  });

function renderAdmin() {
  const container = document.getElementById("admin-container");
  const maxWeeks = Math.max(
    players.length ? Math.max(...players.map(p => p.scores.length)) : 0,
    courses.length
  );

  let html = "<table>";

  // ----- Row 1: Course names (one input per week) -----
  html += "<tr><th>Course</th><th></th>";
  for (let w = 0; w < maxWeeks; w++) {
    const c = courses[w] ?? "";
    html += `
      <th colspan="2">
        <input data-type="course" data-w="${w}" value="${c}">
      </th>
    `;
  }
  html += "</tr>";

  // ----- Row 2: Week labels -----
  html += "<tr><th>Player</th><th></th>";
  for (let w = 0; w < maxWeeks; w++) {
    html += `<th colspan="2">W${w + 1}</th>`;
  }
  html += "</tr>";

  // ----- Row 3: HC / TS labels -----
  html += "<tr><th></th><th></th>";
  for (let w = 0; w < maxWeeks; w++) {
    html += "<th>HC</th><th>TS</th>";
  }
  html += "</tr>";

  // ----- Player rows -----
  players.forEach((p, i) => {
    html += `<tr><td>${p.name}</td><td></td>`;

    for (let w = 0; w < maxWeeks; w++) {
      const score = p.scores[w] ?? "";
      const hc    = p.handicaps[w] ?? "";

      const isDNP = (score === "DNP");

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
            <option value="DNP" ${isDNP ? "selected" : ""}>DNP</option>
            ${generateScoreOptions(score)}
          </select>
        </td>
      `;
    }

    html += "</tr>";
  });

  html += "</table>";
  html += `<button id="add-week-btn" style="margin-top:15px;">Add New Week</button>`;

  container.innerHTML = html;

  document.getElementById("add-week-btn").onclick = addWeek;
  attachDnpListeners();
}

function generateScoreOptions(current) {
  let html = "";
  for (let n = 40; n <= 90; n++) {
    html += `<option value="${n}" ${current == n ? "selected" : ""}>${n}</option>`;
  }
  return html;
}

function addWeek() {
  courses.push("");
  players.forEach(p => {
    p.scores.push("");
    p.handicaps.push("");
  });
  renderAdmin();
}

function attachDnpListeners() {
  document.querySelectorAll('select[data-type="ts"]').forEach(sel => {
    sel.addEventListener("change", () => {
      const i = sel.dataset.i;
      const w = sel.dataset.w;
      const hcField = document.querySelector(
        `input[data-type="hc"][data-i="${i}"][data-w="${w}"]`
      );

      if (sel.value === "DNP") {
        hcField.value = "";
        hcField.disabled = true;
      } else {
        hcField.disabled = false;
      }
    });
  });
}

// --------- Publish scores / handicaps / courses ----------
document.getElementById("publish-btn").addEventListener("click", () => {
  // Courses
  document.querySelectorAll('input[data-type="course"]').forEach(el => {
    const w = Number(el.dataset.w);
    courses[w] = el.value;
  });

  // Scores (TS)
  document.querySelectorAll('select[data-type="ts"]').forEach(sel => {
    const i = Number(sel.dataset.i);
    const w = Number(sel.dataset.w);
    const val = sel.value;
    players[i].scores[w] =
      val === "" ? "" : (val === "DNP" ? "DNP" : Number(val));
  });

  // Handicaps (HC)
  document.querySelectorAll('input[data-type="hc"]').forEach(el => {
    const i = Number(el.dataset.i);
    const w = Number(el.dataset.w);
    players[i].handicaps[w] =
      el.value === "" ? "" : Number(el.value);
  });

  fetch("save.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players, courses })
  })
  .then(r => r.text())
  .then(text => alert(text));
});

// --------- Recompute all handicaps (matches frontend logic) ----------
document.getElementById("recompute-btn").addEventListener("click", () => {
  recomputeHandicaps();
  renderAdmin();
  alert("Handicaps recalculated successfully!");
});

function recomputeHandicaps() {
  const PAR = 45;

  players.forEach(p => {
    // Make sure handicaps array exists and has same length as scores
    if (!Array.isArray(p.handicaps)) {
      p.handicaps = p.scores.map(() => "");
    } else if (p.handicaps.length < p.scores.length) {
      while (p.handicaps.length < p.scores.length) {
        p.handicaps.push("");
      }
    }

    for (let w = 0; w < p.scores.length; w++) {
      // Weeks 1 & 2: always blank
      if (w < 2) {
        if (p.handicaps[w] === undefined) {
          p.handicaps[w] = "";
        }
        continue;
      }

      // If this week already has a handicap, DO NOT CHANGE IT
      const existing = p.handicaps[w];
      if (existing !== "" && existing !== null && !isNaN(existing)) {
        continue;
      }

      // Handicap for week (w+1) is based on the previous 3 rounds
      // (weeks w-1, w, w+1 in league terms, but indices w-2..w)
      const window = p.scores
        .slice(w - 2, w + 1)
        .filter(s => s !== "DNP" && s !== "" && !isNaN(s));

      // Need 3 valid raw scores
      if (window.length < 3) {
        p.handicaps[w] = "";
        continue;
      }

      const avg = (window[0] + window[1] + window[2]) / 3;
      const abovePar = avg - PAR;
      const rawHc = abovePar * 0.8;

      // League rule: round to nearest whole number, never below 0
      const finalHC = Math.max(0, Math.round(rawHc));

      p.handicaps[w] = finalHC;
    }
  });

  // Save to file
  fetch("save.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players, courses })
  });
}

/* ============================================================
   WEEKLY SUMMARIES ADMIN
   ============================================================ */

let summaryData = { summaries: [] };

// Load players (for max weeks) + existing summaries
Promise.all([
  fetch("../data/players.json?_=" + Date.now()).then(r => r.json()),
  fetch("../data/summaries.json?_=" + Date.now())
    .then(r => r.ok ? r.json() : { summaries: [] })
])
.then(([playersJson, summariesJson]) => {
  const pList   = playersJson.players || [];
  const courses = playersJson.courses || [];

  const maxWeeks = Math.max(
    pList.length ? Math.max(...pList.map(p => p.scores.length)) : 0,
    courses.length
  );

  summaryData.summaries = summariesJson.summaries || [];
  setupSummaryAdmin(maxWeeks || 1);
});

function setupSummaryAdmin(maxWeeks) {
  const weekSelect   = document.getElementById("summary-week-select");
  const titleInput   = document.getElementById("summary-title-input");
  const contentInput = document.getElementById("summary-content-input");
  const statusSpan   = document.getElementById("summary-status");

  // Populate weeks
  weekSelect.innerHTML = "";
  for (let w = 1; w <= maxWeeks; w++) {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = "Week " + w;
    weekSelect.appendChild(opt);
  }

  function loadSelectedWeek() {
    const week = Number(weekSelect.value);
    const existing = summaryData.summaries.find(s => s.week === week);

    titleInput.value   = existing ? (existing.title   || "") : "";
    contentInput.value = existing ? (existing.content || "") : "";
    statusSpan.textContent = "";
  }

  weekSelect.addEventListener("change", loadSelectedWeek);
  loadSelectedWeek();

  document.getElementById("save-summary-btn").addEventListener("click", () => {
    const week    = Number(weekSelect.value);
    const title   = titleInput.value.trim();
    const content = contentInput.value.trim();

    let entry = summaryData.summaries.find(s => s.week === week);
    if (entry) {
      entry.title   = title;
      entry.content = content;
    } else {
      summaryData.summaries.push({ week, title, content });
    }

    fetch("save_summaries.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summaries: summaryData.summaries })
    })
    .then(r => r.text())
    .then(text => {
      statusSpan.textContent = text;
      setTimeout(() => statusSpan.textContent = "", 3000);
    });
  });
}

// Simple formatting helpers for the content textarea
document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("summary-content-input");
  const buttons  = document.querySelectorAll(".fmt-btn");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tag       = btn.dataset.tag;
      const insert    = btn.dataset.insert;
      const wrapStart = btn.dataset.wrap;
      const wrapEnd   = btn.dataset.wrapEnd;

      const start    = textarea.selectionStart;
      const end      = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);

      let newText = "";

      if (tag) {
        newText = `<${tag}>${selected || "TEXT"}</${tag}>`;
      } else if (insert) {
        newText = insert;
      } else if (wrapStart && wrapEnd) {
        newText = `${wrapStart}${selected || "Text here"}${wrapEnd}`;
      }

      textarea.setRangeText(newText, start, end, "end");
      textarea.dispatchEvent(new Event("input"));
    });
  });
});
</script>

</body>
</html>
