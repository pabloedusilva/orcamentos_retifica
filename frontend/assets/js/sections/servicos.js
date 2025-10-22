// Section: Serviços
window.renderServicos = window.renderServicos || function(){};
window.editServico = window.editServico || function(){};
window.deleteServico = window.deleteServico || function(){};
window.filterServicos = window.filterServicos || function(){};

(function(){
	if (window.__servicosSectionInitialized) return;
	window.__servicosSectionInitialized = true;

	function hasState(){ return typeof state !== 'undefined' && state && Array.isArray(state.servicos); }

	function renderServicosImpl(){
		if (!hasState()) return;
		const container = document.getElementById('servicos-list');
		if (!container) return;
		if (state.servicos.length === 0) {
			container.innerHTML = `
				<tr>
					<td colspan="3" class="empty-state">
						<i class="fas fa-tools"></i>
						<h3>Nenhum serviço cadastrado</h3>
						<p>Clique em "Novo Serviço" para começar</p>
					</td>
				</tr>
			`;
			return;
		}
		container.innerHTML = state.servicos.map(servico => `
			<tr>
				<td data-label="Nome">${servico.nome}</td>
				<td data-label="Descrição">${servico.descricao || '-'}</td>
				<td data-label="Ações">
					<div class="action-buttons">
						<button class="action-btn edit" onclick="editServico('${servico.id}')" title="Editar">
							<i class="fas fa-edit"></i>
						</button>
						<button class="action-btn delete" onclick="deleteServico('${servico.id}')" title="Excluir">
							<i class="fas fa-trash"></i>
						</button>
					</div>
				</td>
			</tr>
		`).join('');
	}

	function filterServicosImpl(){
		const input = document.getElementById('search-servicos');
		const rows = document.querySelectorAll('#servicos-list tr');
		if (!input || !rows.length) return;
		const term = input.value.toLowerCase();
		rows.forEach(row => {
			const text = row.textContent.toLowerCase();
			row.style.display = text.includes(term) ? '' : 'none';
		});
	}

	function editServicoImpl(id){
		if (!hasState()) return;
		const servico = state.servicos.find(s => String(s.id) === String(id));
		if (!servico) return;
		state.currentEditId = id;
		const form = document.getElementById('servico-form');
		if (!form) return;
		form.nome.value = servico.nome;
		form.descricao.value = servico.descricao || '';
		const h = document.querySelector('#servico-modal h3');
		if (h) h.textContent = 'Editar Serviço';
		if (typeof openModal === 'function') openModal('servico-modal');
	}

	async function deleteServicoImpl(id){
		if (!hasState()) return;
		const ok = await showConfirm('Tem certeza que deseja excluir este serviço?', { title: 'Excluir serviço' });
		if (!ok) return;
		try {
			await api.del(`/api/v1/servicos/${id}`);
			state.servicos = state.servicos.filter(s => String(s.id) !== String(id));
			if (typeof saveToStorage === 'function') saveToStorage();
			renderServicosImpl();
		} catch (e) {
			showAlert('Não foi possível excluir no servidor.', { title: 'Erro' });
		}
	}

	if (window.renderServicos === Function.prototype || window.renderServicos.toString() === (function(){}).toString()) window.renderServicos = renderServicosImpl;
	if (window.filterServicos === Function.prototype || window.filterServicos.toString() === (function(){}).toString()) window.filterServicos = filterServicosImpl;
	if (window.editServico === Function.prototype || window.editServico.toString() === (function(){}).toString()) window.editServico = editServicoImpl;
	if (window.deleteServico === Function.prototype || window.deleteServico.toString() === (function(){}).toString()) window.deleteServico = deleteServicoImpl;
})();
