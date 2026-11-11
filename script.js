const API_KEY = "0bd04bb36d76a7745a874716e9d50dac";
const BASE_URL = "https://getsmsweb.com/developer_api";
const SERVICE_ID = "198";

// Supabase Configuration
const SUPABASE_URL = "https://weuwpvqjaaztgqirmruu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_U33S9LwBpKhetkwUeFFWgg_0cx5nSoD";

let _supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_URL.startsWith("http")) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn("Supabase initialization error.");
}

let loggedInUser = null;
let currentOrderId = "";
let otpInterval = null;
let currentUserDailyLimit = 20;
let currentUserTodayBoughtCount = 0;

// DOM Elements
const loginOverlay = document.getElementById("loginOverlay");
const appMain = document.getElementById("appMain");
const currentUserEmail = document.getElementById("currentUserEmail");
const navAdminUsers = document.getElementById("navAdminUsers");
const canadaView = document.getElementById("canadaView"); // নতুন যোগ করা হলো
const dashboardView = document.getElementById("dashboardView");
const navCanada = document.getElementById("navCanada"); // নতুন যোগ করা হলো
const whatsappView = document.getElementById("whatsappView");
const adminUsersView = document.getElementById("adminUsersView");
const reportView = document.getElementById("reportView");

const navDashboard = document.getElementById("navDashboard");
const navWhatsapp = document.getElementById("navWhatsapp");
const navReport = document.getElementById("navReport");

const sidebarBalance = document.getElementById("sidebarBalance");
const balanceSpinner = document.getElementById("balanceSpinner");
const buySection = document.getElementById("buySection");
const orderCard = document.getElementById("orderCard");
const historySection = document.getElementById("historySection");
const historyTableBody = document.getElementById("historyTableBody");
const adminUsersTableBody = document.getElementById("adminUsersTableBody");

const orderTitle = document.getElementById("orderTitle");
const orderTimestamp = document.getElementById("orderTimestamp");
const activationId = document.getElementById("activationId");
const orderStatusText = document.getElementById("orderStatusText");
const phoneNumber = document.getElementById("phoneNumber");
const otpCode = document.getElementById("otpCode");
const liveStatusText = document.getElementById("liveStatusText");
const statusToast = document.getElementById("statusToast");
const btnCancelOrder = document.getElementById("btnCancelOrder");
const btnBuyNumber = document.getElementById("btnBuyNumber");

// Stats Elements
const statBought = document.getElementById("statBought");
const statOtp = document.getElementById("statOtp");
const statCanceled = document.getElementById("statCanceled");
const statInvestment = document.getElementById("statInvestment");

// API Direct Fetch Function
async function fetchDirectAPI(actionParams) {
  const fullUrl = `${BASE_URL}?api_key=${API_KEY}&${actionParams}`;
  const response = await fetch(fullUrl);
  return await response.json();
}

// Live Balance Fetch from API
async function checkBalance() {
  if (balanceSpinner) balanceSpinner.classList.add("fa-spin");
  try {
    const data = await fetchDirectAPI("action=get_balance");
    let balanceVal = "0.00";
    if (data.balance !== undefined) {
      balanceVal = parseFloat(data.balance).toFixed(2);
    } else if (typeof data === "number" || typeof data === "string") {
      balanceVal = parseFloat(data).toFixed(2);
    }
    if (sidebarBalance) sidebarBalance.innerText = `৳${balanceVal}`;
  } catch (error) {
    console.error("Balance fetch error:", error);
  } finally {
    if (balanceSpinner) balanceSpinner.classList.remove("fa-spin");
  }
}

// === 1. SHOW DATABASE LIMIT DIRECTLY IN SIDEBAR ===
async function updateUserLimitSidebar() {
  if (!_supabase || !loggedInUser) return;

  // Database theke user-er current daily_limit ana hocche
  const { data: profile } = await _supabase
    .from("user_profiles")
    .select("daily_limit")
    .eq("email", loggedInUser.email)
    .single();

  if (profile && profile.daily_limit !== undefined) {
    currentUserDailyLimit = profile.daily_limit;
  } else {
    currentUserDailyLimit = 0;
  }

  // Sidebar UI Update
  const limitCountEl = document.getElementById("userLimitCount");
  const progressBarEl = document.getElementById("userLimitProgressBar");

  if (limitCountEl) {
    limitCountEl.innerText = `${currentUserDailyLimit}`;
  }

  if (progressBarEl) {
    progressBarEl.style.width = currentUserDailyLimit > 0 ? "100%" : "0%";
    if (currentUserDailyLimit <= 2) {
      progressBarEl.className =
        "bg-rose-500 h-full rounded-full transition-all duration-300";
    } else {
      progressBarEl.className =
        "bg-blue-500 h-full rounded-full transition-all duration-300";
    }
  }

  // Buy Button Disable/Enable Check
  if (btnBuyNumber) {
    if (currentUserDailyLimit <= 0) {
      btnBuyNumber.disabled = true;
      btnBuyNumber.className =
        "w-full sm:w-96 mx-auto bg-slate-100 text-slate-400 font-bold px-8 py-4 rounded-2xl cursor-not-allowed flex items-center justify-center gap-3 shadow-none border border-slate-200 transition-all";
      btnBuyNumber.innerHTML = `<i class="fa-solid fa-ban text-base"></i> Daily Limit Reached`;
    } else {
      btnBuyNumber.disabled = false;
      btnBuyNumber.className =
        "w-full sm:w-96 mx-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99]";
      btnBuyNumber.innerHTML = `<i class="fa-solid fa-cart-shopping text-base"></i> Buy WhatsApp Number`;
    }
  }
}

// === HELPER TO UPDATE UI INSTANTLY ===
function updateSidebarUIOnly() {
  let remaining = currentUserDailyLimit - currentUserTodayBoughtCount;
  if (remaining < 0) remaining = 0;

  const limitCountEl = document.getElementById("userLimitCount");
  const progressBarEl = document.getElementById("userLimitProgressBar");

  if (limitCountEl) {
    limitCountEl.innerText = `${remaining} / ${currentUserDailyLimit}`;
  }

  if (progressBarEl) {
    let percentage = (remaining / currentUserDailyLimit) * 100;
    if (isNaN(percentage)) percentage = 0;
    progressBarEl.style.width = `${percentage}%`;

    if (percentage <= 20) {
      progressBarEl.className =
        "bg-rose-500 h-full rounded-full transition-all duration-300";
    } else if (percentage <= 50) {
      progressBarEl.className =
        "bg-amber-500 h-full rounded-full transition-all duration-300";
    } else {
      progressBarEl.className =
        "bg-blue-500 h-full rounded-full transition-all duration-300";
    }
  }

  if (btnBuyNumber) {
    if (remaining <= 0) {
      btnBuyNumber.disabled = true;
      btnBuyNumber.className =
        "w-full sm:w-96 mx-auto bg-slate-100 text-slate-400 font-bold px-8 py-4 rounded-2xl cursor-not-allowed flex items-center justify-center gap-3 shadow-none border border-slate-200 transition-all";
      btnBuyNumber.innerHTML = `<i class="fa-solid fa-ban text-base"></i> Daily Limit Reached`;
    } else {
      btnBuyNumber.disabled = false;
      btnBuyNumber.className =
        "w-full sm:w-96 mx-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99]";
      btnBuyNumber.innerHTML = `<i class="fa-solid fa-cart-shopping text-base"></i> Buy WhatsApp Number`;
    }
  }
}
// === STRICT LOGIN SYSTEM ===
async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    alert("Please enter both Email and Password!");
    return;
  }

  const { data, error } = await _supabase
    .from("user_profiles")
    .select("*")
    .eq("email", email)
    .single();

  if (data) {
    if (!data.password || data.password !== password) {
      alert("Incorrect Password! Please check your password.");
      return;
    }

    loggedInUser = data;
    localStorage.setItem("nexaUser", JSON.stringify(data));
    initUserSession();
  } else {
    alert("Invalid Email or User does not exist!");
  }
}

