// US State GeoJSON from https://eric.clst.org/tech/usgeojson/
const statesGeoJsonUrl = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

// Color by presence
function getStateColor(presence) {
  switch (presence) {
    case "direct": return "#3CB371";      // Green
    case "distributor": return "#FFA500"; // Orange
    case "importer": return "#4682B4";    // Blue
    default: return "#dddddd";            // Light Grey
  }
}

// Load CSV data and GeoJSON, then make map
function loadDataAndMap() {
  Promise.all([
    fetch("data.csv").then(r => r.text()),
    fetch(statesGeoJsonUrl).then(r => r.json())
  ]).then(([csvText, usStatesGeoJson]) => {
    const cities = Papa.parse(csvText, {header: true}).data;
    const stateInfo = {};

    // Find presence/contact per state and cities
    cities.forEach(row => {
      if (!row.state) return;
      if (!stateInfo[row.state]) {
        stateInfo[row.state] = {
          presence: row.presence || "none",
          contact: row.contact || "",
          cities: []
        };
      }
      if (row.city) {
        stateInfo[row.state].cities.push({
          city: row.city,
          presence: row.presence,
          contact: row.contact
        });
      }
      // If any city has higher priority presence, update state
      if (
        (row.presence === "direct" && stateInfo[row.state].presence !== "direct") ||
        (row.presence === "distributor" && ["importer", "none"].includes(stateInfo[row.state].presence)) ||
        (row.presence === "importer" && stateInfo[row.state].presence === "none")
      ) {
        stateInfo[row.state].presence = row.presence;
        stateInfo[row.state].contact = row.contact;
      }
    });

    // Set up map
    const map = L.map('map').setView([39.82, -98.57], 4); // center USA
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 8, minZoom: 3,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Add states polygons
    function style(feature) {
      const st = feature.properties.name;
      const info = stateInfo[st] || {presence: "none"};
      return {
        fillColor: getStateColor(info.presence),
        weight: 1,
        opacity: 1,
        color: '#aaa',
        fillOpacity: 0.6
      };
    }
    function onEachFeature(feature, layer) {
      const st = feature.properties.name;
      const info = stateInfo[st] || {presence: "none", cities: []};
      let popup = `<b>${st}</b><br>Presence: <span style="color:${getStateColor(info.presence)};">${info.presence || "none"}</span>`;
      if (info.contact) popup += `<br>Contact: ${info.contact}`;
      if (info.cities && info.cities.length) {
        popup += `<br><b>Cities:</b><ul style="padding-left:1em">`
        info.cities.forEach(ci => {
          popup += `<li>${ci.city} <small>(${ci.presence})</small>${ci.contact ? " – "+ci.contact : ""}</li>`;
        });
        popup += "</ul>";
      }
      layer.bindPopup(popup);
    }
    L.geoJson(usStatesGeoJson, {style, onEachFeature}).addTo(map);

    // Add city markers
    cities.forEach(row => {
      if (!row.city || !row.state) return;
      // Get lat/lon for the city using Nominatim API (limited, so fallback to a few big cities)
      // For demo, just use some example coords for the 3 largest per state
      // In real use, predefine a list of {state, city, lat, lon}
      const cityCoords = cityLatLon(row.state, row.city);
      if (cityCoords) {
        L.circleMarker(cityCoords, {
          radius: 7,
          fillColor: getStateColor(row.presence),
          color: "#333",
          weight: 1,
          fillOpacity: 0.95
        }).addTo(map)
        .bindPopup(`<b>${row.city}, ${row.state}</b><br>Presence: <span style="color:${getStateColor(row.presence)};">${row.presence}</span>${row.contact ? "<br>Contact: " + row.contact : ""}`);
      }
    });
  });
}

// Provide lat/lon for largest cities per state (for demo: only a few, add more as you wish)
function cityLatLon(state, city) {
  const lookup = {
    "California": {
      "Los Angeles": [34.0522, -118.2437],
      "San Diego": [32.7157, -117.1611],
      "San Francisco": [37.7749, -122.4194]
    },
    "New York": {
      "New York": [40.7128, -74.0060],
      "Buffalo": [42.8864, -78.8784],
      "Rochester": [43.1566, -77.6088]
    },
    "Texas": {
      "Houston": [29.7604, -95.3698],
      "San Antonio": [29.4241, -98.4936],
      "Dallas": [32.7767, -96.7970]
    }
    // Add more as needed!
  };
  return lookup[state] && lookup[state][city] ? lookup[state][city] : null;
}

window.onload = loadDataAndMap;