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
    if (sidebarBalance) sidebarBalance.innerText = `$${balanceVal}`;
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
    loadAdminUpdateSettings();
  }
}

// === USER SPECIFIC DASHBOARD STATS (Not Work = Today Order - Success Number) ===
async function fetchDashboardStats() {
  if (!_supabase || !loggedInUser) return;
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. WhatsApp Stats Fetch
  const { data: waData } = await _supabase
    .from("orders")
    .select("*")
    .eq("user_email", loggedInUser.email)
    .gte("created_at", todayStr);

  if (waData) {
    let boughtCount = waData.length;
    let otpCount = waData.filter(
      (o) => o.otp && o.otp !== "Waiting..." && o.otp !== "N/A",
    ).length;
    let canceledCount = waData.filter(
      (o) => o.status === "Canceled & Refunded" || o.status === "Canceled",
    ).length;
    let totalSpent = otpCount * 20;

    const statBought = document.getElementById("statBought");
    const statOtp = document.getElementById("statOtp");
    const statCanceled = document.getElementById("statCanceled");
    const statInvestment = document.getElementById("statInvestment");

    if (statBought) statBought.innerText = boughtCount;
    if (statOtp) statOtp.innerText = otpCount;
    if (statCanceled) statCanceled.innerText = canceledCount;
    if (statInvestment) statInvestment.innerText = `৳${totalSpent.toFixed(2)}`;
  }

  // 2. 🇨🇦 Canada Stock Stats Fetch
  const { data: caData } = await _supabase
    .from("canada_orders")
    .select("*")
    .eq("user_email", loggedInUser.email)
    .gte("created_at", todayStr);

  if (caData) {
    // ১. Today Order Number = আজকে মোট যতগুলো অর্ডার হয়েছে
    let caTodayOrder = caData.length;

    // ২. Success Number = যেগুলোর স্ট্যাটাস "Success"
    let caSuccess = caData.filter(
      (o) => o.status && o.status.toLowerCase().includes("success"),
    ).length;

    // ৩. Not Work Number = Today Order Number - Success Number
    let caNotWork = caTodayOrder - caSuccess;
    if (caNotWork < 0) caNotWork = 0;

    // ৪. Total Spent = Success Number * 0.12$
    let caSpent = caSuccess * 0.12;

    const statCanadaTodayOrder = document.getElementById(
      "statCanadaTodayOrder",
    );
    const statCanadaSuccess = document.getElementById("statCanadaSuccess");
    const statCanadaNotWork = document.getElementById("statCanadaNotWork");
    const statCanadaSpent = document.getElementById("statCanadaSpent");

    if (statCanadaTodayOrder) statCanadaTodayOrder.innerText = caTodayOrder;
    if (statCanadaSuccess) statCanadaSuccess.innerText = caSuccess;
    if (statCanadaNotWork) statCanadaNotWork.innerText = caNotWork;
    if (statCanadaSpent) statCanadaSpent.innerText = `$${caSpent.toFixed(2)}`;
  }

  if (typeof updateUserLimitSidebar === "function") {
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

// === FETCH GLOBAL ACTIVITY LOG (Shows all activities with masked phone numbers) ===
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

      // 🟢 নাম্বারের মাঝখানে **** বসিয়ে মাস্কিং করা হলো
      const maskedPhone = maskPhoneNumber(item.phone_number);

      let badge = "";
      let actionText = "";

      if (item.action_type === "CANADA_SUCCESS") {
        badge = `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">CANADA SUCCESS</span>`;
        actionText = `successfully completed Canada order <span class="text-slate-300">#${item.order_id || ""}</span> (${maskedPhone})`;
      } else if (item.action_type === "CANADA_CANCELED") {
        badge = `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">CANADA CANCELED</span>`;
        actionText = `canceled Canada order <span class="text-slate-300">#${item.order_id || ""}</span> (${maskedPhone})`;
      } else if (item.action_type === "CANADA_NEW_ORDER") {
        badge = `<span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold">CANADA ORDER</span>`;
        actionText = `purchased Canada number <span class="text-slate-300">${maskedPhone}</span> (#${item.order_id || ""})`;
      } else {
        badge = `<span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold">ACTIVITY</span>`;
        actionText = `performed action for <span class="text-slate-300">${maskedPhone}</span>`;
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
async function loadAllUserReportSheet() {
  if (!_supabase) return;
  const todayStr = new Date().toISOString().split("T")[0];
  const topWinnerCard = document.getElementById("topWinnerCard");
  const otherUsersList = document.getElementById("otherUsersList");
  if (!otherUsersList) return;

  if (topWinnerCard) {
    topWinnerCard.classList.add("hidden");
    topWinnerCard.innerHTML = "";
  }

  const { data: usersData } = await _supabase
    .from("user_profiles")
    .select("email");

  const { data: canadaOrdersData } = await _supabase
    .from("canada_orders")
    .select("*")
    .gte("created_at", todayStr);

  // 🟢 সমস্ত ইউজারের আজকের টোটাল কাউন্ট হিসাব করার জন্য ভ্যারিয়েবল
  let globalTotalOrder = 0;
  let globalTotalSuccess = 0;
  let globalTotalNotWork = 0;
  let globalTotalSpent = 0;

  if (usersData && usersData.length > 0) {
    const userReports = usersData.map((user) => {
      const userCanadaOrders = canadaOrdersData
        ? canadaOrdersData.filter((o) => o.user_email === user.email)
        : [];

      let totalOrder = userCanadaOrders.length;
      let successCount = userCanadaOrders.filter(
        (o) => o.status && o.status.toLowerCase().includes("success"),
      ).length;
      let notWork = totalOrder - successCount;
      if (notWork < 0) notWork = 0;
      let investment = successCount * 0.12;

      // গ্লোবাল ٹوٹাল যোগ করা
      globalTotalOrder += totalOrder;
      globalTotalSuccess += successCount;
      globalTotalNotWork += notWork;
      globalTotalSpent += investment;

      return {
        email: user.email,
        totalOrder,
        success: successCount,
        notWork,
        investment,
      };
    });

    // 🟢 ওপরের ৪টি স্ট্যাট কার্ড DOM-এ আপডেট করা
    const elTotalOrder = document.getElementById("reportTotalOrder");
    const elTotalSuccess = document.getElementById("reportTotalSuccess");
    const elTotalNotWork = document.getElementById("reportTotalNotWork");
    const elTotalSpent = document.getElementById("reportTotalSpent");

    if (elTotalOrder) elTotalOrder.innerText = globalTotalOrder;
    if (elTotalSuccess) elTotalSuccess.innerText = globalTotalSuccess;
    if (elTotalNotWork) elTotalNotWork.innerText = globalTotalNotWork;
    if (elTotalSpent)
      elTotalSpent.innerText = `$${globalTotalSpent.toFixed(2)}`;

    // Success সংখ্যার ভিত্তিতে সর্টিং (টপ পারফর্মার উপরে থাকবে)
    userReports.sort(
      (a, b) => b.success - a.success || b.totalOrder - a.totalOrder,
    );

    otherUsersList.innerHTML = "";

    userReports.forEach((user, index) => {
      const rank = index + 1;
      const isTopOne = index === 0 && user.success > 0;

      const topBadgeHtml = isTopOne
        ? `<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
             <i class="fa-solid fa-crown text-amber-500"></i> TOP 1
           </span>`
        : "";

      const row = document.createElement("div");
      row.className = isTopOne
        ? "flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/40 hover:bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 transition"
        : "flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100/80 p-4 rounded-2xl border border-slate-200/60 transition";

      row.innerHTML = `
        <div class="flex items-center gap-3.5">
          <span class="w-9 h-9 rounded-xl ${isTopOne ? "bg-amber-400 text-slate-950" : "bg-slate-200/80 text-slate-700"} font-black text-xs flex items-center justify-center font-mono shadow-sm">#${rank}</span>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-sm font-bold text-slate-900">${user.email}</h4>
              ${topBadgeHtml}
            </div>
            <p class="text-[11px] text-slate-500 font-medium mt-0.5">
              Total Order: <span class="text-blue-600 font-bold">${user.totalOrder}</span> | 
              Success: <span class="text-emerald-600 font-bold">${user.success}</span> | 
              Not Work: <span class="text-rose-600 font-bold">${user.notWork}</span>
            </p>
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
    otherUsersList.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm">No users found.</div>`;
  }
}

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
      if (!grouped[dateStr]) grouped[dateStr] = { totalOrder: 0, success: 0 };

      grouped[dateStr].totalOrder += 1;

      const status = (order.status || "").toLowerCase();
      if (status.includes("success")) {
        grouped[dateStr].success += 1;
      }
    });

    tbody.innerHTML = "";
    Object.keys(grouped)
      .sort()
      .reverse()
      .forEach((date) => {
        const info = grouped[date];
        let notWork = info.totalOrder - info.success;
        if (notWork < 0) notWork = 0;

        const inv = info.success * 0.12;
        const row = document.createElement("tr");
        row.className = "hover:bg-slate-50 transition";
        row.innerHTML = `
          <td class="py-3 px-4 font-mono text-xs font-bold text-slate-800">${date}</td>
          <td class="py-3 px-4 text-blue-600 font-bold">${info.totalOrder}</td>
          <td class="py-3 px-4 text-emerald-600 font-bold">${info.success}</td>
          <td class="py-3 px-4 text-rose-600 font-bold">${notWork}</td>
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

// === BUY CANADA NUMBER (Per-User 10-Hour Cooldown & Success-Only Model) ===
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

    // ১. এই ইউজারের বর্তমানে কোন কোন নাম্বারের ওপর ১০ ঘণ্টার কুলডাউন একটিভ আছে তা ফেচ করা
    const nowIso = new Date().toISOString();
    const { data: activeCooldowns } = await _supabase
      .from("number_cooldowns")
      .select("phone_number")
      .eq("user_email", loggedInUser.email)
      .gt("cooldown_until", nowIso);

    const restrictedPhones = activeCooldowns
      ? activeCooldowns.map((c) => c.phone_number)
      : [];

    // ২. সব আনঅ্যাসাইনড স্টক ফেচ করা
    const { data: availableStock, error: fetchErr } = await _supabase
      .from("whatsapp_numbers")
      .select("*")
      .is("assigned_to", null);

    if (fetchErr || !availableStock || availableStock.length === 0) {
      showToast("No Canada numbers available in stock right now!", true);
      return;
    }

    // ৩. ইউজারের নিজস্ব রেস্ট্রিক্টেড নাম্বারগুলো স্টক থেকে বাদ দেওয়া
    let userFilteredStock = availableStock.filter(
      (item) => !restrictedPhones.includes(item.phone_number),
    );

    if (userFilteredStock.length === 0) {
      showToast(
        "Cooldown active! You have a 10-hour restriction on your recently canceled numbers.",
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

    // 🟢 ৪. অর্ডার ইনসার্ট করার সময় স্ট্যাটাস "Order Confirm" সেট করা হলো
    await _supabase.from("canada_orders").insert([
      {
        order_id: String(cadOrderId),
        phone_number: phoneNumberStr,
        otp: stockLinkStr,
        status: "Order Confirm",
        user_email: loggedInUser.email,
        created_at: dhakaTimeIns,
      },
    ]);

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
      "Order Confirm";

    // 🟢 ৫. Success Completed বাটন কনফিগার করা
    const successBtn = document.getElementById("canadaBtnSuccessOrder");

    if (successBtn) {
      successBtn.disabled = false;
      successBtn.setAttribute(
        "onclick",
        `completeCanadaActiveOrder('${cadOrderId}')`,
      );
      successBtn.className =
        "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]";
      successBtn.innerHTML = `<i class="fa-solid fa-circle-check text-base"></i> Success Completed`;
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
// === MARK CANADA ORDER AS SUCCESS (Saves Success Timestamp) ===
async function completeCanadaActiveOrder(specificId) {
  const orderId =
    specificId || document.getElementById("canadaActivationId").innerText;
  if (!orderId || orderId === "-") return;

  if (
    !confirm(
      "Are you sure you want to mark this Canada order as Success Completed?",
    )
  )
    return;

  showToast("Updating order status to Success...");

  try {
    const cleanId = String(orderId).replace("#", "").trim();
    const successTimeIso = new Date().toISOString(); // 🟢 বর্তমান সাকসেস টাইম

    // অর্ডার থেকে ফোন নাম্বারটি বের করে নেওয়া
    const { data: orderData } = await _supabase
      .from("canada_orders")
      .select("phone_number")
      .eq("order_id", cleanId)
      .maybeSingle();

    const phoneNum = orderData ? orderData.phone_number : "";

    // ১. স্ট্যাটাস Success এবং success_at টাইম আপডেট করা
    await _supabase
      .from("canada_orders")
      .update({
        status: "Success",
        success_at: successTimeIso,
      })
      .eq("order_id", cleanId);

    // ২. অ্যাক্টিভিটি ফিডে লগ রেকর্ড করা
    await recordSystemLog(
      loggedInUser.email,
      "CANADA_SUCCESS",
      cleanId,
      phoneNum,
    );

    const statusEl = document.getElementById("canadaOrderStatusText");
    if (statusEl) {
      statusEl.innerText = "Success (Completed)";
      statusEl.className = "text-emerald-600 font-bold text-base mt-1";
    }

    const successBtn = document.getElementById("canadaBtnSuccessOrder");
    if (successBtn) {
      successBtn.disabled = true;
      successBtn.className =
        "w-full bg-slate-100 text-slate-400 font-bold py-3.5 px-4 rounded-xl text-sm cursor-not-allowed flex items-center justify-center gap-2";
      successBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> Completed`;
    }

    showToast("Canada order marked as Success successfully!");

    if (typeof fetchDashboardStats === "function") fetchDashboardStats();

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
// === ৩. VIEW CANADA ORDER FROM HISTORY ===
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

    const statusEl = document.getElementById("canadaOrderStatusText");
    const successBtn = document.getElementById("canadaBtnSuccessOrder");

    statusEl.innerText = order.status;

    if (order.status && order.status.toLowerCase().includes("success")) {
      statusEl.className = "text-emerald-600 font-bold text-base mt-1";
      if (successBtn) {
        successBtn.disabled = true;
        successBtn.className =
          "w-full bg-slate-100 text-slate-400 font-bold py-3.5 px-4 rounded-xl text-sm cursor-not-allowed flex items-center justify-center gap-2";
        successBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> Completed`;
      }
    } else {
      statusEl.className = "text-emerald-600 font-bold text-base mt-1";
      if (successBtn) {
        successBtn.disabled = false;
        successBtn.setAttribute(
          "onclick",
          `completeCanadaActiveOrder('${order.order_id}')`,
        );
        successBtn.className =
          "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]";
        successBtn.innerHTML = `<i class="fa-solid fa-circle-check text-base"></i> Success Completed`;
      }
    }

    document.getElementById("canadaBuySection").classList.add("hidden");
    document.getElementById("canadaOrderCard").classList.remove("hidden");

    const canadaHistorySection = document.getElementById(
      "canadaHistorySection",
    );
    if (canadaHistorySection) canadaHistorySection.classList.add("hidden");
  } catch (e) {
    console.error("View order error:", e);
  }
  if (typeof fetchOrderReminders === "function") {
    fetchOrderReminders();
  }
}
// === ২. CANCEL CANADA ORDER (Adds 10-Hour Cooldown Record for this User) ===
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
      const phoneNum = orderData.phone_number;

      // স্টক ফ্রী করা হলো
      await _supabase
        .from("whatsapp_numbers")
        .update({ assigned_to: null })
        .eq("phone_number", phoneNum);

      // 🟢 এই ইউজারের জন্য সুনির্দিষ্টভাবে ১০ ঘণ্টার কুলডাউন রেকর্ড এন্ট্রি করা হলো
      const cooldownUntilTime = new Date(
        Date.now() + 10 * 60 * 60 * 1000,
      ).toISOString();
      await _supabase.from("number_cooldowns").insert([
        {
          user_email: loggedInUser.email,
          phone_number: phoneNum,
          cooldown_until: cooldownUntilTime,
        },
      ]);
    }

    await _supabase
      .from("canada_orders")
      .update({ status: "Canceled & Refunded" })
      .eq("order_id", cleanId);

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

// === FETCH CANADA HISTORY (Clean & Premium Modern UI) ===
async function fetchCanadaHistory() {
  if (!_supabase || !loggedInUser) return;

  try {
    const { data, error } = await _supabase
      .from("canada_orders")
      .select("*")
      .eq("user_email", loggedInUser.email)
      .order("id", { ascending: false });

    if (error) throw error;

    const tableContainer = document.querySelector(
      "#canadaHistorySection table",
    );
    if (!tableContainer) return;

    // ১. টেবিলের হেডার আরও সুন্দর ও প্রিমিয়াম করা হলো
    const thead = tableContainer.querySelector("thead tr");
    if (thead) {
      thead.className =
        "bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider";
      thead.innerHTML = `
        <th class="py-3.5 px-4 text-left">ID</th>
        <th class="py-3.5 px-4 text-left">Number</th>
        <th class="py-3.5 px-4 text-left">Link</th>
        <th class="py-3.5 px-4 text-left">Order Time</th>
        <th class="py-3.5 px-4 text-left">Success Time</th>
        <th class="py-3.5 px-4 text-left">Status</th>
        <th class="py-3.5 px-4 text-center">Action</th>
      `;
    }

    const tbody = document.getElementById("canadaHistoryTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-medium text-sm">No Canada order history found.</td></tr>`;
      return;
    }

    data.forEach((order) => {
      // অর্ডার করার সময় ফরম্যাট
      const orderTimeFormatted = order.created_at
        ? new Date(order.created_at).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      // সাকসেস হওয়ার সময় ফরম্যাট (যদি সাকসেস না হয় তবে হালকা রঙে Pending দেখাবে)
      const successTimeFormatted = order.success_at
        ? `<span class="text-emerald-600 font-bold">${new Date(order.success_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>`
        : `<span class="text-slate-400 font-normal italic text-xs bg-slate-100 px-2 py-0.5 rounded">Pending</span>`;

      let statusBadge = "";
      const statusLower = (order.status || "").toLowerCase();

      if (statusLower.includes("cancel")) {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100 whitespace-nowrap shadow-sm">
                        <i class="fa-solid fa-circle-xmark mr-1.5 text-[10px]"></i> Canceled
                      </span>`;
      } else if (statusLower.includes("success")) {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 whitespace-nowrap shadow-sm">
                        <i class="fa-solid fa-circle-check mr-1.5 text-[10px]"></i> Success
                      </span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap shadow-sm">
                        <i class="fa-solid fa-clock mr-1.5 text-[10px]"></i> Order Confirm
                      </span>`;
      }

      const row = document.createElement("tr");
      row.className =
        "border-b border-slate-50 hover:bg-slate-50/60 transition-all text-sm";
      row.innerHTML = `
        <td class="py-4 px-4 text-blue-600 font-extrabold font-mono text-xs">#${order.order_id}</td>
        <td class="py-4 px-4 text-slate-700 font-bold font-mono text-xs">${order.phone_number || "-"}</td>
        <td class="py-4 px-4 max-w-[160px] truncate">
          <a href="${order.otp}" target="_blank" class="text-blue-500 hover:text-blue-700 hover:underline text-xs bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100 inline-block truncate max-w-full font-medium shadow-2xs">
            <i class="fa-solid fa-link mr-1 text-[10px]"></i> ${order.otp || "-"}
          </a>
        </td>
        <td class="py-4 px-4 text-xs font-mono text-slate-500 font-medium whitespace-nowrap">${orderTimeFormatted}</td>
        <td class="py-4 px-4 text-xs font-mono whitespace-nowrap">${successTimeFormatted}</td>
        <td class="py-4 px-4">${statusBadge}</td>
        <td class="py-4 px-4 text-center">
          <button onclick="viewCanadaOrder('${order.order_id}')" class="bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer">
            <i class="fa-solid fa-eye"></i> View
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (e) {
    console.error("Error fetching Canada history:", e);
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

// === SYSTEM UPDATE CHECKER & LIVE MODAL ===
let currentAppVersion = null;

async function checkAppUpdateVersion() {
  if (!_supabase) return;

  try {
    const { data, error } = await _supabase
      .from("app_settings")
      .select("version, update_message")
      .eq("id", 1)
      .single();

    if (error || !data) return;

    // প্রথমবার পেজ লোড হলে বর্তমান ভার্সনটি মেমোরিতে সেভ রাখা
    if (currentAppVersion === null) {
      currentAppVersion = data.version;
    }
    // যদি ডাটাবেজের ভার্সন পরিবর্তন হয়, তবে সাথে সাথে মডাল শো করবে
    else if (currentAppVersion !== data.version) {
      const modal = document.getElementById("systemUpdateModal");
      const msgEl = document.getElementById("systemUpdateMsg");

      if (msgEl && data.update_message) {
        msgEl.innerText = data.update_message;
      }
      if (modal) {
        modal.classList.remove("hidden");
      }
    }
  } catch (e) {
    console.error("Update check error:", e);
  }
}

// হার্ড রিফ্রেশ ফাংশন (যাতে ব্রাউজার ক্যাশ ক্লিয়ার হয়ে নতুন ফাইল লোড হয়)
function forceHardRefresh() {
  window.location.reload(true);
}

// পেজ লোড হলে ভার্সন চেক শুরু হবে এবং প্রতি ১০ সেকেন্ড পরপর চেক করবে
window.addEventListener("DOMContentLoaded", () => {
  checkAppUpdateVersion();
  setInterval(checkAppUpdateVersion, 10000);
});

// === LOAD CURRENT VERSION IN ADMIN PANEL ===
async function loadAdminUpdateSettings() {
  if (!_supabase || !loggedInUser || loggedInUser.role !== "admin") return;

  const { data } = await _supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (data) {
    const badge = document.getElementById("adminCurrentVersionBadge");
    const verInput = document.getElementById("adminNewVersionInput");
    const msgInput = document.getElementById("adminUpdateMsgInput");

    if (badge) badge.innerText = data.version;
    if (verInput) verInput.value = data.version;
    if (msgInput) msgInput.value = data.update_message;
  }
}

// === PUBLISH SYSTEM UPDATE (ADMIN ONLY) ===
async function publishSystemUpdate() {
  if (!loggedInUser || loggedInUser.role !== "admin") {
    showToast("Access Denied! Admin only.", true);
    return;
  }

  const newVer = document.getElementById("adminNewVersionInput")?.value.trim();
  const newMsg = document.getElementById("adminUpdateMsgInput")?.value.trim();

  if (!newVer || !newMsg) {
    showToast("Please enter both Version and Update Message!", true);
    return;
  }

  const { error } = await _supabase
    .from("app_settings")
    .update({
      version: newVer,
      update_message: newMsg,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (!error) {
    // অ্যাডমিনের নিজের স্ক্রিনে যাতে অযথা মডাল পপ-আপ না আসে, তাই লোকাল ভার্সন আপডেট করে রাখা হলো
    currentAppVersion = newVer;
    const badge = document.getElementById("adminCurrentVersionBadge");
    if (badge) badge.innerText = newVer;

    showToast(
      `Update v${newVer} pushed! All active users will see the refresh popup.`,
    );
  } else {
    showToast("Failed to push update: " + error.message, true);
  }
}

// === EVENT-DRIVEN REALTIME LISTENER (Updates ONLY when new data arrives) ===
function initEventDrivenRealtime() {
  if (!_supabase || !loggedInUser) return;

  // ১. নতুন অর্ডার বা ক্যানসেল হলে ড্যাশবোর্ড স্ট্যাটস আপডেট (Canada & WhatsApp)
  _supabase
    .channel("realtime-dashboard-stats")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "canada_orders" },
      (payload) => {
        if (typeof fetchDashboardStats === "function") fetchDashboardStats();
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => {
        if (typeof fetchDashboardStats === "function") fetchDashboardStats();
      },
    )
    .subscribe();

  // ২. স্টক নাম্বার যুক্ত বা অ্যাসাইন হলে সাইডবারের Canada Stock ব্যাজ আপডেট
  _supabase
    .channel("realtime-stock-count")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "whatsapp_numbers" },
      (payload) => {
        if (typeof updateCanadaStockBadge === "function")
          updateCanadaStockBadge();
      },
    )
    .subscribe();

  // ৩. নতুন অ্যাক্টিভিটি লগ ইনসার্ট হলেই কেবল Live Activity Feed আপডেট
  _supabase
    .channel("realtime-activity-feed")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "system_logs" },
      (payload) => {
        if (typeof fetchGlobalActivityLog === "function")
          fetchGlobalActivityLog();
      },
    )
    .subscribe();

  // ৪. অ্যাডমিন নতুন ভার্সন পুশ করলেই কেবল Refresh Modal শো করবে
  _supabase
    .channel("realtime-app-update")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "app_settings" },
      (payload) => {
        if (typeof checkAppUpdateVersion === "function")
          checkAppUpdateVersion();
      },
    )
    .subscribe();
}

// পেজ লোড হলে একবার প্রাথমিক ডাটা লোড হবে এবং রিয়েল-টাইম লিসেনার চালু হয়ে যাবে
window.addEventListener("DOMContentLoaded", () => {
  if (typeof fetchDashboardStats === "function") fetchDashboardStats();
  if (typeof updateCanadaStockBadge === "function") updateCanadaStockBadge();
  if (typeof fetchGlobalActivityLog === "function") fetchGlobalActivityLog();
  if (typeof checkAppUpdateVersion === "function") checkAppUpdateVersion();

  // 🟢 রিয়েল-টাইম ইভেন্ট লিসেনার অ্যাক্টিভ করা হলো
  initEventDrivenRealtime();
});

// ফোন নাম্বারের মাঝখানে ৪টি স্টার বসানোর ফাংশন
function maskPhoneNumber(phone) {
  if (!phone) return "-";
  const cleanPhone = String(phone).trim();
  if (cleanPhone.length <= 8) return cleanPhone; // ছোট নাম্বার হলে যেমন আছে তেমনই রাখবে

  const start = cleanPhone.slice(0, 4);
  const end = cleanPhone.slice(-4);
  return `${start}***${end}`;
}

// === USER DATE-WISE HISTORY & RE-WORK SYSTEM ===
let cachedUserAllOrders = [];
let currentSelectedDateOrders = [];

// মডাল ওপেন করা এবং লগইন ইউজারের সব ডাটা লোড করা
async function openMyDateHistoryModal() {
  if (!_supabase || !loggedInUser) return;

  const modal = document.getElementById("myDateHistoryModal");
  const body = document.getElementById("myDateHistoryBody");
  if (modal) modal.classList.remove("hidden");
  if (body)
    body.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading your work dates...</div>`;

  const { data, error } = await _supabase
    .from("canada_orders")
    .select("*")
    .eq("user_email", loggedInUser.email)
    .order("created_at", { ascending: false });

  if (error) {
    if (body)
      body.innerHTML = `<div class="text-center py-8 text-rose-500 text-sm">Failed to load history.</div>`;
    return;
  }

  cachedUserAllOrders = data || [];
  renderUserDateSummaryView();
}

function closeMyDateHistoryModal() {
  const modal = document.getElementById("myDateHistoryModal");
  if (modal) modal.classList.add("hidden");
}

// ধাপ ১: তারিখ অনুযায়ী সামারি লিস্ট দেখানো
function renderUserDateSummaryView() {
  const body = document.getElementById("myDateHistoryBody");
  const backBtn = document.getElementById("btnBackToDateList");
  const filterBar = document.getElementById("dateDetailFilterBar");
  const titleEl = document.getElementById("dateModalTitle");
  const subTitleEl = document.getElementById("dateModalSubTitle");

  if (backBtn) backBtn.classList.add("hidden");
  if (filterBar) filterBar.classList.add("hidden");
  if (titleEl) titleEl.innerText = "My Work History (Date-Wise)";
  if (subTitleEl)
    subTitleEl.innerText =
      "Select a date to view report or re-work on Not Work numbers.";

  if (!cachedUserAllOrders || cachedUserAllOrders.length === 0) {
    body.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm">No work history found for your account yet.</div>`;
    return;
  }

  // Asia/Dhaka টাইমজোন অনুযায়ী তারিখ গ্রুপ করা
  const groupedByDate = {};
  cachedUserAllOrders.forEach((order) => {
    const dhakaDateStr = new Date(order.created_at).toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Dhaka",
      },
    ); // YYYY-MM-DD ফরম্যাট

    if (!groupedByDate[dhakaDateStr]) {
      groupedByDate[dhakaDateStr] = [];
    }
    groupedByDate[dhakaDateStr].push(order);
  });

  const sortedDates = Object.keys(groupedByDate).sort().reverse();
  body.innerHTML = "";

  sortedDates.forEach((dateKey) => {
    const orders = groupedByDate[dateKey];
    const totalOrder = orders.length;
    const successCount = orders.filter(
      (o) => o.status && o.status.toLowerCase().includes("success"),
    ).length;
    const notWorkCount = totalOrder - successCount;
    const spent = successCount * 0.12;

    const readableDate = new Date(dateKey + "T00:00:00").toLocaleDateString(
      "en-US",
      {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      },
    );

    const card = document.createElement("div");
    card.className =
      "flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 hover:bg-slate-100/80 p-4 rounded-2xl border border-slate-200/70 transition";

    card.innerHTML = `
      <div class="flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-base shrink-0">
          <i class="fa-regular fa-calendar-check"></i>
        </div>
        <div>
          <h4 class="text-sm font-black text-slate-900">${readableDate} <span class="text-xs font-mono text-slate-400 font-normal">(${dateKey})</span></h4>
          <div class="flex items-center gap-3 text-xs font-semibold mt-1 flex-wrap">
            <span class="text-blue-600">Total: <b>${totalOrder}</b></span>
            <span class="text-slate-300">|</span>
            <span class="text-emerald-600">Success: <b>${successCount}</b></span>
            <span class="text-slate-300">|</span>
            <span class="text-rose-600">Not Work: <b>${notWorkCount}</b></span>
            <span class="text-slate-300">|</span>
            <span class="text-amber-600">Spent: <b>$${spent.toFixed(2)}</b></span>
          </div>
        </div>
      </div>

      <button
        onclick="openSpecificDateOrders('${dateKey}')"
        class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm self-start sm:self-auto"
      >
        <i class="fa-solid fa-eye"></i> View History
      </button>
    `;
    body.appendChild(card);
  });
}

// ধাপ ২: নির্দিষ্ট তারিখের ভেতরে ঢুকে সব নাম্বার দেখা
function openSpecificDateOrders(dateKey) {
  const backBtn = document.getElementById("btnBackToDateList");
  const filterBar = document.getElementById("dateDetailFilterBar");
  const titleEl = document.getElementById("dateModalTitle");
  const subTitleEl = document.getElementById("dateModalSubTitle");

  if (backBtn) backBtn.classList.remove("hidden");
  if (filterBar) filterBar.classList.remove("hidden");
  if (titleEl) titleEl.innerText = `Work Details: ${dateKey}`;
  if (subTitleEl)
    subTitleEl.innerText =
      "Click 'Work Now' on any Not Work number to open & complete it.";

  currentSelectedDateOrders = cachedUserAllOrders.filter((order) => {
    const dhakaDateStr = new Date(order.created_at).toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Dhaka",
      },
    );
    return dhakaDateStr === dateKey;
  });

  const total = currentSelectedDateOrders.length;
  const success = currentSelectedDateOrders.filter((o) =>
    (o.status || "").toLowerCase().includes("success"),
  ).length;
  const notWork = total - success;

  const badgeEl = document.getElementById("dateDetailSummaryBadge");
  if (badgeEl) {
    badgeEl.innerHTML = `Total: <span class="text-blue-600">${total}</span> • Success: <span class="text-emerald-600">${success}</span> • Not Work: <span class="text-rose-600">${notWork}</span>`;
  }

  filterDateDetailOrders("all");
}

// ধাপ ৩: নির্দিষ্ট তারিখের অর্ডারগুলো ফিল্টার ও রেন্ডার করা
function filterDateDetailOrders(filterType) {
  const body = document.getElementById("myDateHistoryBody");
  if (!body) return;

  // বাটন অ্যাক্টিভ স্টাইল আপডেট
  const tabAll = document.getElementById("tabDateAll");
  const tabNotWork = document.getElementById("tabDateNotWork");
  const tabSuccess = document.getElementById("tabDateSuccess");

  if (tabAll)
    tabAll.className =
      filterType === "all"
        ? "px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white cursor-pointer"
        : "px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200/70 text-slate-700 cursor-pointer";
  if (tabNotWork)
    tabNotWork.className =
      filterType === "not_work"
        ? "px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white cursor-pointer"
        : "px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 cursor-pointer";
  if (tabSuccess)
    tabSuccess.className =
      filterType === "success"
        ? "px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer"
        : "px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 cursor-pointer";

  let filtered = currentSelectedDateOrders;
  if (filterType === "success") {
    filtered = currentSelectedDateOrders.filter((o) =>
      (o.status || "").toLowerCase().includes("success"),
    );
  } else if (filterType === "not_work") {
    filtered = currentSelectedDateOrders.filter(
      (o) => !(o.status || "").toLowerCase().includes("success"),
    );
  }

  if (filtered.length === 0) {
    body.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">No orders found in this category.</div>`;
    return;
  }

  body.innerHTML = "";
  filtered.forEach((order) => {
    const isSuccess = (order.status || "").toLowerCase().includes("success");
    const orderTime = new Date(order.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Dhaka",
    });

    const statusBadge = isSuccess
      ? `<span class="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold"><i class="fa-solid fa-check mr-1"></i>Success</span>`
      : `<span class="bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold"><i class="fa-solid fa-clock mr-1"></i>Not Work</span>`;

    // Not Work হলে "Work Now" বাটন দেখাবে যাতে ইউজার ওপেন করে কাজ করতে পারে
    const actionBtn = isSuccess
      ? `<button onclick="reworkCanadaOrderFromHistory('${order.order_id}')" class="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer">View</button>`
      : `<button onclick="reworkCanadaOrderFromHistory('${order.order_id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1"><i class="fa-solid fa-play text-[10px]"></i> Work Now</button>`;

    const row = document.createElement("div");
    row.className =
      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 hover:border-blue-200 transition";
    row.innerHTML = `
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-xs font-mono font-extrabold text-blue-600">#${order.order_id}</span>
        <span class="text-sm font-mono font-bold text-slate-800">${order.phone_number || "-"}</span>
        ${statusBadge}
        <span class="text-[11px] text-slate-400 font-mono">${orderTime}</span>
      </div>
      <div class="flex items-center gap-2 self-end sm:self-auto">
        <a href="${order.otp}" target="_blank" class="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-xl transition">
          <i class="fa-solid fa-link mr-1"></i> Link
        </a>
        ${actionBtn}
      </div>
    `;
    body.appendChild(row);
  });
}

// ধাপ ৪: Not Work নাম্বারে ক্লিক করলে মডাল বন্ধ হয়ে ওই অর্ডার কার্ড ওপেন হবে
function reworkCanadaOrderFromHistory(orderId) {
  closeMyDateHistoryModal();
  if (typeof viewCanadaOrder === "function") {
    viewCanadaOrder(orderId);
  }
}
// === COMPLETE ORDER NOTES, ALARMS & NOTIFICATIONS SYSTEM ===
window.currentActiveAlarmNoteId = window.currentActiveAlarmNoteId || null;
window.activeAudioBeep = window.activeAudioBeep || null;
window.pendingAlarmOrderId = window.pendingAlarmOrderId || null;

// ১. নোটিফিকেশন ড্রপডাউন টগল করা
function toggleNotificationDropdown() {
  const dropdown = document.getElementById("notificationDropdown");
  if (dropdown) {
    dropdown.classList.toggle("hidden");
    if (!dropdown.classList.contains("hidden")) {
      fetchNotifications();
    }
  }
}
// === FIXED NOTIFICATION RENDERER & ORDER OPENING LOGIC ===
async function fetchNotifications() {
  if (!_supabase || !loggedInUser) return;

  const { data, error } = await _supabase
    .from("notifications")
    .select("*")
    .eq("user_email", loggedInUser.email)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching notifications:", error);
    return;
  }

  const badge = document.getElementById("notificationBadgeCount");
  const listContainer = document.getElementById("notificationDropdownList");
  if (!listContainer) return;

  if (data && data.length > 0) {
    const unreadCount = data.filter((n) => !n.is_read).length;
    if (badge) {
      if (unreadCount > 0) {
        badge.innerText = unreadCount;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }

    listContainer.innerHTML = "";
    data.forEach((item) => {
      const timeStr = new Date(item.created_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

      const row = document.createElement("div");
      row.className = item.is_read
        ? "flex items-start gap-3 p-3 hover:bg-slate-50 transition cursor-pointer border-b border-slate-100"
        : "flex items-start gap-3 p-3 bg-blue-100/90 hover:bg-blue-200/80 transition cursor-pointer border-b border-slate-100 border-l-4 border-blue-600 relative";

      row.innerHTML = `
        <div class="relative flex-shrink-0 mt-0.5">
          <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm shadow-md">
            <i class="fa-solid fa-bell"></i>
          </div>
          ${!item.is_read ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 border-2 border-white rounded-full"></span>' : ""}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-0.5">
            <h5 class="text-xs font-bold text-slate-900 truncate"><i class="fa-solid fa-phone-alt text-[10px] mr-1 text-blue-600"></i>${item.title}</h5>
            <span class="text-[10px] text-slate-400 font-medium ml-2 flex-shrink-0">${timeStr}</span>
          </div>
          <p class="text-xs text-slate-700 leading-relaxed">${item.message}</p>
        </div>
      `;

      // 🟢 যেকোনো ট্যাবে থাকলেও প্রথমে কানাডা স্টক ট্যাবে যাবে তারপর অর্ডার ওপেন করবে
      row.onclick = async () => {
        // ১. নোটিফিকেশনটি রিড হিসেবে আপডেট করা
        await _supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", item.id);

        // ২. ড্রপডাউন বন্ধ করা
        if (typeof toggleNotificationDropdown === "function") {
          toggleNotificationDropdown();
        }

        if (item.order_id) {
          const targetOrderId = String(item.order_id).trim();

          // ৩. যদি ইউজারের প্রজেক্টে ট্যাব সুইচ করার ফাংশন বা বাটন থাকে, সেটি আগে কল করা
          // (আপনার প্রজেক্টের ট্যাব সুইচি ফাংশনটির নাম যদি আলাদা হয় যেমন switchTab('canada') সেটি এখানে বসাতে পারেন)
          const canadaStockTabBtn =
            document.querySelector(
              "[onclick*='canada'], [data-tab*='canada']",
            ) || document.getElementById("canadaStockTabBtn");
          if (canadaStockTabBtn) {
            canadaStockTabBtn.click(); // অটোমেটিক কানাডা স্টক ট্যাবে নিয়ে যাবে
          } else if (typeof switchTab === "function") {
            switchTab("canada");
          }

          // ৪. সামান্য বিরতি দিয়ে অর্ডার ভিউ ফাংশন কল করা যাতে ট্যাব লোড হওয়ার সময় পায়
          setTimeout(() => {
            if (typeof viewCanadaOrder === "function") {
              viewCanadaOrder(targetOrderId);
            } else {
              console.error("viewCanadaOrder function is not defined!");
            }
          }, 200);
        }

        fetchNotifications();
      };

      listContainer.appendChild(row);
    });
  } else {
    if (badge) badge.classList.add("hidden");
    listContainer.innerHTML = `
      <div class="py-12 text-center">
        <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2 text-lg">
          <i class="fa-regular fa-bell-slash"></i>
        </div>
        <p class="text-xs text-slate-400 font-medium">No notifications yet</p>
      </div>
    `;
  }
}

// ৩. সব নোটিফিকেশন একসাথে রিড করা
async function markAllNotificationsAsRead() {
  if (!_supabase || !loggedInUser) return;
  await _supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_email", loggedInUser.email);
  fetchNotifications();
}

// ৪. অর্ডার নোটস মডাল ওপেন/ক্লোজ
function openOrderNotesModal() {
  const modal = document.getElementById("orderNotesModal");
  if (modal) modal.classList.remove("hidden");
  fetchOrderReminders();
}

function closeOrderNotesModal() {
  const modal = document.getElementById("orderNotesModal");
  if (modal) modal.classList.add("hidden");
}

// === SAVE NOTE & REMINDER (Instant Notification Removed) ===
async function saveOrderNoteAndAlarm() {
  if (!_supabase || !loggedInUser) return;
  const orderIdText =
    document.getElementById("canadaActivationId")?.innerText || "";
  const noteContent = document.getElementById("orderNoteInput")?.value || "";
  const reminderTime =
    document.getElementById("orderAlarmInput")?.value || null;

  if (!orderIdText || orderIdText === "-") {
    showToast("No active order selected!", true);
    return;
  }

  if (!reminderTime) {
    showToast("Please set a valid alarm reminder time!", true);
    return;
  }

  const cleanOrderId = String(orderIdText).replace("#", "").trim();

  // ১. শুধু order_notes টেবিলে রিমাইন্ডার সেভ হবে (সাথে সাথে কোনো নোটিফিকেশন তৈরি হবে না)
  const { error: noteError } = await _supabase.from("order_notes").insert([
    {
      order_id: cleanOrderId,
      user_email: loggedInUser.email,
      note_content: noteContent,
      reminder_time: new Date(reminderTime).toISOString(),
      is_completed: false,
      notification_triggered: false, // 🟢 নোটিফিকেশন এখনো ট্রিগার হয়নি
    },
  ]);

  if (noteError) {
    showToast("Error saving note: " + noteError.message, true);
    return;
  }

  showToast("Alarm reminder set successfully!");
  document.getElementById("orderNoteInput").value = "";
  document.getElementById("orderAlarmInput").value = "";
  closeOrderNotesModal();
  fetchOrderReminders();
}
// === UPDATED BACKGROUND ALARM CHECKER (Saves Phone Number in Title) ===
async function checkAndTriggerAlarms() {
  if (!_supabase || !loggedInUser) return;
  const nowIso = new Date().toISOString();

  const { data: dueReminders } = await _supabase
    .from("order_notes")
    .select("*")
    .eq("user_email", loggedInUser.email)
    .eq("is_completed", false)
    .eq("notification_triggered", false)
    .not("reminder_time", "is", null)
    .lte("reminder_time", nowIso);

  if (dueReminders && dueReminders.length > 0) {
    for (const reminder of dueReminders) {
      const formattedTime = new Date(reminder.reminder_time).toLocaleTimeString(
        [],
        {
          hour: "numeric",
          minute: "2-digit",
        },
      );

      // 🟢 অর্ডার টেবিল থেকে এই অর্ডারের ফোন নম্বরটি বের করে আনা
      let orderPhoneNum = `Order #${reminder.order_id}`;
      try {
        const { data: orderData } = await _supabase
          .from("canada_orders")
          .select("phone_number")
          .eq("id", reminder.order_id)
          .single();

        if (orderData && orderData.phone_number) {
          orderPhoneNum = orderData.phone_number;
        }
      } catch (e) {
        console.log("Could not fetch phone number", e);
      }

      // নোটিফিকেশন টেবিলে টাইটেলে ফোন নম্বর এবং মেসেজে নোট ও টাইম সেভ করা
      await _supabase.from("notifications").insert([
        {
          user_email: loggedInUser.email,
          title: orderPhoneNum, // 🟢 এখানে অর্ডারের ফোন নম্বর শো করবে
          message: `${reminder.note_content || "Reminder alert reached."}\nTime reached: ${formattedTime}`, // 🟢 মেসেজ ও টাইম নিচে থাকবে
          order_id: reminder.order_id,
          is_read: false,
        },
      ]);

      await _supabase
        .from("order_notes")
        .update({ notification_triggered: true })
        .eq("id", reminder.id);
    }

    if (typeof fetchNotifications === "function") {
      fetchNotifications();
    }
  }
}

// প্রতি ১০ সেকেন্ড পর পর ব্যাকগ্রাউন্ডে চেক করবে
if (!window._alarmIntervalStarted) {
  window._alarmIntervalStarted = true;
  setInterval(checkAndTriggerAlarms, 10000);
}

// পেজ লোড হওয়ার সাথে সাথে এবং প্রতি ১০ সেকেন্ড পর পর চেক করবে
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(checkAndTriggerAlarms, 1000);
});

