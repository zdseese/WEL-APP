(function(){
  const PROFILE_KEY = 'scorecard:profile';
  const USERS_KEY = 'scorecard:users';
  const SESSION_KEY = 'scorecard:auth';

  function getProfile(username){
    try {
      const profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      return profiles[username] || { displayName: '', bio: '', picture: null };
    } catch {
      return { displayName: '', bio: '', picture: null };
    }
  }

  function saveProfile(username, profile){
    try {
      const profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      profiles[username] = profile;
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    } catch {}
  }

  function getUsers(){
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveUsers(users){
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function changeCredentials(currentPassword, newUsername, newPassword){
    const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    const currentUser = auth.username;
    const users = getUsers();
    const userObj = users[currentUser];

    // Verify current password
    if(userObj.password !== currentPassword){
      return { success: false, error: 'Current password is incorrect' };
    }

    // Handle username change
    if(newUsername && newUsername !== currentUser){
      if(users.hasOwnProperty(newUsername)){
        return { success: false, error: 'Username already taken' };
      }
      if(newUsername.length < 3){
        return { success: false, error: 'Username must be at least 3 characters' };
      }
      
      // Move user to new username
      users[newUsername] = { ...userObj };
      delete users[currentUser];
      
      // Move profile data
      const profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      if(profiles[currentUser]){
        profiles[newUsername] = profiles[currentUser];
        delete profiles[currentUser];
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
      }
      
      // Update session
      auth.username = newUsername;
      localStorage.setItem(SESSION_KEY, JSON.stringify(auth));
    }

    // Handle password change
    if(newPassword){
      if(newPassword.length < 6){
        return { success: false, error: 'Password must be at least 6 characters' };
      }
      userObj.password = newPassword;
    }

    saveUsers(users);
    return { success: true };
  }

  if(window.location.pathname.includes('profile.html')){
    const profileForm = document.getElementById('profileForm');
    const credentialsForm = document.getElementById('credentialsForm');
    const nameInput = document.getElementById('displayName');
    const bioInput = document.getElementById('profileBio');
    const emailInput = document.getElementById('profileEmail');
    const picInput = document.getElementById('pictureUpload');
    const picElement = document.getElementById('profilePicture');
    const credentialsError = document.getElementById('credentialsError');

    // Show admin link if user is admin
    if(window.isAdmin){
      const adminLink = document.getElementById('adminLinkProfile');
      if(adminLink) adminLink.style.display = 'inline-block';
    }

    // Load profile
    const currentUser = window.currentUser;
    const profile = getProfile(currentUser);
    nameInput.value = profile.displayName || '';
    bioInput.value = profile.bio || '';
    emailInput.value = window.currentUserEmail || '';
    if(profile.picture){
      picElement.src = profile.picture;
    }

    // Picture upload
    picInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if(file){
        const reader = new FileReader();
        reader.onload = (event) => {
          picElement.src = event.target.result;
          profile.picture = event.target.result;
          saveProfile(currentUser, profile);
        };
        reader.readAsDataURL(file);
      }
    });

    // Save profile
    profileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      profile.displayName = nameInput.value;
      profile.bio = bioInput.value;
      saveProfile(currentUser, profile);
      window.location.href = 'dashboard.html';
    });

    // Change credentials
    credentialsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('currentPassword').value;
      const newUsername = document.getElementById('newUsername').value.trim();
      const newPassword = document.getElementById('newPassword').value;
      const confirmNewPassword = document.getElementById('confirmNewPassword').value;

      if(newPassword && newPassword !== confirmNewPassword){
        credentialsError.style.color = '#d32f2f';
        credentialsError.textContent = 'New passwords do not match';
        return;
      }

      if(!newUsername && !newPassword){
        credentialsError.style.color = '#d32f2f';
        credentialsError.textContent = 'Please enter at least one new value';
        return;
      }

      const result = changeCredentials(currentPassword, newUsername, newPassword);
      if(result.success){
        credentialsError.style.color = '#2e7d32';
        credentialsError.textContent = 'Credentials updated successfully!';
        credentialsForm.reset();
        setTimeout(()=> window.location.reload(), 1500);
      } else {
        credentialsError.style.color = '#d32f2f';
        credentialsError.textContent = result.error;
      }
    });
  }
})();
