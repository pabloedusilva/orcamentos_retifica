(function(){
  const els = {};

  async function init() {
    els.ipInput = document.getElementById('printer-ip-input');
    els.connectBtn = document.getElementById('printer-connect-btn');
    els.scanBtn = document.getElementById('printer-scan-btn');
    els.results = document.getElementById('printer-scan-results');
    els.current = document.getElementById('printer-current');
    bind();
    await refreshCurrent();
  }

  function setIndicator(status){
    const indicator = document.getElementById('sidebar-printer-indicator');
    if (!indicator) return;
    const { ip, reachable } = status || {};
    const dotClass = reachable ? 'gray' : 'red';
    const text = ip ? `Impressora: ${ip}` : 'Impressora: não conectada';
    indicator.innerHTML = `<span class="dot ${dotClass}"></span><span>${text}</span>`;
  }

  async function refreshCurrent() {
    try {
      const cur = await api.getPrinterCurrent();
      setIndicator(cur);
      els.current.textContent = cur.ip ? `Conectada: ${cur.ip} ${cur.reachable ? '(online)' : '(offline)'}` : 'Nenhuma impressora conectada';
    } catch(e) {
      console.error(e);
    }
  }

  function bind(){
    if (els.connectBtn) {
      els.connectBtn.addEventListener('click', async () => {
        const ip = (els.ipInput.value || '').trim();
        if (!ip) { showAlert('Digite um IP válido.', { title: 'Atenção' }); return; }
        try{
          const res = await api.connectPrinter(ip);
          await refreshCurrent();
          showAlert('Impressora conectada com sucesso.', { title: 'Pronto' });
        } catch(err){
          showAlert(err.message || 'Falha ao conectar na impressora.', { title: 'Erro' });
        }
      });
    }
    if (els.scanBtn) {
      els.scanBtn.addEventListener('click', async () => {
        els.scanBtn.disabled = true;
        els.scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Escaneando...';
        els.results.innerHTML = '';
        try {
          const data = await api.scanPrinters();
          if (!data.printers || !data.printers.length) {
            els.results.innerHTML = '<div class="empty">Nenhuma impressora encontrada na sub-rede.</div>';
          } else {
            const frag = document.createDocumentFragment();
            data.printers.forEach(p => {
              const div = document.createElement('div');
              div.className = 'printer-card';
              div.innerHTML = `
                <div class="printer-id"><span class="dot gray"></span><span>${p.ip}</span></div>
                <div>
                  <button class="btn btn-sm" data-ip="${p.ip}"><i class="fas fa-plug"></i> Conectar</button>
                </div>`;
              div.querySelector('button').addEventListener('click', async () => {
                els.ipInput.value = p.ip;
                els.connectBtn.click();
              });
              frag.appendChild(div);
            });
            els.results.appendChild(frag);
          }
        } catch(e){
          showAlert('Falha ao escanear impressoras.', { title: 'Erro' });
        } finally {
          els.scanBtn.disabled = false;
          els.scanBtn.innerHTML = '<i class="fas fa-search"></i> Escanear impressoras';
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
