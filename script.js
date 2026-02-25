
let globalProfileData = null;

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


window.addEventListener('load', async function () {
    const loadingScreen = document.getElementById('loading-screen');

    // Load profile data first
    await populateProfileData();

    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';

            // Start typing effect after loading screen fades out
            setTimeout(() => {
                initTypingEffect();
            }, 100); // Small delay to ensure everything is ready

            animateSkillBars();

            initScrollAnimations();

            advancedFetcher.fetchProjects();
        }, 500);
    }, 2000);

    // Initialize binary background after loading screen fades
    initBinaryBackground();
    createFloatingMatrix();
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


// Dynamic Content Loading Functions
async function loadData() {
    try {
        const response = await fetch('profile-data.json');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading profile data:', error);
        return null;
    }
}

// Populate profile data
async function populateProfileData() {
    const data = await loadData();
    if (!data) return;

    // Store the data globally for access by other functions
    globalProfileData = data;

    // Update title
    const titleElement = document.querySelector('title');
    if (titleElement) {
        titleElement.textContent = `${data.personalInfo.name} | ${data.personalInfo.title}`;
    }

    // Update profile-specific text elements
    document.querySelectorAll('[data-profile-name]').forEach(el => {
        el.textContent = data.personalInfo.name;
    });

    document.querySelectorAll('[data-profile-headline]').forEach(el => {
        el.textContent = data.personalInfo.headline;
    });

    document.querySelectorAll('[data-profile-subtitle]').forEach(el => {
        el.textContent = data.personalInfo.subtitle;
    });

    // Populate profile code container
    populateProfileCode(data.profileCode.lines);

    // Populate personal info grid
    populatePersonalInfoGrid(data.personalInfo);

    // Populate skills
    populateSkills(data.skills);

    // Populate experience
    populateExperience(data.experiences);

    // Populate internship goals
    populateInternshipGoals(data.internshipGoals);

    // Populate contact methods
    populateContactMethods(data.personalInfo.contact);

    // Populate social links
    populateSocialLinks(data.socialLinks);

    // Update footer status
    const footerStatus = document.getElementById('footer-status');
    if (footerStatus) {
        footerStatus.textContent = data.personalInfo.availability;
    }
}

// Populate profile code - prepare the container but don't start typing yet
function populateProfileCode(lines) {
    const container = document.getElementById('profile-code-container');
    if (!container) return;

    // Clear container
    container.innerHTML = '';

    // Create code lines with syntax highlighting
    lines.forEach((line, index) => {
        const codeLine = document.createElement('div');
        codeLine.className = 'code-line';
        codeLine.style.opacity = '0';

        // Parse the line for syntax highlighting
        const highlightedLine = parseCodeLine(line);
        codeLine.insertAdjacentHTML('beforeend', highlightedLine);

        container.appendChild(codeLine);
    });
}

