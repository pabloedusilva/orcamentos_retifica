// Estado global da aplicação
let state = {
    clientes: [],
    pecas: [],
    servicos: [],
    orcamentos: [],
    currentEditId: null,
    // controle de sequência diária de IDs de orçamentos (por chave DDMMYYYY)
    lastIdByDate: {},
    // dispositivos conectados
    dispositivos: [
        // Exemplo inicial (pode ser limpo ao carregar do storage)
        { id: 'printer-1', nome: 'Impressora Térmica', tipo: 'Impressora', conectado: false, padrao: false },
    ],
    dispositivoPadraoId: null
};

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    loadFromStorage();
    setupEventListeners();
    updateDashboard();
    renderAllLists();
    renderDispositivos();
    updateDeviceBadge();
    
    // Configurar data atual e validade (1 ano) no formulário de orçamento
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dateInput = document.querySelector('#orcamento-form input[name="data"]');
    const endDateInput = document.querySelector('#orcamento-form input[name="dataFinal"]');
    if (dateInput) {
        dateInput.value = todayStr;
        // Atualiza validade
        const end = new Date(today);
        end.setFullYear(end.getFullYear() + 1);
        if (endDateInput) endDateInput.value = end.toISOString().split('T')[0];
        // Recalcula validade ao alterar data
        dateInput.addEventListener('change', () => {
            const base = dateInput.value ? new Date(dateInput.value + 'T00:00:00') : new Date();
            base.setHours(0,0,0,0);
            const end2 = new Date(base);
            end2.setFullYear(end2.getFullYear() + 1);
            if (endDateInput) endDateInput.value = end2.toISOString().split('T')[0];
        });
    }

    // Recalcular totais ao alterar desconto
    const discountTypeSelect = document.querySelector('#orcamento-form select[name="discountType"]');
    const discountValueInput = document.querySelector('#orcamento-form input[name="discountValue"]');
    if (discountTypeSelect && discountValueInput) {
        const recalc = () => updateOrcamentoTotal();
        discountTypeSelect.addEventListener('change', recalc);
        discountValueInput.addEventListener('input', recalc);
    }

    // Definir saudação com nome do usuário (padrão: Admin)
    const usernameEl = document.getElementById('current-username');
    if (usernameEl) {
        const savedUser = localStorage.getItem('ret_user_name') || 'Admin';
        usernameEl.textContent = savedUser;
    }
});

// Utilitário: garantir que o mapa de sequência exista
function ensureLastIdMap() {
    if (!state.lastIdByDate) state.lastIdByDate = {};
}

// Gera um ID diário sequencial no formato DDMMYYYY-XX baseado na data atual
function generateOrcamentoId() {
    ensureLastIdMap();
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    const key = `${dd}${mm}${yyyy}`;
    const lastSeq = state.lastIdByDate[key] || 0;
    const nextSeq = lastSeq + 1;
    state.lastIdByDate[key] = nextSeq;
    saveToStorage();
    const seqStr = String(nextSeq).padStart(2, '0');
    return `${key}-${seqStr}`;
}

// Configurar event listeners
function setupEventListeners() {
    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.getAttribute('data-section');
            navigateToSection(section);
        });
    });

    // Botão novo orçamento no header
    document.getElementById('novo-orcamento').addEventListener('click', () => {
        openModal('orcamento-modal');
    });

    // Toggle da sidebar em mobile
    const toggleBtn = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            const willOpen = !sidebar.classList.contains('open');
            sidebar.classList.toggle('open', willOpen);
            document.body.classList.toggle('sidebar-open', willOpen);
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
        });
    }

    // Logout minimalista (apenas exemplo: limpa nome salvo)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('ret_user_name');
            const usernameEl = document.getElementById('current-username');
            if (usernameEl) usernameEl.textContent = 'Admin';
            alert('Você saiu.');
        });
    }

    // Forms
    document.getElementById('cliente-form').addEventListener('submit', handleClienteSubmit);
    document.getElementById('peca-form').addEventListener('submit', handlePecaSubmit);
    document.getElementById('servico-form').addEventListener('submit', handleServicoSubmit);
    document.getElementById('orcamento-form').addEventListener('submit', handleOrcamentoSubmit);

    // Filtros de busca
    document.getElementById('search-orcamentos')?.addEventListener('input', filterOrcamentos);
    document.getElementById('status-filter')?.addEventListener('change', filterOrcamentos);
    document.getElementById('search-clientes')?.addEventListener('input', filterClientes);
    document.getElementById('search-pecas')?.addEventListener('input', filterPecas);
    document.getElementById('search-servicos')?.addEventListener('input', filterServicos);

    // Dispositivos
    document.getElementById('scan-devices-btn')?.addEventListener('click', scanDispositivos);
    document.getElementById('device-status-badge')?.addEventListener('click', () => navigateToSection('dispositivos'));

    // Fechar modal ao clicar fora
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });

    // Fechar sidebar ao clicar em um item (em telas pequenas)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sb = document.querySelector('.sidebar');
            if (sb && window.innerWidth <= 768) sb.classList.remove('open');
        });
    });
}

// Navegação entre seções
function navigateToSection(sectionName) {
    // Atualizar navegação ativa
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    // Mostrar seção
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');

    // Atualizar título
    const titles = {
        dashboard: 'Dashboard',
        orcamentos: 'Orçamentos',
        clientes: 'Clientes',
        pecas: 'Peças',
        servicos: 'Serviços'
    };

    const subtitles = {
        dashboard: 'Visão geral do seu negócio',
        orcamentos: 'Gerencie todos os orçamentos',
        clientes: 'Cadastro de clientes',
        pecas: 'Catálogo de peças',
        servicos: 'Catálogo de serviços'
    };

    document.querySelector('.page-title').textContent = titles[sectionName];
    document.querySelector('.page-subtitle').textContent = subtitles[sectionName];
}

// Gerenciamento de modais
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Carregar dados específicos para orçamento
    if (modalId === 'orcamento-modal') {
        initClienteSearch();
        clearOrcamentoItems();
        // garantir data inicial e validade preenchidas
        const form = document.getElementById('orcamento-form');
        const dateInput = form?.querySelector('input[name="data"]');
        const endDateInput = form?.querySelector('input[name="dataFinal"]');
        if (dateInput) {
            if (!dateInput.value) {
                const todayStr = new Date().toISOString().split('T')[0];
                dateInput.value = todayStr;
            }
            const base = new Date(dateInput.value + 'T00:00:00');
            const end = new Date(base);
            end.setFullYear(end.getFullYear() + 1);
            if (endDateInput && !endDateInput.value) {
                endDateInput.value = end.toISOString().split('T')[0];
            }
        }
        // If sidebar is open on mobile, close it to avoid covering the modal
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
            if (overlay) overlay.style.opacity = '0';
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Limpar formulário
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
    }

    // Reset edit state
    state.currentEditId = null;
}