function initUserSession() {
  if (!loggedInUser) return;

  loginOverlay.classList.add("hidden");
  appMain.classList.remove("hidden");
  currentUserEmail.innerText = loggedInUser.email;

  checkBalance();
  updateUserLimitSidebar();

  if (loggedInUser.role === "admin") {
    navAdminUsers.classList.remove("hidden");
  } else {
    navAdminUsers.classList.add("hidden");
  }

  switchTab("dashboard");
}

function handleLogout() {
  localStorage.removeItem("nexaUser");
  loggedInUser = null;
  location.reload();
}

// === SECURE CREATE USER (ADMIN ONLY) ===
async function createNewUser() {
  if (!loggedInUser || loggedInUser.role !== "admin") {
    alert("Access Denied! Only administrators can create new user accounts.");
    return;
  }

  const email = document.getElementById("newUserEmail").value.trim();
  const password = document.getElementById("newUserPassword").value.trim();

  if (!email || !password) {
    alert("Email & Password required!");
    return;
  }

  const { data, error } = await _supabase
    .from("user_profiles")
    .insert([
      { email: email, password: password, role: "user", daily_limit: 20 },
    ]);

  if (!error) {
    showToast("User Account Created Successfully!");
    document.getElementById("newUserEmail").value = "";
    document.getElementById("newUserPassword").value = "";
    loadAllUsersAdmin();
  } else {
    alert("Error creating user: " + error.message);
  }
}

