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

// Expose core globals for other modules (e.g., print.js)
// Note: we reassign window.state again inside loadFromStorage when the object is merged
window.state = state;

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
            // Limpar possíveis dados de sessão/conta
            localStorage.removeItem('ret_user_name');
            localStorage.removeItem('ret_account');
            localStorage.removeItem('userSession');
            const usernameEl = document.getElementById('current-username');
            if (usernameEl) usernameEl.textContent = 'Admin';
            // Redirecionamento direto para a página de login (sem modal)
            try { window.location.href = 'auth/login.html'; } catch {}
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
        showAlert('Configurações salvas.', { title: 'Pronto' });
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
        
        // Restaurar título para novo orçamento e limpar campos de veículo
        document.querySelector('#orcamento-modal h3').textContent = 'Novo Orçamento';
        const form = document.getElementById('orcamento-form');
        const carroInput = form?.querySelector('input[name="carro"]');
        const placaInput = form?.querySelector('input[name="placa"]');
        const incEstInput = form?.querySelector('input[name="incEst"]');
        if (carroInput) carroInput.value = '';
        if (placaInput) placaInput.value = '';
        if (incEstInput) incEstInput.value = '';
        
        // garantir data inicial e validade preenchidas
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

    // Disparar evento de fechamento (útil para promessas de confirm)
    try {
        const ev = new CustomEvent('modal:closed', { detail: { id: modalId }});
        document.dispatchEvent(ev);
    } catch {}
}

// Modal universal: Alert/Confirm
function showAlert(message, options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('universal-modal');
        const titleEl = document.getElementById('universal-modal-title');
        const msgEl = document.getElementById('universal-modal-message');
        const okBtn = document.getElementById('universal-ok');
        const cancelBtn = document.getElementById('universal-cancel');
        if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) { window.alert(message); return resolve(true); }
        titleEl.textContent = options.title || 'Aviso';
        msgEl.textContent = message;
        cancelBtn.style.display = 'none';
        okBtn.textContent = options.okText || 'OK';
        // Variant handling (e.g., danger)
        const variant = options.variant || '';
        if (variant) modal.setAttribute('data-variant', variant);
        const cleanup = () => {
            okBtn.removeEventListener('click', onOk);
            document.removeEventListener('keydown', onKey);
            modal.removeAttribute('data-variant');
        };
        const onOk = () => { cleanup(); closeModal('universal-modal'); resolve(true); };
        const onKey = (e) => { if (e.key === 'Enter' || e.key === 'Escape') { cleanup(); closeModal('universal-modal'); resolve(true); } };
        okBtn.addEventListener('click', onOk);
        document.addEventListener('keydown', onKey, { once: true });
        openModal('universal-modal');
    });
}

