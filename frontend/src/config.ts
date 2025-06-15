// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// API Endpoints
export const API_URLS = {
  categories: `${API_BASE_URL}/api/categories`,
  items: `${API_BASE_URL}/api/items`,
}; 