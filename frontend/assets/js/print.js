// Print/Preview/Share module - all print-related logic centralized here.
(function(G){
  'use strict';

  // Dependencies expected from app.js: state, formatDate, openModal

  // Utils
  function getAppState() {
    const s = G.state || window.state || {};
    // Provide safe defaults to avoid runtime errors
    if (!s.clientes) s.clientes = [];
    if (!s.orcamentos) s.orcamentos = [];
    if (!s.company) s.company = {};
    return s;
  }
  function getPreviewOrcamentoId() {
    const doc = document.querySelector('.orcamento-document .orcamento-number');
    if (!doc) return null;
    const text = doc.textContent || '';
    const match = text.match(/#([\w-]+)/);
    return match ? match[1] : null;
  }

  function getCurrentViaType() {
    const activeBtn = document.querySelector('.btn-via.active');
    if (!activeBtn) return 'vendedor';
    const onclickAttr = activeBtn.getAttribute('onclick');
    const match = onclickAttr && onclickAttr.match(/switchViaPreview\('([^']+)'\)/);
    return match ? match[1] : 'vendedor';
  }

  async function convertLocalImageToBase64Safe(imgSrc) {
    return new Promise((resolve) => {
      try {
        if (imgSrc.startsWith('data:')) return resolve(imgSrc);
        const filename = imgSrc.split('/').pop();
        const existingImg = document.querySelector(`img[src*="${filename}"]`);
        if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = existingImg.naturalWidth;
            canvas.height = existingImg.naturalHeight;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(existingImg, 0, 0);
            return resolve(canvas.toDataURL('image/png', 1.0));
          } catch(e) { /* fallthrough */ }
        }
        const img = new Image();
        img.onload = function() {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = this.naturalWidth || this.width;
            canvas.height = this.naturalHeight || this.height;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(this, 0, 0);
            resolve(canvas.toDataURL('image/png', 1.0));
          } catch(err) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 8000);
        img.src = imgSrc;
      } catch(err) {
        resolve(null);
      }
    });
  }

  function replaceImageWithPlaceholder(imgElement) {
    const placeholder = document.createElement('div');
    placeholder.style.cssText = `
      width: 100px;height: 60px;background: linear-gradient(135deg,#f8f9fa 0%,#e9ecef 100%);
      border: 2px solid #dee2e6;border-radius: 4px;display:flex;align-items:center;justify-content:center;
      font-size:9px;color:#495057;text-align:center;font-weight:600;line-height:1.1;font-family:Arial,sans-serif;
      box-shadow:0 1px 3px rgba(0,0,0,0.1);
    `;
    placeholder.innerHTML = '<div>LOGO DA<br>EMPRESA</div>';
    if (imgElement.parentNode) imgElement.parentNode.replaceChild(placeholder, imgElement);
  }

  async function preloadCompanyLogo() {
    const company = getAppState().company || {};
    if (company.logoDataUrl && company.logoDataUrl.startsWith('data:')) return company.logoDataUrl;
    const logoImg = document.querySelector('.brand-logo-rect, .company-logo img');
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = logoImg.naturalWidth;
        canvas.height = logoImg.naturalHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(logoImg, 0, 0);
        const logoBase64 = canvas.toDataURL('image/png', 1.0);
        if (G.state?.company) G.state.company.logoDataUrl = logoBase64;
        return logoBase64;
      } catch(e) {}
    }
    return null;
  }

  let imageFallbackShown = false;
  function showImageFallbackNotification() {
    if (imageFallbackShown) return;
    imageFallbackShown = true;
    const n = document.createElement('div');
    n.style.cssText = `position:fixed;top:20px;right:20px;background:#d1ecf1;border:1px solid #bee5eb;color:#0c5460;
      padding:12px 16px;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,0.1);z-index:10000;font-size:13px;max-width:300px;line-height:1.4;`;
    n.innerHTML = '<strong>🔄 Processando:</strong><br>Convertendo imagens para garantir melhor qualidade no PDF...';
    document.body.appendChild(n);
    setTimeout(()=>{ if(n.parentNode) n.parentNode.removeChild(n); },3000);
  }

  // HTML generators
  function generateOrcamentoPreview(orcamento, cliente, tipoVia = 'vendedor') {
    const hoje = new Date();
    const c = (G.state && G.state.company) || {};
    const dataFormatada = G.formatDate(orcamento.data);
    const validadeIso = (function(){
      if (orcamento.dataFinal) return orcamento.dataFinal;
      const base = new Date(orcamento.data + 'T00:00:00');
      base.setFullYear(base.getFullYear() + 1);
      return base.toISOString().split('T')[0];
    })();
    const validadeFormatada = G.formatDate(validadeIso);
    const dataEmissao = hoje.toLocaleDateString('pt-BR');
    const horaEmissao = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const statusClass = `status-${orcamento.status}-print`;
    const statusText = orcamento.status.charAt(0).toUpperCase() + orcamento.status.slice(1);
    const clienteInfo = cliente ? {
      nome: cliente.nome,
      email: cliente.email || 'Não informado',
      telefone: cliente.telefone || 'Não informado',
      documento: cliente.documento || 'Não informado',
      endereco: cliente.endereco || 'Não informado',
      cidade: cliente.cidade || 'Não informado'
    } : { nome: 'Cliente não encontrado', email: 'N/A', telefone: 'N/A', documento: 'N/A', endereco: 'N/A', cidade: 'N/A' };
    const showValues = tipoVia !== 'funcionarios';
    const isClientCopy = tipoVia === 'cliente';
    let itemsHtml = '';
    let subtotal = 0;
    orcamento.items.forEach(item => {
      const preco = Number(item.preco) || 0;
      const qtd = Number(item.quantidade) || 1;
      const itemSubtotal = qtd * preco;
      subtotal += itemSubtotal;
      if (tipoVia === 'funcionarios') {
        itemsHtml += `
          <tr>
            <td>
              <div class="item-description">
                <div class="item-name">${item.nome}</div>
                <span class="item-tipo tipo-${item.tipo}">${item.tipo.toUpperCase()}</span>
              </div>
            </td>
            <td class="text-center">${qtd}</td>
            <td class="text-center status-checkbox">☐ OK</td>
            <td class="funcionario-obs">____________</td>
          </tr>`;
      } else {
        itemsHtml += `
          <tr>
            <td>
              <div class="item-description">
                <div class="item-name">${item.nome}</div>
                <span class="item-tipo tipo-${item.tipo}">${item.tipo.toUpperCase()}</span>
              </div>
            </td>
            <td class="text-center">${qtd}</td>
            <td class="text-right font-mono">R$ ${preco.toFixed(2).replace('.', ',')}</td>
            <td class="text-right font-mono">R$ ${itemSubtotal.toFixed(2).replace('.', ',')}</td>
          </tr>`;
      }
    });
    const viaTitle = { vendedor: 'VIA DO VENDEDOR', cliente: 'VIA DO CLIENTE', funcionarios: 'VIA PARA SERVIÇOS' }[tipoVia] || 'VIA DO VENDEDOR';
    return `
      <div class="orcamento-document via-${tipoVia}">
        ${isClientCopy ? '<div class="watermark-copia">CÓPIA</div>' : ''}
        <div class="orcamento-header">
          <div class="company-info">
            <div class="company-logo">${c.logoDataUrl ? `<img src="${c.logoDataUrl}" alt="Logo" />` : ''}</div>
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
              <div class="detail-row"><span class="detail-label">Data:</span><span class="detail-value">${dataFormatada}</span></div>
              <div class="detail-row"><span class="detail-label">Emissão:</span><span class="detail-value">${dataEmissao} ${horaEmissao}</span></div>
              <div class="detail-row"><span class="detail-label">Validade:</span><span class="detail-value">${validadeFormatada}</span></div>
            </div>
            <div class="orcamento-status ${statusClass}">${statusText}</div>
          </div>
        </div>
        <div class="cliente-section">
          <h3 class="section-title">Cliente</h3>
          <div class="cliente-card">
            <div class="cliente-name">${clienteInfo.nome}</div>
            <div class="cliente-grid">
              <div class="cliente-field"><div class="field-label">E-mail</div><div class="field-value">${clienteInfo.email}</div></div>
              <div class="cliente-field"><div class="field-label">Telefone</div><div class="field-value">${clienteInfo.telefone}</div></div>
              <div class="cliente-field"><div class="field-label">Documento</div><div class="field-value">${clienteInfo.documento}</div></div>
              <div class="cliente-field"><div class="field-label">Endereço</div><div class="field-value">${clienteInfo.endereco}</div></div>
              <div class="cliente-field"><div class="field-label">Cidade</div><div class="field-value">${clienteInfo.cidade}</div></div>
            </div>
          </div>
        </div>
        ${(orcamento.carro || orcamento.placa || orcamento.incEst) ? `
        <div class="cliente-section">
          <h3 class="section-title">Veículo</h3>
          <div class="cliente-card"><div class="cliente-grid">
            ${orcamento.carro ? `<div class="cliente-field"><div class="field-label">Carro</div><div class="field-value">${orcamento.carro}</div></div>` : ''}
            ${orcamento.placa ? `<div class="cliente-field"><div class="field-label">Placa</div><div class="field-value">${orcamento.placa}</div></div>` : ''}
            ${orcamento.incEst ? `<div class="cliente-field"><div class="field-label">Inc. Est. / CIC</div><div class="field-value">${orcamento.incEst}</div></div>` : ''}
          </div></div>
        </div>` : ''}
        <div class="itens-section">
          <h3 class="section-title">${tipoVia === 'funcionarios' ? 'Peças e Serviços a Executar' : 'Itens'}</h3>
          <table class="itens-table"><thead><tr>
            <th>Descrição</th><th class="text-center">Qtd</th>
            ${showValues ? '<th class="text-right">Unit.</th>' : '<th class="text-center">Conferido</th>'}
            ${showValues ? '<th class="text-right">Total</th>' : '<th class="text-center">Observações</th>'}
          </tr></thead><tbody>${itemsHtml}</tbody></table>
          ${showValues ? `
          <div class="totals-section"><div class="totals-card">
            <table class="totals-table">
              <tr><td class="total-label">Subtotal:</td><td class="total-value font-mono">R$ ${(Number(orcamento.subtotal) || subtotal).toFixed(2).replace('.', ',')}</td></tr>
              <tr class="total-row"><td class="total-label">TOTAL:</td><td class="total-value font-mono">R$ ${(Number(orcamento.total) || 0).toFixed(2).replace('.', ',')}</td></tr>
            </table>
          </div></div>` : `
          <div class="funcionarios-notes"><h4>Anotações dos Serviços:</h4><div class="notes-lines">
            <div class="note-line"></div><div class="note-line"></div><div class="note-line"></div>
            <div class="note-line"></div><div class="note-line"></div><div class="note-line"></div><div class="note-line"></div>
          </div></div>`}
        </div>
        ${orcamento.observacao && tipoVia !== 'funcionarios' ? `
        <div class="itens-section"><h3 class="section-title">Observação</h3><div class="cliente-card" style="padding:16px;">
          <div style="white-space:pre-wrap; color: var(--text-secondary);">${(orcamento.observacao || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        </div></div>` : ''}
        ${tipoVia !== 'funcionarios' ? `
        <div class="assinatura-section"><h3 class="section-title">Assinaturas</h3><div class="assinatura-grid">
          <div class="assinatura-field"><div class="assinatura-line"></div><div class="assinatura-label">Assinatura do Vendedor</div></div>
          <div class="assinatura-field"><div class="assinatura-line"></div><div class="assinatura-label">Assinatura do Cliente</div></div>
        </div></div>
        <div class="orcamento-footer">
          <div class="footer-notes"><h4>Condições</h4>
            <ul>
              <li>Orçamento válido até ${validadeFormatada}</li>
              <li>Preços sujeitos a alteração</li>
              <li>Peças não fornecidas pela oficina (cliente deve fornecer)</li>
              <li>Pagamento: 50% aprovação + 50% retirada</li>
            </ul>
          </div>
          <div class="footer-contact"><h4>Contato</h4><div class="contact-grid">
            <div class="contact-item">
              <i class="fab fa-whatsapp"></i>
              <i class="fas fa-phone"></i>
              <span>${c.telefone || '(11) 3456-7890'}</span>
            </div>
            <div class="contact-item"><i class="fas fa-envelope"></i><span>${c.email || 'contato@janioretifica.com'}</span></div>
          </div></div>
          <div class="autorizacao-footer">AUTORIZO A FIRMA EFETUAR OS SERVIÇOS RELACIONADOS NESTA NOTA.</div>
        </div>` : ''}
      </div>`;
  }

  function generateAllVias(orcamento, cliente) {
    return generateVias(orcamento, cliente, ['vendedor', 'cliente', 'funcionarios']);
  }

  function getSelectedVias() {
    const order = ['vendedor','cliente','funcionarios'];
    const map = {
      vendedor: document.getElementById('via-select-vendedor'),
      cliente: document.getElementById('via-select-cliente'),
      funcionarios: document.getElementById('via-select-funcionarios')
    };
    const selected = order.filter(key => map[key] && map[key].checked);
    return selected;
  }

  function ensureSelectedViasDefault() {
    // Garante que ao abrir a prévia todas as vias estão selecionadas por padrão
    const ids = ['via-select-vendedor','via-select-cliente','via-select-funcionarios'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.checked = true; });
  }

  function generateVias(orcamento, cliente, viasArr) {
    const parts = [];
    viasArr.forEach((via, idx) => {
      parts.push(generateOrcamentoPreview(orcamento, cliente, via));
      if (idx < viasArr.length - 1) parts.push('<div class="page-break"></div>');
    });
    return parts.join('');
  }

  function detectDevice() {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isTablet = /tablet|ipad|playbook|silk/i.test(ua) || (isMobile && !/mobile/i.test(ua)) || (window.screen && window.screen.width >= 768 && window.screen.height >= 1024);
    const isAndroid = /android/i.test(ua);
    const isSamsung = /samsung/i.test(ua) || /SM-/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    return { isMobile, isTablet, isAndroid, isSamsung, isIOS, isDesktop: !isMobile && !isTablet };
  }

  async function preloadImagesInElement(element) {
    const images = element.querySelectorAll('img');
    const promises = Array.from(images).map(img => new Promise((resolve)=>{
      if (img.complete) resolve(); else { img.onload = () => resolve(); img.onerror = () => resolve(); }
    }));
    await Promise.all(promises);
  }

  function buildOrcamentoText(orcamento) {
  const S = getAppState();
  const cliente = S.clientes.find(c => String(c.id) === String(orcamento.clienteId));
    const validadeIso = orcamento.dataFinal || (()=>{ const d = new Date(orcamento.data + 'T00:00:00'); d.setFullYear(d.getFullYear()+1); return d.toISOString().split('T')[0]; })();
    const linhas = [];
    linhas.push(`Orçamento #${orcamento.id}`);
    linhas.push(`Cliente: ${cliente ? cliente.nome : 'N/I'}`);
  linhas.push(`Data: ${G.formatDate ? G.formatDate(orcamento.data) : new Date(orcamento.data).toLocaleDateString('pt-BR')}`);
  linhas.push(`Validade: ${G.formatDate ? G.formatDate(validadeIso) : new Date(validadeIso).toLocaleDateString('pt-BR')}`);
    linhas.push('');
    linhas.push('Itens:');
    orcamento.items.forEach(i => {
      const preco = Number(i.preco) || 0;
      const qtd = Number(i.quantidade) || 1;
      const sub = (qtd * preco).toFixed(2).replace('.', ',');
      linhas.push(`- ${i.nome} | Qtd: ${qtd} | Unit: R$ ${preco.toFixed(2).replace('.', ',')} | Sub: R$ ${sub}`);
    });
    linhas.push('');
    if (orcamento.observacao) { linhas.push('Observação:'); linhas.push(orcamento.observacao); linhas.push(''); }
    const total = Number(orcamento.total) || 0;
    linhas.push(`Total: R$ ${total.toFixed(2).replace('.', ',')}`);
    return linhas.join('\n');
  }

  function printOrcamento(id) {
    const S = getAppState();
    const orcamento = S.orcamentos.find(o => String(o.id) === String(id));
  if (!orcamento) { showAlert('Orçamento não encontrado', { title: 'Atenção' }); return; }
  const cliente = S.clientes.find(c => String(c.id) === String(orcamento.clienteId));
    const previewHtml = generateOrcamentoPreview(orcamento, cliente);
    document.getElementById('orcamento-preview-content').innerHTML = previewHtml;
    G.openModal && G.openModal('print-preview-modal');
    // Selecionar todas as vias por padrão ao abrir
    ensureSelectedViasDefault();
  }

  function switchViaPreview(tipoVia) {
    const orcamentoId = getPreviewOrcamentoId(); if (!orcamentoId) return;
    const S = getAppState();
    const orcamento = S.orcamentos.find(o => String(o.id) === String(orcamentoId)); if (!orcamento) return;
  const cliente = S.clientes.find(c => String(c.id) === String(orcamento.clienteId));
    const viaHtml = generateOrcamentoPreview(orcamento, cliente, tipoVia);
    document.getElementById('orcamento-preview-content').innerHTML = viaHtml;
    document.querySelectorAll('.btn-via').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.btn-via[onclick="switchViaPreview('${tipoVia}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  async function shareOrcamentoWhatsApp() {
    const orcamentoId = getPreviewOrcamentoId(); 
    if (!orcamentoId) return;
    
    const S = getAppState();
    const orcamento = S.orcamentos.find(o => String(o.id) === String(orcamentoId)); 
    if (!orcamento) return;
    
    const cliente = S.clientes.find(c => String(c.id) === String(orcamento.clienteId));
    const selected = getSelectedVias();
    
    if (!selected.length) { 
      showAlert('Selecione pelo menos 1 via para compartilhar.', { title: 'Atenção' }); 
      return; 
    }

    // Verificar se o cliente tem telefone
    if (!cliente || !cliente.telefone) {
      showAlert('Cliente sem telefone cadastrado. Adicione um número para compartilhar.', { title: 'Atenção' });
      return;
    }

    try {
      // Mostrar loading
      const loadingMsg = document.createElement('div');
      loadingMsg.id = 'whatsapp-loading';
      loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);color:white;padding:30px 50px;border-radius:12px;z-index:100000;font-size:16px;text-align:center;';
      loadingMsg.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:10px;"></i><br>Gerando PDF...';
      document.body.appendChild(loadingMsg);

      await preloadCompanyLogo();
      const { jsPDF } = window.jspdf; 
      const pdf = new jsPDF('p','mm','a4');
      const margin = 10; 
      const pageWidth = 210; 
      const pageHeight = 297; 
      const contentWidth = pageWidth - margin*2;
      
      // Gerar PDF com as vias selecionadas
      for (const via of selected) {
        const viaHtml = generateOrcamentoPreview(orcamento, cliente, via);
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute'; 
        wrapper.style.left = '-9999px'; 
        wrapper.style.top = '0'; 
        wrapper.style.width = '210mm'; 
        wrapper.style.backgroundColor = '#ffffff';
        wrapper.innerHTML = `<style>${getInlineStyles()}</style>${viaHtml}`;
        document.body.appendChild(wrapper);
        
        await preloadImagesInElement(wrapper);
        
        const canvas = await html2canvas(wrapper, { 
          scale: 2, 
          useCORS: true, 
          allowTaint: true, 
          backgroundColor: '#ffffff', 
          logging: false, 
          width: wrapper.scrollWidth, 
          height: wrapper.scrollHeight 
        });
        
        document.body.removeChild(wrapper);
        
        const imgData = canvas.toDataURL('image/png', 0.95);
        const imgHeight = (canvas.height * contentWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = margin;
        
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
        heightLeft -= (pageHeight - margin*2);
        
        while (heightLeft > 0) {
          pdf.addPage();
          position = margin - (imgHeight - heightLeft) + 0.1;
          pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
          heightLeft -= (pageHeight - margin*2);
        }
        
        if (via !== selected[selected.length-1]) pdf.addPage();
      }
      
      loadingMsg.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:10px;"></i><br>Salvando PDF...';
      
      // Preparar nome do arquivo
      const clienteNome = cliente.nome.replace(/[^a-zA-Z0-9]/g, '_');
      const viasSlug = selected.join('-');
      const fileName = `orcamento-${clienteNome}-${orcamentoId}-${viasSlug}.pdf`;
      
      // Fazer upload do PDF para o servidor
      const pdfBlob = pdf.output('blob');
      const uploadResult = await uploadPdfToServer(pdfBlob, fileName);
      const serverUrl = uploadResult.url;
      
      // Preparar mensagem do WhatsApp
      const clienteNomeCompleto = cliente.nome;
      const message = `Olá ${clienteNomeCompleto}! Segue o orçamento #${orcamentoId}.\n\nVocê pode visualizar acessando:\n${serverUrl}`;
      
      // Limpar telefone e abrir WhatsApp
      const telefoneRaw = cliente.telefone.replace(/\D/g,'');
      const whatsappUrl = `https://wa.me/${telefoneRaw}?text=${encodeURIComponent(message)}`;
      
      document.body.removeChild(loadingMsg);
      window.open(whatsappUrl, '_blank');
      
    } catch (error) {
      console.error('Erro ao compartilhar no WhatsApp:', error);
      const loadingEl = document.getElementById('whatsapp-loading');
      if (loadingEl) document.body.removeChild(loadingEl);
      showAlert('Erro ao compartilhar no WhatsApp. Tente novamente.', { title: 'Erro' });
    }
  }

  async function uploadPdfToServer(pdfBlob, fileName) {
    try {
      const formData = new FormData();
      formData.append('pdf', pdfBlob, fileName);
      
      const token = window.api && window.api.getToken ? window.api.getToken() : null;
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const response = await fetch(`${window.api.API_BASE}/api/v1/files/pdf`, {
        method: 'POST',
        headers: headers,
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Erro ao fazer upload do PDF');
      }
      
      const data = await response.json();
      // Retornar URL completa do servidor e path relativo
      return {
        url: `${window.api.API_BASE}${data.url}`,
        path: data.path
      };
    } catch (e) {
      console.error('Erro ao fazer upload do PDF:', e);
      throw e;
    }
  }

  async function printViaPDF() {
    const orcamentoId = getPreviewOrcamentoId(); 
    if (!orcamentoId) return;
    
    const S = getAppState();
    const orcamento = S.orcamentos.find(o => String(o.id) === String(orcamentoId)); 
    if (!orcamento) return;
    
    const cliente = S.clientes.find(c => String(c.id) === String(orcamento.clienteId));
    const selected = getSelectedVias();
    
    if (!selected.length) { 
      showAlert('Selecione pelo menos 1 via para baixar.', { title: 'Atenção' }); 
      return; 
    }

    try {
      // Mostrar loading
      const loadingMsg = document.createElement('div');
      loadingMsg.id = 'pdf-download-loading';
      loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);color:white;padding:30px 50px;border-radius:12px;z-index:100000;font-size:16px;text-align:center;';
      loadingMsg.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:10px;"></i><br>Gerando PDF...';
      document.body.appendChild(loadingMsg);

      // Prefer server-side PDF if API is available
      try {
        if (window.api && api.API_BASE) {
          const token = api.getToken();
          const url = `${api.API_BASE}/api/v1/orcamentos/${orcamento.id}/pdf`;
          const res = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
          if (res.ok) {
            loadingMsg.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:10px;"></i><br>Baixando arquivo...';
            
            const blob = await res.blob();
            const a = document.createElement('a');
            const fileUrl = URL.createObjectURL(blob);
            a.href = fileUrl;
            a.download = `orcamento-${(cliente?cliente.nome:'cliente').replace(/[^a-zA-Z0-9]/g,'_')}-${orcamento.id}.pdf`;
            document.body.appendChild(a); 
            a.click(); 
            document.body.removeChild(a);
            URL.revokeObjectURL(fileUrl);
            
            document.body.removeChild(loadingMsg);
            return; // done
          }
        }
      } catch (e) { /* fallback to client-side */ }

      // Fallback: gerar PDF no cliente
      await preloadCompanyLogo();
      const { jsPDF } = window.jspdf; 
      const pdf = new jsPDF('p','mm','a4');
      const margin = 10; 
      const pageWidth = 210; 
      const pageHeight = 297; 
      const contentWidth = pageWidth - margin*2;
      
      for (const via of selected) {
        const viaHtml = generateOrcamentoPreview(orcamento, cliente, via);
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute'; 
        wrapper.style.left = '-9999px'; 
        wrapper.style.top = '0'; 
        wrapper.style.width = '210mm'; 
        wrapper.style.backgroundColor = '#ffffff';
        wrapper.innerHTML = `<style>${getInlineStyles()}</style>${viaHtml}`;
        document.body.appendChild(wrapper);
        
        await preloadImagesInElement(wrapper);
        
        const canvas = await html2canvas(wrapper, { 
          scale: 2, 
          useCORS: true, 
          allowTaint: true, 
          backgroundColor: '#ffffff', 
          logging: false, 
          width: wrapper.scrollWidth, 
          height: wrapper.scrollHeight 
        });
        
        document.body.removeChild(wrapper);
        
        const imgData = canvas.toDataURL('image/png', 0.95);
        const imgHeight = (canvas.height * contentWidth) / canvas.width;
        let heightLeft = imgHeight; 
        let position = margin;
        
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
        heightLeft -= (pageHeight - margin*2);
        
        while (heightLeft > 0) {
          position = margin - (imgHeight - heightLeft) + 0.1;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
          heightLeft -= (pageHeight - margin*2);
        }
        
        if (via !== selected[selected.length-1]) pdf.addPage();
      }

      loadingMsg.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:10px;"></i><br>Salvando arquivo...';
      
      const id = getPreviewOrcamentoId() || 'orcamento'; 
      const clienteNome = cliente ? cliente.nome.replace(/[^a-zA-Z0-9]/g, '_') : 'cliente';
      const viasSlug = selected.join('-');
      pdf.save(`orcamento-${clienteNome}-${id}-${viasSlug}.pdf`);
      
      document.body.removeChild(loadingMsg);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      const loadingEl = document.getElementById('pdf-download-loading');
      if (loadingEl) document.body.removeChild(loadingEl);
      
      showAlert('Erro ao gerar PDF. Tente novamente.', { title: 'Erro' });
    }
  }

  function getMobilePrintStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
        
    body {
      font-family: 'Arial', sans-serif;
      background: white;
      color: #000;
      line-height: 1.3;
      font-size: 12px;
      padding: 10px;
    }
        
    .print-instructions {
      text-align: center;
      padding: 20px;
      background: #f0f0f0;
      border-radius: 8px;
      margin-bottom: 20px;
    }
        
    @media print {
      .print-instructions {
        display: none !important;
      }
            
      body {
        padding: 0;
        font-size: 10px;
      }
    }
        
    .orcamento-document {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      background: white;
      color: #000;
      page-break-after: always;
    }
        
    .orcamento-document:last-child {
      page-break-after: auto;
    }
        
    .orcamento-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #333;
      flex-wrap: wrap;
    }
        
    .company-logo img {
      max-height: 80px;
      max-width: 120px;
      object-fit: contain;
    }
        
    .company-info {
      flex: 1;
      text-align: center;
      margin: 0 10px;
    }
        
    .orcamento-number {
      font-size: 16px;
      font-weight: bold;
      color: #333;
    }
        
    .orcamento-details {
      background: #f8f8f8;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 16px;
    }
        
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 10px;
    }
        
    .itens-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 9px;
    }
        
    .itens-table th,
    .itens-table td {
      border: 1px solid #333;
      padding: 4px;
      text-align: left;
    }
        
    .itens-table th {
      background: #f0f0f0;
      font-weight: bold;
    }
        
    .totals-table {
      width: 50%;
      margin-left: auto;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
        
    .totals-table td {
      padding: 4px 8px;
      border-bottom: 1px solid #ddd;
    }
        
    .total-final {
      font-weight: bold;
      border-top: 2px solid #333 !important;
    }
        
    .footer-notes {
      font-size: 8px;
      margin-top: 16px;
    }
        
    .footer-notes h4 {
      margin-bottom: 8px;
      font-size: 9px;
    }
        
    .footer-notes ul {
      margin-left: 16px;
    }
        
    .footer-notes li {
      margin-bottom: 4px;
    }
        
    .page-break {
      page-break-before: always;
    }
    /* Forçar retrato também no estilo mobile */
    @page {
      margin: 10mm;
      size: A4 portrait;
    }
        
    @media screen and (max-width: 768px) {
      .orcamento-header {
        flex-direction: column;
        text-align: center;
      }
            
      .company-info {
        margin: 10px 0;
      }
            
      .detail-row {
        flex-direction: column;
        align-items: flex-start;
      }
            
      .itens-table {
        font-size: 8px;
      }
            
      .totals-table {
        width: 100%;
      }
    }
  `;
  }

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
    /* Otimização para imagens no PDF e impressão */
    .company-logo img {
      max-height: 100px;
      max-width: 50%;
      height: auto;
      width: auto;
      display: block;
      object-fit: contain;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: optimize-contrast;
      image-rendering: crisp-edges;
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
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Estilos específicos para as vias */
    .page-break {
      page-break-before: always;
      break-before: page;
    }

    /* Identificação da via */
    .via-identificacao {
      font-size: 10px;
      font-weight: 600;
      color: #666;
      margin-bottom: 8px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 8px;
      background: #f0f0f0;
      border-radius: 2px;
      border: 1px solid #ddd;
    }

    /* Watermark CÓPIA para via do cliente */
    .watermark-copia {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 72px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.08);
      text-transform: uppercase;
      letter-spacing: 8px;
      z-index: 1;
      pointer-events: none;
      user-select: none;
    }

    /* Posicionamento relativo para permitir watermark */
    .via-cliente {
      position: relative;
    }

    /* Estilos para via dos funcionários */
    .via-funcionarios .itens-table th:nth-child(3),
    .via-funcionarios .itens-table th:nth-child(4) {
      background: #e8e8e8;
      color: #666;
    }

    .status-checkbox {
      font-family: 'Arial', sans-serif;
      font-size: 10px;
      font-weight: 500;
      color: #333;
    }

    .funcionario-obs {
      font-style: italic;
      color: #999;
      border-bottom: 1px dotted #ccc;
      min-height: 12px;
    }

    .funcionarios-notes {
      margin-top: 16px;
      padding: 12px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 3px;
    }

    .funcionarios-notes h4 {
      font-size: 10px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .notes-lines {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .note-line {
      height: 20px;
      border-bottom: 1px solid #ccc;
      width: 100%;
    }

    /* Cores neutras para todas as vias */
    .via-vendedor .via-identificacao,
    .via-cliente .via-identificacao,
    .via-funcionarios .via-identificacao {
      background: #f5f5f5;
      color: #666;
      border-color: #ddd;
    }

    /* Ajustes de impressão para múltiplas páginas e dispositivos
       - Forçar orientação retrato (em pé) em todos os dispositivos
       - Definir tamanho A4 para padronizar escala
       - Margens suaves que funcionam no Android/Chrome e iOS */
    @page {
      margin: 10mm;
      size: A4 portrait;
    }

    /* Configurações globais para melhor renderização de imagens */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
        
    img {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: optimize-contrast;
      image-rendering: crisp-edges;
      max-width: 100%;
      height: auto;
    }

    @media print {
      .orcamento-document {
        page-break-inside: avoid;
        margin-bottom: 20px;
      }
            
      .page-break {
        page-break-before: always;
      }
            
      .watermark-copia {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
            
      img {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        image-rendering: -webkit-optimize-contrast !important;
      }
    }
  `;
  }

  function printDocument() {
    // Impressão nativa em todos os dispositivos via iframe oculto
    const orcamentoId = getPreviewOrcamentoId();
    if (!orcamentoId) { showAlert('Erro: Não foi possível identificar o orçamento para impressão', { title: 'Atenção' }); return; }
    const S = getAppState();
    const orcamento = S.orcamentos.find(o => String(o.id) === String(orcamentoId));
    if (!orcamento) { showAlert('Orçamento não encontrado', { title: 'Atenção' }); return; }

    const cliente = S.clientes.find(c => String(c.id) === String(orcamento.clienteId));
    const selected = getSelectedVias();
    if (!selected.length) { showAlert('Selecione pelo menos 1 via para imprimir.', { title: 'Atenção' }); return; }
    const todasVias = generateVias(orcamento, cliente, selected);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iw = iframe.contentWindow;
    const idoc = iframe.contentDocument || iw.document;
    idoc.open();
    idoc.write(`<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Impressão - Orçamento ${orcamento.id}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" rel="stylesheet">
      <style>${getInlineStyles()}</style>
    </head><body>${todasVias}</body></html>`);
    idoc.close();

    iframe.onload = function(){
      try {
        const imgs = idoc.images || [];
        const promises = Array.from(imgs).map(img => new Promise(r => { if (img.complete) r(); else { img.onload = () => r(); img.onerror = () => r(); }}));
        Promise.all(promises).then(() => {
          try { iw.focus(); } catch {}
          try { iw.print(); } catch(e) { showAlert('Falha ao iniciar a impressão no dispositivo.', { title: 'Erro' }); }
          setTimeout(()=>{ if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
        });
      } catch(e) {
        try { iw.print(); } catch{}
        setTimeout(()=>{ if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
      }
    };
  }

  function showPrintOptions() {
    // Sempre usar impressão nativa do dispositivo
    printDocument();
  }

  function tryDirectPrint() {
    const orcamentoId = getPreviewOrcamentoId();
    const S = getAppState();
    const orcamento = S.orcamentos.find(o => String(o.id) === String(orcamentoId));
  const cliente = S.clientes.find(c => c.id === orcamento.clienteId);
    const selected = getSelectedVias();
    if (!selected.length) { showAlert('Selecione pelo menos 1 via para imprimir.', { title: 'Atenção' }); return; }
    const todasVias = generateVias(orcamento, cliente, selected);
    // Usar iframe oculto para evitar bloqueio de popup em alguns dispositivos
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow || iframe.contentDocument;
    const iw = iframe.contentWindow;
    const idoc = iframe.contentDocument || doc.document;
    idoc.open();
    idoc.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Impressão - Orçamento ${orcamento.id}</title><style>${getMobilePrintStyles()}</style></head><body>${todasVias}</body></html>`);
    idoc.close();
    iframe.onload = function(){
      try {
        const imgs = idoc.images || [];
        const promises = Array.from(imgs).map(img => new Promise(r => { if (img.complete) r(); else { img.onload = () => r(); img.onerror = () => r(); }}));
        Promise.all(promises).then(() => {
          iw.focus();
          iw.print();
          setTimeout(()=>{ if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
        });
      } catch(e) {
        try { iw.print(); } catch{}
        setTimeout(()=>{ if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
      }
    };
  }

  // Expose
  const api = { getPreviewOrcamentoId, getCurrentViaType, convertLocalImageToBase64Safe, replaceImageWithPlaceholder, preloadCompanyLogo, showImageFallbackNotification, generateOrcamentoPreview, generateAllVias, detectDevice, preloadImagesInElement, buildOrcamentoText, printOrcamento, switchViaPreview, shareOrcamentoWhatsApp, uploadPdfToServer, printViaPDF, getMobilePrintStyles, getInlineStyles, printDocument, showPrintOptions, tryDirectPrint };
  G.Print = api;
  Object.assign(G, api);
  
  // Garantir que printOrcamento está disponível globalmente para inline handlers
  if (!G.printOrcamento) {
    G.printOrcamento = printOrcamento;
  }
})(window);