function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('universal-modal');
        const titleEl = document.getElementById('universal-modal-title');
        const msgEl = document.getElementById('universal-modal-message');
        const okBtn = document.getElementById('universal-ok');
        const cancelBtn = document.getElementById('universal-cancel');
        if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) { const r = window.confirm(message); return resolve(!!r); }
        titleEl.textContent = options.title || 'Confirmação';
        msgEl.textContent = message;
        cancelBtn.style.display = '';
        okBtn.textContent = options.okText || 'Confirmar';
        cancelBtn.textContent = options.cancelText || 'Cancelar';
        // Variant: infer from options or keywords in title
        const shouldDanger = (options.variant === 'danger') || /excluir|remover|apagar|deletar/i.test(options.title || '');
        if (shouldDanger) modal.setAttribute('data-variant', 'danger');
        let resolved = false;
        const cleanup = () => {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('modal:closed', onClose);
            modal.removeAttribute('data-variant');
        };
        const onOk = () => { if (resolved) return; resolved = true; cleanup(); closeModal('universal-modal'); resolve(true); };
        const onCancel = () => { if (resolved) return; resolved = true; cleanup(); closeModal('universal-modal'); resolve(false); };
        const onKey = (e) => { if (e.key === 'Escape') { onCancel(); } if (e.key === 'Enter') { onOk(); } };
        const onClose = (e) => { if (e.detail && e.detail.id === 'universal-modal' && !resolved) { resolved = true; cleanup(); resolve(false); } };
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKey);
        document.addEventListener('modal:closed', onClose);
        openModal('universal-modal');
    });
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
    if (items.length === 0) { showAlert('Adicione pelo menos um item ao orçamento', { title: 'Atenção' }); return; }
    const subtotal = items.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    const total = subtotal;
    // Validação: cliente selecionado
    const clienteIdRaw = formData.get('cliente');
    if (!clienteIdRaw) { showAlert('Selecione um cliente na busca', { title: 'Atenção' }); return; }
    const orcamento = {
        id: state.currentEditId || generateOrcamentoId(),
        clienteId: parseInt(clienteIdRaw),
        data: formData.get('data'),
        dataFinal: formData.get('dataFinal') || '',
        observacao: (formData.get('observacao') || '').toString().trim(),
        carro: (formData.get('carro') || '').toString().trim(),
        placa: (formData.get('placa') || '').toString().trim(),
        incEst: (formData.get('incEst') || '').toString().trim(),
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
// Delegated renderers: now provided by section scripts
function renderAllLists() {
    if (typeof renderClientes === 'function') renderClientes();
    if (typeof renderPecas === 'function') renderPecas();
    if (typeof renderServicos === 'function') renderServicos();
    if (typeof renderOrcamentos === 'function') renderOrcamentos();
}

// Funções de edição
// Editing and filter functions are now provided by section modules (delegated)

// Funções de exclusão
// Deletion is handled in section modules; keep only state/save helpers here if needed

// Editar orçamento: abre modal preenchendo dados e itens
function editOrcamento(id) {
    const orcamento = state.orcamentos.find(o => String(o.id) === String(id));
    if (!orcamento) return;

    // Sinalizar modo edição antes de abrir (para initClienteSearch pré-preencher)
    state.currentEditId = orcamento.id;
    openModal('orcamento-modal');

    const form = document.getElementById('orcamento-form');
    if (!form) return;

    // Título
    const h = document.querySelector('#orcamento-modal h3');
    if (h) h.textContent = 'Editar Orçamento';

    // Cliente (defensivo caso initClienteSearch não tenha preenchido)
    const inputClienteBusca = form.querySelector('input[name="clienteBusca"]');
    const inputCliente = form.querySelector('input[name="cliente"]');
    const cliente = state.clientes.find(c => String(c.id) === String(orcamento.clienteId));
    if (cliente) {
        if (inputCliente) inputCliente.value = String(cliente.id);
        if (inputClienteBusca) inputClienteBusca.value = cliente.nome;
    }

    // Datas
    const dataEl = form.querySelector('input[name="data"]');
    const dataFinalEl = form.querySelector('input[name="dataFinal"]');
    if (dataEl) dataEl.value = orcamento.data || '';
    if (dataFinalEl) dataFinalEl.value = orcamento.dataFinal || '';

    // Veículo e observação
    const carroEl = form.querySelector('input[name="carro"]');
    const placaEl = form.querySelector('input[name="placa"]');
    const incEstEl = form.querySelector('input[name="incEst"]');
    const obsEl = form.querySelector('textarea[name="observacao"]');
    if (carroEl) carroEl.value = orcamento.carro || '';
    if (placaEl) placaEl.value = orcamento.placa || '';
    if (incEstEl) incEstEl.value = orcamento.incEst || '';
    if (obsEl) obsEl.value = orcamento.observacao || '';

    // Itens
    clearOrcamentoItems();
    (orcamento.items || []).forEach(item => {
        // Adiciona bloco do item e preenche
        addOrcamentoItem(item.tipo);
        const container = document.getElementById('orcamento-items-list');
        const last = container && container.lastElementChild;
        if (!last) return;
        const select = last.querySelector('.item-select');
        const qtd = last.querySelector('.item-quantidade');
        const preco = last.querySelector('.item-preco');

        // Garantir que o option exista mesmo se catálogo mudou
        if (select) {
            const exists = Array.from(select.options).some(opt => String(opt.value) === String(item.itemId));
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = String(item.itemId);
                opt.textContent = item.nome || `Item ${item.itemId}`;
                select.appendChild(opt);
            }
            select.value = String(item.itemId);
        }
        if (qtd) qtd.value = String(item.quantidade || 1);
        if (preco) preco.value = String(item.preco != null ? item.preco : 0);

        // Atualiza subtotal desse item
        const evt = new Event('input');
        qtd && qtd.dispatchEvent(evt);
        preco && preco.dispatchEvent(evt);
    });
    updateOrcamentoTotal();
}

