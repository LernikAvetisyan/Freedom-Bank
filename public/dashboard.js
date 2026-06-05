// /public/dashboard.js
// Dashboard controller for Freedom Bank
// Clean + minimal:
// - Authenticated fetch
// - Account switch (Checking/Credit)
// - Render header + connection badge
// - Render + filter transactions
// - Date range filters + summary metrics
// - Manual Generate flow + client-side quota display
// - Light refresh: only reload when a new transaction appears while tab is visible

;(function () {
  /* =========================================================
     1) CONSTANTS AND STATE
  ========================================================== */

  const auth = () => firebase.auth()
  const $ = (id) => document.getElementById(id)

  const fmtMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
  const TIMEZONE = "America/Los_Angeles"
  const ACCOUNT_TYPES = ["checking", "credit"]
  const MANUAL_CAP = 5

  let currentAccount = "checking"
  let allTxns = []
  let currentBalanceNow = 0
  let lastSeenTxnAtMs = 0
  let lastSeenLinked = null


  // Date pickers and range state
  let startPickerInstance = null
  let endPickerInstance = null
  let startDateSelected = null
  let endDateSelected = null
  let datePickerMode = "native"

  // Timers
  let listenersReady = false
  let laClockTimerId = null
  let midnightWatcherTimerId = null
  let changeWatcherTimerId = null

  /* =========================================================
     2) LA DATE AND TIME HELPERS
  ========================================================== */

  function laDateKey(d = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d)

    const y = parts.find((p) => p.type === "year")?.value || "1970"
    const m = parts.find((p) => p.type === "month")?.value || "01"
    const da = parts.find((p) => p.type === "day")?.value || "01"

    return `${y}-${m}-${da}`
  }

  const dtLA = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })

