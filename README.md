### Prerequisites

This package requires installing `poppler-utils` on your system:

- **On Windows**: Install via Chocolatey with `choco install poppler`
- **On macOS**: Install via Homebrew with `brew install poppler`
- **On Linux**: Install via apt with `apt-get install poppler-utils`

### Example Output

- See `analysis.txt` for an example of the output.

### Running

To run the repo:

1. Install prerequisites as above
2. Install packages with `npm i`
3. Optionally add your own PDF to the `pdfs` folder, and change the filename in the `index.ts` file, line 20.
4. Update the OpenAI API key in the `.env` file. An `.env.example` file has been provided.
5. Run `npx ts-node src/index.ts`