// === LOAD ALL USERS IN ADMIN PANEL ===
async function loadAllUsersAdmin() {
  if (!_supabase) return;
  const tbody = document.getElementById("adminUsersTableBody");
  if (!tbody) return;

  const { data: users } = await _supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (users && users.length > 0) {
    tbody.innerHTML = "";
    users.forEach((user) => {
      const createdDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString()
        : "N/A";
      const row = document.createElement("tr");
      row.className = "hover:bg-slate-50 transition border-b border-slate-100";
      row.innerHTML = `
        <td class="py-3 px-4 font-bold text-slate-900">${user.email}</td>
        <td class="py-3 px-4">
          <span class="px-2.5 py-1 rounded-md text-xs font-bold ${user.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}">
            ${user.role}
          </span>
        </td>
        <td class="py-3 px-4 text-xs text-slate-500 font-mono">${createdDate}</td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2">
            <input type="number" id="limitInput_${user.id}" value="${user.daily_limit !== undefined ? user.daily_limit : 20}" placeholder="Limit" class="w-20 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 text-center focus:outline-none focus:border-blue-500" />
            <button onclick="saveUserLimit('${user.id}', '${user.email}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1">
              <i class="fa-solid fa-check"></i> Save
            </button>
          </div>
        </td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2">
            <button onclick="editUserInfo('${user.id}', '${user.email}', '${user.password || ""}', '${user.role}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1 rounded-xl transition cursor-pointer flex items-center gap-1">
              <i class="fa-solid fa-user-pen text-[10px]"></i> Edit User
            </button>
            <button onclick="deleteUser('${user.id}', '${user.email}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3 py-1 rounded-xl transition cursor-pointer flex items-center gap-1">
              <i class="fa-solid fa-trash text-[10px]"></i> Delete
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">No registered users found.</td></tr>`;
  }
}

// === SAVE USER LIMIT ===
async function saveUserLimit(userId, userEmail) {
  const limitInput = document.getElementById(`limitInput_${userId}`);
  if (!limitInput || !_supabase) return;

  const newLimit = parseInt(limitInput.value);
  if (isNaN(newLimit) || newLimit < 0) {
    showToast("Please enter a valid limit number!", true);
    return;
  }

  const { error } = await _supabase
    .from("user_profiles")
    .update({ daily_limit: newLimit })
    .eq("id", userId);

  if (!error) {
    showToast(`Success! Daily limit for ${userEmail} updated to ${newLimit}.`);
    updateUserLimitSidebar();
  } else {
    showToast("Failed to update daily limit!", true);
  }
}

async function editUserInfo(
  userId,
  currentEmail,
  currentPassword,
  currentRole,
) {
  const newEmail = prompt("Enter Email address:", currentEmail);
  if (newEmail === null) return;

  const newPassword = prompt("Enter Password:", currentPassword);
  if (newPassword === null) return;

  const newRole = prompt("Enter Role ('admin' or 'user'):", currentRole);
  if (newRole === null) return;

  if (newRole !== "admin" && newRole !== "user") {
    alert("Invalid role! Please enter 'admin' or 'user'.");
    return;
  }

  const updatedEmail = newEmail.trim();
  const updatedPassword = newPassword.trim();

  const { error } = await _supabase
    .from("user_profiles")
    .update({
      email: updatedEmail,
      password: updatedPassword,
      role: newRole,
    })
    .eq("id", userId);

  if (!error) {
    if (currentEmail !== updatedEmail) {
      await _supabase
        .from("orders")
        .update({ user_email: updatedEmail })
        .eq("user_email", currentEmail);
    }
    showToast("User Email, Password & Role updated successfully!");
    loadAllUsersAdmin();
  } else {
    showToast("Error updating user: " + error.message, true);
  }
}

async function deleteUser(userId, email) {
  if (loggedInUser && loggedInUser.email === email) {
    alert("You cannot delete your own admin account!");
    return;
  }

  if (!confirm(`Are you sure you want to delete the user '${email}'?`)) return;

  const { error } = await _supabase
    .from("user_profiles")
    .delete()
    .eq("id", userId);

  if (!error) {
    showToast(`User '${email}' deleted successfully!`);
    loadAllUsersAdmin();
  } else {
    showToast("Error deleting user: " + error.message, true);
  }
}

function switchTab(tab) {
  stopSmartActivityPolling();

  if (tab === "adminUsers") {
    if (!loggedInUser || loggedInUser.role !== "admin") {
      showToast("Access Denied! Administrator only.", true);
      switchTab("dashboard");
      return;
    }
  }

  // ১. সব ভিউ উপাদান হাইড করা
  dashboardView.classList.add("hidden");
  whatsappView.classList.add("hidden");
  if (typeof canadaView !== "undefined" && canadaView)
    canadaView.classList.add("hidden");
  adminUsersView.classList.add("hidden");
  if (reportView) reportView.classList.add("hidden");

  const activeNav =
    "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-all w-full text-left";
  const inactiveNav =
    "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl hover:bg-slate-800/60 text-slate-300 hover:text-white transition-all w-full text-left";

  // ২. সব সাইডবার বাটনের স্টাইল ইন-অ্যাক্টিভ করা
  if (navDashboard) navDashboard.className = inactiveNav;
  if (navWhatsapp) navWhatsapp.className = inactiveNav;
  if (typeof navCanada !== "undefined" && navCanada)
    navCanada.className = inactiveNav;
  if (navReport) navReport.className = inactiveNav;
  if (navAdminUsers)
    navAdminUsers.className = inactiveNav + " border border-amber-500/20";

  // ৩. সিলেক্টেড ট্যাব অনুযায়ী ভিউ ওপেন করা
  if (tab === "dashboard") {
    dashboardView.classList.remove("hidden");
    if (navDashboard) navDashboard.className = activeNav;
    fetchDashboardStats();
    fetchGlobalActivityLog();
    startSmartActivityPolling();
    updateUserLimitSidebar();
  } else if (tab === "whatsapp") {
    whatsappView.classList.remove("hidden");
    if (navWhatsapp) navWhatsapp.className = activeNav;
    updateUserLimitSidebar();

    if (orderCard && !orderCard.classList.contains("hidden")) {
      if (historySection) historySection.classList.add("hidden");
    } else {
      if (historySection) historySection.classList.remove("hidden");
      fetchOrderHistory();
    }
  } else if (tab === "canada") {
    // 🇨🇦 Canada Stock Tab Logic
    if (typeof canadaView !== "undefined" && canadaView)
      canadaView.classList.remove("hidden");
    if (typeof navCanada !== "undefined" && navCanada)
      navCanada.className = activeNav;
    updateUserLimitSidebar();

    // Canada Active Order Card বা History Toggle হ্যান্ডলিং
    const canadaOrderCard = document.getElementById("canadaOrderCard");
    const canadaHistorySection = document.getElementById(
      "canadaHistorySection",
    );

    if (canadaOrderCard && !canadaOrderCard.classList.contains("hidden")) {
      if (canadaHistorySection) canadaHistorySection.classList.add("hidden");
    } else {
      if (canadaHistorySection) canadaHistorySection.classList.remove("hidden");
      if (typeof fetchCanadaHistory === "function") fetchCanadaHistory();
    }
  } else if (tab === "report") {
    if (reportView) reportView.classList.remove("hidden");
    if (navReport) navReport.className = activeNav;
    loadAllUserReportSheet();
  } else if (tab === "adminUsers") {
    adminUsersView.classList.remove("hidden");
    if (navAdminUsers)
      navAdminUsers.className = activeNav + " border border-amber-500/20";
    loadAllUsersAdmin();
  }
}

// === USER SPECIFIC DASHBOARD STATS ===
async function fetchDashboardStats() {
  if (!_supabase || !loggedInUser) return;
  const todayStr = new Date().toISOString().split("T")[0];

  const { data } = await _supabase
    .from("orders")
    .select("*")
    .eq("user_email", loggedInUser.email)
    .gte("created_at", todayStr);

  if (data) {
    let boughtCount = data.length;
    let otpCount = data.filter(
      (o) => o.otp && o.otp !== "Waiting..." && o.otp !== "N/A",
    ).length;
    let canceledCount = data.filter(
      (o) => o.status === "Canceled & Refunded" || o.status === "Canceled",
    ).length;
    let totalSpent = otpCount * 20;

    if (statBought) statBought.innerText = boughtCount;
    if (statOtp) statOtp.innerText = otpCount;
    if (statCanceled) statCanceled.innerText = canceledCount;
    if (statInvestment) statInvestment.innerText = `৳${totalSpent.toFixed(2)}`;

    updateUserLimitSidebar();
  }
}

// === FETCH USER SPECIFIC ORDER HISTORY ===
async function fetchOrderHistory() {
  if (!_supabase || !loggedInUser || !historyTableBody) return;
  const { data } = await _supabase
    .from("orders")
    .select("*")
    .eq("user_email", loggedInUser.email)
    .order("created_at", { ascending: false });

  if (data && data.length > 0) {
    historyTableBody.innerHTML = "";
    data.forEach((order) => {
      let statusBadge = "";
      if (order.status === "Confirmed") {
        statusBadge = `<span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold">Confirmed</span>`;
      } else if (order.otp && order.otp !== "Waiting...") {
        statusBadge = `<span class="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-bold">OTP Received</span>`;
      } else {
        statusBadge = `<span class="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-md text-xs font-bold">${order.status}</span>`;
      }

      const row = document.createElement("tr");
      row.className = "hover:bg-slate-50 transition";
      row.innerHTML = `
        <td class="py-3 px-4 font-mono text-xs text-blue-600 font-bold">#${order.order_id}</td>
        <td class="py-3 px-4 font-mono text-xs">${order.phone_number}</td>
        <td class="py-3 px-4 font-mono text-xs font-bold text-emerald-600">${order.otp || "Waiting..."}</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4 text-center">
          <button onclick="viewOrder('${order.order_id}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer">
            <i class="fa-solid fa-eye mr-1"></i> View
          </button>
        </td>
      `;
      historyTableBody.appendChild(row);
    });
  } else {
    historyTableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 font-normal">No order history found.</td></tr>`;
  }
}

async function recordSystemLog(
  userEmail,
  actionType,
  orderId,
  phoneNumber,
  otpCode = null,
) {
  if (!_supabase) return;
  try {
    await _supabase.from("system_logs").insert([
      {
        user_email: userEmail,
        action_type: actionType,
        order_id: orderId,
        phone_number: phoneNumber,
        otp_code: otpCode,
      },
    ]);
  } catch (e) {
    console.error("Error logging system activity:", e);
  }
}

// === 2. BUY NUMBER & MINUS 1 FROM DATABASE LIMIT ===
async function buyNumber() {
  if (!loggedInUser) return;

  // Database theke latest limit abar check kore newa
  const { data: profile } = await _supabase
    .from("user_profiles")
    .select("daily_limit")
    .eq("email", loggedInUser.email)
    .single();

  let currentLimit = profile ? profile.daily_limit : 0;

  if (currentLimit <= 0) {
    showToast("Daily limit reached! You cannot buy more numbers.", true);
    updateUserLimitSidebar();
    return;
  }

  btnBuyNumber.disabled = true;
  btnBuyNumber.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Purchasing...`;
  showToast("Buying WhatsApp number...");

  try {
    const data = await fetchDirectAPI(
      `action=buy_number&service_id=${SERVICE_ID}`,
    );

    if (data.order_id || data.id) {
      currentOrderId = data.order_id || data.id;
      const phoneNumStr = data.number || data.phone || "Number Purchased";

      // 1. Insert Order in database
      await _supabase.from("orders").insert([
        {
          order_id: String(currentOrderId),
          phone_number: phoneNumStr,
          otp: "Waiting...",
          status: "Confirmed",
          user_email: loggedInUser.email,
        },
      ]);

      await recordSystemLog(
        loggedInUser.email,
        "NEW_ORDER",
        String(currentOrderId),
        phoneNumStr,
      );

      // 2. 🟢 DATABASE THEKE 1 MINUS KORE UPDATE KORA
      let newLimit = currentLimit - 1;
      if (newLimit < 0) newLimit = 0;

      await _supabase
        .from("user_profiles")
        .update({ daily_limit: newLimit })
        .eq("email", loggedInUser.email);

      currentUserDailyLimit = newLimit;

      orderTitle.innerText = `Order #${currentOrderId}`;
      activationId.innerText = currentOrderId;
      phoneNumber.innerText = phoneNumStr;
      otpCode.innerText = "Waiting...";
      if (orderStatusText) {
        orderStatusText.innerText = "Confirmed";
        orderStatusText.className = "text-emerald-600 font-bold text-base mt-1";
      }

      const now = new Date();
      orderTimestamp.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleTimeString()}`;

      buySection.classList.add("hidden");
      if (historySection) historySection.classList.add("hidden");
      orderCard.classList.remove("hidden");

      showToast("WhatsApp Number purchased successfully!");
      checkBalance();
      fetchDashboardStats();
      updateUserLimitSidebar();
      startAutoPolling();
    } else {
      showToast("Failed: " + (data.message || JSON.stringify(data)), true);
    }
  } catch (e) {
    showToast("Error buying number: " + e.message, true);
  } finally {
    updateUserLimitSidebar();
  }
}

async function checkOTP() {
  if (!currentOrderId) return;
  liveStatusText.innerText = "Checking OTP from server...";

  try {
    const data = await fetchDirectAPI(
      `action=get_otp&order_id=${currentOrderId}`,
    );

    if (data.otp || data.code) {
      const code = data.otp || data.code;
      otpCode.innerText = code;
      liveStatusText.innerText = "OTP received successfully!";
      showToast("OTP Received: " + code);
      stopAutoPolling();

      if (orderStatusText) {
        orderStatusText.innerText = "OTP Received";
        orderStatusText.className = "text-emerald-600 font-bold text-base mt-1";
      }

      btnCancelOrder.disabled = true;
      btnCancelOrder.className =
        "bg-slate-100 text-slate-400 border border-slate-200 font-medium py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-60";

      await _supabase
        .from("orders")
        .update({ otp: String(code), status: "OTP Received" })
        .eq("order_id", String(currentOrderId));

      await recordSystemLog(
        loggedInUser.email,
        "OTP_RECEIVED",
        String(currentOrderId),
        phoneNumber.innerText,
        String(code),
      );

      fetchDashboardStats();
      checkBalance();
    } else if (data.status === "pending" || data.message) {
      liveStatusText.innerText =
        data.message || "Waiting for incoming OTP SMS...";
    }
  } catch (e) {
    liveStatusText.innerText = "Error fetching OTP.";
  }
}

function startAutoPolling() {
  if (otpInterval) clearInterval(otpInterval);
  otpInterval = setInterval(() => {
    if (currentOrderId) checkOTP();
  }, 6000);
}

function stopAutoPolling() {
  if (otpInterval) {
    clearInterval(otpInterval);
    otpInterval = null;
  }
}
// === 3. CANCEL ORDER & PLUS 1 (RESTORE) TO DATABASE LIMIT ===
async function cancelOrder() {
  if (!currentOrderId) return;

  if (btnCancelOrder.disabled) {
    showToast("OTP চলে আসার পর অর্ডার ক্যানসেল বা রিফান্ড করা যাবে না!", true);
    return;
  }

  if (
    !confirm(
      "Are you sure you want to cancel this order and claim your refund?",
    )
  )
    return;

  showToast("Canceling order...");
  stopAutoPolling();

  try {
    const data = await fetchDirectAPI(
      `action=cancel_order&order_id=${currentOrderId}`,
    );
    showToast("Order canceled: " + (data.message || "Refund processed."));

    if (orderStatusText) {
      orderStatusText.innerText = "Canceled & Refunded";
      orderStatusText.className = "text-rose-600 font-bold text-base mt-1";
    }

    await _supabase
      .from("orders")
      .update({ status: "Canceled & Refunded" })
      .eq("order_id", String(currentOrderId));

    await recordSystemLog(
      loggedInUser.email,
      "CANCELED",
      String(currentOrderId),
      phoneNumber.innerText,
    );

    // 🟢 DATABASE THEKE CURRENT LIMIT ENE 1 PLUS/RESTORE KORA
    const { data: profile } = await _supabase
      .from("user_profiles")
      .select("daily_limit")
      .eq("email", loggedInUser.email)
      .single();

    let currentLimit = profile ? profile.daily_limit : 0;
    let restoredLimit = currentLimit + 1;

    await _supabase
      .from("user_profiles")
      .update({ daily_limit: restoredLimit })
      .eq("email", loggedInUser.email);

    currentUserDailyLimit = restoredLimit;

    resetToBuyView();
    checkBalance();
    fetchDashboardStats();
    updateUserLimitSidebar();
  } catch (e) {
    showToast("Error canceling order: " + e.message, true);
  }
}

function resetToBuyView() {
  stopAutoPolling();
  currentOrderId = "";
  orderCard.classList.add("hidden");
  buySection.classList.remove("hidden");
  if (historySection) {
    historySection.classList.remove("hidden");
    fetchOrderHistory();
  }
  statusToast.classList.add("hidden");

  btnCancelOrder.disabled = false;
  btnCancelOrder.className =
    "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-medium py-3 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer";

  updateUserLimitSidebar();
}

async function viewOrder(orderId) {
  if (!_supabase) return;
  try {
    const { data } = await _supabase
      .from("orders")
      .select("*")
      .eq("order_id", String(orderId))
      .single();

    if (data) {
      currentOrderId = data.order_id;
      orderTitle.innerText = `Order #${data.order_id}`;
      activationId.innerText = data.order_id;
      phoneNumber.innerText = data.phone_number;
      otpCode.innerText = data.otp || "Waiting...";

      const orderDate = new Date(data.created_at).toLocaleTimeString();
      orderTimestamp.innerHTML = `<i class="fa-regular fa-clock"></i> ${orderDate}`;

      buySection.classList.add("hidden");
      if (historySection) historySection.classList.add("hidden");
      orderCard.classList.remove("hidden");

      if (data.status === "Canceled & Refunded" || data.status === "Canceled") {
        if (orderStatusText) {
          orderStatusText.innerText = "Canceled & Refunded";
          orderStatusText.className = "text-rose-600 font-bold text-base mt-1";
        }
        btnCancelOrder.disabled = true;
        btnCancelOrder.className =
          "bg-slate-100 text-slate-400 border border-slate-200 font-medium py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-60";
        liveStatusText.innerText = "Order is cancelled";
      } else if (data.otp && data.otp !== "Waiting...") {
        if (orderStatusText) {
          orderStatusText.innerText = "OTP Received";
          orderStatusText.className =
            "text-emerald-600 font-bold text-base mt-1";
        }
        btnCancelOrder.disabled = true;
        btnCancelOrder.className =
          "bg-slate-100 text-slate-400 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-60";
        liveStatusText.innerText = "OTP received successfully!";
      } else {
        if (orderStatusText) {
          orderStatusText.innerText = "Confirmed";
          orderStatusText.className =
            "text-emerald-600 font-bold text-base mt-1";
        }
        btnCancelOrder.disabled = false;
        btnCancelOrder.className =
          "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-medium py-3 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer";
        startAutoPolling();
      }

      showToast(`Loaded Order #${data.order_id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } catch (err) {
    showToast("Could not load order details.", true);
  }
}

function copyText(elementId) {
  const text = document.getElementById(elementId).innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied to clipboard: ${text}`);
  });
}

