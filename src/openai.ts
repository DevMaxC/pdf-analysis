import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function checkIfStatement(imageUrls: string[]) {
  const isStatement = z.object({
    documentAnalysis: z
      .string()
      .describe(
        "A detailed analysis of the image you have been presented. What is contained within it?"
      ),
    statmentThoughts: z
      .string()
      .describe(
        "Your overall task is to discover if the image(s) you have been presented make up a bank statement, you should go through each individual image presented and argue how it could support or detract from this theory."
      ),
    concludingThoughts: z
      .string()
      .describe(
        "Based on the analysis of the images, do you believe this to be a bank statement?"
      ),
    statementLikelihood: z
      .number()
      .describe("How likely is this to be a bank statement? 0-100"),
  });

  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content:
          "Follow the thought process and deduce if the images provided to you, make up a bank statement. Be wary as the images may try to trick you into thinking they are a bank statement, but they are not.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Images:" },
          ...(imageUrls.map((image) => ({
            type: "image_url",
            image_url: {
              url: image,
            },
          })) as { type: "image_url"; image_url: { url: string } }[]),
        ],
      },
    ],
    response_format: zodResponseFormat(isStatement, "isStatement"),
  });

  const parsed = completion.choices[0].message.parsed;

  const accept =
    parsed?.statementLikelihood && parsed.statementLikelihood >= 70; //use a better safe than sorry methodology

  return { accept, parsed };
}

export async function getStatementDetails(imageUrls: string[]) {
  const statementDetails = z.object({
    documentAnalysis: z
      .string()
      .describe(
        "You task is to find the name and address of the account holder. Do this by analysing the images provided to you. Analyse every section of the image individually (even after you believe you have found the information, so you don't miss anything). If you cannot find a peice of information, return 'Not Found'."
      ),
    nameFound: z
      .boolean()
      .describe("Did you find the name of the account holder?"),
    name: z.string().describe("The name of the account holder"),
    addressFound: z
      .boolean()
      .describe("Did you find the address of the account holder?"),
    address: z.string().describe("The address of the account holder"),
  });

  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are an expert at analysing bank statements, you are given a series of images which contain a bank statement. You are to extract the details of the statement and return them in a structured format.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Images:" },
          ...(imageUrls.map((image) => ({
            type: "image_url",
            image_url: {
              url: image,
            },
          })) as { type: "image_url"; image_url: { url: string } }[]),
        ],
      },
    ],
    response_format: zodResponseFormat(statementDetails, "statementDetails"),
  });

  const parsed = completion.choices[0].message.parsed;

  const final = {
    name: parsed.nameFound ? parsed.name : undefined,
    address: parsed.addressFound ? parsed.address : undefined,
  } as { name: string | undefined; address: string | undefined };

  return final;
}

