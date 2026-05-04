const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const farcasterConfig = {
  accountAssociation: {
    header: "",
    payload: "",
    signature: "",
  },
  miniapp: {
    version: "1",
    name: "GruzGame 02",
    subtitle: "Cyberpunk Robot Tapper",
    description: "Tap the robot, perform onchain daily check-ins, and climb the leaderboard.",
    imageUrl: `${ROOT_URL}/hero.png`,
    buttonTitle: "Open GruzGame 02",
    screenshotUrls: [`${ROOT_URL}/screenshot.png`],
    iconUrl: `${ROOT_URL}/icon.png`,
    splashImageUrl: `${ROOT_URL}/splash.png`,
    splashBackgroundColor: "#120b2f",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["game", "tap", "leaderboard", "onchain", "cyberpunk", "base"],
    heroImageUrl: `${ROOT_URL}/hero.png`,
    tagline: "Tap. Check in. Level up multiplier.",
    ogTitle: "GruzGame 02",
    ogDescription: "Cyberpunk robot tap game for Base App.",
    ogImageUrl: `${ROOT_URL}/hero.png`,
    castShareUrl: ROOT_URL,
  },
} as const;

