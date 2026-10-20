/**
 * Smart Bus Tracking - Backend API Client
 * Connects frontend pages to the Node.js/Express backend API.
 */

const BACKEND_API_BASE = "http://localhost:5000/api";

const ApiClient = {
  // Helper for fetch requests
  async request(endpoint, options = {}) {
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(`${BACKEND_API_BASE}${endpoint}`, config);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  },

  // Health
  checkHealth() {
    return this.request("/health");
  },

  // Buses
  buses: {
    getAll() {
      return ApiClient.request("/buses");
    },
    getById(id) {
      return ApiClient.request(`/buses/${id}`);
    },
    create(data) {
      return ApiClient.request("/buses", { method: "POST", body: JSON.stringify(data) });
    },
    update(id, data) {
      return ApiClient.request(`/buses/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    updateLocation(id, coords) {
      return ApiClient.request(`/buses/${id}/location`, { method: "POST", body: JSON.stringify(coords) });
    },
    delete(id) {
      return ApiClient.request(`/buses/${id}`, { method: "DELETE" });
    },
  },

  // Drivers
  drivers: {
    getAll() {
      return ApiClient.request("/drivers");
    },
    getBus(driverUid) {
      return ApiClient.request(`/drivers/${driverUid}/bus`);
    },
    create(data) {
      return ApiClient.request("/auth/driver", { method: "POST", body: JSON.stringify(data) });
    },
    delete(id) {
      return ApiClient.request(`/drivers/${id}`, { method: "DELETE" });
    },
  },

  // Routes
  routes: {
    getAll() {
      return ApiClient.request("/routes");
    },
    getById(id) {
      return ApiClient.request(`/routes/${id}`);
    },
    create(data) {
      return ApiClient.request("/routes", { method: "POST", body: JSON.stringify(data) });
    },
    update(id, data) {
      return ApiClient.request(`/routes/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    delete(id) {
      return ApiClient.request(`/routes/${id}`, { method: "DELETE" });
    },
  },

  // Trips
  trips: {
    start(driverUid, busId, routeId) {
      return ApiClient.request("/trips/start", {
        method: "POST",
        body: JSON.stringify({ driverUid, busId, routeId }),
      });
    },
    end(tripId, busId) {
      return ApiClient.request(`/trips/${tripId}/end`, {
        method: "POST",
        body: JSON.stringify({ busId }),
      });
    },
    getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      return ApiClient.request(`/trips${query ? "?" + query : ""}`);
    },
  },

  // Attendance
  attendance: {
    mark(data) {
      return ApiClient.request("/attendance", { method: "POST", body: JSON.stringify(data) });
    },
    get(params = {}) {
      const query = new URLSearchParams(params).toString();
      return ApiClient.request(`/attendance${query ? "?" + query : ""}`);
    },
  },

  // Alerts
  alerts: {
    broadcast(data) {
      return ApiClient.request("/alerts", { method: "POST", body: JSON.stringify(data) });
    },
    getAll(limit = 20) {
      return ApiClient.request(`/alerts?limit=${limit}`);
    },
  },
};

// Make accessible on window
window.ApiClient = ApiClient;
