// Estado global da aplicação
let state = {
    clientes: [],
    pecas: [],
    servicos: [],
    orcamentos: [],
    currentEditId: null,
    // controle de sequência diária de IDs de orçamentos (por chave DDMMYYYY)
    lastIdByDate: {},
    company: {
        nome: 'Janio Retífica',
        endereco: 'Rua das Oficinas, 123 - Centro - São Paulo/SP',
        telefone: '(11) 3456-7890',
        email: 'contato@retificapro.com.br',
        cnpj: '12.345.678/0001-90',
        cep: '01234-567',
        logoDataUrl: '',
        logoPreset: '',
        uploadedLogos: []
    },
    // Configurações de conta (usuário/senha)
    account: {
        username: 'Admin',
        passwordHash: '' // vazio = sem senha definida
    }
};

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    loadFromStorage();
    setupEventListeners();
    updateDashboard();
    renderAllLists();
    initSettingsUI();
    initWorldTimeClock();
    // Navegação via cards do dashboard
    const statCards = document.querySelectorAll('.stat-card[data-goto]');
    statCards.forEach(card => {
        const target = card.getAttribute('data-goto');
        card.addEventListener('click', () => target && navigateToSection(target));
        card.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && target) {
                e.preventDefault();
                navigateToSection(target);
            }
        });
    });

    // Ajuste responsivo da pré-visualização do A4 para caber na janela sem quebrar
    // Estado de zoom da pré-visualização (persistência simples durante a sessão do modal)
    let previewZoomMode = 'fit'; // 'fit' | 'fixed'
    let previewZoomScale = 1;    // somente quando mode = 'fixed'

    const applyScale = (scale) => {
        const page = document.querySelector('#print-preview-modal .orcamento-document');
        const level = document.getElementById('zoom-level');
        if (!page) return;
        page.style.transformOrigin = 'top center';
        page.style.transform = `scale(${scale})`;
        if (level) level.textContent = `${Math.round(scale * 100)}%`;
    };

    const fitPreviewToViewport = () => {
        const container = document.querySelector('#print-preview-modal .orcamento-preview');
        const page = document.querySelector('#print-preview-modal .orcamento-document');
        if (!container || !page) return;
        // Reset para obter medidas naturais em cm/px
        page.style.transform = 'none';
        // Medidas do container e da página em pixels
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const pw = page.offsetWidth;  // 21cm em px (depende do DPR)
        const ph = page.offsetHeight; // 29.7cm em px
        if (!pw || !ph || !cw || !ch) return;
        // Margem visual dentro do container
        const pad = 16; // px
        const scaleW = (cw - pad * 2) / pw;
        const scaleH = (ch - pad * 2) / ph;
        let scale = Math.min(scaleW, scaleH);
        // Nunca ampliar acima de 1 (tamanho real) e preserve pequena margem interna
        scale = Math.min(scale, 1);
        if (scale < 1) {
            scale = Math.max(scale - 0.02, 0.1); // 2% de folga para evitar qualquer corte/borda
        }
        applyScale(Math.max(scale, 0.1));
    };

    // Reaplicar ajuste quando o modal abrir e no resize
    const previewObserver = new MutationObserver(() => {
        const modal = document.getElementById('print-preview-modal');
        if (modal && modal.classList.contains('active')) {
            requestAnimationFrame(fitPreviewToViewport);
        }
    });
    previewObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    window.addEventListener('resize', () => {
        const modal = document.getElementById('print-preview-modal');
        if (modal && modal.classList.contains('active')) {
            if (previewZoomMode === 'fit') fitPreviewToViewport(); else applyScale(previewZoomScale);
        }
    });

    // Também ajustar logo após inserir o conteúdo da prévia
    const previewContainer = document.getElementById('orcamento-preview-content');
    const contentObserver = new MutationObserver(() => {
        const modal = document.getElementById('print-preview-modal');
        if (modal && modal.classList.contains('active')) {
            requestAnimationFrame(fitPreviewToViewport);
        }
    });
    if (previewContainer) {
        contentObserver.observe(previewContainer, { childList: true, subtree: true });
    }

    // Controles de zoom
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoom100Btn = document.getElementById('zoom-100');
    const zoomFitBtn = document.getElementById('zoom-fit');

    const setFixedZoom = (scale) => {
        previewZoomMode = 'fixed';
        previewZoomScale = Math.min(Math.max(scale, 0.1), 3); // entre 10% e 300%
        applyScale(previewZoomScale);
        // Garantir que a página continue visível; container com rolagem lida com overflow
    };

    zoomInBtn?.addEventListener('click', () => {
        // Se estiver em modo fit, iniciar do scale atual calculado
        if (previewZoomMode === 'fit') {
            previewZoomMode = 'fixed';
            // Descobrir o scale atual lendo o transform aplicado
            const page = document.querySelector('#print-preview-modal .orcamento-document');
            let current = 1;
            if (page) {
                const m = (page.style.transform || '').match(/scale\(([^)]+)\)/);
                current = m ? parseFloat(m[1]) : 1;
            }
            previewZoomScale = current;
        }
        setFixedZoom(previewZoomScale * 1.1);
    });

    zoomOutBtn?.addEventListener('click', () => {
        if (previewZoomMode === 'fit') {
            previewZoomMode = 'fixed';
            const page = document.querySelector('#print-preview-modal .orcamento-document');
            let current = 1;
            if (page) {
                const m = (page.style.transform || '').match(/scale\(([^)]+)\)/);
                current = m ? parseFloat(m[1]) : 1;
            }
            previewZoomScale = current;
        }
        setFixedZoom(previewZoomScale / 1.1);
    });

    zoom100Btn?.addEventListener('click', () => {
        setFixedZoom(1);
    });

    zoomFitBtn?.addEventListener('click', () => {
        previewZoomMode = 'fit';
        fitPreviewToViewport();
    });
    
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
        // Migrar nome antigo se existir
        const legacy = localStorage.getItem('ret_user_name');
        if (legacy && !localStorage.getItem('ret_account')) {
            const migrated = { username: legacy, passwordHash: '' };
            try { localStorage.setItem('ret_account', JSON.stringify(migrated)); } catch {}
        }
        const acc = loadAccount();
        usernameEl.textContent = acc.username || 'Admin';
    }
});

