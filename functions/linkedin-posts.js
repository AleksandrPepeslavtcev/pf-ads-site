export async function onRequestPost(context) {
  const { request } = context;
  
  try {
    const { action, access_token } = await request.json();
    
    const LINKEDIN_CLIENT_ID = '77c7i4jjqp5e8g';
    const LINKEDIN_CLIENT_SECRET = 'WPL_AP1.hziPFMoFR4e7sXgs.z7dGvg==';
    
    if (action === 'get_posts') {
      // Получаем посты пользователя
      const postsResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const postsData = await postsResponse.json();
      
      // Преобразуем посты LinkedIn в формат для сайта
      const formattedPosts = await Promise.all(
        postsData.elements.slice(0, 10).map(async (post) => {
          const postDetails = await getPostDetails(post.id, access_token);
          return {
            id: post.id,
            title: extractTitle(postDetails),
            content: extractContent(postDetails),
            date: new Date(post.created.time).toISOString(),
            linkedin_url: `https://www.linkedin.com/feed/update/${post.id}`,
            image: extractImage(postDetails)
          };
        })
      );
      
      return new Response(JSON.stringify({ success: true, posts: formattedPosts }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'publish_post') {
      const { post_data } = await request.json();
      
      // Создаем файл в GitHub через API
      const githubResponse = await fetch('https://api.github.com/repos/AleksandrPepeslavtcev/pf-ads-site/contents/_posts/' + post_data.filename, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${context.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Import post from LinkedIn: ${post_data.title}`,
          content: btoa(unescape(encodeURIComponent(post_data.content))),
          branch: 'main'
        })
      });
      
      const result = await githubResponse.json();
      
      return new Response(JSON.stringify({ success: true, github_url: result.content.html_url }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Вспомогательные функции
async function getPostDetails(postId, accessToken) {
  const response = await fetch(`https://api.linkedin.com/v2/ugcPosts/${postId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return response.json();
}

function extractTitle(post) {
  if (post.commentary) {
    const firstLine = post.commentary.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  }
  return `LinkedIn Post ${post.id}`;
}

function extractContent(post) {
  let content = '';
  if (post.commentary) {
    content += post.commentary + '\n\n';
  }
  if (post.distribution && post.distribution.linkedInTargetedEntities) {
    content += '---\n';
    content += '*Imported from LinkedIn*\n';
  }
  return content;
}

function extractImage(post) {
  // Извлекаем изображения из поста если есть
  if (post.content && post.content.media && post.content.media.elements) {
    const imageElement = post.content.media.elements.find(el => el.type === 'IMAGE');
    if (imageElement) {
      return imageElement.identifiers[0].identifier;
    }
  }
  return null;
}
