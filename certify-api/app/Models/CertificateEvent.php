<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CertificateEvent extends Model
{
    protected $fillable = [
        'certificate_id', 'event_type', 'ip_address', 'user_agent',
        'referrer', 'country', 'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function certificate(): BelongsTo
    {
        return $this->belongsTo(Certificate::class);
    }
}
