// Login Page JavaScript - Clean and Modern Implementation

class LoginManager {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.passwordToggle = document.getElementById('passwordToggle');
        this.loginBtn = document.getElementById('loginBtn');
        this.btnText = this.loginBtn.querySelector('.btn-text');
        this.btnLoading = this.loginBtn.querySelector('.btn-loading');
        this.errorElement = document.getElementById('loginError');
        
        this.initializeEventListeners();
        this.focusUsername();
    }

    initializeEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleLogin(e));
        
        // Password visibility toggle
    this.passwordToggle.addEventListener('click', () => this.togglePasswordVisibility());
    this.passwordToggle.setAttribute('aria-label', 'Mostrar/ocultar senha');
    this.passwordToggle.setAttribute('title', 'Mostrar/ocultar senha');
    this.passwordToggle.setAttribute('aria-pressed', 'false');
        
        // Input validation on type
        this.usernameInput.addEventListener('input', () => this.clearError());
        this.passwordInput.addEventListener('input', () => this.clearError());
        
        // Enter key handling
        this.passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleLogin(e);
            }
        });
    }

    focusUsername() {
        // Auto-focus username field after page load
        setTimeout(() => {
            this.usernameInput.focus();
        }, 100);
    }

    togglePasswordVisibility() {
        const isPassword = this.passwordInput.type === 'password';
        const icon = this.passwordToggle.querySelector('i');
        
        if (isPassword) {
            this.passwordInput.type = 'text';
            icon.className = 'fas fa-eye-slash';
            this.passwordToggle.setAttribute('aria-pressed', 'true');
            this.passwordToggle.setAttribute('title', 'Ocultar senha');
        } else {
            this.passwordInput.type = 'password';
            icon.className = 'fas fa-eye';
            this.passwordToggle.setAttribute('aria-pressed', 'false');
            this.passwordToggle.setAttribute('title', 'Mostrar senha');
        }
    }

    clearError() {
        this.errorElement.style.display = 'none';
    }

    showError(message = 'Usuário ou senha incorretos') {
        this.errorElement.querySelector('span').textContent = message;
        this.errorElement.style.display = 'flex';
    }

    setLoading(isLoading) {
        this.loginBtn.disabled = isLoading;
        
        if (isLoading) {
            this.btnText.style.display = 'none';
            this.btnLoading.style.display = 'flex';
        } else {
            this.btnText.style.display = 'block';
            this.btnLoading.style.display = 'none';
        }
    }

    validateInputs() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value.trim();
        
        if (!username) {
            this.showError('Por favor, digite seu usuário');
            this.usernameInput.focus();
            return false;
        }
        
        if (!password) {
            this.showError('Por favor, digite sua senha');
            this.passwordInput.focus();
            return false;
        }
        
        if (password.length < 3) {
            this.showError('A senha deve ter pelo menos 3 caracteres');
            this.passwordInput.focus();
            return false;
        }
        
        return { username, password };
    }

    async authenticateUser(credentials) {
        // Simulate API call with realistic delay
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simple authentication logic (replace with real API call)
                const validCredentials = [
                    { username: 'admin', password: 'admin' },
                    { username: 'usuario', password: '123456' },
                    { username: 'retifica', password: 'retifica2025' }
                ];
                
                const isValid = validCredentials.some(
                    cred => cred.username === credentials.username && 
                           cred.password === credentials.password
                );
                
                resolve({
                    success: isValid,
                    user: isValid ? { 
                        username: credentials.username,
                        name: credentials.username === 'admin' ? 'Administrador' : 'Usuário',
                        role: credentials.username === 'admin' ? 'admin' : 'user'
                    } : null
                });
            }, 1200); // Realistic loading time
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        this.clearError();
        
        const credentials = this.validateInputs();
        if (!credentials) return;
        
        try {
            this.setLoading(true);
            
            const result = await this.authenticateUser(credentials);
            
            if (result.success) {
                // Store user session
                this.storeUserSession(result.user);
                
                // Show success feedback briefly
                this.btnLoading.innerHTML = `
                    <i class="fas fa-check"></i>
                    <span>Sucesso!</span>
                `;
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 800);
            } else {
                this.setLoading(false);
                this.showError('Usuário ou senha incorretos');
                this.passwordInput.value = '';
                this.passwordInput.focus();
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.setLoading(false);
            this.showError('Erro interno. Tente novamente.');
        }
    }

    storeUserSession(user) {
        // Store user data in localStorage for session persistence
        const sessionData = {
            user: user,
            loginTime: new Date().toISOString(),
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
        };
        
        try {
            localStorage.setItem('userSession', JSON.stringify(sessionData));
        } catch (error) {
            console.warn('Failed to store session:', error);
        }
    }

    // Static method to check if user is authenticated (for use in dashboard)
    static isAuthenticated() {
        try {
            const session = localStorage.getItem('userSession');
            if (!session) return false;
            
            const sessionData = JSON.parse(session);
            const now = new Date();
            const expires = new Date(sessionData.expires);
            
            return now < expires;
        } catch (error) {
            console.warn('Session check failed:', error);
            return false;
        }
    }

    // Static method to get current user (for use in dashboard)
    static getCurrentUser() {
        try {
            const session = localStorage.getItem('userSession');
            if (!session) return null;
            
            const sessionData = JSON.parse(session);
            return LoginManager.isAuthenticated() ? sessionData.user : null;
        } catch (error) {
            console.warn('Get user failed:', error);
            return null;
        }
    }

    // Static method to logout (for use in dashboard)
    static logout() {
        try {
            localStorage.removeItem('userSession');
            window.location.href = 'login.html';
        } catch (error) {
            console.warn('Logout failed:', error);
            // Fallback: just redirect
            window.location.href = 'login.html';
        }
    }
}

// Initialize login manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Intro overlay flow
    const overlay = document.getElementById('intro-overlay');
    const video = document.getElementById('intro-video');
    const startBtn = document.getElementById('start-intro');
    const loginContainer = document.querySelector('.login-container');

    function revealLogin() {
        if (!overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        }
        loginContainer.classList.add('reveal-login');
    }

    async function startIntro() {
        // If intro elements are missing (fallback), just show login
        if (!overlay || !video) {
            initializeLogin();
            return;
        }

        // Try to autoplay muted (browser policy)
        try {
            video.muted = true;
            await video.play();
        } catch (e) {
            // Autoplay bloqueado: exibir botão central para iniciar
            console.warn('Autoplay blocked:', e);
            if (startBtn) startBtn.style.display = 'block';
        }

        // When video ends, reveal login
        video.addEventListener('ended', () => {
            revealLogin();
            initializeLogin();
        });

        // Se autoplay bloqueado, usuário precisa iniciar o vídeo
        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                startBtn.style.display = 'none';
                try {
                    await video.play();
                } catch(err) {
                    console.warn('Video start failed:', err);
                }
            });
        }
    }

    function initializeLogin() {
        // Check if user is already authenticated
        if (LoginManager.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }
        new LoginManager();
    }

    startIntro();
});

// Expose logout method globally for dashboard use
window.LoginManager = LoginManager;
