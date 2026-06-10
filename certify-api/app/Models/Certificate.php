<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Certificate extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'template_id', 'batch_id', 'recipient_name', 'recipient_email',
        'recipient_phone', 'course_name', 'issue_date', 'expiry_date', 'custom_fields',
        'status', 'verification_code', 'verification_hash', 'pdf_url', 'thumbnail_url',
        'linkedin_added', 'opened_count', 'downloaded_count', 'shared_count',
        'revoked_at', 'revoked_reason',
    ];

    protected $casts = [
        'custom_fields' => 'array',
        'issue_date' => 'date',
        'expiry_date' => 'date',
        'linkedin_added' => 'boolean',
        'revoked_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(CertificateEvent::class);
    }

    public function isValid(): bool
    {
        return $this->status === 'active'
            && (is_null($this->expiry_date) || $this->expiry_date->isFuture());
    }
}
