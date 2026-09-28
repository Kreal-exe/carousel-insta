import {
  Tenor_Sans,
  Forum,
  Montserrat,
  Playfair_Display,
  Cormorant_Garamond,
  Inter,
  Manrope,
  Unbounded,
  Oswald,
  Lora,
} from "next/font/google";

// Все шрифты с кириллицей. Самохостинг через next/font — шрифты встраиваются в экспорт PNG.
const tenor = Tenor_Sans({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--f-tenor" });
const forum = Forum({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--f-forum" });
const montserrat = Montserrat({ subsets: ["latin", "cyrillic"], weight: ["300", "400", "500", "600", "700", "800", "900"], variable: "--f-montserrat" });
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "700", "800"], style: ["normal", "italic"], variable: "--f-playfair" });
const cormorant = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["300", "400", "500", "600", "700"], style: ["normal", "italic"], variable: "--f-cormorant" });
const inter = Inter({ subsets: ["latin", "cyrillic"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--f-inter" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["300", "400", "500", "700", "800"], variable: "--f-manrope" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["300", "400", "600", "800"], variable: "--f-unbounded" });
const oswald = Oswald({ subsets: ["latin", "cyrillic"], weight: ["300", "400", "500", "700"], variable: "--f-oswald" });
const lora = Lora({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "700"], style: ["normal", "italic"], variable: "--f-lora" });

export const fontVariables = [tenor, forum, montserrat, playfair, cormorant, inter, manrope, unbounded, oswald, lora]
  .map((f) => f.variable)
  .join(" ");