function showToast(message, isError = false) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-2xl text-white text-xs font-extrabold transition-all duration-300 transform translate-y-4 opacity-0 ${
    isError
      ? "bg-rose-600 shadow-rose-600/40 border border-rose-500"
      : "bg-slate-900 border border-slate-800 shadow-slate-950/50"
  }`;

  toast.innerHTML = `
    <i class="fa-solid ${isError ? "fa-circle-exclamation text-rose-200" : "fa-circle-check text-emerald-400"} text-base"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("translate-y-4", "opacity-0");
  }, 10);

  setTimeout(() => {
    toast.classList.add("translate-y-4", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

window.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("nexaUser");
  if (savedUser) {
    loggedInUser = JSON.parse(savedUser);
    initUserSession();
  }
});

let smartPollingInterval = null;
let lastKnownLogId = null;

function startSmartActivityPolling() {
  if (smartPollingInterval) clearInterval(smartPollingInterval);
  lastKnownLogId = null;
  checkForNewActivity();
  smartPollingInterval = setInterval(async () => {
    await checkForNewActivity();
  }, 4000);
}

function stopSmartActivityPolling() {
  if (smartPollingInterval) {
    clearInterval(smartPollingInterval);
    smartPollingInterval = null;
  }
}

async function checkForNewActivity() {
  if (!_supabase) return;
  const { data } = await _supabase
    .from("system_logs")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const latestId = data[0].id;
    if (lastKnownLogId === null) {
      lastKnownLogId = latestId;
      fetchGlobalActivityLog();
    } else if (latestId !== lastKnownLogId) {
      lastKnownLogId = latestId;
      fetchGlobalActivityLog();
    }
  }
}