// Live clock using WorldTimeAPI (America/Sao_Paulo)
function initWorldTimeClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if (!timeEl || !dateEl) return;

    let offsetMs = 0; // server - client time offset
    let lastSync = 0;

    const format = (d) => {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const yy = d.getFullYear();
        return { time: `${hh}:${mm}`, date: `${dd}/${mo}/${yy}` };
    };

    async function sync() {
        try {
            const res = await fetch('https://worldtimeapi.org/api/timezone/America/Sao_Paulo', { cache: 'no-store' });
            const data = await res.json();
            if (data && data.datetime) {
                const serverNow = new Date(data.datetime).getTime();
                const localNow = Date.now();
                offsetMs = serverNow - localNow;
                lastSync = Date.now();
                update();
            }
        } catch (e) {
            // keep using local time if API fails
        }
    }

    function update() {
        const now = new Date(Date.now() + offsetMs);
        const { time, date } = format(now);
        timeEl.textContent = time;
        dateEl.textContent = date;
    }

    // Tick every second
    setInterval(update, 1000);
    // Initial sync and periodic re-sync every 10 minutes
    sync();
    setInterval(() => {
        // avoid hammering the API if tab is inactive
        if (Date.now() - lastSync > 9 * 60 * 1000) sync();
    }, 60 * 1000);
}

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
            localStorage.removeItem('ret_account');
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

    // Autocomplete de endereço (Clientes) via Nominatim
    initClienteAddressAutocomplete();

    // Busca por CEP (ViaCEP) no modal de cliente
    initClienteCepLookup();

    // Máscaras de telefone (Cliente e Configurações)
    const clientePhone = document.querySelector('#cliente-form input[name="telefone"]');
    if (clientePhone) attachPhoneMask(clientePhone);
    const settingsPhone = document.getElementById('settings-telefone');
    if (settingsPhone) attachPhoneMask(settingsPhone);

    // Filtros de busca
    document.getElementById('search-orcamentos')?.addEventListener('input', filterOrcamentos);
    document.getElementById('status-filter')?.addEventListener('change', filterOrcamentos);
    document.getElementById('date-start')?.addEventListener('change', filterOrcamentos);
    document.getElementById('date-end')?.addEventListener('change', filterOrcamentos);
    document.getElementById('clear-orcamentos-filters')?.addEventListener('click', () => {
        const s1 = document.getElementById('search-orcamentos');
        const s2 = document.getElementById('status-filter');
        const d1 = document.getElementById('date-start');
        const d2 = document.getElementById('date-end');
        if (s1) s1.value = '';
        if (s2) s2.value = '';
        if (d1) d1.value = '';
        if (d2) d2.value = '';
        filterOrcamentos();
    });
    document.getElementById('search-clientes')?.addEventListener('input', filterClientes);
    document.getElementById('search-pecas')?.addEventListener('input', filterPecas);
    document.getElementById('search-servicos')?.addEventListener('input', filterServicos);

    // Fechar modal ao clicar fora
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });

    // Fechar modal com ESC e gerenciar foco dentro do modal
    document.addEventListener('keydown', (e) => {
        const openModalEl = document.querySelector('.modal.active');
        if (!openModalEl) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal(openModalEl.id);
        } else if (e.key === 'Tab') {
            // Focus trap simples
            const focusableSelectors = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
            const nodes = Array.from(openModalEl.querySelectorAll(focusableSelectors)).filter(el => el.offsetParent !== null);
            if (nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
    });

    // Fechar sidebar ao clicar em um item (em telas pequenas)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sb = document.querySelector('.sidebar');
            if (sb && window.innerWidth <= 768) {
                sb.classList.remove('open');
                document.body.classList.remove('sidebar-open');
            }
        });
    });

    // Segurança extra: ao redimensionar para desktop, remova qualquer trava de scroll da sidebar
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            document.body.classList.remove('sidebar-open');
        }
    });
}