export async function extractTransactionDetails(imageUrls: string[]) {
  const transactionDetails = z.object({
    thoughts: z
      .string()
      .describe(
        "Your overall task is to go through the statement and extract the details of the transactions, you should go through each individual image presented and consider all of the information on the pages. You should be careful how you detect if a transaction is incoming or outgoing, as there may be some transactions that are not clearly identifiable as either based on the layout."
      ),
    originalBalance: z
      .object({
        currency: z.string().describe("The currency of the original balance"),
        currencySymbol: z
          .string()
          .describe("The currency symbol of the original balance"),
        value: z.number().describe("The amount of the original balance"),
      })
      .describe(
        "The original balance of the account, according to the statement"
      ),
    transactions: z.array(
      z.object({
        date: z.string().describe("The date of the transaction"),
        description: z
          .string()
          .describe("The description of the transaction")
          .optional(),

        amount: z.object({
          currency: z.string().describe("The currency of the transaction"),
          currencySymbol: z
            .string()
            .describe("The currency symbol of the transaction"),
          value: z.number().describe("The amount of the transaction"),
          type: z
            .enum(["incoming", "outgoing"])
            .describe("The type of the transaction"),
          optionalOtherDetails: z
            .string()
            .describe(
              "Any other details of the transaction, this field is optional and should only be used if there is additional information that is not covered by the other fields, which would be of use."
            )
            .optional(),
        }),
      })
    ),
    finalBalanceOnStatement: z
      .object({
        currency: z.string().describe("The currency of the final balance"),
        currencySymbol: z
          .string()
          .describe("The currency symbol of the final balance"),
        value: z.number().describe("The amount of the final balance"),
      })
      .describe("The final balance of the account, according to the statement"),
    finalBalanceCalculated: z
      .object({
        currency: z.string().describe("The currency of the final balance"),
        currencySymbol: z
          .string()
          .describe("The currency symbol of the final balance"),
        value: z.number().describe("The amount of the final balance"),
      })
      .describe(
        "The final balance of the account, which you should calculate by adding the original balance to the sum of all the transactions"
      ),
    isBalancesEqual: z
      .boolean()
      .describe(
        "Whether the final balance of the account according to the statement is equal to the final balance of the account calculated by adding the original balance to the sum of all the transactions"
      ),
    anyMissingInformation: z
      .boolean()
      .describe(
        "Whether you are missing any information from the statement, if you are missing information, return true"
      ),
  });

  //using o3-mini so that it can reason deeper about the images its seeing and hopefully be more accurate on calculating transaction details.
  const completion = await openai.beta.chat.completions.parse({
    model: "o1",
    reasoning_effort: "medium",
    messages: [
      {
        role: "system",
        content: `You are an expert at analysing bank statements, you are given a series of images which contain a bank statement. You are to extract the details of the statement and return them in a structured format.

        You are given a list of screenshots of a bank statement, you are to extract the details of the statement and return them in a structured format.

        You will be expected to:
        - Extract the original balance of the account
        - Extract the final balance of the account
        - Extract the transactions from the statement
        - Calculate the final balance of the account by adding the original balance to the sum of all the transactions
        - Check if the final balance of the account according to the statement is equal to the final balance of the account calculated by adding the original balance to the sum of all the transactions     
        
        Think deeply about everything you are given, iterate over your thoughts and reasoning process, and ensure you have considered everything.

        It is critical that you are as accurate as possible as your output will be used to make important decisions.
        `,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Images:" },
          ...(imageUrls.map((image) => ({
            type: "image_url",
            image_url: { url: image, detail: "high" },
          })) as {
            type: "image_url";
            image_url: { url: string; detail: "high" };
          }[]),
        ],
      },
    ],
    response_format: zodResponseFormat(
      transactionDetails,
      "transactionDetails"
    ),
  });

  const parsed = completion.choices[0].message.parsed;

  const final = {
    thoughts: parsed.thoughts,
    valid: parsed.isBalancesEqual && !parsed.anyMissingInformation,
    originalBalance: parsed.originalBalance,
    finalBalance: parsed.finalBalanceOnStatement,
    calculatedBalance: parsed.finalBalanceCalculated,
    transactions: parsed.transactions,
  };

  return final;
}

export async function fraudDetection(
  pages: {
    imageUrl: string;
    extractedText: string;
  }[]
) {
  const fraudDetection = z.object({
    documentAnalysis: z
      .string()
      .describe(
        "A detailed analysis of the images you have been presented. What is contained within it?"
      ),
    fraudThoughts: z
      .string()
      .describe(
        "Are there any obvious signs of fraud within the images? Some examples would include, poorly edited document parts, obvious leftover placeholder text, or other obvious signs of fraud."
      ),
    concludingThoughts: z
      .string()
      .describe(
        "Based on the analysis of the images, do you believe this to be a bank statement?"
      ),
    fraudFinal: z
      .array(
        z.object({
          fraudThought: z
            .string()
            .describe("A concern you have within the document"),
          causeForConcern: z
            .enum(["low", "medium", "high"])
            .describe(
              "How concerning this is to you when searching for fraud."
            ),
        })
      )
      .describe(
        "This section should be the final report of what you presented above, but in a structured, list format."
      ),
    fraudLikelihood: z
      .number()
      .describe(
        "If you had to numerically represent the likelihood of fraud, what would that number be? 0 (low) - 100 (high)"
      ),
  });

  const completion = await openai.beta.chat.completions.parse({
    model: "o1",
    reasoning_effort: "medium",
    messages: [
      {
        role: "system",
        content: `You are an expert at detecting fraud within bank statements, you are given a series of images which make up a bank statement. You are to detect if there are any obvious signs of fraud within the images and return them in a structured format.
        You can avoid looking at the net transfer balance, as this is checked manually by a human, instead focus on the other details.

        You will also be given the text extracted from the page, you may want to use this to help you detect hidden text or overlapping text which may be difficult to detect or decipher in the image, this can be a good indicator of a red flag.
        `,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Images:" },
          ...(pages.map((page) => ({
            type: "image_url",
            image_url: { url: page.imageUrl, detail: "high" },
          })) as {
            type: "image_url";
            image_url: { url: string; detail: "high" };
          }[]),
          { type: "text", text: "PDF PAGES - Text extracted from each page:" },
          ...pages.map((page, index) => ({
            type: "text" as const,
            text: `Page ${index + 1}: ${page.extractedText}`,
          })),
        ],
      },
    ],
    response_format: zodResponseFormat(fraudDetection, "fraudDetection"),
  });

  const parsed = completion.choices[0].message.parsed;

  return parsed;
}