// Carregar clientes no select do orçamento
// Inicializa busca de clientes no modal de orçamento
function initClienteSearch() {
    const form = document.getElementById('orcamento-form');
    const inputSearch = form.querySelector('input[name="clienteBusca"]');
    const inputHidden = form.querySelector('input[name="cliente"]');
    const box = form.querySelector('.client-suggestions');

    if (!inputSearch || !inputHidden || !box) return;

    const render = (list) => {
        if (!list || list.length === 0) {
            box.innerHTML = '<div class="client-suggestion-item"><span class="client-suggestion-meta">Nenhum cliente encontrado</span></div>';
            box.classList.add('active');
            return;
        }
        box.innerHTML = list.map(c => `
            <div class="client-suggestion-item" data-id="${c.id}">
                <span class="client-suggestion-name">${c.nome}</span>
                <span class="client-suggestion-meta">${c.email || 'Sem email'} · ${c.telefone || 'Sem telefone'}</span>
            </div>
        `).join('');
        box.classList.add('active');
    };

    const filter = (term) => {
        const t = term.trim().toLowerCase();
        if (!t) {
            box.classList.remove('active');
            box.innerHTML = '';
            return;
        }
        const list = state.clientes.filter(c => (
            (c.nome || '').toLowerCase().includes(t) ||
            (c.email || '').toLowerCase().includes(t) ||
            (c.telefone || '').toLowerCase().includes(t) ||
            (c.documento || '').toLowerCase().includes(t)
        ));
        render(list);
    };

    // Event: typing
    inputSearch.addEventListener('input', () => {
        inputHidden.value = '';
        filter(inputSearch.value);
    });

    // Event: focus shows recent/all (limited)
    inputSearch.addEventListener('focus', () => {
        if (inputSearch.value.trim() === '') {
            render(state.clientes.slice(0, 10));
        }
    });

    // Event: click suggestion
    box.addEventListener('click', (e) => {
        const item = e.target.closest('.client-suggestion-item');
        if (!item) return;
        const id = parseInt(item.getAttribute('data-id'));
        const cliente = state.clientes.find(c => c.id === id);
        if (!cliente) return;
        inputHidden.value = String(cliente.id);
        inputSearch.value = cliente.nome;
        box.classList.remove('active');
        box.innerHTML = '';
    });

    // Event: blur closes (slight delay to allow click)
    inputSearch.addEventListener('blur', () => {
        setTimeout(() => {
            box.classList.remove('active');
        }, 150);
    });

    // Prefill on edit
    if (state.currentEditId) {
        const orc = state.orcamentos.find(o => o.id === state.currentEditId);
        const cliente = state.clientes.find(c => c.id === orc?.clienteId);
        if (cliente) {
            inputHidden.value = String(cliente.id);
            inputSearch.value = cliente.nome;
        }
    } else {
        inputHidden.value = '';
        inputSearch.value = '';
    }
}

// Handlers dos formulários
function handleClienteSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const cliente = {
        id: state.currentEditId || Date.now(),
        nome: formData.get('nome'),
        email: formData.get('email'),
        telefone: formData.get('telefone'),
        documento: formData.get('documento'),
        endereco: formData.get('endereco'),
        cidade: formData.get('cidade')
    };

    if (state.currentEditId) {
        const index = state.clientes.findIndex(c => c.id === state.currentEditId);
        state.clientes[index] = cliente;
    } else {
        state.clientes.push(cliente);
    }

    saveToStorage();
    renderClientes();
    updateDashboard();
    closeModal('cliente-modal');
}

function handlePecaSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const peca = {
        id: state.currentEditId || Date.now(),
        nome: formData.get('nome'),
        descricao: formData.get('descricao')
    };

    if (state.currentEditId) {
        const index = state.pecas.findIndex(p => p.id === state.currentEditId);
        state.pecas[index] = peca;
    } else {
        state.pecas.push(peca);
    }

    saveToStorage();
    renderPecas();
    closeModal('peca-modal');
}

function handleServicoSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const servico = {
        id: state.currentEditId || Date.now(),
        nome: formData.get('nome'),
        descricao: formData.get('descricao')
    };

    if (state.currentEditId) {
        const index = state.servicos.findIndex(s => s.id === state.currentEditId);
        state.servicos[index] = servico;
    } else {
        state.servicos.push(servico);
    }

    saveToStorage();
    renderServicos();
    closeModal('servico-modal');
}

function handleOrcamentoSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const items = collectOrcamentoItems();
    if (items.length === 0) {
        alert('Adicione pelo menos um item ao orçamento');
        return;
    }
    const subtotal = items.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    const total = subtotal;
    // Validação: cliente selecionado
    const clienteIdRaw = formData.get('cliente');
    if (!clienteIdRaw) {
        alert('Selecione um cliente na busca');
        return;
    }
    const orcamento = {
        id: state.currentEditId || generateOrcamentoId(),
        clienteId: parseInt(clienteIdRaw),
        data: formData.get('data'),
        dataFinal: formData.get('dataFinal') || '',
        observacao: (formData.get('observacao') || '').toString().trim(),
        items: items,
        subtotal: subtotal,
        total: total,
        status: 'pendente'
    };
    if (state.currentEditId) {
        const index = state.orcamentos.findIndex(o => String(o.id) === String(state.currentEditId));
        state.orcamentos[index] = orcamento;
    } else {
        state.orcamentos.push(orcamento);
    }
    saveToStorage();
    renderOrcamentos();
    updateDashboard();
    closeModal('orcamento-modal');
}