// Excluir orçamento: confirmação e atualização de lista/dashboard
function deleteOrcamento(id) {
    const idx = state.orcamentos.findIndex(o => String(o.id) === String(id));
    if (idx === -1) return;
    showConfirm('Tem certeza que deseja excluir este orçamento?', { title: 'Excluir orçamento' }).then((ok) => {
        if (!ok) return;
        state.orcamentos.splice(idx, 1);
        saveToStorage();
        if (typeof renderOrcamentos === 'function') renderOrcamentos();
        updateDashboard();
    });
}

// Função para visualizar orçamento (modal de detalhes)
function viewOrcamento(id) {
    const orcamento = state.orcamentos.find(o => String(o.id) === String(id));
    if (!orcamento) return;
    const cliente = state.clientes.find(c => c.id === orcamento.clienteId);

    // Header
    const idEl = document.getElementById('view-orcamento-id');
    if (idEl) idEl.textContent = `#${orcamento.id}`;

    // Datas
    const validadeIso = orcamento.dataFinal || (() => { const d = new Date(orcamento.data + 'T00:00:00'); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]; })();
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText('view-cliente-nome', cliente ? cliente.nome : 'Cliente não encontrado');
    setText('view-data', formatDate(orcamento.data));
    setText('view-validade', formatDate(validadeIso));
    setText('view-email', cliente?.email || 'Não informado');
    setText('view-telefone', cliente?.telefone || 'Não informado');

    // Badge de status
    const badge = document.getElementById('cliente-status-badge');
    if (badge) {
        badge.className = 'status-badge';
        badge.classList.add(`status-${orcamento.status}`);
        badge.textContent = orcamento.status.toUpperCase();
    }

    // Itens
    const tbody = document.getElementById('view-itens-list');
    if (tbody) {
        tbody.innerHTML = (orcamento.items || []).map(item => {
            const sub = (item.quantidade * item.preco);
            return `<tr>
                <td>${item.nome}</td>
                <td>${item.quantidade}</td>
                <td>R$ ${item.preco.toFixed(2).replace('.', ',')}</td>
                <td>R$ ${sub.toFixed(2).replace('.', ',')}</td>
            </tr>`;
        }).join('');
    }

    // Total
    const totalEl = document.getElementById('view-total-valor');
    if (totalEl) totalEl.textContent = `R$ ${orcamento.total.toFixed(2).replace('.', ',')}`;

    // Controles de status
    const modal = document.getElementById('view-orcamento-modal');
    if (modal) {
        const segPend = modal.querySelector('#seg-pendente');
        const segApr = modal.querySelector('#seg-aprovado');
        const setActive = (status) => {
            segPend?.classList.toggle('active', status === 'pendente');
            segApr?.classList.toggle('active', status === 'aprovado');
        };
        setActive(orcamento.status);
        segPend?.addEventListener('click', () => { toggleOrcamentoStatus(orcamento.id, 'pendente'); setActive('pendente'); });
        segApr?.addEventListener('click', () => { toggleOrcamentoStatus(orcamento.id, 'aprovado'); setActive('aprovado'); });
    }

    openModal('view-orcamento-modal');
}