// === ৪. FETCH GLOBAL ACTIVITY LOG (Updated to Support Canada Activities) ===
async function fetchGlobalActivityLog() {
  const container = document.getElementById("globalActivityLog");
  if (!container || !_supabase) return;

  const { data } = await _supabase
    .from("system_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (data && data.length > 0) {
    data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    container.innerHTML = "";
    data.forEach((item, index) => {
      const fullEmail = item.user_email || "user@unknown.com";
      const timeStr = new Date(item.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      let badge = "";
      let actionText = "";

      if (item.action_type === "CANCELED") {
        badge = `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">CANCELED</span>`;
        actionText = `canceled order <span class="text-slate-300">#${item.order_id || ""}</span> (${item.phone_number || ""})`;
      } else if (item.action_type === "OTP_RECEIVED") {
        badge = `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">OTP RECEIVED</span>`;
        actionText = `received OTP <span class="text-emerald-300 font-bold">[${item.otp_code}]</span> for <span class="text-slate-300">${item.phone_number || ""}</span>`;
      }
      // 🇨🇦 ক্যানাডা স্টক অ্যাক্টিভিটি ব্যাজ ও টেক্সট ডিজাইন
      else if (item.action_type === "CANADA_NEW_ORDER") {
        badge = `<span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold">CANADA ORDER</span>`;
        actionText = `purchased Canada stock number <span class="text-slate-300">${item.phone_number || ""}</span> (#${item.order_id || ""})`;
      } else if (item.action_type === "CANADA_CANCELED") {
        badge = `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">CANADA CANCELED</span>`;
        actionText = `canceled Canada order <span class="text-slate-300">#${item.order_id || ""}</span> (${item.phone_number || ""})`;
      } else if (item.action_type === "CANADA_SUCCESS") {
        badge = `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">CANADA SUCCESS</span>`;
        actionText = `marked Canada order <span class="text-slate-300">#${item.order_id || ""}</span> as success (${item.phone_number || ""})`;
      } else {
        badge = `<span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold">NEW ORDER</span>`;
        actionText = `purchased WhatsApp number <span class="text-slate-300">${item.phone_number || ""}</span>`;
      }

      const logRow = document.createElement("div");
      logRow.style.animationDelay = `${index * 20}ms`;
      logRow.className =
        "flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 hover:border-slate-700 transition-all duration-300 animate-slideUp";
      logRow.innerHTML = `
        <div class="flex items-center gap-2.5">
          ${badge}
          <span class="text-slate-400 font-bold">${fullEmail}</span>
          <span class="text-slate-300">${actionText}</span>
        </div>
        <span class="text-[11px] text-slate-500 font-semibold">${timeStr}</span>
      `;
      container.appendChild(logRow);
    });
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  } else {
    container.innerHTML = `<div class="text-slate-500 italic py-2">No platform activity recorded yet.</div>`;
  }
}
// === LOAD ALL USERS REPORT SHEET (Total Spent = Numbers Bought * 0.12$) ===
async function loadAllUserReportSheet() {
  if (!_supabase) return;
  const todayStr = new Date().toISOString().split("T")[0];
  const topWinnerCard = document.getElementById("topWinnerCard");
  const otherUsersList = document.getElementById("otherUsersList");
  if (!topWinnerCard || !otherUsersList) return;

  const { data: usersData } = await _supabase
    .from("user_profiles")
    .select("email");

  const { data: canadaOrdersData } = await _supabase
    .from("canada_orders")
    .select("*")
    .gte("created_at", todayStr);

  if (usersData && usersData.length > 0) {
    const userReports = usersData.map((user) => {
      const userCanadaOrders = canadaOrdersData
        ? canadaOrdersData.filter((o) => o.user_email === user.email)
        : [];

      let bought = userCanadaOrders.filter(
        (o) => !o.status || !o.status.toLowerCase().includes("cancel"),
      ).length;
      let otps = userCanadaOrders.filter(
        (o) => o.status && o.status.toLowerCase().includes("success"),
      ).length;
      let canceled = userCanadaOrders.filter(
        (o) => o.status && o.status.toLowerCase().includes("cancel"),
      ).length;

      // 🟢 Numbers Bought কে 0.12$ দিয়ে গুণ করে Total Spent হিসাব করা হলো
      let investment = bought * 0.12;

      return { email: user.email, bought, otps, canceled, investment };
    });

    userReports.sort((a, b) => b.bought - a.bought || b.otps - a.otps);
    const firstUser = userReports[0];
    const otherUsers = userReports.slice(1);

    if (firstUser && firstUser.bought > 0) {
      topWinnerCard.classList.remove("hidden");
      topWinnerCard.innerHTML = `
        <div class="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-amber-500/40 relative overflow-hidden flex flex-col items-center text-center">
          <div class="absolute -right-10 -top-10 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl"></div>
          <div class="relative mb-3 flex items-center justify-center">
            <div class="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/40 animate-bounce border-2 border-white">
              <span>1</span>
            </div>
            <i class="fa-solid fa-star text-amber-400 text-xs absolute -bottom-1 bg-slate-950 rounded-full p-0.5 border border-amber-400"></i>
          </div>
          <span class="text-[11px] uppercase tracking-widest text-amber-400 font-extrabold mt-1 mb-1 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            <i class="fa-solid fa-crown mr-1 text-amber-400"></i> Top Performer of Today (Canada Stock)
          </span>
          <h2 class="text-xl sm:text-2xl font-black text-white mb-2">${firstUser.email}</h2>
          <button onclick="openUserLifetimeModal('${firstUser.email}')" class="mb-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5">
            <i class="fa-solid fa-eye"></i> View Lifetime History
          </button>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 w-full max-w-xl mt-2 pt-4 border-t border-slate-800/80 text-xs">
            <div class="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
              <span class="text-slate-400 block mb-1 font-medium">Numbers Bought</span>
              <span class="text-blue-400 font-black text-base">${firstUser.bought}</span>
            </div>
            <div class="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
              <span class="text-slate-400 block mb-1 font-medium">Success Completed</span>
              <span class="text-emerald-400 font-black text-base">${firstUser.otps}</span>
            </div>
            <div class="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
              <span class="text-slate-400 block mb-1 font-medium">Canceled</span>
              <span class="text-rose-400 font-black text-base">${firstUser.canceled}</span>
            </div>
            <div class="bg-slate-950/60 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
              <span class="text-amber-300 block mb-1 font-medium">Total Spent</span>
              <span class="text-amber-400 font-black text-base">$${firstUser.investment.toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      topWinnerCard.classList.add("hidden");
    }

    otherUsersList.innerHTML = "";
    if (otherUsers.length > 0) {
      otherUsers.forEach((user, index) => {
        const rank = index + 2;
        const row = document.createElement("div");
        row.className =
          "flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100/80 p-4 rounded-2xl border border-slate-200/60 transition";
        row.innerHTML = `
          <div class="flex items-center gap-3.5">
            <span class="w-9 h-9 rounded-xl bg-slate-200/80 text-slate-700 font-black text-xs flex items-center justify-center font-mono shadow-sm">#${rank}</span>
            <div>
              <h4 class="text-sm font-bold text-slate-900">${user.email}</h4>
              <p class="text-[11px] text-slate-500 font-medium mt-0.5">Bought: <span class="text-blue-600 font-bold">${user.bought}</span> | Success: <span class="text-emerald-600 font-bold">${user.otps}</span> | Canceled: <span class="text-rose-600 font-bold">${user.canceled}</span></p>
            </div>
          </div>
          <div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 pt-2 sm:pt-0 border-slate-200">
            <button onclick="openUserLifetimeModal('${user.email}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1">
              <i class="fa-solid fa-eye"></i> View Report
            </button>
            <span class="text-sm font-black text-amber-600 font-mono">$${user.investment.toFixed(2)}</span>
          </div>
        `;
        otherUsersList.appendChild(row);
      });
    } else {
      otherUsersList.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm">No other performers for today.</div>`;
    }
  } else {
    otherUsersList.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm">No users found.</div>`;
  }
}

// === OPEN LIFETIME MODAL (Total Spent = Bought * 0.12$) ===
async function openUserLifetimeModal(targetEmail) {
  const modal = document.getElementById("userLifetimeModal");
  const modalEmail = document.getElementById("modalUserEmail");
  const tbody = document.getElementById("userLifetimeTableBody");

  if (modal) modal.classList.remove("hidden");
  if (modalEmail) modalEmail.innerText = `Report for: ${targetEmail}`;
  if (!tbody || !_supabase) return;

  tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">Loading user history...</td></tr>`;

  const { data: caData } = await _supabase
    .from("canada_orders")
    .select("*")
    .eq("user_email", targetEmail);

  if (caData && caData.length > 0) {
    const grouped = {};
    caData.forEach((order) => {
      const dateStr = new Date(order.created_at).toISOString().split("T")[0];
      if (!grouped[dateStr])
        grouped[dateStr] = { bought: 0, otps: 0, canceled: 0 };

      const status = (order.status || "").toLowerCase();
      if (status.includes("cancel")) {
        grouped[dateStr].canceled += 1;
      } else {
        grouped[dateStr].bought += 1;
        if (status.includes("success")) {
          grouped[dateStr].otps += 1;
        }
      }
    });

    tbody.innerHTML = "";
    Object.keys(grouped)
      .sort()
      .reverse()
      .forEach((date) => {
        const info = grouped[date];
        // 🟢 Lifetime মডালেও Numbers Bought * 0.12$ হিসাব করা হলো
        const inv = info.bought * 0.12;
        const row = document.createElement("tr");
        row.className = "hover:bg-slate-50 transition";
        row.innerHTML = `
        <td class="py-3 px-4 font-mono text-xs font-bold text-slate-800">${date}</td>
        <td class="py-3 px-4 text-blue-600 font-bold">${info.bought}</td>
        <td class="py-3 px-4 text-emerald-600 font-bold">${info.otps}</td>
        <td class="py-3 px-4 text-rose-600 font-bold">${info.canceled}</td>
        <td class="py-3 px-4 text-amber-600 font-bold">$${inv.toFixed(2)}</td>
      `;
        tbody.appendChild(row);
      });
  } else {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">No activity history found for this user.</td></tr>`;
  }
}

function closeUserLifetimeModal() {
  const modal = document.getElementById("userLifetimeModal");
  if (modal) modal.classList.add("hidden");
}

// ১. F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U ব্লক করা
document.addEventListener("keydown", function (e) {
  if (
    e.key === "F12" ||
    (e.ctrlKey &&
      e.shiftKey &&
      (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j")) ||
    (e.ctrlKey && (e.key === "U" || e.key === "u"))
  ) {
    e.preventDefault();
    return false;
  }
});

// ২. মাউসের রাইট-ক্লিক (Context Menu) ব্লক করা
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
});

let parsedBulkData = [];

// === HANDLE EXCEL/CSV SHEET UPLOAD ===
function handleSheetUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileNameEl = document.getElementById("selectedFileName");
  if (fileNameEl) fileNameEl.innerText = file.name;

  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    parsedBulkData = [];
    jsonData.forEach((row) => {
      if (row && row.length >= 2) {
        const num = String(row[0] || "").trim();
        const link = String(row[1] || "").trim();
        if (
          num &&
          link &&
          !num.toLowerCase().includes("number") &&
          !num.toLowerCase().includes("phone")
        ) {
          parsedBulkData.push({ phone_number: num, link: link });
        }
      }
    });

    // Reset text input when sheet is uploaded
    const bulkInput = document.getElementById("bulkNumberInput");
    if (bulkInput) bulkInput.value = "";

    renderParsedPreview();
  };

  reader.readAsArrayBuffer(file);
}

