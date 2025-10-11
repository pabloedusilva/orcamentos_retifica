// Section: Configurações
(function(){
	if (window.__configuracoesSectionInitialized) return;
	window.__configuracoesSectionInitialized = true;

	function mount(){
		// Only run if settings UI is present in DOM and app.js exposed initializer
		if (document.getElementById('configuracoes') && typeof initSettingsUI === 'function') {
			try { initSettingsUI(); } catch(e) { /* noop */ }
		}
	}

	// Run after DOM ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', mount);
	} else {
		setTimeout(mount, 0);
	}
})();
