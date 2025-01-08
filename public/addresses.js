document.addEventListener('DOMContentLoaded', () => {
    const addressList = document.getElementById('addressList');
    const addressForm = document.getElementById('addressForm');
    const addressInput = document.getElementById('addressInput');
    const addressSuggestions = document.getElementById('addressSuggestions');
    const updateAddressInput = document.getElementById('updateAddressInput');
    const updateAddressSuggestions = document.getElementById('updateAddressSuggestions');
    const useCurrentLocationBtn = document.getElementById('useCurrentLocation');
    const updateAddressModal = document.getElementById('updateAddressModal');
    const updateAddressForm = document.getElementById('updateAddressForm');
    const closeUpdateModal = updateAddressModal.querySelector('.close');
    const homeBtn = document.getElementById('homeBtn');
    const cartBtn = document.getElementById('cartBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const cartBadge = document.getElementById('cartBadge');
    const mapContainer = document.getElementById('map');
    
    let userAddresses = [];
    let currentAddressIndex = -1;
    let map, marker;
    let selectedLocation = null;
    let selectedMarker = null;
    let polygonBoundary;
    let markers = [];
    let markerLabels = [];

    // Check if user is logged in
    const userToken = localStorage.getItem('userToken');
    if (!userToken) {
        window.location.href = 'user_auth.html';
    } else {
        fetchAddresses();
        updateCartBadge();
        initMap();
    }

    function initMap() {
        map = L.map('map').setView([30.769484006688415, 76.57573912482626], 17);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 50,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

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

        polygonBoundary = L.polygon(polygonCoordinates, {
            color: 'blue',
            weight: 2,
            fillOpacity: 0
        }).addTo(map);

        map.on('click', function(e) {
            if (isPointInPolygon(e.latlng, polygonBoundary)) {
                setMarker(e.latlng);
                fillAddressInput(e.latlng);
            } else {
                alert("Please select a location within the highlighted area.");
            }
        });
        map.on('zoomend', updateMarkerLabels);
        map.on('moveend', updateMarkerLabels);
        fetchMarkers();
    }

    async function fetchAddresses() {
        try {
            const response = await fetch('/api/user/addresses', {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            const addresses = await response.json();
            userAddresses = addresses;
            renderAddresses();
        } catch (error) {
            console.error('Error fetching addresses:', error);
        }
    }

    async function fetchMarkers() {
        try {
            const response = await fetch('/api/markers');
            const data = await response.json();
            markers = data;
            displayMarkers();
        } catch (error) {
            console.error('Error fetching markers:', error);
        }
    }

    function displayMarkers() {
        markers.forEach(markerGroup => {
            markerGroup.locations.forEach(markerData => {
                const [lng, lat] = markerData.coordinates;
                const icon = createCustomIcon(markerGroup.markerType, markerData.name);
                const marker = L.marker([lat, lng], { icon: icon })
                    .addTo(map)
                    .bindPopup(markerData.name);
                
                markerLabels.push({
                    marker: marker,
                    name: markerData.name
                });
            });
        });
        updateMarkerLabels();
    }

    function createCustomIcon(markerType, name) {
        const iconConfig = {
            Blocks: { color: '#2ecc71', iconClass: 'fas fa-graduation-cap' },
            restaurants: { color: '#3498db', iconClass: 'fas fa-utensils' },
            parks: { color: '#f1c40f', iconClass: 'fas fa-tree' },
            hostels: { color: '#e74c3c', iconClass: 'fas fa-bed' }
        };
    
        const config = iconConfig[markerType] || { color: '#95a5a6', iconClass: 'fas fa-map-marker-alt' };
    
        return L.divIcon({
            className: 'custom-icon',
            iconSize: [24, 34],
            iconAnchor: [12, 34],
            popupAnchor: [0, -34],
            html: `
                <div class="marker-container">
                    <div class="marker-label" style="display: none;"><h3>${name}</h3></div>
                    <div class="marker-pin" style="background-color: ${config.color};"></div>
                    <i class="${config.iconClass}" style="color: ${config.color};"></i>
                </div>
            `
        });
    }

    function showSuggestions(input, suggestionsContainer) {
        const query = input.value.toLowerCase();
        if (query.length < 2) {
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.classList.remove('active');
            return;
        }

        const matchingMarkers = markers.flatMap(markerGroup => 
            markerGroup.locations.filter(marker => 
                marker.name.toLowerCase().includes(query)
            )
        );

        if (matchingMarkers.length > 0) {
            const suggestions = matchingMarkers.map(marker => `
                <div class="suggestion-item" data-lat="${marker.coordinates[1]}" 
                     data-lng="${marker.coordinates[0]}" 
                     data-name="${marker.name}">
                    ${marker.name}
                </div>
            `).join('');
            suggestionsContainer.innerHTML = suggestions;
            suggestionsContainer.classList.add('active');
        } else {
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.classList.remove('active');
        }
    }

    function handleSuggestionClick(e, input, suggestionsContainer) {
        if (e.target.classList.contains('suggestion-item')) {
            const lat = parseFloat(e.target.dataset.lat);
            const lng = parseFloat(e.target.dataset.lng);
            const name = e.target.dataset.name;
            
            input.value = name;
            selectedLocation = { lat, lng };
            selectedMarker = { name, coordinates: [lng, lat] };
            
            setMarker(L.latLng(lat, lng));
            map.setView([lat, lng], 17);
            
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.classList.remove('active');
        }
    }

    // Set up event listeners for address input
    addressInput.addEventListener('input', () => showSuggestions(addressInput, addressSuggestions));
    addressSuggestions.addEventListener('click', (e) => handleSuggestionClick(e, addressInput, addressSuggestions));

    // Set up event listeners for update address input
    updateAddressInput.addEventListener('input', () => showSuggestions(updateAddressInput, updateAddressSuggestions));
    updateAddressSuggestions.addEventListener('click', (e) => handleSuggestionClick(e, updateAddressInput, updateAddressSuggestions));

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.address-input-container')) {
            addressSuggestions.classList.remove('active');
            updateAddressSuggestions.classList.remove('active');
        }
    });

    function isPointInPolygon(point, polygon) {
        return polygon.getBounds().contains(point);
    }

    function setMarker(latlng) {
        if (marker) {
            map.removeLayer(marker);
        }
        const nearestLocation = findNearestLocation(latlng.lat, latlng.lng);
        const icon = createCustomIcon(nearestLocation ? nearestLocation.markerType : 'default', nearestLocation ? nearestLocation.name : '');
        marker = L.marker(latlng, { icon: icon }).addTo(map);
        selectedLocation = latlng;
    }

    function fillAddressInput(latlng) {
        const nearestLocation = findNearestLocation(latlng.lat, latlng.lng);
        if (nearestLocation) {
            addressInput.value = nearestLocation.name;
            selectedMarker = nearestLocation;
        } else {
            addressInput.value = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
            selectedMarker = null;
        }
    }

    function renderAddresses() {
        addressList.innerHTML = userAddresses.map((address, index) => {
            const displayText = address.locationName || address.manual || (() => {
                const [lat, lng] = address.auto.split(',').map(Number);
                const nearestLocation = findNearestLocation(lat, lng);
                return nearestLocation ? 
                    `Near ${nearestLocation.name}` : 
                    `Lat: ${lat}, Lng: ${lng}`;
            })();
            
            return `
                <div class="address-item">
                    <p>${displayText}</p>
                    <div class="address-actions">
                        <button class="btn btn-small btn-update" data-index="${index}">Update</button>
                        <button class="btn btn-small btn-delete" data-index="${index}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.btn-update').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                openUpdateAddressModal(index);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                deleteAddress(index);
            });
        });
    }

    function addAddress(e) {
        e.preventDefault();
        let addressData;
        
        if (selectedLocation && selectedMarker) {
            addressData = {
                address_auto: `${selectedLocation.lat},${selectedLocation.lng}`,
                location_name: selectedMarker.name
            };
        } else if (selectedLocation) {
            const nearestLocation = findNearestLocation(selectedLocation.lat, selectedLocation.lng);
            addressData = {
                address_auto: `${selectedLocation.lat},${selectedLocation.lng}`,
                location_name: nearestLocation ? nearestLocation.name : null
            };
        } else {
            addressData = { 
                address_manual: addressInput.value
            };
        }

        fetch('/api/user/addresses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify(addressData)
        })
        .then(response => response.json())
        .then(() => {
            addressInput.value = '';
            if (marker) {
                map.removeLayer(marker);
            }
            selectedLocation = null;
            selectedMarker = null;
            fetchAddresses();
        })
        .catch(error => console.error('Error adding address:', error));
    }

    function deleteAddress(index) {
        fetch(`/api/user/addresses/${index}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        })
        .then(response => response.json())
        .then(() => {
            fetchAddresses();
        })
        .catch(error => console.error('Error deleting address:', error));
    }

    function useCurrentLocation() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const latlng = L.latLng(lat, lon);
                
                if (isPointInPolygon(latlng, polygonBoundary)) {
                    setMarker(latlng);
                    fillAddressInput(latlng);
                    map.setView(latlng, 17);
                } else {
                    alert("Your current location is outside the allowed area. Please select a location within the highlighted area.");
                }
            });
        } else {
            alert("Geolocation is not supported by your browser");
        }
    }

    function openUpdateAddressModal(index) {
        currentAddressIndex = index;
        const address = userAddresses[index];
        updateAddressInput.value = address.locationName || address.manual || address.auto;
        updateAddressModal.style.display = 'block';
    }

    function closeUpdateAddressModal() {
        updateAddressModal.style.display = 'none';
        currentAddressIndex = -1;
        selectedLocation = null;
        selectedMarker = null;
    }

    function updateAddress(e) {
        e.preventDefault();
        let addressData;
        
        if (selectedLocation && selectedMarker) {
            addressData = {
                address_auto: `${selectedLocation.lat},${selectedLocation.lng}`,
                location_name: selectedMarker.name
            };
        } else {
            addressData = { 
                address_manual: updateAddressInput.value
            };
        }

        fetch(`/api/user/addresses/${currentAddressIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify(addressData)
        })
        .then(response => response.json())
        .then(() => {
            closeUpdateAddressModal();
            fetchAddresses();
        })
        .catch(error => console.error('Error updating address:', error));
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

    function findNearestLocation(lat, lng) {
        if (!markers.length) return null;
        
        let nearestMarker = null;
        let shortestDistance = Number.MAX_VALUE;

        markers.forEach(markerGroup => {
            markerGroup.locations.forEach(marker => {
                const [markerLng, markerLat] = marker.coordinates;
                const distance = Math.sqrt(
                    Math.pow(lat - markerLat, 2) + 
                    Math.pow(lng - markerLng, 2)
                );

                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    nearestMarker = { ...marker, markerType: markerGroup.markerType };
                }
            });
        });
        
        return nearestMarker;
    }

    function updateMarkerLabels() {
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        const visibleMarkers = [];

        markerLabels.forEach(({ marker, name }) => {
            const markerPosition = marker.getLatLng();
            if (bounds.contains(markerPosition)) {
                const pixelPosition = map.latLngToContainerPoint(markerPosition);
                visibleMarkers.push({ marker, name, pixelPosition });
            }
        });

        const labelElements = document.querySelectorAll('.marker-label');
        labelElements.forEach(label => label.style.display = 'none');

        if (zoom >= 15) {
            const occupiedAreas = [];

            visibleMarkers.forEach(({ marker, name, pixelPosition }) => {
                const labelElement = marker.getElement().querySelector('.marker-label');
                const labelWidth = name.length * 7; // Approximate width based on character count
                const labelHeight = 20; // Approximate height

                const labelArea = {
                    left: pixelPosition.x - labelWidth / 2,
                    right: pixelPosition.x + labelWidth / 2,
                    top: pixelPosition.y - 34 - labelHeight,
                    bottom: pixelPosition.y - 34
                };

                const hasCollision = occupiedAreas.some(area => 
                    !(labelArea.left > area.right || 
                      labelArea.right < area.left || 
                      labelArea.top > area.bottom ||
                      labelArea.bottom < area.top)
                );

                if (!hasCollision) {
                    labelElement.style.display = 'block';
                    occupiedAreas.push(labelArea);
                }
            });
        }
    }


    // Event listeners
    addressForm.addEventListener('submit', addAddress);
    useCurrentLocationBtn.addEventListener('click', useCurrentLocation);
    updateAddressForm.addEventListener('submit', updateAddress);
    closeUpdateModal.addEventListener('click', closeUpdateAddressModal);
    homeBtn.addEventListener('click', () => window.location.href = 'main_user.html');
    cartBtn.addEventListener('click', () => window.location.href = 'cart.html');
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('userToken');
        window.location.href = 'user_auth.html';
    });
});

