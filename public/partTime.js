// Global variables
let partnerProfile = null;
let availableOrders = [];
let acceptedOrders = [];

// DOM Elements
const dashboardTab = document.querySelector('[data-tab="dashboard"]');
const acceptedOrdersTab = document.querySelector('[data-tab="accepted-orders"]');
const performanceTab = document.querySelector('[data-tab="performance"]');
const tabContents = document.querySelectorAll('.tab-content');
const orderList = document.getElementById('order-list');
const acceptedOrderList = document.getElementById('accepted-order-list');
const redeemEarningsBtn = document.getElementById('redeem-earnings');
const totalEarningsSpan = document.getElementById('total-earnings');
const currentBalanceSpan = document.getElementById('current-balance');
const totalOrdersSpan = document.getElementById('total-orders');
const successRateSpan = document.getElementById('success-rate');
const recentActivityList = document.getElementById('recent-activity');
const timestampHistoryList = document.getElementById('timestamp-history');
const notificationContainer = document.getElementById('notification-container');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalActions = document.getElementById('modal-actions');
const closeModal = document.querySelector('.close');

// Event Listeners
dashboardTab.addEventListener('click', () => showTab('dashboard'));
acceptedOrdersTab.addEventListener('click', () => {
  showTab('accepted-orders');
  fetchAcceptedOrders(); // Refresh accepted orders when tab is clicked
});
performanceTab.addEventListener('click', () => showTab('performance'));
redeemEarningsBtn.addEventListener('click', redeemEarnings);
closeModal.addEventListener('click', () => modal.style.display = 'none');

