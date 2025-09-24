// assets/js/obsidian-loader.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('Obsidian loader started...');
    
    // Основной контент (для темы minima)
    const contentSelectors = [
        '.wrapper main',
        '.page-content',
        '.post-content',
        'main'
    ];
    
    let contentElement = null;
    for (const selector of contentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
    }
    
    if (!contentElement) {
        console.warn('Content element not found');
        return;
    }
    
    convertObsidianLinks(contentElement);
    handleImageEmbeds(contentElement);
    handleBlockEmbeds(contentElement);
});

// Функция для конвертации вики-ссылок [[ ]]
function convertObsidianLinks(element) {
    const wikiLinkRegex = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;
    
    element.innerHTML = element.innerHTML.replace(wikiLinkRegex, function(match, pageName, displayText) {
        const linkText = displayText || pageName;
        const href = convertToUrl(pageName.trim()); // Добавляем trim()
        
        console.log('Converting wiki link:', pageName, '→', href); // Для отладки
        
        return `<a href="${href}" class="wiki-link" data-wiki-page="${pageName}">${linkText}</a>`;
    });
    
    // Проверяем существование страниц и помечаем битые ссылки
    setTimeout(() => checkBrokenLinks(element), 1000);
}

// Функция для встраивания изображений ![[ ]]
function handleImageEmbeds(element) {
    const imageEmbedRegex = /!\[\[([^\]]+\.(?:png|jpg|jpeg|gif|svg|webp))\]\]/gi;
    
    element.innerHTML = element.innerHTML.replace(imageEmbedRegex, function(match, imagePath) {
        const fullPath = `/assets/images/${imagePath.trim()}`;
        return `<div class="image-embed">
            <img src="${fullPath}" alt="${imagePath}" loading="lazy">
            <div class="image-caption">${imagePath}</div>
        </div>`;
    });
}

// Функция для встраивания других файлов ![[ ]]
function handleBlockEmbeds(element) {
    const blockEmbedRegex = /!\[\[([^\]]+\.md)(?:\|([^\]]+))?\]\]/gi;
    
    element.innerHTML = element.innerHTML.replace(blockEmbedRegex, function(match, filePath, displayText) {
        const linkText = displayText || filePath.replace('.md', '');
        const href = convertToUrl(filePath.replace('.md', '').trim());
        
        return `<div class="block-embed">
            <a href="${href}" class="wiki-link block-link">📄 ${linkText}</a>
        </div>`;
    });
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ - теперь сохраняет кириллицу и пробелы
function convertToUrl(pageName) {
    // Для кириллических названий - транслитерация
    const translitMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
        'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    
    let result = pageName.toLowerCase();
    
    // Транслитерируем кириллицу
    result = result.replace(/[а-яё]/g, function(char) {
        return translitMap[char] || char;
    });
    
    // Заменяем пробелы на дефисы, сохраняем разрешенные символы
    result = result.replace(/\s+/g, '-')
                  .replace(/[^a-z0-9-]/g, '') // Удаляем только специальные символы
                  .replace(/-+/g, '-')        // Убираем повторяющиеся дефисы
                  .replace(/^-|-$/g, '');     // Убираем дефисы в начале/конце
    
    // Если после очистки строка пустая, используем fallback
    if (!result) {
        result = 'page';
    }
    
    return result + '.html';
}

// Проверяем битые ссылки
function checkBrokenLinks(element) {
    const wikiLinks = element.querySelectorAll('.wiki-link');
    const baseUrl = window.location.origin;
    
    wikiLinks.forEach(link => {
        const href = link.getAttribute('href');
        const fullUrl = href.startsWith('http') ? href : baseUrl + href;
        
        // Для отладки
        console.log('Checking link:', fullUrl);
        
        fetch(fullUrl, { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    link.classList.add('broken');
                    link.title = 'Страница не найдена';
                    console.warn('Broken link:', fullUrl);
                } else {
                    console.log('Valid link:', fullUrl);
                }
            })
            .catch(() => {
                link.classList.add('broken');
                link.title = 'Страница не найдена';
                console.warn('Broken link:', fullUrl);
            });
    });
}

// Дополнительно: обрабатываем клики по вики-ссылкам
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('wiki-link')) {
        e.preventDefault();
        const href = e.target.getAttribute('href');
        console.log('Navigating to:', href);
        window.location.href = href;
    }
});