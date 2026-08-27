interface CourseCertificateInput {
  learnerName: string;
  courseTitle: string;
  issuedOn?: Date;
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[character] ?? character,
  );
}

/** Lightweight, print-ready certificate generated only after verified course completion. */
export function downloadCourseCertificate({
  learnerName,
  courseTitle,
  issuedOn = new Date(),
}: CourseCertificateInput): void {
  const safeName = escapeXml(learnerName);
  const safeCourse = escapeXml(courseTitle);
  const safeDate = escapeXml(issuedOn.toLocaleDateString(undefined, { dateStyle: 'long' }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8fafc"/><stop offset="1" stop-color="#eef2ff"/></linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#4f46e5"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>
  </defs>
  <rect width="1400" height="990" fill="url(#bg)"/>
  <rect x="35" y="35" width="1330" height="920" rx="18" fill="none" stroke="#312e81" stroke-width="4"/>
  <rect x="55" y="55" width="1290" height="880" rx="12" fill="none" stroke="#a5b4fc" stroke-width="2"/>
  <rect x="490" y="105" width="420" height="8" rx="4" fill="url(#accent)"/>
  <text x="700" y="175" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#4338ca">DATABEAT LMS</text>
  <text x="700" y="275" text-anchor="middle" font-family="Georgia, serif" font-size="66" font-weight="700" fill="#172554">Certificate of Completion</text>
  <text x="700" y="350" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" fill="#475569">This certificate recognizes that</text>
  <text x="700" y="445" text-anchor="middle" font-family="Georgia, serif" font-size="54" font-weight="700" fill="#312e81">${safeName}</text>
  <line x1="300" y1="475" x2="1100" y2="475" stroke="#a5b4fc" stroke-width="2"/>
  <text x="700" y="535" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" fill="#475569">has successfully completed</text>
  <foreignObject x="180" y="570" width="1040" height="155">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Georgia,serif;font-size:42px;font-weight:700;color:#1e293b;text-align:center;display:flex;align-items:center;justify-content:center;height:100%;line-height:1.2;">${safeCourse}</div>
  </foreignObject>
  <circle cx="700" cy="800" r="54" fill="url(#accent)"/><path d="M672 800l18 18 39-44" fill="none" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="700" y="895" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#64748b">Issued ${safeDate} · Verified from current LMS course progress</text>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${
    courseTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'course'
  }-certificate.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
