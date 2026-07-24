const form = document.querySelector('#forgotPasswordForm');
const message = document.querySelector('#message');
const submitButton = document.querySelector('#submitButton');
const passwordResult = document.querySelector('#passwordResult');
const sendCodeButton = document.querySelector('#sendCodeButton');

sendCodeButton.addEventListener('click', async () => {
  const email = document.querySelector('#email').value.trim();
  if (!email.includes('@') || !email.split('@').pop().includes('.')) {
    message.textContent = '请输入有效的邮箱地址'; return;
  }
  sendCodeButton.disabled = true;
  try {
    const result = await API.sendVerificationCode(email, 'reset_password');
    message.textContent = result.detail;
  } catch (error) {
    message.textContent = String(error.message || error);
  } finally { sendCodeButton.disabled = false; }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  message.textContent = '正在验证...';
  passwordResult.classList.add('hidden');
  try {
    const result = await API.forgotPassword(
      document.querySelector('#email').value.trim(),
      document.querySelector('#enterprisePassword').value,
      document.querySelector('#verificationCode').value.trim(),
    );
    document.querySelector('#newPassword').textContent = result.new_password;
    passwordResult.classList.remove('hidden');
    message.textContent = '';
    form.reset();
  } catch (_) {
    message.textContent = '无法重置密码，请检查邮箱和企业密码后重试';
  } finally {
    submitButton.disabled = false;
  }
});
