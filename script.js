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

// DOM Elements
const loginOverlay = document.getElementById("loginOverlay");
const appMain = document.getElementById("appMain");
const currentUserEmail = document.getElementById("currentUserEmail");
const navAdminUsers = document.getElementById("navAdminUsers");

const dashboardView = document.getElementById("dashboardView");
const whatsappView = document.getElementById("whatsappView");
const adminUsersView = document.getElementById("adminUsersView");

const navDashboard = document.getElementById("navDashboard");
const navWhatsapp = document.getElementById("navWhatsapp");

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
    .insert([{ email: email, password: password, role: "user" }]);

  if (!error) {
    showToast("User Account Created Successfully!");
    document.getElementById("newUserEmail").value = "";
    document.getElementById("newUserPassword").value = "";
    loadAllUsersAdmin();
  } else {
    alert("Error creating user: " + error.message);
  }
}

async function loadAllUsersAdmin() {
  if (!adminUsersTableBody) return;

  const { data, error } = await _supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (data && data.length > 0) {
    adminUsersTableBody.innerHTML = "";
    data.forEach((u) => {
      let roleBadge =
        u.role === "admin"
          ? `<span class="bg-amber-50 text-amber-700 border border-amber-200/80 px-2.5 py-1 rounded-lg text-xs font-bold">admin</span>`
          : `<span class="bg-slate-100 text-slate-600 border border-slate-200/80 px-2.5 py-1 rounded-lg text-xs font-bold">user</span>`;

      const row = document.createElement("tr");
      row.className = "hover:bg-slate-50/80 transition";
      row.innerHTML = `
        <td class="py-3.5 px-4 font-semibold text-slate-900">${u.email}</td>
        <td class="py-3.5 px-4">${roleBadge}</td>
        <td class="py-3.5 px-4 text-xs font-medium text-slate-400">${new Date(u.created_at).toLocaleDateString()}</td>
        <td class="py-3.5 px-4 text-center space-x-2">
          <button onclick="editUserInfo('${u.id}', '${u.email}', '${u.password || ""}', '${u.role}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer" title="Edit User Credentials">
            <i class="fa-solid fa-user-pen mr-1"></i> Edit User
          </button>
          <button onclick="deleteUser('${u.id}', '${u.email}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer" title="Delete User">
            <i class="fa-solid fa-trash-can mr-1"></i> Delete
          </button>
        </td>
      `;
      adminUsersTableBody.appendChild(row);
    });
  } else {
    adminUsersTableBody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400 font-normal">No user accounts found.</td></tr>`;
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
// DOM Elements section-e jog করুন:
const reportView = document.getElementById("reportView");
const navReport = document.getElementById("navReport");

// switchTab Function-টি এভাবে আপডেট করুন:
function switchTab(tab) {
  stopSmartActivityPolling();

  if (tab === "adminUsers") {
    if (!loggedInUser || loggedInUser.role !== "admin") {
      showToast("Access Denied! Administrator only.", true);
      switchTab("dashboard");
      return;
    }
  }

  dashboardView.classList.add("hidden");
  whatsappView.classList.add("hidden");
  adminUsersView.classList.add("hidden");
  if (reportView) reportView.classList.add("hidden");

  const activeNav =
    "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-all w-full text-left";
  const inactiveNav =
    "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl hover:bg-slate-800/60 text-slate-300 hover:text-white transition-all w-full text-left";

  if (navDashboard) navDashboard.className = inactiveNav;
  if (navWhatsapp) navWhatsapp.className = inactiveNav;
  if (navReport) navReport.className = inactiveNav;
  if (navAdminUsers)
    navAdminUsers.className = inactiveNav + " border border-amber-500/20";

  if (tab === "dashboard") {
    dashboardView.classList.remove("hidden");
    if (navDashboard) navDashboard.className = activeNav;
    fetchDashboardStats();
    fetchGlobalActivityLog();
    startSmartActivityPolling();
  } else if (tab === "whatsapp") {
    whatsappView.classList.remove("hidden");
    if (navWhatsapp) navWhatsapp.className = activeNav;

    if (orderCard && !orderCard.classList.contains("hidden")) {
      if (historySection) historySection.classList.add("hidden");
    } else {
      if (historySection) historySection.classList.remove("hidden");
      fetchOrderHistory();
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

// === RECORD SYSTEM ACTIVITY LOG ===
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

// === BUY NUMBER & ACTIVE ORDER FUNCTIONS ===
async function buyNumber() {
  if (!loggedInUser) return;

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

      await _supabase.from("orders").insert([
        {
          order_id: String(currentOrderId),
          phone_number: phoneNumStr,
          otp: "Waiting...",
          status: "Confirmed",
          user_email: loggedInUser.email,
        },
      ]);

      // Record system activity log without replacing any old rows
      await recordSystemLog(
        loggedInUser.email,
        "NEW_ORDER",
        String(currentOrderId),
        phoneNumStr,
      );

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
      startAutoPolling();
    } else {
      showToast("Failed: " + (data.message || JSON.stringify(data)), true);
    }
  } catch (e) {
    showToast("Error buying number: " + e.message, true);
  } finally {
    btnBuyNumber.disabled = false;
    btnBuyNumber.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Buy WhatsApp Number`;
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

      // Record OTP received log event
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

    // Record separate Canceled log event
    await recordSystemLog(
      loggedInUser.email,
      "CANCELED",
      String(currentOrderId),
      phoneNumber.innerText,
    );

    resetToBuyView();
    checkBalance();
    fetchDashboardStats();
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
          "bg-slate-100 text-slate-400 border border-slate-200 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-60";
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
  statusToast.innerText = message;
  statusToast.classList.remove("hidden");
  if (isError) {
    statusToast.className =
      "p-4 rounded-xl text-sm font-medium text-center shadow-sm bg-rose-50 text-rose-700 border border-rose-200";
  } else {
    statusToast.className =
      "p-4 rounded-xl text-sm font-medium text-center shadow-sm bg-emerald-50 text-emerald-700 border border-emerald-200";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("nexaUser");
  if (savedUser) {
    loggedInUser = JSON.parse(savedUser);
    initUserSession();
  }
});

let activityLogInterval = null;
let activityChannel = null;

// === FETCH & RENDER SYSTEM ACTIVITY LOG (EXPLICIT TIME SORTING - CHAT STYLE) ===
async function fetchGlobalActivityLog() {
  const container = document.getElementById("globalActivityLog");
  if (!container || !_supabase) return;

  // Latest 30 ta data base theke niye asha hocche
  const { data, error } = await _supabase
    .from("system_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (data && data.length > 0) {
    // Explicit Time-based Sorting: created_at time onujaayi purono theke notun (ascending) sort kora
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

    // Chat er moto automatic ekdom niche scroll hoye jabe
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  } else {
    container.innerHTML = `<div class="text-slate-500 italic py-2">No platform activity recorded yet.</div>`;
  }
}

let smartPollingInterval = null;
let lastKnownLogId = null;

// === SMART POLLING: Refreshes ONLY when new activity is added ===
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

  const { data, error } = await _supabase
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
      fetchGlobalActivityLog(); // 🟢 নতুন ডেটা আসলে তবেই ফিড রিফ্রেশ ও চ্যাট স্ক্রোল হবে!
    }
  }
}

// === FETCH & RENDER SYSTEM ACTIVITY LOG (TIME SORTED & CHAT STYLE AT BOTTOM) ===
async function fetchGlobalActivityLog() {
  const container = document.getElementById("globalActivityLog");
  if (!container || !_supabase) return;

  const { data, error } = await _supabase
    .from("system_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (data && data.length > 0) {
    // Explicit Time-based Sorting: পুরনো উপরে, নতুন একদম নিচে
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

    // চ্যাটবক্সের মতো একদম নিচে অটো-স্ক্রোল হবে
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  } else {
    container.innerHTML = `<div class="text-slate-500 italic py-2">No platform activity recorded yet.</div>`;
  }
}

// === LOAD ALL USERS REPORT SHEET (WITH PER-USER VIEW BUTTON) ===
async function loadAllUserReportSheet() {
  if (!_supabase) return;
  const todayStr = new Date().toISOString().split("T")[0];
  const topWinnerCard = document.getElementById("topWinnerCard");
  const otherUsersList = document.getElementById("otherUsersList");
  if (!topWinnerCard || !otherUsersList) return;

  const { data: usersData } = await _supabase
    .from("user_profiles")
    .select("email");

  const { data: ordersData } = await _supabase
    .from("orders")
    .select("*")
    .gte("created_at", todayStr);

  if (usersData && usersData.length > 0) {
    const userReports = usersData.map((user) => {
      const userOrders = ordersData
        ? ordersData.filter((o) => o.user_email === user.email)
        : [];
      let bought = userOrders.length;
      let otps = userOrders.filter(
        (o) => o.otp && o.otp !== "Waiting..." && o.otp !== "N/A",
      ).length;
      let canceled = userOrders.filter(
        (o) => o.status === "Canceled & Refunded" || o.status === "Canceled",
      ).length;
      let investment = otps * 20;

      return {
        email: user.email,
        bought: bought,
        otps: otps,
        canceled: canceled,
        investment: investment,
      };
    });

    userReports.sort((a, b) => b.investment - a.investment);

    const firstUser = userReports[0];
    const otherUsers = userReports.slice(1);

    // 1st Place Winner Card (With Lifetime View Button)
    if (firstUser && firstUser.investment > 0) {
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
            <i class="fa-solid fa-crown mr-1 text-amber-400"></i> Top Performer of Today
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
              <span class="text-slate-400 block mb-1 font-medium">OTPs Received</span>
              <span class="text-emerald-400 font-black text-base">${firstUser.otps}</span>
            </div>
            <div class="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
              <span class="text-slate-400 block mb-1 font-medium">Canceled</span>
              <span class="text-rose-400 font-black text-base">${firstUser.canceled}</span>
            </div>
            <div class="bg-slate-950/60 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
              <span class="text-amber-300 block mb-1 font-medium">Total Spent</span>
              <span class="text-amber-400 font-black text-base">৳${firstUser.investment.toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      topWinnerCard.classList.add("hidden");
    }

    // Other Performers List (With Individual View Button)
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
              <p class="text-[11px] text-slate-500 font-medium mt-0.5">Bought: <span class="text-blue-600 font-bold">${user.bought}</span> | OTP: <span class="text-emerald-600 font-bold">${user.otps}</span> | Canceled: <span class="text-rose-600 font-bold">${user.canceled}</span></p>
            </div>
          </div>
          <div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 pt-2 sm:pt-0 border-slate-200">
            <button onclick="openUserLifetimeModal('${user.email}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1">
              <i class="fa-solid fa-eye"></i> View Report
            </button>
            <span class="text-sm font-black text-amber-600 font-mono">৳${user.investment.toFixed(2)}</span>
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

// === OPEN SPECIFIC USER LIFETIME REPORT MODAL ===
async function openUserLifetimeModal(targetEmail) {
  const modal = document.getElementById("userLifetimeModal");
  const modalEmail = document.getElementById("modalUserEmail");
  const tbody = document.getElementById("userLifetimeTableBody");

  if (modal) modal.classList.remove("hidden");
  if (modalEmail) modalEmail.innerText = `Report for: ${targetEmail}`;
  if (!tbody || !_supabase) return;

  tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">Loading user history...</td></tr>`;

  const { data } = await _supabase
    .from("orders")
    .select("*")
    .eq("user_email", targetEmail)
    .order("created_at", { ascending: false });

  if (data && data.length > 0) {
    const grouped = {};
    data.forEach((order) => {
      const dateStr = new Date(order.created_at).toISOString().split("T")[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = { bought: 0, otps: 0, canceled: 0 };
      }
      grouped[dateStr].bought += 1;
      if (order.otp && order.otp !== "Waiting..." && order.otp !== "N/A") {
        grouped[dateStr].otps += 1;
      }
      if (
        order.status === "Canceled & Refunded" ||
        order.status === "Canceled"
      ) {
        grouped[dateStr].canceled += 1;
      }
    });

    tbody.innerHTML = "";
    Object.keys(grouped).forEach((date) => {
      const info = grouped[date];
      const inv = info.otps * 20;
      const row = document.createElement("tr");
      row.className = "hover:bg-slate-50 transition";
      row.innerHTML = `
        <td class="py-3 px-4 font-mono text-xs font-bold text-slate-800">${date}</td>
        <td class="py-3 px-4 text-blue-600 font-bold">${info.bought}</td>
        <td class="py-3 px-4 text-emerald-600 font-bold">${info.otps}</td>
        <td class="py-3 px-4 text-rose-600 font-bold">${info.canceled}</td>
        <td class="py-3 px-4 text-amber-600 font-bold">৳${inv.toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">No activity history found for this user.</td></tr>`;
  }
}

// === CLOSE USER LIFETIME REPORT MODAL ===
function closeUserLifetimeModal() {
  const modal = document.getElementById("userLifetimeModal");
  if (modal) modal.classList.add("hidden");
}

// === OPEN ALL DAYS REPORT MODAL ===
async function openAllDaysModal() {
  const modal = document.getElementById("allDaysModal");
  if (modal) modal.classList.remove("hidden");

  const tbody = document.getElementById("allDaysReportTableBody");
  if (!tbody || !_supabase || !loggedInUser) return;

  const { data } = await _supabase
    .from("orders")
    .select("*")
    .eq("user_email", loggedInUser.email)
    .order("created_at", { ascending: false });

  if (data && data.length > 0) {
    const grouped = {};
    data.forEach((order) => {
      const dateStr = new Date(order.created_at).toISOString().split("T")[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = { bought: 0, otps: 0, canceled: 0 };
      }
      grouped[dateStr].bought += 1;
      if (order.otp && order.otp !== "Waiting..." && order.otp !== "N/A") {
        grouped[dateStr].otps += 1;
      }
      if (
        order.status === "Canceled & Refunded" ||
        order.status === "Canceled"
      ) {
        grouped[dateStr].canceled += 1;
      }
    });

    tbody.innerHTML = "";
    Object.keys(grouped).forEach((date) => {
      const info = grouped[date];
      const inv = info.otps * 20;
      const row = document.createElement("tr");
      row.className = "hover:bg-slate-50 transition";
      row.innerHTML = `
        <td class="py-3 px-4 font-mono text-xs font-bold text-slate-800">${date}</td>
        <td class="py-3 px-4 text-blue-600 font-bold">${info.bought}</td>
        <td class="py-3 px-4 text-emerald-600 font-bold">${info.otps}</td>
        <td class="py-3 px-4 text-rose-600 font-bold">${info.canceled}</td>
        <td class="py-3 px-4 text-amber-600 font-bold">৳${inv.toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400">No report history found.</td></tr>`;
  }
}

// === CLOSE ALL DAYS REPORT MODAL ===
function closeAllDaysModal() {
  const modal = document.getElementById("allDaysModal");
  if (modal) modal.classList.add("hidden");
}
