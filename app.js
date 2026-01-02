/* Habit Tracker PWA (GitHub Pages)
   - Up to 15 habits
   - Daily completion + optional note
   - Coloured success bars (day/week/month)
   - Badges/rewards: perfect day/week/month + per-habit goal hits
   - Monthly editing: prompt at new month + month “review” that archives the month’s active habit set
   - Local-first storage (localStorage)
*/

const LS_KEY = "habit_tracker_v1";

const $ = (id) => document.getElementById(id);

const subtitle = $("subtitle");

const monthPrompt = $("monthPrompt");
const btnReviewMonth = $("btnReviewMonth");

const btnAddHabit = $("btnAddHabit");
const btnSettings = $("btnSettings");
const btnParent = $("btnParent");
const btnSummary = $("btnSummary");
// Summary modal elements
const summaryModal = $("summaryModal");
const summaryClose = $("summaryClose");
const summaryCloseBtn = $("summaryCloseBtn");
const summaryRange = $("summaryRange");
const summaryPrevWeek = $("summaryPrevWeek");
const summaryNextWeek = $("summaryNextWeek");
const summaryKpis = $("summaryKpis");
const summaryGrid = $("summaryGrid");

const summaryPrevMonth = $("summaryPrevMonth");
const summaryNextMonth = $("summaryNextMonth");
const summaryMonthLabel = $("summaryMonthLabel");
const summaryMonthKpis = $("summaryMonthKpis");

let summaryWeekOffset = 0;   // 0=this week, -1=last week, +1=next week
let summaryMonthOffset = 0;  // 0=this month, -1=last month, +1=next month

function requireParentPin() {
  if (!state.settings.parentPin) return true;

  const pin = prompt("Enter Parent PIN:");
  if (pin !== state.settings.parentPin) {
    alert("Incorrect PIN");
    return false;
  }
  return true;
}

const habitList = $("habitList");
const emptyState = $("emptyState");

const todayBar = $("todayBar");
const weekBar = $("weekBar");
const monthBar = $("monthBar");

const todayPct = $("todayPct");
const weekPct = $("weekPct");
const monthPct = $("monthPct");

const todayDetail = $("todayDetail");
const weekDetail = $("weekDetail");
const monthDetail = $("monthDetail");

const todayBadges = $("todayBadges");
const weekBadges = $("weekBadges");
const monthBadges = $("monthBadges");

const rewardsEl = $("rewards");

let state = loadState();
function getTodayNote(habitId) {
  const today = isoToday();
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e.date === today && e.habitId === habitId) return e.note || "";
  }
  return "";
}

function setTodayNote(habitId, note) {
  const today = isoToday();
  state.log = state.log.filter(e => !(e.date === today && e.habitId === habitId));
  const trimmed = (note || "").trim();
  if (trimmed) state.log.push({ date: today, habitId, note: trimmed });
}

// ---------- Init ----------
init();
render();

function init() {
  btnAddHabit.addEventListener("click", () => {
  if (!requireParentPin()) return;
  addHabitFlow();
});
  btnSettings.addEventListener("click", () => {
  if (!requireParentPin()) return;
  settingsFlow();
});

  btnParent.addEventListener("click", parentFlow);
  btnSummary.addEventListener("click", summaryFlow);

 btnReviewMonth.addEventListener("click", () => {
  if (!requireParentPin()) return;
  monthlyReviewFlow(true);
});



  updateSubtitle();
  monthlyReviewFlow(false);
}

// ---------- State ----------
function defaultState() {
  return {
    settings: {
  profileName: "",
  parentPin: "1234" // default PIN, change later
    },
    habits: familyDefaults(), // each: {id, name, goal, active}
    // doneToday: { "YYYY-MM-DD": { habitId: true } }
    done: {},
    // log entries: [{date, habitId, note}]
    log: [],
    // monthHabits: { "YYYY-MM": [habitId,...] }  archived active habit set for that month
    monthHabits: {},
    // rewards: [{ts, type, label}]
    rewards: []
  };
}