// Configurações (UI)
function initSettingsUI() {
    // Inputs
    const nome = document.getElementById('settings-nome');
    const endereco = document.getElementById('settings-endereco');
    const telefone = document.getElementById('settings-telefone');
    const email = document.getElementById('settings-email');
    const cnpj = document.getElementById('settings-cnpj');
    const cep = document.getElementById('settings-cep');
    const logoInput = document.getElementById('settings-logo');
    // Campos da conta
    const accUser = document.getElementById('account-username');
    const accOld = document.getElementById('account-old-password');
    const accNew = document.getElementById('account-new-password');
    const accConf = document.getElementById('account-confirm-password');
    const accSave = document.getElementById('account-save');
    const accHint = document.getElementById('account-hint');
    if (!nome || !endereco || !telefone || !email || !cnpj || !cep) return; // section ainda não montada

    // Preencher com estado atual
    nome.value = state.company.nome || '';
    endereco.value = state.company.endereco || '';
    telefone.value = state.company.telefone || '';
    email.value = state.company.email || '';
    cnpj.value = state.company.cnpj || '';
    cep.value = state.company.cep || '';

    // Pré-preencher conta
    const account = loadAccount();
    if (accUser) accUser.value = account.username || 'Admin';
    // Preview do logo
    updateLogoPreview();

    // Handlers simples de mudança
    const onChange = () => {
        state.company = {
            ...state.company,
            nome: nome.value,
            endereco: endereco.value,
            telefone: telefone.value,
            email: email.value,
            cnpj: cnpj.value,
            cep: cep.value
        };
        updateLogoPreview();
        saveToStorage();
    };
    [nome, endereco, telefone, email, cnpj, cep].forEach(inp => inp.addEventListener('input', onChange));

    // Garantir que clique no card de upload abra o seletor de arquivo (defensivo)
    const uploadCard = document.getElementById('logo-drop');
    if (uploadCard) {
        uploadCard.addEventListener('click', () => {
            const input = document.getElementById('settings-logo');
            input && input.click();
        });
    }

    // Upload de logo
    if (logoInput) {
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                state.company.logoDataUrl = dataUrl;
                state.company.logoPreset = '';
                if (!Array.isArray(state.company.uploadedLogos)) state.company.uploadedLogos = [];
                state.company.uploadedLogos.push(dataUrl);
                updateLogoPreview();
                // Visual: upload não recebe destaque; apenas limpar presets ativos
                document.querySelectorAll('.logo-preset.active').forEach(p => p.classList.remove('active'));
                // Renderizar/atualizar miniaturas dos uploads
                if (typeof renderUploadThumbs === 'function') {
                    renderUploadThumbs();
                } else if (typeof renderUploadThumb === 'function') {
                    renderUploadThumb();
                }
                saveToStorage();
            };
            reader.readAsDataURL(file);
        });
    }

    // Botões
    document.getElementById('settings-save')?.addEventListener('click', () => {
        saveToStorage();
        alert('Configurações salvas.');
    });
    document.getElementById('settings-reset')?.addEventListener('click', () => {
        state.company = {
            nome: 'Janio Retífica',
            endereco: 'Rua das Oficinas, 123 - Centro - São Paulo/SP',
            telefone: '(11) 3456-7890',
            email: 'contato@retificapro.com.br',
            cnpj: '12.345.678/0001-90',
            cep: '01234-567',
            logoDataUrl: '',
            logoPreset: '',
            uploadedLogos: []
        };
        document.querySelectorAll('.logo-preset.active').forEach(p => p.classList.remove('active'));
        updateLogoPreview();
        if (typeof renderUploadThumbs === 'function') renderUploadThumbs();
        saveToStorage();
    });

    // Presets de logo (seleção rápida)
    const presetButtons = document.querySelectorAll('.logo-preset');
    if (presetButtons.length) {
        presetButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-preset');
                let src = '';
                if (id === '1') src = 'img/logo.png';
                if (id === '2') src = 'img/logo2.png';
                if (!src) return;
                // Definir diretamente a URL do preset (evita erros de fetch em file://)
                state.company.logoDataUrl = src;
                state.company.logoPreset = id;
                updateLogoPreview();
                highlightPreset(id);
                // Seleção única: remover ativo de uploads
                document.querySelectorAll('.logo-upload-thumb.active').forEach(el => el.classList.remove('active'));
                saveToStorage();
            });
        });
        // marcar preset ativo na carga; upload nunca recebe destaque
        if (state.company.logoPreset) highlightPreset(state.company.logoPreset);
        // Se já existir uploads salvos, renderizar thumbs
        if (state.company.uploadedLogos && state.company.uploadedLogos.length) {
            renderUploadThumbs();
        }
    }

    function highlightPreset(id) {
        document.querySelectorAll('.logo-preset').forEach(p => p.classList.toggle('active', p.getAttribute('data-preset') === String(id)));
    }

    // Renderiza a lista de miniaturas de uploads (cada upload vira um item com botão X para remover)
    function renderUploadThumbs() {
        const row = document.getElementById('logo-options-row');
        if (!row) return;
        // Remover thumbs existentes para re-render limpo
        Array.from(row.querySelectorAll('.logo-upload-thumb')).forEach(el => el.remove());
        const uploads = state.company.uploadedLogos || [];
        const uploadBox = document.getElementById('logo-drop');
        uploads.forEach((dataUrl, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'logo-upload-thumb';
            wrapper.setAttribute('data-idx', String(idx));
            // Botão remover sutil
            const removeBtn = document.createElement('button');
            removeBtn.className = 'logo-upload-remove';
            removeBtn.type = 'button';
            removeBtn.title = 'Remover';
            removeBtn.setAttribute('aria-label', 'Remover logo enviada');
            removeBtn.textContent = '×';
            // Botão de seleção
            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.className = 'logo-upload-select';
            const img = document.createElement('img');
            img.alt = 'Logo enviada';
            img.src = dataUrl;
            selectBtn.appendChild(img);
            wrapper.appendChild(removeBtn);
            wrapper.appendChild(selectBtn);
            if (uploadBox && uploadBox.nextSibling) row.insertBefore(wrapper, uploadBox.nextSibling);
            else row.appendChild(wrapper);
            // Selecionar upload
            selectBtn.addEventListener('click', () => {
                state.company.logoDataUrl = dataUrl;
                state.company.logoPreset = '';
                updateLogoPreview();
                document.querySelectorAll('.logo-preset.active').forEach(p => p.classList.remove('active'));
                // Seleção única: destacar esta miniatura e limpar outras
                row.querySelectorAll('.logo-upload-thumb.active').forEach(el => el.classList.remove('active'));
                wrapper.classList.add('active');
                saveToStorage();
            });
            // Remover upload
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(wrapper.getAttribute('data-idx'));
                if (!isNaN(index)) {
                    uploads.splice(index, 1);
                    if (state.company.logoDataUrl === dataUrl) {
                        state.company.logoDataUrl = uploads[0] || '';
                    }
                    renderUploadThumbs();
                    updateLogoPreview();
                    saveToStorage();
                }
            });
        });
        // Marcar active na miniatura correspondente ao preview atual
        if (state.company.logoDataUrl && uploads.length) {
            const currentIdx = uploads.indexOf(state.company.logoDataUrl);
            if (currentIdx >= 0) {
                const currentEl = row.querySelector(`.logo-upload-thumb[data-idx="${currentIdx}"]`);
                currentEl && currentEl.classList.add('active');
            }
        }
        enableTouchScroll(row);
    }

    // Habilita arraste por toque/mouse no carrossel horizontal
    function enableTouchScroll(container) {
        if (!container || container.__touchEnabled) return;
        container.__touchEnabled = true;
        let isDown = false;
        let allowDrag = false;
        let startX = 0;
        let startScrollLeft = 0;
        let moved = false;
        const clickThreshold = 12; // px
        const isInteractive = (el) => {
            return !!(el.closest && el.closest('button, a, input, select, textarea, [role="button"], [data-no-drag]'));
        };
        container.addEventListener('pointerdown', (e) => {
            moved = false;
            // não iniciar drag se clicou em elementos interativos
            allowDrag = !isInteractive(e.target);
            if (!allowDrag) { isDown = false; return; }
            isDown = true;
            startX = e.clientX;
            startScrollLeft = container.scrollLeft;
            container.setPointerCapture?.(e.pointerId);
        });
        container.addEventListener('pointermove', (e) => {
            if (!isDown || !allowDrag) return;
            const dx = e.clientX - startX;
            if (Math.abs(dx) > clickThreshold) moved = true;
            container.scrollLeft = startScrollLeft - dx;
        });
        const endDrag = (e) => {
            if (!isDown) return;
            isDown = false;
            container.releasePointerCapture?.(e.pointerId);
        };
        container.addEventListener('pointerup', endDrag);
        container.addEventListener('pointercancel', endDrag);
        // Bloquear cliques somente se houve movimento real
        container.addEventListener('click', (e) => {
            if (moved && allowDrag) { e.preventDefault(); e.stopPropagation(); }
        }, true);
    }

    // Ativar touch scroll na linha desde já
    const rowEl = document.getElementById('logo-options-row');
    if (rowEl) enableTouchScroll(rowEl);

    // Salvar conta (usuário/senha)
    if (accSave) {
        accSave.addEventListener('click', async () => {
            const desiredUser = (accUser?.value || 'Admin').trim();
            const oldPw = accOld?.value || '';
            const newPw = accNew?.value || '';
            const confPw = accConf?.value || '';

            const current = loadAccount();
            // Se há senha definida, exigir validação da senha atual
            if (current.passwordHash) {
                const ok = await verifyPassword(oldPw, current.passwordHash);
                if (!ok) { setHint('Senha atual incorreta.', true); return; }
            }
            // Validar nova senha se fornecida
            if (newPw || confPw) {
                if (newPw.length < 8) { setHint('A nova senha deve ter no mínimo 8 caracteres.', true); return; }
                if (newPw !== confPw) { setHint('A confirmação da nova senha não confere.', true); return; }
            }
            const newHash = newPw ? await hashPassword(newPw) : (current.passwordHash || '');
            const updated = { username: desiredUser || 'Admin', passwordHash: newHash };
            try { localStorage.setItem('ret_account', JSON.stringify(updated)); } catch {}
            state.account = updated;
            const usernameEl = document.getElementById('current-username');
            if (usernameEl) usernameEl.textContent = updated.username;
            if (accOld) accOld.value = '';
            if (accNew) accNew.value = '';
            if (accConf) accConf.value = '';
            setHint('Conta atualizada com sucesso.', false);
        });
    }

    function setHint(text, isError) {
        if (!accHint) return;
        accHint.textContent = text;
        accHint.style.color = isError ? '#b91c1c' : 'var(--text-secondary)';
    }
}

