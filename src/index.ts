import * as dotenv from "dotenv";
dotenv.config();

import { getPdfPageImages } from "./pdf";
import * as ncp from "copy-paste";
import { promisify } from "util";
import { OpenAI } from "openai";
import {
  checkIfStatement,
  extractTransactionDetails,
  getStatementDetails,
} from "./openai";

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
    originalBalance,
    finalBalance,
    calculatedBalance,
    transactions,
  } = await extractTransactionDetails(pageImages);

  if (!valid) {
    console.log("Transaction details are not valid");
    console.log("Original balance:", originalBalance);
    console.log("Final balance on statement:", finalBalance);
    console.log("Calculated balance:", calculatedBalance);
    console.log("Transactions:", transactions);

    return;
  }

  console.log("Transaction details are valid");

  /// part 2
}

main();
