(function(){
  const SESSION_KEY = 'scorecard:auth';
  const USERS_KEY = 'scorecard:users';
  
  // Initialize with default admin account
  function initializeUsers(){
    const users = getUsers();
    if(Object.keys(users).length === 0){
      users['admin'] = { username: 'admin', password: 'scorecard2026', email: 'admin@scorecard.com' };
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return users;
  }

  function getUsers(){
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function userExists(username){
    const users = getUsers();
    return users.hasOwnProperty(username);
  }

  function emailExists(email){
    const users = getUsers();
    return Object.values(users).some(user => user.email === email);
  }

  function createUser(username, password, email){
    if(userExists(username)){
      return { success: false, error: 'Username already exists' };
    }
    if(emailExists(email)){
      return { success: false, error: 'Email already registered' };
    }
    if(username.length < 3){
      return { success: false, error: 'Username must be at least 3 characters' };
    }
    if(password.length < 6){
      return { success: false, error: 'Password must be at least 6 characters' };
    }
    if(!email || !email.includes('@')){
      return { success: false, error: 'Valid email is required' };
    }

    const users = getUsers();
    users[username] = { username, password, email };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    // Simulate sending welcome email
    sendWelcomeEmail(email, username);
    
    return { success: true };
  }

  function sendWelcomeEmail(email, username){
    // Note: Real email sending requires a backend server
    // This simulates the email by storing a notification
    console.log(`Welcome email sent to ${email}`);
    console.log(`Subject: Welcome to Scorecard, ${username}!`);
    console.log(`Body: Thank you for creating an account. Start tracking your progress today!`);
  }

  function isAuthenticated(){
    try {
      const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      return auth.loggedIn === true;
    } catch {
      return false;
    }
  }

  function getCurrentUser(){
    try {
      const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      return auth.username || null;
    } catch {
      return null;
    }
  }

  function isAdmin(){
    return getCurrentUser() === 'admin';
  }

  function login(username, password){
    const users = getUsers();
    const user = users[username];
    if(user && user.password === password){
      localStorage.setItem(SESSION_KEY, JSON.stringify({ loggedIn: true, username }));
      return true;
    }
    return false;
  }

  function logout(){
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
  }

  // Initialize users
  initializeUsers();

  // Signup page
  if(window.location.pathname.includes('signup.html')){
    if(isAuthenticated()){
      window.location.href = 'index.html';
      return;
    }

    const form = document.getElementById('signupForm');
    const errorMessage = document.getElementById('signupError');

    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const email = document.getElementById('newEmail').value.trim();
      const username = document.getElementById('newUsername').value.trim();
      const password = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if(password !== confirmPassword){
        errorMessage.textContent = 'Passwords do not match';
        setTimeout(()=> errorMessage.textContent = '', 3000);
        return;
      }

      const result = createUser(username, password, email);
      if(result.success){
        // Show success message
        errorMessage.style.color = '#2e7d32';
        errorMessage.textContent = `Account created! Welcome email sent to ${email}`;
        
        // Auto login after signup
        setTimeout(()=>{
          login(username, password);
          window.location.href = 'index.html';
        }, 1500);
      } else {
        errorMessage.style.color = '#d32f2f';
        errorMessage.textContent = result.error;
        setTimeout(()=> errorMessage.textContent = '', 3000);
      }
    });
  }

  // Login page
  if(window.location.pathname.includes('login.html')){
    if(isAuthenticated()){
      window.location.href = 'index.html';
      return;
    }

    const form = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      if(login(username, password)){
        window.location.href = 'index.html';
      } else {
        errorMessage.textContent = 'Invalid username or password';
        setTimeout(()=> errorMessage.textContent = '', 3000);
      }
    });
  }

  // Scorecard page (index.html)
  if(window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')){
    if(!isAuthenticated()){
      window.location.href = 'login.html';
      return;
    }
  }

  // Dashboard page
  if(window.location.pathname.includes('dashboard.html')){
    if(!isAuthenticated()){
      window.location.href = 'login.html';
      return;
    }
  }

  // Discussion page
  if(window.location.pathname.includes('discussion.html')){
    if(!isAuthenticated()){
      window.location.href = 'login.html';
      return;
    }
  }

  // Calendar page
  if(window.location.pathname.includes('calendar.html')){
    if(!isAuthenticated()){
      window.location.href = 'login.html';
      return;
    }
  }

  // Profile page
  if(window.location.pathname.includes('profile.html')){
    if(!isAuthenticated()){
      window.location.href = 'login.html';
      return;
    }
  }

  // Admin page
  if(window.location.pathname.includes('admin.html')){
    if(!isAuthenticated()){
      window.location.href = 'login.html';
      return;
    }
    if(!isAdmin()){
      alert('Access denied. Admin privileges required.');
      window.location.href = 'index.html';
      return;
    }
  }

  window.scorecardLogout = logout;
  
  // Expose user info to window for other scripts
  function exposeUserInfo(){
    if(isAuthenticated()){
      window.currentUser = getCurrentUser();
      const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      const users = getUsers();
      const user = users[auth.username];
      window.currentUserEmail = user ? user.email : null;
      const profiles = JSON.parse(localStorage.getItem('scorecard:profile') || '{}');
      const profile = profiles[auth.username] || {};
      window.currentUserDisplayName = profile.displayName || window.currentUser;
      window.isAdmin = isAdmin();
    }
  }
  
   exposeUserInfo();
  
  // Populate user info in header
  window.addEventListener('DOMContentLoaded', () => {
    const userInfoEl = document.getElementById('userInfo');
    if(userInfoEl && isAuthenticated()){
      const profiles = JSON.parse(localStorage.getItem('scorecard:profile') || '{}');
      const currentUser = getCurrentUser();
      const profile = profiles[currentUser] || {};
      
      const html = `
        <div class="user-info-section">
          <div class="user-info-name">${window.currentUserDisplayName}</div>
          <a href="profile.html">
            <img src="${profile.picture || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%23e0e0e0%27 width=%27100%27 height=%27100%27/%3E%3Ccircle cx=%2750%27 cy=%2730%27 r=%2715%27 fill=%27%23999%27/%3E%3Cpath d=%27M 20 60 Q 20 50 50 50 Q 80 50 80 60 L 80 100 L 20 100 Z%27 fill=%27%23999%27/%3E%3C/svg%3E'}" alt="Profile" class="user-info-pic" />
          </a>
          <button class="logout-btn" onclick="window.scorecardLogout()">Logout</button>
        </div>
      `;
      userInfoEl.innerHTML = html;
    }
  });
})();
