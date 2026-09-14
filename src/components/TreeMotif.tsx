// ============================================================
// العلامة البصرية للمنصة: شجرة القضايا — سؤال قرار يتفرع إلى ثلاثة فروع لا تتداخل
// تُرسم ذاتيًا عند التحميل (تُحترم إعدادات تقليل الحركة عبر CSS)
// ============================================================
export function TreeMotif({ size = 260, stroke = "currentColor", animated = true, className = "" }: { size?: number; stroke?: string; animated?: boolean; className?: string }) {
  return (
    <svg className={`tree-motif ${animated ? "tree-animated" : ""} ${className}`} width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">
      {/* الجذر: سؤال القرار */}
      <circle cx="100" cy="28" r="10" stroke={stroke} strokeWidth="2.5" />
      <path d="M100 38 V70" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      {/* الفروع الثلاثة MECE */}
      <path d="M100 70 H40 V100" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M100 70 V100" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M100 70 H160 V100" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="22" y="100" width="36" height="20" rx="4" stroke={stroke} strokeWidth="2.5" />
      <rect x="82" y="100" width="36" height="20" rx="4" stroke={stroke} strokeWidth="2.5" />
      <rect x="142" y="100" width="36" height="20" rx="4" stroke={stroke} strokeWidth="2.5" />
      {/* الفرع الحاسم يتعمّق مستوى إضافيًا */}
      <path d="M40 120 V142 H28 M40 142 H52" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="156" r="5" fill={stroke} />
      <circle cx="52" cy="156" r="5" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}