function familyDefaults() {
  const mk = (name, goal) => ({ id: crypto.randomUUID(), name, goal, active: true });
  return [
    mk("Make bed", 7),
    mk("Brush teeth (AM & PM)", 7),
    mk("Homework / Study", 5),
    mk("Physical activity", 3),
    mk("Read 20 minutes", 5),
    mk("Tidy room", 4),
    mk("Screen-free time", 5),
    mk("Kind act", 3)
  ];
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // basic merge to avoid missing keys
    const base = defaultState();
    return {
      ...base,
      ...parsed,
     settings: {
  ...base.settings,
  ...(parsed.settings || {}),
  parentPin: (parsed.settings && parsed.settings.parentPin) || base.settings.parentPin
},

      habits: Array.isArray(parsed.habits) && parsed.habits.length ? parsed.habits : base.habits
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ---------- Dates ----------
function isoToday(d = new Date()) {
  const tzOff = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOff).toISOString().slice(0, 10);
}
function monthKey(dateISO) {
  return dateISO.slice(0, 7); // YYYY-MM
}
function weekKey(dateISO) {
  // Monday-start week label like YYYY-Wxx
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7; // Mon=0
  dt.setDate(dt.getDate() - dow);
  const year = dt.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((dt - jan1) / 86400000);
  const w = Math.floor(days / 7) + 1;
  return `${year}-W${String(w).padStart(2, "0")}`;
}
function addDaysISO(dateISO, days) {
  const [y,m,d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + days);
  return isoToday(dt);
}

function weekStartISO(dateISO) {
  const [y,m,d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  const dow = (dt.getDay() + 6) % 7; // Mon=0
  dt.setDate(dt.getDate() - dow);
  return isoToday(dt);
}

function monthStartISO(dateISO) {
  const [y,m] = dateISO.split("-").map(Number);
  return `${y}-${String(m).padStart(2,"0")}-01`;
}

function shiftMonthKey(mk, delta) {
  const [y,m] = mk.split("-").map(Number);
  const dt = new Date(y, m-1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
}

// ---------- Monthly habit set ----------
function activeHabitsForCurrentMonth() {
  const today = isoToday();
  const mk = monthKey(today);
  const archived = state.monthHabits[mk];

  if (Array.isArray(archived) && archived.length) {
    return state.habits.filter(h => archived.includes(h.id));
  }
  // if not archived, use current active flags (and later we can archive)
  return state.habits.filter(h => h.active !== false);
}

function monthlyReviewFlow(forceOpen) {
  const today = isoToday();
  const mk = monthKey(today);

  const hasArchive = Array.isArray(state.monthHabits[mk]) && state.monthHabits[mk].length > 0;
  if (!hasArchive) {
    monthPrompt.classList.remove("hidden");
    if (forceOpen) {
      const ok = confirm(
        `New month detected (${mk}).\n\nDo you want to review which habits are active this month?\n\nTip: You can change habit names/goals without losing history.`
      );
      if (ok) openMonthlyEditor(mk);
      else archiveThisMonth(mk); // still archive current active set so prompt goes away
    }
  } else {
    monthPrompt.classList.add("hidden");
    if (forceOpen) openMonthlyEditor(mk);
  }
}

function archiveThisMonth(mk) {
  const ids = state.habits.filter(h => h.active !== false).map(h => h.id);
  state.monthHabits[mk] = ids;
  saveState();
  monthPrompt.classList.add("hidden");
}

function openMonthlyEditor(mk) {
  // Simple loop allowing user to toggle "active this month", edit, add, or finish.
  while (true) {
    const lines = state.habits.map((h, i) => {
      const on = (h.active !== false) ? "✅" : "⬜";
      return `${i + 1}. ${on} ${h.name} (goal ${h.goal}/wk)`;
    }).join("\n");

    const choice = prompt(
      `Monthly habits for ${mk}\n\n` +
      `Type:\n` +
      `- a number (1-${state.habits.length}) to toggle active\n` +
      `- "e" to edit a habit\n` +
      `- "a" to add a new habit\n` +
      `- "done" to finish\n\n` +
      lines
    );

    if (choice === null) break;
    const c = choice.trim().toLowerCase();

    if (c === "done") break;
    if (c === "a") { addHabitFlow(); continue; }
    if (c === "e") { editHabitPickFlow(); continue; }

    const n = parseInt(c, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= state.habits.length) {
      const h = state.habits[n - 1];
      h.active = !(h.active !== false); // toggle
      saveState();
      continue;
    }
  }

  // After review, archive current month's active set so week/month stats remain consistent
  archiveThisMonth(mk);
  render();
}

// ---------- UI flows ----------
function addHabitFlow() {
  if (state.habits.length >= 15) {
    alert("Max 15 habits. Edit or delete an existing habit first.");
    return;
  }

  const name = prompt("New habit name (e.g., Read 20 minutes):");
  if (!name) return;

  const goalStr = prompt("Weekly goal (0–7):", "5");
  const goal = clampInt(parseInt(goalStr ?? "5", 10), 0, 7);

  state.habits.push({
    id: crypto.randomUUID(),
    name: name.trim(),
    goal,
    active: true
  });

  saveState();
  render();
}

function editHabitPickFlow() {
  if (!requireParentPin()) return;
  if (!state.habits.length) return;

  const list = state.habits.map((h, i) => `${i + 1}. ${h.name} (goal ${h.goal}/wk)`).join("\n");
  const pick = prompt(`Edit which habit? Enter a number:\n\n${list}`);
  if (!pick) return;

  const n = parseInt(pick, 10);
  if (Number.isNaN(n) || n < 1 || n > state.habits.length) return;

  editHabitFlow(state.habits[n - 1]);
}

function editHabitFlow(h) {
  if (!requireParentPin()) return;

  const newName = prompt("Habit name:", h.name);
  if (!newName) return;

  const goalStr = prompt("Weekly goal (0–7):", String(h.goal));
  const newGoal = clampInt(parseInt(goalStr ?? String(h.goal), 10), 0, 7);

  const activeThisMonth = confirm("Active this month?\n\nOK = Active, Cancel = Inactive");
  h.name = newName.trim();
  h.goal = newGoal;
  h.active = activeThisMonth;

  const del = confirm("Delete this habit?\n\nOK = Delete\nCancel = Keep");
  if (del) {
    state.habits = state.habits.filter(x => x.id !== h.id);
  }

  saveState();
  render();
}

function settingsFlow() {
  const name = prompt("Profile name (optional):", state.settings.profileName || "");
  if (name !== null) state.settings.profileName = name.trim();

  
const changePin = confirm("Change Parent PIN?\n\nOK = Yes, Cancel = No");
if (changePin) {
  const newPin = prompt("Enter new 4-digit PIN:");
  if (newPin && /^\d{4}$/.test(newPin)) {
    state.settings.parentPin = newPin;
  } else {
    alert("PIN must be exactly 4 digits.");
  }
}

  saveState();
  updateSubtitle();
  render();
}


function parentFlow() {
    const pin = prompt("Enter Parent PIN:");
  if (pin !== state.settings.parentPin) {
    alert("Incorrect PIN");
    return;
  }
  alert(buildParentDashboard());
}

function summaryFlow() {
  if (!requireParentPin()) return;

  summaryWeekOffset = 0;
  summaryMonthOffset = 0;
  summaryModal.classList.remove("hidden");

  renderSummaryModal();

  // close handlers
  summaryClose.onclick = () => summaryModal.classList.add("hidden");
  summaryCloseBtn.onclick = () => summaryModal.classList.add("hidden");

  // week nav
  summaryPrevWeek.onclick = () => { summaryWeekOffset -= 1; renderSummaryModal(); };
  summaryNextWeek.onclick = () => { summaryWeekOffset += 1; renderSummaryModal(); };

  // month nav
  summaryPrevMonth.onclick = () => { summaryMonthOffset -= 1; renderSummaryModal(); };
  summaryNextMonth.onclick = () => { summaryMonthOffset += 1; renderSummaryModal(); };
}

function renderSummaryModal() {
  const today = isoToday();
  const habits = activeHabitsForCurrentMonth();

  // --- WEEK ---
  const weekStart = addDaysISO(weekStartISO(today), summaryWeekOffset * 7);
  const weekEnd = addDaysISO(weekStart, 6);
  const wk = weekKey(weekStart);

  summaryRange.textContent = `${weekStart} → ${weekEnd}`;

  const week = weekProgress(wk, habits);
  const weekPctVal = week.totalGoals ? Math.round((week.done / week.totalGoals) * 100) : 0;

  summaryKpis.innerHTML = `
    <div class="kpi"><div class="kpi-num">${weekPctVal}%</div><div class="kpi-sub">Weekly goal progress</div></div>
    <div class="kpi"><div class="kpi-num">${week.done}/${week.totalGoals}</div><div class="kpi-sub">Goal points</div></div>
  `;

  // simple weekly list (clean + fast)
  summaryGrid.innerHTML = habits.map(h => {
    const c = week.counts[h.id] || 0;
    const g = h.goal || 0;
    const hit = (g > 0 && c >= g) ? " 🎯" : "";
    return `<div class="row" style="justify-content:space-between;">
      <div>${h.name}</div>
      <div class="muted">${c}/${g}${hit}</div>
    </div>`;
  }).join("");

  // --- MONTH ---
  const baseMk = monthKey(today);
  const mk = shiftMonthKey(baseMk, summaryMonthOffset);
  summaryMonthLabel.textContent = mk;

  const month = monthProgress(mk, habits);
  const monthPctVal = month.totalGoals ? Math.round((month.done / month.totalGoals) * 100) : 0;

  summaryMonthKpis.innerHTML = `
    <div class="kpi"><div class="kpi-num">${monthPctVal}%</div><div class="kpi-sub">Month to date</div></div>
    <div class="kpi"><div class="kpi-num">${month.done}/${month.totalGoals}</div><div class="kpi-sub">Goal points</div></div>
    <div class="kpi"><div class="kpi-num">${month.weeksSoFar}</div><div class="kpi-sub">Weeks counted</div></div>
  `;
}


function updateSubtitle() {
  const t = state.settings.profileName ? `Profile: ${state.settings.profileName}` : "Local-first • Works offline";
  subtitle.textContent = t;
}

// ---------- Completion + note ----------
function markHabitDoneToday(habitId) {
  const today = isoToday();
  const doneForDay = state.done[today] || {};
  const isDone = !!doneForDay[habitId];

  // ✅ UNDO if already done
  if (isDone) {
    // remove completion flag
    delete doneForDay[habitId];
    state.done[today] = doneForDay;

    // remove today's log entry for this habit (if any)
    state.log = state.log.filter(e => !(e.date === today && e.habitId === habitId));

    saveState();
    render();
    return;
  }

  // ✅ MARK DONE (same as before)
  const habit = state.habits.find(h => h.id === habitId);
  const note = prompt(
    `Optional note for: ${habit?.name || "habit"}\n\n(Leave blank for none)`,
    ""
  ) ?? "";

  doneForDay[habitId] = true;
  state.done[today] = doneForDay;
  state.log.push({ date: today, habitId, note: note.trim() });

  saveState();
  render();
}


// ---------- Progress + colours ----------
function dayProgress(dateISO, habits) {
  const doneForDay = state.done[dateISO] || {};
  const total = habits.length;
  const done = habits.filter(h => !!doneForDay[h.id]).length;
  const rate = total === 0 ? 0 : done / total;
  return { total, done, rate };
}

function weekProgress(wkKey, habits) {
  const counts = {};
  for (const entry of state.log) {
    if (weekKey(entry.date) !== wkKey) continue;
    counts[entry.habitId] = (counts[entry.habitId] || 0) + 1;
  }
  const totalGoals = habits.reduce((a, h) => a + (h.goal || 0), 0);
  const done = habits.reduce((a, h) => a + Math.min(counts[h.id] || 0, h.goal || 0), 0);
  const rate = totalGoals === 0 ? 0 : done / totalGoals;
  return { counts, totalGoals, done, rate };
}

function monthProgress(mk, habits) {
  const counts = {};
  for (const entry of state.log) {
    if (monthKey(entry.date) !== mk) continue;
    counts[entry.habitId] = (counts[entry.habitId] || 0) + 1;
  }
  // simple monthly target = weekly goal * number of distinct weeks in month so far (min 1)
  const weeksSoFar = Math.max(1, countDistinctWeeksInMonth(mk));
  const totalGoals = habits.reduce((a, h) => a + (h.goal || 0) * weeksSoFar, 0);
  const done = habits.reduce((a, h) => a + Math.min(counts[h.id] || 0, (h.goal || 0) * weeksSoFar), 0);
  const rate = totalGoals === 0 ? 0 : done / totalGoals;
  return { counts, totalGoals, done, rate, weeksSoFar };
}

function countDistinctWeeksInMonth(mk) {
  const set = new Set();
  const today = isoToday();
  // include current week if we're in the month
  if (monthKey(today) === mk) set.add(weekKey(today));
  for (const entry of state.log) {
    if (monthKey(entry.date) !== mk) continue;
    set.add(weekKey(entry.date));
  }
  return set.size;
}

function colourForRate(rate) {
  // <50% = red, 50-79% = orange, >=80% = green
  if (rate >= 0.8) return cssVar("--good");
  if (rate >= 0.5) return cssVar("--mid");
  return cssVar("--bad");
}
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function colourForHabit(rate) {
  if (rate >= 0.8) return cssVar("--good"); // green
  if (rate >= 0.5) return cssVar("--mid");  // yellow
  return cssVar("--bad");                   // red
}


// ---------- Rewards / Badges ----------
function addRewardOnce(type, label) {
  const key = `${type}|${label}`;
  if (state.rewards.some(r => `${r.type}|${r.label}` === key)) return;
  state.rewards.unshift({ ts: Date.now(), type, label });
}

function computeRewards(habits, day, week, month, today, wk, mk) {
  // Perfect day (all habits completed)
  if (habits.length > 0 && day.done === day.total) {
    addRewardOnce("perfect_day", `Perfect Day • ${today}`);
  }

  // Perfect week (each habit goal met)
  const perfectWeek = habits.every(h => (h.goal || 0) === 0 || (week.counts[h.id] || 0) >= (h.goal || 0));
  if (habits.length > 0 && perfectWeek) {
    addRewardOnce("perfect_week", `Perfect Week • ${wk}`);
  }

  // Perfect month (scaled goal met)
  const perfectMonth = habits.every(h => {
    const g = (h.goal || 0) * month.weeksSoFar;
    return g === 0 || (month.counts[h.id] || 0) >= g;
  });
  if (habits.length > 0 && perfectMonth) {
    addRewardOnce("perfect_month", `Perfect Month • ${mk}`);
  }

  // Per-habit goal hit exactly (week)
  for (const h of habits) {
    if ((h.goal || 0) > 0 && (week.counts[h.id] || 0) === (h.goal || 0)) {
      addRewardOnce("habit_goal", `Goal Hit • ${h.name} • ${wk}`);
    }
  }
}

// ---------- Render ----------
function render() {
   console.log("latest log:", state.log[state.log.length - 1]);
  const today = isoToday();
  const wk = weekKey(today);
  const mk = monthKey(today);

  const habits = activeHabitsForCurrentMonth();

  const day = dayProgress(today, habits);
  const week = weekProgress(wk, habits);
  const month = monthProgress(mk, habits);

  computeRewards(habits, day, week, month, today, wk, mk);
  saveState();

  // meters
  setMeter(todayBar, day.rate);
  setMeter(weekBar, week.rate);
  setMeter(monthBar, month.rate);

  todayPct.textContent = `${pct(day.rate)}%`;
  weekPct.textContent = `${pct(week.rate)}%`;
  monthPct.textContent = `${pct(month.rate)}%`;

  todayDetail.textContent = `${day.done}/${day.total} habits`;
  weekDetail.textContent = `${week.done}/${week.totalGoals} goal points`;
  monthDetail.textContent = `${month.done}/${month.totalGoals} goal points`;

  // badges on cards
  todayBadges.innerHTML = "";
  weekBadges.innerHTML = "";
  monthBadges.innerHTML = "";

  if (habits.length > 0 && day.done === day.total) todayBadges.appendChild(makeBadge("Perfect day"));
  if (habits.length > 0 && habits.every(h => (h.goal||0)===0 || (week.counts[h.id]||0) >= (h.goal||0))) weekBadges.appendChild(makeBadge("Perfect week"));
  if (habits.length > 0 && habits.every(h => {
    const g = (h.goal||0) * month.weeksSoFar;
    return g===0 || (month.counts[h.id]||0) >= g;
  })) monthBadges.appendChild(makeBadge("Perfect month"));

  // habit list
  habitList.innerHTML = "";
  emptyState.classList.toggle("hidden", habits.length !== 0);

  const doneForDay = state.done[today] || {};

  for (const h of habits) {
    const item = document.createElement("div");
    item.className = "item";

    const left = document.createElement("div");
    left.className = "item-left";

    const title = document.createElement("div");
    title.className = "item-title";
    
     const dot = document.createElement("span");
      dot.className = "dot";

      const rate = habitOnTrackRateToday(h, week.counts, today);
      dot.style.background = colourForHabit(rate);

      title.appendChild(dot);
      title.appendChild(document.createTextNode(" " + h.name));


    const meta = document.createElement("div");
    meta.className = "meta";
     const streak = habitStreak(h.id);
if (streak > 0) {
  meta.appendChild(makePill(`🔥 ${streak}-day streak`));
}

    meta.appendChild(makePill(`Goal: ${h.goal}/wk`));

    const wCount = week.counts[h.id] || 0;
    const hit = (h.goal || 0) > 0 && wCount >= (h.goal || 0);
    meta.appendChild(makePill(`Week: ${wCount}/${h.goal}${hit ? " 🎯" : ""}`));

left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "row";
    right.style.justifyContent = "flex-end";

    const done = !!doneForDay[h.id];

    const markBtn = document.createElement("button");
    markBtn.className = "btn";
    markBtn.textContent = done ? "Done ✓" : "Mark";
   markBtn.disabled = false;

    if (done) {
      markBtn.style.borderColor = "rgba(0,208,132,.45)";
      markBtn.style.background = "rgba(0,208,132,.10)";
    }
    markBtn.addEventListener("click", () => markHabitDoneToday(h.id));

    const editBtn = document.createElement("button");
    editBtn.className = "btn ghost";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => {
  if (!requireParentPin()) return;
  editHabitFlow(h);
});


    right.appendChild(markBtn);
    right.appendChild(editBtn);
const noteVal = getTodayNote(h.id);

const noteBox = document.createElement("div");
noteBox.className = "noteBox";
noteBox.textContent = noteVal ? `📝 ${noteVal}` : "📝 Add note…";

noteBox.addEventListener("click", () => {
  const updated = prompt(`Note for: ${h.name}`, noteVal);
  if (updated === null) return;
  setTodayNote(h.id, updated);
  saveState();
  render();
});

left.appendChild(noteBox);

    item.appendChild(left);
    item.appendChild(right);
    habitList.appendChild(item);
  }

  // rewards list
  rewardsEl.innerHTML = "";
  if (!state.rewards.length) {
    const r = document.createElement("div");
    r.className = "reward";
    r.textContent = "No rewards yet — complete all habits today to earn a Perfect Day badge.";
    rewardsEl.appendChild(r);
  } else {
    for (const rwd of state.rewards.slice(0, 25)) {
      const r = document.createElement("div");
      r.className = "reward";
      r.textContent = formatReward(rwd);
      rewardsEl.appendChild(r);
    }
  }
}

function setMeter(el, rate) {
  el.style.width = `${Math.round(rate * 100)}%`;
  el.style.background = colourForRate(rate);
}

function makeBadge(text) {
  const b = document.createElement("div");
  b.className = "badge";
  const d = document.createElement("span");
  d.className = "dot";
  d.style.background = cssVar("--good");
  const t = document.createElement("span");
  t.textContent = text;
  b.appendChild(d);
  b.appendChild(t);
  return b;
}

function makePill(text) {
  const p = document.createElement("span");
  p.className = "pill";
  p.textContent = text;
  return p;
}

function formatReward(r) {
  const dt = new Date(r.ts);
  const stamp = dt.toLocaleDateString();
  const icon = ({
    perfect_day: "🏅",
    perfect_week: "🏆",
    perfect_month: "👑",
    habit_goal: "🎯"
  })[r.type] || "⭐";
  return `${icon} ${r.label} • ${stamp}`;
}

function buildParentDashboard() {
  const today = isoToday();
  const wk = weekKey(today);
  const mk = monthKey(today);
  const habits = activeHabitsForCurrentMonth();

  const week = weekProgress(wk, habits);
  const month = monthProgress(mk, habits);

  const lines = [];
  lines.push("PARENT DASHBOARD");
  lines.push(`Week: ${wk}`);
  lines.push("");

  for (const h of habits) {
    const c = week.counts[h.id] || 0;
    const g = h.goal || 0;
    lines.push(`${pad(h.name, 20)} ${bar(c, Math.max(g, 1), 10)} ${c}/${g}${(g>0 && c>=g) ? " 🎯" : ""}`);
  }

  lines.push("");
  lines.push(`Month: ${mk} (weeks so far: ${month.weeksSoFar})`);
  for (const h of habits) {
    const c = month.counts[h.id] || 0;
    const g = (h.goal || 0) * month.weeksSoFar;
    lines.push(`${pad(h.name, 20)} ${bar(c, Math.max(g, 1), 10)} ${c}/${g}`);
  }

  return lines.join("\n");
}

// ---------- helpers ----------
function habitStreak(habitId) {
  let streak = 0;
  let d = new Date();

  while (true) {
    const iso = isoToday(d);
    const doneForDay = state.done[iso];

    if (!doneForDay || !doneForDay[habitId]) break;

    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}
function dayIndexMon0(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (dt.getDay() + 6) % 7; // Mon=0 ... Sun=6
}

function habitOnTrackRateToday(habit, weekCounts, dateISO) {
  const goal = habit.goal || 0;
  if (goal === 0) return 1; // always green if no goal

  const done = weekCounts[habit.id] || 0;

  // Days elapsed in the week including today: Mon=1 ... Sun=7
  const daysElapsed = dayIndexMon0(dateISO) + 1;

  // Expected progress by today (spread evenly across 7 days)
  const expected = (goal * daysElapsed) / 7;

  // Avoid divide-by-zero / tiny expected values
  const denom = Math.max(0.0001, expected);

  return Math.min(1, done / denom);
}

function clampInt(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function pct(rate) {
  return Math.round(rate * 100);
}
function pad(s, n) {
  const t = String(s);
  return t.length >= n ? t.slice(0, n - 1) + "…" : t + " ".repeat(n - t.length);
}
function bar(val, max, width) {
  const r = max === 0 ? 0 : Math.min(1, val / max);
  const fill = Math.round(r * width);
  return "█".repeat(fill) + "░".repeat(Math.max(0, width - fill));
}

function noteForDay(habitId, dateISO) {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e.date === dateISO && e.habitId === habitId) return e.note || "";
  }
  return "";
}

function setNoteForDay(habitId, dateISO, note) {
  state.log = state.log.filter(e => !(e.date === dateISO && e.habitId === habitId));
  const trimmed = (note || "").trim();
  if (trimmed) state.log.push({ date: dateISO, habitId, note: trimmed });
}

function getTodayNote(habitId) {
  const today = isoToday();
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e.date === today && e.habitId === habitId) {
      return e.note || "";
    }
  }
  return "";
}

function setTodayNote(habitId, note) {
  const today = isoToday();
  state.log = state.log.filter(
    e => !(e.date === today && e.habitId === habitId)
  );
  const trimmed = (note || "").trim();
  if (trimmed) {
    state.log.push({ date: today, habitId, note: trimmed });
  }
}



























