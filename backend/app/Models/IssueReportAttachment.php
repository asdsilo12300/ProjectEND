<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IssueReportAttachment extends Model
{
    public $timestamps = false;
    protected $fillable = ['issue_report_id', 'storage_path', 'original_name', 'mime_type', 'size_bytes', 'width', 'height', 'created_at'];
    protected function casts(): array { return ['created_at' => 'datetime']; }
    public function report(): BelongsTo { return $this->belongsTo(IssueReport::class, 'issue_report_id'); }
}
