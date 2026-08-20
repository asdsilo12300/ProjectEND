<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Models\IssueReport;
use App\Services\IssueReportPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminIssueReportController extends Controller
{
    public function __construct(private readonly IssueReportPresenter $presenter) {}

    public function summary(): JsonResponse
    {
        return response()->json(['data' => ['unseen' => IssueReport::query()
            ->where('status', IssueReport::STATUS_NEW)
            ->whereNull('first_seen_at')
            ->count()]]);
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', Rule::in(IssueReport::STATUSES)],
            'category' => ['nullable', Rule::in(IssueReport::CATEGORIES)],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $search = trim((string) $request->query('search', ''));
        $reports = IssueReport::query()->withCount('attachments')
            ->when($search !== '', fn ($query) => $query->where(fn ($nested) => $nested
                ->whereLike('reference_code', "%{$search}%", caseSensitive: false)
                ->orWhereLike('subject', "%{$search}%", caseSensitive: false)
                ->orWhereLike('reporter_username', "%{$search}%", caseSensitive: false)
                ->orWhereLike('reporter_email', "%{$search}%", caseSensitive: false)))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('category'), fn ($query) => $query->where('category', $request->query('category')))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('created_at', '>=', $request->query('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('created_at', '<=', $request->query('date_to')))
            ->oldest()->paginate(15);
        $reports->setCollection($reports->getCollection()->map(fn ($report) => $this->presenter->present($report)));
        return response()->json($reports);
    }

    public function show(IssueReport $issueReport): JsonResponse
    {
        $issueReport->load(['attachments', 'updates' => fn ($query) => $query->oldest(), 'updates.admin'])->loadCount('attachments');
        return response()->json(['data' => $this->presenter->present($issueReport, true)]);
    }

    public function seen(Request $request, IssueReport $issueReport): JsonResponse
    {
        if ($issueReport->first_seen_at === null) {
            $issueReport->forceFill(['first_seen_at' => now()])->save();
            AdminActivityLog::record($request->user(), 'viewed_issue_report', 'issue_reports', $issueReport->id, ['reference_code' => $issueReport->reference_code]);
        }
        return response()->json(['data' => ['first_seen_at' => $issueReport->first_seen_at?->toISOString()]]);
    }

    public function status(Request $request, IssueReport $issueReport): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(IssueReport::STATUSES)],
            'public_message' => ['nullable', 'string', 'max:2000'],
        ]);
        $message = trim(strip_tags(str_replace("\0", '', (string) ($data['public_message'] ?? ''))));
        if ($data['status'] === $issueReport->status && $message === '') throw ValidationException::withMessages(['status' => 'Choose a new status or add a public update.']);

        DB::transaction(function () use ($request, $issueReport, $data, $message): void {
            $from = $issueReport->status;
            $issueReport->forceFill([
                'status' => $data['status'],
                'first_seen_at' => $issueReport->first_seen_at ?? now(),
                'resolved_at' => in_array($data['status'], ['resolved', 'closed'], true) ? now() : null,
            ])->save();
            $issueReport->updates()->create([
                'admin_id' => $request->user()->id,
                'from_status' => $from,
                'to_status' => $data['status'],
                'public_message' => $message === '' ? null : $message,
                'created_at' => now(),
            ]);
            AdminActivityLog::record($request->user(), 'updated_issue_report_status', 'issue_reports', $issueReport->id, ['from' => $from, 'to' => $data['status']]);
        });
        $issueReport->load(['attachments', 'updates' => fn ($query) => $query->oldest(), 'updates.admin'])->loadCount('attachments');
        return response()->json(['data' => $this->presenter->present($issueReport, true)]);
    }
}