// Prévia simples do logo (miniatura de upload)
function updateLogoPreview() {
    const img = document.getElementById('logo-preview-img');
    const wrap = document.getElementById('logo-preview');
    if (img && wrap) {
        if (state.company.logoDataUrl) {
            img.src = state.company.logoDataUrl;
            img.style.display = 'block';
        } else {
            img.removeAttribute('src');
            img.style.display = 'none';
        }
    }
}

// Utilitário: carregar imagem como DataURL para salvar no storage
async function fetchAsDataURL(url) {
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        // Fallback: em ambientes file:// ou offline, use a URL relativa diretamente
        return url;
    }
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
        servicos: 'Serviços',
        configuracoes: 'Configurações'
    };

    const subtitles = {
        dashboard: 'Visão geral do seu negócio',
        orcamentos: 'Gerencie todos os orçamentos',
        clientes: 'Cadastro de clientes',
        pecas: 'Catálogo de peças',
        servicos: 'Catálogo de serviços',
        configuracoes: 'Gerencie as configurações da empresa'
    };

    document.querySelector('.page-title').textContent = titles[sectionName];
    document.querySelector('.page-subtitle').textContent = subtitles[sectionName];
}

// Gerenciamento de modais
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    // Garantir que o modal esteja anexado direto ao body para z-index máximo
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }
    // Acessibilidade básica
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Foco inicial no primeiro elemento focável
    setTimeout(() => {
        const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
    }, 0);

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
    if (!modal) return;
    modal.classList.remove('active');
    // Se não houver mais modais abertos, liberar scroll do body
    if (!document.querySelector('.modal.active')) {
        document.body.classList.remove('modal-open');
        // Garantir remoção de qualquer bloqueio inline residual
        document.body.style.overflow = '';
    }
    
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
        telefone: formatPhoneBR(formData.get('telefone') || ''),
        documento: formData.get('documento'),
        cep: (formData.get('cep') || '').toString(),
        endereco: composeEnderecoCompleto(formData.get('endereco'), formData.get('numero')),
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

