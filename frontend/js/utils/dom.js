export function qs(sel,root=document){ return root.querySelector(sel) }
export function qsa(sel,root=document){ return Array.from(root.querySelectorAll(sel)) }
export function el(tag,props={}){ const n=document.createElement(tag); Object.assign(n,props); return n }
