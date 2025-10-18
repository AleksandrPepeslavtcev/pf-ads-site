export async function onRequestPost(context) {
  const { request } = context;
  
  try {
    const body = await request.json();
    const { action, linkedin_url } = body;
    
    if (action === 'import_from_rss') {
      // Для LinkedIn RSS нужно использовать публичный профиль
      // Пример: https://www.linkedin.com/in/username/details/recent-activity/rss/
      
      // Временное решение - создаем демо-посты
      const demoPosts = [
        {
          title: "Пример поста о цифровой рекламе",
          content: `Это демонстрационный пост о трендах в digital-маркетинге.

## Ключевые тренды 2024:

- AI-оптимизация рекламных кампаний
- Персонализация на основе данных
- Видео-контент как основной формат

*Импортировано из LinkedIn*`,
          date: new Date().toISOString(),
          source: "linkedin_demo"
        },
        {
          title: "Кейс: Увеличение конверсии на 35%",
          content: `Поделюсь успешным кейсом нашего агентства.

Результаты для клиента в B2B сегменте:
- 📈 Конверсия: +35%
- 📉 CPA: -20%
- 🎯 ROI: 4.2x

*Импортировано из LinkedIn*`,
          date: new Date(Date.now() - 86400000).toISOString(), // Вчера
          source: "linkedin_demo"
        }
      ];
      
      return new Response(JSON.stringify({
        success: true,
        posts: demoPosts,
        note: "Это демо-данные. Для реального импорта требуется верификация приложения LinkedIn."
      }), {
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
