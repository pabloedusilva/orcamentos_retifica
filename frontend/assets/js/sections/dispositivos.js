// Section: Dispositivos (Impressoras)
(function(){
  if (window.__dispositivosSectionInitialized) return;
  window.__dispositivosSectionInitialized = true;

  function mount(){
    const section = document.getElementById('dispositivos');
    if (!section) return;
    buildDevicesControls(section);
    refreshDevicesList();
  }

  async function refreshDevicesList(){
    const tbody = document.getElementById('devices-list');
    if (!tbody) return;
    try {
      const data = await api.listPrinters();
      const list = data.printers || [];
      tbody.innerHTML = '';
      list.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${p.name}</td>
          <td>${p.host}</td>
          <td>${String(p.protocol).toUpperCase()}</td>
          <td>${p.port}</td>
          <td>${p.isConnected ? '<span class="badge badge-success">Conectado</span>' : '<span class="badge">—</span>'}</td>
          <td>
            ${p.isConnected
              ? `<button class="btn btn-secondary btn-sm device-disconnect" data-action="disconnect" data-id="${p.id}" title="Desconectar"><i class="fas fa-unlink"></i></button>`
              : `<button class="btn btn-primary btn-sm device-connect" data-action="connect" data-id="${p.id}" title="Conectar"><i class="fas fa-plug"></i></button>`}
            <button class="btn btn-info btn-sm" data-action="test" data-id="${p.id}" title="Testar conexão"><i class="fas fa-wifi"></i></button>
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${p.id}" title="Remover"><i class="fas fa-trash"></i></button>
          </td>`;
        tbody.appendChild(tr);
      });

      // Actions
      tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await (window.showConfirm ? showConfirm('Remover este dispositivo?', { title: 'Remover', variant: 'danger' }) : Promise.resolve(confirm('Remover este dispositivo?')));
          if (!ok) return;
          const id = btn.getAttribute('data-id');
          try {
            await api.deletePrinter(id);
            await refreshDevicesList();
            if (window.refreshPrinterBadge) window.refreshPrinterBadge();
          } catch(e){ showAlert('Falha ao remover', { title: 'Erro' }); }
        });
      });
      // Connect
      tbody.querySelectorAll('button[data-action="connect"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          // subtle animation: spinner while testing/connecting
          const oldHtml = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
          try {
            // Pre-test via backend
            const row = btn.closest('tr');
            const host = row.children[1].textContent.trim();
            const protocol = row.children[2].textContent.trim().toLowerCase() === 'ipp' ? 'ipp' : 'raw9100';
            const port = parseInt(row.children[3].textContent.trim(), 10);
            const test = await api.testPrinter({ host, protocol, port });
            if (!test || !test.ok) { showAlert('Falha ao conectar: dispositivo inacessível.', { title: 'Erro' }); return; }
            // Connect
            await api.connectPrinter(id);
            await refreshDevicesList();
            if (window.refreshPrinterBadge) window.refreshPrinterBadge();
            showAlert('Conectado com sucesso.', { title: 'Pronto' });
          } catch(e){ showAlert('Falha ao conectar.', { title: 'Erro' }); }
          finally { btn.innerHTML = oldHtml; btn.disabled = false; }
        });
      });
      // Disconnect
      tbody.querySelectorAll('button[data-action="disconnect"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const oldHtml = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
          try {
            await api.disconnectPrinter(id);
            await refreshDevicesList();
            if (window.refreshPrinterBadge) window.refreshPrinterBadge();
            showAlert('Desconectado.', { title: 'Pronto' });
          } catch(e){ showAlert('Falha ao desconectar.', { title: 'Erro' }); }
          finally { btn.innerHTML = oldHtml; btn.disabled = false; }
        });
      });
      // Test Wi-Fi (only for connected)
      tbody.querySelectorAll('button[data-action="test"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const row = btn.closest('tr');
          const isConnected = row.children[4].textContent.includes('Conectado');
          if (!isConnected) { showAlert('Conecte este dispositivo para testar a conexão.', { title: 'Atenção' }); return; }
          const oldHtml = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
          try {
            const host = row.children[1].textContent.trim();
            const protocol = row.children[2].textContent.trim().toLowerCase() === 'ipp' ? 'ipp' : 'raw9100';
            const port = parseInt(row.children[3].textContent.trim(), 10);
            const res = await api.testPrinter({ host, protocol, port });
            if (res && res.ok) {
              const ms = res.test && res.test.elapsedMs ? `${res.test.elapsedMs}ms` : '';
              showAlert(`Conexão OK (${protocol.toUpperCase()} em ${host}:${port}) ${ms ? '- ' + ms : ''}`, { title: 'Pronto' });
            } else {
              showAlert('Não conectou. Verifique IP/porta/protocolo.', { title: 'Atenção' });
            }
          } catch(e){ showAlert('Erro ao testar conexão.', { title: 'Erro' }); }
          finally { btn.innerHTML = oldHtml; btn.disabled = false; }
        });
      });
    } catch {}
  }

  function buildDevicesControls(section){
    // Create a card above table for adding devices
    let card = document.getElementById('devices-add-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'devices-add-card';
      card.className = 'settings-card';
      card.innerHTML = `
        <div class="settings-section">
          <h3 class="settings-title">Adicionar Impressora</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Nome do dispositivo</label>
              <input type="text" id="device-name" placeholder="Ex.: Balcão, Escritório" />
            </div>
            <div class="form-group">
              <label>IP/Host</label>
              <input type="text" id="device-host" placeholder="Ex.: 192.168.0.50" />
            </div>
            <div class="form-group">
              <label>Protocolo</label>
              <select id="device-protocol">
                <option value="ipp">IPP</option>
                <option value="raw9100">RAW 9100</option>
              </select>
            </div>
            <div class="form-group">
              <label>Porta</label>
              <input type="number" id="device-port" placeholder="Ex.: 631 (IPP) ou 9100 (RAW)" />
            </div>
            <div class="form-group span-2" id="device-path-group" style="display:none;">
              <label>Caminho IPP (opcional)</label>
              <input type="text" id="device-path" placeholder="Ex.: /ipp/print" />
            </div>
          </div>
          <div class="settings-actions">
            <div class="spacer"></div>
            <button class="btn btn-secondary" id="device-test-btn" title="Testar conexão"><i class="fas fa-wifi"></i> Testar conexão</button>
            <button class="btn btn-primary" id="device-add-btn"><i class="fas fa-plus"></i> Adicionar</button>
          </div>
        </div>`;
      const header = section.querySelector('.section-header');
      header?.insertAdjacentElement('afterend', card);
    }

    const protoSel = document.getElementById('device-protocol');
    const portInput = document.getElementById('device-port');
    const pathGroup = document.getElementById('device-path-group');
    const pathInput = document.getElementById('device-path');
    protoSel.addEventListener('change', () => {
      const proto = protoSel.value;
      pathGroup.style.display = proto === 'ipp' ? '' : 'none';
      if (proto === 'ipp') {
        if (!portInput.value) portInput.value = '631';
      } else {
        if (!portInput.value || portInput.value === '631') portInput.value = '9100';
      }
    });

    async function gatherForm(){
      const name = document.getElementById('device-name').value.trim();
      const host = document.getElementById('device-host').value.trim();
      const protocol = protoSel.value;
      const port = parseInt(portInput.value || (protocol === 'ipp' ? '631' : '9100'), 10);
      const p = pathInput.value.trim();
      return { name, host, protocol, port, path: p };
    }

    document.getElementById('device-test-btn')?.addEventListener('click', async () => {
      const { name, host, protocol, port, path } = await gatherForm();
      if (!host || !port) { showAlert('Informe host e porta para testar.', { title: 'Atenção' }); return; }
      try {
        const res = await api.testPrinter({ host, protocol, port, path: path || null });
        if (res && res.ok) {
          const ms = res.test && res.test.elapsedMs ? `${res.test.elapsedMs}ms` : '';
          showAlert(`Conexão OK (${protocol.toUpperCase()} em ${host}:${port}) ${ms ? '- ' + ms : ''}`, { title: 'Pronto' });
        } else {
          showAlert('Não conectou ao dispositivo informado. Verifique IP/porta/protocolo.', { title: 'Atenção' });
        }
      } catch (e) {
        showAlert('Erro ao testar conexão.', { title: 'Erro' });
      }
    });

    document.getElementById('device-add-btn')?.addEventListener('click', async () => {
      const { name, host, protocol, port, path } = await gatherForm();
      if (!name || !host || !port) {
        showAlert('Preencha nome, host e porta.', { title: 'Atenção' });
        return;
      }
      try {
        // Pre-check connectivity
        let canProceed = true;
        let testOk = false;
        try {
          const testRes = await api.testPrinter({ host, protocol, port, path: path || null });
          testOk = !!(testRes && testRes.ok);
          if (!testOk) {
            canProceed = confirm('Não conectou. Deseja adicionar mesmo assim?');
          }
        } catch { canProceed = confirm('Falha ao testar. Deseja adicionar mesmo assim?'); }
        if (!canProceed) return;
  const body = { name, host, protocol, port, path: path || null, isConnected: false };
        if (!testOk) body.force = true; // allow backend to skip validation if forced
        await api.createPrinter(body);
        document.getElementById('device-name').value = '';
        document.getElementById('device-host').value = '';
        if (protocol === 'ipp') portInput.value = '631'; else portInput.value = '9100';
        pathInput.value = '';
        refreshDevicesList();
      } catch (e) { showAlert(e?.message || 'Falha ao adicionar impressora', { title: 'Erro' }); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else { setTimeout(mount, 0); }
})();
