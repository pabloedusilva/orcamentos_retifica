// Ações de modal
export function openModalById(id){ const m=document.getElementById(id); if(!m) return; m.classList.add('active'); document.body.classList.add('modal-open'); }
export function closeModalById(id){ const m=document.getElementById(id); if(!m) return; m.classList.remove('active'); document.body.classList.remove('modal-open'); }
