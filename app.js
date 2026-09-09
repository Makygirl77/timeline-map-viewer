// Timeline Map Application - Enhanced Interactive Version

class TimelineMapApp {
    constructor() {
        this.timeline = [];
        this.map = null;
        this.markers = [];
        this.polyline = null;
        this.isPlaying = false;
        this.currentMarkerIndex = 0;
        this.animationInterval = null;
        this.highlightedPolyline = null;
        this.markerColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
        this.colorIndex = 0;
        
        this.initMap();
        this.loadTimeline();
        this.setupEventListeners();
    }

    // Initialize the map with better controls
    initMap() {
        this.map = L.map('map', {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([36.1627, -86.7816], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 2
        }).addTo(this.map);

        // Add map scale
        L.control.scale().addTo(this.map);
    }

    loadTimeline() {
        fetch('timeline.json')
            .then(response => response.json())
            .then(data => {
                this.timeline = data.semanticSegments;
                this.populateFilters();
                this.displayAllData();
            })
            .catch(err => console.error('Error loading timeline:', err));
    }

    // Parse coordinates from various formats
    parseCoordinates(coordString) {
        const cleaned = coordString.replace(/°/g, '').trim();
        const [lat, lon] = cleaned.split(',').map(s => parseFloat(s.trim()));
        return [lat, lon];
    }

    // Extract date components
    getDateComponents(dateString) {
        const date = new Date(dateString);
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            fullDate: date.toISOString().split('T')[0],
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            fullDateTime: date.toLocaleString()
        };
    }

    // Calculate distance between two points (in meters)
    calculateDistance(coord1, coord2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
        const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Populate filter dropdowns
    populateFilters() {
        const years = new Set();
        
        this.timeline.forEach(segment => {
            const startDate = this.getDateComponents(segment.startTime);
            years.add(startDate.year);
        });

        const yearSelect = document.getElementById('year-select');
        Array.from(years).sort().forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    }

    // Update month filter based on selected year
    updateMonthFilter() {
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');
        const selectedYear = yearSelect.value;

        monthSelect.innerHTML = '<option value="">All Months</option>';
        monthSelect.disabled = !selectedYear;

        if (!selectedYear) return;

        const months = new Set();
        this.timeline.forEach(segment => {
            const startDate = this.getDateComponents(segment.startTime);
            if (startDate.year == selectedYear) {
                months.add(startDate.month);
            }
        });

        Array.from(months).sort().forEach(month => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = this.getMonthName(month);
            monthSelect.appendChild(option);
        });
    }

    // Update day filter based on selected year and month
    updateDayFilter() {
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');
        const daySelect = document.getElementById('day-select');
        const selectedYear = yearSelect.value;
        const selectedMonth = monthSelect.value;

        daySelect.innerHTML = '<option value="">All Days</option>';
        daySelect.disabled = !selectedYear || !selectedMonth;

        if (!selectedYear || !selectedMonth) return;

        const days = new Set();
        this.timeline.forEach(segment => {
            const startDate = this.getDateComponents(segment.startTime);
            if (startDate.year == selectedYear && startDate.month == selectedMonth) {
                days.add(startDate.day);
            }
        });

        Array.from(days).sort((a, b) => a - b).forEach(day => {
            const option = document.createElement('option');
            option.value = day;
            option.textContent = `Day ${day}`;
            daySelect.appendChild(option);
        });
    }

    // Get month name
    getMonthName(month) {
        const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return months[month];
    }

    // Setup event listeners
    setupEventListeners() {
        document.getElementById('year-select').addEventListener('change', () => {
            this.updateMonthFilter();
            this.updateDayFilter();
            this.filterAndDisplay();
        });

        document.getElementById('month-select').addEventListener('change', () => {
            this.updateDayFilter();
            this.filterAndDisplay();
        });

        document.getElementById('day-select').addEventListener('change', () => {
            this.filterAndDisplay();
        });

        document.getElementById('play-btn').addEventListener('click', () => this.playAnimation());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopAnimation());