function parseTs(ts) {
  if (!ts) return null

  if (typeof ts === "object") {
    if (typeof ts.toDate === "function") return ts.toDate()

    if ("_seconds" in ts && Number.isFinite(ts._seconds)) {
      const ns = Number(ts._nanoseconds || 0)
      return new Date(ts._seconds * 1000 + Math.floor(ns / 1e6))
    }

    if ("seconds" in ts && Number.isFinite(ts.seconds)) {
      const ns = Number(ts.nanoseconds || 0)
      return new Date(ts.seconds * 1000 + Math.floor(ns / 1e6))
    }

    if ("$date" in ts) return new Date(ts.$date)
  }

  if (typeof ts === "number" || typeof ts === "string") {
    const d = new Date(ts)
    return Number.isFinite(d.getTime()) ? d : null
  }

  return null
}


  function normalizeDateRange() {
    if (startDateSelected && endDateSelected) {
      const a = laDateKey(startDateSelected)
      const b = laDateKey(endDateSelected)
      if (a > b) {
        const tmp = startDateSelected
        startDateSelected = endDateSelected
        endDateSelected = tmp

        if (datePickerMode === "flatpickr") {
          startPickerInstance?.setDate(startDateSelected, false)
          endPickerInstance?.setDate(endDateSelected, false)
        } else {
          const s = $("startDatePicker")
          const e = $("endDatePicker")
          if (s) s.value = laDateKey(startDateSelected)
          if (e) e.value = laDateKey(endDateSelected)
        }
      }
    }
  }

  function parseDateOnlyYYYYMMDD(s) {
    const v = String(s || "").trim()
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const d = Number(m[3])
    const dt = new Date(Date.UTC(y, mo, d, 12, 0, 0))
    return Number.isFinite(dt.getTime()) ? dt : null
  }

  /* =========================================================
     3) MANUAL GENERATE QUOTA (CLIENT DISPLAY ONLY)
     Server enforces true cap
  ========================================================== */

  const QUOTA_KEY = (acct = currentAccount) => `fb_manual_quota_${acct}_${laDateKey()}`

  function getLocalQuotaCount(acct = currentAccount) {
    const raw = sessionStorage.getItem(QUOTA_KEY(acct))
    return raw ? Math.max(0, Math.min(MANUAL_CAP, parseInt(raw, 10))) : 0
  }

  function setLocalQuotaCount(n, acct = currentAccount) {
    sessionStorage.setItem(QUOTA_KEY(acct), String(Math.max(0, Math.min(MANUAL_CAP, n))))
    renderGenCount(acct)
  }

  function renderGenCount(acct = currentAccount) {
    const el = $("genCount")
    if (el) el.textContent = `${getLocalQuotaCount(acct)}/${MANUAL_CAP}`
  }

  function setGenMsg(text, kind = "info") {
    const el = $("genMsg")
    if (!el) return

    el.textContent = text || ""
    el.className =
      "text-sm mt-1 " +
      (kind === "ok"
        ? "text-green-600"
        : kind === "warn"
        ? "text-yellow-600"
        : kind === "err"
        ? "text-red-600"
        : "text-[var(--text-secondary)]")
  }

  /* =========================================================
     4) AUTHENTICATED FETCH
  ========================================================== */

  async function fetchWithAuth(path, options = {}) {
    const user = auth().currentUser
    if (!user) throw new Error("Not signed in")

    const token = await user.getIdToken()

    const res = await fetch(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    })

    const ct = (res.headers.get("content-type") || "").toLowerCase()
    const payload = ct.includes("application/json") ? await res.json() : await res.text()

    if (!res.ok) {
      const err = new Error(typeof payload === "string" ? payload : JSON.stringify(payload))
      err.status = res.status
      err.data = payload
      throw err
    }

    return payload
  }

  /* =========================================================
     5) RENDER HELPERS
  ========================================================== */

  function safeSetText(id, text) {
    const el = $(id)
    if (el) el.textContent = text
  }

  function renderConnectionBadge(isConnected, targetId = "globalConnectionStatus") {
    const container = $(targetId)
    if (!container) return

    if (isConnected) {
      container.innerHTML = `
        <span class="status-badge linked">
          <span class="status-dot">
            <span class="ping"></span>
            <span class="solid"></span>
          </span>
          Connected to Budget-Wise-AI
        </span>
      `
    } else {
      container.innerHTML = ""
    }
  }

  function renderAccountSummary(balanceToShow, incomeToShow, expenseToShow) {
    const acct = currentAccount

    const balText =
      acct === "credit"
        ? `Debt: ${fmtMoney.format(Math.abs(Number(balanceToShow || 0)))}`
        : `Available Balance: ${fmtMoney.format(Number(balanceToShow || 0))}`
    safeSetText("accountBalance", balText)

    const incomeAbs = Math.abs(Number(incomeToShow || 0))
    const expenseAbs = Math.abs(Number(expenseToShow || 0))
    const net = incomeAbs - expenseAbs

    safeSetText("summaryIncome", fmtMoney.format(incomeAbs))
    safeSetText("summaryExpense", fmtMoney.format(expenseAbs))

    const netEl = $("summaryNet")
    if (netEl) {
      netEl.textContent = fmtMoney.format(Math.abs(net))
      netEl.classList.remove("pos", "neg", "zero")
      if (net > 0) netEl.classList.add("pos")
      else if (net < 0) netEl.classList.add("neg")
      else netEl.classList.add("zero")
    }
  }

  function renderTxns(list) {
    const tbody = $("transactionsTable")
    if (!tbody) return
    tbody.innerHTML = ""

    const cols = 5

    if (!Array.isArray(list) || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${cols}" class="p-4 text-center text-[var(--text-secondary)]">No transactions found</td></tr>`
      return
    }

    list.forEach((t) => {
      const d = parseTs(t.timestamp)
      const when = d ? dtLA.format(d) : "--"
      const isManual = String(t.source || "").trim().toLowerCase() === "manual"

      const amtNum = Number(t.amount || 0)
      const isIn = amtNum < 0
      const amountClass = isIn ? "amount-pos" : "amount-neg"
      const amountText = fmtMoney.format(Math.abs(amtNum))

      const typeRaw = String(t.type || "").trim().toLowerCase()
      const typeLabel = typeRaw === "income" ? "Income" : "Expense"
      const typeClass = typeRaw === "income" ? "text-emerald-500 font-medium" : "text-[var(--text-secondary)]"

      const tr = document.createElement("tr")
      tr.className = isManual ? "row-manual" : ""
      tr.innerHTML = `
        <td class="p-3 font-mono text-sm whitespace-nowrap text-[var(--text-secondary)]">${when}</td>
        <td class="p-3 font-medium text-[var(--text-primary)]">
          ${t.merchant ?? ""}
          ${isManual ? '<span class="manual-badge">Manual</span>' : ""}
        </td>
        <td class="p-3"><span class="badge">${t.category ?? ""}</span></td>
        <td class="p-3 text-sm ${typeClass}">${typeLabel}</td>
        <td class="p-3 text-right pr-4 font-mono ${amountClass}">${amountText}</td>
      `
      tbody.appendChild(tr)
    })
  }

  /* =========================================================
     6) SUMMARY + FILTERS
     IMPORTANT: Available Balance logic is fixed here.
     Rule:
       - If End Date selected => show overall balance "as of" End Date (includes all past txns)
       - Otherwise => show current overall balance
========================================================= */

  function computeSummaryForList(list) {
    let income = 0
    let expense = 0

    if (!Array.isArray(list) || list.length === 0) return { income: 0, expense: 0 }

    for (const t of list) {
      const typeRaw = String(t?.type || "").trim().toLowerCase()
      const amtNum = Number(t?.amount || 0)
      const isIncome = typeRaw === "income" || amtNum < 0
      if (isIncome) income += Math.abs(amtNum)
      else expense += Math.abs(amtNum)
    }

    return { income, expense }
  }

