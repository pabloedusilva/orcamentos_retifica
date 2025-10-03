// Camada de repositório (frente) - hoje usa localStorage, amanhã backend
export const LocalStorageRepo = {
  load(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{ return fallback }
  },
  save(key, data){
    try{ localStorage.setItem(key, JSON.stringify(data)); }catch{}
  },
  remove(key){ try{ localStorage.removeItem(key); }catch{} }
};
