const form = document.querySelector('#loginForm');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const togglePassword = document.querySelector('#togglePassword');
const roleInput = document.querySelector('#role');
const roleToggleButtons = document.querySelectorAll('.role-toggle-option');
const loginButton = document.querySelector('#loginButton');
const message = document.querySelector('#message');

togglePassword.addEventListener('click', () => {
  const visible = passwordInput.type === 'text';
  passwordInput.type = visible ? 'password' : 'text';
  togglePassword.textContent = visible ? '显示' : '隐藏';
  togglePassword.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
  togglePassword.setAttribute('aria-pressed', String(!visible));
});

const authNotice = sessionStorage.getItem('auth_notice');
if (authNotice) {
  message.textContent = authNotice;
  sessionStorage.removeItem('auth_notice');
}

roleToggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    roleToggleButtons.forEach((option) => {
      option.classList.remove('active');
      option.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    roleInput.value = button.dataset.role;
  });
});

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

    API.addOrUpdateSavedAccount(username, data.role, data.token);
    API.setActiveAccount(username, data.role);
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
  loginButton.textContent = isLoading ? '登录中...' : '安全登录';
}

function briefError(error) {
  const text = String(error.message || error).replaceAll('\n', ' ');
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}
