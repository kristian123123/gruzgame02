export const ROBO_TAPPER_CHECKIN_PRICE_ETH = "0.00001";
export const ROBO_TAPPER_CONTRACT_ADDRESS = "0x70B9c94BCc1B1B0CCA6B94948C3A8AF6fA20269c" as const;
export const ROBO_TAPPER_BUILDER_CODE = "bc_vnh64v7g";
export const ROBO_TAPPER_BUILDER_CODE_DATA_SUFFIX =
  "0x62635f766e6836347637670b0080218021802180218021802180218021" as const;

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
    stateMutability: "payable",
    type: "function",
  },
] as const;

export function withRoboTapperBuilderCodeDataSuffix(data: `0x${string}`): `0x${string}` {
  return `${data}${ROBO_TAPPER_BUILDER_CODE_DATA_SUFFIX.slice(2)}` as `0x${string}`;
}

export function getRoboTapperContractAddress(): `0x${string}` {
  return ROBO_TAPPER_CONTRACT_ADDRESS;
}
