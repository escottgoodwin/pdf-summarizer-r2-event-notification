
# PDF Summarizer with R2 and Workers AI

This project demonstrates how to use Cloudflare R2 event notifications to process PDF files automatically when they are uploaded to an R2 bucket. It uses Workers AI to summarize the PDF content and stores the summary as a text file in the same bucket.

## Features

- Upload PDF files to Cloudflare R2 bucket
- Automatically process uploaded PDFs using R2 event notifications
- Extract text from PDF files
- Summarize the extracted text using Workers AI
- Store the summary as a text file in the R2 bucket

## Prerequisites

- Cloudflare account with Workers and R2 enabled
- Node.js and npm installed on your local machine
- Wrangler CLI installed (`npm install -g wrangler`)

## Setup

1. Clone this repository:

```bash
git clone https://github.com/your-username/pdf-summarizer.git

cd pdf-summarizer
```

2. Install dependencies:

```bash
npm install
```

3. Create a Queue

```bash
npx wrangler queues create pdf-summarizer
```

4. Configure your wrangler.toml file with your R2 bucket and Queue consumer.

5. Deploy the Worker:

```bash
npm run deploy
```

6. Set up R2 event notifications for your bucket to trigger the worker's queue handler.

```bash
npx wrangler r2 bucket notification create <R2_BUCKET_NAME> --event-type object-create --queue pdf-summarizer --suffix "pdf"
```

## Usage

### Uploading a PDF via App UI

Navigate to the deployed Worker's URL and upload a PDF file. The Worker will process the PDF and store the summary as a text file in the R2 bucket.

### Uploading a PDF via CLI

Send a POST request to `/api/upload` with the PDF file in the request body:

```bash
curl -X POST -F 'pdfFile=@EvanGoodwinResume3.pdf' http://localhost:8787/api/upload

```

### Listing Files

To list all files in the R2 bucket, send a GET request to `/api/list`:

```bash
curl <WORKER_URL>/api/list
```

## How it Works
When a PDF is uploaded to the R2 bucket, it triggers an event notification.

The consumer Worker processes the event
- retrieving the PDF from the bucket.
- extract the PDF content using the [unpdf library]().
- Workers AI summarizes the extracted text.
- The summary is stored as a text file in the same R2 bucket with the naming convention `{original-filename}-summary.txt`.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License.