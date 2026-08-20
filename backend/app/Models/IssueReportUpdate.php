<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IssueReportUpdate extends Model
{
    public $timestamps = false;
    protected $fillable = ['issue_report_id', 'admin_id', 'from_status', 'to_status', 'public_message', 'created_at'];
    protected function casts(): array { return ['created_at' => 'datetime']; }
    public function report(): BelongsTo { return $this->belongsTo(IssueReport::class, 'issue_report_id'); }
    public function admin(): BelongsTo { return $this->belongsTo(User::class, 'admin_id'); }
}