        // Add hover effects to markers
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('.leaflet-marker-icon')) {
                e.target.closest('.leaflet-marker-icon').style.filter = 'brightness(1.3)';
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('.leaflet-marker-icon')) {
                e.target.closest('.leaflet-marker-icon').style.filter = 'brightness(1)';
            }
        });
    }

    // Filter and display data based on selections
    filterAndDisplay() {
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');
        const daySelect = document.getElementById('day-select');

        const selectedYear = yearSelect.value ? parseInt(yearSelect.value) : null;
        const selectedMonth = monthSelect.value ? parseInt(monthSelect.value) : null;
        const selectedDay = daySelect.value ? parseInt(daySelect.value) : null;

        const filtered = this.timeline.filter(segment => {
            const startDate = this.getDateComponents(segment.startTime);
            
            if (selectedYear && startDate.year !== selectedYear) return false;
            if (selectedMonth && startDate.month !== selectedMonth) return false;
            if (selectedDay && startDate.day !== selectedDay) return false;
            
            return true;
        });

        this.displayData(filtered);
    }

    // Display all data
    displayAllData() {
        this.displayData(this.timeline);
    }

    // Display filtered data on map - ENHANCED for clarity
    displayData(segments) {
        this.clearMap();

        if (segments.length === 0) {
            document.getElementById('location-count').textContent = '0';
            document.getElementById('time-range').textContent = '-';
            document.getElementById('distance-traveled').textContent = '-';
            return;
        }

        let allCoords = [];
        let minTime = null;
        let maxTime = null;
        let totalDistance = 0;
        let segmentColors = {};

        segments.forEach((segment, segmentIndex) => {
            const startDate = this.getDateComponents(segment.startTime);
            const endDate = this.getDateComponents(segment.endTime);
            const segmentColor = this.markerColors[segmentIndex % this.markerColors.length];
            segmentColors[segmentIndex] = segmentColor;

            if (!minTime) minTime = startDate.fullDateTime;
            maxTime = endDate.fullDateTime;

            // FIXED: Only process segments that have timelinePath
            if (segment.timelinePath && Array.isArray(segment.timelinePath)) {
                segment.timelinePath.forEach((pathPoint, index) => {
                    const coords = this.parseCoordinates(pathPoint.point);
                    const time = this.getDateComponents(pathPoint.time);

                    allCoords.push({coords: coords, time: time, segmentIndex: segmentIndex, pathIndex: index});

                    // Calculate distance from previous point
                    let distanceFromPrev = 0;
                    if (allCoords.length > 1) {
                        const prevCoords = allCoords[allCoords.length - 2].coords;
                        distanceFromPrev = this.calculateDistance(prevCoords, coords);
                        totalDistance += distanceFromPrev;
                    }

                    // ENHANCED MARKER - Larger and more visible
                    const marker = L.circleMarker(coords, {
                        radius: 12,  // Much larger
                        fillColor: segmentColor,
                        color: '#000000',  // Black border for contrast
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 0.9,
                        className: 'travel-marker'
                    }).addTo(this.map);

                    // Enhanced popup with more info
                    marker.bindPopup(`
                        <div style="font-weight: bold; color: ${segmentColor}; font-size: 13px;">
                            📍 Location ${index + 1}
                        </div>
                        <hr style="margin: 5px 0;">
                        <div style="font-size: 12px;">
                            <strong>Coordinates:</strong><br>
                            Latitude: ${coords[0].toFixed(6)}°<br>
                            Longitude: ${coords[1].toFixed(6)}°<br>
                            <strong>Time:</strong><br>
                            ${time.fullDateTime}<br>
                            <strong>Distance from previous:</strong><br>
                            ${distanceFromPrev.toFixed(0)} meters
                        </div>
                    `, {
                        maxWidth: 250,
                        className: 'travel-popup'
                    });

                    // Add click event to highlight path
                    marker.on('click', () => {
                        this.highlightPathSegment(segment.timelinePath, segmentIndex);
                    });

                    this.markers.push({marker, coords, time: time.fullDateTime});
                });
            }
            
            // FIXED: Also handle visit and activity locations
            if (segment.visit && segment.visit.topCandidate && segment.visit.topCandidate.placeLocation) {
                const placeCoords = this.parseCoordinates(segment.visit.topCandidate.placeLocation.latLng);
                const time = this.getDateComponents(segment.startTime);
                
                allCoords.push({coords: placeCoords, time: time, segmentIndex: segmentIndex, pathIndex: 0});

                const marker = L.circleMarker(placeCoords, {
                    radius: 10,
                    fillColor: '#FFC300',
                    color: '#000000',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8,
                    className: 'visit-marker'
                }).addTo(this.map);

                marker.bindPopup(`
                    <div style="font-weight: bold; color: #FFC300; font-size: 13px;">
                        🏠 Visit Location
                    </div>
                    <hr style="margin: 5px 0;">
                    <div style="font-size: 12px;">
                        <strong>Coordinates:</strong><br>
                        Latitude: ${placeCoords[0].toFixed(6)}°<br>
                        Longitude: ${placeCoords[1].toFixed(6)}°<br>
                        <strong>Time:</strong><br>
                        ${time.fullDateTime}
                    </div>
                `, {
                    maxWidth: 250,
                    className: 'travel-popup'
                });

                this.markers.push({marker, coords: placeCoords, time: time.fullDateTime});
            }
        });

        // Update stats
        document.getElementById('location-count').textContent = allCoords.length;
        document.getElementById('time-range').textContent = minTime && maxTime ? `${minTime} to ${maxTime}` : '-';
        document.getElementById('distance-traveled').textContent = totalDistance > 0 ? 
            `${(totalDistance / 1000).toFixed(2)} km (${(totalDistance / 1609).toFixed(2)} mi)` : '-';

        // Fit map to bounds if we have coordinates
        if (allCoords.length > 0) {
            const bounds = L.latLngBounds(allCoords.map(c => c.coords));
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    // Highlight path segment when marker is clicked
    highlightPathSegment(path, segmentIndex) {
        if (this.highlightedPolyline) {
            this.map.removeLayer(this.highlightedPolyline);
        }

        const coords = path.map(point => {
            const parsed = this.parseCoordinates(point.point);
            return L.latLng(parsed[0], parsed[1]);
        });

        this.highlightedPolyline = L.polyline(coords, {
            color: this.markerColors[segmentIndex % this.markerColors.length],
            weight: 4,
            opacity: 0.8,
            dashArray: '5, 5'
        }).addTo(this.map);
    }

    // Clear all markers and paths from map
    clearMap() {
        this.markers.forEach(m => this.map.removeLayer(m.marker));
        this.markers = [];
        
        if (this.polyline) {
            this.map.removeLayer(this.polyline);
            this.polyline = null;
        }
        
        if (this.highlightedPolyline) {
            this.map.removeLayer(this.highlightedPolyline);
            this.highlightedPolyline = null;
        }
    }

    // Play animation through markers
    playAnimation() {
        if (this.markers.length === 0) return;
        
        this.isPlaying = true;
        document.getElementById('play-btn').disabled = true;
        document.getElementById('stop-btn').disabled = false;
        
        this.currentMarkerIndex = 0;
        this.animationInterval = setInterval(() => {
            if (this.currentMarkerIndex < this.markers.length) {
                this.markers[this.currentMarkerIndex].marker.openPopup();
                this.map.panTo(this.markers[this.currentMarkerIndex].coords);
                this.currentMarkerIndex++;
            } else {
                this.stopAnimation();
            }
        }, 500);
    }

    // Stop animation
    stopAnimation() {
        this.isPlaying = false;
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        document.getElementById('play-btn').disabled = false;
        document.getElementById('stop-btn').disabled = true;
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TimelineMapApp();
});
