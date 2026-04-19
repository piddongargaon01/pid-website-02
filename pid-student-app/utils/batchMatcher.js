export const BATCH_OPTIONS = [
  { value: "12th-Eng-CBSE-ICSE", label: "12th English (CBSE+ICSE)", class: "12th", medium: "English", boards: ["CBSE", "ICSE"] },
  { value: "12th-Hindi-CG-CBSE", label: "12th Hindi (CG+CBSE)", class: "12th", medium: "Hindi", boards: ["CG", "CBSE"] },
  { value: "12th-Eng-CG", label: "12th English (CG Board)", class: "12th", medium: "English", boards: ["CG"] },
  { value: "11th-Eng-CBSE-ICSE", label: "11th English (CBSE+ICSE)", class: "11th", medium: "English", boards: ["CBSE", "ICSE"] },
  { value: "11th-Hindi-CG-CBSE", label: "11th Hindi (CG+CBSE)", class: "11th", medium: "Hindi", boards: ["CG", "CBSE"] },
  { value: "11th-Eng-CG", label: "11th English (CG Board)", class: "11th", medium: "English", boards: ["CG"] },
  { value: "10th-Eng-All", label: "10th English (CG+CBSE+ICSE)", class: "10th", medium: "English", boards: ["CG", "CBSE", "ICSE"] },
  { value: "10th-Hindi-CG-CBSE", label: "10th Hindi (CG+CBSE)", class: "10th", medium: "Hindi", boards: ["CG", "CBSE"] },
  { value: "9th-Eng-All", label: "9th English (CG+CBSE+ICSE)", class: "9th", medium: "English", boards: ["CG", "CBSE", "ICSE"] },
  { value: "9th-Hindi-CG-CBSE", label: "9th Hindi (CG+CBSE)", class: "9th", medium: "Hindi", boards: ["CG", "CBSE"] },
  { value: "2nd-8th-All", label: "2nd-8th All Medium (CG+CBSE+ICSE)", class: "2nd-8th", medium: "All", boards: ["CG", "CBSE", "ICSE"] },
  { value: "Navodaya", label: "Navodaya Entrance", class: "Navodaya", medium: "All", boards: [] },
  { value: "Prayas", label: "Prayas Awasiya Vidyalaya", class: "Prayas", medium: "All", boards: [] },
  { value: "JEE-NEET", label: "IIT-JEE & NEET (9th-12th)", class: "JEE-NEET", medium: "All", boards: [] },
];

export function studentMatchesBatch(student, batchId) {
  if (batchId === "all") return true;
  const batch = BATCH_OPTIONS.find(b => b.value === batchId);
  if (!batch) return false;

  const sClass = student.class || student.presentClass || "";
  const sMedium = student.medium || "";
  const sBoard = student.board || "";

  // Special Class: JEE-NEET
  if (batch.class === "JEE-NEET") {
    return ["9th", "10th", "11th", "12th"].includes(sClass);
  }

  // Special Class: 2nd-8th
  if (batch.class === "2nd-8th") {
    return ["2nd", "3rd", "4th", "5th", "6th", "7th", "8th"].includes(sClass);
  }

  // Basic Class match
  const classMatch = sClass === batch.class;
  if (!classMatch) return false;

  // Medium match
  const mediumMatch = batch.medium === "All" || !sMedium || sMedium === batch.medium;
  if (!mediumMatch) return false;

  // Board match
  const normalizeBoard = (b) => {
    if (!b) return "";
    if (b === "CG Board") return "CG";
    return b;
  };
  const studentBoard = normalizeBoard(sBoard);
  const boardMatch = !batch.boards || batch.boards.length === 0 || !sBoard || batch.boards.includes(studentBoard);

  return boardMatch;
}
