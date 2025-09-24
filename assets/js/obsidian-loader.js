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
        const href = convertToUrl(pageName);
        
        return `<a href="${href}" class="wiki-link" data-wiki-page="${pageName}">${linkText}</a>`;
    });
    
    // Проверяем существование страниц и помечаем битые ссылки
    checkBrokenLinks(element);
}

// Функция для встраивания изображений ![[ ]]
function handleImageEmbeds(element) {
    const imageEmbedRegex = /!\[\[([^\]]+\.(?:png|jpg|jpeg|gif|svg|webp))\]\]/gi;
    
    element.innerHTML = element.innerHTML.replace(imageEmbedRegex, function(match, imagePath) {
        const fullPath = `/assets/images/${imagePath}`;
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
        const href = convertToUrl(filePath.replace('.md', ''));
        
        return `<div class="block-embed">
            <a href="${href}" class="wiki-link block-link">📄 ${linkText}</a>
        </div>`;
    });
}

// Преобразуем имя страницы в URL
function convertToUrl(pageName) {
    return pageName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') + '.html';
}

// Проверяем битые ссылки (после загрузки страницы)
function checkBrokenLinks(element) {
    const wikiLinks = element.querySelectorAll('.wiki-link');
    
    wikiLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Простая проверка - можно улучшить
        fetch(href, { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    link.classList.add('broken');
                    link.title = 'Страница не найдена';
                }
            })
            .catch(() => {
                link.classList.add('broken');
                link.title = 'Страница не найдена';
            });
    });
}