if (!window._alarmIntervalStarted) {
  window._alarmIntervalStarted = true;
  setInterval(checkAndTriggerAlarms, 10000);
}

// নির্দিষ্ট অর্ডারের সব রিমাইন্ডার ও নোটস ফেচ করে ইউআই তে দেখানোর ফাংশন
async function fetchOrderReminders() {
  const orderIdText =
    document.getElementById("canadaActivationId")?.innerText || "";
  const cleanId = String(orderIdText).replace("#", "").trim();
  const container = document.getElementById("orderReminderListContainer");
  if (!container || !cleanId || cleanId === "-") return;

  const { data } = await _supabase
    .from("order_notes")
    .select("*")
    .eq("order_id", cleanId)
    .eq("user_email", loggedInUser.email)
    .order("created_at", { ascending: false });

  if (data && data.length > 0) {
    container.innerHTML = "";
    data.forEach((item) => {
      const timeFormatted = item.reminder_time
        ? new Date(item.reminder_time).toLocaleString()
        : "No alarm set";
      const statusBadge = item.is_completed
        ? `<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold">Completed</span>`
        : `<span class="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md text-[10px] font-bold">Active Alarm</span>`;

      const div = document.createElement("div");
      div.className =
        "bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs flex items-center justify-between gap-3 shadow-sm";
      div.innerHTML = `
        <div class="space-y-1">
          <p class="font-bold text-slate-800">${item.note_content || "No note text"}</p>
          <span class="text-[11px] text-slate-500 font-mono flex items-center gap-1"><i class="fa-regular fa-clock text-slate-400"></i>${timeFormatted}</span>
        </div>
        <div class="flex items-center gap-2">
          ${statusBadge}
          ${!item.is_completed ? `<button onclick="markReminderCompleted(${item.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] cursor-pointer shadow">Done</button>` : ""}
        </div>
      `;
      container.appendChild(div);
    });
  } else {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">No notes or reminders found for this order.</span>`;
  }
}

