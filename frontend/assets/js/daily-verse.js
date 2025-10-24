// Daily Verse Loader - Alternative solution for COEP issues
(function() {
    'use strict';
    
    // Fallback verses in Portuguese (NVI)
    const fallbackVerses = [
        { text: "Pois o Senhor é bom e o seu amor dura para sempre; a sua fidelidade permanece por todas as gerações.", reference: "Salmos 100:5" },
        { text: "Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento.", reference: "Provérbios 3:5" },
        { text: "Tudo posso naquele que me fortalece.", reference: "Filipenses 4:13" },
        { text: "O Senhor é o meu pastor; de nada terei falta.", reference: "Salmos 23:1" },
        { text: "Porque Deus tanto amou o mundo que deu o seu Filho Unigênito, para que todo o que nele crer não pereça, mas tenha a vida eterna.", reference: "João 3:16" },
        { text: "Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.", reference: "1 Pedro 5:7" },
        { text: "Sejam fortes e corajosos. Não tenham medo nem fiquem apavorados, pois o Senhor, o seu Deus, vai com vocês; nunca os deixará, nunca os abandonará.", reference: "Deuteronômio 31:6" },
        { text: "Alegrem-se sempre no Senhor. Novamente direi: alegrem-se!", reference: "Filipenses 4:4" },
        { text: "Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu.", reference: "Eclesiastes 3:1" },
        { text: "Não andem ansiosos por coisa alguma, mas em tudo, pela oração e súplicas, e com ação de graças, apresentem seus pedidos a Deus.", reference: "Filipenses 4:6" }
    ];
    
    function loadDailyVerse() {
        const wrapper = document.getElementById('dailyVersesWrapper');
        if (!wrapper) return;
        
        // Try to load from DailyVerses.net API
        const script = document.createElement('script');
        script.src = 'https://dailyverses.net/get/verse.js?language=nvi-pt';
        script.async = true;
        script.defer = true;
        
        // Fallback to local verses if external fails
        script.onerror = function() {
            displayFallbackVerse(wrapper);
        };
        
        // Check if loaded successfully after timeout
        setTimeout(() => {
            if (!wrapper.innerHTML || wrapper.innerHTML.trim() === '') {
                displayFallbackVerse(wrapper);
            }
        }, 3000);
        
        document.head.appendChild(script);
    }
    
    function displayFallbackVerse(wrapper) {
        // Get verse based on day of year for consistency
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        const verseIndex = dayOfYear % fallbackVerses.length;
        const verse = fallbackVerses[verseIndex];
        
        wrapper.innerHTML = `
            <div class="dailyVerses" style="text-align: center;">
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 12px; font-style: italic;">
                    "${verse.text}"
                </p>
                <p style="font-size: 14px; font-weight: 600; opacity: 0.9;">
                    — ${verse.reference}
                </p>
            </div>
        `;
    }
    
    // Load when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDailyVerse);
    } else {
        loadDailyVerse();
    }
})();
