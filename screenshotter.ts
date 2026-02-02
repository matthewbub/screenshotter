import { chromium } from "playwright";
import {
  createCliRenderer,
  Text,
  Box,
  Input,
  InputRenderableEvents,
  ConsolePosition,
} from "@opentui/core";

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    sizePercent: 30,
  },
});

const inputUrl = Input({
  id: "url",
  placeholder: "Enter the full URL (including https://)",
  width: 50,
});

const form = Box(
  { borderStyle: "rounded", padding: 1, flexDirection: "column", gap: 1 },
  Text({
    content: "Full Screenshot Tool",
  }),
  Text({
    content: "Enter the URL of the website you wish to capture.",
  }),
  inputUrl,
);

inputUrl.focus();

inputUrl.on(InputRenderableEvents.ENTER, (value: string) => {
  renderer.console.toggle();
  console.log("Current value: ", value);
});

renderer.root.add(form);

/* 
  *
  * (async () => {

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 900,
    },
  });

  await page.goto("https://yulissaandmatthew.com", {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: "fullpage.png", fullPage: true });

  await browser.close();
})();

*/
