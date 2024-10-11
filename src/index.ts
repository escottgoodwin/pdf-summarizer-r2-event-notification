import { extractText, getDocumentProxy } from 'unpdf';

type QueueMessage = {
	account: string;
	bucket: string;
	object: {
		key: string;
		size: number;
		eTag: string;
	};
	action: string;
	eventTime: string;
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		// Get the pathname from the request
		const pathname = new URL(request.url).pathname;

		if (pathname === '/api/upload' && request.method === 'POST') {
			// Get the file from the request
			const formData = await request.formData();
			const file = formData.get('pdfFile') as File;

			// Upload the file to Cloudflare R2
			const upload = await env.MY_BUCKET.put(file.name, file);
			return new Response('File uploaded successfully', { status: 200 });
		} else if (pathname === '/api/list') {
			// List all files in the bucket
			const files = await env.MY_BUCKET.list();
			return new Response(JSON.stringify(files), {
				headers: {
					'Content-Type': 'application/json',
				},
				status: 200,
			});
		}

		return new Response('incorrect route', { status: 404 });
	},
	async queue(batch: MessageBatch<QueueMessage>, env): Promise<void> {
		for (let message of batch.messages) {
			// Get the file from the R2 bucket
			console.log(`Processing file: ${message.body.object.key}`);
			const file = await env.MY_BUCKET.get(message.body.object.key);
			if (!file) {
				console.error(`File not found: ${message.body.object.key}`);
				continue;
			}
			// Extract the textual content from the PDF
			const buffer = await file.arrayBuffer();
			const document = await getDocumentProxy(new Uint8Array(buffer));

			const { text } = await extractText(document, { mergePages: true });
			console.log(`Extracted text: ${text.substring(0, 100)}...`);

			const result: AiSummarizationOutput = await env.AI.run('@cf/facebook/bart-large-cnn', {
				input_text: text,
			});
			const summary = result.summary;
			console.log(`Summary: ${summary.substring(0, 100)}...`);

			try {
				const upload = await env.MY_BUCKET.put(`${message.body.object.key}-summary.txt`, summary, {
					httpMetadata: {
						contentType: 'text/plain',
					},
				});
				console.log(`Summary added to the R2 bucket: ${upload.key}`);
			} catch (error) {
				console.error(`Error uploading summary to R2 bucket: ${error}`);
			}
		}
	},
} satisfies ExportedHandler<Env, QueueMessage>;
