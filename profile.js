(function(){
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

  async function getProfile() {
    return await apiCall('/api/profile');
  }

  async function saveProfile(profileData) {
    return await apiCall('/api/profile', 'POST', profileData);
  }

  async function deleteAccount() {
    try {
      return await apiCall('/api/account', 'DELETE');
    } catch (error) {
      return { success: false, error: error.message };
    }
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
    
    (async function loadProfile() {
      try {
        const profile = await getProfile();
        nameInput.value = profile.displayName || '';
        bioInput.value = profile.bio || '';
        emailInput.value = window.currentUserEmail || '';
        if(profile.picture){
          picElement.src = profile.picture;
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    })();

    // Picture upload
    picInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if(file){
        const reader = new FileReader();
        reader.onload = async (event) => {
          picElement.src = event.target.result;
          try {
            await saveProfile({
              displayName: nameInput.value,
              bio: bioInput.value,
              picture: event.target.result
            });
          } catch (error) {
            console.error('Error saving picture:', error);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // Save profile
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await saveProfile({
          displayName: nameInput.value,
          bio: bioInput.value,
          picture: picElement.src
        });
        window.location.href = 'dashboard.html';
      } catch (error) {
        alert('Error saving profile: ' + error.message);
      }
    });

    // Change credentials
    credentialsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      credentialsError.style.color = '#d32f2f';
      credentialsError.textContent = 'Credential changes are not yet available with the backend. Please contact admin.';
    });

    // Delete account
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if(deleteBtn){
      deleteBtn.addEventListener('click', async () => {
        const confirmDelete = confirm('Are you sure?');
        
        if(confirmDelete){
          const result = await deleteAccount();
          if(result.success){
            window.location.href = 'signup.html';
          } else {
            alert(result.error || 'Failed to delete account. Please try again.');
          }
        }
      });
    }
  }
})();
