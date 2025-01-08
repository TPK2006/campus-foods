document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registrationForm = document.getElementById('registrationForm');
    const loginIdentifier = document.getElementById('loginIdentifier');
    const passwordField = document.getElementById('passwordField');
    const loginPassword = document.getElementById('loginPassword');
    const tabTriggers = document.querySelectorAll('.tab-trigger');
    const tabContents = document.querySelectorAll('.tab-content');
    const nextButton = document.getElementById('nextButton');
    const getStartedBtn = document.getElementById('getStartedBtn');
    const authSection = document.getElementById('auth-section');
    const registrationSection = document.getElementById('registration-section');

    // Tab functionality
    tabTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const tabId = trigger.getAttribute('data-tab');
            tabTriggers.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            trigger.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Get Started button functionality
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            authSection.classList.add('hidden');
            registrationSection.classList.remove('hidden');
            // Automatically show the restaurant info tab
            document.querySelector('.tab-trigger[data-tab="restaurant-info"]').click();
        });
    }

    // Next button functionality for registration form
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            document.querySelector('.tab-trigger[data-tab="owner-details"]').click();
        });
    }

    // Show password field when identifier is entered in login form
    if (loginIdentifier) {
        loginIdentifier.addEventListener('blur', async () => {
            const identifier = loginIdentifier.value;
            if (identifier) {
                try {
                    const response = await fetch('/api/check-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ identifier })
                    });
                    const data = await response.json();
                    if (data.exists) {
                        passwordField.classList.remove('hidden');
                    } else {
                        alert('User not found. Please sign up.');
                    }
                } catch (error) {
                    console.error('Error checking user:', error);
                }
            }
        });
    }

    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = loginIdentifier.value;
            const password = loginPassword.value;
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });
                const data = await response.json();
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    window.location.href = 'dashboard.html';
                } else {
                    alert('Invalid credentials');
                }
            } catch (error) {
                console.error('Error logging in:', error);
            }
        });
    }

    // Registration form submission
    if (registrationForm) {
        registrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(registrationForm);
            
            // Client-side validation
            const email = formData.get('email');
            const phoneNumber = formData.get('phoneNumber');
            const password = formData.get('password');
            const confirmPassword = formData.get('confirmPassword');
            const restaurantName = formData.get('restaurantName');
            const ownerName = formData.get('ownerName');
            const latitude = formData.get('latitude');
            const longitude = formData.get('longitude');
            const upiId = formData.get('upiId');
            const accountHolderName = formData.get('accountHolderName');
            const bankName = formData.get('bankName');
            const accountNumber = formData.get('accountNumber');
            const ifscCode = formData.get('ifscCode');
            
            if (!email || !phoneNumber || !password || !confirmPassword || !restaurantName || !ownerName || !latitude || !longitude || !upiId || !accountHolderName || !bankName || !accountNumber || !ifscCode) {
                alert('All required fields must be filled');
                return;
            }

            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    window.location.href = 'dashboard.html';
                } else {
                    alert('Registration failed: ' + (data.message || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error registering:', error);
                alert('An error occurred: ' + error.message);
            }
        });
    }

    // Map and location functionality
    let map, marker, polygonBoundary;

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

        document.getElementById('useCurrentLocation').addEventListener('click', useCurrentLocation);
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

    // Initialize map when the tab is shown
    document.querySelector('.tab-trigger[data-tab="restaurant-info"]').addEventListener('click', function() {
        setTimeout(function() {
            if (!map) {
                initMap();
            }
        }, 100);
    });

});

