// ============================================================
// سياق الطلب الحالي: رمز الجلسة (JWT) للمستخدم — يُستخدم من القناة الخدمية لتمرير هوية المستخدم
// (كل استدعاء لوظيفة Netlify يعالج طلبًا واحدًا في المرة، فالمتغير آمن على مستوى الاستدعاء)
// ============================================================
let currentToken: string | null = null;

export function setRequestToken(token: string | null): void {
  currentToken = token;
}

export function getRequestToken(): string | null {
  return currentToken;
}
