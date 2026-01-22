(function(){
  let allUsers = [];

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

  async function loadUsers(){
    try {
      allUsers = await apiCall('/api/admin/users');
      displayUsers();
      updateStats();
    } catch (error) {
      console.error('Error loading users:', error);
      document.getElementById('usersTableBody').innerHTML = 
        `<tr><td colspan="8" style="text-align:center;color:#d32f2f;">Error loading users: ${error.message}</td></tr>`;
    }
  }

  function updateStats() {
    document.getElementById('totalUsers').textContent = allUsers.length;
    
    const freeUsers = allUsers.filter(u => !u.subscription || u.subscription.plan === 'free').length;
    const basicUsers = allUsers.filter(u => u.subscription && u.subscription.plan === 'basic').length;
    const proUsers = allUsers.filter(u => u.subscription && u.subscription.plan === 'pro').length;
    
    document.getElementById('freeUsers').textContent = freeUsers;
    document.getElementById('basicUsers').textContent = basicUsers;
    document.getElementById('proUsers').textContent = proUsers;
  }

  function getPlanBadge(subscription) {
    const plan = subscription?.plan || 'free';
    const status = subscription?.status || 'active';
    
    const colors = {
      free: '#757575',
      basic: '#1976d2',
      pro: '#7b1fa2'
    };
    
    return `<span style="
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      background: ${colors[plan] || colors.free};
      color: white;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    ">${plan}</span>`;
  }

  function getStatusBadge(subscription) {
    const status = subscription?.status || 'active';
    
    const colors = {
      active: '#4caf50',
      canceled: '#f44336',
      past_due: '#ff9800',
      trialing: '#2196f3'
    };
    
    return `<span style="
      display: inline-block;
      padding: 4px 8px;
      border-radius: 8px;
      background: ${colors[status] || colors.active};
      color: white;
      font-size: 11px;
      font-weight: 500;
    ">${status}</span>`;
  }

  function displayUsers(){
    const tbody = document.getElementById('usersTableBody');
    if(!allUsers || allUsers.length === 0){
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No users found</td></tr>';
      return;
    }

    tbody.innerHTML = allUsers.map(user => `
      <tr>
        <td><strong>${user.username}</strong></td>
        <td>${user.email}</td>
        <td>${getPlanBadge(user.subscription)}</td>
        <td>${getStatusBadge(user.subscription)}</td>
        <td>${user.organization || '-'}</td>
        <td>${user.jobTitle || '-'}</td>
        <td>${user.phone || '-'}</td>
        <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
      </tr>
    `).join('');
  }

  function searchUsers(){
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    if(!searchTerm){
      displayUsers();
      return;
    }

    const filtered = allUsers.filter(user => 
      (user.username && user.username.toLowerCase().includes(searchTerm)) ||
      (user.email && user.email.toLowerCase().includes(searchTerm)) ||
      (user.organization && user.organization.toLowerCase().includes(searchTerm)) ||
      (user.jobTitle && user.jobTitle.toLowerCase().includes(searchTerm))
    );

    const tbody = document.getElementById('usersTableBody');
    if(filtered.length === 0){
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No matching users found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(user => `
      <tr>
        <td><strong>${user.username}</strong></td>
        <td>${user.email}</td>
        <td>${getPlanBadge(user.subscription)}</td>
        <td>${getStatusBadge(user.subscription)}</td>
        <td>${user.organization || '-'}</td>
        <td>${user.jobTitle || '-'}</td>
        <td>${user.phone || '-'}</td>
        <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
      </tr>
    `).join('');
  }

  function exportToCSV(){
    if(allUsers.length === 0){
      alert('No users to export');
      return;
    }
Subscription Plan', 'Status', 'Stripe Customer ID', 'Organization', 'Job Title', 'Phone', 'Hear About Us', 'Created At'];
    const rows = allUsers.map(user => [
      user.username,
      user.email,
      user.subscription?.plan || 'free',
      user.subscription?.status || 'active',
      user.subscription?.stripeCustomerId || ''ame,
      user.email,
      user.organization || '',
      user.jobTitle || '',
      user.phone || '',
      user.hearAboutUs || '',
      user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Initialize when page loads
  if(window.location.pathname.includes('admin.html')){
    document.addEventListener('DOMContentLoaded', () => {
      loadUsers();

      const searchInput = document.getElementById('userSearch');
      if(searchInput){
        searchInput.addEventListener('input', searchUsers);
      }

      const exportBtn = document.getElementById('exportBtn');
      if(exportBtn){
        exportBtn.addEventListener('click', exportToCSV);
      }

      const refreshBtn = document.getElementById('refreshBtn');
      if(refreshBtn){
        refreshBtn.addEventListener('click', loadUsers);
      }
    });
  }
})();