// ৮. রিমাইন্ডার কমপ্লিট করা
async function markReminderCompleted(noteId) {
  await _supabase
    .from("order_notes")
    .update({ is_completed: true })
    .eq("id", noteId);
  showToast("Reminder marked as completed!");
  fetchOrderReminders();
}

// === EXACT LIVE ACTIVITY FEED TOAST SYNCHRONIZER ===

// ১. ফোন নম্বরের মাঝখানের ডিজিট *** দিয়ে হাইড করার ফাংশন
function maskPhoneNumbersInText(text) {
  if (!text) return "";
  return String(text).replace(/(\+?\d{4})\d+(\d{4})/g, "$1***$2");
}

// ২. টোস্ট রেন্ডার করার ফাংশন
function showActivityToast(type, message) {
  let container = document.getElementById("liveActivityToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "liveActivityToastContainer";
    container.className =
      "fixed bottom-5 left-5 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full";
    document.body.appendChild(container);
  }

  const isSuccess = type && type.toLowerCase().includes("success");
  const isOrder = type && type.toLowerCase().includes("order");

  let badgeClass = "bg-blue-500/20 text-blue-400 border-blue-500/30";
  let iconHtml = '<i class="fa-solid fa-bolt text-blue-400"></i>';

  if (isSuccess) {
    badgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    iconHtml = '<i class="fa-solid fa-circle-check text-emerald-400"></i>';
  } else if (isOrder) {
    badgeClass = "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
    iconHtml = '<i class="fa-solid fa-cart-shopping text-indigo-400"></i>';
  }

  const safeMaskedMessage = maskPhoneNumbersInText(message);

  const toast = document.createElement("div");
  toast.className =
    "pointer-events-auto bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 text-white p-3.5 rounded-2xl shadow-2xl flex items-start gap-3 transform transition-all duration-300 translate-y-4 opacity-0";

  toast.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
      ${iconHtml}
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${badgeClass}">
          ${type || "CANADA ORDER"}
        </span>
        <span class="text-[10px] text-slate-400 font-mono">Just Now</span>
      </div>
      <p class="text-xs text-slate-200 leading-snug break-words font-medium">${safeMaskedMessage}</p>
    </div>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-4", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");
  });

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-4", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ৩. ড্যাশবোর্ডের ফিডের মতো হুবহু মেসেজ তৈরি করে টোস্টে পাঠানোর রিয়েল-টাইম লিসেনার
function initLiveActivityToasts() {
  if (!_supabase || window._activityToastSubscribed) return;
  window._activityToastSubscribed = true;

  _supabase
    .channel("live-activity-toasts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "system_logs" },
      (payload) => {
        const log = payload.new;
        if (!log) return;

        // ড্যাশবোর্ডের ফিডে যেভাবে টাইপ ও মেসেজ তৈরি হয়
        const logType =
          log.action_type || log.type || log.event_type || "CANADA ORDER";
        const email = log.user_email || log.email || "user@nexa.com";
        const actionDesc =
          log.description ||
          log.action_desc ||
          log.message ||
          log.details ||
          "purchased Canada number";
        const phone = log.phone_number
          ? maskPhoneNumbersInText(log.phone_number)
          : log.number
            ? maskPhoneNumbersInText(log.number)
            : "";
        const orderId = log.order_id
          ? `(#${log.order_id.replace("#", "")})`
          : "";

        // হুবহু স্ক্রিনশটের ফিডের ফরম্যাট অনুযায়ী টেক্সট সাজানো
        // যেমন: nayan145@nexa.com purchased Canada stock number +122***7348 (#CAD-618219)
        const formattedMsg = `${email} ${actionDesc} ${phone} ${orderId}`
          .replace(/\s+/g, " ")
          .trim();

        showActivityToast(logType, formattedMsg);
      },
    )
    .subscribe();
}

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(initLiveActivityToasts, 1500);
});
