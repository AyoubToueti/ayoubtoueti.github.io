class AdvancedGitHubFetcher {
    constructor(options = {}) {
        this.username = options.username || 'AyoubToueti';
        this.cacheKey = `github_repos_${this.username}`;
        this.cacheDuration = 60 * 60 * 1000;
        this.projectsContainer = document.getElementById('projects-container');
        this.usePinnedRepos = options.usePinnedRepos || false;
        this.showStats = options.showStats || true;
    }

    async fetchProjects() {
        try {
            this.showLoading();


            const cachedData = this.getCachedData();
            if (cachedData) {
                this.displayProjects(cachedData);
                return;
            }

            let repos;

            if (this.usePinnedRepos) {

                repos = await this.fetchPinnedRepositories();


                if (!repos || repos.length === 0) {
                    repos = await this.fetchAllRepositories();
                }
            } else {
                repos = await this.fetchAllRepositories();
            }


            this.cacheData(repos);

            this.displayProjects(repos);

        } catch (error) {
            console.error('Error fetching GitHub projects:', error);
            this.showError(error);
        }
    }

    async fetchPinnedRepositories() {
        try {

            const graphqlQuery = {
                query: `
                    query {
                        user(login: "${this.username}") {
                            pinnedItems(first: 6, types: REPOSITORY) {
                                nodes {
                                    ... on Repository {
                                        name
                                        description
                                        url
                                        homepageUrl
                                        primaryLanguage {
                                            name
                                        }
                                        stargazerCount
                                        forkCount
                                        updatedAt
                                        repositoryTopics(first: 5) {
                                            nodes {
                                                topic {
                                                    name
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                `
            };

            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Optional: Add token for higher rate limits
                    // 'Authorization': 'Bearer YOUR_TOKEN_HERE',
                },
                body: JSON.stringify(graphqlQuery)
            });

            if (!response.ok) {
                throw new Error(`GraphQL error: ${response.status}`);
            }

            const data = await response.json();
            return data.data.user.pinnedItems.nodes.map(repo => ({
                name: repo.name,
                description: repo.description,
                html_url: repo.url,
                homepage: repo.homepageUrl,
                language: repo.primaryLanguage?.name || 'Various',
                stargazers_count: repo.stargazerCount,
                forks_count: repo.forkCount,
                updated_at: repo.updatedAt,
                topics: repo.repositoryTopics.nodes.map(topic => topic.topic.name)
            }));

        } catch (error) {
            console.warn('Failed to fetch pinned repos, falling back to REST API:', error);
        }
    }

    async fetchAllRepositories() {
        const apiUrl = `https://api.github.com/users/${this.username}/repos?sort=updated&direction=desc&per_page=100`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const repos = await response.json();


        return repos
            .filter(repo => !repo.fork)
            .filter(repo => !['portfolio', 'resume', 'cv', 'github.io', 'test', 'demo']
                .some(excluded => repo.name.toLowerCase().includes(excluded)))
            .slice(0, 6)
            .map(repo => ({
                ...repo,
                topics: repo.topics || []
            }));
    }

    getCachedData() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (!cached) return null;

            const { timestamp, data } = JSON.parse(cached);


            if (Date.now() - timestamp < this.cacheDuration) {
                return data;
            }


            localStorage.removeItem(this.cacheKey);
            return null;

        } catch (error) {
            console.warn('Failed to retrieve cached data:', error);
        }
    }

    cacheData(data) {
        try {
            const cacheObject = {
                timestamp: Date.now(),
                data: data
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheObject));
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    }

    displayProjects(repos) {
        this.projectsContainer.innerHTML = '';

        if (!repos || repos.length === 0) {
            this.showNoProjects();
            return;
        }

        repos.forEach((repo, index) => {
            const card = this.createProjectCard(repo);
            this.projectsContainer.appendChild(card);


            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100 * index);
        });
    }

    createProjectCard(repo) {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';


        const updatedDate = new Date(repo.updated_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const languages = [repo.language, ...(repo.topics || [])].filter(Boolean);
        const uniqueLanguages = [...new Set(languages)].slice(0, 4);

        card.innerHTML = `
            <div class="project-header">
                <div class="project-title-row">
                    <h3 class="project-title">${this.formatRepoName(repo.name)}</h3>
                    ${repo.stargazers_count > 0 ?
                `<span class="star-count">⭐ ${repo.stargazers_count}</span>` : ''}
                </div>
                <p class="project-meta">
                    <i class="fas fa-calendar-alt"></i> Updated ${updatedDate}
                    ${repo.forks_count > 0 ? ` • <i class="fas fa-code-branch"></i> ${repo.forks_count}` : ''}
                </p>
                <div class="project-tech">
                    ${uniqueLanguages.map(lang =>
                    `<span class="tech-tag">${lang}</span>`
                ).join('')}
                </div>
            </div>
            <div class="project-body">
                <p class="project-description">${repo.description || 'No description available.'}</p>
                
                <div class="project-actions">
                    <a href="${repo.html_url}" target="_blank" class="project-link btn-code">
                        <i class="fab fa-github"></i> View Code
                    </a>
                    ${repo.homepage ? `
                    <a href="${repo.homepage}" target="_blank" class="project-link btn-demo">
                        <i class="fas fa-external-link-alt"></i> Live Demo
                    </a>
                    ` : ''}
                    <button class="btn-more" onclick="showRepoDetails('${repo.name}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
        `;

        return card;
    }

    formatRepoName(name) {
        return name
            .replaceAll(/[-_]/g, ' ')
            .replaceAll(/\b\w/g, l => l.toUpperCase());
    }

    showLoading() {
        this.projectsContainer.innerHTML = `
            <div class="loading-state">
                <div class="terminal-loader">
                    <div class="terminal-header">
                        <div class="terminal-title">Fetching GitHub Projects</div>
                        <div class="terminal-controls">
                            <span class="control-dot control-dot-red"></span>
                            <span class="control-dot control-dot-yellow"></span>
                            <span class="control-dot control-dot-green"></span>
                        </div>
                    </div>
                    <div class="terminal-body">
                        <div class="loading-line">
                            <span class="loading-prompt">$</span>
                            <span class="loading-text">Loading repositories from GitHub...</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showNoProjects() {
        this.projectsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>No projects found</h3>
                <p>Check out my <a href="https://github.com/${this.username}" target="_blank">GitHub profile</a> for more.</p>
            </div>
        `;
    }

    showError(error) {
        this.projectsContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Failed to load projects</h3>
                <p>${error.message}</p>
                <button onclick="advancedFetcher.fetchProjects()" class="btn-retry">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}


const advancedFetcher = new AdvancedGitHubFetcher({
    username: 'AyoubToueti',
    usePinnedRepos: false,
    showStats: true
});


async function showRepoDetails(repoName) {
    const modal = document.getElementById('readmeModal');
    const modalTitle = document.getElementById('readmeModalTitle');
    const readmeContent = document.getElementById('readmeContent');
    const readmeLoader = document.getElementById('readmeLoader');


    modal.classList.add('active');
    document.body.style.overflow = 'hidden';


    modalTitle.innerHTML = `<i class="fab fa-github"></i> ${repoName.replaceAll(/[-_]/g, ' ').replaceAll(/\b\w/g, l => l.toUpperCase())}`;


    readmeLoader.style.display = 'flex';
    readmeContent.innerHTML = '';

    try {

        const response = await fetch(`https://api.github.com/repos/AyoubToueti/${repoName}/readme`, {
            headers: {
                'Accept': 'application/vnd.github.html'
            }
        });

        if (!response.ok) {
            throw new Error('README not found');
        }

        const html = await response.text();


        readmeLoader.style.display = 'none';
        readmeContent.innerHTML = html;


        readmeContent.classList.add('markdown-body');

    } catch (error) {
        console.error('Failed to load README:', error);
        readmeLoader.style.display = 'none';
        readmeContent.innerHTML = `
            <div class="readme-error">
                <i class="fas fa-exclamation-circle"></i>
                <h3>README not available</h3>
                <p>This repository doesn't have a README file.</p>
                <a href="https://github.com/AyoubToueti/${repoName}" target="_blank" class="readme-link">
                    <i class="fab fa-github"></i> View on GitHub
                </a>
            </div>
        `;
    }
}

function closeReadmeModal() {
    const modal = document.getElementById('readmeModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Close README modal with click outside
document.addEventListener('click', function (event) {
    const modal = document.getElementById('readmeModal');
    if (event.target === modal) {
        closeReadmeModal();
    }
});


window.addEventListener('load', function () {
    const loadingScreen = document.getElementById('loading-screen');

    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';


            animateSkillBars();


            initScrollAnimations();


            advancedFetcher.fetchProjects();
        }, 500);
    }, 2000);

    // Initialize binary background after loading screen fades
    initBinaryBackground();
});

