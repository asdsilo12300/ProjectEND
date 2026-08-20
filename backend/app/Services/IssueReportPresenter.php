<?php

namespace App\Services;

use App\Models\IssueReport;

class IssueReportPresenter
{
    public function present(IssueReport $report, bool $includeDetails = false): array
    {
        $payload = [
            'id' => $report->id,
            'reference_code' => $report->reference_code,
            'category' => $report->category,
            'subject' => $report->subject,
            'description' => $includeDetails ? $report->description : null,
            'status' => $report->status,
            'first_seen_at' => $report->first_seen_at?->toISOString(),
            'resolved_at' => $report->resolved_at?->toISOString(),
            'created_at' => $report->created_at?->toISOString(),
            'updated_at' => $report->updated_at?->toISOString(),
            'reporter' => [
                'id' => $report->reporter_id,
                'username' => $report->reporter_username,
                'email' => $report->reporter_email,
            ],
            'attachments_count' => $report->attachments_count ?? $report->attachments->count(),
        ];

        if ($includeDetails) {
            $payload['attachments'] = $report->attachments->map(fn ($attachment) => [
                'id' => $attachment->id,
                'original_name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size_bytes' => $attachment->size_bytes,
                'width' => $attachment->width,
                'height' => $attachment->height,
                'url' => "/issue-reports/{$report->id}/attachments/{$attachment->id}",
                'created_at' => $attachment->created_at?->toISOString(),
            ])->values();
            $payload['updates'] = $report->updates->map(fn ($update) => [
                'id' => $update->id,
                'from_status' => $update->from_status,
                'to_status' => $update->to_status,
                'public_message' => $update->public_message,
                'admin' => $update->admin ? ['id' => $update->admin->id, 'username' => $update->admin->username] : null,
                'created_at' => $update->created_at?->toISOString(),
            ])->values();
        } else {
            $latest = $report->relationLoaded('updates') ? $report->updates->sortByDesc('created_at')->first() : null;
            $payload['latest_update'] = $latest ? [
                'to_status' => $latest->to_status,
                'public_message' => $latest->public_message,
                'created_at' => $latest->created_at?->toISOString(),
            ] : null;
        }

        return $payload;
    }
}