function computeBalanceAtEndDate(endDate, currentBalance, txnsAll) {
  if (!endDate) return Number(currentBalance || 0)

  const endKey = laDateKey(endDate)

  const list = Array.isArray(txnsAll) ? txnsAll.slice() : []
  list.sort((a, b) => {
    const ta = parseTs(a.timestamp)?.getTime() || 0
    const tb = parseTs(b.timestamp)?.getTime() || 0
    return ta - tb
  })

  let bal = 0

  for (const t of list) {
    const d = parseTs(t.timestamp)
    if (!d) continue

    const k = laDateKey(d)
    if (k > endKey) break

    const amt = Number(t.amount || 0)
    bal = bal - amt
  }

  return bal
}

  function getActiveRangeKeys() {
    normalizeDateRange()
    const startKey = startDateSelected ? laDateKey(startDateSelected) : null
    const endKey = endDateSelected ? laDateKey(endDateSelected) : null
    return { startKey, endKey }
  }

  function filterByRange(list, startKey, endKey) {
    if (!startKey && !endKey) return list

    return (list || []).filter((t) => {
      const d = parseTs(t.timestamp)
      if (!d) return false
      const k = laDateKey(d)
      if (startKey && k < startKey) return false
      if (endKey && k > endKey) return false
      return true
    })
  }

  function applyFilters() {
    const q = ($("searchBox")?.value || "").toLowerCase()
    const { startKey, endKey } = getActiveRangeKeys()

    let list = Array.isArray(allTxns) ? allTxns : []

    list = filterByRange(list, startKey, endKey)

    if (q) {
      list = list.filter(
        (t) => (t.merchant || "").toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q)
      )
    }

    renderTxns(list)