// Formata telefone BR sempre com parênteses no DDD
function formatPhoneBR(value) {
    if (!value) return '';
    let digits = String(value).replace(/\D/g, '');
    // Remove código do país se informado
    if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
    if (digits.length > 11) digits = digits.slice(0, 11);
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (!ddd) return '';
    if (rest.length <= 4) return `(${ddd}) ${rest}`.trim();
    if (rest.length <= 8) {
        // 8 dígitos: (11) 1234-5678
        const p1 = rest.slice(0, 4);
        const p2 = rest.slice(4);
        return `(${ddd}) ${p1}${p2 ? '-' + p2 : ''}`;
    }
    // 9 dígitos: (11) 91234-5678
    const p1 = rest.slice(0, 5);
    const p2 = rest.slice(5);
    return `(${ddd}) ${p1}${p2 ? '-' + p2 : ''}`;
}

// Aplica máscara de telefone no input enquanto digita
function attachPhoneMask(input) {
    const handler = () => {
        const posEnd = input.selectionEnd;
        const formatted = formatPhoneBR(input.value);
        input.value = formatted;
        // Cursor no final (comum em máscaras simples)
        input.setSelectionRange(formatted.length, formatted.length);
    };
    input.addEventListener('input', handler);
    // Formatar valor inicial caso já exista
    if (input.value) handler();
}

// Monta endereço completo com número quando disponível
function composeEnderecoCompleto(endereco, numero) {
    const e = (endereco || '').trim();
    const n = (numero || '').trim();
    if (!e && !n) return '';
    if (e && n) return `${e}, ${n}`;
    return e || n;
}

