// Section: Orçamentos
// Exporte apenas render e filter; ações (view/print/edit/delete) ficam a cargo das globais definidas em app.js/print.js
window.renderOrcamentos = window.renderOrcamentos || function(){};
window.filterOrcamentos = window.filterOrcamentos || function(){};

(function(){
	if (window.__orcamentosSectionInitialized) return;
	window.__orcamentosSectionInitialized = true;

	function hasState(){ return typeof state !== 'undefined' && state && Array.isArray(state.orcamentos); }

	function renderOrcamentosImpl(){
		if (!hasState()) return;
		const container = document.getElementById('orcamentos-list');
		const recentContainer = document.getElementById('recent-orcamentos-list');
		if (!container || !recentContainer) return;
		if (state.orcamentos.length === 0) {
			const emptyRow = `
				<tr>
					<td colspan="7" class="empty-state">
						<i class="fas fa-file-invoice"></i>
						<h3>Nenhum orçamento criado</h3>
						<p>Clique em "Novo Orçamento" para começar</p>
					</td>
				</tr>
			`;
			container.innerHTML = emptyRow;
			recentContainer.innerHTML = emptyRow;
			return;
		}
		const renderRow = (orcamento) => {
			const cliente = orcamento.cliente || state.clientes.find(c => String(c.id) === String(orcamento.clienteId)) || null;
			const clienteNome = (cliente && cliente.nome) || 'Cliente não encontrado';
			const telefoneRaw = ((cliente && cliente.telefone) ? cliente.telefone : '').replace(/\D/g,'');
			const waLink = telefoneRaw ? `https://wa.me/${telefoneRaw}` : 'https://wa.me/';
			const totalNum = Number(orcamento.total || 0);
			return `
				<tr>
					<td data-label="ID">#${orcamento.id}</td>
					<td data-label="Cliente">${clienteNome}</td>
					<td data-label="Data">${formatDate(orcamento.data)}</td>
					<td data-label="Valor">R$ ${totalNum.toFixed(2).replace('.', ',')}</td>
					<td data-label="Status"><span class="status-badge status-${orcamento.status}">${orcamento.status}</span></td>
					<td data-label="Ações">
						<div class="action-buttons">
							<button class="action-btn edit" onclick="editOrcamento('${orcamento.id}')" title="Editar">
								<i class="fas fa-edit"></i>
							</button>
							<button class="action-btn" onclick="viewOrcamento('${orcamento.id}')" title="Visualizar">
								<i class="fas fa-eye"></i>
							</button>
							<button class="action-btn" onclick="printOrcamento('${orcamento.id}')" title="Imprimir">
								<i class="fas fa-print"></i>
							</button>
							<button class="action-btn delete" onclick="deleteOrcamento('${orcamento.id}')" title="Excluir">
								<i class="fas fa-trash"></i>
							</button>
						</div>
					</td>
					<td data-label="Links">
						<div class="action-buttons">
							<a class="action-btn whatsapp" href="${waLink}" target="_blank" rel="noopener" title="WhatsApp" aria-label="Abrir WhatsApp do cliente">
								<i class="fab fa-whatsapp"></i>
							</a>
						</div>
					</td>
				</tr>
			`;
		};
		container.innerHTML = state.orcamentos.map(renderRow).join('');
		const recent = state.orcamentos
			.sort((a, b) => new Date(b.data) - new Date(a.data))
			.slice(0, 3);
		recentContainer.innerHTML = recent.map(renderRow).join('');
	}

	function filterOrcamentosImpl(){
		const sTermEl = document.getElementById('search-orcamentos');
		const statusEl = document.getElementById('status-filter');
		const startEl = document.getElementById('date-start');
		const endEl = document.getElementById('date-end');
		const rows = document.querySelectorAll('#orcamentos-list tr');
		if (!rows.length) return;
		const searchTerm = (sTermEl?.value || '').toLowerCase();
		const statusFilter = (statusEl?.value || '');
		const startDate = startEl?.value ? new Date(startEl.value + 'T00:00:00') : null;
		const endDate = endEl?.value ? new Date(endEl.value + 'T23:59:59') : null;
		rows.forEach(row => {
			const text = row.textContent.toLowerCase();
			const statusBadge = row.querySelector('.status-badge');
			const matchesStatus = !statusFilter || (statusBadge && statusBadge.classList.contains(`status-${statusFilter}`));
			const dateText = row.querySelector('[data-label="Data"]')?.textContent?.trim() || '';
			let dateOk = true;
			if (startDate || endDate) {
				const parts = dateText.split('/');
				if (parts.length === 3) {
					const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
					if (startDate && d < startDate) dateOk = false;
					if (endDate && d > endDate) dateOk = false;
				}
			}
			row.style.display = (text.includes(searchTerm) && matchesStatus && dateOk) ? '' : 'none';
		});
	}


	// Exportar apenas render e filter se ainda não definidos
	if (window.renderOrcamentos === Function.prototype || window.renderOrcamentos.toString() === (function(){}).toString()) window.renderOrcamentos = renderOrcamentosImpl;
	if (window.filterOrcamentos === Function.prototype || window.filterOrcamentos.toString() === (function(){}).toString()) window.filterOrcamentos = filterOrcamentosImpl;
})();
