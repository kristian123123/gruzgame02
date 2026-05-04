export const roboTapperOnchainAbi = [
  {
    inputs: [{ internalType: "uint256", name: "tapsCount", type: "uint256" }],
    name: "tap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "checkIn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function getRoboTapperContractAddress(): `0x${string}` | null {
  const value = process.env.NEXT_PUBLIC_ROBO_TAPPER_CONTRACT;
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}
