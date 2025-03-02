import * as dotenv from "dotenv";
dotenv.config();

import { getPdfPageImages, getPdfPageText } from "./pdf";
import * as ncp from "copy-paste";
import { promisify } from "util";
import { OpenAI } from "openai";
import {
  checkIfStatement,
  extractTransactionDetails,
  fraudDetection,
  getStatementDetails,
} from "./openai";
import { calculateBalance } from "./utils";

const copyToClipboard = promisify(ncp.copy);

async function main() {
  console.log("Starting...");
  const pageImages = await getPdfPageImages("./pdfs/statement1.pdf");

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  //check if document is a statement
  const { accept } = await checkIfStatement(pageImages);

  if (!accept) {
    console.log("Document is not a statement");
    return;
  }

  console.log("Document is a statement");

  const { name, address } = await getStatementDetails(pageImages);

  console.log("Name:", name);
  console.log("Address:", address);

  const {
    valid,
    thoughts,
    originalBalance,
    finalBalance,
    calculatedBalance,
    transactions,
  } = await extractTransactionDetails(pageImages);

  if (!valid) {
    console.log("Transaction details are not valid");
  }

  console.log("Transaction details are valid");

  console.log(`////////////////////////////////`);
  console.log("Original balance:", originalBalance);
  console.log("Final balance on statement:", finalBalance);
  console.log("Calculated balance:", calculatedBalance);
  console.log("Transactions:", transactions);
  console.log("Thoughts:", thoughts);
  console.log("///////////////////////////////////");

  const manualBalance = calculateBalance(
    originalBalance.value,
    transactions.map((transaction) => ({
      amount: transaction.amount.value,
      type: transaction.amount.type,
    }))
  );

  console.log("Manual balance:", manualBalance);

  /// part 2

  const pageTexts = await getPdfPageText("./pdfs/statement1.pdf");

  const {
    documentAnalysis,
    fraudThoughts,
    concludingThoughts,
    fraudLikelihood,
    fraudFinal,
  } = await fraudDetection(
    pageImages.map((image, index) => ({
      imageUrl: image,
      extractedText: pageTexts[index],
    }))
  );

  console.log("Document analysis:", documentAnalysis);
  console.log("Fraud likelihood:", fraudLikelihood);
  console.log("Fraud thoughts:", fraudThoughts);
  console.log("Concluding thoughts:", concludingThoughts);
  console.log("Fraud final:", fraudFinal);
}

main();
