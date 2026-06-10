<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\CertificateUsage;
use App\Models\Organization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Creates certificate records with a unique verification code + tamper hash,
 * enforces the organization's monthly plan limit, and tracks usage.
 * PDF rendering is delegated to CertificateRenderer (kept separate so bulk
 * issuance can render asynchronously via queued jobs).
 */
class CertificateIssuer
{
    public function __construct(
        private CertificateHasher $hasher,
        private CertificateRenderer $renderer,
    ) {}

    /**
     * Issue a single certificate. When $render is true the PDF is generated
     * synchronously; bulk flows pass false and render inside a queued job.
     *
     * @param  array<string,mixed>  $data
     */
    public function issue(Organization $organization, array $data, bool $render = true): Certificate
    {
        $this->assertWithinPlanLimit($organization);

        return DB::transaction(function () use ($organization, $data, $render) {
            $certificate = new Certificate([
                'template_id' => $data['template_id'] ?? null,
                'batch_id' => $data['batch_id'] ?? null,
                'recipient_name' => $data['recipient_name'],
                'recipient_email' => $data['recipient_email'] ?? null,
                'recipient_phone' => $data['recipient_phone'] ?? null,
                'course_name' => $data['course_name'] ?? null,
                'issue_date' => $data['issue_date'] ?? now()->toDateString(),
                'expiry_date' => $data['expiry_date'] ?? null,
                'custom_fields' => $data['custom_fields'] ?? null,
                'status' => 'active',
                'verification_code' => $this->generateCode(),
            ]);
            $certificate->organization_id = $organization->id;
            // Eloquent assigns the UUID on save; set it now so the hash is stable.
            $certificate->id = (string) Str::uuid();
            $certificate->verification_hash = $this->hasher->computeFor($certificate);
            $certificate->save();

            $this->incrementUsage($organization);

            $certificate->events()->create(['event_type' => 'issued']);

            if ($render) {
                $this->renderer->renderPdf($certificate);
            }

            return $certificate;
        });
    }

    public function assertWithinPlanLimit(Organization $organization): void
    {
        $plan = $organization->plan;
        if (! $plan) {
            return; // No plan attached yet (e.g. during setup) – allow.
        }

        $limit = $plan->certificates_per_month;
        $used = $organization->usageForMonth(now()->format('Y-m'));

        if ($limit !== null && $used >= $limit) {
            throw new RuntimeException(
                "تم بلوغ الحد الشهري للباقة ({$limit} شهادة). يرجى ترقية الباقة."
            );
        }
    }

    private function incrementUsage(Organization $organization): void
    {
        $month = now()->format('Y-m');
        $usage = CertificateUsage::firstOrCreate(
            ['organization_id' => $organization->id, 'month' => $month],
            ['certificates_issued' => 0]
        );
        $usage->increment('certificates_issued');
    }

    private function generateCode(): string
    {
        do {
            // Human-friendly, unambiguous code e.g. CERT-7QK2-9F4D
            $code = 'CERT-'.strtoupper(Str::random(4)).'-'.strtoupper(Str::random(4));
        } while (Certificate::where('verification_code', $code)->exists());

        return $code;
    }
}