// Gerenciamento dos itens do orçamento
function addOrcamentoItem(tipo) {
    const container = document.getElementById('orcamento-items-list');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'orcamento-item';
    
    let options = '';
    const items = tipo === 'peca' ? state.pecas : state.servicos;
    items.forEach(item => {
        const label = item.nome;
        options += `<option value="${item.id}">${label}</option>`;
    });

    itemDiv.innerHTML = `
        <select class="item-select" data-tipo="${tipo}">
            <option value="">Selecione ${tipo === 'peca' ? 'uma peça' : 'um serviço'}</option>
            ${options}
        </select>
        <input type="number" class="item-quantidade" placeholder="Qtd" value="1" min="1">
        <input type="number" class="item-preco" placeholder="Preço" step="0.01">
        <div class="item-subtotal">R$ 0,00</div>
        <button type="button" class="remove-item" onclick="removeOrcamentoItem(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;

    container.appendChild(itemDiv);

    const select = itemDiv.querySelector('.item-select');
    const quantidade = itemDiv.querySelector('.item-quantidade');
    const precoInput = itemDiv.querySelector('.item-preco');
    const subtotal = itemDiv.querySelector('.item-subtotal');

    // Ao mudar o item, não há preço fixo no catálogo; mantenha o preço manual inserido
    select.addEventListener('change', function() {
        updateSubtotal();
    });

    quantidade.addEventListener('input', updateSubtotal);
    precoInput.addEventListener('input', updateSubtotal);

    function updateSubtotal() {
        const qty = parseInt(quantidade.value) || 0;
        const price = parseFloat(precoInput.value) || 0;
        const sub = qty * price;
        subtotal.textContent = `R$ ${sub.toFixed(2).replace('.', ',')}`;
        updateOrcamentoTotal();
    }

    updateOrcamentoTotal();
}

function removeOrcamentoItem(button) {
    button.closest('.orcamento-item').remove();
    updateOrcamentoTotal();
}

function collectOrcamentoItems() {
    const items = [];
    document.querySelectorAll('.orcamento-item').forEach(itemDiv => {
        const select = itemDiv.querySelector('.item-select');
        const quantidade = parseInt(itemDiv.querySelector('.item-quantidade').value) || 0;
        const preco = parseFloat(itemDiv.querySelector('.item-preco').value) || 0;
        const tipo = select.getAttribute('data-tipo');

        if (select.value && quantidade > 0) {
            const itemData = (tipo === 'peca' ? state.pecas : state.servicos).find(i => i.id == select.value);
            items.push({
                tipo: tipo,
                itemId: parseInt(select.value),
                nome: itemData.nome,
                quantidade: quantidade,
                preco: preco
            });
        }
    });
    return items;
}

function updateOrcamentoTotal() {
    let total = 0;
    document.querySelectorAll('.orcamento-item').forEach(itemDiv => {
        const quantidade = parseInt(itemDiv.querySelector('.item-quantidade').value) || 0;
        const preco = parseFloat(itemDiv.querySelector('.item-preco').value) || 0;
        total += quantidade * preco;
    });
    const subtotalEl = document.getElementById('orcamento-subtotal');
    if (subtotalEl) subtotalEl.textContent = total.toFixed(2).replace('.', ',');
    const totalEl = document.getElementById('orcamento-total');
    if (totalEl) totalEl.textContent = total.toFixed(2).replace('.', ',');
}

function clearOrcamentoItems() {
    document.getElementById('orcamento-items-list').innerHTML = '';
    updateOrcamentoTotal();
}

// Funções de renderização
function renderClientes() {
    const container = document.getElementById('clientes-list');
    
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
            <td data-label="Email">${cliente.email}</td>
            <td data-label="Telefone">${cliente.telefone}</td>
            <td data-label="Cidade">${cliente.cidade || '-'}</td>
            <td data-label="Ações">
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editCliente(${cliente.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteCliente(${cliente.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderPecas() {
    const container = document.getElementById('pecas-list');
    
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
                    <button class="action-btn edit" onclick="editPeca(${peca.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deletePeca(${peca.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderServicos() {
    const container = document.getElementById('servicos-list');
    
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
                    <button class="action-btn edit" onclick="editServico(${servico.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteServico(${servico.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderOrcamentos() {
    const container = document.getElementById('orcamentos-list');
    const recentContainer = document.getElementById('recent-orcamentos-list');
    
    if (state.orcamentos.length === 0) {
        const emptyRow = `
            <tr>
                <td colspan="6" class="empty-state">
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
        const cliente = state.clientes.find(c => c.id === orcamento.clienteId);
        const clienteNome = cliente ? cliente.nome : 'Cliente não encontrado';
        
        return `
            <tr>
                <td data-label="ID">#${orcamento.id}</td>
                <td data-label="Cliente">${clienteNome}</td>
                <td data-label="Data">${formatDate(orcamento.data)}</td>
                <td data-label="Valor">R$ ${orcamento.total.toFixed(2).replace('.', ',')}</td>
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
            </tr>
        `;
    };

    // Renderizar todos os orçamentos
    container.innerHTML = state.orcamentos.map(renderRow).join('');
    
    // Renderizar orçamentos recentes (últimos 5)
    const recent = state.orcamentos
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 5);
    recentContainer.innerHTML = recent.map(renderRow).join('');
}

function renderAllLists() {
    renderClientes();
    renderPecas();
    renderServicos();
    renderOrcamentos();
    renderDispositivos();
}

// Dispositivos
function renderDispositivos() {
    const tbody = document.getElementById('dispositivos-list');
    if (!tbody) return;
    if (!state.dispositivos || state.dispositivos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-print"></i>
                    <h3>Nenhum dispositivo</h3>
                    <p>Clique em "Atualizar" para buscar dispositivos</p>
                </td>
            </tr>
        `;
        return;
    }
    tbody.innerHTML = state.dispositivos.map(d => `
        <tr>
            <td data-label="Nome">${d.nome}</td>
            <td data-label="Tipo">${d.tipo}</td>
            <td data-label="Status">${state.dispositivoPadraoId === d.id ? '<span class="status-badge status-aprovado">Conectado</span>' : '<span class="status-badge status-rejeitado">Desconectado</span>'}</td>
            <td data-label="Padrão">${state.dispositivoPadraoId === d.id ? 'Sim' : 'Não'}</td>
            <td data-label="Ações">
                <div class="action-buttons">
                    <button class="action-btn default-btn ${state.dispositivoPadraoId === d.id ? 'is-active' : ''}" title="Tornar padrão" onclick="setDispositivoPadrao('${d.id}')">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="action-btn" title="Testar impressão" onclick="testarDispositivo('${d.id}')">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="action-btn edit" title="Editar" onclick="editDispositivo('${d.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" title="Excluir" onclick="deleteDispositivo('${d.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function scanDispositivos() {
    // Simulação: alterna estado de conexão para exemplo
    const badge = document.getElementById('device-status-badge');
    if (badge) badge.classList.add('loading');
    state.dispositivos = state.dispositivos.map((d, idx) => ({
        ...d,
        conectado: idx % 2 === 0 ? true : d.conectado
    }));
    // Se não houver padrão e existir algum conectado, define o primeiro conectado como padrão
    if (!state.dispositivoPadraoId) {
        const first = state.dispositivos.find(d => d.conectado);
        if (first) state.dispositivoPadraoId = first.id;
    }
    saveToStorage();
    renderDispositivos();
    updateDeviceBadge();
    if (badge) badge.classList.remove('loading');
}

function setDispositivoPadrao(id) {
    state.dispositivoPadraoId = id;
    // Apenas o padrão deve estar conectado
    state.dispositivos = state.dispositivos.map(d => ({ ...d, conectado: d.id === id }));
    saveToStorage();
    renderDispositivos();
    updateDeviceBadge();
}

function testarDispositivo(id) {
    const d = state.dispositivos.find(x => x.id === id);
    if (!d) return alert('Dispositivo não encontrado');
    if (!d.conectado) return alert('Dispositivo desconectado');
    alert(`Teste enviado para ${d.nome}`);
}

// Dispositivos: Editar / Excluir
function editDispositivo(id) {
    const d = state.dispositivos.find(x => x.id === id);
    if (!d) return alert('Dispositivo não encontrado');
    state.currentEditId = id;
    const form = document.getElementById('dispositivo-form');
    if (!form) return;
    form.nome.value = d.nome || '';
    document.querySelector('#device-edit-modal h3').textContent = 'Editar Dispositivo';
    openModal('device-edit-modal');
}

function handleDispositivoSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const nome = form.nome.value.trim();
    if (!nome) return;
    if (state.currentEditId) {
        const idx = state.dispositivos.findIndex(d => d.id === state.currentEditId);
        if (idx !== -1) {
            state.dispositivos[idx] = { ...state.dispositivos[idx], nome };
        }
    }
    saveToStorage();
    renderDispositivos();
    updateDeviceBadge();
    closeModal('device-edit-modal');
}

