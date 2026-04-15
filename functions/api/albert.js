export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const base64Image = body.image;

        if (!base64Image) {
            return new Response(JSON.stringify({ error: "Aucune image fournie" }), { status: 400 });
        }

        const albertApiUrl = "https://albert.api.etalab.gouv.fr/v1/chat/completions"; 
        
        const albertPayload = {
            model: "openweight-medium", 
            messages: [
                {
                    role: "system",
                    content: `Tu es un expert en LaTeX. L'utilisateur te fournit une image contenant un texte mathématiques. 
                    Ton but est de générer le code LaTeX correspondant.
                    RÈGLE ABSOLUE : Tu DOIS générer un document LaTeX complet et prêt à être compilé par pdflatex. 
                    Tu dois impérativement inclure :
                    \\documentclass[12pt]{article}
                    \\usepackage{amsmath}
                    \\usepackage{amssymb}
                    \\begin{document}
                       ... 
                    \\end{document}
					ainsi que d'autres packages nécessaires.
					Respecte les couleurs de texte.
					Ne rajoute rien que ce qui est sur l'image et/ou ne corrige pas les erreurs.
                    Ne renvoie QUE le code LaTeX brut, sans texte d'introduction ni de conclusion.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Convertis cette image en document LaTeX compilable :" },
                        { type: "image_url", image_url: { url: base64Image } }
                    ]
                }
            ],
            max_tokens: 1000
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