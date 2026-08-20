<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IssueReport extends Model
{
    public const STATUS_NEW = 'new';
    public const STATUS_UNDER_REVIEW = 'under_review';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_CLOSED = 'closed';

    public const CATEGORIES = ['simulation', 'interface', 'performance', 'account', 'content', 'other'];
    public const STATUSES = [
        self::STATUS_NEW,
        self::STATUS_UNDER_REVIEW,
        self::STATUS_IN_PROGRESS,
        self::STATUS_RESOLVED,
        self::STATUS_CLOSED,
    ];

    protected $fillable = [
        'reference_code', 'reporter_id', 'reporter_username', 'reporter_email', 'category',
        'subject', 'description', 'status', 'first_seen_at', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'first_seen_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function reporter(): BelongsTo { return $this->belongsTo(User::class, 'reporter_id'); }
    public function attachments(): HasMany { return $this->hasMany(IssueReportAttachment::class); }
    public function updates(): HasMany { return $this->hasMany(IssueReportUpdate::class); }
}
