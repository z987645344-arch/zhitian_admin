const form = document.querySelector('#requestAccessForm');
const message = document.querySelector('#message');
const submitButton = document.querySelector('#submitButton');
const sendCodeButton = document.querySelector('#sendCodeButton');
const requestedRoleSelect = document.querySelector('#requestedRole');
const roleToggleButtons = document.querySelectorAll('.role-toggle-option');

roleToggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    roleToggleButtons.forEach((option) => {
      option.classList.remove('active');
      option.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    requestedRoleSelect.value = button.dataset.role;
  });
});

function isStrongPassword(value) {
  return typeof value === 'string'
    && value.length >= 10
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /[0-9]/.test(value);
}

sendCodeButton.addEventListener('click', async () => {
  const email = document.querySelector('#email').value.trim();
  if (!email.includes('@') || !email.split('@').pop().includes('.')) {
    message.textContent = '请输入有效的邮箱地址'; return;
  }
  // 后端已把企业密码校验前置到发送验证码，未填写时不发起请求
  const enterprisePassword = document.querySelector('#enterprisePassword').value;
  if (!enterprisePassword) {
    message.textContent = '请先填写企业密码'; return;
  }
  sendCodeButton.disabled = true;
  try {
    const result = await API.sendVerificationCode(email, 'register', enterprisePassword);
    message.textContent = result.detail;
  } catch (error) {
    message.textContent = String(error.message || error);
  } finally { sendCodeButton.disabled = false; }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;
  const confirmation = document.querySelector('#confirmPassword').value;
  if (!email.includes('@') || !email.split('@').pop().includes('.')) {
    message.textContent = '请输入有效的邮箱地址'; return;
  }
  if (password !== confirmation) { message.textContent = '两次输入的密码不一致'; return; }
  // 前端预检减少无效请求，后端 validate_password_strength 才是唯一权威判断
  if (!isStrongPassword(password)) {
    message.textContent = '密码需至少10位，且包含大小写字母和数字'; return;
  }
  submitButton.disabled = true; message.textContent = '提交中...';
  try {
    const result = await API.requestRegistration({
      username: email,
      email,
      password,
      requested_role: requestedRoleSelect.value,
      enterprise_password: document.querySelector('#enterprisePassword').value,
      verification_code: document.querySelector('#verificationCode').value.trim(),
    });
    form.reset();
    roleToggleButtons.forEach((option) => {
      const isDefault = option.dataset.role === 'employee';
      option.classList.toggle('active', isDefault);
      option.setAttribute('aria-pressed', String(isDefault));
    });
    message.textContent = `申请已提交，等待审批。申请ID：${result.id}`;
  } catch (error) {
    message.textContent = String(error.message || error);
  } finally { submitButton.disabled = false; }
});
