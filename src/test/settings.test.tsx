import { getSettings, setSettings } from "../settings";

beforeEach(() => localStorage.clear());

test("font clamps to 10–24", () => {
  setSettings({ fontSize: 99 });
  expect(getSettings().fontSize).toBe(24);
  setSettings({ fontSize: 1 });
  expect(getSettings().fontSize).toBe(10);
});

test("defaultView rejects invalid values", () => {
  setSettings({ defaultView: "preview" });
  setSettings({ defaultView: "bogus" as never });
  expect(getSettings().defaultView).toBe("preview");
});

test("previewTheme validates + persists", () => {
  setSettings({ previewTheme: "light" });
  expect(getSettings().previewTheme).toBe("light");
  expect(JSON.parse(localStorage.getItem("md-settings")!).previewTheme).toBe("light");
  setSettings({ previewTheme: "nope" as never });
  expect(getSettings().previewTheme).toBe("light");
});
