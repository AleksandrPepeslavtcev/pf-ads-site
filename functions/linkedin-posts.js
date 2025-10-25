export async function onRequestPost(context) {
  const { request } = context;
  
  try {
    const body = await request.json();
    const { action, code, access_token } = body;
    
    const LINKEDIN_CLIENT_ID = context.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_CLIENT_SECRET = context.env.LINKEDIN_CLIENT_SECRET;
    const REDIRECT_URI = context.env.LINKEDIN_REDIRECT_URI || 'https://www.pf-ads.com/linkedin/callback';
    
    if (action === 'get_token' && code) {
      if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
        throw new Error('LinkedIn env not configured');
      }
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI
        })
      });
      
      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        throw new Error(`LinkedIn OAuth Error: ${tokenData.error} - ${tokenData.error_description}`);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
 
    // 2. Получение постов с access token
    if (action === 'get_posts' && access_token) {
      // Сначала получаем профиль пользователя
      const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      
      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        throw new Error(`Profile API Error: ${profileResponse.status} - ${errorText}`);
      }
      
      const profileData = await profileResponse.json();
      const userUrn = profileData.id; // Format: urn:li:person:123456
      
      console.log('User URN:', userUrn);
      
      // Получаем посты пользователя
      const postsResponse = await fetch(`https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(userUrn)})`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202304',
        },
      });
      
      if (!postsResponse.ok) {
        const errorText = await postsResponse.text();
        throw new Error(`Posts API Error: ${postsResponse.status} - ${errorText}`);
      }
      
      const postsData = await postsResponse.json();
      console.log('Posts data:', JSON.stringify(postsData, null, 2));
      
      // Форматируем посты
      const formattedPosts = [];
      
      if (postsData.elements && postsData.elements.length > 0) {
        for (const post of postsData.elements.slice(0, 5)) {
          try {
            const postDetails = await getPostDetails(post.id, access_token);
            formattedPosts.push({
              id: post.id,
              title: generateTitle(postDetails),
              content: formatPostContent(postDetails),
              date: post.created ? new Date(post.created.time).toISOString() : new Date().toISOString(),
              linkedin_url: `https://www.linkedin.com/feed/update/${post.id}`,
              raw: postDetails // для отладки
            });
          } catch (postError) {
            console.error(`Error processing post ${post.id}:`, postError);
            // Продолжаем с другими постами
          }
        }
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        posts: formattedPosts,
        total: formattedPosts.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 3. Публикация поста на сайт
    if (action === 'publish_post') {
      const { post_data } = body;
      
      if (!context.env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN not configured');
      }
      
      const githubResponse = await fetch(
        `https://api.github.com/repos/AleksandrPepeslavtcev/pf-ads-site/contents/_posts/${post_data.filename}`, 
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${context.env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'PF-ADS-Site'
          },
          body: JSON.stringify({
            message: `Import from LinkedIn: ${post_data.title}`,
            content: toBase64Utf8(post_data.content),
            branch: 'main'
          })
        }
      );
      
      const result = await githubResponse.json();
      
      if (!githubResponse.ok) {
        throw new Error(`GitHub API Error: ${result.message}`);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        github_url: result.content.html_url 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw new Error('Invalid action or missing parameters');
    
  } catch (error) {
    console.error('LinkedIn Function Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// --- Web base64 helper (no Node Buffer) ---
function toBase64Utf8(input){
  const bytes = new TextEncoder().encode(String(input));
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}

// Вспомогательные функции
async function getPostDetails(postId, accessToken) {
  const response = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(postId)}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202304',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Post details error: ${response.status}`);
  }
  
  return response.json();
}

function generateTitle(postDetails) {
  if (postDetails.specificContent && 
      postDetails.specificContent['com.linkedin.ugc.ShareContent'] &&
      postDetails.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary) {
    
    const commentary = postDetails.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text;
    const firstLine = commentary.split('\n')[0];
    return firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
  }
  
  return `LinkedIn Post ${postDetails.id}`;
}

function formatPostContent(postDetails) {
  let content = '';
  
  if (postDetails.specificContent && 
      postDetails.specificContent['com.linkedin.ugc.ShareContent']) {
    
    const shareContent = postDetails.specificContent['com.linkedin.ugc.ShareContent'];
    
    if (shareContent.shareCommentary) {
      content += shareContent.shareCommentary.text + '\n\n';
    }
    
    if (shareContent.media && shareContent.media.length > 0) {
      content += '---\n';
      content += '*Пост содержит медиа-файлы*\n\n';
    }
  }
  
  content += '---\n';
  content += '*Импортировано из LinkedIn*\n';
  
  return content;
}