// Functions
function showTab(tabName) {
  document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  tabContents.forEach(content => content.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
}

async function fetchPartnerProfile() {
  try {
    const token = localStorage.getItem('partTimeToken');
    if (!token) {
      window.location.href = '/partTime_auth.html';
      return;
    }

    const response = await fetch('/api/partTime/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }

    partnerProfile = await response.json();
    updateProfileUI(partnerProfile);
    initializePerformanceChart();
  } catch (error) {
    console.error('Error fetching profile:', error);
    showNotification('Failed to load profile', 'error');
  }
}

async function fetchPartnerStatistics() {
  try {
    const token = localStorage.getItem('partTimeToken');
    if (!token) {
      window.location.href = '/partTime_auth.html';
      return;
    }

    const response = await fetch('/api/partTime/statistics', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch statistics');
    }

    const statistics = await response.json();
    updateStatisticsUI(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    showNotification('Failed to load statistics', 'error');
  }
}

function updateProfileUI(profile) {
  document.getElementById('partner-name').textContent = profile.fullName;
  document.getElementById('partner-id').textContent = `ID: ${profile.uidNo}`;
  document.getElementById('total-deliveries').textContent = `Total Deliveries: ${profile.totalDeliveries}`;
  
  if (profile.profilePic) {
    document.getElementById('profile-picture').src = profile.profilePic;
  }
}

function calculateStrikeRate(totalOrders, totalDeliveries) {
  if (totalOrders === 0) return '0%';
  return ((totalDeliveries / totalOrders) * 100).toFixed(2) + '%';
}

function updateStatisticsUI(statistics) {
  totalOrdersSpan.textContent = statistics.totalOrders;
  totalEarningsSpan.textContent = statistics.totalEarnings.toFixed(2);
  currentBalanceSpan.textContent = statistics.currentBalance.toFixed(2);
  redeemEarningsBtn.disabled = statistics.currentBalance < 100;
  
  // Add this line to update the strike rate
  const strikeRate = calculateStrikeRate(statistics.totalOrders, statistics.totalDeliveries);
  document.getElementById('strike-rate').textContent = strikeRate;
}

async function fetchAvailableOrders() {
  try {
    const token = localStorage.getItem('partTimeToken');
    if (!token) {
      window.location.href = '/partTime_auth.html';
      return;
    }

    const response = await fetch('/api/partTime/available-orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }

    availableOrders = await response.json();
    displayOrders();
  } catch (error) {
    console.error('Error fetching orders:', error);
    showNotification('Failed to load orders', 'error');
  }
}

async function fetchAcceptedOrders() {
  try {
    const token = localStorage.getItem('partTimeToken');
    if (!token) {
      window.location.href = '/partTime_auth.html';
      return;
    }

    const response = await fetch('/api/partTime/accepted-orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch accepted orders');
    }

    acceptedOrders = await response.json();
    displayAcceptedOrders();
  } catch (error) {
    console.error('Error fetching accepted orders:', error);
    showNotification('Failed to load accepted orders', 'error');
  }
}

function displayOrders() {
  orderList.innerHTML = '';

  if (availableOrders.length === 0) {
    orderList.innerHTML = '<p>No available orders at the moment.</p>';
    return;
  }

  availableOrders.forEach(order => {
    const orderCard = createOrderCard(order, true);
    orderList.appendChild(orderCard);
  });
}

function displayAcceptedOrders() {
  acceptedOrderList.innerHTML = '';

  if (acceptedOrders.length === 0) {
    acceptedOrderList.innerHTML = '<p>No accepted orders at the moment.</p>';
    return;
  }

  acceptedOrders.forEach(order => {
    const orderCard = createAcceptedOrderCard(order);
    acceptedOrderList.appendChild(orderCard);
  });
}

function createOrderCard(order, isAvailable) {
  const orderCard = document.createElement('div');
  orderCard.className = 'order-card';
  orderCard.innerHTML = `
    <h3>Order ${order.orderId}</h3>
    <p>Restaurant: ${order.restaurantName} | ${order.restaurantDistance} km away</p>
    <p>Pickup at: ${new Date(order.pickupTime).toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    })}</p>
    <p>Destination: ${order.destinationDistance} km from restaurant</p>
    <p>Deliver at: ${new Date(order.deliveryTime).toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    })}</p>
    <div class="earnings">₹${order.earnings.toFixed(2)}</div>
    <div class="order-actions">
      ${isAvailable ? 
        `<button class="accept-btn" onclick="acceptOrder('${order.orderId}')">Accept Delivery</button>` :
        `
        <button class="pickup-btn" onclick="updateOrderStatus('${order.orderId}', 'picked_up')">Picked Up</button>
        <button class="deliver-btn" onclick="updateOrderStatus('${order.orderId}', 'delivered')">Delivered</button>
        `
      }
    </div>
  `;
  return orderCard;
}

function createAcceptedOrderCard(order) {
  const orderCard = document.createElement('div');
  orderCard.className = 'order-card';
  
  // Add status indicator
  let statusIndicator = '';
  if (order.status === 'ready') {
    statusIndicator = '<span class="status-badge not-picked">Not Picked</span>';
  } else if (order.status === 'out_for_delivery') {
    statusIndicator = '<span class="status-badge picked">Picked</span>';
  }

  orderCard.innerHTML = `
    <div class="order-header">
      <h3>Order ${order.orderId}</h3>
      ${statusIndicator}
    </div>
    <p><strong>Restaurant:</strong> ${order.restaurantName} | ${order.restaurantDistance} km away</p>
    <p><strong>Customer:</strong> ${order.userName}</p>
    <p><strong>Contact:</strong> ${order.contactNumber}</p>
    <p><strong>Destination:</strong> ${order.destinationDistance} km from restaurant</p>
    <p><strong>Pickup at:</strong> ${new Date(order.pickupTime).toLocaleString()}</p>
    <p><strong>Deliver by:</strong> ${new Date(order.deliveryTime).toLocaleString()}</p>
    <h4>Items:</h4>
    <ul>
      ${order.items.map(item => `<li>${item.name} x ${item.quantity}</li>`).join('')}
    </ul>
    <div class="earnings">₹${order.earnings.toFixed(2)}</div>
    <div class="order-actions">
      ${order.status === 'out_for_delivery' ?
        `<button class="deliver-btn" onclick="updateOrderStatus('${order.orderId}', 'delivered')">Mark Delivered</button>` :
        ''
      }
      <button class="cancel-btn" onclick="cancelOrder('${order.orderId}')">Cancel Order</button>
    </div>
  `;
  return orderCard;
}

async function acceptOrder(orderId) {
  try {
    const token = localStorage.getItem('partTimeToken');
    const response = await fetch(`/api/partTime/orders/${orderId}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to accept order');
    }

    const orderIndex = availableOrders.findIndex(order => order.orderId === orderId);
    if (orderIndex !== -1) {
      const acceptedOrder = availableOrders.splice(orderIndex, 1)[0];
      acceptedOrder.status = 'ready';
      acceptedOrders.push(acceptedOrder);
      displayOrders();
      displayAcceptedOrders();
      showNotification(`Order ${orderId} accepted`, 'success');
      addTimestamp(`Accepted order ${orderId}`);
      updateRecentActivity(`Accepted order ${orderId}`);
      updateDashboard();
    }

    // Refresh both available and accepted orders
    await fetchAvailableOrders();
    await fetchAcceptedOrders();
    await fetchPartnerStatistics(); // Refresh partner statistics
  } catch (error) {
    console.error('Error accepting order:', error);
    showNotification('Failed to accept order', 'error');
  }
}
async function updateOrderStatus(orderId, status) {
  try {
    const token = localStorage.getItem('partTimeToken');
    let requestBody = { status };

    if (status === 'delivered') {
      const verificationCode = prompt('Please enter the verification code:');
      if (!verificationCode) {
        showNotification('Verification code is required', 'error');
        return;
      }
      requestBody.verificationCode = verificationCode;
    }

    const response = await fetch(`/api/partTime/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update order status');
    }

    if (status === 'delivered') {
      // Remove from accepted orders and fetch completed orders
      const orderIndex = acceptedOrders.findIndex(order => order.orderId === orderId);
      if (orderIndex !== -1) {
        const completedOrder = acceptedOrders.splice(orderIndex, 1)[0];
        updateEarnings(completedOrder.earnings);
      }
      await fetchCompletedOrders();
      await fetchPartnerStatistics(); // Refresh partner statistics
    }

    showNotification(`Order ${orderId} ${status}`, 'success');
    await fetchAcceptedOrders(); // Refresh accepted orders
  } catch (error) {
    console.error('Error updating order status:', error);
    showNotification(error.message || 'Failed to update order status', 'error');
  }
}

async function cancelOrder(orderId) {
  try {
    const token = localStorage.getItem('partTimeToken');
    const response = await fetch(`/api/partTime/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to cancel order');
    }

    showNotification(`Order ${orderId} cancelled`, 'success');
    await fetchAcceptedOrders();
    await fetchPartnerStatistics();
  } catch (error) {
    console.error('Error cancelling order:', error);
    showNotification('Failed to cancel order', 'error');
  }
}

function updateEarnings(amount) {
  const currentBalance = parseFloat(currentBalanceSpan.textContent);
  const newBalance = currentBalance + amount;
  currentBalanceSpan.textContent = newBalance.toFixed(2);
  
  const totalEarnings = parseFloat(totalEarningsSpan.textContent);
  totalEarningsSpan.textContent = (totalEarnings + amount).toFixed(2);
  
  redeemEarningsBtn.disabled = newBalance < 100;
}

function redeemEarnings() {
  const currentBalance = parseFloat(currentBalanceSpan.textContent);
  showModal('Redeem Earnings', `
    <p>Current Balance: ₹${currentBalance.toFixed(2)}</p>
    <p>Enter amount to redeem:</p>
    <input type="number" id="redeem-amount" min="100" max="${currentBalance}" step="0.01" value="${currentBalance.toFixed(2)}">
  `, [
    { text: 'Redeem', onClick: confirmRedeemEarnings },
    { text: 'Cancel', onClick: () => modal.style.display = 'none' }
  ]);
}

async function confirmRedeemEarnings() {
  const redeemAmount = parseFloat(document.getElementById('redeem-amount').value);
  const currentBalance = parseFloat(currentBalanceSpan.textContent);

  if (redeemAmount < 100 || redeemAmount > currentBalance) {
    showNotification('Invalid redeem amount', 'error');
    return;
  }

  try {
    const token = localStorage.getItem('partTimeToken');
    const response = await fetch('/api/partTime/redeem', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount: redeemAmount })
    });

    if (!response.ok) {
      throw new Error('Failed to redeem earnings');
    }

    const newBalance = currentBalance - redeemAmount;
    currentBalanceSpan.textContent = newBalance.toFixed(2);
    showNotification(`Successfully redeemed ₹${redeemAmount.toFixed(2)}`, 'success');
    modal.style.display = 'none';
    updateRecentActivity(`Redeemed ₹${redeemAmount.toFixed(2)}`);
    redeemEarningsBtn.disabled = newBalance < 100;
  } catch (error) {
    console.error('Error redeeming earnings:', error);
    showNotification('Failed to redeem earnings', 'error');
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notificationContainer.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function showModal(title, message, actions) {
  modalTitle.textContent = title;
  modalMessage.innerHTML = message;
  modalActions.innerHTML = '';
  actions.forEach(action => {
    const button = document.createElement('button');
    button.textContent = action.text;
    button.onclick = action.onClick;
    modalActions.appendChild(button);
  });
  modal.style.display = 'block';
}

function addTimestamp(action) {
  const timestamp = new Date().toLocaleString();
  const listItem = document.createElement('li');
  listItem.textContent = `${timestamp} - ${action}`;
  timestampHistoryList.prepend(listItem);
}

function updateRecentActivity(activity) {
  const listItem = document.createElement('li');
  listItem.textContent = activity;
  recentActivityList.prepend(listItem);
  if (recentActivityList.children.length > 5) {
    recentActivityList.removeChild(recentActivityList.lastChild);
  }
}

function updateDashboard() {
  fetchPartnerStatistics();
}

function initializePerformanceChart() {
  const ctx = document.getElementById('performance-chart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Total Orders', 'Completed Orders', 'Cancellations'],
      datasets: [{
        label: 'Performance Metrics',
        data: [
          partnerProfile.totalOrders,
          partnerProfile.totalDeliveries,
          partnerProfile.totalOrders - partnerProfile.totalDeliveries
        ],
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 99, 132, 0.6)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

async function fetchCompletedOrders() {
  try {
    const token = localStorage.getItem('partTimeToken');
    const response = await fetch('/api/partTime/completed-orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch completed orders');
    }

    const completedOrders = await response.json();
    displayCompletedOrders(completedOrders);
  } catch (error) {
    console.error('Error fetching completed orders:', error);
    showNotification('Failed to load completed orders', 'error');
  }
}

function displayCompletedOrders(completedOrders) {
  const timestampHistoryList = document.getElementById('timestamp-history');
  timestampHistoryList.innerHTML = '';

  completedOrders.forEach(order => {
    const listItem = document.createElement('li');
    const completedDate = new Date(order.completedAt);
    listItem.innerHTML = `
      ${completedDate.toLocaleString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })} Order #${order.orderId} completed Earnings: ₹${order.earnings.toFixed(2)}
    `;
    timestampHistoryList.appendChild(listItem);
  });
}

// Initialize the application
async function init() {
  await fetchPartnerProfile();
  await fetchPartnerStatistics();
  await fetchAvailableOrders();
  await fetchAcceptedOrders();
  await fetchCompletedOrders();
  updateDashboard();
  initializePerformanceChart();
  showTab('dashboard');

  // Fetch new orders every 30 seconds
  setInterval(fetchAvailableOrders, 30000);
  setInterval(fetchAcceptedOrders, 30000);
  setInterval(fetchCompletedOrders, 30000);
}

init();

