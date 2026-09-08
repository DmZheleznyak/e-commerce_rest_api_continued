export const fetchWithAuth = async (input, init = {}) => {
  const response = await fetch(input, {
    ...init,
    credentials: 'include'
  });

  if (response.status === 401) {
    localStorage.removeItem('user');
    window.location.assign('/login');
  }

  return response;
};
