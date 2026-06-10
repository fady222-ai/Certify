<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CertificateUsage extends Model
{
    protected $table = 'certificate_usage';

    protected $fillable = [
        'organization_id', 'month', 'certificates_issued',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
