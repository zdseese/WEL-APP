(function(){
  const USERS_KEY = 'scorecard:users';
  let selectedUser = null;

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

  function deleteUser(username){
    if(username === 'admin'){
      alert('Cannot delete the admin account');
      return;
    }

    if(!confirm(`Are you sure you want to delete user "${username}"?`)){
      return;
    }

    const users = getUsers();
    delete users[username];
    saveUsers(users);
    
    // Also clean up their scorecard data
    localStorage.removeItem(`scorecard:metrics:v1:${username}`);
    
    loadUsers();
  }

  function openPasswordModal(username){
    selectedUser = username;
    document.getElementById('modalUsername').textContent = `Resetting password for: ${username}`;
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('resetError').textContent = '';
    document.getElementById('newAdminPassword').value = '';
  }

  function closePasswordModal(){
    document.getElementById('passwordModal').style.display = 'none';
    selectedUser = null;
  }

  function resetPassword(username, newPassword){
    const users = getUsers();
    if(!users[username]){
      return { success: false, error: 'User not found' };
    }

    if(newPassword.length < 6){
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    users[username].password = newPassword;
    saveUsers(users);
    return { success: true };
  }

  function loadUsers(){
    const users = getUsers();
    const tbody = document.getElementById('userTableBody');
    const totalUsersEl = document.getElementById('totalUsers');
    
    if(!tbody) return;

    tbody.innerHTML = '';
    const userList = Object.values(users);
    
    totalUsersEl.textContent = userList.length;

    userList.forEach(user => {
      const tr = document.createElement('tr');
      const isAdmin = user.username === 'admin';
      
      tr.innerHTML = `
        <td><strong>${user.username}</strong></td>
        <td>${user.email || 'N/A'}</td>
        <td><span class="role-badge ${isAdmin ? 'role-admin' : 'role-user'}">${isAdmin ? 'Admin' : 'User'}</span></td>
        <td>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary btn-sm" onclick="window.adminResetPassword('${user.username}')">Reset Password</button>
            ${isAdmin ? 
              '<span class="text-muted">Protected</span>' : 
              `<button class="btn-danger btn-sm" onclick="window.adminDeleteUser('${user.username}')">Delete</button>`
            }
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Expose functions globally
  window.adminDeleteUser = deleteUser;
  window.adminResetPassword = openPasswordModal;
  window.closePasswordModal = closePasswordModal;

  // Load users on page load
  if(window.location.pathname.includes('admin.html')){
    loadUsers();

    // Setup password reset form
    const resetForm = document.getElementById('resetPasswordForm');
    if(resetForm){
      resetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newAdminPassword').value;
        const resetError = document.getElementById('resetError');
        
        const result = resetPassword(selectedUser, newPassword);
        if(result.success){
          resetError.style.color = '#2e7d32';
          resetError.textContent = 'Password reset successfully!';
          setTimeout(() => {
            closePasswordModal();
            loadUsers();
          }, 1000);
        } else {
          resetError.style.color = '#d32f2f';
          resetError.textContent = result.error;
        }
      });
    }
  }
})();
