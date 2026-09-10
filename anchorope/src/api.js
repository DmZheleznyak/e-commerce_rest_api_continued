export const apiUrl = process.env.REACT_APP_API_URL
  || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin);

export const fetchWithAuth = async (input, init = {}) => {
  const requestUrl = typeof input === 'string' && input.startsWith('/')
    ? `${apiUrl}${input}`
    : input;
  const response = await fetch(requestUrl, {
    ...init,
    credentials: 'include'
  });

  if (response.status === 401) {
    localStorage.removeItem('user');
    window.location.assign('/login');
  }

  return response;
};