function deleteDispositivo(id) {
    if (!confirm('Excluir este dispositivo?')) return;
    state.dispositivos = state.dispositivos.filter(d => d.id !== id);
    if (state.dispositivoPadraoId === id) state.dispositivoPadraoId = null;
    saveToStorage();
    renderDispositivos();
    updateDeviceBadge();
}

// Scan Bluetooth (simulado)
function startBluetoothScan() {
    const status = document.getElementById('scan-status');
    const loading = document.getElementById('scan-loading');
    const results = document.getElementById('scan-results');
    if (!status || !loading || !results) return;
    results.innerHTML = '';
    status.textContent = 'Buscando dispositivos próximos...';
    status.classList.remove('muted');
    loading.style.display = 'flex';
    // Simulação com animação e resultados
    const fakePool = [
        { id: 'bt-01', nome: 'Thermal BT-01', tipo: 'Impressora' },
        { id: 'bt-03', nome: 'LabelMaker 3', tipo: 'Impressora' },
        { id: 'bt-04', nome: 'POS Printer X', tipo: 'Impressora' }
    ];
    setTimeout(() => {
        loading.style.display = 'none';
        status.textContent = 'Selecione um dispositivo para conectar';
        const listHtml = fakePool.map(d => `
            <div class="scan-item">
                <div class="scan-item-info">
                    <i class="fas fa-print scan-icon"></i>
                    <div>
                        <div class="scan-name">${d.nome}</div>
                        <div class="scan-meta">${d.tipo} • Bluetooth</div>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="connectScannedDevice('${d.id}')">Conectar</button>
            </div>
        `).join('');
        results.innerHTML = listHtml;
        results.dataset.raw = JSON.stringify(fakePool);
    }, 1400);
}

function connectScannedDevice(fakeId) {
    // Mapear fakeId para objeto simulado
    const map = {
        'bt-01': { nome: 'Thermal BT-01', tipo: 'Impressora' },
        'bt-03': { nome: 'LabelMaker 3', tipo: 'Impressora' },
        'bt-04': { nome: 'POS Printer X', tipo: 'Impressora' }
    };
    const found = map[fakeId];
    if (!found) return;
    const newId = `${fakeId}-${Date.now()}`;
    state.dispositivos.push({ id: newId, nome: found.nome, tipo: found.tipo, conectado: true });
    if (!state.dispositivoPadraoId) state.dispositivoPadraoId = newId;
    saveToStorage();
    renderDispositivos();
    updateDeviceBadge();
    // feedback visual
    const status = document.getElementById('scan-status');
    if (status) status.textContent = `${found.nome} conectado.`;
}

function filterScanResults(query) {
    const results = document.getElementById('scan-results');
    if (!results) return;
    const raw = results.dataset.raw ? JSON.parse(results.dataset.raw) : [];
    const q = (query || '').toLowerCase();
    const filtered = raw.filter(d => d.nome.toLowerCase().includes(q));
    results.innerHTML = filtered.map(d => `
        <div class="scan-item">
            <div class="scan-item-info">
                <i class="fas fa-print scan-icon"></i>
                <div>
                    <div class="scan-name">${d.nome}</div>
                    <div class="scan-meta">${d.tipo} • Bluetooth</div>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="connectScannedDevice('${d.id}')">Conectar</button>
        </div>
    `).join('');
}

function updateDeviceBadge() {
    const badge = document.getElementById('device-status-badge');
    if (!badge) return;
    const d = state.dispositivos.find(x => x.id === state.dispositivoPadraoId);
    if (d) {
        const typeClass = (d.tipo || '').toLowerCase().includes('impressora') ? 'printer' : ((d.tipo || '').toLowerCase().includes('scanner') ? 'scanner' : 'default');
        badge.classList.remove('printer','scanner','default');
        badge.classList.add(typeClass);
        badge.innerHTML = `<span class="device-badge-text">${d.nome}<br><small>${d.conectado ? 'Conectado' : 'Desconectado'}</small></span><span class="device-badge-dot"></span>`;
        // Sempre considerar conectado o dispositivo padrão em uso
        badge.classList.add('connected');
        badge.classList.remove('disconnected');
    } else {
        badge.innerHTML = `<span class="device-badge-text">Nenhum dispositivo padrão<br><small>Desconectado</small></span><span class="device-badge-dot"></span>`;
        badge.classList.remove('connected');
        badge.classList.add('disconnected');
        badge.classList.remove('printer','scanner');
        badge.classList.add('default');
    }
}

// Funções de edição
function editCliente(id) {
    const cliente = state.clientes.find(c => c.id === id);
    if (!cliente) return;

    state.currentEditId = id;
    
    const form = document.getElementById('cliente-form');
    form.nome.value = cliente.nome;
    form.email.value = cliente.email;
    form.telefone.value = cliente.telefone;
    form.documento.value = cliente.documento || '';
    form.endereco.value = cliente.endereco || '';
    form.cidade.value = cliente.cidade || '';
    
    document.querySelector('#cliente-modal h3').textContent = 'Editar Cliente';
    openModal('cliente-modal');
}

function editPeca(id) {
    const peca = state.pecas.find(p => p.id === id);
    if (!peca) return;

    state.currentEditId = id;
    
    const form = document.getElementById('peca-form');
    form.nome.value = peca.nome;
    form.descricao.value = peca.descricao || '';
    // Campo de preço removido
    
    document.querySelector('#peca-modal h3').textContent = 'Editar Peça';
    openModal('peca-modal');
}

function editServico(id) {
    const servico = state.servicos.find(s => s.id === id);
    if (!servico) return;

    state.currentEditId = id;
    
    const form = document.getElementById('servico-form');
    form.nome.value = servico.nome;
    form.descricao.value = servico.descricao || '';
    // Campo de preço removido
    
    document.querySelector('#servico-modal h3').textContent = 'Editar Serviço';
    openModal('servico-modal');
}