// Parse code line for syntax highlighting
function parseCodeLine(line) {
    let highlighted = line;
    
    // Highlight strings (do this before keywords to prevent highlighting inside strings)
    highlighted = highlighted.replaceAll(/("[^"]*"|'[^']*')/g, '<span class="code-string">$1</span>');


    // Highlight keywords (const, new, true, etc.)
    highlighted = highlighted.replaceAll(/\b(const|new|true|false|null|undefined)\b/g, '<span class="code-keyword">$1 &nbsp;</span> ');
    
    // Highlight function names
    highlighted = highlighted.replaceAll(/(\w+)\s*\(/g, '<span class="code-function">$1&nbsp;</span>(');


    // Highlight numbers
    highlighted = highlighted.replaceAll(/\b(\d+)\b/g, '<span class="code-number">$1&nbsp;</span>');

    // Highlight params "( , ) , { ,} "
    highlighted = highlighted.replaceAll(/([\(\)\{\}])/g, '<span class="code-param">$1&nbsp;</span>');

    // Highlight comments
    highlighted = highlighted.replaceAll(/(\/\/.*)/g, '<span class="code-comment">$1&nbsp;</span>');

    return highlighted;
}

// Populate personal info grid
function populatePersonalInfoGrid(personalInfo) {
    const container = document.getElementById('personal-info-grid');
    if (!container) return;

    const infoItems = [
        { label: 'University', value: personalInfo.university },
        { label: 'Major', value: personalInfo.major },
        { label: 'Study Period', value: personalInfo.studyPeriod },
        { label: 'Current Status', value: personalInfo.currentStatus, highlight: true },
        { label: 'Location', value: personalInfo.location },
        { label: 'Open To', value: 'Internships & Collaborative Projects' }
    ];

    container.innerHTML = '';
    infoItems.forEach(item => {
        const infoItem = document.createElement('div');
        infoItem.className = 'info-item';
        
        const label = document.createElement('div');
        label.className = 'info-label';
        label.textContent = item.label;
        
        const value = document.createElement('div');
        value.className = item.highlight ? 'info-value highlight' : 'info-value';
        value.textContent = item.value;
        
        infoItem.appendChild(label);
        infoItem.appendChild(value);
        container.appendChild(infoItem);
    });
}

// Populate skills
function populateSkills(skills) {
    const container = document.getElementById('skills-container');
    if (!container) return;

    container.innerHTML = '';

    Object.keys(skills).forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'skill-category fade-in';

        const heading = document.createElement('h3');
        heading.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        categoryDiv.appendChild(heading);

        skills[category].forEach(skill => {
            const skillItem = document.createElement('div');
            skillItem.className = 'skill-item';

            const skillHeader = document.createElement('div');
            skillHeader.className = 'skill-header';

            const skillName = document.createElement('span');
            skillName.className = 'skill-name';
            skillName.textContent = skill.name;

            const skillPercent = document.createElement('span');
            skillPercent.className = 'skill-percent';
            skillPercent.textContent = skill.percentage + '%';

            skillHeader.appendChild(skillName);
            skillHeader.appendChild(skillPercent);

            const skillBar = document.createElement('div');
            skillBar.className = 'skill-bar';

            const skillLevel = document.createElement('div');
            skillLevel.className = 'skill-level';
            skillLevel.dataset.width = skill.percentage

            skillBar.appendChild(skillLevel);

            skillItem.appendChild(skillHeader);
            skillItem.appendChild(skillBar);
            categoryDiv.appendChild(skillItem);
        });

        container.appendChild(categoryDiv);
    });
}

// Populate experience
function populateExperience(experiences) {
    const container = document.getElementById('experience-container');
    if (!container) return;

    container.innerHTML = '';

    experiences.forEach((exp, index) => {
        const card = document.createElement('div');
        card.className = 'experience-card fade-in';

        const timeline = document.createElement('div');
        timeline.className = 'experience-timeline';

        const timelineDot = document.createElement('div');
        timelineDot.className = 'timeline-dot';

        const timelineLine = document.createElement('div');
        timelineLine.className = 'timeline-line';

        timeline.appendChild(timelineDot);
        timeline.appendChild(timelineLine);

        const content = document.createElement('div');
        content.className = 'experience-content';

        const header = document.createElement('div');
        header.className = 'experience-header';

        const titleSection = document.createElement('div');
        
        const title = document.createElement('h3');
        title.className = 'experience-title';
        title.textContent = exp.title;

        const company = document.createElement('p');
        company.className = 'experience-company';
        company.innerHTML = `<i class="fas fa-building"></i> ${exp.company}`;

        titleSection.appendChild(title);
        titleSection.appendChild(company);

        const date = document.createElement('div');
        date.className = 'experience-date';
        date.innerHTML = `<i class="far fa-calendar-alt"></i> ${exp.dates}`;

        header.appendChild(titleSection);
        header.appendChild(date);

        const description = document.createElement('div');
        description.className = 'experience-description';

        const ul = document.createElement('ul');
        exp.description.forEach(desc => {
            const li = document.createElement('li');
            li.innerHTML = desc;
            ul.appendChild(li);
        });

        description.appendChild(ul);

        const tags = document.createElement('div');
        tags.className = 'experience-tags';

        exp.tags.forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'exp-tag';
            tagSpan.textContent = tag;
            tags.appendChild(tagSpan);
        });

        content.appendChild(header);
        content.appendChild(description);
        content.appendChild(tags);

        card.appendChild(timeline);
        card.appendChild(content);

        container.appendChild(card);
    });
}