// Função para visualizar orçamento
function handleOrcamentoSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const proceedSave = () => {
        const formData = new FormData(form);
        const items = collectOrcamentoItems();
        if (items.length === 0) { showAlert('Adicione pelo menos um item ao orçamento', { title: 'Atenção' }); return; }
        const subtotal = items.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
        const total = subtotal;
        const clienteIdRaw = formData.get('cliente');
        if (!clienteIdRaw) { showAlert('Selecione um cliente na busca', { title: 'Atenção' }); return; }
        const orcamento = {
            id: state.currentEditId || generateOrcamentoId(),
            clienteId: parseInt(clienteIdRaw),
            data: formData.get('data'),
            dataFinal: formData.get('dataFinal') || '',
            observacao: (formData.get('observacao') || '').toString().trim(),
            carro: (formData.get('carro') || '').toString().trim(),
            placa: (formData.get('placa') || '').toString().trim(),
            incEst: (formData.get('incEst') || '').toString().trim(),
            items,
            subtotal,
            total,
            status: state.currentEditId ? (state.orcamentos.find(o => String(o.id) === String(state.currentEditId))?.status || 'pendente') : 'pendente'
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
    };

    if (state.currentEditId) {
        showConfirm('Deseja realmente salvar as alterações deste orçamento?', { title: 'Salvar alterações', okText: 'Salvar', cancelText: 'Cancelar' }).then(ok => {
            if (ok) proceedSave();
        });
    } else {
        proceedSave();
    }
}

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
    // Keep global reference updated for external modules
    window.state = state;
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
// moved to print.js
// function printOrcamento(id) { ... }

// Share buttons in print preview modal
// moved to print.js

function getCurrentOrcamentoCliente() {
    const orcamentoId = getPreviewOrcamentoId();
    if (!orcamentoId) return null;
    
    const orcamento = state.orcamentos.find(o => String(o.id) === String(orcamentoId));
    if (!orcamento || !orcamento.clienteId) return null;
    
    return state.clientes.find(c => String(c.id) === String(orcamento.clienteId));
}

// moved to print.js

// Função robusta para converter imagens locais para base64
// moved to print.js

// Função para substituir imagem por placeholder
// moved to print.js

// Função para pré-carregar e converter logo da empresa
// moved to print.js

// Função para mostrar notificação sobre fallback de imagem
// moved to print.js

// Alternar entre as diferentes vias na pré-visualização
// moved to print.js

// moved to print.js

// moved to print.js



// moved to print.js

// moved to print.js

// Helpers removidos da visualização; ações serão oferecidas no modal de pré-visualização

