// Footer component migrated from root footer.js
(function(){
	function buildFooter(){
		var footer = document.createElement('footer');
		footer.className = 'site-footer';
		footer.setAttribute('role', 'contentinfo');
		footer.setAttribute('aria-label', 'Rodapé');

		var inner = document.createElement('div');
		inner.className = 'footer-content';

		var span = document.createElement('span');
		span.className = 'footer-text';
		span.appendChild(document.createTextNode('\u00A9 Desenvolvido por\u00A0'));

		var link = document.createElement('a');
		link.className = 'footer-link';
		link.href = 'https://github.com/pabloedusilva';
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.setAttribute('aria-label', 'Visitar GitHub de Pablo Silva');
		link.textContent = 'Pablo Silva';

		span.appendChild(link);
		inner.appendChild(span);
		footer.appendChild(inner);
		return footer;
	}

	function injectFooter(){
		if (document.querySelector('.site-footer')) return; // avoid duplicates
		var target = document.querySelector('.main-content') || document.body;
		target.appendChild(buildFooter());
	}

	// Expose manual init and auto-inject on DOM ready
	window.initGlobalFooter = injectFooter;

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', injectFooter);
	} else {
		injectFooter();
	}
})();
