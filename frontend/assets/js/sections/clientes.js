// Section: Clientes
// Forward declarations to avoid ReferenceErrors if this script loads before app.js
window.renderClientes = window.renderClientes || function(){};
window.filterClientes = window.filterClientes || function(){};
window.editCliente = window.editCliente || function(){};
window.deleteCliente = window.deleteCliente || function(){};

(function(){
	// If app.js defined the functions already, don't override.
	if (window.__clientesSectionInitialized) return;
	window.__clientesSectionInitialized = true;

	// Bind only if available globals/state exist
	function hasState(){ return typeof state !== 'undefined' && state && Array.isArray(state.clientes); }

	async function renderClientesImpl(){
		if (!hasState()) return;
		const container = document.getElementById('clientes-list');
		if (!container) return;
		if (state.clientes.length === 0 && window.api) {
			try {
				const resp = await api.get('/api/v1/clientes');
				state.clientes = Array.isArray(resp.clientes) ? resp.clientes : [];
				if (typeof saveToStorage === 'function') saveToStorage();
			} catch {}
		}
		if (state.clientes.length === 0) {
			container.innerHTML = `
				<tr>
					<td colspan="5" class="empty-state">
						<i class="fas fa-users"></i>
						<h3>Nenhum cliente cadastrado</h3>
						<p>Clique em "Novo Cliente" para começar</p>
					</td>
				</tr>
			`;
			return;
		}
		container.innerHTML = state.clientes.map(cliente => `
			<tr>
				<td data-label="Nome">${cliente.nome}</td>
				<td data-label="Email">${cliente.email || '-'}</td>
				<td data-label="Telefone">${cliente.telefone || '-'}</td>
				<td data-label="Cidade">${cliente.cidade || '-'}</td>
				<td data-label="Ações">
					<div class="action-buttons">
						<button class="action-btn edit" onclick="editCliente('${cliente.id}')" title="Editar">
							<i class="fas fa-edit"></i>
						</button>
						<button class="action-btn delete" onclick="deleteCliente('${cliente.id}')" title="Excluir">
							<i class="fas fa-trash"></i>
						</button>
					</div>
				</td>
			</tr>
		`).join('');
	}

	function filterClientesImpl(){
		const input = document.getElementById('search-clientes');
		const rows = document.querySelectorAll('#clientes-list tr');
		if (!input || !rows.length) return;
		const term = input.value.toLowerCase();
		rows.forEach(row => {
			const text = row.textContent.toLowerCase();
			row.style.display = text.includes(term) ? '' : 'none';
		});
	}

	function editClienteImpl(id){
		if (!hasState()) return;
		const cliente = state.clientes.find(c => String(c.id) === String(id));
		if (!cliente) return;
		state.currentEditId = id;
		const form = document.getElementById('cliente-form');
		if (!form) return;
		form.nome.value = cliente.nome || '';
		form.email.value = cliente.email || '';
		form.telefone.value = cliente.telefone || '';
		form.documento.value = cliente.documento || '';
		
		// Separar endereco em endereco e numero
		const parsed = typeof parseEnderecoCompleto === 'function' 
			? parseEnderecoCompleto(cliente.endereco) 
			: { endereco: cliente.endereco || '', numero: '' };
		form.endereco.value = parsed.endereco;
		if (form.numero) form.numero.value = parsed.numero;
		
		form.cidade.value = cliente.cidade || '';
		form.cep.value = cliente.cep || '';
		const h = document.querySelector('#cliente-modal h3');
		if (h) h.textContent = 'Editar Cliente';
		if (typeof openModal === 'function') openModal('cliente-modal');
	}

	async function deleteClienteImpl(id){
		if (!hasState()) return;
		const ok = await showConfirm('Tem certeza que deseja excluir este cliente?', { title: 'Excluir cliente' });
		if (!ok) return;
		try {
			// Força exclusão em cascata por padrão para evitar 409 e limpar orçamentos vinculados
			await api.del(`/api/v1/clientes/${id}?force=1`);
			state.clientes = state.clientes.filter(c => String(c.id) !== String(id));
			if (typeof saveToStorage === 'function') saveToStorage();
			renderClientesImpl();
			if (typeof updateDashboard === 'function') updateDashboard();
		} catch (e) {
			const serverMsg = e && (e.data && e.data.error ? e.data.error : e.message);
			showAlert('Não foi possível excluir no servidor.' + (serverMsg ? `\n${serverMsg}` : ''), { title: 'Erro' });
		}
	}

	// Attach to window if not already provided
	if (window.renderClientes === Function.prototype || window.renderClientes.toString() === (function(){}).toString()) window.renderClientes = renderClientesImpl;
	if (window.filterClientes === Function.prototype || window.filterClientes.toString() === (function(){}).toString()) window.filterClientes = filterClientesImpl;
	if (window.editCliente === Function.prototype || window.editCliente.toString() === (function(){}).toString()) window.editCliente = editClienteImpl;
	if (window.deleteCliente === Function.prototype || window.deleteCliente.toString() === (function(){}).toString()) window.deleteCliente = deleteClienteImpl;
})();
