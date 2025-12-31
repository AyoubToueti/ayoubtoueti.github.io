
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
            console.warn('Failed to fetch pinned repos, falling back to REST API');
            return null;
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
            return null;
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
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
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


function showRepoDetails(repoName) {
    alert(`More details for ${repoName} would go here.\nYou could implement a modal with:\n- README content\n- Commit history\n- Contributors\n- Recent activity`);
}


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
});


function animateSkillBars() {
    const skillLevels = document.querySelectorAll('.skill-level');
    skillLevels.forEach(level => {
        const width = level.getAttribute('data-width');
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
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();


            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const company = document.getElementById('company').value;
            const message = document.getElementById('message').value;


            if (!name || !email || !message) {
                alert('Please fill in all required fields.');
                return;
            }



            alert(`Thank you ${name}! Your message has been sent. I'll get back to you soon!`);


            contactForm.reset();
        });
    }
});


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