function editOrcamento(id) {
    const orcamento = state.orcamentos.find(o => String(o.id) === String(id));
    if (!orcamento) return;

    state.currentEditId = id;
    
    const form = document.getElementById('orcamento-form');
    // Preencher cliente na busca
    const inputHidden = form.querySelector('input[name="cliente"]');
    const inputSearch = form.querySelector('input[name="clienteBusca"]');
    if (inputHidden && inputSearch) {
        inputHidden.value = String(orcamento.clienteId);
        const cliente = state.clientes.find(c => c.id === orcamento.clienteId);
        inputSearch.value = cliente ? cliente.nome : '';
    }
    form.data.value = orcamento.data;
    // Preencher validade se existir, senão calcular +1 ano
    const endDateInput = form.querySelector('input[name="dataFinal"]');
    if (endDateInput) {
        if (orcamento.dataFinal) {
            endDateInput.value = orcamento.dataFinal;
        } else if (orcamento.data) {
            const base = new Date(orcamento.data + 'T00:00:00');
            base.setFullYear(base.getFullYear() + 1);
            endDateInput.value = base.toISOString().split('T')[0];
        }
    }
    // Campos de desconto foram removidos
    // Observação
    const obs = form.querySelector('textarea[name="observacao"]');
    if (obs) obs.value = orcamento.observacao || '';
    
    document.querySelector('#orcamento-modal h3').textContent = 'Editar Orçamento';
    openModal('orcamento-modal');
    
    // Recriar itens do orçamento
    setTimeout(() => {
        orcamento.items.forEach(item => {
            addOrcamentoItem(item.tipo);
            const lastItem = document.querySelector('.orcamento-item:last-child');
            lastItem.querySelector('.item-select').value = item.itemId;
            lastItem.querySelector('.item-quantidade').value = item.quantidade;
            lastItem.querySelector('.item-preco').value = item.preco;
            
            // Trigger change events
            lastItem.querySelector('.item-select').dispatchEvent(new Event('change'));
            lastItem.querySelector('.item-quantidade').dispatchEvent(new Event('input'));
        });
        updateOrcamentoTotal();
    }, 100);
}

// Funções de exclusão
function deleteCliente(id) {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
        state.clientes = state.clientes.filter(c => c.id !== id);
        saveToStorage();
        renderClientes();
        updateDashboard();
    }
}

function deletePeca(id) {
    if (confirm('Tem certeza que deseja excluir esta peça?')) {
        state.pecas = state.pecas.filter(p => p.id !== id);
        saveToStorage();
        renderPecas();
    }
}

function deleteServico(id) {
    if (confirm('Tem certeza que deseja excluir este serviço?')) {
        state.servicos = state.servicos.filter(s => s.id !== id);
        saveToStorage();
        renderServicos();
    }
}

function deleteOrcamento(id) {
    if (confirm('Tem certeza que deseja excluir este orçamento?')) {
        state.orcamentos = state.orcamentos.filter(o => String(o.id) !== String(id));
        saveToStorage();
        renderOrcamentos();
        updateDashboard();
    }
}