// Binary Background Logic
function initBinaryBackground() {
    const binaryBackground = document.getElementById('binary-background');
    if (!binaryBackground) return;

    const numDigits = 100; // Number of digits on screen at once
    const digits = [];

    function createDigit() {
        const digit = document.createElement('span');
        digit.classList.add('binary-digit');
        digit.textContent = Math.random() < 0.5 ? '0' : '1';

        const fontSize = Math.random() * 1.5 + 0.8; // 0.8rem to 2.3rem
        const left = Math.random() * 100; // 0% to 100%
        const animationDuration = Math.random() * 8 + 5; // 5s to 13s
        const animationDelay = Math.random() * 5; // 0s to 5s

        digit.style.fontSize = `${fontSize}rem`;
        digit.style.left = `${left}vw`;
        digit.style.animationDuration = `${animationDuration}s`;
        digit.style.animationDelay = `-${animationDelay}s`; // Start some animations mid-way

        binaryBackground.appendChild(digit);
        digits.push(digit);

        // Remove digit after it falls off screen
        digit.addEventListener('animationend', () => {
            digit.remove();
            digits.splice(digits.indexOf(digit), 1);
            // Create a new one to maintain the number of digits
            createDigit();
        });
    }

    // Initial population
    for (let i = 0; i < numDigits; i++) {
        createDigit();
    }

}


