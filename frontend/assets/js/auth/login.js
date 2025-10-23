// Auth: Login page logic migrated from root login.js
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
			this.usernameInput?.focus();
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
		if (this.errorElement) this.errorElement.style.display = 'none';
	}

	showError(message = 'Usuário ou senha incorretos') {
		const span = this.errorElement?.querySelector('span');
		if (span) span.textContent = message;
		if (this.errorElement) this.errorElement.style.display = 'flex';
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
		try {
			const resp = await api.post('/api/v1/auth/login', credentials);
			if (resp && resp.token) {
				api.setToken(resp.token);
				return { success: true, user: resp.user };
			}
			return { success: false };
		} catch (e) {
			return { success: false };
		}
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
				// Store user session and token
				this.storeUserSession(result.user);

				// Show success feedback briefly
				this.btnLoading.innerHTML = `
					<i class="fas fa-check"></i>
					<span>Sucesso!</span>
				`;

				// Store username for immediate access
				if (result.user && result.user.username) {
					localStorage.setItem('currentUsername', result.user.username);
				}

				// Redirect to dashboard (clean URL)
				setTimeout(() => {
					window.location.href = '/';
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
	static isAuthenticated() { return api.isAuthed(); }

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
			// Clear local token/session
			api.setToken('');
			localStorage.removeItem('userSession');
			localStorage.removeItem('currentUsername');
			// Ask server to clear HttpOnly cookie
			fetch((localStorage.getItem('apiBase') || window.location.origin) + '/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
		} catch {}
		// Prevent returning to dashboard via history
		window.location.replace('/login');
	}
}

// Initialize login manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	// Intro overlay flow
	const overlay = document.getElementById('intro-overlay');
	const video = document.getElementById('intro-video');
	const startBtn = null; // botão removido por pedido do usuário (sem fallback manual)
	const loginContainer = document.querySelector('.login-container');

	// Prevent multiple initializations
	let initialized = false;
	let revealed = false;

	function stopVideo() {
		try {
			if (video) {
				video.pause();
				video.currentTime = 0;
				// Detach source to avoid browser auto-replay quirks
				// Keep src so poster/controls remain if needed
			}
		} catch {}
	}

	function revealLogin() {
		if (revealed) return;
		revealed = true;
		stopVideo();
		if (overlay && !overlay.classList.contains('hidden')) {
			overlay.classList.add('hidden');
		}
		loginContainer?.classList.add('reveal-login');
		initializeLogin();
	}

	async function startIntro() {
		// If intro elements are missing (fallback), just show login
		if (!overlay || !video) { revealLogin(); return; }

		// Configure for autoplay
		try {
			video.setAttribute('autoplay', '');
			video.setAttribute('muted', '');
			video.playsInline = true;
			video.muted = true;
			await video.play();
		} catch (e) {
			// Autoplay bloqueado: pular imediatamente para o formulário (sem botão)
			console.warn('Autoplay blocked:', e);
			revealLogin();
			return;
		}

		// Quando o vídeo terminar, mostra o login (sem opção de pular antes)
		const onEnded = () => {
			revealLogin();
			video.removeEventListener('ended', onEnded);
		};
		video.addEventListener('ended', onEnded);

		// Se houver erro no vídeo, continuar para o formulário
		video.addEventListener('error', () => {
			console.warn('Video error');
			revealLogin();
		});

	}

	async function hasCookieSession() {
		// Check server-authenticated session using only cookies (no Authorization header)
		try {
			const apiBase = localStorage.getItem('apiBase') || window.location.origin;
			const res = await fetch(apiBase + '/api/v1/auth/me', { method: 'GET', credentials: 'same-origin' });
			return res.ok;
		} catch (_) {
			return false;
		}
	}

	function initializeLogin() {
		if (initialized) return;
		initialized = true;
		// Only redirect if we have a valid cookie-based session on the server
		hasCookieSession().then((ok) => {
			if (ok) {
				window.location.href = '/';
				return;
			}
			// Ensure any stale local token won't trigger client-side assumptions
			try { api.setToken(''); } catch {}
			new LoginManager();
		});
	}

	startIntro();
});

// Expose logout method globally for dashboard use
window.LoginManager = LoginManager;
