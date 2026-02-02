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

const runScreenshot = async (url: string) => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 900,
    },
  });

  await page.goto(url, {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: "fullpage.png", fullPage: true });

  await browser.close();
};

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
  try {
    runScreenshot(value).then((result) => console.log(result));
    renderer.console.toggle();

    console.log("Snapshot captured successfully");
  } catch (e) {
    renderer.console.toggle();
    console.log(e);
  }
});

renderer.root.add(form);
