import{Request, Response} from 'express'
import prisma from "../lib/prisma.js";
import openai from "../configs/openai.js";

// controller Function to make Revision
export const makeRevision = async(req: Request, res: Response) => {
    const userId = req.userId;
    try {
        
        const {projectId} = req.params;
        const {message} = req.body;

        const user = await prisma.user.findUnique({
            where: {id: userId}
        })

        if(!userId || !user) {
            return res.status(401).json({message:'Unauthorized'});
        }

        if(user.credits < 5) {
            return res.status(403).json({message:'add more credits to make changes'});
        }

        if(!message || message.trim() == '') {
            return res.status(400).json({message:'Please enter valid prompt'});
        }

        const currentProject = await prisma.websiteProject.findUnique({
            where: {id: projectId, userId},
            include: {versions: true}
        })

        if(!currentProject) {
            return res.status(404).json({message:'Project not found'});
        }

        await prisma.conversation.create({
            data: {
                role: 'user',
                content: message,
                projectId
            }
        })

        await prisma.user.update ({
            where: {id: userId},
            data: {credits: {decrement: 5}}
        })

        // Enhance user prompt
        const promptEnhanceResponse = await openai.chat.completions.create({
            model: 'z-ai/glm-4.5-air:free',
            messages: [
                {
                    role: 'system',
                    content:`
                    You are a prompt enhancement specialist. The user wants to make changes to their website. Enhance their request to be more specific, clear, and actionable for a web developer.

                    Improve the request by:
                    1. Clearly stating which elements should be modified
                    2. Mentioning precise design details (colors, spacing, sizes, typography)
                    3. Clarifying the intended visual and functional outcome
                    4. Using accurate and concise technical terminology

                    Return ONLY the enhanced request, nothing else. Keep it concise (1–2 sentences).
`
                },
                {
                    role: 'user',
                    content: `User's request: "${message}"`
                }
            ]
        })

        const enhancedPrompt = promptEnhanceResponse.choices[0].message.content;

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: `I've enhanced your prompt to: "${enhancedPrompt}"`,
                projectId
            }
        })
        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: 'Now making changes to your website...',
                projectId
            }
        })

        // Generate website code
        const codeGenerationResponse = await openai.chat.completions.create({
            model: 'z-ai/glm-4.5-air:free',
            messages: [
                {
                    role: 'system',
                    content: `
                    You are an expert web developer.

                    CRITICAL REQUIREMENTS:
                    - Return ONLY the complete, updated HTML code with the requested changes applied.
                    - Use Tailwind CSS for ALL styling (no custom CSS).
                    - Use Tailwind utility classes for all styling updates.
                    - Include all JavaScript inside <script> tags before the closing </body>.
                    - Ensure the output is a complete, standalone HTML document using Tailwind CSS.
                    - Return HTML code ONLY, nothing else.

                    Apply the requested changes while maintaining a clean, modern Tailwind CSS styling approach.
                    `
                },
                {
                    role: 'user',
                    content: `
                    Here is the current website code: "${currentProject.current_code}"
                    The user wants this change: "${enhancedPrompt}"`
                }
            ]
        })

        const code = codeGenerationResponse.choices[0].message.content || '';

        const version = await prisma.version.create({
            data: {
                code: code.replace(/```[a-z]*\n?/gi, '')
                .replace(/```$/g, '')
                .trim(),
                description: 'changes made',
                projectId
            }
        })

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: "I've made changes to youe website! You can now preview it",
                projectId
            }
        })

        await prisma.websiteProject.update({
            where: {id: projectId},
            data: {
                current_code: code.replace(/```[a-z]*\n?/gi, '')
                .replace(/```$/g, '')
                .trim(),
                current_version_index: version.id
            }
        })
        
        res.json({message: 'Changes made successfully'})
    } catch (error: any) {

        await prisma.user.update ({
            where: {id: userId},
            data: {credits: {increment: 5}}
        })

         console.log(error.code || error.message);
         res.status(500).json({message: error.message});
    }
}

//controller function to rollback to a specific version
export const rollbackToVersion = async(req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if(!userId) {
            return res.status(401).json({message: 'Unauthorized'});
        }
        const { projectId, versionId } = req.params;

        const project = await prisma.websiteProject.findUnique({
            where: {id: projectId, userId},
            include: {versions: true}
        })

        if(!project) {
           return res.status(404).json({message: 'Project not found'}); 
        }

        const version = project.versions.find((version)=> version?.id === versionId);

        if(!version) {
            return res.status(401).json({message: 'Version not found'});
        }

        await prisma.websiteProject.update({
            where: {id: projectId, userId},
            data :{
                current_code: version.code,
                current_version_index: version.id
            }
        })

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: "I've rolled back your website to selected version. You can preview it",
                projectId
            }
        })

        res.json({message: 'Version rolled back'})

    } catch(error : any) {
        console.log(error.code || error.message);
        res.status(500).json({message: error.message})
    }
}

// controller function to delete a project

export const deleteProject = async(req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;
       

        await prisma.websiteProject.delete({
            where: {id: projectId, userId},
        })


        res.json({message: 'Project deleted successfully'})

    } catch(error : any) {
        console.log(error.code || error.message);
        res.status(500).json({message: error.message})
    }
}

// controller for getting project code for preview 
export const getProjectPreview = async(req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;

        if(!userId) {
            return res.status(401).json({message: 'Unauthorized'});
        }

        const project = await prisma.websiteProject.findFirst({
            where: {id: projectId, userId},
            include: {versions: true}
        })

        if(!project) {
           return res.status(404).json({message: 'Project not found'});
        }
       
        res.json({project});

    } catch(error : any) {
        console.log(error.code || error.message);
        res.status(500).json({message: error.message})
    }
}

// Get published projects
export const getPublishedProjects = async(req: Request, res: Response) => {
    try {

        const projects = await prisma.websiteProject.findMany({
            where: {isPublished: true},
            include: {user: true}
        })

       
        res.json({projects});

    } catch(error : any) {
        console.log(error.code || error.message);
        res.status(500).json({message: error.message})
    }
}

// get a single project by id
export const getProjectById = async(req: Request, res: Response) => {
    try {
        const {projectId} = req.params;

        const project = await prisma.websiteProject.findFirst({
            where: {id: projectId}, 
        })

        if(!project || project.isPublished === false || !project?.current_code) {
            return res.status(404).json({message: 'Project not found'});
        }
  
        res.json({code: project.current_code});

    } catch(error : any) {
        console.log(error.code || error.message);
        res.status(500).json({message: error.message})
    }
}

// controllerto save project code
export const saveProjectCode = async(req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const {projectId} = req.params;
        const code = req.body;

        if(!userId) {
            return res.status(401).json({message: 'Unauthorized'});
        }

        if(!code) {
            return res.status(400).json({message: 'Code is required'});
        }

        const project = await prisma.websiteProject.findUnique({
            where: {id: projectId, userId}
        })

        if(!project) {
            return res.status(404).json({message: 'Project not found'});
        }

        await prisma.websiteProject.update({
            where: {id: projectId},
            data: {current_code: code, current_version_index: ''}
        })
  
        res.json({message: 'Project saved successfully'});

    } catch(error : any) {
        console.log(error.code || error.message);
        res.status(500).json({message: error.message})
    }
}