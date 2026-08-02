const token = localStorage.getItem('auth_token');
const role = localStorage.getItem('user_role');

if (!token) location.replace('./login.html');
else if (role === 'employee') location.replace('./employee.html');
else if (role === 'reviewer') location.replace('./reviewer.html');
else if (role === 'developer') location.replace('./developer.html');
else {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_role');
  localStorage.removeItem('username');
  location.replace('./login.html');
}
