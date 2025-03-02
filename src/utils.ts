export function calculateBalance(
  originalBalance: number,
  transactions: { amount: number; type: "incoming" | "outgoing" }[]
) {
  return (
    originalBalance +
    transactions.reduce(
      (acc, transaction) =>
        acc +
        (transaction.type === "incoming"
          ? transaction.amount
          : -transaction.amount),
      0
    )
  );
}