try {
  const { income, expense } = computeSummaryForList(list)

  const hasEndPicked = !!endDateSelected

  const balanceForView = hasEndPicked
    ? computeBalanceAtEndDate(endDateSelected, currentBalanceNow, allTxns)
    : currentBalanceNow

  renderAccountSummary(balanceForView, income, expense)
} catch (e) {
      console.error("Summary render failed:", e)
      renderAccountSummary(currentBalanceNow, 0, 0)
    }
  }

  /* =========================================================
     7) LOADERS
========================================================= */

  async function loadAccount(acct = currentAccount) {
    const data = await fetchWithAuth(`/api/account?account=${encodeURIComponent(acct)}`)

    safeSetText("accountTitle", acct === "credit" ? "Credit Card" : "Checking Account")

    currentBalanceNow = Number(data.currentBalance || 0)

    const last = parseTs(data.lastTxnAt)
    if (last) lastSeenTxnAtMs = last.getTime()

    safeSetText(
      "accountInfo",
      `Account: **** **** **** ${data.last4}  •  CVV: ${data.cvv}  •  Exp: ${data.expiry}`
    )

    renderConnectionBadge(!!data.linkedToBudgetWiseAI, "globalConnectionStatus")
    lastSeenLinked = !!data.linkedToBudgetWiseAI
  }

  async function loadTxns(acct = currentAccount) {
    const data = await fetchWithAuth(`/api/transactions?limit=all&account=${encodeURIComponent(acct)}`)
    allTxns = Array.isArray(data?.items) ? data.items : []
    applyFilters()
    updateTodayCount()
  }

  function updateTodayCount() {
    const todayLA = laDateKey(new Date())
    const count = (allTxns || []).filter((t) => {
      const d = parseTs(t.timestamp)
      return d && laDateKey(d) === todayLA
    }).length
    safeSetText("todayCount", String(count))
  }

  /* =========================================================
     8) LIGHT REFRESH ONLY WHEN A NEW TRANSACTION EXISTS
========================================================= */

  function stopChangeWatcher() {
    if (changeWatcherTimerId) {
      clearInterval(changeWatcherTimerId)
      changeWatcherTimerId = null
    }
  }