// Gerar HTML da pré-visualização do orçamento
function generateOrcamentoPreview(orcamento, cliente, tipoVia = 'vendedor') {
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

    // Determinar configurações baseado no tipo de via
    const showValues = tipoVia !== 'funcionarios'; // Funcionários não veem valores
    const isClientCopy = tipoVia === 'cliente'; // Via do cliente tem marca "CÓPIA"
    
    // Gerar linhas dos itens baseado no tipo de via
    let itemsHtml = '';
    let subtotal = 0;

    orcamento.items.forEach((item, index) => {
        const itemSubtotal = item.quantidade * item.preco;
        subtotal += itemSubtotal;

        if (tipoVia === 'funcionarios') {
            // Via dos funcionários: sem valores, apenas descrições e quantidades
            itemsHtml += `
                <tr>
                    <td>
                        <div class="item-description">
                            <div class="item-name">${item.nome}</div>
                            <span class="item-tipo tipo-${item.tipo}">${item.tipo.toUpperCase()}</span>
                        </div>
                    </td>
                    <td class="text-center">${item.quantidade}</td>
                    <td class="text-center status-checkbox">☐ OK</td>
                    <td class="funcionario-obs">____________</td>
                </tr>
            `;
        } else {
            // Via do vendedor e cliente: com valores completos
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
        }
    });

    // Veículo removido do layout

    // Desconto removido

    // Definir título da via
    const viaTitle = {
        'vendedor': 'VIA DO VENDEDOR',
        'cliente': 'VIA DO CLIENTE',
        'funcionarios': 'VIA PARA SERVIÇOS'
    }[tipoVia] || 'VIA DO VENDEDOR';

    return `
        <div class="orcamento-document via-${tipoVia}">
            ${isClientCopy ? '<div class="watermark-copia">CÓPIA</div>' : ''}
            
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
                    <div class="via-identificacao">${viaTitle}</div>
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

            <!-- Dados do Veículo -->
            ${(orcamento.carro || orcamento.placa || orcamento.incEst) ? `
            <div class="cliente-section">
                <h3 class="section-title">Veículo</h3>
                <div class="cliente-card">
                    <div class="cliente-grid">
                        ${orcamento.carro ? `
                        <div class="cliente-field">
                            <div class="field-label">Carro</div>
                            <div class="field-value">${orcamento.carro}</div>
                        </div>
                        ` : ''}
                        ${orcamento.placa ? `
                        <div class="cliente-field">
                            <div class="field-label">Placa</div>
                            <div class="field-value">${orcamento.placa}</div>
                        </div>
                        ` : ''}
                        ${orcamento.incEst ? `
                        <div class="cliente-field">
                            <div class="field-label">Inc. Est. / CIC</div>
                            <div class="field-value">${orcamento.incEst}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Itens do Orçamento -->
            <div class="itens-section">
                <h3 class="section-title">${tipoVia === 'funcionarios' ? 'Peças e Serviços a Executar' : 'Itens'}</h3>
                <table class="itens-table">
                    <thead>
                        <tr>
                            <th>Descrição</th>
                            <th class="text-center">Qtd</th>
                            ${showValues ? '<th class="text-right">Unit.</th>' : '<th class="text-center">Conferido</th>'}
                            ${showValues ? '<th class="text-right">Total</th>' : '<th class="text-center">Observações</th>'}
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                ${showValues ? `
                <!-- Totais -->
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
                ` : `
                <!-- Área para Anotações dos Funcionários -->
                <div class="funcionarios-notes">
                    <h4>Anotações dos Serviços:</h4>
                    <div class="notes-lines">
                        <div class="note-line"></div>
                        <div class="note-line"></div>
                        <div class="note-line"></div>
                        <div class="note-line"></div>
                        <div class="note-line"></div>
                        <div class="note-line"></div>
                        <div class="note-line"></div>
                    </div>
                </div>
                `}
            </div>

            ${orcamento.observacao && tipoVia !== 'funcionarios' ? `
            <div class="itens-section">
                <h3 class="section-title">Observação</h3>
                <div class="cliente-card" style="padding:16px;">
                    <div style="white-space:pre-wrap; color: var(--text-secondary);">${(orcamento.observacao || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                </div>
            </div>` : ''}

            ${tipoVia !== 'funcionarios' ? `
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
            ` : ''}
        </div>
    `;
}

// Função para gerar todas as 3 vias do documento
// moved to print.js

// Detectar tipo de dispositivo
// moved to print.js

// Função para impressão via PDF (fallback para dispositivos móveis)
// moved to print.js

// Função principal de impressão com detecção de dispositivo
// moved to print.js

// Mostrar opções de impressão para dispositivos móveis
// moved to print.js

// Tentar impressão direta mesmo em dispositivos móveis
// moved to print.js

// Aguardar carregamento de imagens em elemento
// moved to print.js

// Estilos para impressão em dispositivos móveis
// moved to print.js

// Função para obter estilos inline para impressão
// moved to print.js

// Carregar dados de exemplo se não houver dados
setTimeout(() => {
    if (state.clientes.length === 0 && state.pecas.length === 0 && state.servicos.length === 0) {
        loadSampleData();
        renderAllLists();
        updateDashboard();
    }
}, 1000);

// Explicitly expose commonly used functions for inline handlers and other modules
Object.assign(window, {
    openModal,
    closeModal,
    navigateToSection,
    formatDate,
    viewOrcamento,
    editOrcamento,
    deleteOrcamento,
    addOrcamentoItem,
    removeOrcamentoItem,
    updateOrcamentoTotal,
    filterOrcamentos,
    filterClientes,
    filterPecas,
    filterServicos,
    renderAllLists
});