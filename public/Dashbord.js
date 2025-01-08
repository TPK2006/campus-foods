document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const addMenuItemForm = document.getElementById('addMenuItemForm');
    const menuItemsContainer = document.getElementById('menuItems');
    const ownerProfileForm = document.getElementById('ownerProfileForm');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const logoutButton = document.getElementById('logoutButton');
    const restaurantImage = document.getElementById('restaurantImage');
    const imagePreview = document.getElementById('imagePreview');
    const chooseCurrentLocationBtn = document.getElementById('chooseCurrentLocation');
    const addToppingBtn = document.getElementById('addToppingBtn');
    const toppingsList = document.getElementById('toppingsList');
    const addSizeBtn = document.getElementById('addSizeBtn');
    const sizesList = document.getElementById('sizesList');
    const ordersList = document.getElementById('ordersList');

    const imageInput = document.getElementById('image');
    const menuImagePreview = document.getElementById('menuImagePreview');

    let map, marker, polygonBoundary;

    // Updated code for menu toggle
    const menuTab = document.getElementById('menu');
    const menuItemsSection = document.getElementById('menuItems');
    const menuToggle = document.querySelector('.menu-toggle');

    // Function to toggle menu sections
    function toggleMenuSections(showAddNewItem = false) {
        if (showAddNewItem || menuToggle.value === 'addNewItem') {
            menuItemsSection.style.display = 'none';
            addMenuItemForm.style.display = 'block';
            menuToggle.value = 'addNewItem';
        } else {
            menuItemsSection.style.display = 'grid';
            addMenuItemForm.style.display = 'none';
        }
    }

    // Initial toggle
    toggleMenuSections();

    // Add event listener for toggle changes
    menuToggle.addEventListener('change', () => toggleMenuSections());

    function setActiveTab(tabName) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(tabName);

        if (activeButton && activeContent) {
            activeButton.classList.add('active');
            activeContent.classList.add('active');
            localStorage.setItem('activeTab', tabName);
            
            const event = new CustomEvent('tabChanged', { detail: { tabName: tabName } });
            document.dispatchEvent(event);
        }
    }

    const initialTab = localStorage.getItem('activeTab') || 'dashboard';
    setActiveTab(initialTab);

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            setActiveTab(tabName);
        });
    });

    logoutButton.addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });

    addToppingBtn.addEventListener('click', () => {
        const toppingDiv = document.createElement('div');
        toppingDiv.className = 'topping-item';
        toppingDiv.innerHTML = `
            <input type="text" placeholder="Topping name" class="topping-name" required>
            <input type="number" step="0.01" placeholder="Topping price" class="topping-price" required>
            <button type="button" class="remove-topping btn btn-danger">Remove</button>
        `;
        toppingsList.appendChild(toppingDiv);
    });

    toppingsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-topping')) {
            e.target.closest('.topping-item').remove();
        }
    });

    addSizeBtn.addEventListener('click', () => {
        const sizeDiv = document.createElement('div');
        sizeDiv.className = 'size-item';
        sizeDiv.innerHTML = `
            <input type="text" placeholder="Size name" class="size-name" required>
            <input type="number" step="0.01" placeholder="Size price" class="size-price" required>
            <button type="button" class="remove-size btn btn-danger">Remove</button>
        `;
        sizesList.appendChild(sizeDiv);
    });

    sizesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-size')) {
            e.target.closest('.size-item').remove();
        }
    });

    addMenuItemForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const submitButton = this.querySelector('button[type="submit"]');
        const itemId = submitButton.getAttribute('data-edit-id');

        const toppings = [];
        document.querySelectorAll('.topping-item').forEach(item => {
            const name = item.querySelector('.topping-name').value;
            const price = item.querySelector('.topping-price').value;
            if (name && price) {
                toppings.push({ name, price: parseFloat(price) });
            }
        });
        
        formData.append('toppings', JSON.stringify(toppings));

        const sizes = [];
        document.querySelectorAll('.size-item').forEach(item => {
            const name = item.querySelector('.size-name').value;
            const price = item.querySelector('.size-price').value;
            if (name && price) {
                sizes.push({ name, price: parseFloat(price) });
            }
        });
        
        formData.append('sizes', JSON.stringify(sizes));

        try {
            let url = '/api/menu';
            let method = 'POST';

            if (itemId) {
                url += `/${itemId}`;
                method = 'PATCH';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const item = await response.json();
                console.log(itemId ? 'Item updated:' : 'New item added:', item);
                await fetchMenuItems();
                resetMenuForm();
            } else {
                const errorData = await response.json();
                console.error('Failed to add/update menu item:', errorData.message);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    function resetMenuForm() {
        addMenuItemForm.reset();
        toppingsList.innerHTML = '';
        sizesList.innerHTML = '';
        const submitButton = addMenuItemForm.querySelector('button[type="submit"]');
        submitButton.textContent = 'Add Item';
        submitButton.removeAttribute('data-edit-id');
        menuImagePreview.innerHTML = '<span class="text-gray-400">Image preview will appear here</span>';
        
        // Switch back to menu items view after adding/updating an item
        menuToggle.value = 'menuItems';
        toggleMenuSections();
    }

    async function fetchMenuItems() {
        try {
            const response = await fetch('/api/menu', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const menuItems = await response.json();
                updateMenuDisplay(menuItems);
            } else {
                console.error('Failed to fetch menu items');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function updateMenuDisplay(menuItems) {
        const menuItemsContainer = document.getElementById('menuItems');
        menuItemsContainer.innerHTML = '';
        
        if (menuItems.length === 0) {
            menuItemsContainer.innerHTML = '<p class="text-center text-gray-500">No items found</p>';
            // Show the "Add New Item" form when no items are found
            toggleMenuSections(true);
            return;
        }
        
        menuItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'menu-item-card';
            
            const typeColors = {
                'Veg': 'bg-green-100 text-green-800',
                'Non-Veg': 'bg-red-100 text-red-800',
                'Beverage': 'bg-blue-100 text-blue-800',
                'Dessert': 'bg-purple-100 text-purple-800'
            };
            
            itemElement.innerHTML = `
                ${item.imagePath ? 
                    `<img src="${item.imagePath}" alt="${item.name}" class="menu-item-image">` :
                    `<div class="menu-item-image bg-gray-100 flex items-center justify-center">
                        <span class="text-gray-400">No image available</span>
                    </div>`
                }
                <div class="menu-item-content">
                    <div class="menu-item-header">
                        <h3 class="menu-item-title">${item.name}</h3>
                        <span class="menu-item-price">₹${item.price.toFixed(2)}</span>
                    </div>
                    
                    <span class="menu-item-type ${typeColors[item.type] || 'bg-gray-100 text-gray-800'}">
                        ${item.type}
                    </span>
                    
                    <p class="menu-item-description">${item.description || 'No description available'}</p>
                    
                    <div class="menu-item-details">
                        <div class="menu-item-detail-group">
                            <h4 class="menu-item-detail-title">Preparation Time</h4>
                            <span class="menu-item-detail-tag">${item.estimatedPreparationTime} minutes</span>
                        </div>
                        
                        ${item.toppings.length > 0 ? `
                            <div class="menu-item-detail-group">
                                <h4 class="menu-item-detail-title">Available Toppings</h4>
                                <div class="menu-item-detail-list">
                                    ${item.toppings.map(topping => `
                                        <span class="menu-item-detail-tag">
                                            ${topping.name} (₹${topping.price.toFixed(2)})
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${item.sizes.length > 0 ? `
                            <div class="menu-item-detail-group">
                                <h4 class="menu-item-detail-title">Available Sizes</h4>
                                <div class="menu-item-detail-list">
                                    ${item.sizes.map(size => `
                                        <span class="menu-item-detail-tag">
                                            ${size.name} (₹${size.price.toFixed(2)})
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="menu-item-actions">
                        <button class="btn btn-edit w-full" data-id="${item._id}">Edit</button>
                        <button class="btn btn-delete w-full" data-id="${item._id}">Delete</button>
                    </div>
                </div>
            `;
            
            menuItemsContainer.appendChild(itemElement);
        });
        
        // Add event listeners
        document.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', editMenuItem);
        });
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', deleteMenuItem);
        });

        // Show the menu items if there are any
        toggleMenuSections(false);
    }

    function handleImagePreview() {
        const imageInput = document.getElementById('image');
        const menuImagePreview = document.getElementById('menuImagePreview');

        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    menuImagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview" class="max-w-full h-auto">`;
                }
                reader.readAsDataURL(file);
            } else {
                menuImagePreview.innerHTML = '<span class="text-gray-400">Image preview will appear here</span>';
            }
        });
    }

    async function editMenuItem(e) {
        const itemId = e.target.getAttribute('data-id');
        try {
            const response = await fetch(`/api/menu-item/${itemId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const item = await response.json();
                document.getElementById('name').value = item.name;
                document.getElementById('price').value = item.price;
                document.getElementById('type').value = item.type;
                document.getElementById('description').value = item.description;
                document.getElementById('estimatedPreparationTime').value = item.estimatedPreparationTime;
                
                // Update image preview
                if (item.imagePath) {
                    menuImagePreview.innerHTML = `<img src="${item.imagePath}" alt="Preview" class="max-w-full h-auto">`;
                } else {
                    menuImagePreview.innerHTML = '<span class="text-gray-400">No image available</span>';
                }
                
                toppingsList.innerHTML = '';
                item.toppings.forEach(topping => {
                    const toppingDiv = document.createElement('div');
                    toppingDiv.className = 'topping-item';
                    toppingDiv.innerHTML = `
                        <input type="text" value="${topping.name}" class="topping-name" required>
                        <input type="number" step="0.01" value="${topping.price}" class="topping-price" required>
                        <button type="button" class="remove-topping btn btn-danger">Remove</button>
                    `;
                    toppingsList.appendChild(toppingDiv);
                });

                sizesList.innerHTML = '';
                item.sizes.forEach(size => {
                    const sizeDiv = document.createElement('div');
                    sizeDiv.className = 'size-item';
                    sizeDiv.innerHTML = `
                        <input type="text" value="${size.name}" class="size-name" required>
                        <input type="number" step="0.01" value="${size.price}" class="size-price" required>
                        <button type="button" class="remove-size btn btn-danger">Remove</button>
                    `;
                    sizesList.appendChild(sizeDiv);
                });

                const submitButton = addMenuItemForm.querySelector('button[type="submit"]');
                submitButton.textContent = 'Update Item';
                submitButton.setAttribute('data-edit-id', itemId);
                
                // Switch to the "Add New Item" view when editing
                menuToggle.value = 'addNewItem';
                toggleMenuSections();
                
                addMenuItemForm.scrollIntoView({ behavior: 'smooth' });
            } else {
                console.error('Failed to fetch item details');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function deleteMenuItem(e) {
        const itemId = e.target.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this item?')) {
            try {
                const response = await fetch(`/api/menu/${itemId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    console.log('Item deleted successfully');
                    await fetchMenuItems();
                } else {
                    console.error('Failed to delete item');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }

    ownerProfileForm.addEventListener('submit', updateOwnerProfile);

    async function fetchOwnerProfile() {
        try {
            const response = await fetch('/api/owner/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const profile = await response.json();
                populateProfileForm(profile);
            } else {
                console.error('Failed to fetch owner profile');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function populateProfileForm(profile) {
        document.getElementById('email').value = profile.email;
        document.getElementById('phoneNumber').value = profile.phoneNumber;
        document.getElementById('restaurantName').value = profile.restaurantName;
        document.getElementById('ownerName').value = profile.ownerName;
        document.getElementById('category').value = profile.category || '';
        document.getElementById('address').value = profile.address || '';
        document.getElementById('landmark').value = profile.landmark || '';
        document.getElementById('operatingHoursStart').value = profile.operatingHours?.start || '';
        document.getElementById('operatingHoursEnd').value = profile.operatingHours?.end || '';
        document.getElementById('latitude').value = profile.location?.coordinates[1] || '';
        document.getElementById('longitude').value = profile.location?.coordinates[0] || '';
        document.getElementById('upiId').value = profile.paymentDetails?.upiId || '';
        document.getElementById('accountHolderName').value = profile.paymentDetails?.accountHolderName || '';
        document.getElementById('bankName').value = profile.paymentDetails?.bankName || '';
        document.getElementById('accountNumber').value = profile.paymentDetails?.accountNumber || '';
        document.getElementById('ifscCode').value = profile.paymentDetails?.ifscCode || '';

        if (profile.restaurantLogo) {
            imagePreview.style.backgroundImage = `url(${profile.restaurantLogo})`;
        }

        if (profile.location?.coordinates) {
            const latlng = L.latLng(profile.location.coordinates[1], profile.location.coordinates[0]);
            placeMarker(latlng);
            map.setView(latlng, 15);
        }
    }

    async function updateOwnerProfile(e) {
        e.preventDefault();
        const formData = new FormData(ownerProfileForm);

        try {
            const response = await fetch('/api/owner/profile', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const updatedProfile = await response.json();
                console.log('Profile updated successfully:', updatedProfile);
                alert('Profile updated successfully!');
            } else {
                console.error('Failed to update profile');
                alert('Failed to update profile. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while updating the profile.');
        }
    }

    function initMap() {
        // Coordinates for the custom polygon boundary
        const polygonCoordinates = [
            [30.77007437594941, 76.58709248833078],
            [30.771761125226156, 76.5810722611749],
            [30.774263082317674, 76.5697516162972],
            [30.775275091507396, 76.56559635051386],
            [30.768696842039745, 76.56405857505361],
            [30.767459856011406, 76.56932627397067],
            [30.762286833084598, 76.57148570334043],
            [30.765997942933872, 76.58454043543927],
            [30.766981925333116, 76.58709248833078],
            [30.76996192494084, 76.58692889519669],
            [30.77007437594941, 76.58709248833078],
        ];

        map = L.map('map', {
            zoomControl: true
        }).setView([30.769484006688415, 76.57573912482626], 17);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Draw the polygon with a transparent fill
        polygonBoundary = L.polygon(polygonCoordinates, {
            color: 'blue',
            weight: 2,
            fillOpacity: 0
        }).addTo(map);

        // Add popup to the polygon
        polygonBoundary.bindPopup("Custom Polygon Boundary");

        marker = L.marker([30.769484006688415, 76.57573912482626], {
            draggable: true
        }).addTo(map);

        map.on('click', function(e) {
            if (isPointInPolygon(e.latlng)) {
                placeMarker(e.latlng);
            } else {
                alert("Please select a location within the highlighted area.");
            }
        });

        marker.on('dragend', function() {
            const latlng = marker.getLatLng();
            if (isPointInPolygon(latlng)) {
                updateLatLng(latlng);
            } else {
                alert("Please select a location within the highlighted area.");
                marker.setLatLng(map.getCenter());
            }
        });

        document.getElementById('chooseCurrentLocation').addEventListener('click', useCurrentLocation);
    }

    function isPointInPolygon(latlng) {
        return polygonBoundary.getBounds().contains(latlng);
    }

    function placeMarker(latlng) {
        marker.setLatLng(latlng);
        map.panTo(latlng);
        updateLatLng(latlng);
    }

    function updateLatLng(latlng) {
        document.getElementById('latitude').value = latlng.lat.toFixed(6);
        document.getElementById('longitude').value = latlng.lng.toFixed(6);
    }

    function useCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
                if (isPointInPolygon(latlng)) {
                    placeMarker(latlng);
                    map.setView(latlng, 17);
                } else {
                    alert("Your current location is outside the allowed area. Please select a location within the highlighted area.");
                }
            }, function() {
                handleLocationError(true);
            });
        } else {
            handleLocationError(false);
        }
    }

    function handleLocationError(browserHasGeolocation) {
        alert(browserHasGeolocation ?
            'Error: The Geolocation service failed.' :
            'Error: Your browser doesn\'t support geolocation.');
    }

    async function fetchOrders() {
        try {
            const response = await fetch('/api/orders', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const orders = await response.json();
                displayOrders(orders);
                updateDashboardStats(orders);
            } else {
                console.error('Failed to fetch orders');
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    }

    function getStatusClass(status) {
        switch (status) {
            case 'pending':
                return 'status-gray';
            case 'preparing':
                return 'status-yellow';
            case 'ready':
                return 'status-blue';
            case 'completed':
                return 'status-green';
            case 'out_for_delivery':
                return 'status-orange';
            default:
                return '';
        }
    }

    function getStatusIcon(status) {
        switch (status) {
            case 'pending':
                return '⏳';
            case 'preparing':
                return '🍴';
            case 'ready':
                return '✅';
            case 'completed':
                return '📦';
            case 'out_for_delivery':
                return '🚚';
            default:
                return '';
        }
    }

    function getActionButton(order) {
        switch (order.status) {
            case 'pending':
                return `<button class="btn-status btn-preparing" data-order-id="${order._id}" data-status="preparing">Start Preparing</button>`;
            case 'preparing':
                return `<button class="btn-status btn-ready" data-order-id="${order._id}" data-status="ready">Ready</button>`;
            case 'ready':
                if (order.deliveryOption === 'delivery') {
                    return `<button class="btn-status btn-out-for-delivery" data-order-id="${order._id}" data-status="out_for_delivery">Out for Delivery</button>`;
                } else {
                    return `<button class="btn-status btn-completed" data-order-id="${order._id}" data-status="completed">Picked Up</button>`;
                }
            default:
                return '';
        }
    }

    function displayOrders(orders) {
        ordersList.innerHTML = '';
        if (orders.length === 0) {
            ordersList.innerHTML = '<p class="text-center text-gray-500 py-4">No orders found</p>';
            return;
        }
        const preparingOrders = [];
        const pendingOrders = [];
        const readyOrders = [];
        const completedOrders = [];
        const outForDeliveryOrders = [];

        orders.forEach(order => {
            const orderElement = createOrderElement(order);
            switch (order.status) {
                case 'preparing':
                    preparingOrders.push(orderElement);
                    break;
                case 'pending':
                    pendingOrders.push(orderElement);
                    break;
                case 'ready':
                    readyOrders.push(orderElement);
                    break;
                case 'completed':
                    completedOrders.push(orderElement);
                    break;
                case 'out_for_delivery':
                    outForDeliveryOrders.push(orderElement);
                    break;
            }
        });

        preparingOrders.sort((a, b) => new Date(b.dataset.startTime) - new Date(a.dataset.startTime));
        pendingOrders.sort((a, b) => new Date(a.dataset.createdAt) - new Date(b.dataset.createdAt));
        readyOrders.sort((a, b) => new Date(b.dataset.readyTime) - new Date(a.dataset.readyTime));
        completedOrders.sort((a, b) => new Date(b.dataset.completedTime) - new Date(a.dataset.completedTime));
        outForDeliveryOrders.sort((a, b) => new Date(b.dataset.outForDeliveryTime) - new Date(a.dataset.outForDeliveryTime));

        preparingOrders.forEach(order => ordersList.appendChild(order));
        pendingOrders.forEach(order => ordersList.appendChild(order));
        readyOrders.forEach(order => ordersList.appendChild(order));
        outForDeliveryOrders.forEach(order => ordersList.appendChild(order));
        completedOrders.forEach(order => ordersList.appendChild(order));

        updateRecentReadyOrders([...readyOrders, ...completedOrders, ...outForDeliveryOrders].map(el => JSON.parse(el.dataset.orderData)));
    }

    function createOrderElement(order) {
        const orderElement = document.createElement('div');
        orderElement.className = 'order-item';
        orderElement.dataset.status = order.status;
        orderElement.dataset.createdAt = order.createdAt;
        orderElement.dataset.startTime = order.startTime || '';
        orderElement.dataset.readyTime = order.readyAt || '';
        orderElement.dataset.completedTime = order.completedAt || '';
        orderElement.dataset.outForDeliveryTime = order.outForDeliveryAt || '';
        
        const statusClass = getStatusClass(order.status);
        const statusIcon = getStatusIcon(order.status);
        
        const scheduledTime = new Date(order.specificTime);
        const formattedTime = scheduledTime.toLocaleString('en-US', { 
            hour: 'numeric', 
            minute: 'numeric', 
            hour12: true 
        });

        const currentTime = new Date();
        let timeRemaining;
        if (order.deliveryOption === 'pickup') {
            const timeDiff = scheduledTime - currentTime;
            const minutesRemaining = Math.max(0, Math.floor(timeDiff / 60000));
            timeRemaining = `${minutesRemaining} minutes remaining`;
        } else {
            const deliveryTime = new Date(scheduledTime.getTime() - 15 * 60000);
            const timeDiff = deliveryTime - currentTime;
            const minutesRemaining = Math.max(0, Math.floor(timeDiff / 60000));
            timeRemaining = `${minutesRemaining} minutes + 15 minutes for delivery`;
        }

        let statusText = order.status;
        if (order.status === 'out_for_delivery') {
            statusText = 'Out for Delivery';
        }

        let orderContent = `
            <div class="order-header">
                <h3>Order ID: ${order._id}</h3>
                <span class="order-status ${statusClass}">${statusIcon} ${statusText}</span>
            </div>
            <div class="order-details">
                <p><strong>Customer:</strong> ${order.userId.fullName}</p>
                <p><strong>Contact:</strong> ${order.contactNumber}</p>
                <p><strong>Delivery Method:</strong> ${order.deliveryOption === 'delivery' ? 
                    `Delivery to ${order.deliveryAddress.locationName || order.deliveryAddress.manual}` : 'Pickup'}</p>
                <p><strong>Total Amount:</strong> ₹${order.totalAmount.toFixed(2)}</p>
                <p><strong>Scheduled Time:</strong> ${formattedTime}</p>
                <p><strong>Time Remaining:</strong> ${timeRemaining}</p>
            </div>
            <div class="order-items-toggle">
                <button class="btn-toggle">Show Items</button>
            </div>
            <div class="order-items" style="display: none;">
                <h4>Items Ordered:</h4>
                <ul>
                    ${order.items.map(item => `
                        <li>
                            ${item.menuItem.name} (x${item.quantity})
                            <ul class="item-details">
                                ${item.selectedSize ? `<li>Size: ${item.selectedSize}</li>` : ''}
                                ${item.selectedToppings && item.selectedToppings.length > 0 ? 
                                    `<li>Toppings: ${item.selectedToppings.join(', ')}</li>` : ''}
                                ${item.additionalInstructions ? `<li>Instructions: ${item.additionalInstructions}</li>` : ''}
                                <li>Price: ₹${item.totalPrice.toFixed(2)}</li>
                            </ul>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;

        if (order.status !== 'completed') {
            orderContent += `
                <div class="order-actions">
                    ${getActionButton(order)}
                </div>
            `;
        }

        if (order.deliveryOption === 'delivery' && (order.status === 'preparing' || order.status === 'ready' || order.status === 'out_for_delivery')) {
            orderContent += `<p><strong>Order Accepted By:</strong> ${order.partnerName || 'Not Accepted'}</p>`;
        }

        orderElement.innerHTML = orderContent;

        const itemList = orderElement.querySelector('.order-items-toggle');
        if (itemList) {
            itemList.addEventListener('click', (e) => {
                const itemsContainer = orderElement.querySelector('.order-items');
                itemsContainer.style.display = itemsContainer.style.display === 'none' ? 'block' : 'none';
                e.target.textContent = itemsContainer.style.display === 'none' ? 'Show Items' : 'Hide Items';
            });
        }

        orderElement.dataset.orderData = JSON.stringify(order);
        return orderElement;
    }

    function updateRecentReadyOrders(readyOrders) {
        const recentOrdersTable = document.getElementById('recentOrdersTable').getElementsByTagName('tbody')[0];
        recentOrdersTable.innerHTML = '';
        
        const readyOrdersArray = readyOrders.filter(order => order.status === 'ready');
        const completedOrdersArray = readyOrders.filter(order => order.status === 'completed');
        const outForDeliveryOrdersArray = readyOrders.filter(order => order.status === 'out_for_delivery');
        
        readyOrdersArray.sort((a, b) => new Date(b.readyAt) - new Date(a.readyAt));
        completedOrdersArray.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        outForDeliveryOrdersArray.sort((a, b) => new Date(b.outForDeliveryAt) - new Date(a.outForDeliveryAt));
        
        const sortedOrders = [...readyOrdersArray, ...outForDeliveryOrdersArray, ...completedOrdersArray];

        if (sortedOrders.length === 0) {
            const row = recentOrdersTable.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 6;
            cell.textContent = "No recent ready orders found.";
            cell.style.textAlign = "center";
            cell.style.padding = "1rem";
        } else {
            sortedOrders.forEach(order => {
                const row = recentOrdersTable.insertRow();
                let statusText = order.status;
                if (order.status === 'out_for_delivery') {
                    statusText = 'Out for Delivery';
                }
                row.innerHTML = `
                    <td>${order._id}</td>
                    <td>${order.userId.fullName}</td>
                    <td>${order.contactNumber}</td>
                    <td>${order.deliveryOption === 'delivery' ? `Delivery` : 'Pickup'}</td>
                    <td>₹${order.totalAmount.toFixed(2)}</td>
                    <td>${statusText}</td>
                `;
            });
        }
    }

    async function updateOrderStatus(orderId, newStatus) {
        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (response.ok) {
                const updatedOrder = await response.json();
                console.log(`Order ${orderId} updated to status: ${newStatus}`);
                if (newStatus === 'preparing' && updatedOrder.deliveryOption === 'delivery') {
                    const orderElement = document.querySelector(`[data-order-id="${orderId}"]`).closest('.order-item');
                    const acceptedByElement = document.createElement('p');
                    acceptedByElement.textContent = `Order Accepted By: ${updatedOrder.orderAcceptedBy || 'Not Accepted'}`;
                    orderElement.appendChild(acceptedByElement);
                }
                await fetchOrders(); // Refresh the orders list and update dashboard stats
            } else {
                console.error('Failed to update order status');
            }
        } catch (error) {
            console.error('Error updating order status:', error);
        }
    }

    async function updateDashboardStats() {
        try {
            const response = await fetch('/api/orders', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const orders = await response.json();
                const pendingOrders = orders.filter(order => order.status === 'pending' || order.status === 'preparing').length;
                const completedOrders = orders.filter(order => order.status === 'completed').length;
                const totalRevenue = orders.reduce((sum, order) => sum + (order.status === 'completed' ? order.totalAmount : 0), 0);

                animateValue('pendingOrdersCount', parseInt(document.getElementById('pendingOrdersCount').textContent) || 0, pendingOrders, 1000);
                animateValue('completedOrdersCount', parseInt(document.getElementById('completedOrdersCount').textContent) || 0, completedOrders, 1000);
                animateValue('totalRevenue', parseFloat(document.getElementById('totalRevenue').textContent.replace('₹', '')) || 0, totalRevenue, 1000, '₹');

                updateRecentReadyOrders(orders.filter(order => order.status === 'ready' || order.status === 'completed' || order.status === 'out_for_delivery'));
            } else {
                console.error('Failed to fetch orders for dashboard stats');
            }
        } catch (error) {
            console.error('Error updating dashboard stats:', error);
        }

        fetchMenuItemsCount();
    }

    async function fetchMenuItemsCount() {
        try {
            const response = await fetch('/api/menu/count', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const { count } = await response.json();
                animateValue('menuItemsCount', parseInt(document.getElementById('menuItemsCount').textContent) || 0, count, 1000);
            } else {
                console.error('Failed to fetch menu items count');
            }
        } catch (error) {
            console.error('Error fetching menu items count:', error);
        }
    }

    function animateValue(id, start, end, duration, prefix = '') {
        const obj = document.getElementById(id);
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            obj.textContent = `${prefix}${value.toLocaleString()}`;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    async function initializeAnalytics() {
        try {
            const response = await fetch('/api/analytics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const analyticsData = await response.json();
                const ctx = document.getElementById('salesChart').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: analyticsData.labels,
                        datasets: [{
                            label: 'Sales',
                            data: analyticsData.salesData,
                            borderColor: 'rgb(75, 192, 192)',
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });

                const popularItemsTable = document.getElementById('popularItemsTable').getElementsByTagName('tbody')[0];
                analyticsData.popularItems.forEach(item => {
                    const row = popularItemsTable.insertRow();
                    row.insertCell(0).textContent = item.name;
                    row.insertCell(1).textContent = item.totalSales;
                    row.insertCell(2).textContent = `₹${item.revenue.toFixed(2)}`;
                });

                document.getElementById('averageRating').textContent = `${analyticsData.averageRating.toFixed(1)}/5`;
                document.getElementById('totalReviews').textContent = analyticsData.totalReviews;
            } else {
                console.error('Failed to fetch analytics data');
            }
        } catch (error) {
            console.error('Error initializing analytics:', error);
        }
    }

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-status')) {
            const orderId = e.target.getAttribute('data-order-id');
            const newStatus = e.target.getAttribute('data-status');
            updateOrderStatus(orderId, newStatus);
        }
    });

    function handleTabChange(tabName) {
        if (tabName === 'dashboard') {
            updateDashboardStats();
        } else if (tabName === 'orders') {
            fetchOrders();
        } else if (tabName === 'menu') {
            fetchMenuItems();
        } else if (tabName === 'analytics') {
            initializeAnalytics();
        } else if (tabName === 'profile') {
            fetchOwnerProfile();
        }
    }

    document.addEventListener('tabChanged', function(e) {
        handleTabChange(e.detail.tabName);
    });

    handleTabChange(initialTab);
    initMap();
    handleImagePreview();

    setInterval(() => {
        const currentTab = localStorage.getItem('activeTab') || 'dashboard';
        handleTabChange(currentTab);
    }, 30000);
});

