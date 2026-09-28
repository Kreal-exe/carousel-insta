import {
  Unbounded,
  Montserrat,
  Playfair_Display,
  Cormorant_Garamond,
  Inter,
  Manrope,
  Oswald,
  Caveat,
  Lora,
  Rubik,
} from "next/font/google";

// Все шрифты с кириллицей. Самохостинг через next/font — важно для экспорта PNG:
// шрифты лежат на том же домене и корректно встраиваются в картинку.
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "800"], variable: "--f-unbounded" });
const montserrat = Montserrat({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "700", "800", "900"], variable: "--f-montserrat" });
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "700", "800"], style: ["normal", "italic"], variable: "--f-playfair" });
const cormorant = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--f-cormorant" });
const inter = Inter({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700", "800"], variable: "--f-inter" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "700", "800"], variable: "--f-manrope" });
const oswald = Oswald({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "700"], variable: "--f-oswald" });
const caveat = Caveat({ subsets: ["latin", "cyrillic"], weight: ["400", "700"], variable: "--f-caveat" });
const lora = Lora({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "700"], style: ["normal", "italic"], variable: "--f-lora" });
const rubik = Rubik({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "700", "900"], variable: "--f-rubik" });

export const fontVariables = [
  unbounded, montserrat, playfair, cormorant, inter, manrope, oswald, caveat, lora, rubik,
]
  .map((f) => f.variable)
  .join(" ");
