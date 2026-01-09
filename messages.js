(function(){
  'use strict';

  const MESSAGES_KEY = 'scorecard:messages';

  // Get all messages
  function getMessages(){
    try {
      return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '{}');
    } catch {
      return {};
    }
  }

  // Save messages
  function saveMessages(messages){
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  }

  // Get conversation key (sorted usernames for consistency)
  function getConversationKey(user1, user2){
    return [user1, user2].sort().join('::');
  }

  // Send a message
  function sendMessage(toUser, messageText){
    const auth = JSON.parse(localStorage.getItem('scorecard:session') || '{}');
    const fromUser = auth.username;
    
    if(!fromUser || !toUser || !messageText) return;

    const messages = getMessages();
    const conversationKey = getConversationKey(fromUser, toUser);
    
    if(!messages[conversationKey]){
      messages[conversationKey] = [];
    }

    messages[conversationKey].push({
      from: fromUser,
      to: toUser,
      text: messageText,
      timestamp: Date.now()
    });

    saveMessages(messages);
  }

  // Get messages for a conversation
  function getConversation(user1, user2){
    const messages = getMessages();
    const conversationKey = getConversationKey(user1, user2);
    return messages[conversationKey] || [];
  }

  // Show users modal
  window.showUsersModal = function(){
    const modal = document.getElementById('usersModal');
    const usersList = document.getElementById('usersList');
    
    const users = JSON.parse(localStorage.getItem('scorecard:users') || '{}');
    const auth = JSON.parse(localStorage.getItem('scorecard:session') || '{}');
    const currentUser = auth.username;
    const profiles = JSON.parse(localStorage.getItem('scorecard:profile') || '{}');

    let html = '';
    for(let username in users){
      // Skip admin and current user
      if(users[username].role === 'admin' || username === currentUser) continue;
      
      const profile = profiles[username] || {};
      const displayName = profile.displayName || username;
      const picture = profile.picture || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%23e0e0e0%27 width=%27100%27 height=%27100%27/%3E%3Ccircle cx=%2750%27 cy=%2730%27 r=%2715%27 fill=%27%23999%27/%3E%3Cpath d=%27M 20 60 Q 20 50 50 50 Q 80 50 80 60 L 80 100 L 20 100 Z%27 fill=%27%23999%27/%3E%3C/svg%3E';

      html += `
        <div class="user-item" onclick="openMessagesModal('${username}', '${displayName}')">
          <img src="${picture}" alt="${displayName}" class="user-item-pic" />
          <div class="user-item-info">
            <div class="user-item-name">${displayName}</div>
            <div class="user-item-username">@${username}</div>
          </div>
        </div>
      `;
    }

    if(html === ''){
      html = '<p style="text-align:center;color:#666;">No users available</p>';
    }

    usersList.innerHTML = html;
    modal.style.display = 'block';
  };

  // Close users modal
  window.closeUsersModal = function(){
    document.getElementById('usersModal').style.display = 'none';
  };

  // Open messages modal
  window.openMessagesModal = function(username, displayName){
    closeUsersModal();
    
    const modal = document.getElementById('messagesModal');
    document.getElementById('messageUserName').textContent = `Messages with ${displayName}`;
    
    // Store current chat user
    window.currentChatUser = username;
    
    // Load messages
    loadMessages(username);
    
    modal.style.display = 'block';
  };

  // Close messages modal
  window.closeMessagesModal = function(){
    document.getElementById('messagesModal').style.display = 'none';
    window.currentChatUser = null;
  };

  // Load messages
  function loadMessages(otherUser){
    const auth = JSON.parse(localStorage.getItem('scorecard:session') || '{}');
    const currentUser = auth.username;
    const conversation = getConversation(currentUser, otherUser);
    
    const container = document.getElementById('messagesContainer');
    
    if(conversation.length === 0){
      container.innerHTML = '<p style="text-align:center;color:#666;">No messages yet. Start the conversation!</p>';
      return;
    }

    let html = '';
    conversation.forEach(msg => {
      const isMe = msg.from === currentUser;
      const className = isMe ? 'message message-sent' : 'message message-received';
      const date = new Date(msg.timestamp);
      const timeStr = date.toLocaleString();
      
      html += `
        <div class="${className}">
          <div class="message-text">${escapeHtml(msg.text)}</div>
          <div class="message-time">${timeStr}</div>
        </div>
      `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  // Escape HTML
  function escapeHtml(text){
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Handle message form submission
  document.addEventListener('DOMContentLoaded', () => {
    const messageForm = document.getElementById('messageForm');
    if(messageForm){
      messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const messageInput = document.getElementById('messageInput');
        const messageText = messageInput.value.trim();
        
        if(!messageText || !window.currentChatUser) return;
        
        sendMessage(window.currentChatUser, messageText);
        loadMessages(window.currentChatUser);
        messageInput.value = '';
      });
    }

    // Close modals when clicking outside
    window.onclick = function(event){
      const usersModal = document.getElementById('usersModal');
      const messagesModal = document.getElementById('messagesModal');
      
      if(event.target === usersModal){
        closeUsersModal();
      }
      if(event.target === messagesModal){
        closeMessagesModal();
      }
    };
  });
})();
