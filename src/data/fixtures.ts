import { addDays, quarterOf } from "@/domain/logical-day";
import type { DailyLog, LogicalDate, Task } from "@/domain/types";
import { freshOnboarding } from "@/domain/onboarding";
import type { Locale } from "@/copy";
import type { AppState } from "./state";

/** Sample content for review, written in each language (it stands in for the user's own words). */
const SAMPLE = {
  en: {
    workview: "Work is how I turn curiosity into tools that make other people’s days a little lighter.",
    lifeview: "Life is for the people I love, the mountains I haven’t climbed yet, and learning slowly.",
    plans: [
      ["Lead AI products, build calmer teams", "Can I grow as a leader without giving up deep work?"],
      ["Independent studio, small useful apps", "Can a two-person studio support a family?"],
      ["Teach design thinking in the highlands", "Would teaching feel like enough? Could we live in Da Lat?"],
    ],
    objectives: ["Ship v1 of this app and use it five days a week", "Run three mornings a week", "Write a monthly letter to my team"],
    tasks: {
      t1: "Sketch the evening check-in sheet",
      t2: "Wire the living sky to real time",
      t3: "Morning run along the river",
      t4: "Draft November team letter",
      t5: "Coffee with Linh about her studio",
      t6: "Ask the Da Lat design school about a weekend workshop",
      t7: "Pay the electricity bill",
      t8: "Renew motorbike insurance",
      t9: "Groceries for the week",
      t10: "Run · intervals",
      t11: "Outline the onboarding flow",
      t12: "Fix the leaking tap",
      t13: "Read about studio pricing",
      t14: "Run · easy 5k",
      t15: "Tax paperwork",
    },
    notes: ["Two hours on the app without noticing the time.", "Dinner with the family, phones away."],
    intention: { when: "sit down after lunch", then: "write for twenty minutes" },
    decision: ["Said no to the weekend side contract", "Lifeview: family time is not negotiable this quarter."],
  },
  vi: {
    workview: "Công việc là cách mình biến sự tò mò thành những công cụ giúp ngày của người khác nhẹ nhàng hơn một chút.",
    lifeview: "Cuộc sống là dành cho những người mình thương, những ngọn núi mình chưa leo, và việc học thật chậm.",
    plans: [
      ["Dẫn dắt sản phẩm AI, đội ngũ bình tâm", "Mình có thể lớn lên trong vai trò dẫn dắt mà không đánh mất những giờ làm việc sâu không?"],
      ["Studio độc lập, ứng dụng nhỏ hữu ích", "Một studio hai người có đủ nuôi cả gia đình không?"],
      ["Dạy tư duy thiết kế trên cao nguyên", "Dạy học có đủ với mình không? Cả nhà có sống được ở Đà Lạt không?"],
    ],
    objectives: ["Ra mắt bản đầu của ứng dụng này và dùng năm ngày mỗi tuần", "Chạy bộ ba buổi sáng mỗi tuần", "Viết thư hằng tháng cho cả đội"],
    tasks: {
      t1: "Phác thảo màn khép lại ngày",
      t2: "Nối bầu trời với giờ thật",
      t3: "Chạy bộ buổi sáng dọc bờ sông",
      t4: "Viết nháp thư tháng Mười Một cho đội",
      t5: "Cà phê với Linh về studio của bạn ấy",
      t6: "Hỏi trường thiết kế ở Đà Lạt về một buổi workshop cuối tuần",
      t7: "Đóng tiền điện",
      t8: "Gia hạn bảo hiểm xe máy",
      t9: "Đi chợ cho cả tuần",
      t10: "Chạy · biến tốc",
      t11: "Phác thảo luồng làm quen",
      t12: "Sửa vòi nước bị rỉ",
      t13: "Tìm hiểu cách các studio định giá",
      t14: "Chạy · 5 km nhẹ nhàng",
      t15: "Giấy tờ thuế",
    },
    notes: ["Hai tiếng làm ứng dụng mà không để ý giờ giấc.", "Ăn tối cùng gia đình, cất điện thoại đi."],
    intention: { when: "ngồi xuống sau bữa trưa", then: "viết trong hai mươi phút" },
    decision: ["Từ chối hợp đồng làm thêm cuối tuần", "Góc nhìn cuộc sống: thời gian cho gia đình là điều không thương lượng trong quý này."],
  },
} satisfies Record<Locale, unknown>;