function startChangeWatcher() {
  if (changeWatcherTimerId) return

  const tick = async () => {
    if (!auth().currentUser) return
    if (document.visibilityState !== "visible") return
    if (!navigator.onLine) return

    try {
      const data = await fetchWithAuth(`/api/account?account=${encodeURIComponent(currentAccount)}`)

      const linkedNow = !!data.linkedToBudgetWiseAI
      if (lastSeenLinked === null) lastSeenLinked = linkedNow
      if (linkedNow !== lastSeenLinked) {
        lastSeenLinked = linkedNow
        renderConnectionBadge(linkedNow, "globalConnectionStatus")
      }

      const last = parseTs(data.lastTxnAt)
      const lastMs = last ? last.getTime() : 0
      if (lastMs && lastMs !== lastSeenTxnAtMs) {
        lastSeenTxnAtMs = lastMs
        await loadAccount(currentAccount)
        await loadTxns(currentAccount)
      }
    } catch (_) {}
  }

  changeWatcherTimerId = setInterval(tick, 8000)

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return
    tick()
  })

  window.addEventListener("online", () => tick())
}

  /* =========================================================
     9) LA MIDNIGHT COUNTDOWN DISPLAY
========================================================= */

  function startLAClock() {
    if (laClockTimerId) return

    const clockEl = $("laClock")
    const dateEl = $("laDate")
    const pad = (n) => n.toString().padStart(2, "0")

    function tick() {
      const now = new Date()
      const laNow = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }))
      const tomorrow = new Date(laNow)
      tomorrow.setDate(laNow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)

      const diff = (tomorrow - laNow) / 1000
      const hh = pad(Math.floor(diff / 3600))
      const mm = pad(Math.floor((diff % 3600) / 60))
      const ss = pad(Math.floor(diff % 60))
      if (clockEl) clockEl.textContent = `${hh}:${mm}:${ss}`

      const dOpts = { timeZone: TIMEZONE, weekday: "short", month: "short", day: "numeric" }
      if (dateEl) dateEl.textContent = new Intl.DateTimeFormat("en-US", dOpts).format(laNow)
    }

    tick()
    laClockTimerId = setInterval(tick, 1000)
  }

  /* =========================================================
     10) ACCOUNT SWITCHING
========================================================= */

  function setActiveSwitch(acct) {
    const btnChecking = $("btnChecking")
    const btnCredit = $("btnCredit")
    if (!btnChecking || !btnCredit) return

    btnChecking.classList.toggle("active", acct === "checking")
    btnCredit.classList.toggle("active", acct === "credit")

    btnChecking.setAttribute("aria-selected", String(acct === "checking"))
    btnCredit.setAttribute("aria-selected", String(acct === "credit"))
  }

  async function switchAccount(acct) {
    const normalized = ACCOUNT_TYPES.includes(String(acct).toLowerCase()) ? String(acct).toLowerCase() : "checking"
    if (normalized === currentAccount) return

    currentAccount = normalized
    setActiveSwitch(currentAccount)
    renderGenCount(currentAccount)
    setGenMsg("")

    try {
      await loadAccount(currentAccount)
      await loadTxns(currentAccount)
    } catch (e) {
      console.error("Switch account error:", e)
      setGenMsg("Failed to switch account.", "err")
    }
  }

  /* =========================================================
     11) UI LISTENERS
========================================================= */

  function setupListeners() {
    if (listenersReady) return
    listenersReady = true

    $("searchBox")?.addEventListener("input", applyFilters)

    $("refreshBtn")?.addEventListener("click", async () => {
      await loadAccount(currentAccount)
      await loadTxns(currentAccount)
    })

    $("clearFiltersBtn")?.addEventListener("click", () => {
      const sb = $("searchBox")
      if (sb) sb.value = ""

      startDateSelected = null
      endDateSelected = null

      if (datePickerMode === "flatpickr") {
        startPickerInstance?.clear()
        endPickerInstance?.clear()
      } else {
        const s = $("startDatePicker")
        const e = $("endDatePicker")
        if (s) s.value = ""
        if (e) e.value = ""
      }

      applyFilters()
    })

    $("logoutBtn")?.addEventListener("click", async () => {
      stopChangeWatcher()

      if (laClockTimerId) {
        clearInterval(laClockTimerId)
        laClockTimerId = null
      }
      if (midnightWatcherTimerId) {
        clearInterval(midnightWatcherTimerId)
        midnightWatcherTimerId = null
      }

      await auth().signOut()
      location.href = "index.html"
    })

    $("generateBtn")?.addEventListener("click", async (evt) => {
      const btn = evt.currentTarget
      if (!btn) return
      if (btn.disabled) return

      if (getLocalQuotaCount(currentAccount) >= MANUAL_CAP) {
        setGenMsg("Daily manual limit reached for this account. Try again after LA midnight.", "warn")
        return
      }

      setGenMsg("Generating 1 manual transaction…")
      btn.disabled = true

      try {
        const out = await fetchWithAuth(`/tick?account=${encodeURIComponent(currentAccount)}`)

        const remaining = Math.max(0, Number(out?.remaining ?? 0))
        const used = Math.max(0, MANUAL_CAP - remaining)
        setLocalQuotaCount(used, currentAccount)

        setGenMsg(`Generated 1 manual transaction. ${remaining} remaining today for ${currentAccount}.`, "ok")

        setTimeout(async () => {
          await loadAccount(currentAccount)
          await loadTxns(currentAccount)
        }, 600)
      } catch (e) {
        if (e?.status === 429) {
          setLocalQuotaCount(MANUAL_CAP, currentAccount)
          setGenMsg("Daily manual limit reached for this account. Try again after LA midnight.", "warn")
        } else if (e?.status === 401) {
          setGenMsg("Session expired. Please sign in again.", "err")
        } else {
          console.error(e)
          setGenMsg("Failed to generate. Please try again.", "err")
        }
      } finally {
        btn.disabled = false
      }
    })

    $("btnChecking")?.addEventListener("click", () => switchAccount("checking"))
    $("btnCredit")?.addEventListener("click", () => switchAccount("credit"))
  }

  /* =========================================================
     12) DATE PICKERS (Flatpickr + Native fallback)
========================================================= */

  function setupNativeDateInputs() {
    datePickerMode = "native"

    const s = $("startDatePicker")
    const e = $("endDatePicker")

    if (s) {
      s.type = "date"
      s.readOnly = false
      s.inputMode = "none"
      s.addEventListener("change", () => {
        startDateSelected = s.value ? parseDateOnlyYYYYMMDD(s.value) : null
        applyFilters()
      })
    }

    if (e) {
      e.type = "date"
      e.readOnly = false
      e.inputMode = "none"
      e.addEventListener("change", () => {
        endDateSelected = e.value ? parseDateOnlyYYYYMMDD(e.value) : null
        applyFilters()
      })
    }

    $("startDateBtn")?.addEventListener("click", (ev) => {
      ev.preventDefault()
      s?.focus()
      s?.click()
    })

    $("endDateBtn")?.addEventListener("click", (ev) => {
      ev.preventDefault()
      e?.focus()
      e?.click()
    })
  }

  function setupFlatpickr() {
    if (startPickerInstance || endPickerInstance) return true
    if (!window.flatpickr) return false

    datePickerMode = "flatpickr"

    startPickerInstance = flatpickr("#startDatePicker", {
      allowInput: false,
      clickOpens: true,
      disableMobile: true,
      dateFormat: "Y-m-d",
      onChange: (dates) => {
        startDateSelected = dates && dates[0] ? dates[0] : null
        applyFilters()
      },
    })

    endPickerInstance = flatpickr("#endDatePicker", {
      allowInput: false,
      clickOpens: true,
      disableMobile: true,
      dateFormat: "Y-m-d",
      onChange: (dates) => {
        endDateSelected = dates && dates[0] ? dates[0] : null
        applyFilters()
      },
    })

    const s = $("startDatePicker")
    const e = $("endDatePicker")

    if (s) {
      s.setAttribute("readonly", "readonly")
      s.setAttribute("inputmode", "none")
      s.addEventListener("keydown", (ev) => ev.preventDefault())
    }
    if (e) {
      e.setAttribute("readonly", "readonly")
      e.setAttribute("inputmode", "none")
      e.addEventListener("keydown", (ev) => ev.preventDefault())
    }

    $("startDateBtn")?.addEventListener("click", (ev) => {
      ev.preventDefault()
      startPickerInstance?.open()
    })

    $("endDateBtn")?.addEventListener("click", (ev) => {
      ev.preventDefault()
      endPickerInstance?.open()
    })

    return true
  }

  function setupDatePickers() {
    if (setupFlatpickr()) return
    setupNativeDateInputs()
  }

  /* =========================================================
     13) LA MIDNIGHT WATCHER (quota display only)
========================================================= */

  function startMidnightResetWatcher() {
    if (midnightWatcherTimerId) return

    let lastQuotaKeyChecking = `fb_manual_quota_checking_${laDateKey()}`
    let lastQuotaKeyCredit = `fb_manual_quota_credit_${laDateKey()}`

    midnightWatcherTimerId = setInterval(() => {
      const nowKeyChecking = `fb_manual_quota_checking_${laDateKey()}`
      const nowKeyCredit = `fb_manual_quota_credit_${laDateKey()}`

      if (nowKeyChecking !== lastQuotaKeyChecking || nowKeyCredit !== lastQuotaKeyCredit) {
        lastQuotaKeyChecking = nowKeyChecking
        lastQuotaKeyCredit = nowKeyCredit
        renderGenCount(currentAccount)
        updateTodayCount()
      }
    }, 30 * 1000)
  }

  /* =========================================================
     14) BOOTSTRAP
========================================================= */

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      stopChangeWatcher()
      location.href = "index.html"
      return
    }

    startLAClock()
    setupListeners()
    setActiveSwitch(currentAccount)
    renderGenCount(currentAccount)
    startMidnightResetWatcher()

    // Date pickers: try once, then one retry in case CDN loads slowly
    setupDatePickers()
    setTimeout(() => setupDatePickers(), 800)

    try {
      await loadAccount(currentAccount)
      await loadTxns(currentAccount)

      applyFilters()

      startChangeWatcher()
    } catch (e) {
      console.error("Initialization error:", e)
      setGenMsg("Failed to load data.", "err")
      renderAccountSummary(currentBalanceNow, 0, 0)
    }
  })
})()