// Debounce helper
function debounce(fn, wait) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Inicializa autocomplete de endereço do cliente (Nominatim)
function initClienteAddressAutocomplete() {
    const modal = document.getElementById('cliente-modal');
    const form = document.getElementById('cliente-form');
    if (!modal || !form) return;
    const input = form.querySelector('input[name="endereco"]');
    const cidadeInput = form.querySelector('input[name="cidade"]');
    const suggestions = document.getElementById('cliente-endereco-suggestions');
    if (!input || !suggestions) return;

    // Fecha lista ao clicar fora
    document.addEventListener('click', (ev) => {
        if (!modal.classList.contains('active')) return;
        if (!suggestions.contains(ev.target) && ev.target !== input) {
            suggestions.classList.remove('active');
        }
    });

    // Busca Nominatim
    const fetchSuggestions = debounce(async (q) => {
        const query = (q || '').trim();
        if (query.length < 3) { suggestions.innerHTML = ''; suggestions.classList.remove('active'); return; }
        try {
            // Only Brazil: use countrycodes=br, include addressdetails for structured fields and limit results
            const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=br&limit=8&accept-language=pt-BR&q=${encodeURIComponent(query)}`;
            const res = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'RetificaOrcamentos/1.0 (contato@example.com)',
                    'Accept-Language': 'pt-BR'
                }
            });
            const data = await res.json();
            const items = (data || []).slice(0, 8).map(toSuggestionItem).filter(Boolean);
            if (items.length === 0) {
                suggestions.innerHTML = '<div class="address-item"><div class="address-main">Nenhum resultado</div></div>';
                suggestions.classList.add('active');
                return;
            }
            suggestions.innerHTML = items.map(renderAddressItem).join('');
            suggestions.classList.add('active');
        } catch (err) {
            suggestions.innerHTML = '<div class="address-item"><div class="address-main">Erro ao buscar</div></div>';
            suggestions.classList.add('active');
        }
    }, 200);

    input.addEventListener('input', () => fetchSuggestions(input.value));
    input.addEventListener('focus', () => fetchSuggestions(input.value));

    // Clique numa sugestão
    suggestions.addEventListener('click', (ev) => {
        const item = ev.target.closest('.address-item');
        if (!item) return;
        const value = item.getAttribute('data-value');
        const city = item.getAttribute('data-city') || '';
        input.value = value;
        if (cidadeInput && city) cidadeInput.value = city;
        suggestions.classList.remove('active');
    });
}

// Inicializa busca de endereço por CEP (ViaCEP)
function initClienteCepLookup() {
    const modal = document.getElementById('cliente-modal');
    const form = document.getElementById('cliente-form');
    if (!modal || !form) return;
    const cepInput = form.querySelector('input[name="cep"]');
    const enderecoInput = form.querySelector('input[name="endereco"]');
    const cidadeInput = form.querySelector('input[name="cidade"]');
    const btn = document.getElementById('buscar-cep-btn');
    const hint = document.getElementById('cep-hint');
    if (!cepInput || !enderecoInput || !cidadeInput) return;

    const fetchByCep = async (cep) => {
        const clean = (cep || '').replace(/\D/g, '');
        if (clean.length !== 8) return;
        try {
            hint && (hint.textContent = 'Buscando CEP...');
            const url = `https://viacep.com.br/ws/${clean}/json/`;
            const res = await fetch(url);
            const data = await res.json();
            if (data && !data.erro) {
                const logradouro = data.logradouro || '';
                const bairro = data.bairro || '';
                const localidade = data.localidade || '';
                const uf = data.uf || '';
                // Preenche endereço no formato do autocomplete
                const composed = [logradouro, bairro, localidade && uf ? `${localidade}/${uf}` : localidade || uf].filter(Boolean).join(' - ');
                if (composed) enderecoInput.value = composed;
                if (localidade) cidadeInput.value = localidade;
                hint && (hint.textContent = 'Endereço preenchido a partir do CEP.');
            } else {
                hint && (hint.textContent = 'CEP não encontrado.');
            }
        } catch (e) {
            hint && (hint.textContent = 'Erro ao buscar CEP.');
        }
    };

    // Buscar ao digitar 8 dígitos
    cepInput.addEventListener('input', () => {
        const clean = cepInput.value.replace(/\D/g, '');
        if (clean.length === 8) fetchByCep(clean);
    });

    // Botão buscar
    btn && btn.addEventListener('click', () => fetchByCep(cepInput.value));
}

function toSuggestionItem(entry) {
    // entry.display_name, entry.address may include: road, neighbourhood, suburb, city, town, village, state
    const a = entry.address || {};
    const logradouro = a.road || a.pedestrian || a.footway || a.path || '';
    const bairro = a.neighbourhood || a.suburb || a.quarter || '';
    const cidade = a.city || a.town || a.village || a.municipality || '';
    const estado = a.state || '';
    let uf = a.state_code || '';
    // Normalize UF when state_code comes as BR-XX
    if (uf.includes('-')) uf = uf.split('-').pop();
    if (!logradouro && !cidade && !estado) return null;
    const cidadeUf = (cidade || estado) ? `${cidade}${(cidade && (uf || estado)) ? '/' : ''}${uf || ''}` : '';
    const main = [logradouro, bairro].filter(Boolean).join(' - ') || a.residential || entry.display_name;
    const meta = [cidadeUf].filter(Boolean).join(' ');
    const value = [logradouro, bairro, cidadeUf].filter(Boolean).join(' - ');
    return { main, meta, value, cidade: cidade || '' };
}

function renderAddressItem(item) {
    const metaHtml = item.meta ? `<div class="address-meta">${item.meta}</div>` : '';
    return `<div class="address-item" data-value="${escapeHtml(item.value)}" data-city="${escapeHtml(item.cidade)}">
        <div class="address-main">${escapeHtml(item.main)}</div>
        ${metaHtml}
    </div>`;
}

function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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
        const telefoneRaw = (cliente?.telefone || '').replace(/\D/g,'');
        const waLink = telefoneRaw ? `https://wa.me/${telefoneRaw}` : 'https://wa.me/';
        const mailLink = `mailto:${cliente?.email ? encodeURIComponent(cliente.email) : ''}`;
        
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

    // Renderizar todos os orçamentos
    container.innerHTML = state.orcamentos.map(renderRow).join('');
    
    // Renderizar orçamentos recentes (últimos 5)
    const recent = state.orcamentos
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 3);
    recentContainer.innerHTML = recent.map(renderRow).join('');
}

