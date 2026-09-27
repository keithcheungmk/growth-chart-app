import test from "node:test";
import assert from "node:assert/strict";
import { validateGuestSubmission } from "../js/guest-storage.js";

test("guest submission validates and normalizes optional fields", () => {
  const submission = validateGuestSubmission({
    name: "小明",
    sex: "M",
    dateOfBirth: "2022-06-02",
    recordDate: "2026-09-24",
    lengthHeightCm: "106.4",
    measurementMethod: "standing",
    weightKg: "18.2",
    headCircumferenceCm: "",
    notes: "訪客記錄"
  });
  assert.equal(submission.name, "小明");
  assert.equal(submission.record.lengthHeightCm, 106.4);
  assert.equal(submission.record.weightKg, 18.2);
  assert.equal(submission.record.headCircumferenceCm, null);
});

test("guest submission rejects future and pre-birth dates", () => {
  assert.throws(() => validateGuestSubmission({ name: "小明", dateOfBirth: "2022-06-02", recordDate: "2022-06-01", lengthHeightCm: 100 }), /早於生日/);
  assert.throws(() => validateGuestSubmission({ name: "小明", dateOfBirth: "2022-06-02", recordDate: "2999-01-01", lengthHeightCm: 100 }), /晚於今天/);
});
