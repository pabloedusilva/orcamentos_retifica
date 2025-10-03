# Frontend Architecture

Esta pasta organiza o frontend em módulos desacoplados, prontos para futura migração para backend (Railway + MySQL).

Estrutura:
- css/: tokens, base, layout, components, print, responsive (importados por main.css)
- js/
  - state.js: estado compartilhado (futuro será alimentado por API)
  - utils/: funções utilitárias (format, dom, etc.)
  - storage/: camada de repositório (hoje localStorage, amanhã API)
  - ui/: componentes e interações de UI (modals, toasts, etc.)
  - features/: domínios (clientes, peças, serviços, orçamentos)
  - print/: preview e impressão/PDF
- assets/: imagens, ícones e fontes
- docs/: documentação técnica

Princípios:
- Separação por domínio (features) e por camadas (utils/storage/ui)
- Exports explícitos e contratos simples
- Facilitar testes e evolução incremental

Migração futura:
- Substituir storage/localStorageRepo por chamadas HTTP (fetch/axios)
- Adicionar client de API (js/api/) com serviços por domínio
- Adicionar roteamento se necessário (SPA)
