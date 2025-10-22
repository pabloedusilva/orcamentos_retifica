// Section: Peças
window.renderPecas = window.renderPecas || function(){};
window.editPeca = window.editPeca || function(){};
window.deletePeca = window.deletePeca || function(){};
window.filterPecas = window.filterPecas || function(){};

(function(){
	if (window.__pecasSectionInitialized) return;
	window.__pecasSectionInitialized = true;

	function hasState(){ return typeof state !== 'undefined' && state && Array.isArray(state.pecas); }

	function renderPecasImpl(){
		if (!hasState()) return;
		const container = document.getElementById('pecas-list');
		if (!container) return;
		if (state.pecas.length === 0) {
			container.innerHTML = `
				<tr>
					<td colspan="3" class="empty-state">
						<i class="fas fa-wrench"></i>
						<h3>Nenhuma peça cadastrada</h3>
						<p>Clique em "Nova Peça" para começar</p>
					</td>
				</tr>
			`;
			return;
		}
		container.innerHTML = state.pecas.map(peca => `
			<tr>
				<td data-label="Nome">${peca.nome}</td>
				<td data-label="Descrição">${peca.descricao || '-'}</td>
				<td data-label="Ações">
					<div class="action-buttons">
						<button class="action-btn edit" onclick="editPeca('${peca.id}')" title="Editar">
							<i class="fas fa-edit"></i>
						</button>
						<button class="action-btn delete" onclick="deletePeca('${peca.id}')" title="Excluir">
							<i class="fas fa-trash"></i>
						</button>
					</div>
				</td>
			</tr>
		`).join('');
	}

	function filterPecasImpl(){
		const input = document.getElementById('search-pecas');
		const rows = document.querySelectorAll('#pecas-list tr');
		if (!input || !rows.length) return;
		const term = input.value.toLowerCase();
		rows.forEach(row => {
			const text = row.textContent.toLowerCase();
			row.style.display = text.includes(term) ? '' : 'none';
		});
	}

	function editPecaImpl(id){
		if (!hasState()) return;
		const peca = state.pecas.find(p => String(p.id) === String(id));
		if (!peca) return;
		state.currentEditId = id;
		const form = document.getElementById('peca-form');
		if (!form) return;
		form.nome.value = peca.nome;
		form.descricao.value = peca.descricao || '';
		const h = document.querySelector('#peca-modal h3');
		if (h) h.textContent = 'Editar Peça';
		if (typeof openModal === 'function') openModal('peca-modal');
	}

	async function deletePecaImpl(id){
		if (!hasState()) return;
		const ok = await showConfirm('Tem certeza que deseja excluir esta peça?', { title: 'Excluir peça' });
		if (!ok) return;
		try {
			await api.del(`/api/v1/pecas/${id}`);
			state.pecas = state.pecas.filter(p => String(p.id) !== String(id));
			if (typeof saveToStorage === 'function') saveToStorage();
			renderPecasImpl();
		} catch (e) {
			showAlert('Não foi possível excluir no servidor.', { title: 'Erro' });
		}
	}

	if (window.renderPecas === Function.prototype || window.renderPecas.toString() === (function(){}).toString()) window.renderPecas = renderPecasImpl;
	if (window.filterPecas === Function.prototype || window.filterPecas.toString() === (function(){}).toString()) window.filterPecas = filterPecasImpl;
	if (window.editPeca === Function.prototype || window.editPeca.toString() === (function(){}).toString()) window.editPeca = editPecaImpl;
	if (window.deletePeca === Function.prototype || window.deletePeca.toString() === (function(){}).toString()) window.deletePeca = deletePecaImpl;
})();
