document.addEventListener('DOMContentLoaded', () => {
    const ordersContainer = document.getElementById('ordersContainer');
    const orderTypeFilter = document.getElementById('orderTypeFilter');
    const cartBadge = document.getElementById('cartBadge');
    const homeBtn = document.getElementById('homeBtn');
    const cartBtn = document.getElementById('cartBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const userToken = localStorage.getItem('userToken');
    if (!userToken) {
        window.location.href = 'user_auth.html';
        return;
    }

    // Initialize
    fetchOrders();
    updateCartBadge();

    // Event Listeners
    homeBtn.addEventListener('click', () => {
        window.location.href = 'main_user.html';
    });

    cartBtn.addEventListener('click', () => {
        window.location.href = 'cart.html';
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('userToken');
        window.location.href = 'user_auth.html';
    });

    orderTypeFilter.addEventListener('change', () => {
        const orders = JSON.parse(localStorage.getItem('userOrders') || '[]');
        displayOrders(orders);
    });

    async function fetchOrders() {
        try {
            const response = await fetch('/api/user/orders', {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            if (response.ok) {
                const orders = await response.json();
                localStorage.setItem('userOrders', JSON.stringify(orders));
                displayOrders(orders);
            } else {
                console.error('Failed to fetch orders');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function displayOrders(orders) {
        const filterType = orderTypeFilter.value;
        
        // Filter orders based on selection
        const filteredOrders = filterType === 'current' 
            ? orders.filter(order => !['completed', 'cancelled'].includes(order.status))
            : orders.filter(order => ['completed', 'cancelled'].includes(order.status));

        ordersContainer.innerHTML = '';

        if (filteredOrders.length === 0) {
            ordersContainer.innerHTML = `<p>No ${filterType === 'current' ? 'active' : 'past'} orders</p>`;
            return;
        }

        filteredOrders.forEach(order => {
            const orderElement = createOrderElement(order);
            ordersContainer.appendChild(orderElement);
        });
    }

    function createStatusTimeline(order) {
        const statuses = order.deliveryOption === 'pickup' 
            ? ['pending', 'preparing', 'ready', 'completed']
            : ['pending', 'preparing', 'ready', 'out_for_delivery', 'completed'];
        const statusLabels = order.deliveryOption === 'pickup'
            ? ['Not Started', 'Preparing', 'Ready for Pickup', 'Completed']
            : ['Not Started', 'Preparing', 'Ready', 'Out for Delivery', 'Completed'];
        const currentIndex = statuses.indexOf(order.status);

        const timelineHtml = statuses.map((status, index) => {
            let statusClass = 'upcoming';
            if (index < currentIndex) {
                statusClass = 'completed';
            } else if (index === currentIndex) {
                statusClass = 'current';
            }

            let estimatedTime = '';
            if (status === 'pending') {
                estimatedTime = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            } else if (status === 'preparing') {
                const prepTime = new Date(order.specificTime);
                prepTime.setMinutes(prepTime.getMinutes() - order.maxPrepTime - 15);
                estimatedTime = prepTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            } else if (status === 'ready' || status === 'out_for_delivery') {
                const readyTime = new Date(order.specificTime);
                readyTime.setMinutes(readyTime.getMinutes() - 15);
                estimatedTime = readyTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            } else if (status === 'completed') {
                estimatedTime = new Date(order.specificTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            }

            return `
                <div class="status-point ${statusClass}" data-status="${statusLabels[index]}">
                    <div class="status-dot"></div>
                    <div class="status-label">${statusLabels[index]}</div>
                    <div class="status-time">${estimatedTime}</div>
                </div>
            `;
        }).join('');

        const completedWidth = (currentIndex / (statuses.length - 1)) * 100;

        return `
            <div class="status-timeline">
                <div class="status-line status-line-completed" style="width: ${completedWidth}%;"></div>
                <div class="status-line status-line-remaining" style="width: ${100 - completedWidth}%; left: ${completedWidth}%;"></div>
                ${timelineHtml}
            </div>
        `;
    }

    function createOrderElement(order) {
        const orderElement = document.createElement('div');
        orderElement.className = 'order-item';
        
        const orderDate = new Date(order.createdAt);
        const formattedDate = `${orderDate.getDate().toString().padStart(2, '0')}/` +
        `${(orderDate.getMonth() + 1).toString().padStart(2, '0')}/` +
        `${orderDate.getFullYear()}, ` +
        `${orderDate.toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })}`;
        

        const isCompletedOrCancelled = order.status === 'completed' || order.status === 'cancelled';
        const isActiveOrder = !isCompletedOrCancelled;
        
        orderElement.innerHTML = `
            <span class="order-date">${formattedDate}</span>
            <h4>Order #${order._id}</h4>
            <p>Restaurant: ${order.restaurantId.restaurantName}</p>
            <h5>Ordered Items:</h5>
            <ul>
                ${order.items.map(item => `
                    <li>${item.menuItem.name} x ${item.quantity} - ₹${item.totalPrice.toFixed(2)}</li>
                `).join('')}
            </ul>
            <p>Total Amount: ₹${order.totalAmount.toFixed(2)}</p>
            ${isCompletedOrCancelled ? 
                `<div class="order-status ${order.status === 'completed' ? 'status-completed' : 'status-cancelled'}">
                    ${order.status === 'completed' ? 'Order Successfully Completed' : 'Order Cancelled'}
                </div>` : 
                createStatusTimeline(order)
            }
            ${isActiveOrder && order.verificationCode ? 
                `<div class="verification-code">
                    <p class="code">Verification Code: <span style="color: red;">${order.verificationCode}</span></p>
                    <p class="note" style="color: red;">Share this code only when the order is received.</p>
                </div>` : 
                ''
            }
            ${order.status === 'pending' ? 
                '<button class="cancel-order-btn" data-order-id="' + order._id + '">Cancel Order</button>' : 
                order.status === 'preparing' ? 
                '<button class="cancel-order-btn" data-order-id="' + order._id + '" disabled>Cancel Order</button>' : 
                ''
            }
        `;

        if (order.status === 'pending') {
            const cancelBtn = orderElement.querySelector('.cancel-order-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => cancelOrder(order._id));
            }
        }

        return orderElement;
    }

    async function cancelOrder(orderId) {
        if (confirm('Are you sure you want to cancel this order?')) {
            try {
                const response = await fetch(`/api/user/orders/${orderId}/cancel`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${userToken}`
                    }
                });
                if (response.ok) {
                    alert('Order cancelled successfully');
                    fetchOrders();
                } else {
                    console.error('Failed to cancel order');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }

    async function updateCartBadge() {
        try {
            const response = await fetch('/api/cart', {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            if (response.ok) {
                const cart = await response.json();
                const totalItems = cart.restaurants.reduce((sum, restaurant) => 
                    sum + restaurant.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
                cartBadge.textContent = totalItems;
            } else {
                console.error('Failed to fetch cart');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
});

