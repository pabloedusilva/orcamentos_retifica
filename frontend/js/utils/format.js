export function formatDate(dateString){
  if(!dateString) return '';
  const d = new Date(dateString+'T00:00:00');
  if(Number.isNaN(+d)) return '';
  return d.toLocaleDateString('pt-BR');
}
export function currencyBRL(v){
  try{ return (v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}catch{return 'R$ 0,00'}
}
