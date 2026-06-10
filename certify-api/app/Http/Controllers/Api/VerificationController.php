<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Services\CertificateHasher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VerificationController extends Controller
{
    public function __construct(private CertificateHasher $hasher) {}

    /**
     * Public certificate verification endpoint.
     * GET /api/verify/{code}
     */
    public function show(Request $request, string $code): JsonResponse
    {
        $certificate = Certificate::with('organization')
            ->where('verification_code', $code)
            ->first();

        if (! $certificate) {
            return response()->json([
                'found' => false,
                'message' => 'لم يتم العثور على شهادة بهذا الرمز.',
            ], 404);
        }

        // Log the verification view (network-effect surface).
        $certificate->events()->create([
            'event_type' => 'opened',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'referrer' => $request->headers->get('referer'),
        ]);
        $certificate->increment('opened_count');

        $integrity = $this->hasher->matches($certificate);
        $org = $certificate->organization;

        return response()->json([
            'found' => true,
            'valid' => $certificate->isValid(),
            'integrity' => $integrity,
            'status' => $certificate->status,
            'certificate' => [
                'recipient_name' => $certificate->recipient_name,
                'course_name' => $certificate->course_name,
                'issue_date' => $certificate->issue_date?->format('Y-m-d'),
                'issue_date_label' => $certificate->issue_date?->locale('ar')->translatedFormat('j F Y'),
                'expiry_date' => $certificate->expiry_date?->format('Y-m-d'),
                'verification_code' => $certificate->verification_code,
                'pdf_url' => $certificate->pdf_url
                    ? url('storage/'.$certificate->pdf_url)
                    : null,
                'organization' => [
                    'name' => $org?->name,
                    'logo_url' => $org?->logo_url,
                    'primary_color' => $org?->primary_color ?? '#4f46e5',
                ],
            ],
        ]);
    }
}
