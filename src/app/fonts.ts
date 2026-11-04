import { Forum, Red_Hat_Text } from "next/font/google";

/**
 * Display face ("the inscription"): Forum 400 only, used at 24px and above.
 * latin-ext is mandatory: ș ț (U+0218–021B) and ă â î live there.
 */
export const forum = Forum({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-forum",
  display: "swap",
});

/** Text and UI face ("the instrument"): Red Hat Text, variable 300–700, used at 400/500/600. */
export const redHat = Red_Hat_Text({
  subsets: ["latin", "latin-ext"],
  variable: "--font-redhat",
  display: "swap",
});
