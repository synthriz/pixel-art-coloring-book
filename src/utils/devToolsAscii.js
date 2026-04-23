const ART = String.raw`
  ______
/\__  _\       __
\/_/\ \/ _ __ /\_\  ____
   \ \ \/\''__\/\ \/\_ ,'\
    \ \ \ \ \/ \ \ \/_/  /_
     \ \_\ \_\  \ \_\/\____\
      \/_/\/_/   \/_/\/____/`;

const URL = "https://trizdev.vercel.app";

const GREEN = "rgb(185,227,158)";
const LILAC = "rgb(196,181,253)";

export function printConsoleArt() {
  const artColor = Math.random() < 0.5 ? GREEN : LILAC;
  const urlColor = artColor === GREEN ? LILAC : GREEN;
  const mono =
    "font-family: monospace; font-weight: bold; font-size: 12px; line-height: 1.4;";

  console.log("%c" + ART, `${mono} color: ${artColor};`);
  console.log("%csee more at → " + URL, `${mono} color: ${urlColor};`);
}
