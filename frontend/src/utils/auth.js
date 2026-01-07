// Auth utility functions for managing authentication state

/**
 * Save authentication data to localStorage
 * @param {string} token - JWT token
 * @param {object} user - User object with id, name, email
 */
export const saveAuthData = (token, user) => {
  // Calculate expiration time (15 days from now)
  const expirationTime = Date.now() + (15 * 24 * 60 * 60 * 1000); // 15 days in milliseconds
  
  localStorage.setItem('chatToken', token);
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('tokenExpiration', expirationTime.toString());
};

/**
 * Get authentication token from localStorage
 * @returns {string|null} Token or null if not found/expired
 */
export const getToken = () => {
  const token = localStorage.getItem('chatToken');
  const expirationTime = localStorage.getItem('tokenExpiration');
  
  if (!token || !expirationTime) {
    return null;
  }
  
  // Check if token is expired
  if (Date.now() > parseInt(expirationTime)) {
    clearAuthData();
    return null;
  }
  
  return token;
};

/**
 * Get user data from localStorage
 * @returns {object|null} User object or null if not found
 */
export const getUser = () => {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    return null;
  }
  
  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

/**
 * Check if user is authenticated (has valid token)
 * @returns {boolean} True if authenticated
 */
export const isAuthenticated = () => {
  const token = getToken();
  return token !== null;
};

/**
 * Clear all authentication data from localStorage
 */
export const clearAuthData = () => {
  localStorage.removeItem('chatToken');
  localStorage.removeItem('user');
  localStorage.removeItem('tokenExpiration');
};

