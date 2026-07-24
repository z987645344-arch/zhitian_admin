const form = document.querySelector('#loginForm');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const roleInput = document.querySelector('#role');
const loginButton = document.querySelector('#loginButton');
const message = document.querySelector('#message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) return;

  setLoading(true);
  message.textContent = '';

  try {
    const data = await API.login(username, password, roleInput.value);
    if (data.role === 'customer') {
      API.logout();
      message.textContent = '客户请使用桌面端应用';
      return;
    }
    if (!['employee', 'reviewer', 'developer'].includes(data.role)) {
      API.logout();
      message.textContent = '该账号无管理后台权限';
      return;
    }

    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user_role', data.role);
    localStorage.setItem('username', username);
    const destinations = {
      employee: './employee.html',
      reviewer: './reviewer.html',
      developer: './developer.html',
    };
    location.replace(destinations[data.role]);
  } catch (error) {
    message.textContent = briefError(error);
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.textContent = isLoading ? '登录中...' : '登录';
}

function briefError(error) {
  const text = String(error.message || error).replaceAll('\n', ' ');
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}
