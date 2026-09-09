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
        
        this.initMap();\n        this.loadTimeline();
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
        .catch(err => console.log('Error loading timeline:', err));
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
                marker.on('click', () => {\n                    this.highlightPathSegment(segment.timelinePath, segmentIndex);\n                });\n\n                this.markers.push({marker, coords, index});\n            });\n        });\n\n        // ENHANCED POLYLINE - Thicker and more visible\n        if (allCoords.length > 0) {\n            const polylineCoords = allCoords.map(item => item.coords);\n            this.polyline = L.polyline(polylineCoords, {\n                color: '#FF0000',  // Red for maximum visibility\n                weight: 4,         // Thicker line\n                opacity: 0.8,\n                smoothFactor: 1.0,\n                dashArray: '5, 5'  // Dashed pattern for clarity\n            }).addTo(this.map);\n\n            // Add arrows to show direction\n            this.addDirectionArrows(polylineCoords);\n\n            // Fit map to bounds with padding\n            this.map.fitBounds(this.polyline.getBounds(), { padding: [100, 100] });\n        }\n\n        // Update stats with enhanced info\n        document.getElementById('location-count').textContent = allCoords.length;\n        document.getElementById('time-range').textContent = `${minTime} → ${maxTime}`;\n        document.getElementById('distance-traveled').textContent = this.formatDistance(totalDistance);\n\n        // Log to console for debugging\n        console.log(`Displayed ${allCoords.length} locations, Total distance: ${totalDistance.toFixed(0)}m`);\n    }\n\n    // Add direction arrows to polyline\n    addDirectionArrows(coords) {\n        if (coords.length < 2) return;\n\n        // Add arrow every few points\n        const step = Math.max(1, Math.floor(coords.length / 5));\n        \n        for (let i = 0; i < coords.length - 1; i += step) {\n            const from = coords[i];\n            const to = coords[i + 1];\n            \n            const angle = Math.atan2(\n                to[0] - from[0],\n                to[1] - from[1]\n            ) * 180 / Math.PI;\n\n            L.marker(\n                [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],\n                {\n                    icon: L.divIcon({\n                        html: `<div style=\"transform: rotate(${angle}deg); font-size: 20px;\">→</div>`,\n                        iconSize: [30, 30],\n                        className: 'arrow-marker'\n                    })\n                }\n            ).addTo(this.map);\n        }\n    }\n\n    // Highlight a specific path segment\n    highlightPathSegment(timelinePath, segmentIndex) {\n        if (this.highlightedPolyline) {\n            this.map.removeLayer(this.highlightedPolyline);\n        }\n\n        const coords = timelinePath.map(point => this.parseCoordinates(point.point));\n        const color = this.markerColors[segmentIndex % this.markerColors.length];\n\n        this.highlightedPolyline = L.polyline(coords, {\n            color: color,\n            weight: 6,\n            opacity: 1,\n            smoothFactor: 1.0\n        }).addTo(this.map);\n    }\n\n    // Format distance for display\n    formatDistance(meters) {\n        if (meters < 1000) {\n            return `${meters.toFixed(0)} meters`;\n        } else {\n            return `${(meters / 1000).toFixed(2)} km`;\n        }\n    }\n\n    // Clear map\n    clearMap() {\n        this.markers.forEach(item => this.map.removeLayer(item.marker));\n        this.markers = [];\n        \n        if (this.polyline) {\n            this.map.removeLayer(this.polyline);\n            this.polyline = null;\n        }\n\n        if (this.highlightedPolyline) {\n            this.map.removeLayer(this.highlightedPolyline);\n            this.highlightedPolyline = null;\n        }\n    }\n\n    // Play animation - ENHANCED with visual effects\n    playAnimation() {\n        if (this.markers.length === 0) return;\n\n        this.isPlaying = true;\n        this.currentMarkerIndex = 0;\n        document.getElementById('play-btn').disabled = true;\n        document.getElementById('stop-btn').disabled = false;\n\n        this.animationInterval = setInterval(() => {\n            if (this.currentMarkerIndex < this.markers.length) {\n                const currentMarker = this.markers[this.currentMarkerIndex];\n                \n                // Zoom to current marker\n                this.map.setView(currentMarker.coords, 15, { animate: true });\n                \n                // Open popup\n                currentMarker.marker.openPopup();\n                \n                // Highlight marker\n                currentMarker.marker.setStyle({\n                    radius: 16,\n                    fillOpacity: 1\n                });\n                \n                this.currentMarkerIndex++;\n            } else {\n                this.stopAnimation();\n            }\n        }, 800);\n    }\n\n    // Stop animation\n    stopAnimation() {\n        this.isPlaying = false;\n        clearInterval(this.animationInterval);\n        document.getElementById('play-btn').disabled = false;\n        document.getElementById('stop-btn').disabled = true;\n        this.currentMarkerIndex = 0;\n    }\n}\n\n// Initialize app when page loads\ndocument.addEventListener('DOMContentLoaded', () => {\n    new TimelineMapApp();\n});\n
