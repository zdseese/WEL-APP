(function(){
  const DISCUSSION_KEY = 'scorecard:discussion';

  function getPosts(){
    try {
      return JSON.parse(localStorage.getItem(DISCUSSION_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function savePosts(posts){
    localStorage.setItem(DISCUSSION_KEY, JSON.stringify(posts));
  }

  function createPost(content, mediaData, author){
    const post = {
      id: Date.now().toString(),
      author: author,
      content: content,
      media: mediaData,
      timestamp: new Date().toISOString(),
      likes: 0
    };
    const posts = getPosts();
    posts.unshift(post);
    savePosts(posts);
    return post;
  }

  function deletePost(postId, currentUser){
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === postId);
    if(postIndex > -1 && posts[postIndex].author === currentUser){
      posts.splice(postIndex, 1);
      savePosts(posts);
      loadPosts();
    }
  }

  function loadPosts(){
    const posts = getPosts();
    const container = document.getElementById('postsContainer');
    if(!container) return;

    container.innerHTML = '';
    if(posts.length === 0){
      container.innerHTML = '<p class="no-posts">No posts yet. Be the first to share!</p>';
      return;
    }

    posts.forEach(post => {
      const postEl = document.createElement('div');
      postEl.className = 'post';
      const date = new Date(post.timestamp).toLocaleDateString();
      const time = new Date(post.timestamp).toLocaleTimeString();
      const isOwner = window.currentUser === post.author;

      let mediaHTML = '';
      if(post.media){
        if(post.media.type.startsWith('image')){
          mediaHTML = `<img src="${post.media.data}" alt="Post image" class="post-media" />`;
        } else if(post.media.type.startsWith('video')){
          mediaHTML = `<video controls class="post-media"><source src="${post.media.data}" type="${post.media.type}"></video>`;
        }
      }

      postEl.innerHTML = `
        <div class="post-header">
          <strong>${post.author}</strong>
          <span class="post-time">${date} at ${time}</span>
          ${isOwner ? `<button class="btn-delete-post" onclick="window.deleteDiscussionPost('${post.id}')">Delete</button>` : ''}
        </div>
        <div class="post-content">${post.content}</div>
        ${mediaHTML}
      `;
      container.appendChild(postEl);
    });
  }

  if(window.location.pathname.includes('discussion.html')){
    const form = document.getElementById('postForm');
    const contentInput = document.getElementById('postContent');
    const mediaInput = document.getElementById('postMedia');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const content = contentInput.value.trim();
      let mediaData = null;

      if(mediaInput.files.length > 0){
        const file = mediaInput.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
          mediaData = {
            type: file.type,
            data: event.target.result
          };
          createPost(content, mediaData, window.currentUser);
          contentInput.value = '';
          mediaInput.value = '';
          loadPosts();
        };
        reader.readAsDataURL(file);
      } else {
        createPost(content, null, window.currentUser);
        contentInput.value = '';
        loadPosts();
      }
    });

    loadPosts();
  }

  window.deleteDiscussionPost = deletePost;
})();