function animateSkillBars() {
    const skillLevels = document.querySelectorAll('.skill-level');
    skillLevels.forEach(level => {
        const width = level.dataset.width;
        level.style.width = width + '%';
    });
}


function initScrollAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    fadeElements.forEach(element => {
        observer.observe(element);
    });
}



document.addEventListener('DOMContentLoaded', function () {
    emailjs.init("pPz4tsFWYueh3iuVU");

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const company = document.getElementById('company').value;
            const message = document.getElementById('message').value;

            if (!name || !email || !message) {
                showNotification('Please fill in all required fields.', 'error');
                return;
            }

            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            submitBtn.disabled = true;

            try {
                await emailjs.send(
                    'service_gkhneuo',
                    'template_nb8vl2t',
                    {
                        from_name: name,
                        from_email: email,
                        company: company || 'Not specified',
                        message: message,
                        to_name: 'Ayoub Toueti',
                    }
                );

                showNotification(`Thank you ${name}! Your message has been sent successfully. I'll get back to you soon!`, 'success');
                contactForm.reset();

            } catch (error) {
                console.error('Email send failed:', error);
                showNotification('Failed to send message. Please try again or email me directly at your-email@example.com', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});

// Add notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}


document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});


function initTypingEffect() {
    const codeLines = document.querySelectorAll('.code-line');
    let delay = 0;

    codeLines.forEach(line => {
        line.style.opacity = '0';
        setTimeout(() => {
            line.style.transition = 'opacity 0.5s ease';
            line.style.opacity = '1';
        }, delay);
        delay += 200;
    });
}


setTimeout(initTypingEffect, 2500);


let cvLoaded = false;

function loadCV() {
    if (cvLoaded) return;

    const cvFrame = document.getElementById('cvFrame');
    const loader = document.getElementById('cvLoader');


    loader.style.display = 'block';


    cvFrame.data = 'cv.pdf';


    setTimeout(() => {
        loader.style.display = 'none';
        cvLoaded = true;
    }, 1000);
}

function openCVModal() {
    const modal = document.getElementById('cvModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';


    loadCV();
}

function closeCVModal() {
    const modal = document.getElementById('cvModal');
    const modalContent = modal.querySelector('.cv-modal-content');

    modal.classList.remove('active');
    modalContent.classList.remove('fullscreen');
    document.body.style.overflow = 'auto';


    const fullscreenBtn = modal.querySelector('.cv-modal-controls .cv-btn');
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
}

function toggleFullscreen(event) {
    const modalContent = document.querySelector('.cv-modal-content');
    const fullscreenBtn = event.currentTarget;

    if (modalContent.classList.contains('fullscreen')) {
        modalContent.classList.remove('fullscreen');
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    } else {
        modalContent.classList.add('fullscreen');
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
    }
}


document.addEventListener('click', function (event) {
    const modal = document.getElementById('cvModal');
    if (event.target === modal) {
        closeCVModal();
    }
});


document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeCVModal();
    }
});