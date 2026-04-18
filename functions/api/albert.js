export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const base64Image = body.image;

        if (!base64Image) {
            return new Response(JSON.stringify({ error: "Aucune image fournie" }), { status: 400 });
        }

        const albertApiUrl = "https://albert.api.etalab.gouv.fr/v1/chat/completions"; 
		
		const old_sys = `Tu es un expert en LaTeX. L'utilisateur te fournit une image contenant un texte mathématiques. 
                    Ton but est de générer le code LaTeX correspondant.
					
					RÈGLE SUR LES COMMENTAIRES : L'utilisateur peut écrire des indications sur l'image pour t'aider à interpréter certains symboles. Ces indications sont TOUJOURS encadrées par des doubles crochets, comme ceci : [[ c'est un alpha ]] ou [[ x, pas un fois ]].
                    Tu dois utiliser ces indications pour comprendre le texte, mais TU NE DOIS JAMAIS les inclure ni les traduire dans le code LaTeX final. Ignore complètement le texte entre doubles crochets dans ta production.
					
                    RÈGLE ABSOLUE : Tu DOIS générer un document LaTeX complet et prêt à être compilé par pdflatex.
                     
					IMPORTANT : Utilise \dfrac pour les fractions, le package esvect pour les vecteurs.
					Respecte les couleurs de texte mais n'en rajoute pas.
					Ne rajoute rien que ce qui est sur l'image et/ou ne corrige pas les erreurs.
                    Ne renvoie QUE le code LaTeX brut, sans texte d'introduction ni de conclusion. Code complet avec préambule.`
        
        const albertPayload = {
            model: "openweight-medium", 
            messages: [
                {
                    role: "system",
                    content: `Tu es un assistant d'OCR spécialisé dans l'extraction de texte manuscrit.
Ta tâche est d'extraire TOUT le texte visible dans l'image fournie, en conservant la structure (titres, listes, formules), et de générer le code LaTeX correspondant.

Règles :
- Ne renvoie QUE le code LaTeX brut, sans texte d'introduction ni de conclusion. Code complet avec préambule.
- Conserve la mise en forme : titres, numérotation, listes à puces.
- Pour les formules mathématiques, utilise la notation LaTeX entre $ ou $$. Si un package est donné utilise ABSOLUMENT les commandes de ce package.
- UTILISE le package esvect pour les vecteurs (commande vv), dfrac pour les fractions.
- Respecte les couleurs de texte mais n'en rajoute pas.

RÈGLE SUR LES COMMENTAIRES : L'utilisateur peut écrire des indications sur l'image pour t'aider à interpréter certains symboles. Ces indications sont TOUJOURS encadrées par des DOUBLES crochets, comme ceci : [[ c'est un alpha ]] ou [[ x, pas un fois ]].
                    Tu dois utiliser ces indications pour comprendre le texte, mais TU NE DOIS JAMAIS les inclure ni les traduire dans le code LaTeX final. Ignore complètement le texte entre DOUBLES crochets dans ta production, par contre traite les SIMPLES crochets normalement.`;

                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Convertis cette image en document LaTeX compilable en tenant compte des éventuels commentaires entre [[ ]] :" },
                        { type: "image_url", image_url: { url: base64Image } }
                    ]
                }
            ],
            max_tokens: 1000,
			temperature: 0.2
        };

        const response = await fetch(albertApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.ALBERT_API_KEY}`
            },
            body: JSON.stringify(albertPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur API Albert : ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        let latexResult = data.choices[0].message.content.trim();
        
        // Nettoyer les balises Markdown que l'IA ajoute souvent (```latex ... ```)
        latexResult = latexResult.replace(/^```latex\n?/g, "").replace(/\n?```$/g, "").trim();

        return new Response(JSON.stringify({ latex: latexResult }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}