// Populate internship goals
function populateInternshipGoals(goals) {
    const container = document.getElementById('internship-goals-container');
    if (!container) return;

    container.innerHTML = `
        <p>I am actively seeking a <strong>${goals.positionType}</strong> where I can
            contribute to meaningful projects while learning from experienced engineers. I'm eager to apply my
            technical skills in a professional environment and grow as a developer.</p>

        <div class="internship-grid">
            <div class="internship-item">
                <h3>What I'm Looking For</h3>
                <p>${goals.interests}</p>
            </div>
            <div class="internship-item">
                <h3>My Availability</h3>
                <p>Available from <strong>January 15 - October 30, 2026</strong>. Open to remote, hybrid, or
                    in-person positions.</p>
            </div>
            <div class="internship-item">
                <h3>What I Can Offer</h3>
                <p>${goals.whatIOffer}</p>
            </div>
        </div>

        <div style="margin-top: 30px; text-align: center;">
            <a href="#contact" class="resume-btn" title="Contact" aria-label="Contact"
                style="font-size: 1.1rem;">
                <i class="fas fa-envelope"></i> Discuss Internship Opportunities
            </a>
        </div>
    `;
}

// Populate contact methods
function populateContactMethods(contact) {
    const container = document.getElementById('contact-methods-container');
    if (!container) return;

    container.innerHTML = `
        <div class="contact-method">
            <div class="contact-icon">
                <i class="fas fa-envelope"></i>
            </div>
            <div>
                <div class="info-label">Email</div>
                <div class="info-value">${contact.email}</div>
            </div>
        </div>
        <div class="contact-method">
            <div class="contact-icon">
                <i class="fas fa-phone"></i>
            </div>
            <div>
                <div class="info-label">Phone</div>
                <div class="info-value">${contact.phone}</div>
            </div>
        </div>
        <div class="contact-method">
            <div class="contact-icon">
                <i class="fas fa-map-marker-alt"></i>
            </div>
            <div>
                <div class="info-label">Location</div>
                <div class="info-value">${contact.address}</div>
            </div>
        </div>
    `;
}

// Populate social links
function populateSocialLinks(links) {
    const container = document.getElementById('social-links-container');
    if (!container) return;

    container.innerHTML = '';
    links.forEach(link => {
        const anchor = document.createElement('a');
        anchor.href = link.url;
        anchor.className = 'social-link';
        anchor.target = '_blank';
        anchor.title = link.name;
        anchor.setAttribute('aria-label', link.name);
        anchor.rel = 'noopener noreferrer';
        anchor.innerHTML = `<i class="${link.icon}"></i>`;
        container.appendChild(anchor);
    });
}

function populateCVLink(cvUrl) {
    const cvLinks = document.getElementsByClassName('cv-link');
    if (cvLinks.length > 0) {
        for (const element of cvLinks) {
            element.href = cvUrl;
        }
    }
}