// Função para visualizar orçamento
function viewOrcamento(id) {
    const orcamento = state.orcamentos.find(o => String(o.id) === String(id));
    if (!orcamento) return;

    const cliente = state.clientes.find(c => c.id === orcamento.clienteId);
    // Validar dataFinal para exibição
    const validadeIso = (function() {
        if (orcamento.dataFinal) return orcamento.dataFinal;
        const base = new Date(orcamento.data + 'T00:00:00');
        base.setFullYear(base.getFullYear() + 1);
        return base.toISOString().split('T')[0];
    })();
    const validadeFormatada = formatDate(validadeIso);
    
    let itemsHtml = orcamento.items.map(item => `
        <tr>
            <td data-label="Item">${item.nome}</td>
            <td data-label="Qtd">${item.quantidade}</td>
            <td data-label="Preço Unit.">R$ ${item.preco.toFixed(2).replace('.', ',')}</td>
            <td data-label="Subtotal">R$ ${(item.quantidade * item.preco).toFixed(2).replace('.', ',')}</td>
        </tr>
    `).join('');

    const modalHtml = `
        <div class="modal active" id="view-orcamento-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Orçamento #${orcamento.id}</h3>
                    <button class="modal-close" onclick="closeModal('view-orcamento-modal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="view-quote-body">
                    <!-- actions moved to print preview modal -->

                    <div class="view-quote-card">
                        <div class="view-quote-title">Cliente</div>
                        <div class="view-quote-grid">
                            <div class="meta-item"><span class="meta-label">Nome</span><span class="meta-value">${cliente ? cliente.nome : 'Cliente não encontrado'}</span></div>
                            <div class="meta-item"><span class="meta-label">Data</span><span class="meta-value">${formatDate(orcamento.data)}</span></div>
                            <div class="meta-item"><span class="meta-label">Validade</span><span class="meta-value">${validadeFormatada}</span></div>
                            <div class="meta-item"><span class="meta-label">Status</span><span class="meta-value"><span class="status-badge status-${orcamento.status}">${orcamento.status}</span></span></div>
                            <div class="meta-item"><span class="meta-label">E-mail</span><span class="meta-value">${cliente?.email || '-'}</span></div>
                            <div class="meta-item"><span class="meta-label">Telefone</span><span class="meta-value">${cliente?.telefone || '-'}</span></div>
                        </div>
                    </div>

                    <div class="view-quote-card">
                        <div class="view-quote-title">Itens</div>
                        <div class="table-container" style="margin-top:8px;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Qtd</th>
                                        <th>Preço Unit.</th>
                                        <th>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>
                        </div>
                        <div class="view-quote-total">
                            <div class="total-label">Total:</div>
                            <div class="total-value">R$ ${orcamento.total.toFixed(2).replace('.', ',')}</div>
                        </div>
                    </div>
                    ${orcamento.observacao ? `
                    <div class="view-quote-card">
                        <div class="view-quote-title">Observação</div>
                        <div class="view-quote-text">${(orcamento.observacao || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                    </div>` : ''}
                </div>
            </div>
        </div>
    `;

    // Remove modal anterior se existir
    const existingModal = document.getElementById('view-orcamento-modal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';
}

// Funções de filtro
function filterOrcamentos() {
    const searchTerm = document.getElementById('search-orcamentos').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    
    const rows = document.querySelectorAll('#orcamentos-list tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const status = row.querySelector('.status-badge')?.classList.contains(`status-${statusFilter}`) ?? true;
        
        const matchesSearch = text.includes(searchTerm);
        const matchesStatus = !statusFilter || status;
        
        row.style.display = matchesSearch && matchesStatus ? '' : 'none';
    });
}

function filterClientes() {
    const searchTerm = document.getElementById('search-clientes').value.toLowerCase();
    const rows = document.querySelectorAll('#clientes-list tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function filterPecas() {
    const searchTerm = document.getElementById('search-pecas').value.toLowerCase();
    const rows = document.querySelectorAll('#pecas-list tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function filterServicos() {
    const searchTerm = document.getElementById('search-servicos').value.toLowerCase();
    const rows = document.querySelectorAll('#servicos-list tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Atualizar dashboard
function updateDashboard() {
    document.getElementById('total-orcamentos').textContent = state.orcamentos.length;
    document.getElementById('total-clientes').textContent = state.clientes.length;
    
    const valorTotal = state.orcamentos.reduce((sum, o) => sum + o.total, 0);
    document.getElementById('valor-total').textContent = `R$ ${valorTotal.toFixed(2).replace('.', ',')}`;
}

// Funções de storage
function saveToStorage() {
    localStorage.setItem('retifficaApp', JSON.stringify(state));
}

function loadFromStorage() {
    const stored = localStorage.getItem('retifficaApp');
    if (stored) {
        state = { ...state, ...JSON.parse(stored) };
        if (!state.lastIdByDate) state.lastIdByDate = {};
        if (!state.dispositivos) state.dispositivos = [];
        if (!state.dispositivoPadraoId) state.dispositivoPadraoId = null;
    }
}

// Funções utilitárias
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Dados de exemplo para demonstração
function loadSampleData() {
    if (state.clientes.length === 0) {
        state.clientes = [
            {
                id: 1,
                nome: 'João Silva',
                email: 'joao@email.com',
                telefone: '(11) 99999-9999',
                documento: '123.456.789-00',
                endereco: 'Rua das Flores, 123',
                cidade: 'São Paulo'
            },
            {
                id: 2,
                nome: 'Maria Santos',
                email: 'maria@email.com',
                telefone: '(11) 88888-8888',
                documento: '987.654.321-00',
                endereco: 'Av. Paulista, 456',
                cidade: 'São Paulo'
            }
        ];
    }

    if (state.pecas.length === 0) {
        state.pecas = [
            {
                id: 1,
                nome: 'Pistão',
                descricao: 'Pistão para motor 1.0'
            },
            {
                id: 2,
                nome: 'Biela',
                descricao: 'Biela forjada'
            }
        ];
    }

    if (state.servicos.length === 0) {
        state.servicos = [
            {
                id: 1,
                nome: 'Retífica do Motor',
                descricao: 'Retífica completa do bloco do motor'
            },
            {
                id: 2,
                nome: 'Balanceamento',
                descricao: 'Balanceamento do virabrequim'
            }
        ];
    }

    if (state.orcamentos.length === 0) {
        state.orcamentos = [
            {
                id: 1001,
                clienteId: 1,
                data: '2025-09-24',
                items: [
                    {
                        tipo: 'peca',
                        itemId: 1,
                        nome: 'Pistão',
                        quantidade: 4,
                        preco: 150.00
                    },
                    {
                        tipo: 'servico',
                        itemId: 1,
                        nome: 'Retífica do Motor',
                        quantidade: 1,
                        preco: 800.00
                    }
                ],
                total: 1400.00,
                status: 'pendente'
            },
            {
                id: 1002,
                clienteId: 2,
                data: '2025-09-23',
                items: [
                    {
                        tipo: 'peca',
                        itemId: 2,
                        nome: 'Biela',
                        quantidade: 2,
                        preco: 250.00
                    },
                    {
                        tipo: 'servico',
                        itemId: 2,
                        nome: 'Balanceamento',
                        quantidade: 1,
                        preco: 200.00
                    }
                ],
                total: 700.00,
                status: 'aprovado'
            }
        ];
    }

    if (!state.dispositivos || state.dispositivos.length === 0) {
        state.dispositivos = [
            { id: 'printer-1', nome: 'Impressora Térmica', tipo: 'Impressora', conectado: true, padrao: true },
            { id: 'printer-2', nome: 'PDF Virtual', tipo: 'Impressora', conectado: true, padrao: false },
            { id: 'scanner-1', nome: 'Scanner USB', tipo: 'Scanner', conectado: false, padrao: false }
        ];
        state.dispositivoPadraoId = 'printer-1';
    }

    saveToStorage();
}

// Função para imprimir orçamento
function printOrcamento(id) {
    const orcamento = state.orcamentos.find(o => String(o.id) === String(id));
    if (!orcamento) {
        alert('Orçamento não encontrado');
        return;
    }

    const cliente = state.clientes.find(c => c.id === orcamento.clienteId);
    
    // Gerar HTML de pré-visualização
    const previewHtml = generateOrcamentoPreview(orcamento, cliente);
    
    // Inserir no modal
    document.getElementById('orcamento-preview-content').innerHTML = previewHtml;
    
    // Abrir modal de pré-visualização
    openModal('print-preview-modal');
}

// Share buttons in print preview modal
function getPreviewOrcamentoId() {
    const doc = document.querySelector('.orcamento-document .orcamento-number');
    if (!doc) return null;
    const text = doc.textContent || '';
    // Expect "Orçamento #<id>"
    const match = text.match(/#([\w-]+)/);
    return match ? match[1] : null;
}

function buildOrcamentoText(orcamento) {
    const cliente = state.clientes.find(c => c.id === orcamento.clienteId);
    const validadeIso = orcamento.dataFinal || (() => {
        const d = new Date(orcamento.data + 'T00:00:00');
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().split('T')[0];
    })();
    const linhas = [];
    linhas.push(`Orçamento #${orcamento.id}`);
    linhas.push(`Cliente: ${cliente ? cliente.nome : 'N/I'}`);
    linhas.push(`Data: ${formatDate(orcamento.data)}`);
    linhas.push(`Validade: ${formatDate(validadeIso)}`);
    linhas.push('');
    linhas.push('Itens:');
    orcamento.items.forEach(i => {
        const sub = (i.quantidade * i.preco).toFixed(2).replace('.', ',');
        linhas.push(`- ${i.nome} | Qtd: ${i.quantidade} | Unit: R$ ${i.preco.toFixed(2).replace('.', ',')} | Sub: R$ ${sub}`);
    });
    linhas.push('');
    if (orcamento.observacao) {
        linhas.push('Observação:');
        linhas.push(orcamento.observacao);
        linhas.push('');
    }
    linhas.push(`Total: R$ ${orcamento.total.toFixed(2).replace('.', ',')}`);
    return linhas.join('\n');
}

function sendOrcamentoEmailFromPreview() {
    const id = getPreviewOrcamentoId();
    if (!id) return;
    const orcamento = state.orcamentos.find(o => String(o.id) === String(id));
    if (!orcamento) return;
    const cliente = state.clientes.find(c => c.id === orcamento.clienteId);
    const subject = encodeURIComponent(`Orçamento #${orcamento.id} - Retífica`);
    const body = encodeURIComponent(buildOrcamentoText(orcamento));
    const to = cliente?.email ? encodeURIComponent(cliente.email) : '';
    const href = `mailto:${to}?subject=${subject}&body=${body}`;
    window.location.href = href;
}

function sendOrcamentoWhatsAppFromPreview() {
    const id = getPreviewOrcamentoId();
    if (!id) return;
    const orcamento = state.orcamentos.find(o => String(o.id) === String(id));
    if (!orcamento) return;
    const cliente = state.clientes.find(c => c.id === orcamento.clienteId);
    const text = encodeURIComponent(buildOrcamentoText(orcamento));
    const rawPhone = (cliente?.telefone || '').replace(/\D/g, '');
    const base = 'https://wa.me/';
    const url = rawPhone ? `${base}${rawPhone}?text=${text}` : `${base}?text=${text}`;
    window.open(url, '_blank');
}

// Helpers removidos da visualização; ações serão oferecidas no modal de pré-visualização

// Gerar HTML da pré-visualização do orçamento
function generateOrcamentoPreview(orcamento, cliente) {
    const hoje = new Date();
    const dataFormatada = formatDate(orcamento.data);
    // Determinar validade: usar dataFinal se existir, senão calcular +1 ano
    const validadeIso = (function() {
        if (orcamento.dataFinal) return orcamento.dataFinal;
        const base = new Date(orcamento.data + 'T00:00:00');
        base.setFullYear(base.getFullYear() + 1);
        return base.toISOString().split('T')[0];
    })();
    const validadeFormatada = formatDate(validadeIso);
    const dataEmissao = hoje.toLocaleDateString('pt-BR');
    const horaEmissao = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const statusClass = `status-${orcamento.status}-print`;
    const statusText = orcamento.status.charAt(0).toUpperCase() + orcamento.status.slice(1);

    // Informações do cliente com valores padrão
    const clienteInfo = cliente ? {
        nome: cliente.nome,
        email: cliente.email || 'Não informado',
        telefone: cliente.telefone || 'Não informado',
        documento: cliente.documento || 'Não informado',
        endereco: cliente.endereco || 'Não informado',
        cidade: cliente.cidade || 'Não informado'
    } : {
        nome: 'Cliente não encontrado',
        email: 'N/A',
        telefone: 'N/A',
        documento: 'N/A',
        endereco: 'N/A',
        cidade: 'N/A'
    };

    // Gerar linhas dos itens de forma mais compacta
    let itemsHtml = '';
    let subtotal = 0;

    orcamento.items.forEach((item, index) => {
        const itemSubtotal = item.quantidade * item.preco;
        subtotal += itemSubtotal;

        itemsHtml += `
            <tr>
                <td>
                    <div class="item-description">
                        <div class="item-name">${item.nome}</div>
                        <span class="item-tipo tipo-${item.tipo}">${item.tipo.toUpperCase()}</span>
                    </div>
                </td>
                <td class="text-center">${item.quantidade}</td>
                <td class="text-right font-mono">R$ ${item.preco.toFixed(2).replace('.', ',')}</td>
                <td class="text-right font-mono">R$ ${itemSubtotal.toFixed(2).replace('.', ',')}</td>
            </tr>
        `;
    });

    // Veículo removido do layout

    // Desconto removido

    return `
        <div class="orcamento-document">
            <!-- Cabeçalho Minimalista -->
            <div class="orcamento-header">
                <div class="company-info">
                    <h1><i class="fas fa-cog"></i>Retífica</h1>
                    <div class="company-subtitle">Retífica e Usinagem</div>
                    <div class="company-contact">
                        <div class="contact-row">Rua das Oficinas, 123 - Centro - São Paulo/SP</div>
                        <div class="contact-row">Telefone: (11) 3456-7890 | Email: contato@retificapro.com.br</div>
                        <div class="contact-row">CNPJ: 12.345.678/0001-90 | CEP: 01234-567</div>
                    </div>
                </div>
                <div class="orcamento-info">
                    <div class="orcamento-number">Orçamento #${orcamento.id}</div>
                    <div class="orcamento-details">
                        <div class="detail-row">
                            <span class="detail-label">Data:</span>
                            <span class="detail-value">${dataFormatada}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Emissão:</span>
                            <span class="detail-value">${dataEmissao} ${horaEmissao}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Validade:</span>
                            <span class="detail-value">${validadeFormatada}</span>
                        </div>
                    </div>
                    <div class="orcamento-status ${statusClass}">${statusText}</div>
                </div>
            </div>

            <!-- Dados do Cliente Simplificados -->
            <div class="cliente-section">
                <h3 class="section-title">Cliente</h3>
                <div class="cliente-card">
                    <div class="cliente-name">${clienteInfo.nome}</div>
                    <div class="cliente-grid">
                        <div class="cliente-field">
                            <div class="field-label">E-mail</div>
                            <div class="field-value">${clienteInfo.email}</div>
                        </div>
                        <div class="cliente-field">
                            <div class="field-label">Telefone</div>
                            <div class="field-value">${clienteInfo.telefone}</div>
                        </div>
                        <div class="cliente-field">
                            <div class="field-label">Documento</div>
                            <div class="field-value">${clienteInfo.documento}</div>
                        </div>
                        <div class="cliente-field">
                            <div class="field-label">Endereço</div>
                            <div class="field-value">${clienteInfo.endereco}</div>
                        </div>
                        <div class="cliente-field">
                            <div class="field-label">Cidade</div>
                            <div class="field-value">${clienteInfo.cidade}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Itens do Orçamento Compacto -->
            <div class="itens-section">
                <h3 class="section-title">Itens</h3>
                <table class="itens-table">
                    <thead>
                        <tr>
                            <th>Descrição</th>
                            <th class="text-center">Qtd</th>
                            <th class="text-right">Unit.</th>
                            <th class="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <!-- Totais Simplificados -->
                <div class="totals-section">
                    <div class="totals-card">
                        <table class="totals-table">
                            <tr>
                                <td class="total-label">Subtotal:</td>
                                <td class="total-value font-mono">R$ ${(orcamento.subtotal || subtotal).toFixed(2).replace('.', ',')}</td>
                            </tr>
                            
                            <tr class="total-row">
                                <td class="total-label">TOTAL:</td>
                                <td class="total-value font-mono">R$ ${orcamento.total.toFixed(2).replace('.', ',')}</td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>

            ${orcamento.observacao ? `
            <div class="itens-section">
                <h3 class="section-title">Observação</h3>
                <div class="cliente-card" style="padding:16px;">
                    <div style="white-space:pre-wrap; color: var(--text-secondary);">${(orcamento.observacao || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                </div>
            </div>` : ''}

            <!-- Rodapé Minimalista -->
            <div class="orcamento-footer">
                <div class="footer-notes">
                    <h4>Condições</h4>
                    <ul>
                        <li>Orçamento válido até ${validadeFormatada}</li>
                        <li>Preços sujeitos a alteração</li>
                        <li>Garantia: 90 dias peças, 6 meses serviços</li>
                        <li>Pagamento: 50% aprovação + 50% retirada</li>
                    </ul>
                </div>
                
                <div class="footer-contact">
                    <h4>Contato</h4>
                    <div class="contact-grid">
                        <div class="contact-item">
                            <i class="fas fa-phone"></i>
                            <span>(11) 3456-7890</span>
                        </div>
                        <div class="contact-item">
                            <i class="fas fa-whatsapp"></i>
                            <span>(11) 99999-9999</span>
                        </div>
                        <div class="contact-item">
                            <i class="fas fa-envelope"></i>
                            <span>contato@retificapro.com.br</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Função para imprimir documento
function printDocument() {
    // Criar uma janela temporária para impressão
    const printWindow = window.open('', '_blank');
    const documentContent = document.querySelector('.orcamento-document').outerHTML;
    
    const printContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Orçamento - Retífica</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                ${getInlineStyles()}
            </style>
        </head>
        <body>
            ${documentContent}
        </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Aguardar o carregamento e imprimir
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };
}

// Função para obter estilos inline para impressão
function getInlineStyles() {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Arial', sans-serif;
            background: white;
            color: #000;
            line-height: 1.3;
            font-size: 11px;
        }
        
        .orcamento-document {
            width: 100%;
            padding: 0.5cm;
            margin: 0 auto;
            background: white;
            color: #000;
        }
        
        .orcamento-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #333;
        }
        
        .company-info h1 {
            font-size: 18px;
            font-weight: 700;
            color: #333;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .company-subtitle {
            font-size: 10px;
            color: #666;
            font-weight: 400;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .company-contact {
            font-size: 9px;
            color: #555;
            line-height: 1.2;
        }
        
        .contact-row {
            margin-bottom: 1px;
        }
        
        .orcamento-info {
            text-align: right;
            min-width: 200px;
        }
        
        .orcamento-number {
            font-size: 18px;
            font-weight: 700;
            color: #333;
            margin-bottom: 4px;
        }
        
        .orcamento-details {
            background: #f5f5f5;
            padding: 4px;
            border-radius: 2px;
            border-left: 2px solid #333;
            margin-bottom: 4px;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 9px;
        }
        
        .detail-label { color: #666; font-weight: 500; }
        .detail-value { color: #333; font-weight: 600; }
        
        .orcamento-status {
            display: inline-flex;
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 8px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border: 1px solid #ddd;
        }
        
        .status-pendente-print {
            background: #fff3cd;
            color: #856404;
            border-color: #ffeaa7;
        }
        
        .status-aprovado-print {
            background: #d4edda;
            color: #155724;
            border-color: #c3e6cb;
        }
        
        .status-rejeitado-print {
            background: #f8d7da;
            color: #721c24;
            border-color: #f5c6cb;
        }
        
        .cliente-section, .itens-section {
            margin-bottom: 12px;
        }
        
        .section-title {
            font-size: 12px;
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 2px;
        }
        
        .cliente-card {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 2px;
            padding: 8px;
        }
        
        .cliente-name {
            font-size: 13px;
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
        }
        
        .cliente-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
        }
        
        .cliente-field {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }
        
        .field-label {
            font-size: 8px;
            color: #666;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        
        .field-value {
            font-size: 9px;
            color: #333;
            font-weight: 400;
        }
        
        .itens-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #ddd;
            margin-top: 4px;
        }
        
        .itens-table th {
            background: #f5f5f5;
            padding: 4px;
            text-align: left;
            font-weight: 600;
            font-size: 9px;
            color: #333;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 1px solid #ddd;
        }
        
        .itens-table td {
            padding: 4px;
            border-bottom: 1px solid #eee;
            font-size: 9px;
            color: #333;
        }
        
        .itens-table tbody tr:nth-child(even) {
            background: #fafafa;
        }
        
        .item-description {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .item-name {
            font-weight: 500;
            color: #333;
            font-size: 10px;
        }
        
        .item-tipo {
            display: inline-block;
            padding: 1px 3px;
            border-radius: 2px;
            font-size: 7px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.2px;
            width: fit-content;
            border: 1px solid #ddd;
        }
        
        .tipo-peca {
            background: #e3f2fd;
            color: #1565c0;
            border-color: #bbdefb;
        }
        
        .tipo-servico {
            background: #e8f5e8;
            color: #2e7d32;
            border-color: #c8e6c9;
        }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-mono { font-family: 'Courier New', monospace; font-weight: 500; }
        
        .totals-section {
            margin-top: 8px;
            display: flex;
            justify-content: flex-end;
        }
        
        .totals-card {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 2px;
            padding: 6px;
            min-width: 150px;
        }
        
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .totals-table td {
            padding: 2px 0;
            font-size: 9px;
            border-bottom: 1px solid #eee;
        }
        
        .totals-table .total-row td {
            border-top: 1px solid #333;
            border-bottom: 1px solid #333;
            padding: 4px 0;
            font-size: 11px;
            font-weight: 700;
            color: #333;
        }
        
        .total-label { font-weight: 500; color: #333; }
        .total-value { text-align: right; color: #333; font-weight: 600; }
        
        .orcamento-footer {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid #ddd;
        }
        
        .footer-notes {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 2px;
            padding: 4px;
            margin-bottom: 8px;
        }
        
        .footer-notes h4 {
            color: #333;
            font-size: 9px;
            font-weight: 600;
            margin-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        
        .footer-notes ul { list-style: none; }
        
        .footer-notes li {
            color: #555;
            font-size: 7px;
            margin-bottom: 1px;
            line-height: 1.2;
        }
        
        .footer-notes li:before {
            content: "• ";
            color: #666;
            font-weight: bold;
        }
        
        .footer-contact {
            text-align: center;
            padding: 4px;
            background: #f5f5f5;
            border-radius: 2px;
            border: 1px solid #ddd;
        }
        
        .footer-contact h4 {
            color: #333;
            font-size: 9px;
            font-weight: 600;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        
        .contact-grid {
            display: flex;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        
        .contact-item {
            display: flex;
            align-items: center;
            gap: 3px;
            color: #555;
            font-size: 7px;
            font-weight: 400;
        }
        
        .contact-item i {
            color: #666;
            width: 8px;
            text-align: center;
            font-size: 6px;
        }
    `;
}

// Carregar dados de exemplo se não houver dados
setTimeout(() => {
    if (state.clientes.length === 0 && state.pecas.length === 0 && state.servicos.length === 0) {
        loadSampleData();
        renderAllLists();
        updateDashboard();
    }
}, 1000);