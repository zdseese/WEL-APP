(function(){
  let currentAuthState = null;
  
  // API helper function
  async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin'
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(endpoint, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  }

  // Check authentication status with backend
  async function checkAuthStatus() {
    try {
      const data = await apiCall('/api/auth/status');
      currentAuthState = data;
      return data;
    } catch (error) {
      currentAuthState = { loggedIn: false };
      return { loggedIn: false };
    }
  }

  function isAuthenticated(){
    return currentAuthState && currentAuthState.loggedIn === true;
  }

  function getCurrentUser(){
    return currentAuthState ? currentAuthState.username : null;
  }

  function isAdmin(){
    return currentAuthState && currentAuthState.isAdmin === true;
  }

  // Get current user's subscription
  function getSubscription(){
    return currentAuthState ? currentAuthState.subscription : null;
  }

  // Check if user has a specific plan or better
  function hasSubscription(minPlan = 'free'){
    const subscription = getSubscription();
    if (!subscription || subscription.status !== 'active') {
      return minPlan === 'free';
    }

    const planHierarchy = { free: 0, basic: 1, pro: 2 };
    const currentLevel = planHierarchy[subscription.plan] || 0;
    const requiredLevel = planHierarchy[minPlan] || 0;

    return currentLevel >= requiredLevel;
  }

  // Check if user can access a feature based on their plan
  function canAccessFeature(feature){
    const subscription = getSubscription();
    const plan = subscription?.plan || 'free';
    
    // Define feature access by plan
    const featureAccess = {
      free: ['basic_tracking', 'limited_goals'],
      basic: ['basic_tracking', 'unlimited_goals', 'analytics', 'export'],
      pro: ['basic_tracking', 'unlimited_goals', 'analytics', 'export', 'team_collaboration', 'custom_integrations']
    };

    return featureAccess[plan]?.includes(feature) || false;
  }

  async function login(username, password){
    try {
      const data = await apiCall('/api/auth/login', 'POST', { username, password });
      if (data.success) {
        currentAuthState = {
          loggedIn: true,
          username: data.username,
          email: data.email,
          isAdmin: data.isAdmin
        };
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  async function createUser(username, password, email){
    try {
      const data = await apiCall('/api/auth/signup', 'POST', { username, password, email });
      return data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function updateUserDetails(username, details){
    try {
      const data = await apiCall('/api/auth/update-details', 'POST', details);
      return data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  function sendWelcomeEmail(email, username){
    console.log(`Welcome email sent to ${email}`);
    console.log(`Subject: Welcome to Scorecard, ${username}!`);
    console.log(`Body: Thank you for creating an account. Start tracking your progress today!`);
  }

  async function logout(){
    try {
      await apiCall('/api/auth/logout', 'POST');
    } catch (error) {
      console.error('Logout error:', error);
    }
    currentAuthState = null;
    window.location.href = 'login.html';
  }

  // Initialize auth state and handle page routing
  async function initAuth() {
    await checkAuthStatus();

    // Signup page
    if(window.location.pathname.includes('signup.html')){
      if(isAuthenticated()){
        window.location.href = 'index.html';
        return;
      }

      const form = document.getElementById('signupForm');
      const errorMessage = document.getElementById('signupError');

      form.addEventListener('submit', async (e)=>{
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

        const result = await createUser(username, password, email);
        if(result.success){
          errorMessage.style.color = '#2e7d32';
          errorMessage.textContent = 'Account created! Redirecting...';
          
          sessionStorage.setItem('pendingUser', JSON.stringify({ username, password }));
          
          setTimeout(()=>{
            window.location.href = 'signup-details.html';
          }, 1000);
        } else {
          errorMessage.style.color = '#d32f2f';
          errorMessage.textContent = result.error;
          setTimeout(()=> errorMessage.textContent = '', 3000);
        }
      });
    }

    // Signup details page
    if(window.location.pathname.includes('signup-details.html')){
      const pendingUserData = sessionStorage.getItem('pendingUser');
      if(!pendingUserData){
        window.location.href = 'signup.html';
        return;
      }

      const form = document.getElementById('detailsForm');
      const errorMessage = document.getElementById('detailsError');

      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const organization = document.getElementById('organization').value.trim();
        const jobTitle = document.getElementById('jobTitle').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const hearAboutUs = document.getElementById('hearAboutUs').value;

        const { username, password } = JSON.parse(pendingUserData);
        const details = { organization, jobTitle, phone, hearAboutUs };
        
        const result = await updateUserDetails(username, details);
        if(result.success){
          sessionStorage.removeItem('pendingUser');
          
          errorMessage.style.color = '#2e7d32';
          errorMessage.textContent = 'Profile completed! Welcome!';
          
          const loginSuccess = await login(username, password);
          if (loginSuccess) {
            setTimeout(()=>{
              window.location.href = 'index.html';
            }, 1500);
          }
        } else {
          errorMessage.style.color = '#d32f2f';
          errorMessage.textContent = result.error || 'An error occurred';
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

      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        const success = await login(username, password);
        if(success){
          window.location.href = 'index.html';
        } else {
          errorMessage.textContent = 'Invalid username or password';
          setTimeout(()=> errorMessage.textContent = '', 3000);
        }
      });
    }

    // Protected pages
    const protectedPages = ['index.html', 'dashboard.html', 'discussion.html', 'calendar.html', 'profile.html'];
    const publicPages = ['login.html', 'signup.html', 'signup-details.html'];
    const currentPath = window.location.pathname;
    
    // Skip authentication check for public pages
    if(publicPages.some(page => currentPath.includes(page))){
      return;
    }
    
    if(protectedPages.some(page => currentPath.includes(page)) || currentPath.endsWith('/')){
      if(!isAuthenticated()){
        window.location.href = 'login.html';
        return;
      }
    }

    // Admin page
    if(currentPath.includes('admin.html')){
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
  }

  // Initialize on page load
  initAuth();

  // Expose functions to window
  window.scorecardLogout = logout;
  
  // Expose user info
  function exposeUserInfo(){
    if(isAuthenticated()){
      window.currentUser = getCurrentUser();
      window.currentUserEmail = currentAuthState.email;
      window.currentUserDisplayName = currentAuthState.username;
      window.isAdmin = isAdmin();
      window.currentSubscription = getSubscription();
    }
  }
  
  exposeUserInfo();
  
  // Expose subscription functions to window.auth
  window.auth = window.auth || {};
  window.auth.checkAuthStatus = checkAuthStatus;
  window.auth.login = login;
  window.auth.logout = logout;
  window.auth.isAuthenticated = isAuthenticated;
  window.auth.getCurrentUser = getCurrentUser;
  window.auth.isAdmin = isAdmin;
  window.auth.getSubscription = getSubscription;
  window.auth.hasSubscription = hasSubscription;
  window.auth.canAccessFeature = canAccessFeature;
  
  // Populate user info in header
  window.addEventListener('DOMContentLoaded', async () => {
    await checkAuthStatus();
    exposeUserInfo();
    
    const userInfoEl = document.getElementById('userInfo');
    if(userInfoEl && isAuthenticated()){
      // Get profile picture from backend
      let picture = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%23e0e0e0%27 width=%27100%27 height=%27100%27/%3E%3Ccircle cx=%2750%27 cy=%2730%27 r=%2715%27 fill=%27%23999%27/%3E%3Cpath d=%27M 20 60 Q 20 50 50 50 Q 80 50 80 60 L 80 100 L 20 100 Z%27 fill=%27%23999%27/%3E%3C/svg%3E';
      
      try {
        const profile = await apiCall('/api/profile');
        if (profile.picture) {
          picture = profile.picture;
        }
        if (profile.displayName) {
          window.currentUserDisplayName = profile.displayName;
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
      
      const html = `
        <div class="user-info-section">
          <div class="user-info-name">${window.currentUserDisplayName}</div>
          <a href="profile.html">
            <img src="${picture}" alt="Profile" class="user-info-pic" />
          </a>
          <button class="logout-btn" onclick="window.scorecardLogout()">Logout</button>
        </div>
      `;
      userInfoEl.innerHTML = html;
    }
  });
})();
