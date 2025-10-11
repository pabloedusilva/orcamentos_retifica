Retífica Orçamentos — Estrutura organizada

Este projeto foi reorganizado para uma estrutura de frontend limpa e escalável.

Estrutura principal

- assets/
	- css/
		- global.css                   — estilos globais
		- auth/login.css               — estilos da página de login
		- sections/*.css               — estilos por seção (placeholders)
	- js/
		- app.js                       — lógica principal do app (migrado de script.js)
		- components/footer.js         — componente de rodapé compartilhado
		- auth/login.js                — lógica da página de login
		- sections/*.js                — lógica por seção (placeholders)
- auth/
	- login.html                     — página de login
- index.html                       — dashboard principal
- img/, video/                     — mídias
- manifest.webmanifest             — PWA

Como abrir

- Login: abra auth/login.html
- Dashboard: abra index.html (requer sessão; o botão “Sair” leva ao login)

Notas

- Os arquivos legados na raiz (styles.css, login.css, script.js, login.js, footer.js) foram substituídos por assets/*. O antigo login.html da raiz foi removido; use auth/login.html.
- Bibliotecas externas continuam via CDN (Google Fonts, Font Awesome, html2canvas, jsPDF).
- img/ e video/ permanecem na raiz para facilitar caminhos relativos.
