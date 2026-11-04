import { describe, expect, it } from "vitest";
import { reminderCron } from "./reminder-schedule";

describe("reminderCron", () => {
  it("builds a daily QStash cron in the user's timezone", () => {
    expect(reminderCron("07:30", "Asia/Ho_Chi_Minh")).toBe("CRON_TZ=Asia/Ho_Chi_Minh 30 7 * * *");
  });

  it("drops leading zeros", () => {
    expect(reminderCron("06:05", "America/New_York")).toBe("CRON_TZ=America/New_York 5 6 * * *");
  });

  it("rejects malformed times and unknown zones", () => {
    expect(() => reminderCron("25:00", "Asia/Ho_Chi_Minh")).toThrow();
    expect(() => reminderCron("7:3", "Asia/Ho_Chi_Minh")).toThrow();
    expect(() => reminderCron("07:30", "Mars/Olympus")).toThrow();
  });
});
