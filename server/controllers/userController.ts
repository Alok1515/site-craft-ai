import { Request, response, Response } from "express"
import prisma from "../lib/prisma.js";
import openai from "../configs/openai.js";
import { role } from "better-auth/client";
import { optional } from "better-auth";

// Get User Credits
export const getUserCredits = async(req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if(!userId) {
            return res.status(401).json({message:'Unauthorized'})
        }
        const user = await prisma.user.findUnique({
            where: {id: userId}
        })
        response.json({credits: user?.credits})
    } catch (error: any) {
         console.log(error.code || error.message);
         res.status(500).json({message: error.message});
    }
}

// controller function to create new project

export const createUserProject = async (req: Request, res: Response) => {
    const userId = req.userId;
    try {
        const { initial_prompt } = req.body;

        if(!userId) {
            return res.status(401).json({message:'Unauthorized'})
        }
        const user = await prisma.user.findUnique({
            where: {id: userId}
        })

        if(user && user.credits < 5) {
            return res.status(403).json({message: 'add credits to create more projects'});
        }

        // create a new project
        const project = await prisma.websiteProject.create({
            data: {
                name: initial_prompt.length > 50 ? initial_prompt.substring(0, 47)
                + '...' : initial_prompt,
                initial_prompt,
                userId
            }
        })

        // update user's total creation 
        await prisma.user.update({
            where: {id: userId},
            data: {totalCreation: {increment: 1}}
        })

        await prisma.conversation.create({
            data: {
                role: 'user',
                content: initial_prompt,
                projectId: project.id
            }
        })

        await prisma.user.update({
            where: {id: userId},
            data: {credits: {decrement: 5}}
        })

        res.json({projectId: project.id})

        // Enhance user prompt
        const promptEnhanceResponse = await openai.chat.completions.create({
            model: 'z-ai/glm-4.5-air:free',
            messages: [
                {
                    role: 'system',
                    content: `
                    You are a prompt enhancement specialist. Take the user's website request and expand it into a detailed,
                     comprehensive prompt that will help create the best possible website.

                        Enhance this prompt by:
                        1. Adding specific design details (layout, color scheme, typography)
                        2. Specifying key sections and features
                        3. Describing the user experience and interactions
                        4. Including modern web design best practices
                        5. Mentioning responsive design requirements
                        6. Adding any missing but important elements

                        Return ONLY the enhanced prompt, nothing else. Make it detailed but concise (2–3 paragraphs max). `
                },
                {
                    role: 'user',
                    content: initial_prompt
                }
            ]
        })

        const enhancedPrompt = promptEnhanceResponse.choices[0].message.content;

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: `I've enhanced your prompt to: "${enhancedPrompt}"`,
                projectId: project.id
            }
        })
        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: `now generating your website...`,
                projectId: project.id
            }
        })

        // Generate website code 
        const codeGenerationResponse = await openai.chat.completions.create({
            model: 'z-ai/glm-4.5-air:free',
            messages: [
                {
                    role: 'system',
                    content: `
                    You are an expert web developer. Create a complete, production-ready, single-page website based on this request: "${enhancedPrompt}"
                    CRITICAL REQUIREMENTS:
                    - You MUST output valid HTML ONLY.
                    - Use Tailwind CSS for ALL styling.
                    - Include this EXACT script in the <head>:
                    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
                    - Use Tailwind utility classes extensively for styling, layout, animations, and responsiveness.
                    - Make it fully functional and interactive using JavaScript inside a <script> tag before the closing </body>.
                    - Use modern, beautiful design with excellent UX using Tailwind classes.
                    - Make it fully responsive using Tailwind responsive breakpoints (sm, md, lg, xl).
                    - Use Tailwind animations and transitions (animate-*, transition-*).
                    - Include all necessary meta tags.
                    - Use Google Fonts CDN if custom fonts are needed.
                    - Use placeholder images from https://placehold.co/600x400 where images are required.
                    - Use Tailwind gradient classes for visually appealing backgrounds.
                    - Ensure all buttons, cards, sections, and components are styled using Tailwind only.

                    CRITICAL HARD RULES:
                    1. You MUST put ALL output ONLY into message.content.
                    2. You MUST NOT place anything in "reasoning", "analysis", "reasoning_details", or any hidden fields.
                    3. You MUST NOT include internal thoughts, explanations, analysis, comments, or markdown.
                    4. DO NOT include markdown formatting, explanations, notes, or code fences.

                    The HTML output must be complete, self-contained, and ready to render as-is using Tailwind CSS.
                    `
                }, 
                {
                    role: 'user',
                    content: enhancedPrompt || ''
                }
            ]
        })

        const code = codeGenerationResponse.choices[0].message.content || '';

        // create version for the project
        const version = await prisma.version.create({
            data: {
                code: code.replace(/```[a-z]*\n?/gi, '')
                .replace(/```$/g, '')
                .trim(),
                description: 'Initial version',
                projectId: project.id
            }
        })

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: "I've created your website! You can preview it and request any changes.",
                projectId: project.id
            }
        })

        await prisma.websiteProject.update({
            where: {id: project.id},
            data: {
                current_code: code.replace(/```[a-z]*\n?/gi, '')
                .replace(/```$/g, '')
                .trim(),
                current_version_index: version.id
            }
        })

    } catch (error: any) {
        await prisma.user.update({
            where: {id: userId},
                data: {credits: {increment: 5}}
        })
         console.log(error.code || error.message);
         res.status(500).json({message: error.message});
    }
}