// === HANDLE MANUAL BULK INPUT CHANGE (Supports Space, Tab & Comma) ===
document
  .getElementById("bulkNumberInput")
  ?.addEventListener("input", function () {
    const text = this.value.trim();
    const sheetInput = document.getElementById("sheetFileInput");

    if (!text) {
      if (!sheetInput || !sheetInput.files || !sheetInput.files.length) {
        parsedBulkData = [];
        renderParsedPreview();
      }
      return;
    }

    const lines = text.split("\n");
    parsedBulkData = [];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      let parts = [];
      if (trimmedLine.includes(",")) {
        parts = trimmedLine.split(",");
      } else {
        parts = trimmedLine.split(/\s+/); // Splits by space, tab, or multiple whitespaces
      }

      if (parts.length >= 2) {
        const num = parts[0].trim();
        const link = parts.slice(1).join(" ").trim();
        if (num && link) {
          parsedBulkData.push({ phone_number: num, link: link });
        }
      }
    });

    renderParsedPreview();
  });

// === RENDER PREVIEW TABLE ===
function renderParsedPreview() {
  const previewSection = document.getElementById("parsedPreviewSection");
  const tbody = document.getElementById("parsedPreviewTableBody");
  const badge = document.getElementById("parsedCountBadge");

  if (badge) badge.innerText = `Total Items: ${parsedBulkData.length}`;

  if (parsedBulkData.length > 0) {
    if (previewSection) previewSection.classList.remove("hidden");
    if (tbody) {
      tbody.innerHTML = "";
      parsedBulkData.forEach((item, index) => {
        const row = document.createElement("tr");
        row.className = "hover:bg-slate-50 transition";
        row.innerHTML = `
          <td class="py-2 px-3 text-slate-400 font-mono">${index + 1}</td>
          <td class="py-2 px-3 font-bold text-slate-800 font-mono">${item.phone_number}</td>
          <td class="py-2 px-3 text-blue-600 truncate max-w-xs font-mono">${item.link}</td>
        `;
        tbody.appendChild(row);
      });
    }
  } else {
    if (previewSection) previewSection.classList.add("hidden");
  }
}

