import { extractText, getDocumentProxy } from 'unpdf';

// curl -X POST -F 'pdfFile=@EvanGoodwinResume3.pdf' https://summarize-pdf.langalearn.workers.dev/api/upload 

const getJobDescription = async (jobId: number, DB: D1Database) => {
    const { results } = await DB.prepare(
        "SELECT description FROM Job WHERE id = ?",
      )
        .bind(jobId)
        .all();
	return results[0]['description'] ?? '';
}

const addApplication = async (personId: number, jobId: number, evaluation: string, score: number, DB: D1Database) => {
    const applicationSQl = `INSERT INTO Application (person_id, job_id, evalution, score) VALUES (?, ?, ?, ?);`
    try {
        await DB.prepare(applicationSQl)
            .bind(personId, jobId, evaluation, score)
            .run();
    } catch (e) {
		console.log('Error adding application')
        const err = e as Error
        throw err;
    } 
}

const addResumeToStore = async (resume: any, r2_key: string, resumeRaw: string, DB: D1Database) => {
    try {
        const { first_name, last_name, email, phone, address, education, experience, skills, certifications, awards } = resume;

        const personId = await addPerson(first_name, last_name, email, phone, address, resumeRaw, r2_key, DB);
		console.log(personId)
		if(!personId) {
			throw new Error('Error adding personal info')
		}
        await addEducation(personId, education, DB)
        await addExperience(personId, experience, DB)
        await addSkills(personId, skills, DB)
        await addCertification(personId, certifications, DB)
        await addAwards(personId, awards, DB)
        return personId;
    } catch (e) {
        const err = e as Error
        throw err;
    }
}

const addPerson = async (first_name: string, last_name: string, email: string, phone: string, address: string, resumeRaw: string, r2_key: string, DB: D1Database) => {
    const personalSQl = `INSERT INTO PersonalInformation (first_name, last_name, email, phone_number, address, raw_resume, r2_key) VALUES (?, ?, ?, ?, ?, ?, ?);`
    try {
       const results = await DB.prepare(personalSQl)
            .bind(first_name, last_name, email, phone, address, resumeRaw, r2_key)
            .run();
		console.log(results.meta)
		return results.meta.last_row_id
    } catch (e) {
		console.log('Error adding personal info')
        const err = e as Error
        throw err;
    } 
}

const addSkills = async (personId: number, skills: any[], DB: D1Database) => {
	if ( skills!==null && skills.length == 0) {
        return;
    }

    const skillsSQl = `INSERT INTO Skills (person_id, skill) VALUES (?, ?)`    
    try {
        const stmt = DB.prepare(skillsSQl);
        const batch = skills.map(s => stmt.bind(personId, s.skill))
        const batchResult = await DB.batch(batch);
    } catch (e) {
		console.log('Error adding skills')
        const err = e as Error
        throw err;
    } 
}

const addExperience = async (personId: number, experience: any[], DB: D1Database) => {
    const expierenceSQL = `INSERT INTO Experience (person_id, position, organization, start_date, end_date, responsibilities) VALUES (?, ?, ?, ?, ?, ?)`  
    if (experience!==null && experience.length == 0) {
        return;
    }
	try {
        const stmt = DB.prepare(expierenceSQL);
        const batch = experience.map(e => stmt.bind(personId, e. position, e.organization, e.start_date, e.end_date, JSON.stringify(e.responsibilities)))
        const batchResult = await DB.batch(batch);
    } catch (e) {
		console.log('Error adding experience')
        const err = e as Error
        throw err;
    } 
}

const addCertification = async (personId: number, certifications: any[], DB: D1Database) => {
    if (certifications!==null && certifications.length == 0) {
        return;
    }
    const certificationsSQl = `INSERT INTO Certifications (person_id, certification) VALUES (?, ?)`
    try {
        const stmt = DB.prepare(certificationsSQl);
        const batch = certifications.map(c => stmt.bind(personId, c.certification))
        const batchResult = await DB.batch(batch);
    } catch (e) {
		console.log('Error adding certifications')
        const err = e as Error
        throw err;
    } 
}

const addAwards = async (personId: number, awards: any[], DB: D1Database) => {
    if (awards!==null && awards.length == 0) {
        return;
    }
    const awardsSQl = `INSERT INTO Awards (person_id, award) VALUES (?, ?)`
    try {
        const stmt = DB.prepare(awardsSQl);
        const batch = awards.map(a => stmt.bind(personId, a.award))
        const batchResult = await DB.batch(batch);
    } catch (e) {
		console.log('Error adding awards')
        const err = e as Error
        throw err;
    } 
}