function renderAllLists() {
    renderClientes();
    renderPecas();
    renderServicos();
    renderOrcamentos();
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
        <div class="modal" id="view-orcamento-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Orçamento #${orcamento.id}</h3>
                    <button class="modal-close" onclick="closeModal('view-orcamento-modal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="view-quote-body">

                    <div class="view-quote-card">
                        <div class="view-quote-title">Cliente</div>
                        <div class="view-quote-grid">
                            <div class="meta-item"><span class="meta-label">Nome</span><span class="meta-value">${cliente ? cliente.nome : 'Cliente não encontrado'}</span></div>
                            <div class="meta-item"><span class="meta-label">Data</span><span class="meta-value">${formatDate(orcamento.data)}</span></div>
                            <div class="meta-item"><span class="meta-label">Validade</span><span class="meta-value">${validadeFormatada}</span></div>
                            <div class="meta-item"><span class="meta-label">Status</span><span class="meta-value"><span id="cliente-status-badge" class="status-badge status-${orcamento.status}">${orcamento.status}</span></span></div>
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
                        <div class="status-row">
                            <div class="status-segment" role="tablist" aria-label="Trocar status">
                                <button type="button" class="seg-option seg-pendente ${orcamento.status === 'pendente' ? 'active' : ''}" data-status="pendente" onclick="toggleOrcamentoStatus('${orcamento.id}','pendente')">Pendente</button>
                                <button type="button" class="seg-option seg-aprovado ${orcamento.status === 'aprovado' ? 'active' : ''}" data-status="aprovado" onclick="toggleOrcamentoStatus('${orcamento.id}','aprovado')">Aprovado</button>
                            </div>
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
    // Usar fluxo padrão de modais para consistência (aplica body.modal-open corretamente)
    openModal('view-orcamento-modal');
}

// Aplica alteração de status (recebe explicitamente ou lê do modal como fallback)
function applyOrcamentoStatus(id, status) {
    const modal = document.getElementById('view-orcamento-modal');
    const selected = status || (modal ? (modal.querySelector('input[name=\"orc-status\"]:checked')?.value) : null);
    const novoStatus = selected === 'aprovado' ? 'aprovado' : 'pendente';
    const idx = state.orcamentos.findIndex(o => String(o.id) === String(id));
    if (idx === -1) return;
    state.orcamentos[idx].status = novoStatus;
    saveToStorage();
    renderOrcamentos();
}

// Alterna status via segmented control (autosave + feedback)
function toggleOrcamentoStatus(id, status) {
    const modal = document.getElementById('view-orcamento-modal');
    if (!modal) return;
    // Visual active toggle
    modal.querySelectorAll('.seg-option').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-status') === status);
    });
    applyOrcamentoStatus(id, status);
    // Atualiza badge na seção Cliente
    const badge = modal.querySelector('#cliente-status-badge');
    if (badge) {
        badge.classList.remove('status-pendente','status-aprovado');
        badge.classList.add(`status-${status}`);
        badge.textContent = status;
    }
}

// Funções de filtro
function filterOrcamentos() {
    const searchTerm = document.getElementById('search-orcamentos').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    const dateStartVal = document.getElementById('date-start')?.value;
    const dateEndVal = document.getElementById('date-end')?.value;
    const startDate = dateStartVal ? new Date(dateStartVal + 'T00:00:00') : null;
    const endDate = dateEndVal ? new Date(dateEndVal + 'T23:59:59') : null;
    
    const rows = document.querySelectorAll('#orcamentos-list tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const status = row.querySelector('.status-badge')?.classList.contains(`status-${statusFilter}`) ?? true;
        // Data está na coluna 'Data': pego atributo data-label
        const dateText = row.querySelector('[data-label="Data"]')?.textContent?.trim() || '';
        // Converte dd/mm/aaaa para Date
        let dateOk = true;
        if (startDate || endDate) {
            const parts = dateText.split('/');
            if (parts.length === 3) {
                const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
                if (startDate && d < startDate) dateOk = false;
                if (endDate && d > endDate) dateOk = false;
            }
        }
        
        const matchesSearch = text.includes(searchTerm);
        const matchesStatus = !statusFilter || status;
        const matchesDate = dateOk;
        
        row.style.display = matchesSearch && matchesStatus && matchesDate ? '' : 'none';
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
    const elOrc = document.getElementById('total-orcamentos');
    const elCli = document.getElementById('total-clientes');
    const elPec = document.getElementById('total-pecas');
    const elSrv = document.getElementById('total-servicos');
    if (elOrc) elOrc.textContent = state.orcamentos.length;
    if (elCli) elCli.textContent = state.clientes.length;
    if (elPec) elPec.textContent = state.pecas.length;
    if (elSrv) elSrv.textContent = state.servicos.length;
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
        if (!state.company) {
            state.company = {
                nome: 'Janio Retífica',
                endereco: 'Rua das Oficinas, 123 - Centro - São Paulo/SP',
                telefone: '(11) 3456-7890',
                email: 'contato@retificapro.com.br',
                cnpj: '12.345.678/0001-90',
                cep: '01234-567',
                logoDataUrl: '',
                logoPreset: '',
                uploadedLogos: []
            };
        }
        if (!state.company.logoPreset) state.company.logoPreset = '';
        if (!Array.isArray(state.company.uploadedLogos)) state.company.uploadedLogos = [];
    }
}

