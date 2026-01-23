(function(){
  let allUsers = [];

  async function apiCall(url, options = {}){
    const token = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if(token){
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { ...options, headers });
    if(response.status === 401 || response.status === 403){
      window.location.href = 'login.html';
      throw new Error('Unauthorized');
    }
    return response;
  }

  async function loadUsers(){
    try {
      const response = await apiCall('/api/admin/users');
      const users = await response.json();
      allUsers = users;
      renderUsers(users);
      updateStats(users);
    } catch(err){
      console.error('Error loading users:', err);
      document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #d32f2f;">Error loading users. Admin access required.</td></tr>';
    }
  }

  function updateStats(users){
    document.getElementById('totalUsers').textContent = users.length;
    
    const activeSubscriptions = users.filter(u => 
      u.subscription && u.subscription.plan !== 'free' && u.subscription.status === 'active'
    ).length;
    document.getElementById('activeSubscriptions').textContent = activeSubscriptions;
    
    const freeUsers = users.filter(u => 
      !u.subscription || u.subscription.plan === 'free'
    ).length;
    document.getElementById('freeUsers').textContent = freeUsers;
  }

  function renderUsers(users){
    const tbody = document.getElementById('usersTableBody');
    
    if(users.length === 0){
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #999;">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(user => {
      const subscription = user.subscription || { plan: 'free', status: 'active' };
      const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
      const planBadge = subscription.plan === 'free' ? 'Free' : 
                       subscription.plan === 'basic' ? 'Basic' :
                       subscription.plan === 'premium' ? 'Premium' : subscription.plan;
      const statusColor = subscription.status === 'active' ? '#4caf50' : '#999';
      
      return `
        <tr>
          <td><strong>${user.username}</strong></td>
          <td>${user.email || 'N/A'}</td>
          <td>${user.organization || 'N/A'}</td>
          <td>
            <span style="background: ${subscription.plan === 'free' ? '#e0e0e0' : '#c78f57'}; color: ${subscription.plan === 'free' ? '#333' : '#fff'}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
              ${planBadge}
            </span>
          </td>
          <td>
            <span style="color: ${statusColor}; font-weight: 600;">
              ${subscription.status}
            </span>
          </td>
          <td style="color: #666; font-size: 13px;">${createdDate}</td>
          <td>
            <button class="btn-secondary btn-sm" onclick="viewUserDetails('${user.username}')" style="margin-right: 8px;">View</button>
            ${user.username !== 'admin' ? `<button class="btn-danger btn-sm" onclick="deleteUser('${user.username}')">Delete</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  async function viewUserDetails(username){
    const user = allUsers.find(u => u.username === username);
    if(!user) return;

    // Fetch user's scorecard data
    let scorecardHTML = '<p style="color: #999;">No scorecard data available.</p>';
    try {
      const response = await apiCall(`/api/admin/users/${username}/scorecard`);
      const scorecard = await response.json();
      
      if(scorecard && scorecard.categories && scorecard.categories.length > 0){
        scorecardHTML = '<div style="margin-top: 16px;">';
        scorecardHTML += '<h4 style="margin-bottom: 12px; color: #1f3345;">Scorecard Categories:</h4>';
        scorecard.categories.forEach(cat => {
          const percentage = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
          scorecardHTML += `
            <div style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <strong>${cat.name}</strong>
                <span style="color: #c78f57; font-weight: 700;">${cat.score} / ${cat.maxScore}</span>
              </div>
              <div style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #c78f57 0%, #b87d47 100%); height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
              </div>
            </div>
          `;
        });
        scorecardHTML += '</div>';
      }
    } catch(err){
      console.error('Error loading scorecard:', err);
    }

    const subscription = user.subscription || { plan: 'free', status: 'active' };
    const modal = document.getElementById('userModal');
    const modalBody = document.getElementById('userModalBody');
    
    modalBody.innerHTML = `
      <div style="padding: 8px 0;">
        <h3 style="color: #1f3345; margin-bottom: 24px;">${user.username}</h3>
        
        <div style="margin-bottom: 24px;">
          <h4 style="color: #666; font-size: 14px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Contact Information</h4>
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
            <p style="margin: 8px 0;"><strong>Email:</strong> ${user.email || 'N/A'}</p>
            <p style="margin: 8px 0;"><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
            <p style="margin: 8px 0;"><strong>Organization:</strong> ${user.organization || 'N/A'}</p>
            <p style="margin: 8px 0;"><strong>Job Title:</strong> ${user.jobTitle || 'N/A'}</p>
            <p style="margin: 8px 0;"><strong>How they heard about us:</strong> ${user.hearAboutUs || 'N/A'}</p>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h4 style="color: #666; font-size: 14px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Subscription Details</h4>
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
            <p style="margin: 8px 0;"><strong>Plan:</strong> 
              <span style="background: ${subscription.plan === 'free' ? '#e0e0e0' : '#c78f57'}; color: ${subscription.plan === 'free' ? '#333' : '#fff'}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">
                ${subscription.plan}
              </span>
            </p>
            <p style="margin: 8px 0;"><strong>Status:</strong> <span style="color: ${subscription.status === 'active' ? '#4caf50' : '#999'}; font-weight: 600;">${subscription.status}</span></p>
            <p style="margin: 8px 0;"><strong>Stripe Customer ID:</strong> ${subscription.stripeCustomerId || 'N/A'}</p>
            <p style="margin: 8px 0;"><strong>Stripe Subscription ID:</strong> ${subscription.stripeSubscriptionId || 'N/A'}</p>
            ${subscription.currentPeriodEnd ? `<p style="margin: 8px 0;"><strong>Renewal Date:</strong> ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>` : ''}
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h4 style="color: #666; font-size: 14px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Scorecard Data</h4>
          ${scorecardHTML}
        </div>

        <div style="border-top: 1px solid #e0e0e0; padding-top: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
          ${user.username !== 'admin' ? `
            <button class="btn-primary" onclick="resetUserPassword('${user.username}')">Reset Password</button>
            <button class="btn-danger" onclick="deleteUser('${user.username}')">Delete User</button>
          ` : ''}
          <button class="btn-secondary" onclick="closeUserModal()">Close</button>
        </div>
      </div>
    `;
    
    modal.style.display = 'flex';
  }

  function closeUserModal(){
    document.getElementById('userModal').style.display = 'none';
  }

  async function deleteUser(username){
    if(!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)){
      return;
    }

    try {
      const response = await apiCall(`/api/admin/users/${username}`, {
        method: 'DELETE'
      });

      if(response.ok){
        alert('User deleted successfully');
        closeUserModal();
        loadUsers();
      } else {
        const data = await response.json();
        alert('Error deleting user: ' + (data.error || 'Unknown error'));
      }
    } catch(err){
      console.error('Error deleting user:', err);
      alert('Error deleting user');
    }
  }

  async function resetUserPassword(username){
    const newPassword = prompt(`Enter new password for user "${username}":`);
    if(!newPassword || newPassword.trim().length < 6){
      alert('Password must be at least 6 characters long');
      return;
    }

    try {
      const response = await apiCall(`/api/admin/users/${username}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      });

      if(response.ok){
        alert('Password reset successfully');
      } else {
        const data = await response.json();
        alert('Error resetting password: ' + (data.error || 'Unknown error'));
      }
    } catch(err){
      console.error('Error resetting password:', err);
      alert('Error resetting password');
    }
  }

  // Close modal when clicking outside
  window.onclick = function(event) {
    const modal = document.getElementById('userModal');
    if (event.target === modal) {
      closeUserModal();
    }
  };

  // Export functions to window
  window.viewUserDetails = viewUserDetails;
  window.closeUserModal = closeUserModal;
  window.deleteUser = deleteUser;
  window.resetUserPassword = resetUserPassword;

  // Initialize with auth check
  if(window.location.pathname.includes('user-management.html')){
    // Wait for auth to be ready
    const initUserManagement = () => {
      if(!window.isAdmin){
        // Redirect non-admins to dashboard
        window.location.href = 'dashboard.html';
        return;
      }
      loadUsers();
    };

    // Wait for auth to be initialized
    if(typeof window.isAdmin !== 'undefined'){
      initUserManagement();
    } else {
      // If auth not ready, wait a bit and try again
      setTimeout(initUserManagement, 100);
    }
  }
})();
