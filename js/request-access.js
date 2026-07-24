const form = document.querySelector('#requestAccessForm');
const message = document.querySelector('#message');
const submitButton = document.querySelector('#submitButton');
const sendCodeButton = document.querySelector('#sendCodeButton');

sendCodeButton.addEventListener('click', async () => {
  const email = document.querySelector('#email').value.trim();
  if (!email.includes('@') || !email.split('@').pop().includes('.')) {
    message.textContent = '请输入有效的邮箱地址'; return;
  }
  sendCodeButton.disabled = true;
  try {
    const result = await API.sendVerificationCode(email, 'register');
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
  submitButton.disabled = true; message.textContent = '提交中...';
  try {
    const result = await API.requestRegistration({
      username: email,
      email,
      password,
      requested_role: document.querySelector('#requestedRole').value,
      enterprise_password: document.querySelector('#enterprisePassword').value,
      verification_code: document.querySelector('#verificationCode').value.trim(),
    });
    form.reset();
    message.textContent = `申请已提交，等待审批。申请ID：${result.id}`;
  } catch (error) {
    message.textContent = String(error.message || error);
  } finally { submitButton.disabled = false; }
});