// Helpers de conta de usuário
function loadAccount() {
    try {
        const raw = localStorage.getItem('ret_account');
        if (raw) return JSON.parse(raw);
    } catch {}
    return state.account || { username: 'Admin', passwordHash: '' };
}

async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(buf));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
    if (!hash) return true;
    const h = await hashPassword(password || '');
    return h === hash;
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

function downloadOrcamentoFromPreview() {
    // Baixar o conteúdo atual da prévia como um arquivo HTML auto-contido (simples e offline-friendly)
    const docEl = document.querySelector('.orcamento-document');
    if (!docEl) return;
    const content = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Orcamento</title><style>${getInlineStyles()}</style></head><body>${docEl.outerHTML}</body></html>`;
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const id = getPreviewOrcamentoId() || 'orcamento';
    a.href = url;
    a.download = `orcamento-${id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Helpers removidos da visualização; ações serão oferecidas no modal de pré-visualização

// Gerar HTML da pré-visualização do orçamento
function generateOrcamentoPreview(orcamento, cliente) {
    const hoje = new Date();
    const c = state.company || {};
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
                    <div class="company-logo">
                        ${c.logoDataUrl ? `<img src="${c.logoDataUrl}" alt="Logo" />` : ''}
                    </div>
                    <div class="company-contact" style="margin-top:2px;">
                        <div class="contact-row">${c.endereco || ''}</div>
                        <div class="contact-row">Telefone: ${c.telefone || ''} | Email: ${c.email || ''}</div>
                        <div class="contact-row">CNPJ: ${c.cnpj || ''} | CEP: ${c.cep || ''}</div>
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

            <!-- Assinaturas -->
            <div class="assinatura-section">
                <h3 class="section-title">Assinaturas</h3>
                <div class="assinatura-grid">
                    <div class="assinatura-field">
                        <div class="assinatura-line"></div>
                        <div class="assinatura-label">Assinatura do Vendedor</div>
                    </div>
                    <div class="assinatura-field">
                        <div class="assinatura-line"></div>
                        <div class="assinatura-label">Assinatura do Cliente</div>
                    </div>
                </div>
            </div>

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

                <!-- Autorização -->
                <div class="autorizacao-footer">
                    AUTORIZO A FIRMA EFETUAR OS SERVIÇOS RELACIONADOS NESTA NOTA.
                </div>
            </div>
        </div>
    `;
}

// Função para imprimir documento
function printDocument() {
    // Criar uma janela temporária para impressão
    const printWindow = window.open('', '_blank');
    // Clonar o conteúdo removendo qualquer transformação de zoom aplicada na prévia
    const pageEl = document.querySelector('.orcamento-document');
    let documentContent = '';
    if (pageEl) {
        const clone = pageEl.cloneNode(true);
        // Remover zoom da prévia (transform e origem)
        clone.style.transform = '';
        clone.style.transformOrigin = '';
        documentContent = clone.outerHTML;
    } else {
        documentContent = '';
    }
    
    const printContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title></title>
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
        // Keep title empty to avoid browser print headers showing a custom title
        try { printWindow.document.title = ' '; } catch {}
        // Replace about:blank with a friendly URL to avoid it in printed headers/footers
        try {
            const href = window.location && window.location.href ? window.location.href : '';
            const newUrl = href ? `${href.split('#')[0]}#impressao` : '#impressao';
            printWindow.history.replaceState(null, '', newUrl);
        } catch {}
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
            /* Garantir impressão 100% independente do zoom da prévia */
            transform: none !important;
            transform-origin: top center !important;
        }
        
        .orcamento-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #333;
        }
        /* Limit logo size on print to avoid oversized images (slightly larger) */
        .company-logo img {
            max-height: 100px;
            max-width: 50%;
            height: auto;
            width: auto;
            display: block;
            object-fit: contain;
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

        /* Assinaturas Section - Print */
        .assinatura-section {
            margin-bottom: 12px;
        }
        
        .assinatura-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 6px;
        }
        
        .assinatura-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .assinatura-line {
            border-bottom: 1px solid #333;
            height: 25px;
            width: 100%;
        }
        
        .assinatura-label {
            font-size: 8px;
            color: #333;
            text-align: center;
            font-weight: 500;
        }

        /* Autorização Footer - Print */
        .autorizacao-footer {
            background: #333 !important;
            color: #fff !important;
            text-align: center;
            padding: 6px 12px;
            margin-top: 8px;
            border-radius: 1px;
            font-size: 8px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
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