// Typing Effect Logic
function initTypingEffect() {
    const typingContainer = document.querySelector('.hybrid-container');
    if (!typingContainer) return;

    const codeLines = Array.from(typingContainer.querySelectorAll('.code-line'));
    const originalContents = [];

    // Store original HTML and plain text content, then clear lines
    codeLines.forEach(line => {
        originalContents.push({
            fullHtml: line.innerHTML,
            plainText: line.textContent // Get plain text to type character by character
        });
        line.innerHTML = ''; // Clear content for typing animation
        line.style.opacity = '0'; // Initially hide the line
        // The typing function will make each line visible as it's typed
    });

    let lineIndex = 0;
    let charIndex = 0;
    const typingSpeed = 15;
    const lineDelay = 20;

    // Create a single cursor element to move around
    const sharedCursor = document.createElement('span');
    sharedCursor.classList.add('cursor');

    function initializeLine(currentLine) {
        currentLine.style.opacity = '1';
        const lineNumber = document.createElement('span');
        lineNumber.className = 'line-number';
        lineNumber.textContent = (lineIndex + 1).toString();
        currentLine.appendChild(lineNumber);
        currentLine.appendChild(document.createTextNode(' '));
    }

    function updateLineWithText(currentLine, plainText) {
        if (sharedCursor.parentNode === currentLine) {
            sharedCursor.remove();
        }
        const currentText = plainText.substring(0, charIndex + 1);
        
        // Preserve line number and add the typed text
        const lineNumber = currentLine.querySelector('.line-number');
        if (lineNumber) {
            lineNumber.remove();
        }
        
        currentLine.innerHTML = '';
        const newLineNumber = document.createElement('span');
        newLineNumber.className = 'line-number';
        newLineNumber.textContent = (lineIndex + 1).toString();
        currentLine.appendChild(newLineNumber);
        currentLine.appendChild(document.createTextNode(' ' + currentText));
        currentLine.appendChild(sharedCursor);
    }

    function finalizeLine(currentLine, fullHtml) {
        if (sharedCursor.parentNode === currentLine) {
            sharedCursor.remove();
        }
        currentLine.innerHTML = '';
        const lineNumber = document.createElement('span');
        lineNumber.className = 'line-number';
        lineNumber.textContent = (lineIndex + 1).toString();
        currentLine.appendChild(lineNumber);
        currentLine.appendChild(document.createTextNode(' '));
        currentLine.insertAdjacentHTML('beforeend', fullHtml.replace(/^\s*\d+\s*/, ''));
        currentLine.style.opacity = '1';
    }

    function advanceToNextLine() {
        lineIndex++;
        charIndex = 0;
        if (lineIndex < codeLines.length) {
            setTimeout(typeChar, lineDelay);
        } else {
            if (sharedCursor.parentNode) {
                sharedCursor.remove();
            }
        }
    }

    function typeChar() {
        if (lineIndex >= codeLines.length) {
            if (sharedCursor.parentNode) {
                sharedCursor.remove();
            }
            return;
        }

        const currentLine = codeLines[lineIndex];
        const { fullHtml, plainText } = originalContents[lineIndex];

        if (charIndex === 0) {
            initializeLine(currentLine);
        }

        if (!currentLine.contains(sharedCursor)) {
            currentLine.appendChild(sharedCursor);
        }

        if (charIndex < plainText.length) {
            updateLineWithText(currentLine, plainText);
            charIndex++;
            setTimeout(typeChar, typingSpeed);
        } else {
            finalizeLine(currentLine, fullHtml);
            advanceToNextLine();
        }
    }

    // Start the typing effect
    typeChar();
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








let cvLoaded = false;

async function loadCV(cvUrl) {
    if (cvLoaded) return;

    const cvFrame = document.getElementById('cvFrame');
    const loader = document.getElementById('cvLoader');
    const cvModalBody = document.querySelector('.cv-modal-body');

    loader.style.display = 'block';

    try {
        // Check if the file exists by making a HEAD request
        const response = await fetch(cvUrl, { method: 'HEAD' });
        
        if (response.ok) {
            // File exists, load it normally
            cvFrame.data = cvUrl;
            
            setTimeout(() => {
                loader.style.display = 'none';
                cvFrame.style.display = 'block';
                cvLoaded = true;
            }, 1000);
        } else {
            // File doesn't exist, show error message
            throw new Error('File not found');
        }
    } catch (error) {
        console.error('Failed to load CV:', error);
        // File failed to load, show error message
        loader.style.display = 'none';
        cvFrame.style.display = 'none';
        
        // Create error message element
        const errorMessage = document.createElement('div');
        errorMessage.className = 'cv-error-message';
        errorMessage.innerHTML = `
            <div class="error-terminal">
                <div class="error-header">
                    <i class="fas fa-exclamation-triangle error-icon"></i>
                    <h4>CV_LOAD_ERROR</h4>
                </div>
                <div class="error-details">
                    <p><strong>STATUS:</strong> <span class="error-status">404_FILE_NOT_FOUND</span></p>
                    <p><strong>PATH:</strong> ${cvUrl}</p>
                    <p><strong>ERROR:</strong> CV file is not available at the moment</p>
                </div>
                <div class="error-suggestion">
                    <p><i class="fas fa-lightbulb"></i> <strong>SUGGESTION:</strong> Resume may be temporarily unavailable</p>
                </div>
            </div>
        `;
        
        // Clear the modal body and add error message
        cvModalBody.innerHTML = '';
        cvModalBody.appendChild(errorMessage);
        
        cvLoaded = true;
    }
    
    populateCVLink(cvUrl);
}

function openCVModal() {
    const modal = document.getElementById('cvModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    loadCV(globalProfileData.personalInfo.cvUrl);
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
    const cvUrl = globalProfileData?.personalInfo?.cvUrl;

    window.open(cvUrl, '_blank');

    closeCVModal();
}



// Binary Mouse Trail Effect
function initBinaryMouseTrail() {
    const trailContainer = document.createElement('div');
    trailContainer.id = 'binary-trail-container';
    trailContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
    `;
    document.body.appendChild(trailContainer);

    const trailElements = [];
    const maxTrailElements = 20;
    let mouseX = 0;
    let mouseY = 0;
    let lastTime = 0;
    const trailInterval = 20; // milliseconds between trail elements

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function createTrailElement(x, y) {
        const element = document.createElement('div');
        element.className = 'binary-trail-element';
        element.textContent = Math.random() > 0.5 ? '1' : '0';
        
        const size = Math.random() * 12 + 8; // Random size between 8-20px
        const duration = Math.random() * 1 + 0.5; // Random duration between 0.5-1.5s
        
        element.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            font-family: 'Fira Code', monospace;
            font-size: ${size}px;
            color: #00ff88;
            opacity: 1;
            pointer-events: none;
            z-index: 9998;
            text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
            font-weight: bold;
            transition: opacity ${duration}s ease-out;
            user-select: none;
            -webkit-user-select: none;
        `;
        
        document.body.appendChild(element);
        trailElements.push({
            element: element,
            startTime: Date.now(),
            duration: duration * 1000
        });

        // Remove old elements if we exceed the maximum
        if (trailElements.length > maxTrailElements) {
            const oldElement = trailElements.shift();
            if (oldElement.element.parentNode) {
                oldElement.element.remove();
            }
        }
    }

    function updateTrail(timestamp) {
        if (timestamp - lastTime > trailInterval) {
            createTrailElement(mouseX, mouseY);
            lastTime = timestamp;
        }

        // Update existing elements
        for (let i = trailElements.length - 1; i >= 0; i--) {
            const trailElement = trailElements[i];
            const elapsed = Date.now() - trailElement.startTime;
            const progress = Math.min(elapsed / trailElement.duration, 1);
            
            if (progress >= 1) {
                if (trailElement.element.parentNode) {
                    trailElement.element.remove();
                }
                trailElements.splice(i, 1);
            } else {
                const opacity = 1 - progress;
                trailElement.element.style.opacity = opacity.toString();
                
                // Add slight random movement for organic effect
                const xMove = (Math.random() - 0.5) * 20;
                const yMove = (Math.random() - 0.5) * 20;
                trailElement.element.style.transform = `translate(${xMove}px, ${yMove}px)`;
            }
        }

        requestAnimationFrame(updateTrail);
    }

    requestAnimationFrame(updateTrail);
}

// Initialize the binary mouse trail effect when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initBinaryMouseTrail();
});

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

function createFloatingMatrix() {
    const container = document.querySelector('.hybrid-container');
    if (!container) return;

    for (let i = 0; i < 30; i++) {
        const char = document.createElement('div');
        char.className = 'floating-matrix';
        char.textContent = Math.random() > 0.5 ? '0' : '1';
        char.style.left = Math.random() * 100 + '%';
        char.style.top = -20 + 'px';
        char.style.animationDelay = Math.random() * 6 + 's';
        char.style.animationDuration = (Math.random() * 3 + 3) + 's';
        container.appendChild(char);
    }
}
