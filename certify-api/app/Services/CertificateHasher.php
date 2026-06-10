<?php

namespace App\Services;

use App\Models\Certificate;

/**
 * Computes a tamper-evidence hash for a certificate. The hash is an HMAC-SHA256
 * over the certificate's immutable fields keyed by the application key. The
 * verification page recomputes it and compares with the stored value to detect
 * any direct database tampering.
 */
class CertificateHasher
{
    public function compute(array $data): string
    {
        $canonical = implode('|', [
            $data['id'] ?? '',
            $data['organization_id'] ?? '',
            $data['recipient_name'] ?? '',
            $data['recipient_email'] ?? '',
            $data['course_name'] ?? '',
            $data['issue_date'] ?? '',
            $data['verification_code'] ?? '',
        ]);

        return hash_hmac('sha256', $canonical, config('app.key'));
    }

    public function computeFor(Certificate $certificate): string
    {
        return $this->compute([
            'id' => $certificate->id,
            'organization_id' => $certificate->organization_id,
            'recipient_name' => $certificate->recipient_name,
            'recipient_email' => $certificate->recipient_email,
            'course_name' => $certificate->course_name,
            'issue_date' => $certificate->issue_date?->format('Y-m-d'),
            'verification_code' => $certificate->verification_code,
        ]);
    }

    public function matches(Certificate $certificate): bool
    {
        return hash_equals($certificate->verification_hash, $this->computeFor($certificate));
    }
}