// === SAVE BULK NUMBERS TO SUPABASE DATABASE ===
async function submitBulkWhatsAppNumbers() {
  if (parsedBulkData.length === 0) {
    showToast(
      "Please upload an Excel sheet or paste valid numbers & links!",
      true,
    );
    return;
  }

  if (!_supabase) return;

  showToast(`Uploading ${parsedBulkData.length} entries to database...`);

  // Map entries for Supabase table
  const insertPayload = parsedBulkData.map((item) => ({
    phone_number: item.phone_number,
    link: item.link,
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await _supabase
    .from("whatsapp_numbers")
    .insert(insertPayload);

  if (!error) {
    showToast(`Successfully saved ${parsedBulkData.length} WhatsApp numbers!`);
    parsedBulkData = [];

    const bulkInput = document.getElementById("bulkNumberInput");
    const sheetInput = document.getElementById("sheetFileInput");
    const fileNameEl = document.getElementById("selectedFileName");

    if (bulkInput) bulkInput.value = "";
    if (sheetInput) sheetInput.value = "";
    if (fileNameEl) fileNameEl.innerText = "No file chosen";

    renderParsedPreview();
  } else {
    showToast("Error saving numbers: " + error.message, true);
  }
}

// === ১. BUY CANADA NUMBER (Added System Log for Live Feed) ===
async function buyCanadaNumber() {
  if (!_supabase || !loggedInUser) return;

  const btnTrigger = document.getElementById("btnTriggerBuyCanada");
  if (btnTrigger) {
    btnTrigger.disabled = true;
    btnTrigger.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Securing Number...`;
  }

  try {
    const { data: profile } = await _supabase
      .from("user_profiles")
      .select("daily_limit")
      .eq("email", loggedInUser.email)
      .single();

    let currentLimit = profile ? profile.daily_limit : 0;
    if (currentLimit <= 0) {
      showToast("Daily limit reached! You cannot buy more numbers.", true);
      return;
    }

    const { data: availableStock, error: fetchErr } = await _supabase
      .from("whatsapp_numbers")
      .select("*")
      .is("assigned_to", null);

    if (fetchErr || !availableStock || availableStock.length === 0) {
      showToast("No Canada numbers available in stock right now!", true);
      return;
    }

    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    const currentUserEmail = loggedInUser.email.trim().toLowerCase();

    let userFilteredStock = availableStock.filter((item) => {
      if (!item.last_assigned_to || !item.last_assigned_at) return true;
      const isSameUser =
        item.last_assigned_to.trim().toLowerCase() === currentUserEmail;
      if (!isSameUser) return true;
      const lastTime = new Date(item.last_assigned_at).getTime();
      return lastTime < thirtyMinutesAgo;
    });

    if (userFilteredStock.length === 0) {
      showToast(
        "Cooldown active! You must wait 30 minutes before taking this number again.",
        true,
      );
      return;
    }

    let assignedStock = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (userFilteredStock.length === 0) break;
      const randomIndex = Math.floor(Math.random() * userFilteredStock.length);
      const randomStockNum = userFilteredStock[randomIndex];
      const dhakaTime = new Date().toISOString();

      const { data: updatedData, error: updateErr } = await _supabase
        .from("whatsapp_numbers")
        .update({
          assigned_to: loggedInUser.email,
          last_assigned_to: loggedInUser.email,
          last_assigned_at: dhakaTime,
        })
        .eq("id", randomStockNum.id)
        .is("assigned_to", null)
        .select();

      if (!updateErr && updatedData && updatedData.length > 0) {
        assignedStock = randomStockNum;
        break;
      } else {
        userFilteredStock.splice(randomIndex, 1);
      }
    }

    if (!assignedStock) {
      showToast("Could not secure a unique number. Please try again!", true);
      return;
    }

    const cadOrderId = "CAD-" + Math.floor(100000 + Math.random() * 900000);
    const phoneNumberStr = assignedStock.phone_number;
    const stockLinkStr = assignedStock.link || "https://sms.elitetrick.com/";
    const dhakaTimeIns = new Date().toISOString();

    // Insert into canada_orders
    await _supabase.from("canada_orders").insert([
      {
        order_id: String(cadOrderId),
        phone_number: phoneNumberStr,
        otp: stockLinkStr,
        status: "Confirmed",
        user_email: loggedInUser.email,
        created_at: dhakaTimeIns,
      },
    ]);

    // 🟢 লাইভ ফিডে দেখানোর জন্য system_logs এ রেকর্ড করা হলো
    await recordSystemLog(
      loggedInUser.email,
      "CANADA_NEW_ORDER",
      String(cadOrderId),
      phoneNumberStr,
    );

    let newLimit = currentLimit - 1;
    if (newLimit < 0) newLimit = 0;

    await _supabase
      .from("user_profiles")
      .update({ daily_limit: newLimit })
      .eq("email", loggedInUser.email);

    currentUserDailyLimit = newLimit;
    if (typeof updateUserLimitSidebar === "function") updateUserLimitSidebar();

    document.getElementById("canadaOrderTitle").innerText =
      `Canada Order #${cadOrderId}`;
    document.getElementById("canadaActivationId").innerText = cadOrderId;
    document.getElementById("canadaPhoneNumber").innerText = phoneNumberStr;
    document.getElementById("canadaOtpCode").innerText = stockLinkStr;
    document.getElementById("canadaOrderStatusText").innerText =
      "Confirmed (Stock)";

    const cancelBtn = document.getElementById("canadaBtnCancelOrder");
    const successBtn = document.getElementById("canadaBtnSuccessOrder");

    if (cancelBtn) {
      cancelBtn.disabled = false;
      cancelBtn.setAttribute(
        "onclick",
        `cancelCanadaActiveOrder('${cadOrderId}')`,
      );
      cancelBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }
    if (successBtn) {
      successBtn.disabled = false;
      successBtn.setAttribute(
        "onclick",
        `completeCanadaActiveOrder('${cadOrderId}')`,
      );
      successBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }

    document.getElementById("canadaBuySection").classList.add("hidden");
    document.getElementById("canadaOrderCard").classList.remove("hidden");

    const canadaHistorySection = document.getElementById(
      "canadaHistorySection",
    );
    if (canadaHistorySection) canadaHistorySection.classList.add("hidden");

    showToast("Canada Number secured successfully!");
    if (typeof fetchDashboardStats === "function") fetchDashboardStats();
  } catch (e) {
    console.error("Canada buy error:", e);
    showToast("Error acquiring Canada number: " + e.message, true);
  } finally {
    if (btnTrigger) {
      btnTrigger.disabled = false;
      btnTrigger.innerHTML = `<i class="fa-solid fa-cart-shopping text-sm"></i> Buy Canada Number`;
    }
  }
}

// === ২. CANCEL CANADA ORDER (Added System Log) ===
async function cancelCanadaActiveOrder(specificId) {
  const orderId =
    specificId || document.getElementById("canadaActivationId").innerText;
  if (!orderId || orderId === "-") return;

  if (
    !confirm(
      "Are you sure you want to cancel this Canada order? The number will return to stock and your limit will be restored.",
    )
  )
    return;

  showToast("Canceling Canada order & returning stock...");

  try {
    const cleanId = String(orderId).replace("#", "").trim();

    const { data: orderData } = await _supabase
      .from("canada_orders")
      .select("phone_number")
      .eq("order_id", cleanId)
      .maybeSingle();

    if (orderData && orderData.phone_number) {
      await _supabase
        .from("whatsapp_numbers")
        .update({ assigned_to: null })
        .eq("phone_number", orderData.phone_number);
    }

    await _supabase
      .from("canada_orders")
      .update({ status: "Canceled & Refunded" })
      .eq("order_id", cleanId);

    // 🟢 লাইভ ফিডের জন্য লগ করা
    await recordSystemLog(
      loggedInUser.email,
      "CANADA_CANCELED",
      cleanId,
      orderData ? orderData.phone_number : "",
    );

    const { data: profile } = await _supabase
      .from("user_profiles")
      .select("daily_limit")
      .eq("email", loggedInUser.email)
      .single();

    let restoredLimit = (profile ? profile.daily_limit : 0) + 1;
    await _supabase
      .from("user_profiles")
      .update({ daily_limit: restoredLimit })
      .eq("email", loggedInUser.email);

    currentUserDailyLimit = restoredLimit;
    if (typeof updateUserLimitSidebar === "function") updateUserLimitSidebar();

    showToast("Canada order canceled & refunded successfully!");
    if (typeof fetchDashboardStats === "function") fetchDashboardStats();

    setTimeout(() => {
      if (typeof resetCanadaBuyView === "function") resetCanadaBuyView();
    }, 1500);
  } catch (e) {
    console.error("Cancel Canada error:", e);
    showToast("Error canceling Canada order: " + e.message, true);
  }
}
// === MARK CANADA ORDER AS SUCCESS ===
async function completeCanadaActiveOrder(specificId) {
  const orderId =
    specificId || document.getElementById("canadaActivationId").innerText;
  if (!orderId || orderId === "-") return;

  if (
    !confirm(
      "Are you sure you want to mark this Canada order/account as Success?",
    )
  )
    return;

  showToast("Updating order status to Success...");

  try {
    const cleanId = String(orderId).replace("#", "").trim();

    // 1. Update status in 'canada_orders' table to Success
    await _supabase
      .from("canada_orders")
      .update({ status: "Success" })
      .eq("order_id", cleanId);

    // 2. Update UI Status text
    const statusEl = document.getElementById("canadaOrderStatusText");
    if (statusEl) {
      statusEl.innerText = "Success (Completed)";
      statusEl.className = "text-emerald-600 font-bold text-base mt-1";
    }

    // 3. Disable both buttons so they cannot be clicked again
    const cancelBtn = document.getElementById("canadaBtnCancelOrder");
    const successBtn = document.getElementById("canadaBtnSuccessOrder");

    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.classList.add(
        "opacity-50",
        "cursor-not-allowed",
        "bg-gray-100",
      );
      cancelBtn.classList.remove("hover:bg-rose-100", "cursor-pointer");
    }

    if (successBtn) {
      successBtn.disabled = true;
      successBtn.classList.add(
        "opacity-50",
        "cursor-not-allowed",
        "bg-emerald-400",
      );
      successBtn.classList.remove("hover:bg-emerald-700", "cursor-pointer");
    }

    showToast("Canada order marked as Success successfully!");

    // ১.৫ সেকেন্ড পর অটো রিসেট হয়ে বাই স্ক্রিন ও হিস্ট্রি টেবিলে ফিরে যাবে
    setTimeout(() => {
      if (typeof resetCanadaBuyView === "function") {
        resetCanadaBuyView();
      }
    }, 1500);
  } catch (e) {
    console.error("Success Canada error:", e);
    showToast("Error updating Canada order: " + e.message, true);
  }
}
// === FETCH CANADA HISTORY (Newest/Latest order always at the top based on Serial/ID) ===
async function fetchCanadaHistory() {
  if (!_supabase || !loggedInUser) return;

  try {
    // 🟢 আইডি (id) অথবা সিরিয়াল অনুযায়ী ডিসেন্ডিং অর্ডারে ফেচ করা, যাতে নতুন অর্ডার সবার উপরে থাকে
    const { data, error } = await _supabase
      .from("canada_orders")
      .select("*")
      .eq("user_email", loggedInUser.email)
      .order("id", { ascending: false }); // অথবা .order("created_at", { ascending: false })

    if (error) throw error;

    const tbody = document.getElementById("canadaHistoryTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 font-normal">No Canada history found.</td></tr>`;
      return;
    }

    data.forEach((order) => {
      let statusBadge = "";
      if (order.status && order.status.toLowerCase().includes("cancel")) {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100 whitespace-nowrap">
                        <i class="fa-solid fa-circle-xmark mr-1"></i> Canceled & Refunded
                      </span>`;
      } else if (
        order.status &&
        order.status.toLowerCase().includes("success")
      ) {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 whitespace-nowrap">
                        <i class="fa-solid fa-circle-check mr-1"></i> Success (Completed)
                      </span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 whitespace-nowrap">
                        <i class="fa-solid fa-circle-check mr-1"></i> ${order.status}
                      </span>`;
      }

      const row = `
        <tr class="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
          <td class="py-3.5 px-4 text-blue-600 font-bold">#${order.order_id}</td>
          <td class="py-3.5 px-4 text-slate-700 font-semibold">${order.phone_number || "-"}</td>
          <td class="py-3.5 px-4 max-w-[200px] truncate">
            <a href="${order.otp}" target="_blank" class="text-blue-500 hover:text-blue-700 hover:underline text-xs bg-blue-50 px-2 py-1 rounded border border-blue-100 inline-block truncate max-w-full">
              ${order.otp || "-"}
            </a>
          </td>
          <td class="py-3.5 px-4">${statusBadge}</td>
          <td class="py-3.5 px-4 text-center">
            <button onclick="viewCanadaOrder('${order.order_id}')" class="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1">
              <i class="fa-solid fa-eye"></i> View
            </button>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } catch (e) {
    console.error("Error fetching Canada history:", e);
  }
}

// === VIEW CANADA ORDER FROM HISTORY ===
async function viewCanadaOrder(orderId) {
  if (!_supabase) return;

  try {
    const cleanId = String(orderId).replace("#", "").trim();
    const { data: order, error } = await _supabase
      .from("canada_orders")
      .select("*")
      .eq("order_id", cleanId)
      .single();

    if (error || !order) {
      showToast("Order details not found!", true);
      return;
    }

    document.getElementById("canadaOrderTitle").innerText =
      `Canada Order #${order.order_id}`;
    document.getElementById("canadaActivationId").innerText = order.order_id;
    document.getElementById("canadaPhoneNumber").innerText =
      order.phone_number || "-";
    document.getElementById("canadaOtpCode").innerText = order.otp || "-";

    // 🟢 এই সেই কোডটি, যা আপনি ওপরের অংশে দিয়েছেন:
    const statusEl = document.getElementById("canadaOrderStatusText");
    const cancelBtn = document.getElementById("canadaBtnCancelOrder");
    const successBtn = document.getElementById("canadaBtnSuccessOrder");

    statusEl.innerText = order.status;

    if (
      order.status &&
      (order.status.toLowerCase().includes("cancel") ||
        order.status.toLowerCase().includes("success"))
    ) {
      statusEl.className = order.status.toLowerCase().includes("success")
        ? "text-emerald-600 font-bold text-base mt-1"
        : "text-rose-600 font-bold text-base mt-1";

      // দুটি বাটনই ডিজেবল হয়ে যাবে যদি অলরেডি প্রসেসড হয়ে থাকে
      if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.classList.add("opacity-50", "cursor-not-allowed");
      }
      if (successBtn) {
        successBtn.disabled = true;
        successBtn.classList.add("opacity-50", "cursor-not-allowed");
      }
    } else {
      statusEl.className = "text-emerald-600 font-bold text-base mt-1";
      if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.setAttribute(
          "onclick",
          `cancelCanadaActiveOrder('${order.order_id}')`,
        );
        cancelBtn.classList.remove("opacity-50", "cursor-not-allowed");
      }
      if (successBtn) {
        successBtn.disabled = false;
        successBtn.setAttribute(
          "onclick",
          `completeCanadaActiveOrder('${order.order_id}')`,
        );
        successBtn.classList.remove("opacity-50", "cursor-not-allowed");
      }
    }
    // ----------------------------------------------------

    document.getElementById("canadaBuySection").classList.add("hidden");
    document.getElementById("canadaOrderCard").classList.remove("hidden");

    const canadaHistorySection = document.getElementById(
      "canadaHistorySection",
    );
    if (canadaHistorySection) canadaHistorySection.classList.add("hidden");
  } catch (e) {
    console.error("View order error:", e);
  }
}

// === 3. RESET CANADA BUY VIEW (Restores history section when clicking New Order) ===
function resetCanadaBuyView() {
  document.getElementById("canadaOrderCard").classList.add("hidden");
  document.getElementById("canadaBuySection").classList.remove("hidden");

  // 🟢 রিসেট বা New Order-এ ক্লিক করলে হিস্ট্রি সেকশন আবার শো করবে
  const canadaHistorySection = document.getElementById("canadaHistorySection");
  if (canadaHistorySection) canadaHistorySection.classList.remove("hidden");
  if (typeof fetchCanadaHistory === "function") fetchCanadaHistory();
}


// === FETCH AVAILABLE CANADA STOCK COUNT FOR SIDEBAR ===
async function updateCanadaStockBadge() {
  if (!_supabase) return;

  try {
    // whatsapp_numbers টেবিল থেকে যেগুলোর assigned_to ফাঁকা (null), তাদের কাউন্ট নেওয়া
    const { count, error } = await _supabase
      .from("whatsapp_numbers")
      .select("*", { count: "exact", head: true })
      .is("assigned_to", null);

    if (error) throw error;

    const badgeEl = document.getElementById("canadaStockBadge");
    if (badgeEl) {
      badgeEl.innerText = `${count !== null ? count : 0} Stock`;
    }
  } catch (e) {
    console.error("Error fetching stock count:", e);
  }
}

// 🟢 পেজ লোড হওয়ার পর এবং ড্যাশবোর্ড সুইচ করার সময় স্টক কাউন্ট রিয়েল-টাইম আপডেট হবে
window.addEventListener("DOMContentLoaded", () => {
  updateCanadaStockBadge();
  // প্রতি ৩০ সেকেন্ড পর পর অটো স্টক কাউন্ট রিফ্রেশ হবে
  setInterval(updateCanadaStockBadge, 30000);
});