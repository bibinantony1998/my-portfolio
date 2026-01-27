/**
 * Blog Fetcher
 * Fetches blogs from Medium and Dev.to, removes duplicates, and displays them interleaved in a Swiper carousel.
 */

const BLOG_CONFIG = {
    mediumRSS: 'https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@bibinAntonybibinAntony',
    devToAPI: 'https://dev.to/api/articles?username=bibin_antony_9fce1ed9318b',
    maxPosts: 10 // Increased to allow for scrolling
};

const normalizeTitle = (title) => {
    if (!title) return '';
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
};

const areTitlesSimilar = (t1, t2) => {
    if (!t1 || !t2) return false;

    const tokenize = (s) => normalizeTitle(s).split(/\s+/).filter(w => w.length >= 2);
    const words1 = tokenize(t1);
    const words2 = tokenize(t2);

    // If exact match after normalization
    if (words1.join('') === words2.join('')) return true;

    // If either has no valid words (e.g. only symbols), strictly compare raw strings
    if (words1.length === 0 || words2.length === 0) {
        return normalizeTitle(t1) === normalizeTitle(t2);
    }

    // Check intersection
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    let matchCount = 0;

    for (const w of set1) {
        if (set2.has(w)) matchCount++;
    }

    const similarity1 = matchCount / words1.length;
    const similarity2 = matchCount / words2.length;

    // Threshold: if > 60% of keywords match in EITHER direction
    return similarity1 > 0.6 || similarity2 > 0.6;
};

const fetchMediumBlogs = async () => {
    try {
        const response = await fetch(BLOG_CONFIG.mediumRSS);
        const data = await response.json();
        return data.items.map(post => {
            // Extract text from description (which often contains HTML in RSS)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = post.description || post.content;
            const plainText = tempDiv.textContent || tempDiv.innerText || '';
            const shortDesc = plainText.substring(0, 100) + '...';

            return {
                title: post.title,
                link: post.link,
                thumbnail: post.thumbnail,
                date: post.pubDate,
                source: 'Medium',
                description: shortDesc
            };
        });
    } catch (error) {
        console.error('Error fetching Medium blogs:', error);
        return [];
    }
};

const fetchDevToBlogs = async () => {
    try {
        const response = await fetch(BLOG_CONFIG.devToAPI);
        const data = await response.json();
        return data.map(post => ({
            title: post.title,
            link: post.url,
            thumbnail: post.cover_image || post.social_image,
            date: post.published_at,
            source: 'Dev.to',
            description: post.description
        }));
    } catch (error) {
        console.error('Error fetching Dev.to blogs:', error);
        return [];
    }
};

const renderBlogSlide = (post) => {
    return `
    <div class="swiper-slide h-auto">
      <a href="${post.link}" target="_blank" class="text-decoration-none h-100 d-block">
        <div class="blog-card glass-card h-100">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge ${post.source === 'Medium' ? 'bg-black' : 'bg-white text-dark border'} rounded-pill">${post.source}</span>
              <small class="text-muted">${new Date(post.date).toLocaleDateString()}</small>
            </div>
            <h4 class="card-title text-truncate-2" style="font-size: 1.1rem;">${post.title}</h4>
            <p class="card-text text-muted small flex-grow-1" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${post.description}</p>
          </div>
        </div>
      </a>
    </div>
  `;
};

const initBlogs = async () => {
    const container = document.getElementById('blog-container');
    if (!container) return;

    try {
        // Show loading state
        container.innerHTML = '<div class="text-center w-100"><div class="spinner-border text-primary" role="status"></div></div>';

        const [mediumPosts, devToPosts] = await Promise.all([
            fetchMediumBlogs(),
            fetchDevToBlogs()
        ]);

        // Grouping by Similarity
        const topics = [];
        const allPosts = [...mediumPosts, ...devToPosts];

        if (allPosts.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">No recent articles found.</p>';
            return;
        }

        allPosts.forEach(post => {
            // Try to find an existing topic that matches this post
            let match = topics.find(topic => {
                const existingPost = topic.Medium || topic['Dev.to'];
                return existingPost && areTitlesSimilar(existingPost.title, post.title);
            });

            if (match) {
                match[post.source] = post;
            } else {
                const newTopic = { Medium: null, 'Dev.to': null };
                newTopic[post.source] = post;
                topics.push(newTopic);
            }
        });

        const finalPosts = [];

        topics.forEach((topic, index) => {
            // Alternate preference: 
            // Even index (0, 2...): Prefer Medium, then Dev.to
            // Odd index (1, 3...): Prefer Dev.to, then Medium
            if (index % 2 === 0) {
                if (topic['Medium']) finalPosts.push(topic['Medium']);
                else if (topic['Dev.to']) finalPosts.push(topic['Dev.to']);
            } else {
                if (topic['Dev.to']) finalPosts.push(topic['Dev.to']);
                else if (topic['Medium']) finalPosts.push(topic['Medium']);
            }
        });

        // Build Swiper Structure
        const swiperHTML = `
        <div class="swiper blog-slider">
          <div class="swiper-wrapper">
            ${finalPosts.map(renderBlogSlide).join('')}
          </div>
          <div class="swiper-pagination"></div>
        </div>
      `;

        container.innerHTML = swiperHTML;
        container.classList.remove('row', 'g-4'); // Remove grid classes to avoid conflicts

        // Initialize Swiper
        new Swiper('.blog-slider', {
            speed: 600,
            loop: true,
            autoplay: {
                delay: 5000,
                disableOnInteraction: false
            },
            slidesPerView: 1, // Mobile first
            spaceBetween: 20,
            pagination: {
                el: '.swiper-pagination',
                type: 'bullets',
                clickable: true
            },
            breakpoints: {
                640: {
                    slidesPerView: 1,
                    spaceBetween: 20,
                },
                768: {
                    slidesPerView: 2,
                    spaceBetween: 20,
                },
                1024: {
                    slidesPerView: 3,
                    spaceBetween: 20,
                }
            }
        });
    } catch (error) {
        console.error('Error initializing blogs:', error);
        container.innerHTML = '<p class="text-center text-danger">Failed to load articles.</p>';
    }
};

document.addEventListener('DOMContentLoaded', initBlogs);