const addEducation = async (personId: number, education: any[], DB: D1Database) => {
    if (education!==null && education.length == 0) {
        return;
    }
    const educationSQl = `INSERT INTO Education (person_id, degree, institution) VALUES (?, ?, ?);`
    try {
        const stmt = DB.prepare(educationSQl);
        const batch =  education.map(e => stmt.bind(personId, e.degree, e.institution))
        const batchResult = await DB.batch(batch);
    } catch (e) {
		console.log('Error adding education')
		const err = e as Error
        throw err;
    } 
}

const parseResume = async (resumeText: string, AI: Ai) => {
	console.log(resumeText)
    try {

        const model = '@cf/meta/llama-3.1-8b-instruct';
		// const gemma = '@cf/google/gemma-2b-it-lora'
		// const llama3b = '@cf/meta/llama-3.2-3b-instruct'
		// const gemma7b = '@hf/google/gemma-7b-it'

		const prompt = `Parse the resume below and extract the following information returning ONLY a json object and NO other text or explanations before or after the JSON object: 
		
		JSON Object example:

		{ 
		"first_name": "John",
		"last_name": "Doe", 
		 "email": "jd@gmail.com", 
		 "phone": "123-456-7890", 
		 "address": "123 Main St, City, State, Zip",
		 "education": [{ 
				"degree:" "Bachelor of Science", 
				"major": "Computer Science",
				"institution": "University of California, Berkeley",
				"year: "2000" 
			},
		 ],
		 "experience": [{
			"position": "Recruiting Consultant",
			"organization": "Alliance Resource Consulting",
			"start_date": "April 2004",
			"end_date": "December 2006",
			"responsibilities": [
				"Conducted screening calls and background checks",
				"Evaluated candidates and coordinated research",
				"Assisted in job profile development",
				"Generated and tracked proposals and prepared contracts",
				"Developed marketing materials"
			]
		},
		"skills": ["Python", "Java", "C++"],
		"certifications": ["AWS Certified Developer", "Google Cloud Professional"],
		"awards": ["Award 1", "Award 2"] 
		}
		 
		Resume: 
		${resumeText}`

		const messages = [
			{ role: "system", content: "You parse text only returning json objects" },
			{
			  role: "user",
			  content: prompt,
			},
		];

        const answer = await AI.run(model, 
			{ 
				messages, 
				max_tokens: 1000, 
			}) as { response: string };

		const cleanedresume = answer.response.replaceAll('`','').replace('json', '')
		const resumeJson = JSON.parse(cleanedresume);
		return resumeJson;
    } catch (e) {
		console.log('Error parsing resume')
        const err = e as Error
        throw err;
    }
}

const evaluateResume = async (resumeText: string, jobDescription: any, AI: Ai) => {
	const model = '@cf/meta/llama-3.1-8b-instruct';

	try {

		const messages = [
			{ 
				role: "system", 
				content: "You are an expert recruiter who evaluates resumes for a given job." 
			},
			{
			  	role: "user",
			  	content: `Evaluate the resume for the job description and provide a score, returning ONLY a json object with no explanation before or after the json object. 
				
				json object example:

				{"evaluation": "The candidate is qualified....', "score": 3 } 
				
				Resume: 
				${resumeText} 

				Job Description: 
				${jobDescription}`,
			},
		  ];
        const answer = await AI.run(model, 
			{ 
				messages, 
				max_tokens: 1000, 
			}) as { response: string };

		console.log(answer.response)
		const cleanedeval = answer.response.replaceAll('`','').replace('json', '')
		const eval1 = JSON.parse(cleanedeval)
		return eval1;
	} catch (e) {
		console.log('Error evaluating resume')
		const err = e as Error
		throw err;
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		// Get the pathname from the request
		const pathname = new URL(request.url).pathname;

		const DB = env.DB;
		const AI = env.AI;

		if (pathname === '/api/upload' && request.method === 'POST') {

			const formData = await request.formData();

			const file = formData.get('pdfFile') as File;

			const jobIdStr = formData.get('jobId') as string

			const jobId = parseInt(jobIdStr);

			const upload = await env.resumes.put(file.name, file);

			const r2_key = upload?.key ?? file.name;

			const buffer = await file.arrayBuffer();

			const document = await getDocumentProxy(new Uint8Array(buffer));

			const { text } = await extractText(document, { mergePages: true });

			const resumeJson = await parseResume(text, AI);

			const personId = await addResumeToStore(resumeJson, r2_key, text, DB);

			const jobDescription = await getJobDescription(jobId, DB);

			const { evaluation, score } = await evaluateResume(text, jobDescription, AI);

			await addApplication(personId, jobId, evaluation, score,  DB);
			
			return Response.json({ text, evaluation, score }); 
		} else if (pathname === '/api/list') {
			const files = await env.resumes.list();
			return new Response(JSON.stringify(files), {
				headers: {
					'Content-Type': 'application/json',
				},
				status: 200,
			});
		}

		return new Response('incorrect route', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
