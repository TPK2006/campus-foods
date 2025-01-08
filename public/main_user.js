document.addEventListener('DOMContentLoaded', () => {
    const homeView = document.getElementById('homeView');
    const menuView = document.getElementById('menuView');
    const restaurantGrid = document.getElementById('restaurantGrid');
    const dishesGrid = document.getElementById('dishesGrid');
    const searchResults = document.getElementById('searchResults');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const cartBadge = document.getElementById('cartBadge');
    const searchInput = document.getElementById('searchInput');
    const homeBtn = document.getElementById('homeBtn');
    const cartBtn = document.getElementById('cartBtn');
    const menuItemsContainer = document.getElementById('menuItemsContainer');
    const categoryContainer = document.getElementById('categoryContainer');
    const restaurantName = document.getElementById('restaurantName');
    const restaurantCategory = document.getElementById('restaurantCategory');
    const logoutBtn = document.getElementById('logoutBtn');
    const backToRestaurantsBtn = document.getElementById('backToRestaurantsBtn');
    const currentLocationDisplay = document.getElementById('currentLocation');
    const foodItemDetails = document.getElementById('foodItemDetails');
    const availableDishesSection = document.getElementById('availableDishesSection');
    const restaurantsTitle = document.getElementById('restaurantsTitle');
    const menuSearchInput = document.getElementById('menuSearchInput');
  
    let menuItems = [];
    let currentRestaurantId = null;
    let allRestaurants = [];
    let allMenuItems = [];
    let currentView = 'home';
  
    // Check if user is logged in
    const userToken = localStorage.getItem('userToken');
    if (!userToken) {
        window.location.href = 'user_auth.html';
    } else {
        // Restore the previous view state
        currentView = localStorage.getItem('currentView') || 'home';
        currentRestaurantId = localStorage.getItem('currentRestaurantId');

        if (currentView === 'home') {
            showHomeView();
        } else if (currentView === 'menu' && currentRestaurantId) {
            showMenuView(currentRestaurantId);
        }

        fetchUserProfile();
        getCurrentLocation();
        updateCartBadge();
        fetchAllData();
    }
  
    function showHomeView() {
        homeView.classList.remove('hidden');
        menuView.classList.add('hidden');
        fetchRestaurants();
        
        // Reset search input and hide Available Dishes section
        searchInput.value = '';
        availableDishesSection.classList.add('hidden');
        restaurantsTitle.textContent = 'Nearby Restaurants';

        // Update localStorage
        localStorage.setItem('currentView', 'home');
        localStorage.removeItem('currentRestaurantId');
        currentRestaurantId = null;
    }
  
    function showMenuView(ownerId) {
        homeView.classList.add('hidden');
        menuView.classList.remove('hidden');
        currentRestaurantId = ownerId;
        fetchMenuItems(ownerId);
        fetchRestaurantDetails(ownerId);
        if (menuSearchInput) {
            menuSearchInput.value = ''; // Reset search input when changing restaurants
        }

        // Update localStorage
        localStorage.setItem('currentView', 'menu');
        localStorage.setItem('currentRestaurantId', ownerId);
    }
  
    async function fetchUserProfile() {
        try {
            const response = await fetch('/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            if (response.ok) {
                const user = await response.json();
                document.getElementById('userName').textContent = user.fullName;
            } else {
                console.error('Failed to fetch user profile');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
  
    async function fetchRestaurants() {
        try {
            const response = await fetch('/api/restaurants', {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            if (response.ok) {
                const restaurants = await response.json();
                renderRestaurants(restaurants);
            } else {
                console.error('Failed to fetch restaurants');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
  
    function renderRestaurants(restaurants) {
        restaurantGrid.innerHTML = restaurants.map(restaurant => `
            <div class="card" data-owner-id="${restaurant._id}">
                <div class="card-header">
                    <h3 class="card-title">${restaurant.restaurantName}</h3>
                    <p class="card-description">${restaurant.category || 'Various Cuisines'}</p>
                </div>
                <div class="card-content">
                    <img src="${restaurant.restaurantLogo || '/placeholder.svg?height=200&width=200'}" alt="${restaurant.restaurantName}" class="card-image">
                    <div class="card-footer">
                    </div>
                    <p class="distance">📍 ${restaurant.distance} km away</p>
                </div>
            </div>
        `).join('');
  
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => {
                const ownerId = card.dataset.ownerId;
                showMenuView(ownerId);
            });
        });
    }
  
    async function fetchMenuItems(ownerId) {
        try {
            const response = await fetch(`/api/restaurant/${ownerId}/menu`);
            if (response.ok) {
                menuItems = await response.json();
                const categories = ['all', ...new Set(menuItems.map(item => item.type))];
                renderCategories(categories);
                renderMenuItems('all');
            } else {
                console.error('Failed to fetch menu items');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
  
    async function fetchRestaurantDetails(ownerId) {
        try {
            const response = await fetch(`/api/restaurant/${ownerId}`);
            if (response.ok) {
                const restaurant = await response.json();
                restaurantName.textContent = restaurant.restaurantName;
                restaurantCategory.textContent = restaurant.category;
            } else {
                console.error('Failed to fetch restaurant details');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
  
    function renderCategories(categories) {
        categoryContainer.innerHTML = categories.map(category => `
            <button class="category-btn" data-category="${category}">${category.charAt(0).toUpperCase() + category.slice(1)}</button>
        `).join('');
  
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderMenuItems(btn.dataset.category);
            });
        });
  
        // Set the first category (All) as active by default
        document.querySelector('.category-btn').classList.add('active');
    }
  
    function renderMenuItems(category) {
        const filteredItems = category === 'all'
            ? menuItems
            : menuItems.filter(item => item.type.toLowerCase() === category.toLowerCase());
  
        menuItemsContainer.innerHTML = filteredItems.map(item => `
            <div class="menu-item" data-id="${item._id}">
                <img src="${item.imagePath || '/placeholder.svg?height=200&width=200'}" alt="${item.name}" class="menu-item-image">
                <div class="menu-item-details">
                    <h4 class="menu-item-name">${item.name}</h4>
                    <p class="menu-item-description">${item.description || 'No description available'}</p>
                    <div class="menu-item-footer">
                        <span class="menu-item-price">₹${item.price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `).join('');
  
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', showFoodItemDetails);
        });
        if (menuSearchInput) {
            menuSearchInput.value = ''; // Reset search input when changing categories
        }
        handleMenuSearch(); // Apply search to show all items
    }
  
    async function showFoodItemDetails(event) {
        const itemId = event.currentTarget.dataset.id;
        try {
            const response = await fetch(`/api/menu-item/${itemId}`);
            if (response.ok) {
                const item = await response.json();
                foodItemDetails.innerHTML = `
                    <div class="food-item-modal">
                        <div class="food-item-header">
                            <h3>${item.name}</h3>
                            <button class="close-details" aria-label="Close details">&times;</button>
                        </div>
                        <div class="food-item-content">
                            <div class="food-item-image-container">
                                <img src="${item.imagePath || '/placeholder.svg?height=300&width=300'}" 
                                     alt="${item.name}" 
                                     class="food-item-image">
                            </div>
                            <div class="food-item-info">
                                <div class="food-item-description-box">
                                    <p class="food-item-description">${item.description || 'No description available'}</p>
                                </div>
                                <div class="food-item-meta">
                                    <div class="price-box">
                                        <p class="food-item-price">Base Price: ₹<span id="basePrice">${item.price.toFixed(2)}</span></p>
                                        <p class="food-item-total-price">Total: ₹<span id="totalPrice">${item.price.toFixed(2)}</span></p>
                                    </div>
                                    <div class="prep-time-box">
                                        <i class="fas fa-clock"></i>
                                        <p class="food-item-prep-time">${item.estimatedPreparationTime} mins</p>
                                    </div>
                                </div>
                                
                                ${item.sizes.length > 0 ? `
                                    <div class="size-options">
                                        <h4>Select Size</h4>
                                        <div class="options-grid">
                                            ${item.sizes.map(size => `
                                                <label class="option-label">
                                                    <input type="radio" name="size" value="${size.name}" data-price="${size.price}">
                                                    <span class="option-text">
                                                        <span class="option-name">${size.name}</span>
                                                        <span class="option-price">+₹${size.price.toFixed(2)}</span>
                                                    </span>
                                                </label>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${item.toppings.length > 0 ? `
                                    <div class="topping-options">
                                        <h4>Add Toppings</h4>
                                        <div class="options-grid">
                                            ${item.toppings.map(topping => `
                                                <label class="option-label">
                                                    <input type="checkbox" name="topping" value="${topping.name}" data-price="${topping.price}">
                                                    <span class="option-text">
                                                        <span class="option-name">${topping.name}</span>
                                                        <span class="option-price">+₹${topping.price.toFixed(2)}</span>
                                                    </span>
                                                </label>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                <div class="additional-instructions">
                                    <h4>Special Instructions</h4>
                                    <textarea id="additionalInstructions" 
                                        placeholder="Any special requests? (optional)"
                                        maxlength="500"></textarea>
                                </div>
                                
                                <div class="order-controls">
                                    <div class="quantity-selector">
                                        <button class="quantity-btn minus" aria-label="Decrease quantity">
                                            <i class="fas fa-minus"></i>
                                        </button>
                                        <input type="number" id="quantity" value="1" min="1" max="10" readonly>
                                        <button class="quantity-btn plus" aria-label="Increase quantity">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                    <button id="addToCartBtn" class="btn btn-primary">
                                        <i class="fas fa-shopping-cart"></i>
                                        Add to Cart
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        ${item.ratings.length > 0 ? `
                            <div class="ratings-reviews">
                                <h4>Ratings & Reviews</h4>
                                <div class="rating-summary">
                                    <div class="average-rating">
                                        <span class="rating-number">${calculateAverageRating(item.ratings)}</span>
                                        <div class="star-display">
                                            ${generateStarRating(calculateAverageRating(item.ratings))}
                                        </div>
                                        <span class="rating-count">${item.ratings.length} ratings</span>
                                    </div>
                                </div>
                                ${item.reviews.length > 0 ? `
                                    <div class="review-list">
                                        ${item.reviews.map(review => `
                                            <div class="review-item">
                                                <div class="review-header">
                                                    <div class="star-display small">
                                                        ${generateStarRating(review.rating)}
                                                    </div>
                                                </div>
                                                <p class="review-text">${review.text}</p>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
                
                foodItemDetails.classList.remove('hidden');
                categoryContainer.classList.add('hidden');
                menuItemsContainer.classList.add('hidden');
    
                // Scroll to the top of the food item details
                foodItemDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
                // Add event listeners
                document.querySelector('.close-details').addEventListener('click', closeFoodItemDetails);
                document.getElementById('addToCartBtn').addEventListener('click', () => addToCart(item));
                
                // Quantity selector functionality
                const quantityInput = document.getElementById('quantity');
                document.querySelector('.quantity-btn.minus').addEventListener('click', () => {
                    if (quantityInput.value > 1) {
                        quantityInput.value--;
                        updateTotalPrice(item);
                    }
                });
                document.querySelector('.quantity-btn.plus').addEventListener('click', () => {
                    if (quantityInput.value < 10) {
                        quantityInput.value++;
                        updateTotalPrice(item);
                    }
                });
    
                // Add event listeners for size and topping selections
                document.querySelectorAll('input[name="size"]').forEach(input => {
                    input.addEventListener('change', () => updateTotalPrice(item));
                });
                document.querySelectorAll('input[name="topping"]').forEach(input => {
                    input.addEventListener('change', () => updateTotalPrice(item));
                });
    
                // Initial price update
                updateTotalPrice(item);
            } else {
                console.error('Failed to fetch menu item details');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function generateStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        return `
            ${Array(fullStars).fill('<i class="fas fa-star"></i>').join('')}
            ${hasHalfStar ? '<i class="fas fa-star-half-alt"></i>' : ''}
            ${Array(emptyStars).fill('<i class="far fa-star"></i>').join('')}
        `;
    }    
  
    function updateTotalPrice(item) {
        const basePrice = parseFloat(item.price);
        const quantity = parseInt(document.getElementById('quantity').value);
        const selectedSize = document.querySelector('input[name="size"]:checked');
        const selectedToppings = document.querySelectorAll('input[name="topping"]:checked');
  
        let totalPrice = basePrice;
  
        if (selectedSize) {
            totalPrice = parseFloat(selectedSize.dataset.price);
        }
  
        selectedToppings.forEach(topping => {
            totalPrice += parseFloat(topping.dataset.price);
        });
  
        totalPrice *= quantity;
  
        document.getElementById('totalPrice').textContent = totalPrice.toFixed(2);
    }
  
    function closeFoodItemDetails() {
        foodItemDetails.classList.add('hidden');
        categoryContainer.classList.remove('hidden');
        menuItemsContainer.classList.remove('hidden');
    }
  
    function calculateAverageRating(ratings) {
        if (ratings.length === 0) return 'No ratings yet';
        const sum = ratings.reduce((a, b) => a + b, 0);
        return (sum / ratings.length).toFixed(1);
    }
  
    async function addToCart(item) {
        const selectedSize = document.querySelector('input[name="size"]:checked');
        const selectedToppings = Array.from(document.querySelectorAll('input[name="topping"]:checked')).map(input => input.value);
        const additionalInstructions = document.getElementById('additionalInstructions').value;
        const quantity = parseInt(document.getElementById('quantity').value);
        const totalPrice = parseFloat(document.getElementById('totalPrice').textContent);
  
        const cartItem = {
            menuItemId: item._id,
            quantity: quantity,
            selectedSize: selectedSize ? selectedSize.value : null,
            selectedToppings,
            additionalInstructions,
            totalPrice
        };
  
        try {
            const response = await fetch('/api/cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify(cartItem)
            });
  
            if (response.ok) {
                const addToCartBtn = document.getElementById('addToCartBtn');
                addToCartBtn.textContent = 'Added to Cart';
                addToCartBtn.disabled = true;
                setTimeout(() => {
                    closeFoodItemDetails();
                    updateCartBadge();
                }, 1500);
            } else {
                console.error('Failed to add item to cart');
            }
        } catch (error) {
            console.error('Error:', error);
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
  
    async function fetchAllData() {
        try {
            const restaurantsResponse = await fetch('/api/restaurants', {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            allRestaurants = await restaurantsResponse.json();
  
            const menuItemsPromises = allRestaurants.map(restaurant => 
                fetch(`/api/restaurant/${restaurant._id}/menu`).then(res => res.json())
            );
            const menuItemsArrays = await Promise.all(menuItemsPromises);
            allMenuItems = menuItemsArrays.flat().map(item => ({
                ...item,
                restaurantId: item.ownerId,
                restaurantName: allRestaurants.find(r => r._id === item.ownerId).restaurantName
            }));
        } catch (error) {
            console.error('Error fetching all data:', error);
        }
    }
  
    searchInput.addEventListener('input', debounce(handleSearch, 300));
  
    function debounce(func, delay) {
        let debounceTimer;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        }
    }
  
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (searchTerm.length < 3) {
            restaurantGrid.innerHTML = ''; // Clear restaurant grid
            dishesGrid.innerHTML = ''; // Clear dishes grid
            availableDishesSection.classList.add('hidden'); // Hide "Available Dishes" section
            fetchRestaurants(); // Show all restaurants
            restaurantsTitle.textContent = 'Nearby Restaurants';
            return;
        }
  
        const matchingRestaurants = allRestaurants.filter(restaurant => 
            restaurant.restaurantName.toLowerCase().includes(searchTerm)
        );
  
        const matchingMenuItems = allMenuItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm)
        );
  
        displaySearchResults(matchingRestaurants, matchingMenuItems);
    }
  
    function displaySearchResults(restaurants, menuItems) {
        // Update Restaurants
        restaurantsTitle.textContent = restaurants.length > 0 ? 'Available Restaurants' : 'No Matching Restaurants';
        restaurantGrid.innerHTML = restaurants.map(restaurant => `
            <div class="card" data-owner-id="${restaurant._id}">
                <div class="card-header">
                    <h3 class="card-title">${restaurant.restaurantName}</h3>
                    <p class="card-description">${restaurant.category || 'Various Cuisines'}</p>
                </div>
                <div class="card-content">
                    <img src="${restaurant.restaurantLogo || '/placeholder.svg?height=200&width=200'}" alt="${restaurant.restaurantName}" class="card-image">
                    <div class="card-footer">
                        <div class="rating">
                            <span class="star-icon">⭐</span>
                            <span>4.5</span>
                        </div>
                    </div>
                    <p class="distance">📍 ${restaurant.distance} km away</p>
                </div>
            </div>
        `).join('');
  
        // Update Available Dishes
        if (menuItems.length > 0) {
            availableDishesSection.classList.remove('hidden'); // Show "Available Dishes" section
            dishesGrid.innerHTML = menuItems.map(item => `
                <div class="card" data-owner-id="${item.restaurantId}" data-item-id="${item._id}">
                    <div class="card-header">
                        <h3 class="card-title">${item.name}</h3>
                        <p class="card-description">${item.restaurantName}</p>
                    </div>
                    <div class="card-content">
                        <img src="${item.imagePath || '/placeholder.svg?height=200&width=200'}" alt="${item.name}" class="card-image">
                        <div class="card-footer">
                            <span class="menu-item-price">₹${item.price.toFixed(2)}</span>
                        </div>
                        <p class="distance">📍 ${getDistanceFromRestaurant(item)} km away</p>
                    </div>
                </div>
            `).join('');
        } else {
            availableDishesSection.classList.add('hidden'); // Hide "Available Dishes" section
            dishesGrid.innerHTML = '';
        }
  
        // Add event listeners to the new cards
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => {
                const ownerId = card.dataset.ownerId;
                const itemId = card.dataset.itemId;
                showMenuView(ownerId);
                if (itemId) {
                    // Highlight the specific menu item after a short delay to allow the menu to load
                    setTimeout(() => {
                        const menuItemElement = document.querySelector(`[data-id="${itemId}"]`);
                        if (menuItemElement) {
                            menuItemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            menuItemElement.classList.add('highlight');
                            setTimeout(() => menuItemElement.classList.remove('highlight'), 3000);
                        }
                    }, 500);
                }
            });
        });
    }
  
    function getDistanceFromRestaurant(menuItem) {
        const restaurant = allRestaurants.find(r => r._id === menuItem.restaurantId);
        return restaurant ? restaurant.distance : 'N/A';
    }
  
    homeBtn.addEventListener('click', () => {
        showHomeView();
        localStorage.setItem('currentView', 'home');
        localStorage.removeItem('currentRestaurantId');
    });

    backToRestaurantsBtn.addEventListener('click', () => {
        showHomeView();
        localStorage.setItem('currentView', 'home');
        localStorage.removeItem('currentRestaurantId');
    });
  
    cartBtn.addEventListener('click', () => {
        window.location.href = 'cart.html';
    });
  
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('userToken');
        localStorage.removeItem('currentView');
        localStorage.removeItem('currentRestaurantId');
        window.location.href = 'user_auth.html';
    });
  
    function getCurrentLocation() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                updateUserLocation(lat, lon);
                updateCurrentLocationDisplay(lat, lon);
            }, function(error) {
                console.error("Error getting location:", error);
            });
        } else {
            console.log("Geolocation is not supported by this browser.");
        }
    }
  
    async function updateUserLocation(lat, lon) {
        try {
            const response = await fetch('/api/user/location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({ lat, lon })
            });
            if (response.ok) {
                console.log('User location updated successfully');
            } else {
                console.error('Failed to update user location');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
  
    async function updateCurrentLocationDisplay(lat, lon) {
        const address = await getAddressFromCoordinates(lat, lon);
        currentLocationDisplay.innerHTML = `
            <i class="fas fa-map-marker-alt"></i>
            <span>${address}</span>
        `;
    }
  
    async function getAddressFromCoordinates(lat, lon) {
        try {
            const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=580ee344be09432fba9e223e8a95baf7`);
            const data = await response.json();
    
            if (data.results && data.results.length > 0) {
                // Get the full formatted address
                const fullAddress = data.results[0].formatted;
    
                // Extract specific parts of the address
                const addressParts = fullAddress.split(', ');
                if (addressParts.length >= 4) {
                    // Return "Gharuan - 140413, Punjab" or equivalent based on the split parts
                    return `${addressParts[addressParts.length - 3]}, ${addressParts[addressParts.length - 2]}`;
                }
                return fullAddress; // Fallback to the full address if splitting doesn't match
            }
    
            // Fallback to coordinates if no address is found
            return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        } catch (error) {
            console.error('Error getting address:', error);
            return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }
    }
  
    // Initial setup
    if (userToken) {
        fetchRestaurants();
        // Hide "Available Dishes" section initially
        availableDishesSection.classList.add('hidden');
    }
  
    // Add event listener for search input
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Add event listener for menu search
    if (menuSearchInput) {
        menuSearchInput.addEventListener('input', handleMenuSearch);
    }

    function handleMenuSearch() {
        const searchTerm = menuSearchInput.value.toLowerCase().trim();
        const menuItems = document.querySelectorAll('.menu-item');
        
        menuItems.forEach(item => {
            const itemName = item.querySelector('.menu-item-name').textContent.toLowerCase();
            const itemDescription = item.querySelector('.menu-item-description').textContent.toLowerCase();
            
            if (itemName.includes(searchTerm) || itemDescription.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }
});