/** A lived-in week for design review. Dates are relative to `today`. */
export function fixtures(today: LogicalDate, timeZone: string, locale: Locale = "vi"): AppState {
  const w = SAMPLE[locale];
  const q = quarterOf(today);
  const at = (date: LogicalDate, hh: number) => {
    const d = new Date(`${date}T00:00:00`);
    d.setHours(hh, 12, 0, 0);
    return d.toISOString();
  };
  const y = addDays(today, -1);

  const t = (id: keyof typeof w.tasks, rest: Partial<Task>): Task => ({
    id,
    title: w.tasks[id],
    kind: "maintenance",
    objectiveId: null,
    prototypePlanId: null,
    dueDate: null,
    top3Date: null,
    doneAt: null,
    closedAt: null,
    createdAt: at(addDays(today, -8), 9),
    ...rest,
  });

  const log = (date: LogicalDate, e: number, g: number, m: DailyLog["meaningSources"], note = ""): DailyLog => ({
    date,
    intention: null,
    energy: e,
    engagement: g,
    top3TaskIds: [],
    meaningSources: m,
    note,
    morningAt: at(date, 7),
    closedAt: at(date, 21),
  });

  return {
    version: 1,
    userId: "user_owner",
    onboarded: true,
    // The owner onboarded a month ago: every tip seen, reminder already offered.
    onboarding: {
      setupDate: addDays(today, -30),
      seenTips: ["top3", "capture", "morning", "evening", "closedDay", "life"],
      reminderAskedAt: at(addDays(today, -29), 21),
      nudges: {},
    },
    settings: { timeZone, reminderTime: "07:00", eveningHour: 19, dayEndHour: 4, theme: "sky", locale, sound: true },
    compass: {
      workview: w.workview,
      lifeview: w.lifeview,
    },
    plans: [
      {
        id: "plan_1",
        slot: 1,
        title: w.plans[0][0],
        questions: w.plans[0][1],
        gauges: { resources: 7, likability: 6, confidence: 7, coherence: 8 },
        isActive: true,
      },
      {
        id: "plan_2",
        slot: 2,
        title: w.plans[1][0],
        questions: w.plans[1][1],
        gauges: { resources: 4, likability: 8, confidence: 5, coherence: 7 },
        isActive: false,
      },
      {
        id: "plan_3",
        slot: 3,
        title: w.plans[2][0],
        questions: w.plans[2][1],
        gauges: { resources: 3, likability: 9, confidence: 4, coherence: 6 },
        isActive: false,
      },
    ],
    objectives: [
      { id: "obj_1", planId: "plan_1", title: w.objectives[0], quarter: q, status: "active" },
      { id: "obj_2", planId: "plan_1", title: w.objectives[1], quarter: q, status: "active" },
      { id: "obj_3", planId: "plan_1", title: w.objectives[2], quarter: q, status: "active" },
    ],
    tasks: [
      t("t1", { kind: "objective", objectiveId: "obj_1", top3Date: y, doneAt: at(y, 15) }),
      t("t2", { kind: "objective", objectiveId: "obj_1", top3Date: y }),
      t("t3", { kind: "objective", objectiveId: "obj_2", top3Date: y, doneAt: at(y, 6) }),
      t("t4", { kind: "objective", objectiveId: "obj_3", dueDate: addDays(today, 9) }),
      t("t5", { kind: "prototype", prototypePlanId: "plan_2" }),
      t("t6", { kind: "prototype", prototypePlanId: "plan_3" }),
      t("t7", { kind: "maintenance", dueDate: today }),
      t("t8", { kind: "maintenance", dueDate: addDays(today, -1) }),
      t("t9", { kind: "maintenance" }),
      t("t10", { kind: "objective", objectiveId: "obj_2", doneAt: at(addDays(today, -3), 6) }),
      t("t11", { kind: "objective", objectiveId: "obj_1", doneAt: at(addDays(today, -2), 11) }),
      t("t12", { kind: "maintenance", doneAt: at(addDays(today, -2), 18) }),
      t("t13", { kind: "prototype", prototypePlanId: "plan_2", doneAt: at(addDays(today, -4), 20) }),
      t("t14", { kind: "objective", objectiveId: "obj_2", doneAt: at(addDays(today, -5), 6) }),
      t("t15", { kind: "maintenance", doneAt: at(addDays(today, -5), 14) }),
    ],
    logs: {
      [addDays(today, -6)]: log(addDays(today, -6), 3, 4, ["flow"]),
      [addDays(today, -5)]: log(addDays(today, -5), 4, 4, ["flow", "community"]),
      [addDays(today, -4)]: log(addDays(today, -4), 2, 3, ["wonder"]),
      [addDays(today, -2)]: log(addDays(today, -2), 4, 5, ["flow", "coherence"], w.notes[0]),
      [y]: {
        ...log(y, 4, 4, ["community", "coherence"], w.notes[1]),
        intention: w.intention,
        top3TaskIds: ["t1", "t2", "t3"],
      },
    },
    decisions: [
      {
        id: "dec_1",
        date: addDays(today, -12),
        decision: w.decision[0],
        drivenBy: w.decision[1],
        linkedPlanId: "plan_1",
      },
    ],
    focus: [],
    lastKind: { kind: "objective", objectiveId: "obj_1" },
  };
}

/** Empty state for reviewing the first run. */
export function blank(timeZone: string): AppState {
  return {
    version: 1,
    userId: "user_owner",
    onboarded: false,
    onboarding: freshOnboarding(null),
    settings: { timeZone, reminderTime: "07:00", eveningHour: 19, dayEndHour: 4, theme: "sky", locale: "vi", sound: true },
    compass: null,
    plans: [1, 2, 3].map((slot) => ({
      id: `plan_${slot}`,
      slot: slot as 1 | 2 | 3,
      title: "",
      questions: "",
      gauges: { resources: null, likability: null, confidence: null, coherence: null },
      isActive: slot === 1,
    })),
    objectives: [],
    tasks: [],
    logs: {},
    decisions: [],
    focus: [],
    lastKind: null,
  };
}
