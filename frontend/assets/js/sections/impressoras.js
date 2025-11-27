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
        const el = document.getElementById('sidebar-printer-indicator');
        if (el) {
          const dot = el.querySelector('.dot');
          const label = el.querySelector('.label');
          dot.className = 'dot red';
          label.textContent = 'Impressão de rede desativada';
        }
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
            alert('Conexão desativada: impressão de rede foi removida.');
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
            els.results.innerHTML = '<div class="empty">Funcionalidade desativada</div>';
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
