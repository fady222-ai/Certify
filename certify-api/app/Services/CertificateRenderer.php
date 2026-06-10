<?php

namespace App\Services;

use App\Models\Certificate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Spatie\Browsershot\Browsershot;

/**
 * Renders a Certificate model into a PDF (and stores it) using headless Chrome
 * via Spatie Browsershot. Chrome handles Arabic shaping/RTL natively, giving
 * pixel-perfect output that matches the visual template editor.
 */
class CertificateRenderer
{
    /**
     * Build the certificate HTML from its template + data.
     */
    public function html(Certificate $certificate): string
    {
        $organization = $certificate->organization;
        $verifyUrl = $this->verifyUrl($certificate);

        $qrSvg = QrCode::format('svg')
            ->size(140)
            ->margin(0)
            ->generate($verifyUrl);

        $view = optional($certificate->template)->design_data['blade'] ?? 'certificates.default';

        return View::make($view, [
            'certificate' => $certificate,
            'organization' => $organization,
            'recipientName' => $certificate->recipient_name,
            'courseName' => $certificate->course_name,
            'orgName' => optional($organization)->name ?? 'منصة الشهادات',
            'issueDate' => $certificate->issue_date?->format('Y/m/d'),
            'verificationCode' => $certificate->verification_code,
            'verifyUrl' => $verifyUrl,
            'qrSvg' => $qrSvg,
            'primaryColor' => optional($organization)->primary_color ?? '#1a56db',
            'logoUrl' => optional($organization)->logo_url,
            'signatureUrl' => optional($organization)->signature_url,
        ])->render();
    }

    /**
     * Render the certificate to a PDF, store it on the configured disk,
     * and return the stored path.
     */
    public function renderPdf(Certificate $certificate): string
    {
        $html = $this->html($certificate);

        $browsershot = Browsershot::html($html)
            ->noSandbox()
            ->showBackground()
            ->landscape()
            ->margins(0, 0, 0, 0)
            ->format('A4')
            ->setNodeBinary(config('certify.node_binary'))
            ->setNodeModulePath(config('certify.node_modules_path') ?? base_path('node_modules'));

        $chrome = config('certify.chrome_path');
        if ($chrome && file_exists($chrome)) {
            $browsershot->setChromePath($chrome);
        }

        $pdf = $browsershot->pdf();

        $path = "certificates/{$certificate->id}.pdf";
        Storage::disk(config('certify.storage_disk'))->put($path, $pdf);

        $certificate->forceFill(['pdf_url' => $path])->save();

        return $path;
    }

    public function verifyUrl(Certificate $certificate): string
    {
        return rtrim(config('certify.verify_base_url'), '/').'/verify/'.$certificate->verification_code;
    }
}
