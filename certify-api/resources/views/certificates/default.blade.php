<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');

  /* Fallback to Noto Sans Arabic when Cairo isn't available (offline rendering) */
  @font-face {
    font-family: 'Noto Sans Arabic';
    font-style: normal;
    font-weight: 400 800;
    src: local('Noto Sans Arabic');
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    width: 1123px;
    height: 794px;
    overflow: hidden;
    font-family: 'Cairo', 'Noto Sans Arabic', 'Arial', sans-serif;
    direction: rtl;
    text-align: right;
  }

  .certificate {
    position: relative;
    width: 100%;
    height: 100%;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 80px;
  }

  /* Decorative border */
  .border-outer {
    position: absolute;
    inset: 20px;
    border: 3px solid {{ $primaryColor }};
    pointer-events: none;
  }
  .border-inner {
    position: absolute;
    inset: 28px;
    border: 1px solid {{ $primaryColor }}44;
    pointer-events: none;
  }

  /* Corner accents */
  .corner {
    position: absolute;
    width: 40px;
    height: 40px;
    border-color: {{ $primaryColor }};
    border-style: solid;
  }
  .corner.tl { top: 14px; right: 14px; border-width: 4px 0 0 4px; transform: scaleX(-1); }
  .corner.tr { top: 14px; left: 14px; border-width: 4px 4px 0 0; transform: scaleX(-1); }
  .corner.bl { bottom: 14px; right: 14px; border-width: 0 0 4px 4px; transform: scaleX(-1); }
  .corner.br { bottom: 14px; left: 14px; border-width: 0 4px 4px 0; transform: scaleX(-1); }

  /* Top accent bar */
  .accent-bar {
    width: 120px;
    height: 5px;
    background: linear-gradient(90deg, {{ $primaryColor }}, {{ $primaryColor }}88);
    border-radius: 3px;
    margin-bottom: 24px;
  }

  /* Logo */
  .logo-wrap {
    margin-bottom: 18px;
  }
  .logo-wrap img {
    max-height: 60px;
    max-width: 180px;
    object-fit: contain;
  }
  .org-name-only {
    font-size: 16px;
    font-weight: 700;
    color: {{ $primaryColor }};
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .heading {
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .cert-title {
    font-size: 38px;
    font-weight: 800;
    color: #111827;
    margin-bottom: 20px;
  }

  .presented-to {
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 14px;
  }

  .recipient-name {
    font-size: 42px;
    font-weight: 800;
    color: {{ $primaryColor }};
    margin-bottom: 20px;
    line-height: 1.2;
    text-align: center;
  }

  .course-line {
    font-size: 14px;
    color: #374151;
    margin-bottom: 6px;
    text-align: center;
  }
  .course-name {
    font-size: 20px;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 28px;
    text-align: center;
  }

  .divider {
    width: 80%;
    height: 1px;
    background: #e5e7eb;
    margin-bottom: 24px;
  }

  .footer-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    width: 80%;
    direction: rtl;
  }

  .sig-block {
    text-align: center;
    min-width: 140px;
  }
  .sig-block img {
    max-height: 52px;
    max-width: 120px;
    margin-bottom: 6px;
    object-fit: contain;
  }
  .sig-line {
    width: 120px;
    height: 1px;
    background: #9ca3af;
    margin: 6px auto;
  }
  .sig-label {
    font-size: 11px;
    color: #6b7280;
  }

  .date-block {
    text-align: center;
  }
  .date-label {
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 4px;
  }
  .date-value {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  .qr-block {
    text-align: center;
  }
  .qr-block svg {
    width: 80px;
    height: 80px;
  }
  .verify-label {
    font-size: 10px;
    color: #9ca3af;
    margin-top: 4px;
  }

  .verify-code {
    position: absolute;
    bottom: 34px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    color: #9ca3af;
    letter-spacing: 2px;
    font-family: monospace;
  }
</style>
</head>
<body>
<div class="certificate">
  <!-- Decorative borders -->
  <div class="border-outer"></div>
  <div class="border-inner"></div>
  <div class="corner tl"></div>
  <div class="corner tr"></div>
  <div class="corner bl"></div>
  <div class="corner br"></div>

  <!-- Logo / org name -->
  <div class="logo-wrap">
    @if($logoUrl)
      <img src="{{ $logoUrl }}" alt="{{ $orgName }}">
    @else
      <div class="org-name-only">{{ $orgName }}</div>
    @endif
  </div>

  <div class="accent-bar"></div>
  <div class="heading">Certificate of Completion</div>
  <h1 class="cert-title">شهادة إتمام</h1>
  <p class="presented-to">تشهد هذا المنصة بأن المتدرب / المتدربة</p>

  <div class="recipient-name">{{ $recipientName }}</div>

  @if($courseName)
    <p class="course-line">قد أتمّ بنجاح دورة</p>
    <p class="course-name">{{ $courseName }}</p>
  @endif

  <div class="divider"></div>

  <div class="footer-row">
    <!-- Signature -->
    <div class="sig-block">
      @if($signatureUrl)
        <img src="{{ $signatureUrl }}" alt="توقيع">
      @endif
      <div class="sig-line"></div>
      <div class="sig-label">توقيع المُصدر</div>
    </div>

    <!-- Date -->
    <div class="date-block">
      <div class="date-label">تاريخ الإصدار</div>
      <div class="date-value">{{ $issueDate }}</div>
    </div>

    <!-- QR -->
    <div class="qr-block">
      {!! $qrSvg !!}
      <div class="verify-label">تحقق من الشهادة</div>
    </div>
  </div>

  <!-- Verification code -->
  <div class="verify-code">{{ $verificationCode }}</div>
</div>
</body>
</html>
